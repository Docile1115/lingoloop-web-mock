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
  assert.equal(draft.items.length,12);
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
