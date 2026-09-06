/** Versioned 3D layout boundary. No URLs, artwork, account IDs or executable assets. */
export const ROOM3D_SIZES = {
  sofa: [2.65, 1.02],
  table: [1.3, 0.7],
  desk: [1.8, 0.75],
  chair: [0.68, 0.7],
  shelf: [1.12, 0.42],
  plant: [0.63, 0.63],
  frame: [0.92, 0.6],
  board: [1.12, 0.65],
  bed: [1.65, 2.25],
};
export class Room3DError extends Error {}
const exact = (value, keys) => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    throw new Room3DError("3D 방 설정 형식을 확인해 주세요.");
};
export function validateRoom3D(value) {
  exact(value, ["version", "items"]);
  if (value.version !== 1 || !Array.isArray(value.items) || value.items.length > 16)
    throw new Room3DError("가구는 16개까지 배치할 수 있어요.");
  const ids = new Set(),
    boxes = [{ id: "fixed-lamp", x: 0.54, z: -1.75, hx: 0.23, hz: 0.23 }];
  const items = value.items.map((item) => {
    exact(item, ["id", "kind", "x", "z", "rotation"]);
    if (
      typeof item.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,64}$/.test(item.id) ||
      ids.has(item.id) ||
      item.id === "fixed-lamp" ||
      !Object.hasOwn(ROOM3D_SIZES, item.kind) ||
      ![item.x, item.z, item.rotation].every(Number.isFinite) ||
      Math.abs(item.rotation) > 10000
    )
      throw new Room3DError("가구 설정을 확인해 주세요.");
    if (
      (item.kind === "frame") !== ["frame", "frame2", "frame3"].includes(item.id) ||
      (item.kind === "board") !== (item.id === "whiteboard")
    )
      throw new Room3DError("액자와 화이트보드 식별자를 확인해 주세요.");
    ids.add(item.id);
    const rotation = ((item.rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI),
      [w, d] = ROOM3D_SIZES[item.kind],
      c = Math.abs(Math.cos(rotation)),
      s = Math.abs(Math.sin(rotation));
    const box = { id: item.id, x: item.x, z: item.z, hx: (w * c + d * s) / 2, hz: (w * s + d * c) / 2 };
    if (
      box.x - box.hx < -4.35 ||
      box.x + box.hx > 4.35 ||
      box.z - box.hz < -3.35 ||
      box.z + box.hz > 3.35 ||
      (Math.abs(box.x) < box.hx + 0.25 && Math.abs(box.z - 2.2) < box.hz + 0.25) ||
      boxes.some(
        (other) =>
          Math.abs(box.x - other.x) < box.hx + other.hx + 0.049 &&
          Math.abs(box.z - other.z) < box.hz + other.hz + 0.049,
      )
    )
      throw new Room3DError("가구가 겹치거나 입구를 막고 있어요.");
    boxes.push(box);
    return { id: item.id, kind: item.kind, x: item.x, z: item.z, rotation };
  });
  return { version: 1, items };
}
export function readRoom3D(value) {
  try {
    return validateRoom3D(value);
  } catch {
    return null;
  }
}
