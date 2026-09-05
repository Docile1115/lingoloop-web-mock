import { msg, type MessageKey } from './i18n/core';
import type { AvatarCategory } from './avatar';

export const AVATAR_CATEGORY_LABELS: Record<AvatarCategory, MessageKey> = {
  skinTone: msg("피부색"), face: msg("얼굴"), hair: msg("헤어스타일"), hairColor: msg("머리 색상"),
  eyebrows: msg("눈썹"), eyes: msg("눈"), nose: msg("코"), mouth: msg("입"),
  outfit: msg("상의"), outfitColor: msg("상의 색상"), bottom: msg("하의"), bottomColor: msg("하의 색상"),
  socks: msg("양말"), shoes: msg("신발"), shoeColor: msg("신발 색상"),
  accessory: msg("액세서리"), headwear: msg("모자"), bag: msg("가방"), background: msg("배경"),
};
export const AVATAR_GROUP_LABELS = {
  face: msg("얼굴"), hair: msg("헤어"), clothes: msg("의상"), feet: msg("발끝"), extras: msg("소품"),
};
export const AVATAR_OPTION_LABELS: Partial<Record<string, MessageKey>> = {
  "brows-01": msg("자연스러운 눈썹"), "brows-02": msg("일자 눈썹"), "brows-03": msg("아치 눈썹"), "brows-04": msg("짙은 눈썹"),
  "nose-01": msg("부드러운 코"), "nose-02": msg("동그란 코"), "nose-03": msg("또렷한 코"),
  "outfit-01": msg("라운드 티"), "outfit-02": msg("후드티"), "outfit-03": msg("셔츠"), "outfit-04": msg("스웨터"), "outfit-05": msg("재킷"),
  "outfit-06": msg("브이넥"), "outfit-07": msg("터틀넥"), "outfit-08": msg("오버롤"), "outfit-09": msg("스포츠 톱"), "outfit-10": msg("블레이저"),
  "bottom-01": msg("일자 팬츠"), "bottom-02": msg("와이드 팬츠"), "bottom-03": msg("반바지"), "bottom-04": msg("플리츠 스커트"), "bottom-05": msg("롱 스커트"), "bottom-06": msg("조거 팬츠"),
  "socks-01": msg("발목 양말"), "socks-02": msg("긴 양말"), "socks-03": msg("줄무늬 양말"),
  "shoes-01": msg("스니커즈"), "shoes-02": msg("하이톱"), "shoes-03": msg("로퍼"), "shoes-04": msg("부츠"), "shoes-05": msg("메리제인"),
  "headwear-none": msg("없음"), "headwear-01": msg("비니"), "headwear-02": msg("베레모"), "headwear-03": msg("버킷햇"),
  "bag-none": msg("없음"), "bag-01": msg("크로스백"), "bag-02": msg("토트백"), "bag-03": msg("백팩"), "accessory-none": msg("없음"),
};
