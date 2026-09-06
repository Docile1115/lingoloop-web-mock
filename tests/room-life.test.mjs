import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
const compile = text => ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const source = async path => compile(await readFile(new URL(path,import.meta.url),'utf8'));
const avatar=uri(await source('../app/lib/avatar.ts'));
const roomUri=uri((await source('../app/lib/room.ts')).replace(/(['"])\.\/avatar\1/,JSON.stringify(avatar)));
const room=await import(roomUri);
const life=await import(uri((await source('../app/lib/room-life.ts')).replace(/(['"])\.\/room\1/,JSON.stringify(roomUri))));
const config=items=>({...room.DEFAULT_ROOM,items:items.map(([id,x,y])=>({id,x,y,flipped:false}))});

test('walking takes a shortest free route and never crosses solid furniture',()=>{
  const value=config([['sofa',2,2],['rug',3,3]]),start={x:2,y:3},end={x:2,y:1};
  const path=life.roomPath(value,start,end);
  assert.equal(path.length,4);assert.deepEqual(path.at(-1),end);
  let previous=start;for(const cell of path){assert.ok(life.walkable(value,cell));assert.equal(Math.abs(cell.x-previous.x)+Math.abs(cell.y-previous.y),1);previous=cell;}
  assert.deepEqual(life.roomPath(value,start,{x:3,y:3}),[{x:3,y:3}]);
});
test('blocked and invalid destinations do not produce motion; same cell is an empty route',()=>{
  const value=config([['sofa',2,2],['desk',3,3],['bed',2,4],['shelf',1,3]]),start={x:2,y:3};
  for(const target of [{x:0,y:0},{x:2,y:2},{x:-1,y:0},{x:NaN,y:0},{x:1.5,y:3}])assert.equal(life.roomPath(value,start,target),null);
  assert.deepEqual(life.roomPath(value,start,start),[]);
});
test('furniture interaction stops beside the selected object, not inside it',()=>{
  const value=config([['frame2',4,0],['whiteboard',0,0]]),start={x:2,y:3};
  for(const item of value.items){const path=life.approachFurniture(value,start,item.id),end=path.at(-1)||start;assert.equal(Math.abs(end.x-item.x)+Math.abs(end.y-item.y),1);}
  assert.equal(life.approachFurniture(value,start,'bed'),null);
  assert.deepEqual(life.approachFurniture(config([['sofa',2,2]]),start,'sofa'),[]);
});
test('native hit testing selects the visible frame and leaves empty floor and rugs walkable',()=>{
  const value=config([['frame2',4,0],['rug',2,2]]),frame=room.roomPoint(4,0),rug=room.roomPoint(2,2);
  assert.equal(life.hitRoomItem(value,{x:frame.x,y:frame.y-70}),'frame2');
  assert.equal(life.hitRoomItem(value,rug),null);assert.equal(life.hitRoomItem(value,rug,true),'rug');
  assert.equal(life.hitRoomItem(value,{x:0,y:0}),null);
  const cat=room.roomPoint(0,0);assert.equal(life.hitRoomItem(config([['cat',0,0]]),{x:cat.x,y:cat.y-80}),null);
});
test('moving actor changes depth and position while invalid coordinates remain safe',()=>{
  const value=config([['sofa',2,2]]),render=actor=>room.renderRoomSvg(value,undefined,null,[],actor);
  const front=render({x:4,y:4}),back=render({x:0,y:0});
  assert.notEqual(front,back);assert.ok(front.indexOf('data-room-resident')>front.indexOf('data-room-item'));
  assert.ok(back.indexOf('data-room-resident')<back.indexOf('data-room-item'));
  assert.equal(render({x:NaN,y:Infinity}),render(room.RESIDENT));
  assert.doesNotMatch(render({x:0,y:0,pose:'<script>bad</script>',activeItem:'<img>'}),/<script>|<img>|NaN|Infinity/);
});
test('sitting and sleeping apply only to the corresponding furniture',()=>{
  const value=config([['sofa',0,0],['bed',4,0]]),render=actor=>room.renderRoomSvg(value,undefined,null,[],{x:2,y:3,...actor});
  assert.match(render({pose:'sit',activeItem:'sofa'}),/translate\(0 65\) scale\(1 .72\)/);
  assert.doesNotMatch(render({pose:'sit',activeItem:'bed'}),/translate\(0 65\)/);
  assert.match(render({pose:'sleep',activeItem:'bed'}),/rotate\(-65 96 240\)/);
});
