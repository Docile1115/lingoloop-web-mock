import { renderAvatarSvg } from './avatar';

export const ROOM_WALLS = ['cream', 'sage', 'rose', 'sky', 'night'] as const;
export const ROOM_FLOORS = ['oak', 'walnut', 'ivory', 'slate'] as const;
export const ROOM_ITEMS = ['sofa', 'desk', 'bed', 'shelf', 'plant', 'lamp', 'rug', 'table', 'cat', 'speaker', 'cushion', 'flowers'] as const;
export type RoomItemId = typeof ROOM_ITEMS[number];
export type RoomItem = { id: RoomItemId; x: number; y: number; flipped: boolean };
export type RoomConfig = { version: 1; wall: typeof ROOM_WALLS[number]; floor: typeof ROOM_FLOORS[number]; items: RoomItem[] };
export const ROOM_LIMIT = 12;
export const RESIDENT = { x: 2, y: 3 };
const piece = (id: RoomItemId, x: number, y: number): RoomItem => ({ id, x, y, flipped: false });
export const ROOM_PRESETS: RoomConfig[] = [
  { version: 1, wall: 'cream', floor: 'oak', items: [piece('sofa', 0, 2), piece('shelf', 0, 0), piece('plant', 4, 0), piece('rug', 2, 2), piece('table', 1, 2), piece('lamp', 3, 1)] },
  { version: 1, wall: 'sage', floor: 'ivory', items: [piece('desk', 0, 1), piece('shelf', 0, 0), piece('plant', 4, 0), piece('rug', 2, 2), piece('flowers', 3, 1), piece('cat', 4, 3)] },
  { version: 1, wall: 'night', floor: 'walnut', items: [piece('bed', 0, 1), piece('lamp', 0, 0), piece('speaker', 4, 0), piece('rug', 2, 2), piece('cushion', 3, 3), piece('cat', 4, 4)] },
];
export const DEFAULT_ROOM = ROOM_PRESETS[0];
export function copyRoom(value: RoomConfig): RoomConfig {
  return { ...value, items: value.items.map((item) => ({ ...item })) };
}
export function normalizeRoom(value: unknown): RoomConfig {
  if (!value || typeof value !== 'object') return copyRoom(DEFAULT_ROOM);
  const room = value as RoomConfig;
  if (room.version !== 1 || !ROOM_WALLS.includes(room.wall) || !ROOM_FLOORS.includes(room.floor)
      || !Array.isArray(room.items) || room.items.length > ROOM_LIMIT) return copyRoom(DEFAULT_ROOM);
  const ids = new Set<string>();
  const cells = new Set<string>();
  for (const item of room.items) {
    if (!item || !ROOM_ITEMS.includes(item.id) || ids.has(item.id) || typeof item.flipped !== 'boolean'
      || !Number.isInteger(item.x) || !Number.isInteger(item.y) || item.x < 0 || item.x > 4 || item.y < 0 || item.y > 4
      || (item.x === RESIDENT.x && item.y === RESIDENT.y) || cells.has(`${item.x},${item.y}`)) return copyRoom(DEFAULT_ROOM);
    ids.add(item.id); cells.add(`${item.x},${item.y}`);
  }
  return { version: 1, wall: room.wall, floor: room.floor, items: room.items.map(({id,x,y,flipped}) => ({id,x,y,flipped})) };
}
export function cellFree(room: RoomConfig, x: number, y: number, selected?: RoomItemId) {
  return !(x === RESIDENT.x && y === RESIDENT.y) && !room.items.some((item) => item.id !== selected && item.x === x && item.y === y);
}
export function addRoomItem(room: RoomConfig, id: RoomItemId): RoomConfig {
  if (room.items.length >= ROOM_LIMIT || room.items.some((item) => item.id === id)) return room;
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    if (cellFree(room, x, y)) return { ...room, items: [...room.items, piece(id, x, y)] };
  }
  return room;
}
export function moveRoomItem(room: RoomConfig, id: RoomItemId, x: number, y: number): RoomConfig {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > 4 || y < 0 || y > 4 || !cellFree(room, x, y, id)) return room;
  return { ...room, items: room.items.map((item) => item.id === id ? { ...item, x, y } : item) };
}
export function roomPoint(x: number, y: number) { return { x: 300 + (x - y) * 46, y: 204 + (x + y) * 23 }; }
/** Inverse of the isometric projection; deliberately not clamped so outside drops are rejected. */
export function roomCell(px: number, py: number) {
  return { x: Math.round(((px - 300) / 46 + (py - 204) / 23) / 2) + 0, y: Math.round(((py - 204) / 23 - (px - 300) / 46) / 2) + 0 };
}
export function canPlaceRoomItem(room: RoomConfig, id: RoomItemId, x: number, y: number) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x <= 4 && y >= 0 && y <= 4 && cellFree(room, x, y, id);
}
export const WALL_COLOURS = { cream: '#f3e8d8', sage: '#cadbd1', rose: '#ebcfd2', sky: '#ccdfeb', night: '#555d7c' };
export const FLOOR_COLOURS = { oak: '#d4aa7f', walnut: '#956b53', ivory: '#e9dfcc', slate: '#8d9caa' };

// Original vector furniture: no uploaded SVG, external references or user markup.
const SHAPES: Record<RoomItemId, string> = {
  sofa: '<ellipse cy="3" rx="59" ry="20" fill="#000" opacity=".1"/><path d="M-52-12v-55q0-12 12-12h75q12 0 12 12v49" fill="#78998a"/><path d="M-52-18l20-15 77 5 13 14-24 23-86-10Z" fill="#aac4ad"/><path d="M-53-18v21l86 14 25-26v-17L33-3Z" fill="#577c6b"/><rect x="-58" y="-42" width="16" height="40" rx="7" fill="#8dab98"/><rect x="40" y="-40" width="17" height="37" rx="7" fill="#8dab98"/><path d="M-25-51l22 2-3 24-23-3Z" fill="#f0d1ab"/><path d="M8-50l23 1-1 26-25-3Z" fill="#dfe7cf"/>',
  desk: '<path d="M-40-5v-48m73 48v-48" stroke="#815f47" stroke-width="7"/><path d="M-50-53l20-13 79 13-21 18Z" fill="#ead2ad"/><path d="M-50-53v8l78 17v-7Z" fill="#bb956e"/><path d="M-13-57v-35l42 4v35Z" fill="#677d77"/><path d="M-8-63v-23l31 3v25Z" fill="#c9e4dd"/><path d="M-17-49l33 6 12-7-33-6Z" fill="#e9ede7"/><rect x="-39" y="-68" width="12" height="17" rx="3" fill="#d69d79"/>',
  bed: '<path d="M-45-24v-60q0-8 8-8h59q8 0 8 8v27" fill="#b88468"/><path d="M-45-46l70 10 28 34-28 20-74-17Z" fill="#cda986"/><path d="M-43-50l68 9 25 33-24 14-72-13Z" fill="#faf0df"/><path d="M-36-47l48 5 10 12-47-5Z" fill="#fffaf0"/><path d="M-40-23l67 10 23 5-24 14-72-13Z" fill="#c29eae"/><path d="M-42-16l63 12" stroke="#edd1d8" stroke-width="3"/>',
  shelf: '<path d="M-32-4v-107l60 8v105Z" fill="#a57a58"/><path d="M-25-12v-90l45 6v91Z" fill="#765942"/><path d="M-28-67l51 6m-51 26 51 6" stroke="#d0ac80" stroke-width="7"/><path d="M-20-75v-24m11 26v-23m12 25v-19m10 20v-24" stroke="#d1b482" stroke-width="8"/><path d="M-18-42v-18m12 20v-17m12 19v-17" stroke="#92aca0" stroke-width="8"/><rect x="-18" y="-26" width="31" height="16" rx="2" fill="#d6c7b3"/>',
  plant: '<ellipse cy="3" rx="23" ry="9" fill="#000" opacity=".1"/><path d="M-20-32h40l-5 33q-15 8-30 0Z" fill="#d49670"/><ellipse cy="-32" rx="20" ry="7" fill="#ad704e"/><path d="M0-28v-54" stroke="#506d51" stroke-width="4"/><ellipse cx="-14" cy="-71" rx="13" ry="24" transform="rotate(-35 -14 -71)" fill="#789a6c"/><ellipse cx="13" cy="-64" rx="13" ry="23" transform="rotate(35 13 -64)" fill="#a0b887"/><ellipse cy="-90" rx="11" ry="22" fill="#5c825d"/>',
  lamp: '<ellipse cy="0" rx="25" ry="8" fill="#9b8162"/><path d="M0-2v-88" stroke="#ad8a60" stroke-width="5"/><path d="M-19-111h38l14 33q-33 17-66 0Z" fill="#f4dfaa"/><ellipse cy="-79" rx="32" ry="9" fill="#ffeab7"/><circle cy="-76" r="8" fill="#fff5cf"/>',
  rug: '<ellipse cy="0" rx="62" ry="28" fill="#d9c7ad"/><ellipse cy="0" rx="51" ry="21" fill="none" stroke="#f5e6cd" stroke-width="3"/><path d="M-28 0h56m-42-7h28m-28 14h28" stroke="#b4997b" stroke-width="2"/>',
  table: '<path d="M-24 2v-24m46 26v-28" stroke="#997352" stroke-width="6"/><ellipse cy="-28" rx="42" ry="19" fill="#b18c69"/><ellipse cy="-34" rx="42" ry="18" fill="#e1c59e"/><path d="M-20-40l20 3v10l-20-3Z" fill="#6d9087"/><ellipse cx="14" cy="-34" rx="7" ry="4" fill="#fbf0dc"/><path d="M8-43h12v8q-6 6-12 0Z" fill="#fff6e5"/>',
  cat: '<ellipse cy="1" rx="24" ry="9" fill="#000" opacity=".1"/><ellipse cy="-13" rx="20" ry="15" fill="#d5a477"/><path d="M-13-22l-5-18 15 8 15-8 3 21Z" fill="#dfb68b"/><path d="M-10-22l5 2m9-1 5-2" stroke="#6b5040" stroke-width="2" stroke-linecap="round"/><path d="M17-4q27 2 14-18" fill="none" stroke="#c89566" stroke-width="9" stroke-linecap="round"/>',
  speaker: '<path d="M-20 0v-58l36 3v60Z" fill="#414b51"/><path d="M16-55l10-6v59L16 5Z" fill="#2e383e"/><circle cx="-2" cy="-15" r="12" fill="#82928e"/><circle cx="-2" cy="-15" r="6" fill="#3a4549"/><circle cx="-2" cy="-42" r="6" fill="#afbfad"/>',
  cushion: '<path d="M-29-8q2-22 27-21 26 2 31 24Q9 14-19 6Z" fill="#c18b76"/><path d="M-18-12q20-10 37 5" fill="none" stroke="#deb09b" stroke-width="3"/><circle cy="-9" r="3" fill="#956550"/>',
  flowers: '<ellipse cy="0" rx="17" ry="5" fill="#000" opacity=".1"/><path d="M-10-34h20l5 28q-15 12-30 0Z" fill="#bcc9d5"/><path d="M0-33v-25m0 20-13-16m13 18 14-14" stroke="#809776" stroke-width="3"/><g fill="#e6ad9b"><circle cy="-62" r="10"/><circle cx="-15" cy="-54" r="9"/><circle cx="15" cy="-51" r="10"/></g><g fill="#f5db9c"><circle cy="-62" r="4"/><circle cx="-15" cy="-54" r="3"/><circle cx="15" cy="-51" r="4"/></g>',
};
export function roomItemSvg(id: RoomItemId) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-70 -125 140 155">${SHAPES[id] || ''}</svg>`;
}
export function renderRoomSvg(value: unknown, avatar?: unknown, selected?: RoomItemId | null): string {
  const room = normalizeRoom(value);
  const wall = WALL_COLOURS[room.wall];
  const floor = FLOOR_COLOURS[room.floor];
  const lines = Array.from({ length: 9 }, (_, i) => {
    const d = (i + 1) * 25;
    return `<path d="M${300-d} ${180+d/2}l250 125M${300+d} ${180+d/2}l-250 125"/>`;
  }).join('');
  const objects = room.items.map((item) => {
    const p = roomPoint(item.x, item.y);
    return { depth: item.id === 'rug' ? -1 : item.x + item.y, svg: `<g data-room-item="${item.id}" transform="translate(${p.x} ${p.y}) scale(${item.flipped ? -1 : 1} 1)">${item.id === selected ? '<ellipse cy="4" rx="48" ry="23" fill="#5bdbaf" fill-opacity=".3" stroke="#157d57" stroke-width="3" pointer-events="none"/>' : ''}${SHAPES[item.id]}</g>` };
  });
  const resident = roomPoint(RESIDENT.x, RESIDENT.y);
  const figure = renderAvatarSvg(avatar)
    .replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
    .replace(/<rect width="128"[^>]*\/>/, '').replace(/<circle cx="104"[^>]*\/>/, '');
  objects.push({ depth: 5.1, svg: `<g transform="translate(${resident.x-32} ${resident.y-68})"><ellipse cx="32" cy="69" rx="29" ry="9" fill="#000" opacity=".12"/><ellipse cx="23" cy="67" rx="10" ry="5" fill="#4d5155"/><ellipse cx="42" cy="67" rx="10" ry="5" fill="#4d5155"/><g transform="scale(.5)">${figure}</g></g>` });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 460"><rect width="600" height="460" rx="24" fill="${room.wall === 'night' ? '#30384e' : '#f7f2e9'}"/><ellipse cx="300" cy="416" rx="218" ry="26" fill="#362d29" opacity=".08"/><path d="M50 125 300 15 550 125v180L300 430 50 305Z" fill="${wall}"/><path d="M300 15 550 125v180L300 180Z" fill="#000" opacity=".07"/><path d="M50 305 300 180 550 305 300 430Z" fill="${floor}"/><g stroke="#fff" opacity=".14" stroke-width="2">${lines}</g><path d="M50 305 300 430 550 305v10L300 440 50 315Z" fill="#5a4036" opacity=".22"/><path d="M300 15v165M50 300l250-125 250 125" fill="none" stroke="#fff" opacity=".35" stroke-width="5"/><g transform="translate(377 115) skewY(24)"><rect x="-30" y="-48" width="83" height="80" rx="5" fill="#fff3dc"/><rect x="-24" y="-42" width="71" height="68" rx="2" fill="${room.wall === 'night' ? '#858bb2' : '#c6deda'}"/><circle cx="26" cy="-23" r="10" fill="#fff0b4"/><path d="M-24 16l25-24 21 16 25-15v33h-71Z" fill="#9cb7a1"/><path d="M11-42v68m-35-34h71" stroke="#fff3dc" stroke-width="5"/></g><g transform="translate(175 128) skewY(-24)"><rect x="-28" y="-32" width="55" height="63" rx="3" fill="#c7a27c"/><rect x="-23" y="-27" width="45" height="53" fill="#f7e9d2"/><circle cx="0" cy="-8" r="12" fill="#d5a482"/><path d="M-17 21q0-26 17-18t17 18Z" fill="#8da597"/></g>${objects.sort((a,b) => a.depth-b.depth).map((o) => o.svg).join('')}</svg>`;
}
export const roomDataUri = (value: unknown, avatar?: unknown) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(renderRoomSvg(value, avatar))}`;
export const roomItemDataUri = (id: RoomItemId) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(roomItemSvg(id))}`;
