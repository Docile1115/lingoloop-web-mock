/** Only catalogue IDs and bounded grid coordinates cross the persistence boundary. */
export const ROOM_WALLS = ['cream', 'sage', 'rose', 'sky', 'night'];
export const ROOM_FLOORS = ['oak', 'walnut', 'ivory', 'slate'];
export const ROOM_ITEMS = ['sofa', 'desk', 'bed', 'shelf', 'plant', 'lamp', 'rug', 'table', 'cat', 'speaker', 'cushion', 'flowers'];
export const ROOM_LIMIT = 12;

export class RoomValidationError extends Error {}
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function exact(value, keys) {
  if (!plain(value) || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new RoomValidationError('방 설정 형식을 확인해 주세요.');
  }
}

export function validateRoomConfig(value) {
  exact(value, ['version', 'wall', 'floor', 'items']);
  if (value.version !== 1 || !ROOM_WALLS.includes(value.wall) || !ROOM_FLOORS.includes(value.floor)
      || !Array.isArray(value.items) || value.items.length > ROOM_LIMIT) {
    throw new RoomValidationError('지원하지 않는 방 설정입니다.');
  }
  const ids = new Set();
  const positions = new Set();
  const items = value.items.map((item) => {
    exact(item, ['id', 'x', 'y', 'flipped']);
    if (!ROOM_ITEMS.includes(item.id) || ids.has(item.id) || typeof item.flipped !== 'boolean'
        || !Number.isInteger(item.x) || !Number.isInteger(item.y)
        || item.x < 0 || item.x > 4 || item.y < 0 || item.y > 4) {
      throw new RoomValidationError('가구와 배치 위치를 확인해 주세요.');
    }
    const position = `${item.x},${item.y}`;
    if (positions.has(position) || position === '2,3') {
      throw new RoomValidationError('이미 사용 중인 위치입니다. 다른 칸을 골라 주세요.');
    }
    ids.add(item.id);
    positions.add(position);
    return { id: item.id, x: item.x, y: item.y, flipped: item.flipped };
  });
  return { version: 1, wall: value.wall, floor: value.floor, items };
}

export function roomFields(profile) {
  try { return { roomConfig: validateRoomConfig(profile?.roomConfig) }; }
  catch { return { roomConfig: null }; }
}
