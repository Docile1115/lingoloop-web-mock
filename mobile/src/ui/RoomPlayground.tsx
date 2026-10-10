import { memo, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useRoomLife } from '@shared/use-room-life';
import { hitRoomItem } from '@shared/room-life';
import { normalizeRoom, renderRoomSvg, roomCell, roomPoint, type RoomItemId } from '@shared/room';
import { ROOM_LABELS } from '@shared/room-labels';
import type { HomeData } from '@shared/home';
import { t } from '../lib/i18n';
import { useTheme } from '../lib/useTheme';

/** 같은 그림이면 다시 그리지 않습니다. 캐릭터가 걷는 동안 방과 가구 층은 그대로 둡니다. */
const Layer=memo(function Layer({xml}:{xml:string}){return <SvgXml xml={xml} width="100%" height="100%"/>;});

/**
 * renderRoomSvg 가 그린 한 장을 캐릭터 뒤(방·뒤쪽 가구), 캐릭터, 캐릭터 앞(앞쪽 가구) 세 장으로 나눕니다.
 * 예전에는 캐릭터가 걷는 동안 24ms 마다 방 전체(액자 사진 포함)를 다시 만들고 다시 읽었습니다.
 * 이제 걷는 동안에는 캐릭터 층만 옮기고, 가구 앞뒤가 바뀌는 줄을 넘을 때만 다시 나눕니다.
 * 공유 그리기 함수(@shared/room)는 그대로 두고, 그 결과에서 캐릭터 묶음을 찾아 자릅니다.
 */
function splitRoom(svg:string):{back:string;resident:string;front:string}|null {
  const start=svg.indexOf('<g data-room-resident="true"');
  if(start<0)return null;
  // 가구 묶음은 모두 data-room-item 으로 시작합니다. 캐릭터 그림 안에는 이 표시가 없습니다.
  const next=svg.indexOf('<g data-room-item="',start),close=svg.lastIndexOf('</svg>');
  const end=next>=0?next:close;
  const open=svg.slice(0,svg.indexOf('>')+1);
  return {back:svg.slice(0,start)+'</svg>',resident:open+svg.slice(start,end)+'</svg>',front:open+svg.slice(end)};
}

/**
 * 2D 방은 읽기 전용 그림입니다. 웹이 3D 방만 보여주게 되면서 가구 배치는 웹(3D)에서만 합니다 —
 * 여기서 2D 배치를 고쳐도 웹에는 보이지 않으므로 편집 입구를 두지 않습니다.
 * 바닥·가구를 눌러 캐릭터를 움직이는 놀이는 그대로 둡니다.
 */
export function NativeRoomPlayground({data,busy,onObject,visitorAvatar}:{data:HomeData;busy:boolean;onObject:(id:RoomItemId)=>void;visitorAvatar?:unknown}) {
  const c=useTheme(),room=normalizeRoom(data.roomConfig);
  const [selected,setSelected]=useState<RoomItemId|null>(null),[error,setError]=useState(''),[width,setWidth]=useState(320),[showItems,setShowItems]=useState(false);
  const gesture=useRef<{id:RoomItemId|null}|null>(null);
  const life=useRoomLife(room,id=>{setSelected(id);if(id==='whiteboard'||id.startsWith('frame'))onObject(id);},()=>setError(t("가구에 막혀 갈 수 없어요. 통로를 비워주세요.")));
  const actor=life.actor,avatar=data.own?data.owner.avatarConfig:visitorAvatar;
  // renderRoomSvg 와 같은 규칙: 앉거나 누우면 그 가구 자리에, 아니면 캐릭터 자리에 그립니다.
  const active=room.items.find(item=>item.id===actor.activeItem);
  const spot=((actor.pose==='sit'&&active?.id==='sofa')||(actor.pose==='sleep'&&active?.id==='bed'))&&active?active:actor;
  // 가구 깊이는 정수(x+y)이고 캐릭터는 x+y+.15 입니다. 이 값의 정수 부분이 바뀔 때만 앞뒤가 바뀝니다.
  const depth=Math.floor(spot.x+spot.y+.15);
  const scene=useMemo(()=>{const svg=renderRoomSvg(room,avatar,selected,data.photos,actor);return {svg,parts:splitRoom(svg),at:roomPoint(spot.x,spot.y)};},
    // 걷는 동안 바뀌는 위치(actor.x·y)는 일부러 넣지 않습니다 — 위치는 아래에서 캐릭터 층을 옮겨 맞춥니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.roomConfig,data.photos,avatar,selected,depth,actor.pose,actor.activeItem,actor.walking]);
  const now=roomPoint(spot.x,spot.y),scale=width/600;
  const shift={transform:[{translateX:(now.x-scene.at.x)*scale},{translateY:(now.y-scene.at.y)*scale}]};
  const interact=(id:RoomItemId)=>{setError('');setSelected(null);life.travel(id);};
  const button=(label:string,action:()=>void,key=label)=><Pressable key={key} accessibilityRole="button" disabled={busy} onPress={action} style={{minHeight:44,padding:12,borderRadius:12,borderWidth:1,borderColor:c.line,backgroundColor:c.surface,justifyContent:'center',opacity:busy?.4:1}}><Text style={{color:c.ink}}>{label}</Text></Pressable>;
  const chosen=room.items.find(item=>item.id===selected);
  const action=()=>{if(!chosen)return;life.pose(chosen.id==='sofa'?'sit':chosen.id==='bed'?'sleep':chosen.id==='speaker'?'dance':'stand',chosen.id);};
  const label=chosen?.id==='sofa'?t("앉기"):chosen?.id==='bed'?t("눕기"):chosen?.id==='speaker'?t("춤추기"):chosen?.id==='plant'||chosen?.id==='flowers'?t("물 주기"):chosen?.id==='lamp'?t("불 켜기"):chosen?.id==='cat'?t("쓰다듬기"):t("살펴보기");
  return <View style={{gap:12}}>
    <Text style={{color:c.muted}}>{t("바닥을 누르면 이동하고, 가구를 누르면 다가가요.")}</Text>
    <View onLayout={event=>setWidth(event.nativeEvent.layout.width)} style={{width:'100%',aspectRatio:600/460}} onStartShouldSetResponder={()=>!busy}
      onResponderGrant={event=>{const e=event.nativeEvent;gesture.current={id:hitRoomItem(room,{x:e.locationX*600/width,y:e.locationY*600/width})};}}
      onResponderRelease={event=>{const g=gesture.current;gesture.current=null;if(!g||busy)return;if(g.id)interact(g.id);else{setSelected(null);setError('');life.travel(roomCell(event.nativeEvent.locationX*600/width,event.nativeEvent.locationY*600/width));}}}
      onResponderTerminate={()=>{gesture.current=null;}}>
      <View pointerEvents="none" style={{flex:1}}>{scene.parts?<>
        <View style={StyleSheet.absoluteFill}><Layer xml={scene.parts.back}/></View>
        <View style={[StyleSheet.absoluteFill,shift]}><Layer xml={scene.parts.resident}/></View>
        <View style={StyleSheet.absoluteFill}><Layer xml={scene.parts.front}/></View>
      </>:<Layer xml={scene.svg}/>}</View>
    </View>
    <Text accessibilityLiveRegion="polite" style={{color:c.muted}}>{error|| (life.actor.walking?t("이동 중…"):t("가구를 눌러 상호작용해 보세요."))}</Text>
    {chosen&&!life.actor.walking?<View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{button(chosen.id==='whiteboard'?t("방명록 남기기"):chosen.id.startsWith('frame')?(data.own?t("사진 넣기"):t("사진 보기")):label,()=>chosen.id==='whiteboard'||chosen.id.startsWith('frame')?onObject(chosen.id):action())}{button(t("일어나기"),()=>{life.pose('stand');setSelected(null);})}</View>:null}
    {button(t("가구 선택"),()=>setShowItems(!showItems))}{showItems?<View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{room.items.map(item=>button(t(ROOM_LABELS[item.id]),()=>interact(item.id),item.id))}</View>:null}
  </View>;
}
