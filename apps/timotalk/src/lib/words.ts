/**
 * 서버가 주는 코드(언어·관심사·단계·추천 이유)를 지금 화면 언어의 낱말로 바꿉니다.
 * 낱말은 사전 키(msg)로 두고 그릴 때 tx() 로 옮깁니다.
 */
import { msg, t, tx } from "./i18n";
import type { MatchReasonCode, Profile } from "./types";

const LANGUAGE_NAMES: Record<string, string> = {
  ko: msg("한국어"),
  en: msg("영어"),
  ja: msg("일본어"),
  zh: msg("중국어"),
  es: msg("스페인어"),
  fr: msg("프랑스어"),
  de: msg("독일어"),
};

const INTEREST_NAMES: Record<string, string> = {
  movies: msg("영화"),
  travel: msg("여행"),
  coffee: msg("카페"),
  music: msg("음악"),
  technology: msg("기술"),
  cooking: msg("요리"),
  books: msg("독서"),
  running: msg("운동"),
};

const AVAILABILITY_NAMES: Record<string, string> = {
  "weekday-morning": msg("평일 아침"),
  "weekday-evening": msg("평일 저녁"),
  "weekend-morning": msg("주말 오전"),
  "weekend-evening": msg("주말 저녁"),
};

/** 서버의 다섯 단계를 사람이 읽는 말로. 다섯 단계를 모두 따로 적습니다(둘을 같은 말로 뭉치지 않음). */
const LEVEL_NAMES: Record<string, string> = {
  beginner: msg("초급"),
  elementary: msg("초중급"),
  intermediate: msg("중급"),
  upper: msg("중상급"),
  advanced: msg("고급"),
};

export function languageName(code: string): string {
  const key = LANGUAGE_NAMES[code];
  return key ? tx(key) : code.toUpperCase();
}

export function interestName(code: string): string {
  const key = INTEREST_NAMES[code];
  return key ? tx(key) : code;
}

export function availabilityName(code: string): string {
  const key = AVAILABILITY_NAMES[code];
  return key ? tx(key) : code;
}

export function levelName(code: string): string {
  const key = LEVEL_NAMES[code];
  return key ? tx(key) : code;
}

/** "한국어 중급" — 상대가 배우는 첫 언어와 단계 */
export function learningSummary(profile: Profile): string {
  const learning = profile.learningLanguages[0];
  if (!learning) return "";
  return t("{language} {level}", { language: languageName(learning.code), level: levelName(learning.level) });
}

/** "일본어 원어민" */
export function nativeSummary(profile: Profile): string {
  const native = profile.nativeLanguages[0];
  return native ? t("{language} 원어민", { language: languageName(native) }) : "";
}

/** 사는 곳: 도시가 있으면 도시, 없으면 나라 이름 */
export function placeName(profile: Profile): string {
  return profile.city || (profile.country?.name ? tx(profile.country.name) : "");
}

/**
 * 추천 이유를 지금 언어로. 서버는 한국어 문장(matchReasons)과 코드(matchReasonCodes)를
 * 함께 줍니다. 코드를 모르면 서버 문장으로 되돌아갑니다 — 새 코드가 생겨도 빈칸이 안 뜹니다.
 */
export function matchReasonText(reason: MatchReasonCode, fallback = ""): string {
  switch (reason.code) {
    case "native-speaker":
      return t("{languages} 원어민 파트너예요", {
        languages: reason.languageCodes?.length ? reason.languageCodes.map(languageName).join(" · ") : tx(reason.languages || ""),
      });
    case "preferred-country":
      return t("희망 지역인 {country}에 있어요", { country: tx(reason.country || "") });
    case "shared-interests":
      return t("{interests} 관심사가 같아요", {
        interests: reason.interestCodes?.length ? reason.interestCodes.map(interestName).join(" · ") : tx(reason.interests || ""),
      });
    case "level-in-range":
      return t("찾으시는 학습 단계예요");
    case "time-overlap":
      return t("선호하는 학습 시간대가 겹쳐요");
    case "first-exchange":
      return t("새로운 실제 회원과 첫 언어 교환을 시작해 보세요");
    case "broadened":
      return t("일부 조건을 넓혀 찾은 가까운 파트너예요");
    default:
      return tx(fallback);
  }
}
