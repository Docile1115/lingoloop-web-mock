import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import * as backend from '../backend/room.mjs';

const compile = (source) => ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const avatarUri = uri(compile(await readFile(new URL('../app/lib/avatar.ts',import.meta.url),'utf8')));
const source = compile(await readFile(new URL('../app/lib/room.ts',import.meta.url),'utf8')).replace(/(['"])\.\/avatar\1/,JSON.stringify(avatarUri));
const room = await import(uri(source));

test('web and native room presets match the server contract', () => {
  assert.deepEqual(room.ROOM_ITEMS,backend.ROOM_ITEMS);
  assert.deepEqual(room.ROOM_WALLS,backend.ROOM_WALLS);
  assert.deepEqual(room.ROOM_FLOORS,backend.ROOM_FLOORS);
  for (const preset of room.ROOM_PRESETS) assert.deepEqual(backend.validateRoomConfig(preset),preset);
});
test('editing adds, moves, flips and removes furniture without mutating saved layouts', () => {
  const initial = room.copyRoom(room.DEFAULT_ROOM);
  let draft = {...initial,items:[]};
  for (const id of room.ROOM_ITEMS) {
    draft = room.addRoomItem(draft,id);
    assert.deepEqual(backend.validateRoomConfig(draft),draft);
  }
  assert.equal(draft.items.length,16);
  assert.equal(room.addRoomItem(draft,'sofa'),draft);
  assert.equal(room.moveRoomItem(draft,'sofa',2,3),draft);
  assert.equal(room.moveRoomItem(draft,'sofa',-1,0),draft);
  const moved = room.moveRoomItem(draft,'sofa',4,4);
  assert.equal(moved.items.find(i=>i.id==='sofa').x,4);
  assert.notDeepEqual(moved,draft);
  assert.deepEqual(initial,room.DEFAULT_ROOM);
  const flipped = {...moved,items:moved.items.map(i=>({...i,flipped:!i.flipped}))};
  assert.deepEqual(backend.validateRoomConfig(flipped),flipped);
  assert.deepEqual(backend.validateRoomConfig({...flipped,items:[]}).items,[]);
});
test('room renderer is deterministic and never interpolates untrusted markup', () => {
  const injection = '</svg><script>alert(1)</script><image href="https://evil.invalid"/>';
  const svg = room.renderRoomSvg({...room.DEFAULT_ROOM,wall:injection}, {hair:injection});
  assert.equal(svg,room.renderRoomSvg(room.DEFAULT_ROOM));
  assert.doesNotMatch(svg, /<script|<image|javascript:|evil\.invalid/);
  assert.equal(room.renderRoomSvg(room.DEFAULT_ROOM),room.renderRoomSvg(room.DEFAULT_ROOM));
});

test('drag projection round-trips all cells and rejects occupied, resident and outside drops', () => {
  for (let y=0;y<5;y++) for (let x=0;x<5;x++) {
    const point=room.roomPoint(x,y);
    assert.deepEqual(room.roomCell(point.x,point.y),{x,y});
    assert.deepEqual(room.roomCell(point.x+2,point.y-2),{x,y});
  }
  const draft=room.copyRoom(room.DEFAULT_ROOM);
  assert.equal(room.canPlaceRoomItem(draft,'sofa',0,2),true);
  assert.equal(room.canPlaceRoomItem(draft,'sofa',4,4),true);
  for (const [x,y] of [[0,0],[2,3],[5,2],[-1,2],[NaN,1],[1,Infinity]]) assert.equal(room.canPlaceRoomItem(draft,'sofa',x,y),false);
  // The same pointer delta at desktop and mobile scales reaches the same cell.
  for (const width of [320,390,540]) {
    const from=room.roomPoint(0,2);const to=room.roomPoint(4,4);
    const dx=(to.x-from.x)*width/600;const dy=(to.y-from.y)*width/600;
    assert.deepEqual(room.roomCell(from.x+dx*600/width,from.y+dy*600/width),{x:4,y:4});
  }
});

test('interactive SVG marks only curated furniture and never interpolates selection markup', () => {
  const svg=room.renderRoomSvg(room.DEFAULT_ROOM,undefined,'sofa');
  assert.equal((svg.match(/data-room-item=/g)||[]).length,6);
  assert.equal((svg.match(/fill-opacity=".3"/g)||[]).length,1);
  assert.doesNotMatch(room.renderRoomSvg(room.DEFAULT_ROOM,undefined,'" onload="alert(1)'),/onload|alert/);
});

test('photo furniture only embeds bounded JPEG data and curated colors, never remote or SVG content', () => {
  const config=room.addRoomItem(room.DEFAULT_ROOM,'frame');
  const photo={id:'frame',image:'data:image/jpeg;base64,YWJj',shape:'portrait',color:'rose'};
  const svg=room.renderRoomSvg(config,undefined,null,[photo]);
  assert.match(svg,/<image href="data:image\/jpeg;base64,YWJj"/);
  assert.match(svg,/#cc91a4/);
  for(const image of ['https://evil.invalid/pixel','data:image/svg+xml;base64,PHN2Zz4=','" onload="alert(1)','data:image/jpeg;base64,'+'a'.repeat(410000)])assert.equal(room.roomPhotoShape({...photo,image}),'');
  assert.doesNotMatch(room.roomPhotoShape({...photo,color:'__proto__',shape:'" onload="bad'}),/Object|onload|bad/);
});

test('web home is 3D only and keeps pointer cancellation and keyboard access', async () => {
  const scene=await readFile(new URL('../app/lib/room3d/scene.ts',import.meta.url),'utf8');
  const room=await readFile(new URL('../app/components/Room3DHome.tsx',import.meta.url),'utf8');
  const home=await readFile(new URL('../app/components/SocialHome.tsx',import.meta.url),'utf8');
  assert.match(scene,/setPointerCapture/);
  assert.match(scene,/pointercancel/);
  assert.match(room,/가구 바로 선택/);
  assert.doesNotMatch(home,/RoomPlayground|기존 2D 방/);
});
