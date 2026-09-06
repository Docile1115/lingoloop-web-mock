import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SvgXml } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useHome } from '@shared/use-home';
import { HOME_FRAMES, HOME_GIFTS, HOME_GIFT_ICONS, HOME_SCOPES, HOME_STATUSES, type HomeData, type HomeDirectory, type HomeEntry, type HomePhoto, type HomeSettings } from '@shared/home';
import { HOME_SCOPE_LABELS, HOME_STATUS_LABELS, HOME_GIFT_LABELS, HOME_FRAME_LABELS, HOME_SHAPE_LABELS, HOME_COLOR_LABELS } from '@shared/home-labels';
import { addRoomItem, normalizeRoom, renderRoomSvg, type RoomItemId } from '@shared/room';
import { currentLocaleSnapshot } from '@shared/i18n/core';
import { toPartner, type ApiNotification, type ApiProfile } from '@shared/live-data';
import type { Partner } from '@shared/demo-data';
import { api } from '../lib/api';
import { t } from '../lib/i18n';
import { useTheme } from '../lib/useTheme';
import { useSession } from '../lib/session';

function Button({children,onPress,disabled=false,selected=false}:{children:ReactNode;onPress:()=>void;disabled?:boolean;selected?:boolean}) {
  const c=useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{disabled,selected}} disabled={disabled} onPress={onPress} style={{minHeight:44,padding:12,borderRadius:12,borderWidth:1,borderColor:selected?c.primaryStrong:c.line,backgroundColor:selected?c.sunken:c.surface,justifyContent:'center',opacity:disabled?.45:1}}><Text style={{color:selected?c.primaryStrong:c.ink,fontSize:14,fontWeight:'600'}}>{children}</Text></Pressable>;
}
function Copy({children}:{children:ReactNode}) {const c=useTheme();return <Text style={{color:c.ink,fontSize:15,lineHeight:23}}>{children}</Text>;}
function Row({children}:{children:ReactNode}) {return <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{children}</View>;}
function Card({children}:{children:ReactNode}) {const c=useTheme();return <View style={{borderWidth:1,borderColor:c.line,borderRadius:16,padding:14,gap:12,backgroundColor:c.surface}}>{children}</View>;}
function Field({label,value,onChange,max=500,disabled=false}:{label:string;value:string;onChange:(value:string)=>void;max?:number;disabled?:boolean}) {
  const c=useTheme();return <View style={{gap:8}}><Copy>{label}</Copy><TextInput accessibilityLabel={label} multiline editable={!disabled} value={value} onChangeText={onChange} maxLength={max} placeholderTextColor={c.muted} style={{fontSize:16,color:c.ink,minHeight:72,borderWidth:1,borderColor:c.line,borderRadius:12,padding:12,textAlignVertical:'top'}}/></View>;
}
function Choices<T extends string>({label,values,value,onChange,labels,disabled=false}:{label:string;values:readonly T[];value:T;onChange:(value:T)=>void;labels:Record<T,string>;disabled?:boolean}) {
  return <View style={{gap:8}}><Copy>{label}</Copy><Row>{values.map(item=><Button key={item} disabled={disabled} selected={value===item} onPress={()=>onChange(item)}>{labels[item]}</Button>)}</Row></View>;
}
const scopeLabels=()=>Object.fromEntries(HOME_SCOPES.map(key=>[key,t(HOME_SCOPE_LABELS[key])])) as Record<typeof HOME_SCOPES[number],string>;
function confirm(action:()=>void,label=t("삭제하면 되돌릴 수 없어요. 삭제할까요?")) {Alert.alert(label,undefined,[{text:t("취소"),style:'cancel'},{text:t("확인"),style:'destructive',onPress:action}]);}
const errorText=(error:unknown)=>error instanceof Error?error.message:t("요청을 처리하지 못했어요.");
function homeEventTitle(event:ApiNotification) {
  const name=event.actor?.name||t("알 수 없는 상대");
  switch(event.type){case 'home_entry':return t("{name}님이 방명록을 남겼어요",{name});case 'home_reply':return t("{name}님이 방명록에 답했어요",{name});case 'home_heart':return t("{name}님이 방명록을 좋아해요",{name});default:return t("{name}님이 집에 인사를 남겼어요",{name});}
}

export function HomesScreen({onVisit}:{onVisit:(id:string)=>void}) {
  const c=useTheme(),{me}=useSession();
  const [kind,setKind]=useState<'following'|'followers'|'favorites'>('following'),[page,setPage]=useState<HomeDirectory|null>(null),[events,setEvents]=useState<ApiNotification[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const generation=useRef(0);
  const load=useCallback(async()=>{const ticket=++generation.current;setBusy(true);setError('');setPage(null);try{const [directory,notifications]=await Promise.all([api<HomeDirectory>(`/api/homes/directory?kind=${kind}`),api<{items:ApiNotification[]}>('/api/notifications')]);if(ticket===generation.current){setPage(directory);setEvents(notifications.items.filter(row=>row.homeOwnerId));}}catch(e){if(ticket===generation.current)setError(errorText(e));}finally{if(ticket===generation.current)setBusy(false);}},[kind]);
  useFocusEffect(useCallback(()=>{void load();return()=>{generation.current++;};},[load]));
  const more=async()=>{if(busy||!page?.nextCursor)return;setBusy(true);try{const value=await api<HomeDirectory>(`/api/homes/directory?kind=${kind}&cursor=${encodeURIComponent(page.nextCursor)}`);setPage({items:[...page.items,...value.items],nextCursor:value.nextCursor});}catch(e){setError(errorText(e));}finally{setBusy(false);}};
  return <ScrollView style={{backgroundColor:c.bg}} contentContainerStyle={{padding:16,gap:16,paddingBottom:40}}>
    {me?<Button onPress={()=>onVisit(me.id)}>{t("내 집 방문·방명록")}</Button>:null}
    <Row>{(['following','followers','favorites'] as const).map(item=><Button key={item} disabled={busy} selected={kind===item} onPress={()=>setKind(item)}>{item==='following'?t("팔로잉"):item==='followers'?t("팔로워"):t("즐겨찾기")}</Button>)}</Row>
    {error?<Copy>{error}</Copy>:null}<Button disabled={busy} onPress={()=>void load()}>{busy?t("불러오는 중…"):t("새로고침")}</Button>
    {page?.items.map(({owner,status})=><Button key={owner.id} onPress={()=>onVisit(owner.id)}>{owner.name} · {t(HOME_STATUS_LABELS[status])} →</Button>)}
    {page&&!page.items.length?<Copy>{t("아직 방문할 수 있는 친구 집이 없어요.")}</Copy>:null}
    {page?.nextCursor?<Button disabled={busy} onPress={()=>void more()}>{t("더 보기")}</Button>:null}
    <Copy>{t("알림")}</Copy>{events.map(event=><Button key={event.id} onPress={()=>{void api(`/api/notifications/${encodeURIComponent(event.id)}/read`,{method:'PATCH',body:JSON.stringify({eventId:event.eventId})}).catch(()=>{});onVisit(event.homeOwnerId!);}}>{event.readAt?'':'● '}{homeEventTitle(event)} →</Button>)}
  </ScrollView>;
}

type HomeActions={act:(suffix:string,method:string,body?:unknown)=>Promise<boolean>;busy:boolean};
export function HomeScreen({ownerId,onStartChat}:{ownerId:string;onStartChat:(partner:Partner)=>void}) {
  const c=useTheme(),{refresh}=useSession(),home=useHome(ownerId,api),data=home.data;
  const [tab,setTab]=useState<'board'|'photos'|'gifts'|'settings'>('board'),[error,setError]=useState(''),[localBusy,setLocalBusy]=useState(false);
  const [report,setReport]=useState<{kind:string;id:string}|null>(null),[reason,setReason]=useState(''),[notice,setNotice]=useState('');
  const lock=useRef(false),scroll=useRef<ScrollView>(null);const busy=home.busy||localBusy;
  const run=async(task:()=>Promise<unknown>)=>{if(lock.current||home.busy)return;lock.current=true;setLocalBusy(true);setError('');try{await task();await home.reload();}catch(e){setError(errorText(e));}finally{lock.current=false;setLocalBusy(false);}};
  const install=async(id:RoomItemId)=>{if(!data)return;await run(async()=>{const initial=normalizeRoom(data.roomConfig),config=addRoomItem(initial,id);if(config===initial&&!initial.items.some(item=>item.id===id))throw new Error(t("가구를 하나 치운 뒤 설치해 주세요."));await api('/api/profile/room',{method:'PATCH',body:JSON.stringify({config})});await refresh();});};
  const actions={busy,act:home.act};
  return <KeyboardAvoidingView style={{flex:1,backgroundColor:c.bg}} behavior={Platform.OS==='ios'?'padding':undefined} keyboardVerticalOffset={100}><ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:16,gap:16,paddingBottom:48}} onContentSizeChange={()=>{if(report)scroll.current?.scrollToEnd({animated:true});}}>
    {home.error||error?<Copy>{home.error||error}</Copy>:null}{home.loading?<Copy>{t("불러오는 중…")}</Copy>:null}
    {!data&&!home.loading?<Button disabled={busy} onPress={()=>void home.reload()}>{t("다시 시도")}</Button>:null}
    {data?<>
      <Copy>{t("{name}님의 마이룸",{name:data.owner.name})}</Copy><Button disabled={busy} onPress={()=>void home.reload()}>{t("새로고침")}</Button><Copy>● {t(HOME_STATUS_LABELS[data.settings.status])} · {t(HOME_SCOPE_LABELS[data.settings.visibility])}</Copy>
      <View accessible accessibilityRole="image" accessibilityLabel={t("{name}님의 마이룸",{name:data.owner.name})} style={{width:'100%',aspectRatio:600/460}}><SvgXml xml={renderRoomSvg(data.roomConfig,data.owner.avatarConfig,null,data.photos)} width="100%" height="100%"/></View>
      {!data.own?<Row><Button selected={data.favorite} disabled={busy} onPress={()=>void home.act('/favorite','PUT',{favorite:!data.favorite})}>{t("즐겨찾기")}</Button><Button disabled={busy} onPress={()=>onStartChat(toPartner(data.owner as ApiProfile))}>{t("대화하기")}</Button></Row>:null}
      {data.displayedGift?<Card><Copy>{t("소중한 선물")} {HOME_GIFT_ICONS[data.displayedGift.gift]}</Copy><Copy>{data.displayedGift.note} · {data.displayedGift.author?.name}</Copy>{data.own?<Button disabled={busy} onPress={()=>void home.act('/settings','PATCH',{displayedGiftId:''})}>{t("전시 해제")}</Button>:null}</Card>:null}
      <Row><Button selected={tab==='board'} onPress={()=>setTab('board')}>{t("화이트보드")}</Button><Button selected={tab==='photos'} onPress={()=>setTab('photos')}>{t("사진 액자")}</Button><Button selected={tab==='gifts'} onPress={()=>setTab('gifts')}>{t("인사와 선물")}</Button>{data.own?<Button selected={tab==='settings'} onPress={()=>setTab('settings')}>{t("집 설정")}</Button>:null}</Row>
      {tab==='board'?<NativeBoard data={data} {...actions} install={()=>install('whiteboard')} report={setReport} block={id=>run(()=>api(`/api/partners/${encodeURIComponent(id)}/block`,{method:'POST',body:'{}'}))}/>:null}
      {tab==='photos'?<NativePhotos data={data} {...actions} install={install} report={setReport}/>:null}
      {tab==='gifts'?<NativeGifts data={data} {...actions} report={setReport}/>:null}
      {tab==='settings'&&data.own?<NativeSettings key={JSON.stringify(data.settings)} value={data.settings} {...actions}/>:null}
    </>:null}
    {notice?<Copy>{notice}</Copy>:null}
    {report?<Card><Field label={t("신고 사유")} value={reason} onChange={setReason} disabled={busy}/><Row><Button disabled={busy} onPress={()=>setReport(null)}>{t("취소")}</Button><Button disabled={busy||!reason.trim()} onPress={()=>void run(async()=>{await api(`/api/homes/${encodeURIComponent(ownerId)}/reports`,{method:'POST',body:JSON.stringify({...report,reason})});setReport(null);setReason('');setNotice(t("신고를 접수했어요. 신고만으로 계정이 정지되지는 않아요."));})}>{t("신고 보내기")}</Button></Row></Card>:null}
  </ScrollView></KeyboardAvoidingView>;
}

function NativeBoard({data,act,busy,install,report,block}:{data:HomeData;install:()=>Promise<void>;report:(target:{kind:string;id:string})=>void;block:(id:string)=>Promise<void>}&HomeActions) {
  const [body,setBody]=useState(''),[kind,setKind]=useState<'guestbook'|'answer'>('guestbook'),[extra,setExtra]=useState<HomeEntry[]>([]),[cursor,setCursor]=useState(data.nextCursor),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [replyId,setReplyId]=useState(''),[reply,setReply]=useState(''),[translations,setTranslations]=useState<Record<string,string>>({});
  const nonce=useRef('');
  useEffect(()=>{setExtra([]);setCursor(data.nextCursor);},[data]);
  const rows=[...data.entries,...extra.filter(row=>!data.entries.some(item=>item.id===row.id))].sort((a,b)=>Number(b.id===data.settings.pinnedId)-Number(a.id===data.settings.pinnedId));
  const installed=normalizeRoom(data.roomConfig).items.some(item=>item.id==='whiteboard');
  const more=async()=>{if(loading||!cursor)return;setLoading(true);try{const value=await api<{items:HomeEntry[];nextCursor:string|null}>(`/api/homes/${encodeURIComponent(data.owner.id)}/entries?cursor=${encodeURIComponent(cursor)}`);setExtra([...extra,...value.items]);setCursor(value.nextCursor);}catch(e){setError(errorText(e));}finally{setLoading(false);}};
  const translate=async(entry:HomeEntry)=>{if(loading)return;setLoading(true);try{const result=await api<{translatedText:string}>('/api/translate',{method:'POST',body:JSON.stringify({text:entry.text,targetLanguage:currentLocaleSnapshot()})});setTranslations({...translations,[entry.id]:result.translatedText});}catch(e){setError(errorText(e));}finally{setLoading(false);}};
  return <View style={{gap:16}}>
    {error?<Copy>{error}</Copy>:null}
    {!installed?data.own?<Button disabled={busy} onPress={()=>void install()}>{t("화이트보드 설치")}</Button>:<Copy>{t("아직 방명록을 받지 않는 집이에요.")}</Copy>:null}
    {data.settings.question?<Card><Copy>{t("오늘의 질문")}</Copy><Copy>{data.settings.question}</Copy></Card>:null}
    {installed?<Card><Row><Button selected={kind==='guestbook'} onPress={()=>{setKind('guestbook');nonce.current='';}}>{t("방명록")}</Button>{data.settings.question?<Button selected={kind==='answer'} onPress={()=>{setKind('answer');nonce.current='';}}>{t("질문에 답하기")}</Button>:null}</Row>
      <Field label={t("방명록 남기기")} value={body} disabled={busy||!data.canWrite} onChange={value=>{setBody(value);nonce.current='';}}/>
      <Copy>{t("하루 20개까지, 15초 간격으로 작성할 수 있어요.")}</Copy>
      <Button disabled={busy||!data.canWrite||!body.trim()} onPress={()=>{if(!nonce.current)nonce.current=Crypto.randomUUID();void act('/entries','POST',{text:body,kind,requestId:nonce.current}).then(ok=>{if(ok){setBody('');nonce.current='';}});}}>{t("남기기")}</Button>
      {!data.canWrite?<Copy>{t("집주인이 허용한 사람만 글과 선물을 남길 수 있어요.")}</Copy>:null}</Card>:null}
    {rows.map(entry=><Card key={entry.id}><Copy>{entry.author?.name||t("알 수 없는 상대")} · {entry.createdAt.slice(0,10)} {entry.id===data.settings.pinnedId?t("고정됨"):''}</Copy>{entry.question?<Copy>{entry.question}</Copy>:null}<Copy>{entry.text}</Copy>{translations[entry.id]?<Copy>{translations[entry.id]}</Copy>:null}
      <Row><Button selected={entry.hearted} disabled={busy} onPress={()=>void act(`/entries/${entry.id}`,'PATCH',{hearted:!entry.hearted})}>♡ {entry.heartCount}</Button><Button disabled={loading} onPress={()=>void translate(entry)}>{t("번역")}</Button>
        {data.own?<><Button disabled={busy} onPress={()=>void act('/settings','PATCH',{pinnedId:data.settings.pinnedId===entry.id?'':entry.id})}>{data.settings.pinnedId===entry.id?t("고정 해제"):t("고정")}</Button><Button disabled={busy} onPress={()=>{setReplyId(entry.id);setReply(entry.reply?.text||'');}}>{t("답글")}</Button></>:null}
        {data.own||entry.authorId===data.viewerId?<Button disabled={busy} onPress={()=>confirm(()=>void act(`/entries/${entry.id}`,'DELETE'))}>{t("삭제")}</Button>:null}
        {entry.authorId!==data.viewerId?<><Button onPress={()=>report({kind:'entry',id:entry.id})}>{t("신고")}</Button><Button disabled={busy} onPress={()=>confirm(()=>void block(entry.authorId),t("이 사용자를 차단할까요?"))}>{t("차단")}</Button></>:null}</Row>
      {entry.reply?<Card><Copy>{t("집주인 답글")}</Copy><Copy>{entry.reply.text}</Copy>{!data.own?<Button onPress={()=>report({kind:'reply',id:entry.id})}>{t("답글 신고")}</Button>:null}</Card>:null}
      {replyId===entry.id?<><Field label={t("답글")} value={reply} onChange={setReply} disabled={busy}/><Row><Button onPress={()=>setReplyId('')}>{t("취소")}</Button><Button disabled={busy} onPress={()=>void act(`/entries/${entry.id}`,'PATCH',{reply}).then(ok=>{if(ok)setReplyId('');})}>{t("답글 저장")}</Button></Row></>:null}
    </Card>)}
    {!rows.length?<Copy>{t("첫 번째 인사를 남겨보세요.")}</Copy>:null}{cursor?<Button disabled={busy||loading} onPress={()=>void more()}>{t("더 보기")}</Button>:null}
  </View>;
}

function NativeSettings({value,busy,act}:{value:HomeSettings}&HomeActions) {
  const [draft,setDraft]=useState(value);
  return <Card><Choices label={t("집 공개 범위")} values={HOME_SCOPES} value={draft.visibility} onChange={visibility=>setDraft({...draft,visibility})} labels={scopeLabels()} disabled={busy}/><Choices label={t("글과 선물을 남길 수 있는 사람")} values={HOME_SCOPES} value={draft.writing} onChange={writing=>setDraft({...draft,writing})} labels={scopeLabels()} disabled={busy}/>
    <Choices label={t("집주인 상태")} values={HOME_STATUSES} value={draft.status} onChange={status=>setDraft({...draft,status})} labels={Object.fromEntries(HOME_STATUSES.map(key=>[key,t(HOME_STATUS_LABELS[key])])) as Record<HomeSettings['status'],string>} disabled={busy}/>
    <Copy>{t("방문자 이름과 인사를 방문객에게 공개")}</Copy><Switch accessibilityLabel={t("방문자 이름과 인사를 방문객에게 공개")} disabled={busy} value={draft.showVisitors} onValueChange={showVisitors=>setDraft({...draft,showVisitors})}/>
    <Field label={t("오늘의 질문")} value={draft.question} onChange={question=>setDraft({...draft,question})} max={200} disabled={busy}/><Copy>{t("질문을 바꿔도 이전 답변에는 당시 질문이 남아요.")}</Copy>
    <Button disabled={busy||JSON.stringify(draft)===JSON.stringify(value)} onPress={()=>void act('/settings','PATCH',draft)}>{t("집 설정 저장")}</Button>
  </Card>;
}

function NativeGifts({data,busy,act,report}:{data:HomeData;report:(target:{kind:string;id:string})=>void}&HomeActions) {
  const [gift,setGift]=useState<typeof HOME_GIFTS[number]>('wave'),[note,setNote]=useState('');
  return <View style={{gap:16}}>{!data.own?<Card><Copy>{t("하루 한 번, 가벼운 인사")}</Copy><Row>{HOME_GIFTS.map(item=><Button key={item} selected={gift===item} disabled={busy||data.stampedToday} onPress={()=>setGift(item)}>{HOME_GIFT_ICONS[item]} {t(HOME_GIFT_LABELS[item])}</Button>)}</Row><Field label={t("선물에 담을 말")} value={note} onChange={setNote} max={160} disabled={busy||data.stampedToday}/><Button disabled={busy||data.stampedToday||!data.canWrite} onPress={()=>void act('/stamp','POST',{gift,note})}>{data.stampedToday?t("오늘 인사를 남겼어요"):t("무료로 인사 보내기")}</Button>{!data.canWrite?<Copy>{t("집주인이 허용한 사람만 글과 선물을 남길 수 있어요.")}</Copy>:null}</Card>:null}
    {!data.own&&!data.settings.showVisitors?<Copy>{t("방문 기록은 집주인만 볼 수 있어요.")}</Copy>:null}
    {data.visitors.map(stamp=><Card key={stamp.id}><Copy>{HOME_GIFT_ICONS[stamp.gift]} {stamp.author?.name||t("알 수 없는 상대")} · {stamp.day}</Copy><Copy>{stamp.note||t(HOME_GIFT_LABELS[stamp.gift])}</Copy><Row>{data.own&&stamp.gift!=='wave'?<Button disabled={busy} onPress={()=>void act('/settings','PATCH',{displayedGiftId:stamp.id})}>{t("전시하기")}</Button>:null}<Button onPress={()=>report({kind:'stamp',id:stamp.id})}>{t("신고")}</Button></Row></Card>)}
    {data.own&&!data.visitors.length?<Copy>{t("아직 받은 인사나 선물이 없어요.")}</Copy>:null}
  </View>;
}

function NativePhotos({data,busy,act,install,report}:{data:HomeData;install:(id:RoomItemId)=>Promise<void>;report:(target:{kind:string;id:string})=>void}&HomeActions) {
  const [selected,setSelected]=useState<HomePhoto['id']>('frame'),[draft,setDraft]=useState<HomePhoto|null>(null),[error,setError]=useState(''),[processing,setProcessing]=useState(false),[large,setLarge]=useState<HomePhoto|null>(null);
  const saved=data.photos.find(photo=>photo.id===selected),current=draft||saved||{id:selected,image:'',caption:'',visibility:'everyone' as const,shape:'square' as const,color:'oak' as const};
  const update=(patch:Partial<HomePhoto>)=>setDraft({...current,...patch});const disabled=busy||processing;
  const choose=async()=>{if(disabled)return;setProcessing(true);setError('');try{const picked=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:false,quality:1});if(picked.canceled)return;const asset=picked.assets[0];if((asset.fileSize||0)>12000000)throw new Error(t("12MB 이하의 JPG, PNG, WebP 사진을 골라주세요."));const context=ImageManipulator.manipulate(asset.uri);if(Math.max(asset.width,asset.height)>960)context.resize(asset.width>=asset.height?{width:960}:{height:960});const rendered=await context.renderAsync();const result=await rendered.saveAsync({format:SaveFormat.JPEG,compress:.72,base64:true});if(!result.base64||result.base64.length>519970)throw new Error(t("사진을 줄여도 너무 커요. 다른 사진을 골라주세요."));update({image:`data:image/jpeg;base64,${result.base64}`});}catch(e){setError(errorText(e));}finally{setProcessing(false);}};
  return <View style={{gap:16}}>{data.photos.map(photo=><Card key={photo.id}><Pressable accessibilityRole="button" accessibilityLabel={photo.caption||t(HOME_FRAME_LABELS[photo.id])} onPress={()=>setLarge(photo)}><Image source={{uri:photo.image}} style={{height:200,width:'100%',borderRadius:12}} resizeMode="contain"/></Pressable><Copy>{photo.caption}</Copy>{!data.own?<Button onPress={()=>report({kind:'photo',id:photo.id})}>{t("신고")}</Button>:null}</Card>)}
    {!data.photos.length?<Copy>{t("아직 걸어둔 사진이 없어요.")}</Copy>:null}
    {large?<Card><Image source={{uri:large.image}} style={{width:'100%',height:420}} resizeMode="contain"/><Copy>{large.caption}</Copy><Button onPress={()=>setLarge(null)}>{t("큰 사진 닫기")}</Button></Card>:null}
    {data.own?<Card><Choices label={t("꾸밀 액자")} values={HOME_FRAMES} value={selected} onChange={value=>{setSelected(value);setDraft(null);}} labels={Object.fromEntries(HOME_FRAMES.map(key=>[key,t(HOME_FRAME_LABELS[key])])) as Record<HomePhoto['id'],string>} disabled={disabled}/>
      {!normalizeRoom(data.roomConfig).items.some(item=>item.id===selected)?<><Copy>{t("사진을 방 안에 보이게 하려면 액자를 설치해 주세요.")}</Copy><Button disabled={disabled} onPress={()=>void install(selected)}>{t("액자 설치")}</Button></>:null}
      <Button disabled={disabled} onPress={()=>void choose()}>{processing?t("처리 중…"):t("사진 고르기")}</Button>
      {current.image?<Image accessibilityLabel={t("사진 미리보기")} source={{uri:current.image}} style={{width:'100%',height:200}} resizeMode="contain"/>:null}
      <Field label={t("사진 설명")} value={current.caption} onChange={caption=>update({caption})} max={160} disabled={disabled}/>
      <Choices label={t("액자 모양")} values={['square','portrait','landscape'] as const} value={current.shape} onChange={shape=>update({shape})} labels={{square:t(HOME_SHAPE_LABELS.square),portrait:t(HOME_SHAPE_LABELS.portrait),landscape:t(HOME_SHAPE_LABELS.landscape)}} disabled={disabled}/>
      <Choices label={t("액자 색상")} values={['oak','white','black','rose'] as const} value={current.color} onChange={color=>update({color})} labels={{oak:t(HOME_COLOR_LABELS.oak),white:t(HOME_COLOR_LABELS.white),black:t(HOME_COLOR_LABELS.black),rose:t(HOME_COLOR_LABELS.rose)}} disabled={disabled}/>
      <Choices label={t("사진 공개 범위")} values={HOME_SCOPES} value={current.visibility} onChange={visibility=>update({visibility})} labels={scopeLabels()} disabled={disabled}/>
      {error?<Copy>{error}</Copy>:null}<Copy>{t("사진 위치 정보는 제거하고 최대 960px로 저장해요.")}</Copy>
      <Row>{saved?<Button disabled={disabled} onPress={()=>confirm(()=>void act(`/photos/${selected}`,'DELETE').then(ok=>{if(ok)setDraft(null);}))}>{t("사진 삭제")}</Button>:null}<Button disabled={disabled||!current.image} onPress={()=>void act(`/photos/${selected}`,'PUT',{image:current.image,caption:current.caption,visibility:current.visibility,shape:current.shape,color:current.color}).then(ok=>{if(ok)setDraft(null);})}>{t("액자 저장")}</Button></Row>
    </Card>:null}
  </View>;
}
