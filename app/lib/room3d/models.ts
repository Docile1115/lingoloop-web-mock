import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Obstacle } from "./navigation";

import type { Kind, Furnishing } from "./config";
export type { Kind, Furnishing } from "./config";
export const CATALOG: Record<Kind, { width: number; depth: number }> = {
  sofa: { width: 2.65, depth: 1.02 },
  table: { width: 1.3, depth: 0.7 },
  desk: { width: 1.8, depth: 0.75 },
  chair: { width: 0.68, depth: 0.7 },
  shelf: { width: 1.12, depth: 0.42 },
  plant: { width: 0.63, depth: 0.63 },
  frame: { width: 0.92, depth: 0.6 },
  board: { width: 1.12, depth: 0.65 },
  bed: { width: 1.65, depth: 2.25 },
};
export const INITIAL_FURNITURE: Furnishing[] = [
  { id: "sofa", kind: "sofa", x: -1.4, z: -2.6, rotation: 0 },
  { id: "table", kind: "table", x: -1.4, z: -0.85, rotation: 0 },
  { id: "desk", kind: "desk", x: 2.75, z: -2.65, rotation: 0 },
  { id: "chair", kind: "chair", x: 2.75, z: -1.4, rotation: Math.PI },
  { id: "shelf", kind: "shelf", x: -3.7, z: -2.55, rotation: 0 },
  { id: "plant", kind: "plant", x: 0.65, z: -2.8, rotation: 0 },
  { id: "frame", kind: "frame", x: 3.05, z: 1, rotation: -0.2 },
  { id: "whiteboard", kind: "board", x: -3.2, z: 0.7, rotation: 0.25 },
];
export function footprint(item: Furnishing): Obstacle {
  const d = CATALOG[item.kind],
    c = Math.abs(Math.cos(item.rotation)),
    s = Math.abs(Math.sin(item.rotation));
  return {
    id: item.id,
    x: item.x,
    z: item.z,
    halfX: (d.width * c + d.depth * s) / 2,
    halfZ: (d.width * s + d.depth * c) / 2,
  };
}
export type Materials = ReturnType<typeof materials>;
export function materials() {
  const surface = (color: string, roughness = 0.75, metalness = 0) =>
    new T.MeshStandardMaterial({ color, roughness, metalness });
  const grain = document.createElement("canvas");
  grain.width = grain.height = 256;
  const ctx = grain.getContext("2d")!;
  ctx.fillStyle = "#c5a078";
  ctx.fillRect(0, 0, 256, 256);
  let seed = 721;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 2200; i++) {
    ctx.strokeStyle = `rgba(${random() > 0.5 ? "68,42,20" : "249,222,183"},${random() * 0.12})`;
    ctx.beginPath();
    const x = random() * 256,
      y = random() * 256;
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 20, y - 2, x + 90, y + 2, x + random() * 150, y);
    ctx.stroke();
  }
  const woodMap = new T.CanvasTexture(grain);
  woodMap.colorSpace = T.SRGBColorSpace;
  woodMap.wrapS = woodMap.wrapT = T.RepeatWrapping;
  woodMap.repeat.set(1, 2);
  const fabric = document.createElement("canvas");
  fabric.width = fabric.height = 128;
  const fc = fabric.getContext("2d")!;
  fc.fillStyle = "#ddd";
  fc.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 2) {
    fc.strokeStyle = i % 4 ? "#bcbcbc" : "#fafafa";
    fc.beginPath();
    fc.moveTo(i, 0);
    fc.lineTo(i, 128);
    fc.stroke();
    fc.strokeStyle = "#ccc";
    fc.beginPath();
    fc.moveTo(0, i);
    fc.lineTo(128, i);
    fc.stroke();
  }
  const weave = new T.CanvasTexture(fabric);
  weave.wrapS = weave.wrapT = T.RepeatWrapping;
  weave.repeat.set(4, 4);
  const upholstered = (color: string) =>
    new T.MeshStandardMaterial({
      color,
      roughness: 1,
      bumpMap: weave,
      bumpScale: 0.018,
    });
  return {
    wood: new T.MeshStandardMaterial({ map: woodMap, roughness: 0.66 }),
    walnut: surface("#624631"),
    cream: surface("#f3ece0"),
    wall: surface("#ddd9c9"),
    metal: surface("#3b423d", 0.4, 0.65),
    brass: surface("#ab8450", 0.38, 0.7),
    sofa: upholstered("#d2c7ab"),
    pillow: upholstered("#798571"),
    accent: upholstered("#b77f60"),
    white: surface("#f7f4e8"),
    rug: upholstered("#ada18c"),
    leaf: surface("#456849"),
    leafLight: surface("#6e8c58"),
    soil: surface("#423c2d"),
    terracotta: surface("#b37955"),
    glass: new T.MeshPhysicalMaterial({
      color: "#dcebe9",
      roughness: 0.2,
      transparent: true,
      opacity: 0.35,
    }),
    screen: surface("#202c2b"),
    woodMap,
    weave,
  };
}
type Mat = T.Material | T.Material[];
function solid(
  parent: T.Group,
  geo: T.BufferGeometry,
  mat: Mat,
  p: [number, number, number],
  rotation?: [number, number, number],
) {
  const m = new T.Mesh(geo, mat);
  m.position.set(...p);
  if (rotation) m.rotation.set(...rotation);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function box(
  parent: T.Group,
  size: [number, number, number],
  mat: Mat,
  p: [number, number, number],
  radius = 0.025,
) {
  return solid(
    parent,
    new RoundedBoxGeometry(
      ...size,
      3,
      Math.min(radius, ...size.map((v) => v / 3)),
    ),
    mat,
    p,
  );
}
function cylinder(
  parent: T.Group,
  top: number,
  bottom: number,
  height: number,
  mat: Mat,
  p: [number, number, number],
) {
  return solid(parent, new T.CylinderGeometry(top, bottom, height, 24), mat, p);
}
function stem(
  parent: T.Group,
  a: T.Vector3,
  b: T.Vector3,
  r: number,
  mat: Mat,
) {
  const delta = b.clone().sub(a),
    m = solid(
      parent,
      new T.CylinderGeometry(r, r, delta.length(), 8),
      mat,
      a.clone().add(b).multiplyScalar(0.5).toArray() as [
        number,
        number,
        number,
      ],
    );
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
  return m;
}
function legs(
  group: T.Group,
  m: Materials,
  w: number,
  d: number,
  height: number,
) {
  for (const x of [-w / 2, w / 2])
    for (const z of [-d / 2, d / 2])
      box(group, [0.065, height, 0.065], m.walnut, [x, height / 2, z], 0.01);
}
export function pictureTexture(board = false, notes: string[] = []) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 512;
  const c = canvas.getContext("2d")!;
  c.fillStyle = board ? "#f5f4e9" : "#f1ddc3";
  c.fillRect(0, 0, 768, 512);
  if (board) {
    c.fillStyle = "#426451";
    c.font = "italic 56px Georgia";
    c.fillText("Make yourself at home.", 55, 100);
    c.font = "28px sans-serif";
    c.fillStyle = "#7e877a";
    c.fillText("Leave a little hello.", 60, 155);
    for (let i = 0; i < 3; i++) {
      c.save();
      c.translate(160 + i * 220, 320 + (i % 2) * 25);
      c.rotate((i - 1) * 0.06);
      c.fillStyle = ["#efe0a6", "#e0bea8", "#c5d3bd"][i];
      c.shadowColor = "#0002";
      c.shadowBlur = 12;
      c.fillRect(-85, -90, 170, 170);
      c.shadowBlur = 0;
      c.fillStyle = "#62705c";
      c.font = "21px sans-serif";
      const text = notes.slice(-3)[i] || "";
      let line = "",
        row = 0;
      for (const char of text) {
        if (c.measureText(line + char).width > 132 || char === "\n") {
          c.fillText(line, -66, -46 + row * 29);
          line = "";
          row++;
          if (row === 4) break;
        }
        if (char !== "\n") line += char;
      }
      if (row < 4) c.fillText(line, -66, -46 + row * 29);
      c.restore();
    }
  } else {
    const gradient = c.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, "#ead3b3");
    gradient.addColorStop(1, "#eee4d4");
    c.fillStyle = gradient;
    c.fillRect(0, 0, 768, 512);
    c.fillStyle = "#c1764e";
    c.beginPath();
    c.arc(530, 150, 68, 0, Math.PI * 2);
    c.fill();
    for (let i = 0; i < 4; i++) {
      c.fillStyle = ["#abaf96", "#869786", "#698476", "#435e54"][i];
      c.beginPath();
      c.moveTo(0, 340 + i * 40);
      c.bezierCurveTo(240, 130 + i * 70, 340, 470 - i * 12, 768, 270 + i * 40);
      c.lineTo(768, 512);
      c.lineTo(0, 512);
      c.fill();
    }
  }
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}
export function furniture(kind: Kind, m: Materials) {
  const g = new T.Group();
  switch (kind) {
    case "sofa": {
      legs(g, m, 2.25, 0.65, 0.2);
      box(g, [2.5, 0.32, 0.92], m.sofa, [0, 0.35, 0], 0.09);
      box(g, [2.5, 0.64, 0.22], m.sofa, [0, 0.8, -0.38], 0.09);
      for (const x of [-1.19, 1.19])
        box(g, [0.26, 0.62, 0.99], m.sofa, [x, 0.57, 0], 0.1);
      for (const x of [-0.7, 0, 0.7]) {
        box(g, [0.68, 0.18, 0.7], m.sofa, [x, 0.575, 0.08], 0.06);
        const back = box(g, [0.69, 0.42, 0.16], m.sofa, [x, 0.84, -0.25], 0.08);
        back.rotation.x = -0.1;
      }
      const pillow = box(
        g,
        [0.42, 0.42, 0.17],
        m.pillow,
        [-0.83, 0.82, 0.01],
        0.11,
      );
      pillow.rotation.set(-0.25, 0, 0.18);
      const pillow2 = box(
        g,
        [0.39, 0.4, 0.16],
        m.accent,
        [0.83, 0.81, -0.01],
        0.1,
      );
      pillow2.rotation.set(-0.18, 0, -0.15);
      break;
    }
    case "table": {
      legs(g, m, 1, 0.4, 0.32);
      box(g, [1.3, 0.075, 0.7], m.wood, [0, 0.365, 0], 0.065);
      box(g, [0.27, 0.035, 0.2], m.pillow, [-0.21, 0.427, 0.04], 0.005);
      box(g, [0.24, 0.022, 0.17], m.white, [-0.19, 0.452, 0.045], 0.004);
      const vase = cylinder(
        g,
        0.045,
        0.07,
        0.19,
        m.cream,
        [0.36, 0.505, -0.08],
      );
      vase.rotation.z = -0.04;
      stem(
        g,
        new T.Vector3(0.36, 0.56, -0.08),
        new T.Vector3(0.39, 0.83, -0.09),
        0.005,
        m.leaf,
      );
      const leaf = solid(
        g,
        new T.SphereGeometry(1, 12, 8),
        m.leaf,
        [0.4, 0.75, -0.09],
      );
      leaf.scale.set(0.06, 0.1, 0.02);
      break;
    }
    case "desk": {
      legs(g, m, 1.6, 0.55, 0.76);
      box(g, [1.8, 0.09, 0.75], m.wood, [0, 0.805, 0], 0.035);
      box(g, [0.55, 0.26, 0.6], m.cream, [0.53, 0.62, 0]);
      box(g, [0.13, 0.02, 0.02], m.brass, [0.54, 0.65, 0.32], 0.005);
      box(g, [0.57, 0.035, 0.39], m.metal, [-0.2, 0.87, 0.07], 0.008);
      const monitor = box(
        g,
        [0.58, 0.39, 0.025],
        m.metal,
        [-0.2, 1.065, -0.11],
        0.01,
      );
      monitor.rotation.x = -0.16;
      const display = box(
        g,
        [0.53, 0.34, 0.01],
        m.screen,
        [-0.2, 1.065, -0.087],
        0.005,
      );
      display.rotation.x = -0.16;
      cylinder(g, 0.064, 0.055, 0.12, m.cream, [0.57, 0.91, 0.18]);
      break;
    }
    case "chair": {
      legs(g, m, 0.46, 0.46, 0.45);
      box(g, [0.65, 0.12, 0.65], m.pillow, [0, 0.48, 0], 0.08);
      box(g, [0.63, 0.48, 0.14], m.pillow, [0, 0.79, -0.27], 0.08);
      break;
    }
    case "shelf": {
      box(g, [1.12, 1.95, 0.06], m.wood, [0, 1, -0.17]);
      for (const x of [-0.53, 0.53])
        box(g, [0.07, 1.98, 0.4], m.wood, [x, 1, 0], 0.012);
      for (const y of [0.07, 0.53, 1, 1.48, 1.97])
        box(g, [1.1, 0.055, 0.4], m.wood, [0, y, 0], 0.012);
      for (let row = 0; row < 3; row++)
        for (let i = 0; i < 6 - row; i++) {
          const book = box(
            g,
            [0.09, 0.25 + (i % 3) * 0.045, 0.21],
            [m.accent, m.pillow, m.cream, m.walnut][(row + i) % 4],
            [-0.39 + i * 0.13, 0.22 + row * 0.48, 0.015],
            0.004,
          );
          book.rotation.z = i === 5 ? 0.15 : 0;
        }
      cylinder(g, 0.08, 0.12, 0.23, m.cream, [0.22, 1.61, 0]);
      break;
    }
    case "plant": {
      cylinder(g, 0.23, 0.17, 0.48, m.cream, [0, 0.25, 0]);
      cylinder(g, 0.215, 0.215, 0.025, m.soil, [0, 0.484, 0]);
      for (let i = 0; i < 12; i++) {
        const angle = i * 2.399,
          level = 0.65 + (i % 5) * 0.14;
        const end = new T.Vector3(
          Math.cos(angle) * (0.18 + (i % 3) * 0.04),
          level,
          Math.sin(angle) * (0.18 + (i % 3) * 0.04),
        );
        stem(g, new T.Vector3(0, 0.47, 0), end, 0.008, m.leaf);
        const leaf = solid(
          g,
          new T.SphereGeometry(1, 16, 10),
          i % 2 ? m.leaf : m.leafLight,
          end.toArray() as [number, number, number],
        );
        leaf.scale.set(0.105, 0.26, 0.035);
        leaf.rotation.set(
          Math.sin(angle) * 0.6,
          angle,
          Math.cos(angle) * -0.55,
        );
      }
      break;
    }
    case "frame":
    case "board": {
      const w = kind === "board" ? 1.12 : 0.92,
        h = kind === "board" ? 0.74 : 1.1,
        y = kind === "board" ? 1.34 : 1.3;
      for (const x of [-w * 0.35, w * 0.35]) {
        stem(
          g,
          new T.Vector3(x, 0.03, 0.24),
          new T.Vector3(x, y + 0.16, -0.03),
          0.021,
          kind === "board" ? m.metal : m.wood,
        );
        stem(
          g,
          new T.Vector3(x, 0.03, -0.25),
          new T.Vector3(x, y + 0.06, -0.03),
          0.018,
          m.wood,
        );
      }
      box(
        g,
        [w + 0.07, h + 0.07, 0.075],
        kind === "board" ? m.metal : m.wood,
        [0, y, 0],
        0.018,
      );
      box(g, [w, h, 0.01], m.white, [0, y, 0.044], 0.005);
      const image = solid(
        g,
        new T.PlaneGeometry(w - 0.07, h - 0.07),
        new T.MeshStandardMaterial({
          map: pictureTexture(kind === "board"),
          roughness: 0.82,
        }),
        [0, y, 0.052],
      );
      image.name = "picture";
      if (kind === "board") {
        box(g, [w, 0.025, 0.09], m.metal, [0, y - h / 2, 0.075], 0.005);
        box(
          g,
          [0.15, 0.025, 0.025],
          m.leaf,
          [0.32, y - h / 2 + 0.024, 0.07],
          0.005,
        );
      }
      break;
    }
    case "bed": {
      legs(g, m, 1.35, 1.9, 0.24);
      box(g, [1.65, 0.3, 2.25], m.wood, [0, 0.32, 0], 0.07);
      box(g, [1.6, 1.05, 0.12], m.wood, [0, 0.68, -1.03], 0.04);
      box(g, [1.57, 0.24, 2.1], m.white, [0, 0.55, 0], 0.09);
      box(g, [1.6, 0.13, 1.3], m.pillow, [0, 0.72, 0.4], 0.06);
      for (const x of [-0.4, 0.4])
        box(g, [0.65, 0.13, 0.4], m.white, [x, 0.76, -0.68], 0.08);
      break;
    }
  }
  return g;
}
export function shell(m: Materials) {
  const g = new T.Group();
  box(g, [9.1, 0.22, 7.5], m.walnut, [0, -0.16, 0], 0.06);
  for (let row = 0; row < 18; row++)
    for (let col = 0; col < 4; col++) {
      const plank = box(
        g,
        [2.23, 0.07, 0.402],
        m.wood,
        [-3.36 + col * 2.24, -0.025, -3.47 + row * 0.407],
        0.006,
      );
      plank.receiveShadow = true;
      plank.castShadow = false;
    }
  const back = new T.Group();
  g.add(back);
  box(back, [2.62, 2.85, 0.15], m.wall, [-3.185, 1.41, -3.7]);
  box(back, [2.82, 2.85, 0.15], m.wall, [3.085, 1.41, -3.7]);
  box(back, [3.56, 0.78, 0.15], m.wall, [-0.1, 0.38, -3.7]);
  box(back, [3.56, 0.49, 0.15], m.wall, [-0.1, 2.59, -3.7]);
  box(g, [0.15, 2.85, 7.4], m.wall, [-4.5, 1.41, 0]);
  for (const z of [-3.57]) {
    box(g, [9, 0.12, 0.07], m.cream, [0, 0.09, z]);
    box(g, [9, 0.04, 0.06], m.cream, [0, 0.92, z]);
  }
  box(g, [0.07, 0.12, 7.2], m.cream, [-4.39, 0.09, 0]);
  box(g, [0.06, 0.04, 7.2], m.cream, [-4.39, 0.92, 0]);
  const sky = new T.MeshBasicMaterial({ color: "#d4e0dc" });
  box(g, [3.55, 1.6, 0.05], sky, [-0.1, 1.59, -3.78]);
  for (const x of [-1.9, -0.1, 1.7])
    box(g, [0.06, 1.62, 0.13], m.cream, [x, 1.57, -3.6], 0.004);
  for (const y of [0.76, 1.57, 2.38])
    box(g, [3.68, 0.06, 0.13], m.cream, [-0.1, y, -3.6], 0.004);
  box(g, [3.95, 0.08, 0.32], m.cream, [-0.1, 0.73, -3.53], 0.015);
  for (const x of [-2.02, 1.82])
    for (let i = 0; i < 5; i++)
      cylinder(g, 0.055, 0.07, 2.5, m.cream, [x + (i - 2) * 0.085, 1.4, -3.43]);
  stem(
    g,
    new T.Vector3(-2.34, 2.69, -3.37),
    new T.Vector3(2.1, 2.69, -3.37),
    0.015,
    m.brass,
  );
  const rug = box(g, [3.9, 0.022, 2.75], m.rug, [-1.25, 0.025, -0.8], 0.05);
  rug.castShadow = false;
  for (let i = 0; i < 9; i++) {
    const stripe = box(
      g,
      [3.72, 0.002, 0.018],
      m.cream,
      [-1.25, 0.038, -2 + i * 0.29],
      0.001,
    );
    stripe.castShadow = false;
  }
  const lamp = new T.Group();
  g.add(lamp);
  cylinder(lamp, 0.23, 0.23, 0.035, m.brass, [0.54, 0.03, -1.75]);
  stem(
    lamp,
    new T.Vector3(0.54, 0, -1.75),
    new T.Vector3(0.54, 1.6, -1.75),
    0.018,
    m.brass,
  );
  cylinder(lamp, 0.2, 0.32, 0.35, m.cream, [0.54, 1.58, -1.75]);
  const glow = new T.PointLight("#ffdbab", 3, 3);
  glow.position.set(0.54, 1.42, -1.75);
  g.add(glow);
  return g;
}
