"use client";
/* Local SVG thumbnails do not need image optimization. */
/* eslint-disable @next/next/no-img-element */
/* The room is a keyboard-controlled application surface, not a single button.
   Arrow-key navigation and the alternative furniture list are provided below. */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
import { useEffect, useState } from 'react';
import { useRoomLife } from '../lib/use-room-life';
import { ROOM_ITEMS, ROOM_WALLS, ROOM_FLOORS, WALL_COLOURS, FLOOR_COLOURS, addRoomItem, normalizeRoom, roomCell, renderRoomSvg, roomItemDataUri, type RoomConfig, type RoomItemId } from '../lib/room';
import type { HomeData } from '../lib/home';
import { ROOM_LABELS } from '../lib/room-labels';
import { t } from '../lib/i18n';
import { RoomCanvas } from './RoomCanvas';

export function RoomPlayground({data,busy,onSave,onObject,onDirtyChange,visitorAvatar}:{data:HomeData;busy:boolean;onSave:(room:RoomConfig)=>Promise<boolean>;onObject:(id:RoomItemId)=>void;onDirtyChange:(dirty:boolean)=>void;visitorAvatar?:unknown}) {
  const room=normalizeRoom(data.roomConfig);
  const [editing,setEditing]=useState(false),[draft,setDraft]=useState(room),[selected,setSelected]=useState<RoomItemId|null>(null),[error,setError]=useState(''),[discard,setDiscard]=useState(false);
  const dirty=editing&&JSON.stringify(draft)!==JSON.stringify(room);
  useEffect(()=>onDirtyChange(dirty),[dirty,onDirtyChange]);
  const toggleEditor=()=>{life.reset();setSelected(null);setDraft(room);setEditing(!editing);setDiscard(false);};
  const life=useRoomLife(room,id=>{setSelected(id);if(id==='whiteboard'||id.startsWith('frame'))onObject(id);},()=>setError(t("가구에 막혀 갈 수 없어요. 통로를 비워주세요.")));
  const chosen=room.items.find(item=>item.id===selected);
  const interact=(id:RoomItemId)=>{setError('');setSelected(null);life.travel(id);};
  const change=(value:RoomConfig)=>{setDraft(value);setError('');};
  const action=()=>{if(!chosen)return;life.pose(chosen.id==='sofa'?'sit':chosen.id==='bed'?'sleep':chosen.id==='speaker'?'dance':'stand',chosen.id);};
  const label=chosen?.id==='sofa'?t("앉기"):chosen?.id==='bed'?t("눕기"):chosen?.id==='speaker'?t("춤추기"):chosen?.id==='plant'||chosen?.id==='flowers'?t("물 주기"):chosen?.id==='lamp'?t("불 켜기"):chosen?.id==='cat'?t("쓰다듬기"):t("살펴보기");
  return <section className="room-playground">
    {discard?<div className="home-confirm" role="alert"><p>{t("저장하지 않은 변경 사항이 있어요. 나갈까요?")}</p><button type="button" onClick={()=>setDiscard(false)}>{t("취소")}</button><button type="button" onClick={toggleEditor}>{t("확인")}</button></div>:null}
    <div className="room-play-tools">{data.own?<button type="button" disabled={busy} onClick={()=>dirty?setDiscard(true):toggleEditor()}>{editing?t("취소"):t("가구 배치")}</button>:null}
      {editing?<button type="button" className="primary-button" disabled={busy} onClick={()=>void onSave(draft).then(ok=>{if(ok){setEditing(false);setSelected(null);life.reset();}})}>{t("배치 저장")}</button>:<span>{t("바닥을 누르면 이동하고, 가구를 누르면 다가가요.")}</span>}
    </div>
    {editing?<RoomCanvas value={draft} avatar={data.owner.avatarConfig} photos={data.photos} selected={selected} disabled={busy} onSelect={setSelected} onChange={change} onBlocked={()=>setError(t("여기에는 놓을 수 없어요"))}/>:<div className="room-play-canvas" role="application" tabIndex={0} aria-label={t("방 안 이동")} onKeyDown={event=>{if(busy)return;const delta:Record<string,[number,number]>={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};const d=delta[event.key];if(d&&!life.actor.walking){event.preventDefault();setSelected(null);life.travel({x:Math.round(life.actor.x)+d[0],y:Math.round(life.actor.y)+d[1]});}}} onClick={event=>{if(busy)return;const id=(event.target as Element).closest('[data-room-item]')?.getAttribute('data-room-item') as RoomItemId|null;if(id&&id!=='rug'){interact(id);return;}const bounds=event.currentTarget.getBoundingClientRect();const cell=roomCell((event.clientX-bounds.left)*600/bounds.width,(event.clientY-bounds.top)*460/bounds.height);setError('');setSelected(null);life.travel(cell);}}>
      <div aria-hidden="true" dangerouslySetInnerHTML={{__html:renderRoomSvg(room,data.own?data.owner.avatarConfig:visitorAvatar,selected,data.photos,life.actor)}}/>
    </div>}
    <p className="home-hint" role="status">{error|| (life.actor.walking?t("이동 중…"):editing?t("가구를 직접 끌어 옮겨보세요. 작은 소품은 아래 목록에서 선택할 수 있어요."):t("가구를 눌러 상호작용해 보세요."))}</p>
    {editing?<>
      {selected?<div className="room-object-actions"><strong>{t(ROOM_LABELS[selected])}</strong><button type="button" disabled={busy} onClick={()=>change({...draft,items:draft.items.map(item=>item.id===selected?{...item,flipped:!item.flipped}:item)})}>{t("방향 바꾸기")}</button><button type="button" disabled={busy} onClick={()=>{change({...draft,items:draft.items.filter(item=>item.id!==selected)});setSelected(null);}}>{t("가구 치우기")}</button></div>:null}
      <details className="room-style-controls"><summary>{t("벽")} · {t("바닥")}</summary><div role="group" aria-label={t("벽")}>{ROOM_WALLS.map(id=><button type="button" key={id} disabled={busy} aria-pressed={draft.wall===id} onClick={()=>change({...draft,wall:id})}><span style={{background:WALL_COLOURS[id]}}/>{t(ROOM_LABELS[id])}</button>)}</div><div role="group" aria-label={t("바닥")}>{ROOM_FLOORS.map(id=><button type="button" key={id} disabled={busy} aria-pressed={draft.floor===id} onClick={()=>change({...draft,floor:id})}><span style={{background:FLOOR_COLOURS[id]}}/>{t(ROOM_LABELS[id])}</button>)}</div></details><div className="room-furniture-tray">{ROOM_ITEMS.map(id=><button type="button" key={id} disabled={busy} aria-pressed={selected===id} onClick={()=>{const next=addRoomItem(draft,id);change(next);setSelected(id);}}>
        <img src={roomItemDataUri(id)} alt=""/>{t(ROOM_LABELS[id])}{draft.items.some(item=>item.id===id)?' ✓':''}
      </button>)}</div>
    </>:chosen&&!life.actor.walking?<div className="room-object-actions"><strong>{t(ROOM_LABELS[chosen.id])}</strong>{chosen.id==='whiteboard'||chosen.id.startsWith('frame')?<button type="button" onClick={()=>onObject(chosen.id)}>{chosen.id==='whiteboard'?t("방명록 남기기"):data.own?t("사진 넣기"):t("사진 보기")}</button>:<button type="button" onClick={action}>{label}</button>}<button type="button" onClick={()=>{life.pose('stand');setSelected(null);}}>{t("일어나기")}</button></div>:null}
    {!editing?<details className="room-accessible-items"><summary>{t("가구 선택")}</summary><div className="home-tabs">{room.items.map(item=><button type="button" key={item.id} disabled={busy} onClick={()=>interact(item.id)}>{t(ROOM_LABELS[item.id])}</button>)}</div></details>:null}
  </section>;
}
