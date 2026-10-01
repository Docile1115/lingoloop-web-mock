// Shrinks a .vrm (GLB) without touching the VRM extension data (meta, humanoid, spring bones,
// MToon, blend shapes), so every VRM feature survives untouched:
//  1. resizes the textures,
//  2. merges primitives that share a mesh and an opaque/cutout material into one draw call
//     (VRoid exports every hair strand as its own primitive: 48 → 2 for the female sample),
//  3. stores indices as 16-bit where the mesh is small enough.
// Usage: node scripts/room3d/vrm-shrink.mjs <in.vrm> <out.vrm> [colorMax=512] [normalMax=256]
import fs from "node:fs";
import { createRequire } from "node:module";

// sharp ships with the API service; reuse it instead of adding a web dependency.
const sharp = createRequire(new URL("../../backend/package.json", import.meta.url))("sharp");

const [input, output, colorArg, normalArg] = process.argv.slice(2);
const COLOR_MAX = Number(colorArg || 512);
const NORMAL_MAX = Number(normalArg || 256);
const ELEMENT_ARRAY_BUFFER = 34963;

async function shrinkTextures(json, views, report) {
  for (const image of json.images || []) {
    const bytes = views[image.bufferView];
    const meta = await sharp(bytes).metadata();
    const name = image.name || "";
    const limit = /thumbnail/i.test(name) ? 64 : /_nml|normal/i.test(name) ? NORMAL_MAX : /matcap|_spe|_out/i.test(name) ? 256 : COLOR_MAX;
    const scale = Math.min(1, limit / Math.max(meta.width, meta.height));
    const width = Math.max(1, Math.round(meta.width * scale)),
      height = Math.max(1, Math.round(meta.height * scale));
    let pipeline = sharp(bytes).resize(width, height, { fit: "fill" });
    // Keep PNG where alpha is actually used (hair cards, eyelashes); otherwise JPEG is far smaller.
    let opaque = !meta.hasAlpha;
    if (meta.hasAlpha) {
      const stats = await sharp(bytes).stats();
      opaque = stats.channels[3]?.min === 255;
    }
    const isNormal = /_nml|normal/i.test(name);
    let out, mimeType;
    if (opaque && !isNormal && width > 8) {
      out = await pipeline.removeAlpha().jpeg({ quality: 88, mozjpeg: true }).toBuffer();
      mimeType = "image/jpeg";
    } else {
      out = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      mimeType = "image/png";
    }
    if (out.length < bytes.length || scale < 1) {
      views[image.bufferView] = out;
      image.mimeType = mimeType;
      report.push(`${name}: ${meta.width}x${meta.height} ${(bytes.length / 1024).toFixed(0)}KB -> ${width}x${height} ${mimeType.slice(6)} ${(out.length / 1024).toFixed(0)}KB`);
    }
  }
}

function readIndices(json, views, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const bytes = views[accessor.bufferView].subarray(accessor.byteOffset || 0);
  const size = { 5121: 1, 5123: 2, 5125: 4 }[accessor.componentType];
  const values = new Uint32Array(accessor.count);
  for (let i = 0; i < accessor.count; i++)
    values[i] = size === 4 ? bytes.readUInt32LE(i * 4) : size === 2 ? bytes.readUInt16LE(i * 2) : bytes[i];
  return values;
}

function writeIndices(json, views, values) {
  // 0xffff is the WebGL 2 primitive-restart index for 16-bit lists, so it must not be a vertex.
  const short = values.every((value) => value < 0xffff);
  const bytes = Buffer.alloc(values.length * (short ? 2 : 4));
  values.forEach((value, i) => (short ? bytes.writeUInt16LE(value, i * 2) : bytes.writeUInt32LE(value, i * 4)));
  views.push(bytes);
  json.bufferViews.push({ buffer: 0, byteLength: bytes.length, target: ELEMENT_ARRAY_BUFFER });
  json.accessors.push({ bufferView: json.bufferViews.length - 1, componentType: short ? 5123 : 5125, count: values.length, type: "SCALAR" });
  return json.accessors.length - 1;
}

/** One primitive per (mesh, material) for opaque and cutout materials; blended ones keep their draw order. */
function mergePrimitives(json, views, report) {
  const blendModes = new Map((json.extensions?.VRM?.materialProperties || []).map((p) => [p.name, p.floatProperties?._BlendMode ?? 0]));
  for (const mesh of json.meshes) {
    const before = mesh.primitives.length;
    const merged = [];
    const groups = new Map();
    for (const primitive of mesh.primitives) {
      const material = json.materials[primitive.material];
      const blended = material.alphaMode === "BLEND" || (blendModes.get(material.name) ?? 0) >= 2;
      // Only primitives drawing the same vertices (and morph targets) can share an index list.
      const key = blended
        ? null
        : JSON.stringify([primitive.material, primitive.mode ?? 4, primitive.attributes, primitive.targets ?? []]);
      const group = key && groups.get(key);
      if (group) group.indices.push(readIndices(json, views, primitive.indices));
      else {
        const entry = { primitive: { ...primitive }, indices: [readIndices(json, views, primitive.indices)] };
        if (key) groups.set(key, entry);
        merged.push(entry);
      }
    }
    mesh.primitives = merged.map(({ primitive, indices }) => {
      const values = new Uint32Array(indices.reduce((sum, list) => sum + list.length, 0));
      let offset = 0;
      for (const list of indices) {
        values.set(list, offset);
        offset += list.length;
      }
      return { ...primitive, indices: writeIndices(json, views, values) };
    });
    report.push(`${mesh.name}: ${before} -> ${mesh.primitives.length} primitives`);
  }
}

/** Drops accessors and buffer views nothing refers to any more, renumbering the references. */
function collectGarbage(json, views) {
  const accessorRefs = [];
  for (const mesh of json.meshes)
    for (const primitive of mesh.primitives) {
      accessorRefs.push([primitive, "indices"]);
      for (const name of Object.keys(primitive.attributes)) accessorRefs.push([primitive.attributes, name]);
      for (const target of primitive.targets || []) for (const name of Object.keys(target)) accessorRefs.push([target, name]);
    }
  for (const skin of json.skins || []) if (skin.inverseBindMatrices !== undefined) accessorRefs.push([skin, "inverseBindMatrices"]);
  for (const animation of json.animations || [])
    for (const sampler of animation.samplers) accessorRefs.push([sampler, "input"], [sampler, "output"]);
  const accessorMap = new Map();
  const accessors = [];
  for (const [owner, key] of accessorRefs) {
    if (owner[key] === undefined) continue;
    if (!accessorMap.has(owner[key])) {
      accessorMap.set(owner[key], accessors.length);
      accessors.push(json.accessors[owner[key]]);
    }
    owner[key] = accessorMap.get(owner[key]);
  }
  json.accessors = accessors;

  const viewRefs = [];
  for (const accessor of json.accessors) {
    if (accessor.bufferView !== undefined) viewRefs.push([accessor, "bufferView"]);
    if (accessor.sparse) viewRefs.push([accessor.sparse.indices, "bufferView"], [accessor.sparse.values, "bufferView"]);
  }
  for (const image of json.images || []) if (image.bufferView !== undefined) viewRefs.push([image, "bufferView"]);
  const viewMap = new Map();
  const bufferViews = [];
  const bytes = [];
  for (const [owner, key] of viewRefs) {
    if (!viewMap.has(owner[key])) {
      viewMap.set(owner[key], bufferViews.length);
      bufferViews.push(json.bufferViews[owner[key]]);
      bytes.push(views[owner[key]]);
    }
    owner[key] = viewMap.get(owner[key]);
  }
  json.bufferViews = bufferViews;
  return bytes;
}

async function main() {
  const data = fs.readFileSync(input);
  if (data.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB");
  const jsonLength = data.readUInt32LE(12);
  const json = JSON.parse(data.subarray(20, 20 + jsonLength).toString("utf8"));
  const binStart = 20 + jsonLength + 8;
  const bin = data.subarray(binStart, binStart + data.readUInt32LE(20 + jsonLength));
  let views = json.bufferViews.map((view) => bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength));

  const report = [];
  await shrinkTextures(json, views, report);
  mergePrimitives(json, views, report);
  views = collectGarbage(json, views);

  // Rebuild the binary chunk with every buffer view re-packed (4-byte aligned).
  const parts = [];
  let offset = 0;
  json.bufferViews.forEach((view, index) => {
    const bytes = views[index];
    const pad = (4 - (offset % 4)) % 4;
    if (pad) parts.push(Buffer.alloc(pad));
    offset += pad;
    view.byteOffset = offset;
    view.byteLength = bytes.length;
    parts.push(bytes);
    offset += bytes.length;
  });
  const newBin = Buffer.concat(parts);
  const binPad = (4 - (newBin.length % 4)) % 4;
  json.buffers[0].byteLength = newBin.length;
  let jsonBytes = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc(jsonPad, 0x20)]);
  const total = 12 + 8 + jsonBytes.length + 8 + newBin.length + binPad;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBytes.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(newBin.length + binPad, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(output, Buffer.concat([header, jsonHeader, jsonBytes, binHeader, newBin, Buffer.alloc(binPad)]));
  console.log(report.join("\n"));
  console.log(`size ${(data.length / 1048576).toFixed(2)}MB -> ${(total / 1048576).toFixed(2)}MB`);
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
