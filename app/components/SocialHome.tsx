"use client";
/* Server-sanitized JPEG data URIs are already resized; no remote optimizer is needed. */
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Gift, Heart, Home, LockKeyhole, MessageCircle, RefreshCw, Settings, Star, X } from 'lucide-react';
import { api, type ApiProfile } from '../lib/live-data';
import { t, currentLocaleSnapshot } from '../lib/i18n';
import { useHome } from '../lib/use-home';
import { HOME_FRAMES, HOME_GIFTS, HOME_GIFT_ICONS, HOME_SCOPES, HOME_STATUSES, type HomeData, type HomeDirectory as Directory, type HomeEntry, type HomePhoto, type HomeSettings } from '../lib/home';
import { HOME_SCOPE_LABELS, HOME_STATUS_LABELS, HOME_GIFT_LABELS, HOME_FRAME_LABELS, HOME_SHAPE_LABELS, HOME_COLOR_LABELS } from '../lib/home-labels';
import { Room3DHome } from './Room3DHome';

export function HomeDirectory({onVisit}:{onVisit:(id:string)=>void}) {
  const [kind,setKind]=useState<'following'|'followers'|'favorites'>('following');
  const [page,setPage]=useState<Directory|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[retry,setRetry]=useState(0);
  useEffect(()=>{let active=true;api<Directory>(`/api/homes/directory?kind=${kind}`).then(value=>{if(active)setPage(value);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[kind,retry]);
  const more=async()=>{if(busy||!page?.nextCursor)return;setBusy(true);try{const value=await api<Directory>(`/api/homes/directory?kind=${kind}&cursor=${encodeURIComponent(page.nextCursor)}`);setPage({items:[...page.items,...value.items],nextCursor:value.nextCursor});}catch(e){setError(e instanceof Error?e.message:t("요청을 처리하지 못했어요."));}finally{setBusy(false);}};
  return <section className="home-directory"><h3>{t("친구 집 둘러보기")}</h3><div className="home-tabs">{(['following','followers','favorites'] as const).map(item=><button type="button" key={item} aria-pressed={kind===item} disabled={busy} onClick={()=>{if(item===kind)return;setPage(null);setError('');setBusy(true);setKind(item);}}>{item==='following'?t("팔로잉"):item==='followers'?t("팔로워"):t("즐겨찾기")}</button>)}</div>
    {error?<p role="alert">{error}<button type="button" onClick={()=>{setError('');setBusy(true);setRetry(retry+1);}}>{t("다시 시도")}</button></p>:null}
    <div className="home-neighbors">{page?.items.map(({owner,status})=><button type="button" className="home-neighbor" key={owner.id} onClick={()=>onVisit(owner.id)}><Home size={24}/><span><strong>{owner.name}</strong><small>{t(HOME_STATUS_LABELS[status])}</small></span><span>{t("놀러 가기")} →</span></button>)}</div>
    {!busy&&page&&!page.items.length?<p className="home-hint">{t("아직 방문할 수 있는 친구 집이 없어요.")}</p>:null}
    {busy?<p role="status">{t("불러오는 중…")}</p>:page?.nextCursor?<button type="button" onClick={()=>void more()}>{t("더 보기")}</button>:null}
  </section>;
}

/**
 * A native dialog provides focus trapping; drafts are never saved by closing the house.
 * The 3D room fills the dialog and every control floats inside it; the guestbook,
 * photos, gifts and settings open as panels over the room instead of below it.
 */
export function HomeDialog({ownerId,viewerGender,onClose,onChat}:{ownerId:string;viewerGender?:string;onClose:()=>void;onChat:(profile:ApiProfile)=>void}) {
  // The viewer walks around as their own character: the male avatar for men, the female one otherwise.
  const avatar=viewerGender==='man'?'male':'female';
  const home=useHome(ownerId,api),data=home.data;
  const [tab,setTab]=useState<'board'|'photos'|'gifts'|'settings'|null>(null);
  const [localBusy,setLocalBusy]=useState(false),[localError,setLocalError]=useState('');
  const [confirm,setConfirm]=useState<null|(()=>Promise<void>)>(null);
  const [confirmLabel,setConfirmLabel]=useState('');
  const [report,setReport]=useState<{kind:string;id:string}|null>(null),[reason,setReason]=useState('');
  const [notice,setNotice]=useState('');
  const [roomDirty,setRoomDirty]=useState(false);
  const [frameId,setFrameId]=useState<HomePhoto['id']>('frame');
  const dialog=useRef<HTMLDialogElement>(null), title=useId();
  const busy=home.busy||localBusy;
  const guard=useRef(false);
  useEffect(()=>{const el=dialog.current!,focus=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';el.showModal();return()=>{el.close();document.body.style.overflow=overflow;focus?.focus();};},[]);
  const run=async(task:()=>Promise<unknown>)=>{if(guard.current||busy)return;guard.current=true;setLocalBusy(true);setLocalError('');try{await task();await home.reload();}catch(e){setLocalError(e instanceof Error?e.message:t("요청을 처리하지 못했어요."));}finally{guard.current=false;setLocalBusy(false);}};
  // Without a saved layout the starter 3D room is shown, and it has a whiteboard (same rule as the server).
  const boardInstalled=data?.room3d?data.room3d.items.some(item=>item.kind==='board'):true;
  const ask=(action:()=>Promise<void>,label=t("삭제하면 되돌릴 수 없어요. 삭제할까요?"))=>{setConfirmLabel(label);setConfirm(()=>action);};
  const closeHome=()=>{if(roomDirty)ask(async()=>onClose(),t("저장하지 않은 변경 사항이 있어요. 나갈까요?"));else onClose();};
  useEffect(()=>{if(tab)dialog.current?.querySelector<HTMLButtonElement>('.home-object-sheet>header button')?.focus();},[tab,frameId]);
  const openObject=useCallback((id:string)=>{if(id==='whiteboard')setTab('board');else if(HOME_FRAMES.includes(id as HomePhoto['id'])){setFrameId(id as HomePhoto['id']);setTab('photos');}},[]);
  const error=home.error||localError;
  const closeButton=<button type="button" className="home3d-icon" disabled={busy} onClick={closeHome} aria-label={t("닫기")}><X size={20}/></button>;
  const sheetTitle=tab==='photos'?t(HOME_FRAME_LABELS[frameId]):tab==='board'?t("화이트보드"):tab==='gifts'?t("인사와 선물"):t("집 설정");
  // Escape closes the innermost layer first: confirmation, then panel, then the house.
  return <dialog className="social-home-dialog" ref={dialog} aria-labelledby={title} onCancel={event=>{event.preventDefault();if(guard.current||busy)return;if(confirm||report){setConfirm(null);setReport(null);}else if(tab)setTab(null);else closeHome();}}>
    {data?<Room3DHome data={data} busy={busy} suspended={!!tab||!!confirm||!!report} onSave={(config,revision)=>home.act('/room3d','PUT',{config,revision})} onDirtyChange={setRoomDirty} onObject={openObject} avatar={avatar}
      heading={<>
        <small>TIMO HOME</small>
        <h2 id={title}>{t("{name}님의 마이룸",{name:data.owner.name})}</h2>
        <p className="home3d-chips"><span className={`home-status status-${data.settings.status}`}>● {t(HOME_STATUS_LABELS[data.settings.status])}</span><span>{t(HOME_SCOPE_LABELS[data.settings.visibility])}</span></p>
        {data.displayedGift?<button type="button" className="home3d-gift" onClick={()=>setTab('gifts')}><span aria-hidden="true">{HOME_GIFT_ICONS[data.displayedGift.gift]}</span>{data.displayedGift.note||t(HOME_GIFT_LABELS[data.displayedGift.gift])}</button>:null}
      </>}
      windowActions={<>
        {!data.own?<button type="button" className="home3d-icon" disabled={busy} aria-pressed={data.favorite} aria-label={t("즐겨찾기")} onClick={()=>void home.act('/favorite','PUT',{favorite:!data.favorite})}><Star size={19} fill={data.favorite?'currentColor':'none'}/></button>:null}
        <button type="button" className="home3d-icon" disabled={busy||roomDirty} aria-label={t("새로고침")} onClick={()=>void home.reload()}><RefreshCw size={18}/></button>
        {closeButton}
      </>}
      dock={[
        {key:'gifts',label:t("인사와 선물"),icon:<Gift size={20}/>,onClick:()=>setTab('gifts'),disabled:busy||roomDirty},
        data.own
          ?{key:'settings',label:t("집 설정"),icon:<Settings size={20}/>,onClick:()=>setTab('settings'),disabled:busy||roomDirty}
          :{key:'chat',label:t("대화하기"),icon:<MessageCircle size={20}/>,onClick:()=>onChat(data.owner),disabled:busy},
      ]}>
      {error&&!tab?<p className="home3d-error" role="alert">{error}<button type="button" disabled={busy} onClick={()=>void home.reload()}>{t("다시 시도")}</button></p>:null}
      {tab?<section className="home-object-sheet" aria-label={sheetTitle}><header><h3>{sheetTitle}</h3><button type="button" disabled={busy} onClick={()=>setTab(null)} aria-label={t("방으로 돌아가기")}><X/></button></header>
        {error?<p role="alert">{error}</p>:null}
        {notice?<p role="status" className="home-hint">{notice}</p>:null}
        {tab==='board'?<>
          {!boardInstalled?<p className="home-hint">{t("아직 방명록을 받지 않는 집이에요.")}</p>:null}
          {data.settings.question?<blockquote className="home-question"><small>{t("오늘의 질문")}</small><p>{data.settings.question}</p></blockquote>:null}
          {boardInstalled?<HomeComposer data={data} busy={busy} act={home.act}/>:null}
          <HomeEntries key={ownerId} data={data} busy={busy} act={home.act} ask={ask} report={setReport} block={id=>run(()=>api(`/api/partners/${encodeURIComponent(id)}/block`,{method:'POST',body:'{}'}))}/>
        </>:null}
        {tab==='photos'?<HomePhotos key={frameId} frameId={frameId} data={data} busy={busy} act={home.act} report={setReport} ask={ask}/>:null}
        {tab==='gifts'?<>
          {data.own&&data.displayedGift?<div className="home-displayed-gift"><span>{HOME_GIFT_ICONS[data.displayedGift.gift]}</span><div><strong>{t("소중한 선물")}</strong><p>{data.displayedGift.note||t(HOME_GIFT_LABELS[data.displayedGift.gift])}</p><small>{data.displayedGift.author?.name}</small></div><button type="button" disabled={busy||roomDirty} onClick={()=>void home.act('/settings','PATCH',{displayedGiftId:''})}>{t("전시 해제")}</button></div>:null}
          {!data.own?<HomeGreeting data={data} busy={busy} act={home.act}/>:<p className="home-hint">{t("친구가 남긴 인사와 선물을 모았어요.")}</p>}
          {!data.own&&!data.settings.showVisitors?<p className="home-hint">{t("방문 기록은 집주인만 볼 수 있어요.")}</p>:null}
          <div className="home-visitors">{data.visitors.map(stamp=><article key={stamp.id}><span className="home-gift-icon">{HOME_GIFT_ICONS[stamp.gift]}</span><div><strong>{stamp.author?.name||t("알 수 없는 상대")}</strong><p>{stamp.note||t(HOME_GIFT_LABELS[stamp.gift])}</p><small>{stamp.day}</small></div>{data.own&&stamp.gift!=='wave'?<button type="button" disabled={busy} onClick={()=>void home.act('/settings','PATCH',{displayedGiftId:stamp.id})}>{t("전시하기")}</button>:null}<button type="button" onClick={()=>setReport({kind:'stamp',id:stamp.id})}>{t("신고")}</button></article>)}</div>
          {data.own&&!data.visitors.length?<p className="home-hint">{t("아직 받은 인사나 선물이 없어요.")}</p>:null}
        </>:null}
        {tab==='settings'&&data.own?<HomeSettingsForm key={JSON.stringify(data.settings)} settings={data.settings} busy={busy} act={home.act}/>:null}
      </section>:null}
    </Room3DHome>
    :<div className="home3d home3d-empty">
      <header className="home3d-top"><div className="home3d-heading"><small>TIMO HOME</small><h2 id={title}>{t("친구 집")}</h2></div><div className="home3d-window">{closeButton}</div></header>
      {home.loading?<div className="home3d-loading" role="status"><span className="home3d-spinner" aria-hidden="true"/><p>{t("불러오는 중…")}</p></div>
        :<div className="home3d-loading home-locked"><LockKeyhole/><p>{error||t("공개 설정 또는 연결 상태를 확인해 주세요.")}</p><button type="button" className="home3d-primary" disabled={busy} onClick={()=>void home.reload()}>{t("다시 시도")}</button></div>}
    </div>}
    {confirm?<section className="home-confirm" role="alert"><p>{confirmLabel}</p><button type="button" disabled={busy} onClick={()=>setConfirm(null)}>{t("취소")}</button><button type="button" disabled={busy} onClick={()=>{const action=confirm;setConfirm(null);void action();}}>{t("확인")}</button></section>:null}
    {report?<form className="home-report" onSubmit={event=>{event.preventDefault();void run(async()=>{const result=await api(`/api/homes/${encodeURIComponent(ownerId)}/reports`,{method:'POST',body:JSON.stringify({...report,reason})});setReport(null);setReason('');setNotice(t("신고를 접수했어요. 신고만으로 계정이 정지되지는 않아요."));return result;});}}><label>{t("신고 사유")}<textarea required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label><button type="button" disabled={busy} onClick={()=>setReport(null)}>{t("취소")}</button><button type="submit" disabled={busy||!reason.trim()}>{t("신고 보내기")}</button></form>:null}
  </dialog>;
}

type Actions={busy:boolean;act:(suffix:string,method:string,body?:unknown)=>Promise<boolean>};
function HomeComposer({data,busy,act}:{data:HomeData}&Actions) {
  const [body,setBody]=useState(''),[kind,setKind]=useState<'guestbook'|'answer'>('guestbook');
  const requestId=useRef('');
  return <form className="home-compose" onSubmit={event=>{event.preventDefault();if(!requestId.current)requestId.current=crypto.randomUUID();void act('/entries','POST',{text:body,kind,requestId:requestId.current}).then(ok=>{if(ok){setBody('');requestId.current='';}});}}>
    <div className="home-tabs"><button type="button" aria-pressed={kind==='guestbook'} onClick={()=>{setKind('guestbook');requestId.current='';}}>{t("방명록")}</button>{data.settings.question?<button type="button" aria-pressed={kind==='answer'} onClick={()=>{setKind('answer');requestId.current='';}}>{t("질문에 답하기")}</button>:null}</div>
    <label>{kind==='answer'?t("질문에 답하기"):t("방명록 남기기")}<textarea maxLength={500} rows={3} disabled={busy||!data.canWrite} value={body} onChange={e=>{setBody(e.target.value);requestId.current='';}} placeholder={t("짧은 인사나 궁금한 것을 남겨보세요.")}/></label>
    <div className="home-form-end"><small>{body.length}/500 · {t("하루 20개까지, 15초 간격으로 작성할 수 있어요.")}</small><button type="submit" className="primary-button" disabled={busy||!data.canWrite||!body.trim()}>{t("남기기")}</button></div>
    {!data.canWrite?<p className="home-hint">{t("집주인이 허용한 사람만 글과 선물을 남길 수 있어요.")}</p>:null}
  </form>;
}

function HomeEntries({data,busy,act,ask,report,block}:{data:HomeData;ask:(action:()=>Promise<void>,label?:string)=>void;report:(target:{kind:string;id:string})=>void;block:(id:string)=>Promise<void>}&Actions) {
  const [extra,setExtra]=useState<HomeEntry[]>([]),[cursor,setCursor]=useState(data.nextCursor),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [translations,setTranslations]=useState<Record<string,string>>({}),[replyId,setReplyId]=useState(''),[reply,setReply]=useState('');
  const [snapshot,setSnapshot]=useState(data);if(snapshot!==data){setSnapshot(data);setExtra([]);setCursor(data.nextCursor);}
  const rows=[...data.entries,...extra.filter(row=>!data.entries.some(item=>item.id===row.id))].sort((a,b)=>Number(b.id===data.settings.pinnedId)-Number(a.id===data.settings.pinnedId));
  const more=async()=>{if(!cursor||loading)return;setLoading(true);try{const page=await api<{items:HomeEntry[];nextCursor:string|null}>(`/api/homes/${encodeURIComponent(data.owner.id)}/entries?cursor=${encodeURIComponent(cursor)}`);setExtra([...extra,...page.items]);setCursor(page.nextCursor);}catch(e){setError(e instanceof Error?e.message:t("요청을 처리하지 못했어요."));}finally{setLoading(false);}};
  const translate=async(entry:HomeEntry)=>{if(loading)return;setLoading(true);setError('');try{const value=await api<{translatedText:string}>('/api/translate',{method:'POST',body:JSON.stringify({text:entry.text,targetLanguage:currentLocaleSnapshot()})});setTranslations({...translations,[entry.id]:value.translatedText});}catch(e){setError(e instanceof Error?e.message:t("요청을 처리하지 못했어요."));}finally{setLoading(false);}};
  return <section className="home-entries" aria-label={t("방명록")}>
    {error?<p role="alert">{error}</p>:null}
    {rows.map(entry=><article className="home-entry" key={entry.id}>
      <header><strong>{entry.author?.name||t("알 수 없는 상대")}</strong><time>{entry.createdAt.slice(0,10)}</time>{data.settings.pinnedId===entry.id?<span>{t("고정됨")}</span>:null}</header>
      {entry.kind==='answer'?<small className="home-answer-label">{entry.question}</small>:null}<p>{entry.text}</p>{translations[entry.id]?<blockquote>{translations[entry.id]}</blockquote>:null}
      <div className="home-entry-actions"><button type="button" aria-pressed={entry.hearted} disabled={busy} onClick={()=>void act(`/entries/${entry.id}`,'PATCH',{hearted:!entry.hearted})}><Heart size={15}/>{entry.heartCount}</button><button type="button" disabled={loading} onClick={()=>void translate(entry)}>{t("번역")}</button>
        {data.own?<><button type="button" disabled={busy} onClick={()=>void act('/settings','PATCH',{pinnedId:data.settings.pinnedId===entry.id?'':entry.id})}>{data.settings.pinnedId===entry.id?t("고정 해제"):t("고정")}</button><button type="button" disabled={busy} onClick={()=>{setReplyId(entry.id);setReply(entry.reply?.text||'');}}>{t("답글")}</button></>:null}
        {data.own||entry.authorId===data.viewerId?<button type="button" disabled={busy} onClick={()=>ask(async()=>{await act(`/entries/${entry.id}`,'DELETE');})}>{t("삭제")}</button>:null}
        {entry.authorId!==data.viewerId?<><button type="button" onClick={()=>report({kind:'entry',id:entry.id})}>{t("신고")}</button><button type="button" disabled={busy} onClick={()=>ask(()=>block(entry.authorId),t("이 사용자를 차단할까요?"))}>{t("차단")}</button></>:null}
      </div>
      {entry.reply?<div className="home-owner-reply"><strong>{t("집주인 답글")}</strong><p>{entry.reply.text}</p>{!data.own?<button type="button" onClick={()=>report({kind:'reply',id:entry.id})}>{t("답글 신고")}</button>:null}</div>:null}
      {replyId===entry.id?<form onSubmit={e=>{e.preventDefault();void act(`/entries/${entry.id}`,'PATCH',{reply}).then(ok=>{if(ok)setReplyId('');});}}><label>{t("답글")}<textarea rows={2} maxLength={500} value={reply} onChange={e=>setReply(e.target.value)}/></label><button type="button" onClick={()=>setReplyId('')}>{t("취소")}</button><button type="submit" disabled={busy}>{t("답글 저장")}</button></form>:null}
    </article>)}
    {!rows.length?<p className="home-hint">{t("첫 번째 인사를 남겨보세요.")}</p>:null}
    {cursor?<button type="button" disabled={loading||busy} onClick={()=>void more()}>{t("더 보기")}</button>:null}
  </section>;
}

function Choices<T extends string>({label,values,value,onChange,labels,disabled}:{label:string;values:readonly T[];value:T;onChange:(value:T)=>void;labels:Record<T,string>;disabled?:boolean}) {
  return <fieldset className="home-choices" disabled={disabled}><legend>{label}</legend><div>{values.map(item=><button key={item} type="button" aria-pressed={value===item} onClick={()=>onChange(item)}>{labels[item]}</button>)}</div></fieldset>;
}
function HomeSettingsForm({settings,busy,act}:{settings:HomeSettings}&Actions) {
  const [draft,setDraft]=useState(settings);
  return <form className="home-settings" onSubmit={e=>{e.preventDefault();void act('/settings','PATCH',draft);}}>
    <Choices label={t("집 공개 범위")} values={HOME_SCOPES} value={draft.visibility} onChange={visibility=>setDraft({...draft,visibility})} labels={Object.fromEntries(HOME_SCOPES.map(key=>[key,t(HOME_SCOPE_LABELS[key])])) as Record<typeof HOME_SCOPES[number],string>} disabled={busy}/>
    <Choices label={t("글과 선물을 남길 수 있는 사람")} values={HOME_SCOPES} value={draft.writing} onChange={writing=>setDraft({...draft,writing})} labels={Object.fromEntries(HOME_SCOPES.map(key=>[key,t(HOME_SCOPE_LABELS[key])])) as Record<typeof HOME_SCOPES[number],string>} disabled={busy}/>
    <Choices label={t("집주인 상태")} values={HOME_STATUSES} value={draft.status} onChange={status=>setDraft({...draft,status})} labels={Object.fromEntries(HOME_STATUSES.map(key=>[key,t(HOME_STATUS_LABELS[key])])) as Record<typeof HOME_STATUSES[number],string>} disabled={busy}/>
    <label className="home-check"><input type="checkbox" checked={draft.showVisitors} onChange={e=>setDraft({...draft,showVisitors:e.target.checked})} disabled={busy}/>{t("방문자 이름과 인사를 방문객에게 공개")}</label>
    <label>{t("오늘의 질문")}<textarea maxLength={200} rows={3} value={draft.question} onChange={e=>setDraft({...draft,question:e.target.value})} disabled={busy}/></label><p className="home-hint">{t("질문을 바꿔도 이전 답변에는 당시 질문이 남아요.")}</p>
    <button type="submit" className="primary-button" disabled={busy||JSON.stringify(draft)===JSON.stringify(settings)}>{t("집 설정 저장")}</button>
  </form>;
}
function HomeGreeting({data,busy,act}:{data:HomeData}&Actions) {
  const [gift,setGift]=useState<typeof HOME_GIFTS[number]>('wave'),[note,setNote]=useState('');
  return <form className="home-greeting" onSubmit={e=>{e.preventDefault();void act('/stamp','POST',{gift,note});}}><h3>{t("하루 한 번, 가벼운 인사")}</h3><div className="home-gift-options">{HOME_GIFTS.map(item=><button type="button" key={item} disabled={busy||data.stampedToday} aria-pressed={gift===item} onClick={()=>setGift(item)}><span>{HOME_GIFT_ICONS[item]}</span>{t(HOME_GIFT_LABELS[item])}</button>)}</div><label>{t("선물에 담을 말")}<input maxLength={160} value={note} onChange={e=>setNote(e.target.value)} disabled={busy||data.stampedToday}/></label><button type="submit" className="primary-button" disabled={busy||data.stampedToday||!data.canWrite}>{data.stampedToday?t("오늘 인사를 남겼어요"):t("무료로 인사 보내기")}</button>{!data.canWrite?<p>{t("집주인이 허용한 사람만 글과 선물을 남길 수 있어요.")}</p>:null}</form>;
}

async function compressPhoto(file:File) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12000000)throw new Error(t("12MB 이하의 JPG, PNG, WebP 사진을 골라주세요."));
  const url=URL.createObjectURL(file);
  try {const image=new Image();image.src=url;await image.decode();const factor=Math.min(1,960/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*factor));canvas.height=Math.max(1,Math.round(image.height*factor));const context=canvas.getContext('2d');if(!context)throw new Error(t("사진을 읽을 수 없어요."));context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);const result=canvas.toDataURL('image/jpeg',.72);if(result.length>520000)throw new Error(t("사진을 줄여도 너무 커요. 다른 사진을 골라주세요."));return result;}finally{URL.revokeObjectURL(url);}
}
function HomePhotos({data,busy,act,frameId,report,ask}:{data:HomeData;frameId:HomePhoto['id'];report:(target:{kind:string;id:string})=>void;ask:(action:()=>Promise<void>)=>void}&Actions) {
  const selected=frameId;
  const [draft,setDraft]=useState<HomePhoto|null>(null),[error,setError]=useState(''),[processing,setProcessing]=useState(false),[large,setLarge]=useState<HomePhoto|null>(null);
  const saved=data.photos.find(photo=>photo.id===selected);
  const current=draft||saved||{id:selected,image:'',caption:'',visibility:'everyone' as const,shape:'square' as const,color:'oak' as const};
  const update=(patch:Partial<HomePhoto>)=>setDraft({...current,...patch});
  const choose=async(file?:File)=>{if(!file)return;setProcessing(true);setError('');try{update({image:await compressPhoto(file)});}catch(e){setError(e instanceof Error?e.message:t("사진을 읽을 수 없어요."));}finally{setProcessing(false);}};
  return <section className="home-photos"><div className="home-photo-gallery">{data.photos.filter(photo=>photo.id===frameId).map(photo=><article key={photo.id}><button type="button" onClick={()=>setLarge(photo)}>
    <img className={`home-photo frame-${photo.color} shape-${photo.shape}`} src={photo.image} alt={photo.caption||t(HOME_FRAME_LABELS[photo.id])}/><span>{photo.caption}</span></button>{!data.own?<button type="button" onClick={()=>report({kind:'photo',id:photo.id})}>{t("신고")}</button>:null}</article>)}</div>
    {!data.photos.some(photo=>photo.id===selected)?<p className="home-hint">{t("아직 걸어둔 사진이 없어요.")}</p>:null}
    {large?<div className="home-photo-large"><button type="button" onClick={()=>setLarge(null)}>{t("큰 사진 닫기")}</button><img src={large.image} alt={large.caption||t("사진")}/><p>{large.caption}</p></div>:null}
    {data.own?<form onSubmit={e=>{e.preventDefault();void act(`/photos/${selected}`,'PUT',{image:current.image,caption:current.caption,visibility:current.visibility,shape:current.shape,color:current.color}).then(ok=>{if(ok)setDraft(null);});}}>
      <label>{t("사진 고르기")}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy||processing} onChange={e=>void choose(e.target.files?.[0])}/></label>
      {current.image? <div><img className={`home-photo-preview home-photo frame-${current.color} shape-${current.shape}`} src={current.image} alt={t("사진 미리보기")}/></div>:null}
      <label>{t("사진 설명")}<input value={current.caption} maxLength={160} disabled={busy||processing} onChange={e=>update({caption:e.target.value})}/></label>
      <Choices label={t("액자 모양")} values={['square','portrait','landscape'] as const} value={current.shape} onChange={shape=>update({shape})} labels={{square:t(HOME_SHAPE_LABELS.square),portrait:t(HOME_SHAPE_LABELS.portrait),landscape:t(HOME_SHAPE_LABELS.landscape)}} disabled={busy||processing}/>
      <Choices label={t("액자 색상")} values={['oak','white','black','rose'] as const} value={current.color} onChange={color=>update({color})} labels={{oak:t(HOME_COLOR_LABELS.oak),white:t(HOME_COLOR_LABELS.white),black:t(HOME_COLOR_LABELS.black),rose:t(HOME_COLOR_LABELS.rose)}} disabled={busy||processing}/>
      <Choices label={t("사진 공개 범위")} values={HOME_SCOPES} value={current.visibility} onChange={visibility=>update({visibility})} labels={Object.fromEntries(HOME_SCOPES.map(key=>[key,t(HOME_SCOPE_LABELS[key])])) as Record<typeof HOME_SCOPES[number],string>} disabled={busy||processing}/>
      {error?<p role="alert">{error}</p>:null}<p className="home-hint">{t("사진 위치 정보는 제거하고 최대 960px로 저장해요.")}</p>
      <div className="home-form-end">{saved?<button type="button" disabled={busy||processing} onClick={()=>ask(async()=>{await act(`/photos/${selected}`,'DELETE');setDraft(null);})}>{t("사진 삭제")}</button>:null}<button type="submit" className="primary-button" disabled={busy||processing||!current.image}>{processing?t("처리 중…"):t("액자 저장")}</button></div>
    </form>:null}
  </section>;
}
