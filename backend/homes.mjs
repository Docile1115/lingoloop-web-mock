import crypto from 'node:crypto';
import sharp from 'sharp';
import { roomFields } from './room.mjs';
import { readRoom3D, validateRoom3D, Room3DError } from './room3d.mjs';

export const HOME_SCOPES = ['everyone', 'followers', 'mutuals', 'private'];
export const HOME_STATUSES = ['available', 'studying', 'voice', 'resting'];
export const HOME_GIFTS = ['wave', 'flower', 'postcard', 'cookie'];
export const HOME_FRAMES = ['frame', 'frame2', 'frame3'];
export const HOME_DEFAULTS = Object.freeze({visibility:'everyone', writing:'followers', showVisitors:false, status:'available', question:'', pinnedId:'', displayedGiftId:''});
export class HomeError extends Error {
  constructor(message, status=422) { super(message); this.status=status; }
}
const text = (value, max, required=false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new HomeError('입력 내용을 확인해 주세요.');
  return value.trim();
};
const exact = (value, keys) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key=>!keys.includes(key))) throw new HomeError('지원하지 않는 요청입니다.');
};
export function homeSettings(value) {
  const result = {...HOME_DEFAULTS};
  for (const key of ['visibility','writing']) if (HOME_SCOPES.includes(value?.[key])) result[key]=value[key];
  if (HOME_STATUSES.includes(value?.status)) result.status=value.status;
  if (typeof value?.showVisitors==='boolean') result.showVisitors=value.showVisitors;
  for (const [key,max] of [['question',200],['pinnedId',100],['displayedGiftId',128]]) if (typeof value?.[key]==='string') result[key]=value[key].slice(0,max);
  return result;
}
export function validateHomePatch(value) {
  exact(value,Object.keys(HOME_DEFAULTS));
  const patch={};
  for (const [key,item] of Object.entries(value)) {
    if (['visibility','writing'].includes(key) && !HOME_SCOPES.includes(item)) throw new HomeError('공개 범위를 확인해 주세요.');
    if (key==='status' && !HOME_STATUSES.includes(item)) throw new HomeError('집주인 상태를 확인해 주세요.');
    if (key==='showVisitors' && typeof item!=='boolean') throw new HomeError('방문 기록 설정을 확인해 주세요.');
    patch[key]=['question','pinnedId','displayedGiftId'].includes(key) ? text(item,key==='question'?200:128) : item;
  }
  return patch;
}
export function canEnterHome(scope, {own=false,follows=false,followedBy=false,blocked=false}={}) {
  if (blocked) return false;
  return own || scope==='everyone' || (scope==='followers' && follows) || (scope==='mutuals' && follows && followedBy);
}
export function nextHomeQuota(current, now, day) {
  const count=current?.day===day ? Number(current.count)||0 : 0;
  if (count>=20 || (current?.lastAt && now-Date.parse(current.lastAt)<15000)) throw new HomeError('잠시 쉬었다가 남겨주세요. 하루에 20개까지 작성할 수 있어요.',429);
  return {day,count:count+1,lastAt:new Date(now).toISOString()};
}
export async function sanitizeFrameImage(value) {
  if (typeof value!=='string' || value.length>520000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new HomeError('JPG, PNG, WebP 사진을 골라주세요.');
  try {
    const input=Buffer.from(value.split(',')[1],'base64');
    const decoder=sharp(input,{limitInputPixels:16000000,animated:false});
    const metadata=await decoder.metadata();
    if(!['jpeg','png','webp'].includes(metadata.format)) throw new Error('format');
    const result=await decoder.rotate().resize({width:960,height:960,fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).jpeg({quality:75}).toBuffer();
    if(result.length>300000) throw new Error('size');
    return `data:image/jpeg;base64,${result.toString('base64')}`;
  } catch { throw new HomeError('사진을 읽을 수 없어요. 더 작은 사진으로 다시 시도해 주세요.'); }
}

/** All room reads and writes recheck owner privacy, relationships and blocks in the same transaction. */
export function registerHomeRoutes(app, {db, requireUser, success, ApiError, assertNotBlockedInTransaction, profileForOthers, putNotification, removeNotification, nowIso, todayInSeoul}) {
  const homeRef=id=>db.collection('homes').doc(id);
  const child=(id,name)=>homeRef(id).collection(name);
  const uid=value=> { const id=text(value,128,true); if(id.includes('/')) throw new HomeError('대상을 확인해 주세요.'); return id; };
  const route=(method,path,handler)=>app[method](path,requireUser,async(req,res)=>{
    try { return success(res,req,await handler(req)); }
    catch(error) { if(error instanceof HomeError) throw new ApiError(error.status,'HOME_ERROR',error.message); throw error; }
  });
  async function access(tx, viewer, owner, writing=false) {
    await assertNotBlockedInTransaction(tx,viewer,[owner]);
    const [profile,home,forward,reverse]=await tx.getAll(db.collection('profiles').doc(owner),homeRef(owner),db.collection('follows').doc(viewer+'_'+owner),db.collection('follows').doc(owner+'_'+viewer));
    if(!profile.exists || profile.data().accountStatus!=='active') throw new HomeError('집을 찾을 수 없어요.',404);
    const settings=homeSettings(home.data());
    const relation={own:viewer===owner,follows:forward.exists,followedBy:reverse.exists};
    if(!canEnterHome(settings.visibility,relation) || (writing && !canEnterHome(settings.writing,relation))) throw new HomeError('집주인의 공개·작성 설정에 따라 이용할 수 없어요.',403);
    return {profile:profile.data(),settings,relation,home:home.data()||{}};
  }
  async function visibleRows(tx,viewer,rows) {
    const ids=[...new Set(rows.flatMap(row=>[row.authorId,row.reply?.authorId]).filter(id=>id && id!==viewer))];
    if(!ids.length) return rows;
    const blocks=await tx.getAll(...ids.flatMap(id=>[db.collection('blocks').doc(viewer+'_'+id),db.collection('blocks').doc(id+'_'+viewer)]));
    const hidden=new Set(ids.filter((_,i)=>blocks[i*2].exists||blocks[i*2+1].exists));
    return rows.filter(row=>!hidden.has(row.authorId)).map(row=>hidden.has(row.reply?.authorId)?{...row,reply:null}:row);
  }
  async function decorate(tx,rows) {
    const ids=[...new Set(rows.flatMap(row=>[row.authorId,row.reply?.authorId]).filter(Boolean))];
    const profiles=ids.length?await tx.getAll(...ids.map(id=>db.collection('profiles').doc(id))):[];
    const map=new Map(profiles.filter(p=>p.exists).map(p=>[p.id,profileForOthers(p.data())]));
    return rows.map(row=>({...row,author:map.get(row.authorId)||null,reply:row.reply?{...row.reply,author:map.get(row.reply.authorId)||null}:null}));
  }
  const notify=(tx,type,owner,actor,source,excerpt,recipient=owner)=>putNotification(tx,{type,recipientId:recipient,actorId:actor,sourceId:source,homeOwnerId:owner,eventId:crypto.randomUUID(),excerpt,createdAt:nowIso()});

  route('get','/api/homes/directory',async req=>{
    const kind=['following','followers','favorites'].includes(req.query.kind)?req.query.kind:'following';
    const limit=30;
    let query=kind==='favorites'?db.collection('homeFavorites').doc(req.auth.uid).collection('items').orderBy('ownerId')
      :db.collection('follows').where(kind==='followers'?'toUserId':'fromUserId','==',req.auth.uid).orderBy('__name__');
    if(req.query.cursor) query=query.startAfter(uid(req.query.cursor));
    const page=await query.limit(limit+1).get();
    const docs=page.docs.slice(0,limit);
    const rows=await Promise.all(docs.map(document=>{
      const row=document.data(); const owner=kind==='favorites'?row.ownerId:kind==='followers'?row.fromUserId:row.toUserId;
      return db.runTransaction(async tx=>{try { const state=await access(tx,req.auth.uid,owner); return {owner:profileForOthers(state.profile),status:state.settings.status}; } catch(error) {if(error instanceof HomeError || error.code==='PARTNER_BLOCKED') return null; throw error;} });
    }));
    return {items:rows.filter(Boolean),nextCursor:page.size>limit ? (kind==='favorites'?docs.at(-1).data().ownerId:docs.at(-1).id):null};
  });

  route('get','/api/homes/:ownerId',req=>db.runTransaction(async tx=>{
    const owner=uid(req.params.ownerId), viewer=req.auth.uid;
    const state=await access(tx,viewer,owner);
    const [photos,entries,stamps,favorite,mine]=await Promise.all([
      tx.get(child(owner,'photos').limit(3)),tx.get(child(owner,'entries').orderBy('createdAt','desc').limit(21)),
      state.relation.own||state.settings.showVisitors?tx.get(child(owner,'stamps').orderBy('createdAt','desc').limit(20)):null,
      tx.get(db.collection('homeFavorites').doc(viewer).collection('items').doc(owner)),tx.get(child(owner,'stamps').doc(viewer)),
    ]);
    const pinned=state.settings.pinnedId?await tx.get(child(owner,'entries').doc(state.settings.pinnedId)):null;
    const display=state.settings.displayedGiftId?await tx.get(child(owner,'stamps').doc(state.settings.displayedGiftId)):null;
    const raw=entries.docs.slice(0,20).map(d=>({...d.data(),id:d.id}));
    if(pinned?.exists && !raw.some(e=>e.id===pinned.id)) raw.unshift({...pinned.data(),id:pinned.id});
    const visible=await visibleRows(tx,viewer,raw.filter(row=>!row.deletedAt));
    const likes=visible.length?await tx.getAll(...visible.map(e=>child(owner,'entries').doc(e.id).collection('hearts').doc(viewer))):[];
    const decorated=await decorate(tx,visible.map((row,i)=>({...row,hearted:likes[i]?.exists||false})));
    const visitors=await decorate(tx,await visibleRows(tx,viewer,(stamps?.docs||[]).map(d=>({...d.data(),id:d.id}))));
    const displayed=display?.exists?(await decorate(tx,await visibleRows(tx,viewer,[{...display.data(),id:display.id}])))[0]||null:null;
    return {viewerId:viewer,owner:profileForOthers(state.profile),roomConfig:roomFields(state.profile).roomConfig,room3d:readRoom3D(state.home.room3d),room3dRevision:state.home.room3dRevision||0,settings:state.relation.own?state.settings:{...state.settings,displayedGiftId:''},own:state.relation.own,canWrite:canEnterHome(state.settings.writing,state.relation),favorite:favorite.exists,stampedToday:mine.data()?.day===todayInSeoul(),photos:photos.docs.map(d=>({...d.data(),id:d.id})).filter(p=>canEnterHome(p.visibility,state.relation)),entries:decorated,visitors,displayedGift:displayed,nextCursor:entries.size>20?entries.docs[19].id:null};
  }));

  route('put','/api/homes/:ownerId/room3d',req=>db.runTransaction(async tx=>{
    const owner=uid(req.params.ownerId);
    if(owner!==req.auth.uid)throw new HomeError('집주인만 변경할 수 있어요.',403);
    exact(req.body,['config','revision']);
    if(!Number.isSafeInteger(req.body.revision)||req.body.revision<0)throw new HomeError('방을 새로고침해 주세요.');
    const state=await access(tx,req.auth.uid,owner),revision=state.home.room3dRevision||0;
    if(req.body.revision!==revision)throw new HomeError('다른 기기에서 방이 변경되었어요. 새로고침 후 다시 편집해 주세요.',409);
    let config;try{config=validateRoom3D(req.body.config);}catch(error){if(error instanceof Room3DError)throw new HomeError(error.message);throw error;}
    tx.set(homeRef(owner),{room3d:config,room3dRevision:revision+1,updatedAt:nowIso()},{merge:true});
    return {config,revision:revision+1};
  }));

  route('get','/api/homes/:ownerId/entries',req=>db.runTransaction(async tx=>{
    const owner=uid(req.params.ownerId); await access(tx,req.auth.uid,owner);
    let query=child(owner,'entries').orderBy('createdAt','desc');
    if(req.query.cursor) { const cursor=await tx.get(child(owner,'entries').doc(uid(req.query.cursor))); if(!cursor.exists) throw new HomeError('목록을 새로고침해 주세요.'); query=query.startAfter(cursor); }
    const page=await tx.get(query.limit(21));
    const rows=await visibleRows(tx,req.auth.uid,page.docs.slice(0,20).map(d=>({...d.data(),id:d.id})).filter(row=>!row.deletedAt));
    const hearts=rows.length?await tx.getAll(...rows.map(e=>child(owner,'entries').doc(e.id).collection('hearts').doc(req.auth.uid))):[];
    return {items:await decorate(tx,rows.map((row,i)=>({...row,hearted:hearts[i].exists}))),nextCursor:page.size>20?page.docs[19].id:null};
  }));

  route('patch','/api/homes/:ownerId/settings',req=>db.runTransaction(async tx=>{
    const owner=uid(req.params.ownerId); if(owner!==req.auth.uid) throw new HomeError('집주인만 변경할 수 있어요.',403);
    await access(tx,req.auth.uid,owner); const patch=validateHomePatch(req.body);
    if(patch.pinnedId) {const entry=await tx.get(child(owner,'entries').doc(uid(patch.pinnedId))); if(!entry.exists||entry.data().deletedAt) throw new HomeError('글을 찾을 수 없어요.',404); await assertNotBlockedInTransaction(tx,owner,[entry.data().authorId]);}
    if(patch.displayedGiftId) {const stamp=await tx.get(child(owner,'stamps').doc(uid(patch.displayedGiftId))); if(!stamp.exists||stamp.data().gift==='wave') throw new HomeError('전시할 선물을 골라주세요.'); await assertNotBlockedInTransaction(tx,owner,[stamp.data().authorId]);}
    tx.set(homeRef(owner),{...patch,updatedAt:nowIso()},{merge:true}); return {saved:true};
  }));

  route('post','/api/homes/:ownerId/entries',req=>db.runTransaction(async tx=>{
    const owner=uid(req.params.ownerId),viewer=req.auth.uid; const state=await access(tx,viewer,owner,true);
    const installed=state.home.room3d?readRoom3D(state.home.room3d)?.items?.some(item=>item.kind==='board'):state.profile.roomConfig?.items?.some(item=>item.id==='whiteboard');
    if(!installed) throw new HomeError('화이트보드를 먼저 설치해 주세요.');
    exact(req.body,['text','kind','requestId']); const body=text(req.body.text,500,true); const kind=req.body.kind||'guestbook';
    if(!['guestbook','answer'].includes(kind)|| (kind==='answer'&&!state.settings.question)) throw new HomeError('답변할 질문을 확인해 주세요.');
    const requestId=uid(req.body.requestId); if(!/^[a-zA-Z0-9-]{16,64}$/.test(requestId)) throw new HomeError('요청 식별자를 확인해 주세요.');
    const id=crypto.createHash('sha256').update(owner+'\0'+viewer+'\0'+requestId).digest('hex').slice(0,40);
    const ref=child(owner,'entries').doc(id); const existing=await tx.get(ref); if(existing.exists) return {id};
    const quotaRef=db.collection('homeQuotas').doc(viewer); const quota=await tx.get(quotaRef);
    const next=nextHomeQuota(quota.data(),Date.now(),todayInSeoul());
    const row={id,authorId:viewer,kind,text:body,question:kind==='answer'?state.settings.question:'',createdAt:nowIso(),heartCount:0,reply:null,deletedAt:null};
    tx.set(quotaRef,next); tx.create(ref,row); notify(tx,'home_entry',owner,viewer,id,body); return {id};
  }));

  route('patch','/api/homes/:ownerId/entries/:entryId',req=>db.runTransaction(async tx=>{
    const owner=uid(req.params.ownerId),viewer=req.auth.uid; await access(tx,viewer,owner);
    exact(req.body,['reply','hearted']); if(Object.keys(req.body).length!==1) throw new HomeError('한 번에 한 가지 작업만 해주세요.');
    const ref=child(owner,'entries').doc(uid(req.params.entryId)); const entry=await tx.get(ref);
    if(!entry.exists||entry.data().deletedAt) throw new HomeError('글을 찾을 수 없어요.',404);
    const row=entry.data(); await assertNotBlockedInTransaction(tx,viewer,[row.authorId]);
    if(Object.hasOwn(req.body,'reply')) {
      if(owner!==viewer) throw new HomeError('집주인만 답글을 달 수 있어요.',403);
      const body=text(req.body.reply,500); const quotaRef=db.collection('homeQuotas').doc(viewer); const quota=await tx.get(quotaRef);
      if(row.reply?.text===body) return {saved:true};
      tx.set(quotaRef,nextHomeQuota(quota.data(),Date.now(),todayInSeoul()));
      tx.update(ref,{reply:body?{authorId:viewer,text:body,createdAt:nowIso()}:null});
      if(body) notify(tx,'home_reply',owner,viewer,ref.id,body,row.authorId);
      else removeNotification(tx,{type:'home_reply',recipientId:row.authorId,actorId:viewer,sourceId:ref.id});
    } else {
      if(typeof req.body.hearted!=='boolean') throw new HomeError('반응을 확인해 주세요.');
      const heartRef=ref.collection('hearts').doc(viewer); const heart=await tx.get(heartRef);
      if(heart.exists!==req.body.hearted) {
        tx.update(ref,{heartCount:Math.max(0,(row.heartCount||0)+(req.body.hearted?1:-1))});
        if(req.body.hearted) {tx.create(heartRef,{createdAt:nowIso()});notify(tx,'home_heart',owner,viewer,ref.id,'',row.authorId);}
        else {tx.delete(heartRef);removeNotification(tx,{type:'home_heart',recipientId:row.authorId,actorId:viewer,sourceId:ref.id});}
      }
    }
    return {saved:true};
  }));

  route('delete','/api/homes/:ownerId/entries/:entryId',req=>db.runTransaction(async tx=>{
    const owner=uid(req.params.ownerId),viewer=req.auth.uid;
    // Authors retain deletion rights even if the owner closes the house or blocks them.
    const ref=child(owner,'entries').doc(uid(req.params.entryId)); const entry=await tx.get(ref);
    if(!entry.exists || ![owner,entry.data().authorId].includes(viewer)) throw new HomeError('삭제할 수 없는 글입니다.',403);
    const home=await tx.get(homeRef(owner)); const row=entry.data();
    tx.update(ref,{text:'',question:'',reply:null,deletedAt:nowIso()});
    if(home.data()?.pinnedId===ref.id) tx.set(homeRef(owner),{pinnedId:''},{merge:true});
    removeNotification(tx,{type:'home_entry',recipientId:owner,actorId:row.authorId,sourceId:ref.id});
    removeNotification(tx,{type:'home_reply',recipientId:row.authorId,actorId:owner,sourceId:ref.id});
    return {deleted:true};
  }));

  route('post','/api/homes/:ownerId/stamp',req=>db.runTransaction(async tx=>{
    const owner=uid(req.params.ownerId),viewer=req.auth.uid; await access(tx,viewer,owner,true);
    if(owner===viewer) throw new HomeError('친구 집에 인사를 남겨주세요.');
    exact(req.body,['gift','note']); const gift=req.body.gift; if(!HOME_GIFTS.includes(gift)) throw new HomeError('선물을 골라주세요.');
    const note=text(req.body.note||'',160); const ref=child(owner,'stamps').doc(viewer); const previous=await tx.get(ref);
    if(previous.data()?.day===todayInSeoul()) return {already:true};
    const quotaRef=db.collection('homeQuotas').doc(viewer); const quota=await tx.get(quotaRef); const next=nextHomeQuota(quota.data(),Date.now(),todayInSeoul());
    tx.set(quotaRef,next); tx.set(ref,{authorId:viewer,gift,note,day:todayInSeoul(),createdAt:nowIso()});
    notify(tx,'home_visit',owner,viewer,todayInSeoul(),note); return {already:false};
  }));

  route('put','/api/homes/:ownerId/favorite',req=>db.runTransaction(async tx=>{
    const owner=uid(req.params.ownerId); exact(req.body,['favorite']); if(typeof req.body.favorite!=='boolean') throw new HomeError('즐겨찾기 설정을 확인해 주세요.');
    const ref=db.collection('homeFavorites').doc(req.auth.uid).collection('items').doc(owner);
    if(req.body.favorite) {await access(tx,req.auth.uid,owner); tx.set(ref,{ownerId:owner,createdAt:nowIso()});} else tx.delete(ref);
    return {favorite:req.body.favorite};
  }));

  route('put','/api/homes/:ownerId/photos/:frameId',async req=>{
    const owner=uid(req.params.ownerId),frame=uid(req.params.frameId); if(owner!==req.auth.uid) throw new HomeError('집주인만 액자를 바꿀 수 있어요.',403);
    if(!HOME_FRAMES.includes(frame)) throw new HomeError('액자를 골라주세요.');
    exact(req.body,['image','caption','visibility','shape','color']);
    const caption=text(req.body.caption||'',160),visibility=req.body.visibility,shape=req.body.shape,color=req.body.color;
    if(!HOME_SCOPES.includes(visibility)||!['square','portrait','landscape'].includes(shape)||!['oak','white','black','rose'].includes(color)) throw new HomeError('액자 설정을 확인해 주세요.');
    // Reserve a bounded daily attempt before image decoding; invalid image floods also count.
    await db.runTransaction(async tx=>{
      const state=await access(tx,req.auth.uid,owner);const day=todayInSeoul();
      const count=state.home.uploadDay===day?Number(state.home.uploadCount)||0:0;
      if(count>=60) throw new HomeError('사진 저장은 하루 60회까지 가능해요. 내일 다시 시도해 주세요.',429);
      tx.set(homeRef(owner),{uploadDay:day,uploadCount:count+1},{merge:true});
    });
    const image=await sanitizeFrameImage(req.body.image);
    return db.runTransaction(async tx=>{await access(tx,req.auth.uid,owner); tx.set(child(owner,'photos').doc(frame),{image,caption,visibility,shape,color,updatedAt:nowIso()}); return {saved:true};});
  });
  route('delete','/api/homes/:ownerId/photos/:frameId',req=>db.runTransaction(async tx=>{
    const owner=uid(req.params.ownerId),frame=uid(req.params.frameId); if(owner!==req.auth.uid||!HOME_FRAMES.includes(frame)) throw new HomeError('액자를 삭제할 수 없어요.',403);
    await access(tx,req.auth.uid,owner); tx.delete(child(owner,'photos').doc(frame)); return {deleted:true};
  }));

  route('post','/api/homes/:ownerId/reports',req=>db.runTransaction(async tx=>{
    const owner=uid(req.params.ownerId),viewer=req.auth.uid; const state=await access(tx,viewer,owner);
    exact(req.body,['kind','id','reason']); const kind=req.body.kind, id=uid(req.body.id),reason=text(req.body.reason,500,true);
    if(!['entry','reply','photo','stamp'].includes(kind)) throw new HomeError('신고 대상을 확인해 주세요.');
    const doc=await tx.get(child(owner,['entry','reply'].includes(kind)?'entries':kind==='photo'?'photos':'stamps').doc(id));
    if(!doc.exists||doc.data().deletedAt) throw new HomeError('신고 대상을 찾을 수 없어요.',404);
    if(kind==='reply'&&!doc.data().reply) throw new HomeError('신고 대상을 찾을 수 없어요.',404);
    if(kind==='photo'&&!canEnterHome(doc.data().visibility,state.relation)) throw new HomeError('신고 대상을 찾을 수 없어요.',404);
    if(kind==='stamp'&&!state.relation.own&&!state.settings.showVisitors&&state.settings.displayedGiftId!==id&&id!==viewer) throw new HomeError('신고 대상을 찾을 수 없어요.',404);
    await assertNotBlockedInTransaction(tx,viewer,[doc.data().authorId||owner]);
    const reportId=crypto.createHash('sha256').update(viewer+'\0'+owner+'\0'+kind+'\0'+id).digest('hex');
    const ref=db.collection('reports').doc(reportId); const existing=await tx.get(ref); if(existing.exists) return {received:true};
    tx.create(ref,{id:reportId,reporterId:viewer,targetType:'home_'+kind,targetId:kind==='reply'?owner:doc.data().authorId||owner,homeOwnerId:owner,sourceId:id,reason:'other',details:reason,status:'received',submittedAt:nowIso(),updatedAt:nowIso(),nextUpdateBy:new Date(Date.now()+86400000).toISOString(),reporterAccountStatus:'active',evidence:kind==='photo'?{caption:doc.data().caption,updatedAt:doc.data().updatedAt}:{text:doc.data().text||doc.data().note||'',reply:doc.data().reply||null}});
    return {received:true};
  }));
}
