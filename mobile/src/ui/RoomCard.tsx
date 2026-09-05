import { Pressable, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { renderRoomSvg, type RoomConfig } from '@shared/room';
import type { AvatarConfig } from '@shared/avatar';
import { t } from '../lib/i18n';
import { useTheme } from '../lib/useTheme';

export function RoomScene({ value, avatar }: { value?: RoomConfig | null; avatar?: AvatarConfig | null }) {
  return <View style={{ width:'100%', aspectRatio:600/460, overflow:'hidden', borderRadius:18 }}>
    <SvgXml xml={renderRoomSvg(value,avatar)} width="100%" height="100%" />
  </View>;
}
export function RoomCard({ name, value, avatar, onEdit }: { name:string; value?: RoomConfig | null; avatar?: AvatarConfig | null; onEdit?: () => void }) {
  const c = useTheme();
  return <View style={{ borderColor:c.line, borderWidth:1, borderRadius:20, overflow:'hidden', marginBottom:12 }}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,padding:12}}>
      <Text style={{color:c.ink,fontWeight:'700',fontSize:14,flex:1}} numberOfLines={1}>{t("{name}님의 마이룸",{name})}</Text>
      {onEdit ? <Pressable onPress={onEdit} accessibilityRole="button" style={{minHeight:44,paddingHorizontal:12,justifyContent:'center',borderRadius:12,backgroundColor:c.sunken}}><Text style={{color:c.ink,fontWeight:'600'}}>{t("방 꾸미기")}</Text></Pressable> : null}
    </View>
    <View accessibilityRole="image" accessibilityLabel={t("{name}님의 마이룸",{name})}><RoomScene value={value} avatar={avatar}/></View>
    {!value && onEdit ? <Text style={{padding:12,color:c.muted,fontSize:12}}>{t("기본 방이에요. 취향에 맞게 꾸며보세요.")}</Text> : null}
  </View>;
}
