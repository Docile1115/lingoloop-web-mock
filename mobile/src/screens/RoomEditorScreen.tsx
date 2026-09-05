import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import {
  ROOM_ITEMS, ROOM_WALLS, ROOM_FLOORS, ROOM_PRESETS, FLOOR_COLOURS, WALL_COLOURS,
  addRoomItem, cellFree, copyRoom, moveRoomItem, normalizeRoom, roomItemSvg, type RoomConfig, type RoomItemId,
} from '@shared/room';
import { ROOM_LABELS, ROOM_PRESET_LABELS } from '@shared/room-labels';
import { t } from '../lib/i18n';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { RoomScene } from '../ui/RoomCard';

export function RoomEditorScreen({ onDone }: { onDone: () => void }) {
  const c = useTheme();
  const navigation = useNavigation();
  const scroller = useRef<ScrollView>(null);
  const { me, refresh } = useSession();
  const [initial] = useState(() => normalizeRoom(me?.roomConfig));
  const [draft,setDraft] = useState(() => normalizeRoom(me?.roomConfig));
  const [selected,setSelected] = useState<RoomItemId | null>(null);
  const [tab,setTab] = useState<'furniture' | 'style'>('furniture');
  const [busy,setBusy] = useState(false);
  const lock = useRef(false);
  const [error,setError] = useState('');
  const [leaveApproved,setLeaveApproved] = useState(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  const dirty = JSON.stringify(initial) !== JSON.stringify(draft);
  const chosen = draft.items.find((item) => item.id === selected);
  useEffect(() => {
    if (!leaveApproved) return;
    const leave = pendingLeave.current; pendingLeave.current = null; leave?.();
  },[leaveApproved]);
  usePreventRemove(!leaveApproved && (dirty || busy), ({data}) => {
    if (lock.current) return;
    Alert.alert(t("저장하지 않은 방 변경 내용을 버릴까요?"),undefined,[
      { text:t("계속 편집"),style:'cancel' },
      { text:t("변경 내용 버리기"),style:'destructive',onPress:() => { pendingLeave.current = () => navigation.dispatch(data.action); setLeaveApproved(true); } },
    ]);
  });
  const change = (next:RoomConfig) => { if (lock.current) return; setDraft(next); setError(''); };
  const save = useCallback(async () => {
    if (lock.current || !me) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await api('/api/profile/room',{method:'PATCH',body:JSON.stringify({config:draft})});
      await refresh();
      pendingLeave.current = onDone; setLeaveApproved(true);
    } catch { setError(t("방을 저장하지 못했어요. 다시 시도해 주세요.")); }
    finally { lock.current = false; setBusy(false); }
  },[draft,me,refresh,onDone]);
  return <SafeAreaView style={{flex:1,backgroundColor:c.bg}}>
    <View style={[s.header,{borderBottomColor:c.line}]}>
      <Pressable onPress={onDone} disabled={busy} accessibilityRole="button" style={s.action}><Text style={{color:c.muted}}>{t("취소")}</Text></Pressable>
      <Text style={{color:c.ink,fontSize:18,fontWeight:'700'}}>{t("나만의 작은 집")}</Text>
      <Pressable onPress={() => void save()} disabled={busy || (!dirty && !!me?.roomConfig)} accessibilityRole="button" style={s.action}>
        {busy ? <ActivityIndicator color={c.primaryStrong}/> : <Text style={{color:!dirty && !!me?.roomConfig ? c.subtle : c.primaryStrong,fontWeight:'700'}}>{t("저장")}</Text>}
      </Pressable>
    </View>
    <ScrollView ref={scroller} contentContainerStyle={{padding:16,gap:16}}>
      <View accessibilityRole="image" accessibilityLabel={t("{name}님의 마이룸",{name:me?.name ?? ''})}><RoomScene value={draft} avatar={me?.avatarConfig}/></View>
      {error ? <Text accessibilityRole="alert" style={{color:c.danger}}>{error}</Text> : null}
      <Text style={{color:c.muted,fontSize:13}}>{t("가구를 고르고 배치 칸을 눌러 옮겨보세요.")}</Text>
      {chosen ? <View style={[s.panel,{borderColor:c.line}]}>
        <View style={s.row}><Text style={{color:c.ink,fontWeight:'700',flex:1}}>{t(ROOM_LABELS[chosen.id])}</Text>
          <Pressable accessibilityRole="button" disabled={busy} style={[s.action,{backgroundColor:c.sunken,borderRadius:10}]} onPress={() => change({...draft,items:draft.items.map((item) => item.id===chosen.id ? {...item,flipped:!item.flipped} : item)})}><Text style={{color:c.ink,fontSize:12}}>{t("방향 바꾸기")}</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={busy} style={s.action} onPress={() => {change({...draft,items:draft.items.filter((item) => item.id!==chosen.id)});setSelected(null);}}><Text style={{color:c.danger,fontSize:12}}>{t("가구 치우기")}</Text></Pressable>
        </View>
        <View style={s.cells} accessibilityLabel={t("가구 배치 위치")}>
          {Array.from({length:25},(_,i) => {
            const x=i%5; const y=Math.floor(i/5); const active=chosen.x===x && chosen.y===y; const disabled=busy || !cellFree(draft,x,y,chosen.id);
            return <Pressable key={i} style={[s.cell,{backgroundColor:active ? c.primaryStrong : c.sunken,opacity:disabled ? .3 : 1}]} disabled={disabled}
              accessibilityRole="button" accessibilityState={{selected:active,disabled}} accessibilityLabel={t("{row}행 {column}열",{row:y+1,column:x+1})}
              onPress={() => change(moveRoomItem(draft,chosen.id,x,y))}><Text style={{color:active ? c.onPrimary : c.muted}}>{active ? '✓' : x===2 && y===3 ? '⌂' : '·'}</Text></Pressable>;
          })}
        </View>
      </View> : null}
      <View style={[s.row,{backgroundColor:c.sunken,padding:4,borderRadius:12}]}>
        {(['furniture','style'] as const).map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{selected:tab===item}} onPress={() => setTab(item)} style={[s.tab,{backgroundColor:tab===item ? c.surface : 'transparent'}]}><Text style={{color:c.ink,fontWeight:'600'}}>{item==='furniture' ? t("가구와 소품") : t("방 분위기")}</Text></Pressable>)}
      </View>
      {tab==='furniture' ? <View style={s.catalogue}>{ROOM_ITEMS.map((id) => <Pressable key={id} accessibilityRole="button" accessibilityState={{selected:selected===id}} disabled={busy}
        onPress={() => {change(addRoomItem(draft,id));setSelected(id);scroller.current?.scrollTo({y:0,animated:true});}} style={[s.item,{backgroundColor:c.surfaceSoft,borderColor:selected===id ? c.primaryStrong : c.line}]}>
        <SvgXml xml={roomItemSvg(id)} width="100%" height={80}/><Text style={{color:c.ink,fontWeight:'600',fontSize:13}}>{t(ROOM_LABELS[id])}</Text><Text style={{color:c.muted,fontSize:11}}>{draft.items.some((item)=>item.id===id) ? t("배치됨") : t("추가")}</Text>
      </Pressable>)}</View> : <View style={{gap:12}}>
        <Text style={{color:c.ink,fontWeight:'700'}}>{t("벽지")}</Text><View style={s.row}>{ROOM_WALLS.map((wall)=><Pressable key={wall} disabled={busy} accessibilityRole="button" accessibilityState={{selected:draft.wall===wall}} onPress={()=>change({...draft,wall})} style={[s.swatch,{borderColor:draft.wall===wall ? c.primaryStrong : 'transparent'}]}><View style={[s.dot,{backgroundColor:WALL_COLOURS[wall]}]}/><Text style={{color:c.ink,fontSize:11}}>{t(ROOM_LABELS[wall])}</Text></Pressable>)}</View>
        <Text style={{color:c.ink,fontWeight:'700'}}>{t("바닥")}</Text><View style={s.row}>{ROOM_FLOORS.map((floor)=><Pressable key={floor} disabled={busy} accessibilityRole="button" accessibilityState={{selected:draft.floor===floor}} onPress={()=>change({...draft,floor})} style={[s.swatch,{borderColor:draft.floor===floor ? c.primaryStrong : 'transparent'}]}><View style={[s.dot,{backgroundColor:FLOOR_COLOURS[floor]}]}/><Text style={{color:c.ink,fontSize:11}}>{t(ROOM_LABELS[floor])}</Text></Pressable>)}</View>
        <Text style={{color:c.ink,fontWeight:'700'}}>{t("추천 인테리어")}</Text><Text style={{color:c.muted,fontSize:12}}>{t("선택하면 현재 배치가 바뀌어요.")}</Text>
        <View style={s.row}>{ROOM_PRESETS.map((preset,i)=><Pressable key={i} disabled={busy} accessibilityRole="button" style={{flex:1,gap:6}} onPress={()=>{change(copyRoom(preset));setSelected(null);}}><RoomScene value={preset} avatar={me?.avatarConfig}/><Text style={{color:c.ink,fontSize:11,textAlign:'center'}}>{t(ROOM_PRESET_LABELS[i])}</Text></Pressable>)}</View>
      </View>}
      <Text style={{color:c.muted,fontSize:12,lineHeight:18}}>{t("저장하면 내 프로필을 방문한 친구에게도 보여요.")}</Text>
    </ScrollView>
  </SafeAreaView>;
}
const s=StyleSheet.create({
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:10,borderBottomWidth:1},
  action:{minHeight:44,minWidth:44,paddingHorizontal:10,alignItems:'center',justifyContent:'center'},
  row:{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'},
  panel:{borderWidth:1,padding:12,borderRadius:16,gap:12},
  cells:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:5},
  cell:{width:'18%',height:44,alignItems:'center',justifyContent:'center',borderRadius:8},
  tab:{flex:1,minHeight:44,borderRadius:9,alignItems:'center',justifyContent:'center'},
  catalogue:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:10},
  item:{width:'30%',alignItems:'center',gap:4,padding:8,borderRadius:14,borderWidth:1},
  swatch:{borderWidth:1,padding:6,borderRadius:10,alignItems:'center',gap:5,minWidth:48,minHeight:44},
  dot:{width:32,height:32,borderRadius:16},
});
