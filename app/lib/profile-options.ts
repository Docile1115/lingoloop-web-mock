import { msg, type MessageKey } from "./i18n/core";

/*
 * 프로필에서 고르는 값들. 서버(backend/server.mjs 의 LANGUAGES·COUNTRIES·LEARNING_LEVELS)가
 * 받는 값과 같아야 합니다 — 화면에만 있는 값을 고르면 저장할 때 거절됩니다.
 * 라벨은 화면 밖에서 만들어지므로 msg() 로 표시해 두고, 읽는 쪽에서 t() 로 번역합니다.
 */

/** 서버가 받는 언어 일곱 가지. */
export const PROFILE_LANGUAGES: Array<{ code: string; label: MessageKey; flag: string }> = [
  { code: "ko", label: msg("한국어"), flag: "🇰🇷" },
  { code: "en", label: msg("영어"), flag: "🇺🇸" },
  { code: "ja", label: msg("일본어"), flag: "🇯🇵" },
  { code: "zh", label: msg("중국어"), flag: "🇨🇳" },
  { code: "es", label: msg("스페인어"), flag: "🇪🇸" },
  { code: "fr", label: msg("프랑스어"), flag: "🇫🇷" },
  { code: "de", label: msg("독일어"), flag: "🇩🇪" },
];

/* 서버(backend/server.mjs 의 COUNTRIES)가 받는 나라 전부입니다. 예전에는 여섯 곳만
   골를 수 있어서, 브라질·베트남 사람은 지역 조건에 아예 나오지 않았습니다. */
export const countryLabels: Record<string, MessageKey> = {
  KR: msg("대한민국"),
  US: msg("미국"),
  JP: msg("일본"),
  CN: msg("중국"),
  GB: msg("영국"),
  CA: msg("캐나다"),
  AU: msg("호주"),
  FR: msg("프랑스"),
  DE: msg("독일"),
  ES: msg("스페인"),
  BR: msg("브라질"),
  VN: msg("베트남"),
};

export const interestLabels: Record<string, MessageKey> = {
  movies: msg("영화"),
  travel: msg("여행"),
  coffee: msg("카페"),
  music: msg("음악"),
  technology: msg("기술"),
  cooking: msg("요리"),
  books: msg("독서"),
  running: msg("운동"),
};

export type MatchAvailability = "weekday-morning" | "weekday-evening" | "weekend-morning" | "weekend-evening";

export const availabilityLabels: Record<MatchAvailability, MessageKey> = {
  "weekday-morning": msg("평일 아침"),
  "weekday-evening": msg("평일 저녁"),
  "weekend-morning": msg("주말 오전"),
  "weekend-evening": msg("주말 저녁"),
};

/** 배우는 단계 다섯. 서버의 LEARNING_LEVELS 와 같은 순서입니다. */
export const LEARNING_LEVELS = ["beginner", "elementary", "intermediate", "upper", "advanced"] as const;
export type LearningLevel = (typeof LEARNING_LEVELS)[number];

export const LEVEL_LABELS: Record<LearningLevel, MessageKey> = {
  beginner: msg("이제 시작했어요"),
  elementary: msg("짧은 문장은 말해요"),
  intermediate: msg("일상 대화는 해요"),
  upper: msg("어려운 얘기도 해요"),
  advanced: msg("거의 불편함이 없어요"),
};

/** 학습 목표 예시. 고르면 프로필의 학습 목표 문장으로 저장됩니다(직접 적을 수도 있습니다). */
export const GOAL_PRESETS: Array<{ id: string; title: MessageKey; description: MessageKey }> = [
  { id: "conversation", title: msg("일상 대화"), description: msg("자연스럽고 편하게 말하기") },
  { id: "career", title: msg("업무 · 커리어"), description: msg("회의와 발표 자신감") },
  { id: "travel", title: msg("여행"), description: msg("현지에서 바로 쓰기") },
  { id: "exam", title: msg("시험 · 자격"), description: msg("정확한 문법과 어휘") },
];

export const GENDER_OPTIONS: Array<[string, MessageKey]> = [
  ["woman", msg("여성")],
  ["man", msg("남성")],
  ["nonbinary", msg("논바이너리")],
  ["unspecified", msg("밝히지 않음")],
];
