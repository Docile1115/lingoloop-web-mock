// Converts selected Quaternius Universal Animation Library clips (UE-mannequin rig, T-pose rest)
// into VRM-humanoid clips, following three-vrm's official Mixamo retargeting example:
//   rotation:  parentRestWorld * q * restWorld^-1   (written to the VRM normalized bone)
//   hips pos:  rest-parent world space, divided by the source hips height (re-scaled per avatar at runtime)
// Output values are VRM 1.0 normalized space; VRM 0.x avatars negate x/z at runtime (like the example).
// Usage: node ual-to-vrm.mjs <out.json> <glb>... ; also reads *_RM.glb next to each glb for walk speed.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { Quaternion, Vector3 } from "three";

const [out, ...inputs] = process.argv.slice(2);
const WANTED = {
  Idle_Loop: "idle",
  Idle_Talking_Loop: "talk",
  Walk_Loop: "walk",
  Sitting_Enter: "sitDown",
  Sitting_Idle_Loop: "sit",
  Sitting_Exit: "standUp",
  Interact: "interact",
  PickUp_Table: "pickUp",
  Farm_Watering: "water",
  Yes: "nod",
  Dance_Loop: "dance",
};
const BONES = {
  pelvis: "hips", spine_01: "spine", spine_02: "chest", spine_03: "upperChest", neck_01: "neck", Head: "head",
  clavicle_l: "leftShoulder", upperarm_l: "leftUpperArm", lowerarm_l: "leftLowerArm", hand_l: "leftHand",
  clavicle_r: "rightShoulder", upperarm_r: "rightUpperArm", lowerarm_r: "rightLowerArm", hand_r: "rightHand",
  thigh_l: "leftUpperLeg", calf_l: "leftLowerLeg", foot_l: "leftFoot", ball_l: "leftToes",
  thigh_r: "rightUpperLeg", calf_r: "rightLowerLeg", foot_r: "rightFoot", ball_r: "rightToes",
};
for (const side of ["l", "r"]) {
  const s = side === "l" ? "left" : "right";
  Object.assign(BONES, {
    [`thumb_01_${side}`]: `${s}ThumbMetacarpal`, [`thumb_02_${side}`]: `${s}ThumbProximal`, [`thumb_03_${side}`]: `${s}ThumbDistal`,
  });
  for (const [ue, vrm] of [["index", "Index"], ["middle", "Middle"], ["ring", "Ring"], ["pinky", "Little"]]) {
    Object.assign(BONES, {
      [`${ue}_01_${side}`]: `${s}${vrm}Proximal`, [`${ue}_02_${side}`]: `${s}${vrm}Intermediate`, [`${ue}_03_${side}`]: `${s}${vrm}Distal`,
    });
  }
}

function readGlb(file) {
  const data = readFileSync(file);
  const jsonLength = data.readUInt32LE(12);
  const json = JSON.parse(data.subarray(20, 20 + jsonLength).toString("utf8"));
  const binStart = 20 + jsonLength + 8;
  const bin = data.subarray(binStart, binStart + data.readUInt32LE(20 + jsonLength));
  const accessor = (index) => {
    const a = json.accessors[index], view = json.bufferViews[a.bufferView];
    const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    if (a.componentType !== 5126) throw new Error("only float accessors supported");
    const start = (view.byteOffset || 0) + (a.byteOffset || 0), stride = view.byteStride || comps * 4;
    const values = new Float32Array(a.count * comps);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < comps; c++) values[i * comps + c] = bin.readFloatLE(start + i * stride + c * 4);
    return values;
  };
  return { json, accessor };
}

/** Rest (bind) world rotation/position of every node. */
function restPose(json) {
  const parent = new Map();
  json.nodes.forEach((node, index) => (node.children || []).forEach((child) => parent.set(child, index)));
  const world = new Map();
  const solve = (index) => {
    if (world.has(index)) return world.get(index);
    const node = json.nodes[index];
    const q = new Quaternion(...(node.rotation || [0, 0, 0, 1]));
    const t = new Vector3(...(node.translation || [0, 0, 0]));
    const s = new Vector3(...(node.scale || [1, 1, 1]));
    let result;
    if (parent.has(index)) {
      const p = solve(parent.get(index));
      result = { q: p.q.clone().multiply(q), t: t.clone().multiply(p.s).applyQuaternion(p.q).add(p.t), s: s.clone().multiply(p.s) };
    } else result = { q, t, s };
    world.set(index, result);
    return result;
  };
  json.nodes.forEach((_, index) => solve(index));
  return { world, parent };
}

const round = (v) => Math.round(v * 1e5) / 1e5;
const clips = [];
let walkSpeed = null;
for (const file of inputs) {
  const { json, accessor } = readGlb(file);
  const { world, parent } = restPose(json);
  const nameToIndex = new Map(json.nodes.map((node, index) => [node.name, index]));
  const pelvis = nameToIndex.get("pelvis");
  const hipsHeight = world.get(pelvis).t.y;
  for (const anim of json.animations) {
    const id = WANTED[anim.name];
    if (!id) continue;
    let duration = 0;
    const tracks = [];
    for (const channel of anim.channels) {
      const nodeIndex = channel.target.node, nodeName = json.nodes[nodeIndex].name, bone = BONES[nodeName];
      if (!bone) continue;
      const sampler = anim.samplers[channel.sampler];
      const times = accessor(sampler.input), values = accessor(sampler.output);
      duration = Math.max(duration, times[times.length - 1]);
      const restInverse = world.get(nodeIndex).q.clone().invert();
      const parentRest = world.get(parent.get(nodeIndex)).q.clone();
      if (channel.target.path === "rotation") {
        const out = [];
        const q = new Quaternion();
        for (let i = 0; i < values.length; i += 4) {
          q.set(values[i], values[i + 1], values[i + 2], values[i + 3]).premultiply(parentRest).multiply(restInverse);
          out.push(round(q.x), round(q.y), round(q.z), round(q.w));
        }
        tracks.push({ bone, type: "quaternion", times: [...times].map(round), values: out });
      } else if (channel.target.path === "translation" && bone === "hips") {
        // Express the hips position in the (Y-up) world of the source rig, normalized by its hips height.
        const parentWorld = world.get(parent.get(nodeIndex));
        const out = [];
        const v = new Vector3();
        for (let i = 0; i < values.length; i += 3) {
          v.set(values[i], values[i + 1], values[i + 2]).multiply(parentWorld.s).applyQuaternion(parentWorld.q).add(parentWorld.t).divideScalar(hipsHeight);
          out.push(round(v.x), round(v.y), round(v.z));
        }
        tracks.push({ bone, type: "position", times: [...times].map(round), values: out });
      }
    }
    clips.push({ name: id, source: anim.name, duration: round(duration), tracks });
  }
  // Walk speed from the root-motion twin: root travel over one Walk_Loop cycle, in hips heights per second.
  const rm = file.replace(/\.glb$/, "_RM.glb");
  if (existsSync(rm)) {
    const twin = readGlb(rm);
    const walk = twin.json.animations.find((a) => a.name === "Walk_Loop");
    if (walk) {
      const rootIndex = twin.json.nodes.findIndex((n) => n.name === "root");
      const channel = walk.channels.find((c) => c.target.node === rootIndex && c.target.path === "translation");
      const sampler = walk.samplers[channel.sampler];
      const times = twin.accessor(sampler.input), values = twin.accessor(sampler.output);
      const { world: twinWorld, parent: twinParent } = restPose(twin.json);
      const parentWorld = twinWorld.get(twinParent.get(rootIndex)) || { q: new Quaternion(), s: new Vector3(1, 1, 1), t: new Vector3() };
      const first = new Vector3(values[0], values[1], values[2]).multiply(parentWorld.s).applyQuaternion(parentWorld.q);
      const n = values.length / 3 - 1;
      const last = new Vector3(values[n * 3], values[n * 3 + 1], values[n * 3 + 2]).multiply(parentWorld.s).applyQuaternion(parentWorld.q);
      const pelvisTwin = twin.json.nodes.findIndex((node) => node.name === "pelvis");
      const twinHips = twinWorld.get(pelvisTwin).t.y;
      walkSpeed = round(Math.hypot(last.x - first.x, last.z - first.z) / (times[times.length - 1] - times[0]) / twinHips);
      console.log("walk travel", last.clone().sub(first).toArray().map(round), "over", times[times.length - 1], "s");
    }
  }
}
writeFileSync(out, JSON.stringify({ format: "timotalk-humanoid-clips", version: 1, space: "vrm1-normalized", hipsUnit: "source-hips-height", walkSpeed, clips }));
console.log("clips", clips.map((c) => `${c.name}(${c.duration}s,${c.tracks.length} tracks)`).join(", "));
console.log("walkSpeed (hips heights/s)", walkSpeed, "bytes", readFileSync(out).length);
