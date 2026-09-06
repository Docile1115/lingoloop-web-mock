import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useRoomLife } from '@shared/use-room-life';
import { hitRoomItem } from '@shared/room-life';
import { ROOM_ITEMS, ROOM_WALLS, ROOM_FLOORS, addRoomItem, canPlaceRoomItem, moveRoomItem, normalizeRoom, renderRoomSvg, roomCell, roomPoint, roomItemSvg, type RoomConfig, type RoomItemId } from '@shared/room';
import { ROOM_LABELS } from '@shared/room-labels';
import type { HomeData } from '@shared/home';
import { t } from '../lib/i18n';
import { useTheme } from '../lib/useTheme';

export function NativeRoomPlayground({data,busy,onSave,onObject,onDirtyChange,onDragChange,visitorAvatar}:{data:HomeData;busy:boolean;onSave:(room:RoomConfig)=>Promise<boolean>;onObject:(id:RoomItemId)=>void;onDirtyChange:(dirty:boolean)=>void;onDragChange:(dragging:boolean)=>void;visitorAvatar?:unknown}) {
  const c=useTheme(),room=normalizeRoom(data.roomConfig);
  const [editing,setEditing]=useState(false),[draft,setDraft]=useState(room),[selected,setSelected]=useState<RoomItemId|null>(null),[error,setError]=useState(''),[width,setWidth]=useState(320),[showItems,setShowItems]=useState(false);
  const dirty=editing&&JSON.stringify(draft)!==JSON.stringify(room);
  useEffect(()=>onDirtyChange(dirty),[dirty,onDirtyChange]);
  const gesture=useRef<{id:RoomItemId|null;x:number;y:number;pageX:number;pageY:number;moved:boolean;snapshot:RoomConfig}|null>(null);
  const life=useRoomLife(room,id=>{setSelected(id);if(id==='whiteboard'||id.startsWith('frame'))onObject(id);},()=>setError(t("가구에 막혀 갈 수 없어요. 통로를 비워주세요.")));
  const toggleEditor=()=>{const change=()=>{life.reset();setDraft(room);setSelected(null);setEditing(!editing);};if(editing&&JSON.stringify(draft)!==JSON.stringify(room))Alert.alert(t("저장하지 않은 변경 사항이 있어요. 나갈까요?"),'',[{text:t("취소"),style:'cancel'},{text:t("확인"),onPress:change}]);else change();};
  const interact=(id:RoomItemId)=>{setError('');setSelected(null);life.travel(id);};
  const button=(label:string,action:()=>void,key=label)=><Pressable key={key} accessibilityRole="button" disabled={busy} onPress={action} style={{minHeight:44,padding:12,borderRadius:12,borderWidth:1,borderColor:c.line,backgroundColor:c.surface,justifyContent:'center',opacity:busy?.4:1}}><Text style={{color:c.ink}}>{label}</Text></Pressable>;
  const chosen=room.items.find(item=>item.id===selected);
  const action=()=>{if(!chosen)return;life.pose(chosen.id==='sofa'?'sit':chosen.id==='bed'?'sleep':chosen.id==='speaker'?'dance':'stand',chosen.id);};
  const label=chosen?.id==='sofa'?t("앉기"):chosen?.id==='bed'?t("눕기"):chosen?.id==='speaker'?t("춤추기"):chosen?.id==='plant'||chosen?.id==='flowers'?t("물 주기"):chosen?.id==='lamp'?t("불 켜기"):chosen?.id==='cat'?t("쓰다듬기"):t("살펴보기");
  return <View style={{gap:12}}><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{data.own?button(editing?t("취소"):t("가구 배치"),toggleEditor):null}{editing?button(t("배치 저장"),()=>void onSave(draft).then(ok=>{if(ok){setEditing(false);setSelected(null);life.reset();}})):null}</View>
    <Text style={{color:c.muted}}>{editing?t("가구를 직접 끌어 옮겨보세요. 작은 소품은 아래 목록에서 선택할 수 있어요."):t("바닥을 누르면 이동하고, 가구를 누르면 다가가요.")}</Text>
    <View onLayout={event=>setWidth(event.nativeEvent.layout.width)} style={{width:'100%',aspectRatio:600/460}} onStartShouldSetResponder={()=>!busy} onResponderTerminationRequest={()=>false}
      onResponderGrant={event=>{const e=event.nativeEvent,point={x:e.locationX*600/width,y:e.locationY*600/width},id=hitRoomItem(editing?draft:room,point,editing),item=draft.items.find(row=>row.id===id);gesture.current={id,x:item?.x||0,y:item?.y||0,pageX:e.pageX,pageY:e.pageY,moved:false,snapshot:draft};if(editing&&id){setSelected(id);onDragChange(true);}}}
      onResponderMove={event=>{const g=gesture.current;if(!g||!editing||!g.id)return;const dx=event.nativeEvent.pageX-g.pageX,dy=event.nativeEvent.pageY-g.pageY;if(Math.hypot(dx,dy)<8)return;g.moved=true;const origin=roomPoint(g.x,g.y),cell=roomCell(origin.x+dx*600/width,origin.y+dy*600/width);if(canPlaceRoomItem(draft,g.id,cell.x,cell.y)){setDraft(moveRoomItem(draft,g.id,cell.x,cell.y));setError('');}else setError(t("여기에는 놓을 수 없어요"));}}
      onResponderRelease={event=>{onDragChange(false);const g=gesture.current;gesture.current=null;if(!g||editing||busy)return;if(g.id)interact(g.id);else{setSelected(null);setError('');life.travel(roomCell(event.nativeEvent.locationX*600/width,event.nativeEvent.locationY*600/width));}}}
      onResponderTerminate={()=>{onDragChange(false);if(editing&&gesture.current)setDraft(gesture.current.snapshot);gesture.current=null;}}>
      <View pointerEvents="none" style={{flex:1}}><SvgXml xml={renderRoomSvg(editing?draft:room,data.own?data.owner.avatarConfig:visitorAvatar,selected,data.photos,editing?undefined:life.actor)} width="100%" height="100%"/></View>
    </View>
    <Text accessibilityLiveRegion="polite" style={{color:c.muted}}>{error|| (life.actor.walking?t("이동 중…"):t("가구를 눌러 상호작용해 보세요."))}</Text>
    {editing?<><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{selected?<>{button(t("방향 바꾸기"),()=>setDraft({...draft,items:draft.items.map(item=>item.id===selected?{...item,flipped:!item.flipped}:item)}))}{button(t("가구 치우기"),()=>{setDraft({...draft,items:draft.items.filter(item=>item.id!==selected)});setSelected(null);})}</>:null}</View><ScrollView horizontal contentContainerStyle={{gap:8}}>{ROOM_WALLS.map(id=>button(`${t("벽")} · ${t(ROOM_LABELS[id])}${draft.wall===id?' ✓':''}`,()=>setDraft({...draft,wall:id}),id))}{ROOM_FLOORS.map(id=>button(`${t("바닥")} · ${t(ROOM_LABELS[id])}${draft.floor===id?' ✓':''}`,()=>setDraft({...draft,floor:id}),id))}</ScrollView><ScrollView horizontal contentContainerStyle={{gap:8}}>{ROOM_ITEMS.map(id=><Pressable key={id} accessibilityRole="button" accessibilityLabel={t(ROOM_LABELS[id])} disabled={busy} onPress={()=>{setDraft(addRoomItem(draft,id));setSelected(id);}} style={{width:90,padding:8,borderWidth:1,borderColor:selected===id?c.primaryStrong:c.line,borderRadius:12}}><SvgXml xml={roomItemSvg(id)} width={72} height={64}/><Text style={{color:c.ink,fontSize:12}}>{t(ROOM_LABELS[id])}</Text></Pressable>)}</ScrollView></>:chosen&&!life.actor.walking?<View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{button(chosen.id==='whiteboard'?t("방명록 남기기"):chosen.id.startsWith('frame')?(data.own?t("사진 넣기"):t("사진 보기")):label,()=>chosen.id==='whiteboard'||chosen.id.startsWith('frame')?onObject(chosen.id):action())}{button(t("일어나기"),()=>{life.pose('stand');setSelected(null);})}</View>:null}
    {!editing?<>{button(t("가구 선택"),()=>setShowItems(!showItems))}{showItems?<View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{room.items.map(item=>button(t(ROOM_LABELS[item.id]),()=>interact(item.id),item.id))}</View>:null}</>:null}
  </View>;
}
