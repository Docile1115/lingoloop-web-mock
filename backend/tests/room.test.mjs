import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRoomConfig, roomFields, ROOM_ITEMS } from '../room.mjs';

const room = () => ({version:1,wall:'cream',floor:'oak',items:[{id:'sofa',x:0,y:0,flipped:false}]});
test('room saves empty rooms and every furniture type with bounded positions', () => {
  assert.deepEqual(validateRoomConfig({...room(),items:[]}).items,[]);
  for (const id of ROOM_ITEMS) {
    const value = {...room(),items:[{id,x:4,y:4,flipped:true}]};
    assert.deepEqual(validateRoomConfig(value),value);
  }
});
test('room rejects malformed configs, external assets and out-of-bounds positions', () => {
  for (const value of [null, [], {}, {...room(),version:2}, {...room(),wall:'url(javascript:alert(1))'},
    {...room(),floor:'https://evil.invalid/a.svg'}, {...room(),userId:'another-user'},
    {...room(),items:Array(13).fill(room().items[0])}]) assert.throws(() => validateRoomConfig(value));
  for (const patch of [{id:'<script/>'},{x:-1},{x:5},{y:NaN},{y:2.5},{x:'1'},{flipped:'false'},{svg:'<svg/>'}]) {
    assert.throws(() => validateRoomConfig({...room(),items:[{...room().items[0],...patch}]}));
  }
});
test('room protects resident space and prevents duplicate furniture and occupied cells', () => {
  assert.throws(() => validateRoomConfig({...room(),items:[{id:'sofa',x:2,y:3,flipped:false}]}));
  assert.throws(() => validateRoomConfig({...room(),items:[room().items[0],{id:'sofa',x:1,y:1,flipped:false}]}));
  assert.throws(() => validateRoomConfig({...room(),items:[room().items[0],{id:'bed',x:0,y:0,flipped:false}]}));
});
test('legacy and corrupt profiles safely expose no saved room', () => {
  for (const profile of [null,{}, {roomConfig:null},{roomConfig:{version:42}}]) assert.deepEqual(roomFields(profile),{roomConfig:null});
  assert.deepEqual(roomFields({roomConfig:room()}),{roomConfig:room()});
});
