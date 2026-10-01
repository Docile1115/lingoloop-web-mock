import * as T from "three";
import type { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from "@pixiv/three-vrm";

/** Default residents (CC0 VRoid samples, see public/room3d/ATTRIBUTION.md), picked by profile gender. */
export type AvatarKind = "female" | "male";
const AVATAR_URLS: Record<AvatarKind, string> = {
  female: "/room3d/avatars/female.vrm",
  male: "/room3d/avatars/male.vrm",
};
const CLIPS_URL = "/room3d/humanoid-clips.json";
/** Taller avatars are scaled down to this height so they fit the furniture (the male sample is 1.92 m). */
const MAX_HEIGHT = 1.76;

/**
 * Humanoid clips baked offline from the CC0 Universal Animation Library into VRM 1.0
 * normalized space (scripts/room3d/ual-to-vrm.mjs): rotations are ready for the
 * normalized bones, hips positions are in units of the source hips height.
 */
export type HumanoidClipData = {
  walkSpeed: number;
  clips: Array<{
    name: string;
    duration: number;
    tracks: Array<{ bone: string; type: "quaternion" | "position"; times: number[]; values: number[] }>;
  }>;
};

/** The authored sit pose measured on this avatar, relative to its root (metres; the avatar faces +Z). */
export type SeatedPose = {
  /** Hips position. */
  hips: T.Vector3;
  /** Lowest point of the seat of the body (hips-weighted vertices): what rests on the cushion. */
  contact: number;
  /** Lowest point of the feet: below zero when the pose pushes them through the floor. */
  sole: number;
  /** How far the seat of the body reaches behind the hips: what touches the backrest. */
  back: number;
  /** Distance from the hips forward to the back of the calves: what clears the front of the seat. */
  calf: number;
};

export type Avatar = {
  vrm: VRM;
  clips: Map<string, T.AnimationClip>;
  /** Ground speed (m/s) at which the walk clip's feet do not slide. */
  walkSpeed: number;
  seated: SeatedPose;
};

export async function loadAvatar(
  loader: GLTFLoader,
  kind: AvatarKind,
  onProgress?: (fraction: number) => void,
): Promise<Avatar> {
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const [gltf, data] = await Promise.all([
    loader.loadAsync(AVATAR_URLS[kind], (event) => {
      if (event.lengthComputable && event.total) onProgress?.(event.loaded / event.total);
    }),
    fetch(CLIPS_URL).then((response) => {
      if (!response.ok) throw new Error("clips " + response.status);
      return response.json() as Promise<HumanoidClipData>;
    }),
  ]);
  const vrm = gltf.userData.vrm as VRM | undefined;
  if (!vrm) throw new Error("not a VRM");
  // Fewer draw calls and smaller GPU buffers; VRM 0.x avatars face -Z until rotated.
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse((node) => {
    node.frustumCulled = false;
    if (node instanceof T.Mesh) {
      node.castShadow = true;
      node.receiveShadow = false;
    }
  });
  // Spring bones, look-at and the normalized rig all work in world space, so a uniform scale is safe.
  const height = new T.Box3().setFromObject(vrm.scene).getSize(new T.Vector3()).y;
  const scale = height > MAX_HEIGHT ? MAX_HEIGHT / height : 1;
  vrm.scene.scale.setScalar(scale);
  const hipsHeight = vrm.humanoid.normalizedRestPose.hips?.position?.[1] ?? 0.9;
  const clips = new Map<string, T.AnimationClip>();
  for (const clip of data.clips) {
    const converted = toClip(vrm, clip, hipsHeight);
    if (converted.tracks.length) clips.set(clip.name, converted);
  }
  const sit = clips.get("sit");
  if (!sit) throw new Error("clips without a sit pose");
  return { vrm, clips, walkSpeed: data.walkSpeed * hipsHeight * scale, seated: measureSeated(vrm, sit) };
}

/** Same conversion as three-vrm's Mixamo example, minus the parts already baked offline. */
function toClip(vrm: VRM, clip: HumanoidClipData["clips"][number], hipsHeight: number) {
  const vrm0 = vrm.meta?.metaVersion === "0";
  const tracks: T.KeyframeTrack[] = [];
  for (const track of clip.tracks) {
    const node = vrm.humanoid.getNormalizedBoneNode(track.bone as VRMHumanBoneName);
    if (!node) continue;
    if (track.type === "quaternion") {
      const values = vrm0 ? track.values.map((v, i) => (i % 2 === 0 ? -v : v)) : track.values;
      tracks.push(new T.QuaternionKeyframeTrack(`${node.name}.quaternion`, track.times, values));
    } else {
      const values = track.values.map((v, i) => (vrm0 && i % 3 !== 1 ? -v : v) * hipsHeight);
      tracks.push(new T.VectorKeyframeTrack(`${node.name}.position`, track.times, values));
    }
  }
  return new T.AnimationClip(clip.name, clip.duration, tracks);
}

/**
 * Poses the avatar in the sit clip once and measures where its body ends up, so the room can
 * put the seat of the body on the cushion and the feet on the floor whatever the proportions.
 */
function measureSeated(vrm: VRM, sit: T.AnimationClip): SeatedPose {
  const mixer = new T.AnimationMixer(vrm.scene);
  mixer.clipAction(sit).play();
  mixer.update(0);
  vrm.humanoid.update();
  vrm.scene.updateMatrixWorld(true);
  const bone = (name: VRMHumanBoneName) => vrm.humanoid.getRawBoneNode(name);
  const hipsBone = bone("hips");
  const group = (...names: VRMHumanBoneName[]) => new Set(names.map(bone).filter((node) => node !== null));
  const feet = group("leftFoot", "rightFoot", "leftToes", "rightToes"),
    calves = group("leftLowerLeg", "rightLowerLeg");
  const hips = hipsBone ? hipsBone.getWorldPosition(new T.Vector3()) : new T.Vector3();
  let contact = Infinity,
    sole = Infinity,
    back = Infinity,
    calf = Infinity;
  const vertex = new T.Vector3();
  vrm.scene.traverse((node) => {
    if (!(node instanceof T.SkinnedMesh)) return;
    const { skinIndex, skinWeight, position } = node.geometry.attributes;
    if (!skinIndex || !skinWeight || !position) return;
    for (let i = 0; i < position.count; i++) {
      let strongest = 0,
        weight = -1;
      for (let k = 0; k < 4; k++)
        if (skinWeight.getComponent(i, k) > weight) {
          weight = skinWeight.getComponent(i, k);
          strongest = skinIndex.getComponent(i, k);
        }
      const owner = node.skeleton.bones[strongest];
      const isSeat = owner === hipsBone,
        isFoot = feet.has(owner),
        isCalf = calves.has(owner);
      if (!isSeat && !isFoot && !isCalf) continue;
      node.applyBoneTransform(i, vertex.fromBufferAttribute(position, i)).applyMatrix4(node.matrixWorld);
      if (isSeat) {
        contact = Math.min(contact, vertex.y);
        back = Math.min(back, vertex.z);
      } else if (isFoot) sole = Math.min(sole, vertex.y);
      else calf = Math.min(calf, vertex.z);
    }
  });
  mixer.stopAllAction();
  mixer.uncacheRoot(vrm.scene);
  vrm.humanoid.resetNormalizedPose();
  vrm.humanoid.update();
  return {
    hips,
    contact: Number.isFinite(contact) ? contact : hips.y * 0.8,
    sole: Number.isFinite(sole) ? sole : 0,
    back: Number.isFinite(back) ? hips.z - back : 0.1,
    calf: Number.isFinite(calf) ? calf - hips.z : 0.3,
  };
}

/** Natural blinking every few seconds. */
export class Blinker {
  private wait = 2 + Math.random() * 3;
  private phase = -1;
  update(vrm: VRM, dt: number) {
    const expressions = vrm.expressionManager;
    if (!expressions) return;
    if (this.phase < 0) {
      this.wait -= dt;
      if (this.wait <= 0) this.phase = 0;
      return;
    }
    this.phase += dt / 0.16;
    const value = this.phase < 1 ? Math.sin(this.phase * Math.PI) : 0;
    expressions.setValue("blink", value);
    if (this.phase >= 1) {
      this.phase = -1;
      this.wait = 2 + Math.random() * 4;
    }
  }
}
