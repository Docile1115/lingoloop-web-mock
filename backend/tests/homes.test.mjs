import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import sharp from 'sharp';
import {registerHomeRoutes,canEnterHome,homeSettings,validateHomePatch,nextHomeQuota,sanitizeFrameImage,HOME_DEFAULTS} from '../homes.mjs';
import {buildNotification,notificationDocumentId} from '../notifications.mjs';

// Deterministic transactional Firestore double: refuses reads after writes, commits atomically.
// This tests real Express handlers, not a replacement implementation of home policy.
function database() {
  const rows=new Map();
  class Ref {
    constructor(path){this.path=path;this.id=path.split('/').at(-1);}
    collection(name){return new Query(this.path+'/'+name);}
    async get(){return snapshot(this);}
  }
  const snapshot=ref=>({ref,id:ref.id,exists:rows.has(ref.path),data:()=>structuredClone(rows.get(ref.path))});
  class Query {
    constructor(path,filters=[],order='__name__',direction='asc',cursor=null,count=Infinity){Object.assign(this,{path,filters,order,direction,cursor,count});}
    doc(id){assert.ok(id&&!id.includes('/'));return new Ref(this.path+'/'+id);}
    where(field,operator,value){assert.equal(operator,'==');return new Query(this.path,[...this.filters,[field,value]],this.order,this.direction,this.cursor,this.count);}
    orderBy(order,direction='asc'){return new Query(this.path,this.filters,order,direction,this.cursor,this.count);}
    limit(count){return new Query(this.path,this.filters,this.order,this.direction,this.cursor,count);}
    startAfter(cursor){return new Query(this.path,this.filters,this.order,this.direction,cursor,this.count);}
    async get(){
      let docs=[...rows.keys()].filter(path=>path.startsWith(this.path+'/')&&!path.slice(this.path.length+1).includes('/')).map(path=>snapshot(new Ref(path))).filter(doc=>this.filters.every(([key,value])=>doc.data()[key]===value));
      const key=doc=>this.order==='__name__'?doc.id:doc.data()[this.order];
      docs.sort((a,b)=>(String(key(a)).localeCompare(String(key(b)))||a.id.localeCompare(b.id))*(this.direction==='desc'?-1:1));
      if(this.cursor){if(typeof this.cursor==='string')docs=docs.filter(doc=>key(doc)>this.cursor);else {const position=docs.findIndex(doc=>doc.id===this.cursor.id);docs=docs.slice(position+1);}}
      docs=docs.slice(0,this.count);return {docs,size:docs.length,empty:!docs.length};
    }
  }
  let queue=Promise.resolve();
  return {rows,collection:name=>new Query(name),runTransaction(task){
    const execute=async()=>{const writes=[];const read=async ref=>{assert.equal(writes.length,0,'Firestore does not allow transaction reads after writes');return ref instanceof Ref?snapshot(ref):ref.get();};
      const tx={get:read,getAll:(...refs)=>Promise.all(refs.map(read)),set:(ref,value,options)=>writes.push(()=>rows.set(ref.path,options?.merge?{...rows.get(ref.path),...structuredClone(value)}:structuredClone(value))),create:(ref,value)=>{assert.equal(rows.has(ref.path),false);tx.set(ref,value);},update:(ref,value)=>{assert.equal(rows.has(ref.path),true);tx.set(ref,value,{merge:true});},delete:ref=>writes.push(()=>rows.delete(ref.path))};
      const result=await task(tx);writes.forEach(write=>write());return result;};
    const result=queue.then(execute);queue=result.catch(()=>{});return result;
  }};
}
async function fixture(t) {
  const db=database();
  for(const id of ['owner','friend','stranger','other'])db.rows.set('profiles/'+id,{id,name:id,accountStatus:'active',roomConfig:{version:1,wall:'cream',floor:'oak',items:[{id:'whiteboard',x:0,y:0,flipped:false}]}});
  db.rows.set('follows/friend_owner',{fromUserId:'friend',toUserId:'owner'});
  const app=express();app.use(express.json({limit:'1mb'}));
  class ApiError extends Error {constructor(status,code,message){super(message);this.status=status;this.code=code;}}
  registerHomeRoutes(app,{db,requireUser:(req,res,next)=>{const id=req.get('test-user');if(!id)return res.sendStatus(401);req.auth={uid:id};next();},success:(res,req,data)=>res.json({data}),ApiError,
    assertNotBlockedInTransaction:async(tx,viewer,ids)=>{for(const id of ids){if(id===viewer)continue;const blocks=await tx.getAll(db.collection('blocks').doc(viewer+'_'+id),db.collection('blocks').doc(id+'_'+viewer));if(blocks.some(row=>row.exists))throw new ApiError(403,'PARTNER_BLOCKED','blocked');}},
    profileForOthers:profile=>{const result={...profile};delete result.roomConfig;return result;},
    putNotification:(tx,event)=>{const row=buildNotification(event);if(row)tx.set(db.collection('notifications').doc(row.id),row);},removeNotification:(tx,event)=>tx.delete(db.collection('notifications').doc(notificationDocumentId(event))),
    nowIso:()=>new Date().toISOString(),todayInSeoul:()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10),
  });
  app.use((error,req,res,next)=>{void next;res.status(error.status||500).json({error:{message:error.message}});});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const call=async(path='',method='GET',body,user='friend')=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/homes${path}`,{method,headers:{'content-type':'application/json',...(user?{'test-user':user}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,...await response.json().catch(()=>({}))};};
  return {db,call,resetQuota:id=>db.rows.delete('homeQuotas/'+id)};
}
const entry=(text='hello',requestId='request-1234567890')=>({text,kind:'guestbook',requestId});

test('3D home persistence is owner-only, revision-checked and preserves legacy data',async t=>{
  const {db,call}=await fixture(t),config={version:1,items:[{id:'whiteboard',kind:'board',x:-3,z:0,rotation:0}]};
  const legacy=structuredClone(db.rows.get('profiles/owner').roomConfig);
  assert.equal((await call('/owner/room3d','PUT',{config,revision:0},'friend')).status,403);
  assert.equal((await call('/owner/room3d','PUT',{config,revision:0},null)).status,401);
  assert.equal((await call('/owner/room3d','PUT',{config,revision:0},'owner')).status,200);
  assert.deepEqual(db.rows.get('profiles/owner').roomConfig,legacy);
  const read=await call('/owner');assert.deepEqual(read.data.room3d,config);assert.equal(read.data.room3dRevision,1);
  assert.equal((await call('/owner/room3d','PUT',{config:{version:1,items:[]},revision:0},'owner')).status,409);
  assert.deepEqual((await call('/owner')).data.room3d,config);
  assert.equal((await call('/owner/entries','POST',entry())).status,200);
  assert.equal((await call('/owner/room3d','PUT',{config:{version:1,items:[]},revision:1},'owner')).status,200);
  assert.equal((await call('/owner/entries','POST',entry('blocked','request-0987654321'))).status,422);
  await call('/owner/settings','PATCH',{visibility:'private'},'owner');
  assert.equal((await call('/owner')).status,403);
});

test('without a saved 3D layout the starter room takes guestbook notes even if the old 2D room had no whiteboard',async t=>{
  const {db,call}=await fixture(t);
  db.rows.get('profiles/owner').roomConfig.items=[];
  assert.equal((await call('/owner/entries','POST',entry())).status,200);
});

test('home policy is deny-by-default for unknown scopes and always honors blocks',()=>{
  for(const scope of ['everyone','followers','mutuals','private','invalid'])assert.equal(canEnterHome(scope,{own:true,blocked:true}),false);
  assert.equal(canEnterHome('private',{own:true}),true);assert.equal(canEnterHome('private',{follows:true,followedBy:true}),false);
  assert.equal(canEnterHome('followers',{followedBy:true}),false);assert.equal(canEnterHome('followers',{follows:true}),true);
  assert.equal(canEnterHome('mutuals',{follows:true}),false);assert.equal(canEnterHome('mutuals',{follows:true,followedBy:true}),true);
  assert.equal(canEnterHome('invalid'),false);assert.deepEqual(homeSettings(null),HOME_DEFAULTS);
});
test('settings and quotas reject unsupported, oversized and spam writes',()=>{
  for(const value of [null,[],{admin:true},{visibility:'all'},{showVisitors:1},{question:'a'.repeat(201)},{pinnedId:'a'.repeat(129)}])assert.throws(()=>validateHomePatch(value));
  assert.deepEqual(validateHomePatch({question:' hi ',visibility:'private'}),{question:'hi',visibility:'private'});
  const now=Date.now(),day='2026-09-06';assert.equal(nextHomeQuota(null,now,day).count,1);
  assert.throws(()=>nextHomeQuota({day,count:20},now,day),{status:429});assert.throws(()=>nextHomeQuota({lastAt:new Date(now-1000).toISOString()},now,day),{status:429});
  assert.equal(nextHomeQuota({day:'yesterday',count:20,lastAt:new Date(now-16000).toISOString()},now,day).count,1);
});
test('photo upload reencodes raster images, strips metadata and constrains pixels',async()=>{
  const buffer=await sharp({create:{width:1200,height:800,channels:3,background:'#f00'}}).withMetadata({exif:{IFD0:{Artist:'private location'}}}).jpeg().toBuffer();
  const encoded=await sanitizeFrameImage('data:image/jpeg;base64,'+buffer.toString('base64'));const meta=await sharp(Buffer.from(encoded.split(',')[1],'base64')).metadata();
  assert.equal(meta.width,960);assert.equal(meta.exif,undefined);assert.equal(meta.format,'jpeg');
  for(const image of ['data:image/svg+xml;base64,PHN2Zz4=','https://example.com/image.jpg','data:image/jpeg;base64,YmFk','data:image/png;base64,'+'a'.repeat(520000)])await assert.rejects(sanitizeFrameImage(image));
  const mislabeled='data:image/png;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>').toString('base64');
  await assert.rejects(sanitizeFrameImage(mislabeled));
});
test('home routes require authentication and verify ownership and relationship in both directions',async t=>{
  const {db,call}=await fixture(t);assert.equal((await call('/owner','GET',undefined,null)).status,401);
  assert.equal((await call('/owner')).data.canWrite,true);assert.equal((await call('/owner','GET',undefined,'stranger')).data.canWrite,false);
  assert.equal((await call('/owner/settings','PATCH',{visibility:'private'})).status,403);
  assert.equal((await call('/owner/settings','PATCH',{visibility:'private'},'owner')).status,200);
  assert.equal((await call('/owner')).status,403);assert.equal((await call('/owner','GET',undefined,'owner')).status,200);
  db.rows.set('homes/owner',{visibility:'mutuals'});assert.equal((await call('/owner')).status,403);
  db.rows.set('follows/owner_friend',{fromUserId:'owner',toUserId:'friend'});assert.equal((await call('/owner')).status,200);
  for(const direction of ['owner_friend','friend_owner']){db.rows.set('blocks/'+direction,{});assert.equal((await call('/owner')).status,403);assert.equal((await call('/owner/entries','POST',entry())).status,403);db.rows.delete('blocks/'+direction);}
});
test('guestbook writes are idempotent, quota-limited, owner replies notify and hearts do not double-count',async t=>{
  const {db,call,resetQuota}=await fixture(t);
  assert.equal((await call('/owner/entries','POST',entry(),'stranger')).status,403);
  const first=await call('/owner/entries','POST',entry());assert.equal(first.status,200);const id=first.data.id;
  assert.equal((await call('/owner/entries','POST',entry())).data.id,id);assert.equal(db.rows.get('homeQuotas/friend').count,1);
  assert.equal((await call('/owner/entries','POST',entry('another','request-0987654321'))).status,429);
  assert.equal((await call('/owner/entries/'+id,'PATCH',{reply:'hey'})).status,403);
  assert.equal((await call('/owner/entries/'+id,'PATCH',{reply:'welcome'},'owner')).status,200);
  assert.ok([...db.rows.values()].some(row=>row.type==='home_reply'&&row.homeOwnerId==='owner'&&row.recipientId==='friend'));
  assert.equal((await call('/owner/reports','POST',{kind:'reply',id,reason:'review reply'})).status,200);
  assert.ok([...db.rows.values()].some(row=>row.targetType==='home_reply'&&row.targetId==='owner'),'reply reports target the owner, never the guestbook author');
  for(let i=0;i<2;i++)assert.equal((await call('/owner/entries/'+id,'PATCH',{hearted:true},'stranger')).status,200);
  assert.equal(db.rows.get('homes/owner/entries/'+id).heartCount,1);
  assert.ok([...db.rows.values()].some(row=>row.type==='home_heart'));
  await call('/owner/entries/'+id,'PATCH',{hearted:false},'stranger');assert.equal(db.rows.get('homes/owner/entries/'+id).heartCount,0);
  assert.equal([...db.rows.values()].filter(row=>row.type==='home_heart').length,0);
  resetQuota('friend');db.rows.set('homes/owner',{...(db.rows.get('homes/owner')||{}),room3d:{version:1,items:[]},room3dRevision:1});
  assert.equal((await call('/owner/entries','POST',entry('missing board','request-missingboard'))).status,422);
});
test('answers retain original questions; authors can delete after a block or private switch',async t=>{
  const {db,call}=await fixture(t);await call('/owner/settings','PATCH',{question:'Where are you from?'},'owner');
  const created=await call('/owner/entries','POST',{...entry(),kind:'answer'});assert.equal(created.status,200);const id=created.data.id;
  await call('/owner/settings','PATCH',{question:'Favorite food?',pinnedId:id},'owner');assert.equal((await call('/owner')).data.entries[0].question,'Where are you from?');
  db.rows.set('blocks/owner_friend',{});assert.equal((await call('/owner','GET',undefined,'owner')).data.entries.length,0);
  db.rows.set('homes/owner',{visibility:'private',pinnedId:id});assert.equal((await call('/owner/entries/'+id,'DELETE',undefined,'stranger')).status,403);
  assert.equal((await call('/owner/entries/'+id,'DELETE')).status,200);assert.equal(db.rows.get('homes/owner/entries/'+id).text,'');assert.equal(db.rows.get('homes/owner').pinnedId,'');
});
test('daily greeting is idempotent, visitor names stay private, gifts can be displayed',async t=>{
  const {db,call}=await fixture(t);assert.equal((await call('/owner/stamp','POST',{gift:'flower',note:'have a nice day'})).status,200);
  assert.equal((await call('/owner/stamp','POST',{gift:'cookie',note:'again'})).data.already,true);
  assert.equal(db.rows.get('homes/owner/stamps/friend').gift,'flower');assert.equal((await call('/owner')).data.stampedToday,true);
  assert.equal((await call('/owner')).data.visitors.length,0);assert.equal((await call('/owner','GET',undefined,'owner')).data.visitors.length,1);
  assert.equal((await call('/owner/reports','POST',{kind:'stamp',id:'friend',reason:'hidden'},'stranger')).status,404);
  await call('/owner/settings','PATCH',{displayedGiftId:'friend'},'owner');assert.equal((await call('/owner')).data.displayedGift.gift,'flower');
  assert.equal((await call('/owner/stamp','POST',{gift:'flower'},'owner')).status,422);
});
test('photo scopes protect image content and report evidence, owner-only changes and three slots',async t=>{
  const {db,call}=await fixture(t);const image='data:image/jpeg;base64,'+(await sharp({create:{width:10,height:10,channels:3,background:'#fff'}}).jpeg().toBuffer()).toString('base64');
  const photo={image,caption:'memory',visibility:'private',shape:'portrait',color:'oak'};
  assert.equal((await call('/owner/photos/frame','PUT',photo)).status,403);
  assert.equal((await call('/owner/photos/frame','PUT',photo,'owner')).status,200);assert.equal((await call('/owner')).data.photos.length,0);assert.equal((await call('/owner','GET',undefined,'owner')).data.photos.length,1);
  assert.equal((await call('/owner/photos/frame4','PUT',photo,'owner')).status,422);
  assert.equal((await call('/owner/reports','POST',{kind:'photo',id:'frame',reason:'guess'})).status,404);
  await call('/owner/photos/frame','PUT',{...photo,visibility:'followers'},'owner');assert.equal((await call('/owner')).data.photos.length,1);assert.equal((await call('/owner','GET',undefined,'stranger')).data.photos.length,0);
  assert.equal((await call('/owner/reports','POST',{kind:'photo',id:'frame',reason:'review'})).status,200);
  assert.equal(db.rows.get('profiles/friend').accountStatus,'active');assert.equal(db.rows.get('profiles/owner').accountStatus,'active');
  assert.equal((await call('/owner/photos/frame','DELETE',undefined,'owner')).status,200);assert.equal((await call('/owner','GET',undefined,'owner')).data.photos.length,0);
  db.rows.set('homes/owner',{uploadDay:new Date(Date.now()+9*3600000).toISOString().slice(0,10),uploadCount:60});
  assert.equal((await call('/owner/photos/frame','PUT',photo,'owner')).status,429);
});
test('directory excludes blocked/private houses and favorite writes are reversible',async t=>{
  const {db,call}=await fixture(t);assert.equal((await call('/directory')).data.items[0].owner.id,'owner');
  await call('/owner/favorite','PUT',{favorite:true});assert.equal((await call('/directory?kind=favorites')).data.items.length,1);
  db.rows.set('homes/owner',{visibility:'private'});assert.equal((await call('/directory')).data.items.length,0);assert.equal((await call('/directory?kind=favorites')).data.items.length,0);
  assert.equal((await call('/owner/favorite','PUT',{favorite:false})).status,200);assert.equal(db.rows.has('homeFavorites/friend/items/owner'),false);
});
