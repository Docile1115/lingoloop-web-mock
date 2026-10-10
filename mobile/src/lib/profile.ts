/**
 * 프로필 값 — 처음 설정과 프로필 편집이 같이 씁니다.
 *
 * 고를 수 있는 값은 서버(backend/server.mjs)가 받는 목록과 같아야 합니다.
 * 서버 목록에 없는 언어·나라를 고르게 두면 저장할 때마다 422 가 돌아옵니다.
 *  - 언어: LANGUAGES (ko·en·ja·zh·es·fr·de)
 *  - 나라: COUNTRIES (12개국)
 *  - 단계: LEARNING_LEVELS
 *  - 성별: PATCH /api/profile 의 allowedGenders
 */
import { languageName } from "@shared/live-data";
import { msg, t, tx, type MessageKey } from "./i18n";
import type { Me } from "./session";

export const LANGUAGE_CODES = ["ko", "en", "ja", "zh", "es", "fr", "de"] as const;

/** 언어 이름은 지금 화면 언어로 그립니다(웹·서버 어댑터와 같은 사전). */
export const languageLabel = (code: string) => tx(languageName(code));

export const COUNTRIES: Array<{ code: string; flag: string; label: MessageKey }> = [
  { code: "KR", flag: "🇰🇷", label: msg("대한민국") },
  { code: "US", flag: "🇺🇸", label: msg("미국") },
  { code: "JP", flag: "🇯🇵", label: msg("일본") },
  { code: "CN", flag: "🇨🇳", label: msg("중국") },
  { code: "GB", flag: "🇬🇧", label: msg("영국") },
  { code: "CA", flag: "🇨🇦", label: msg("캐나다") },
  { code: "AU", flag: "🇦🇺", label: msg("호주") },
  { code: "FR", flag: "🇫🇷", label: msg("프랑스") },
  { code: "DE", flag: "🇩🇪", label: msg("독일") },
  { code: "ES", flag: "🇪🇸", label: msg("스페인") },
  { code: "BR", flag: "🇧🇷", label: msg("브라질") },
  { code: "VN", flag: "🇻🇳", label: msg("베트남") },
];

export const GENDERS: Array<[string, MessageKey]> = [
  ["woman", msg("여성")],
  ["man", msg("남성")],
  ["nonbinary", msg("논바이너리")],
  ["unspecified", msg("밝히지 않음")],
];

/** 서버가 받는 단계. backend/server.mjs 의 LEARNING_LEVELS 와 같은 순서입니다. */
export const LEVELS = ["beginner", "elementary", "intermediate", "upper", "advanced"] as const;
export const LEVEL_LABELS: Record<(typeof LEVELS)[number], MessageKey> = {
  beginner: msg("이제 시작했어요"),
  elementary: msg("짧은 문장은 말해요"),
  intermediate: msg("일상 대화는 해요"),
  upper: msg("어려운 얘기도 해요"),
  advanced: msg("거의 불편함이 없어요"),
};

/** 대화 가능한 시간. 매칭 조건의 availability 와 같은 코드입니다. */
export const AVAILABILITY: Array<[string, MessageKey]> = [
  ["weekday-morning", msg("평일 아침")],
  ["weekday-evening", msg("평일 저녁")],
  ["weekend-morning", msg("주말 오전")],
  ["weekend-evening", msg("주말 저녁")],
];

/** 관심사. 서버 기본값(travel·movies·coffee)과 같은 코드를 씁니다. */
export const INTERESTS: Array<[string, MessageKey]> = [
  ["movies", msg("영화")], ["travel", msg("여행")], ["coffee", msg("카페")], ["music", msg("음악")],
  ["technology", msg("기술")], ["cooking", msg("요리")], ["books", msg("독서")], ["running", msg("운동")],
];

/** 입력 중인 프로필. 아직 고르지 않은 값은 빈 문자열입니다. */
export type ProfileDraft = {
  name: string;
  bio: string;
  /** 입력칸 그대로(숫자만). 저장할 때 숫자로 바꿉니다. */
  age: string;
  gender: string;
  country: string;
  native: string;
  learning: string;
  level: string;
  goal: string;
  interests: string[];
  availability: string[];
};

export type ProfileField = keyof ProfileDraft;

export function draftFromMe(me: Me): ProfileDraft {
  const learning = me.learningLanguages?.[0];
  return {
    name: me.name ?? "",
    bio: me.bio ?? "",
    age: me.age ? String(me.age) : "",
    gender: me.gender ?? "",
    country: me.country?.code ?? "",
    native: me.nativeLanguages?.[0] ?? "",
    learning: learning?.code ?? "",
    level: learning?.level ?? "",
    goal: learning?.goal ?? "",
    interests: me.interests ?? [],
    availability: me.availability ?? [],
  };
}

/**
 * 저장 전에 서버가 거절할 값을 미리 알려줍니다(PATCH /api/profile 과 같은 규칙).
 * 처음 설정에서는 목표까지 꼭 고르게 하고, 편집에서는 목표를 비우면 서버 기본값을 씁니다.
 */
export function profileErrors(draft: ProfileDraft, firstRun: boolean): Partial<Record<ProfileField, string>> {
  const errors: Partial<Record<ProfileField, string>> = {};
  if (draft.name.trim().length < 2) errors.name = t("이름은 2자 이상 적어 주세요.");
  const age = Number(draft.age);
  if (!/^\d+$/.test(draft.age.trim()) || age < 18 || age > 100) errors.age = t("나이는 18세에서 100세 사이로 적어 주세요.");
  if (!draft.gender) errors.gender = t("성별을 골라 주세요.");
  if (!draft.country) errors.country = t("사는 나라를 골라 주세요.");
  if (!draft.native) errors.native = t("가르칠 수 있는 말을 골라 주세요.");
  if (!draft.learning || draft.learning === draft.native) errors.learning = t("배우는 말을 골라 주세요.");
  if (!draft.level) errors.level = t("지금 어느 정도인지 골라 주세요.");
  const goal = draft.goal.trim().length;
  if ((firstRun && goal < 2) || goal === 1) errors.goal = t("학습 목표는 2자 이상 적어 주세요.");
  return errors;
}

/** 서버가 알려준 잘못된 칸(error.details.field)을 화면의 칸으로 옮깁니다. */
export function fieldFromServer(field?: string): ProfileField | null {
  switch (field) {
    case "name": return "name";
    case "bio": return "bio";
    case "age": return "age";
    case "gender": return "gender";
    case "countryCode": return "country";
    case "nativeLanguages": return "native";
    case "learningLanguages.code": return "learning";
    case "learningLanguages.goal": return "goal";
    case "interests": return "interests";
    case "availability": return "availability";
    default: return null;
  }
}

/** 서버에 보낼 공통 값. 두 번째 이후 언어는 이 화면에서 고치지 않으므로 그대로 보냅니다(웹과 같음). */
export function profilePatch(draft: ProfileDraft, me: Me) {
  const chosen = new Set([draft.native, draft.learning]);
  return {
    name: draft.name.trim(),
    age: Number(draft.age),
    gender: draft.gender,
    countryCode: draft.country,
    nativeLanguages: [draft.native, ...(me.nativeLanguages ?? []).slice(1).filter((code) => !chosen.has(code))],
    learningLanguages: [
      { code: draft.learning, level: draft.level, goal: draft.goal.trim() },
      ...(me.learningLanguages ?? []).slice(1).filter((item) => !chosen.has(item.code)),
    ],
  };
}
