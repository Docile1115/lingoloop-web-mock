import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { VRMHumanBoneName } from "@pixiv/three-vrm";
import { validateRoom3D, ROOM3D_SIZES } from "../backend/room3d.mjs";

test("standalone 3D preview exits with full document navigation", async () => {
  const page = await readFile(new URL("../app/room-preview/page.tsx", import.meta.url), "utf8");
  assert.match(page, /<a className="r3-back" href="\/"/);
  assert.doesNotMatch(page, /from ["']next\/link["']/);
});

const modelSource = ts
  .transpileModule(await readFile(new URL("../app/lib/room3d/models.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  })
  .outputText.replace(
    /from (["'])(three[^"']*)\1/g,
    (_, q, path) => `from ${JSON.stringify(import.meta.resolve(path))}`,
  );
const models = await import(`data:text/javascript;base64,${Buffer.from(modelSource).toString("base64")}`);
test("3D client catalogue and starter layout satisfy the real server contract", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(models.CATALOG).map(([kind, size]) => [kind, [size.width, size.depth]])),
    ROOM3D_SIZES,
  );
  assert.equal(validateRoom3D({ version: 1, items: models.INITIAL_FURNITURE }).items.length, 8);
});

const src = await readFile(new URL("../app/lib/room3d/navigation.ts", import.meta.url), "utf8");
const js = ts.transpileModule(src, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const nav = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const box = { id: "sofa", x: 0, z: 0, halfX: 1, halfZ: 0.6 };

test("3D navigation preserves exact endpoints without grid snapping", () => {
  const start = { x: -2.13, z: 1.67 },
    end = { x: 2.37, z: 1.53 };
  assert.deepEqual(nav.findPath(start, end, []), [end]);
  assert.deepEqual(nav.findPath(start, start, []), []);
});
test("3D paths avoid inflated furniture including corners", () => {
  const start = { x: -3, z: 0 },
    end = { x: 3, z: 0 };
  const path = nav.findPath(start, end, [box]);
  assert.ok(path);
  assert.ok(path.length > 1);
  assert.deepEqual(path.at(-1), end);
  let previous = start;
  for (const point of path) {
    assert.ok(nav.visible(previous, point, [box]));
    previous = point;
  }
});
test("3D smoothed routes round corners without entering furniture", () => {
  const start = { x: -3, z: 0 },
    end = { x: 3, z: 0 };
  const route = nav.findPath(start, end, [box]);
  const smooth = nav.smoothRoute(start, route, [box]);
  assert.deepEqual(smooth.at(-1), end);
  assert.ok(smooth.length > route.length);
  let previous = start;
  for (const point of smooth) {
    assert.ok(nav.visible(previous, point, [box]));
    previous = point;
  }
});
test("3D smoothing leaves straight and empty routes unchanged", () => {
  assert.deepEqual(nav.smoothRoute({ x: 0, z: 0 }, [{ x: 1, z: 0 }], []), [{ x: 1, z: 0 }]);
  assert.deepEqual(nav.smoothRoute({ x: 0, z: 0 }, [], []), []);
});
test("3D blocked, invalid and out-of-room targets cannot produce movement", () => {
  for (const end of [
    { x: 0, z: 0 },
    { x: NaN, z: 1 },
    { x: Infinity, z: 1 },
    { x: 8, z: 0 },
  ])
    assert.equal(nav.findPath({ x: -3, z: 0 }, end, [box]), null);
  assert.equal(nav.findPath({ x: 0, z: 0 }, { x: 3, z: 0 }, [box]), null);
  assert.equal(nav.findPath({ x: -3, z: 0 }, { x: 3, z: 0 }, [{ ...box, halfZ: 4 }]), null);
});
test("furniture placement protects room bounds, neighbors and resident", () => {
  assert.ok(nav.placementFree(box, [box], { x: 3, z: 3 }));
  assert.equal(nav.placementFree(box, [{ ...box, id: "other", x: 1.4 }], { x: 3, z: 3 }), false);
  assert.equal(nav.placementFree(box, [], { x: 0, z: 0 }), false);
  assert.equal(nav.placementFree({ ...box, x: 4 }, [], { x: 0, z: 0 }), false);
  assert.equal(nav.placementFree({ ...box, x: NaN }, [], { x: 0, z: 0 }), false);
});
function glbJson(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, "GLB magic");
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
}
test("bundled VRM avatars are self-contained CC0 models with one draw call per material", async () => {
  for (const name of ["female", "male"]) {
    const json = glbJson(await readFile(new URL(`../public/room3d/avatars/${name}.vrm`, import.meta.url)));
    const vrm = json.extensions.VRM;
    assert.equal(vrm.meta.licenseName, "CC0", name);
    assert.equal(vrm.meta.commercialUssageName, "Allow", name);
    for (const resource of [...json.buffers, ...json.images]) assert.equal(resource.uri, undefined, name);
    for (const bone of ["hips", "leftUpperLeg", "rightLowerLeg", "leftFoot", "rightFoot", "head"])
      assert.ok(vrm.humanoid.humanBones.some((row) => row.bone === bone), `${name} ${bone}`);
    // scripts/room3d/vrm-shrink.mjs merges same-material primitives (VRoid hair strands).
    for (const mesh of json.meshes) {
      const materials = mesh.primitives.map((primitive) => primitive.material);
      assert.equal(new Set(materials).size, materials.length, `${name} ${mesh.name}`);
    }
  }
});
test("baked humanoid clips match exactly what the room plays", async () => {
  const data = JSON.parse(await readFile(new URL("../public/room3d/humanoid-clips.json", import.meta.url), "utf8"));
  assert.equal(data.format, "timotalk-humanoid-clips");
  assert.equal(data.version, 1);
  assert.ok(data.walkSpeed > 0.5 && data.walkSpeed < 2);
  const scene = await readFile(new URL("../app/lib/room3d/scene.ts", import.meta.url), "utf8");
  const played = [...scene.match(/const names: Record<string, string> = \{([^}]+)\}/)[1].matchAll(/"(\w+)"/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(data.clips.map((clip) => clip.name).sort(), played.sort());
  const bones = new Set(Object.values(VRMHumanBoneName));
  for (const clip of data.clips) {
    assert.ok(clip.duration > 0, clip.name);
    for (const track of clip.tracks) {
      assert.ok(bones.has(track.bone), `${clip.name} ${track.bone}`);
      if (track.type === "position") assert.equal(track.bone, "hips");
      assert.equal(track.values.length, track.times.length * (track.type === "quaternion" ? 4 : 3));
      assert.ok(track.values.every(Number.isFinite), `${clip.name} ${track.bone}`);
    }
  }
});
