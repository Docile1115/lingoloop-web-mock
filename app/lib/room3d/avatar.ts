import * as T from "three";
import type { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from "@pixiv/three-vrm";

/**
 * Humanoid clips baked offline from the CC0 Universal Animation Library into VRM 1.0
 * normalized space (see scripts/ual-to-vrm in the PR notes): rotations are ready for the
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

export type Avatar = {
  vrm: VRM;
  clips: Map<string, T.AnimationClip>;
  /** Ground speed (m/s) at which the walk clip's feet do not slide. */
  walkSpeed: number;
  /** Hips position of the seated pose relative to the avatar root, in metres. */
  sitHips: T.Vector3;
};

export async function loadAvatar(loader: GLTFLoader, avatarUrl: string, clipsUrl: string): Promise<Avatar> {
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const [gltf, data] = await Promise.all([
    loader.loadAsync(avatarUrl),
    fetch(clipsUrl).then((response) => {
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
  const hipsHeight = vrm.humanoid.normalizedRestPose.hips?.position?.[1] ?? 0.9;
  const clips = new Map<string, T.AnimationClip>();
  let sitHips = new T.Vector3(0, hipsHeight * 0.6, -hipsHeight * 0.36);
  for (const clip of data.clips) {
    const converted = toClip(vrm, clip, hipsHeight);
    if (converted.tracks.length) clips.set(clip.name, converted);
    if (clip.name === "sit") {
      const hips = clip.tracks.find((track) => track.bone === "hips" && track.type === "position");
      if (hips) sitHips = new T.Vector3(hips.values[0], hips.values[1], hips.values[2]).multiplyScalar(hipsHeight);
    }
  }
  return { vrm, clips, walkSpeed: data.walkSpeed * hipsHeight, sitHips };
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
