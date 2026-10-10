import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useRoomLife } from '@shared/use-room-life';
import { hitRoomItem } from '@shared/room-life';
import { normalizeRoom, renderRoomSvg, roomCell, type RoomItemId } from '@shared/room';
import { ROOM_LABELS } from '@shared/room-labels';
import type { HomeData } from '@shared/home';
import { t } from '../lib/i18n';
import { useTheme } from '../lib/useTheme';

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
      <View pointerEvents="none" style={{flex:1}}><SvgXml xml={renderRoomSvg(room,data.own?data.owner.avatarConfig:visitorAvatar,selected,data.photos,life.actor)} width="100%" height="100%"/></View>
    </View>
    <Text accessibilityLiveRegion="polite" style={{color:c.muted}}>{error|| (life.actor.walking?t("이동 중…"):t("가구를 눌러 상호작용해 보세요."))}</Text>
    {chosen&&!life.actor.walking?<View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{button(chosen.id==='whiteboard'?t("방명록 남기기"):chosen.id.startsWith('frame')?(data.own?t("사진 넣기"):t("사진 보기")):label,()=>chosen.id==='whiteboard'||chosen.id.startsWith('frame')?onObject(chosen.id):action())}{button(t("일어나기"),()=>{life.pose('stand');setSelected(null);})}</View>:null}
    {button(t("가구 선택"),()=>setShowItems(!showItems))}{showItems?<View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{room.items.map(item=>button(t(ROOM_LABELS[item.id]),()=>interact(item.id),item.id))}</View>:null}
  </View>;
}
