/**
 * 시간 표기. 날짜·시각은 Intl 로 화면 언어에 맞게 씁니다(오후 6:14 · 6:14 PM · 18:14).
 */
import { currentLocaleSnapshot } from "@shared/i18n/core";
import { t } from "./i18n";

const INTL_LOCALE = { ko: "ko-KR", en: "en-US", ja: "ja-JP" } as const;

function intlLocale(): string {
  return INTL_LOCALE[currentLocaleSnapshot()] ?? "ko-KR";
}

/** "3분 전" */
export function relativeTime(value: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60000));
  if (!Number.isFinite(minutes)) return "";
  if (minutes < 1) return t("방금");
  if (minutes < 60) return t("{n}분 전", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("{n}시간 전", { n: hours });
  const days = Math.floor(hours / 24);
  return days === 1 ? t("어제") : t("{n}일 전", { n: days });
}

/** 말풍선 옆 시각 */
export function clock(value: string | Date, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat(intlLocale(), { hour: "numeric", minute: "2-digit", ...(timeZone ? { timeZone } : {}) }).format(
      typeof value === "string" ? new Date(value) : value,
    );
  } catch {
    return "";
  }
}

/** 날짜 구분선과 오늘 화면 머리줄: "10월 16일 목요일" */
export function longDate(value: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat(intlLocale(), { month: "long", day: "numeric", weekday: "long" }).format(value);
  } catch {
    return "";
  }
}

/** 같은 날인가(기기 시간대 기준) */
export function sameDay(left: string, right: string): boolean {
  const a = new Date(left);
  const b = new Date(right);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * 나라별 대표 시간대. 서버는 사람마다 시간대를 저장하지 않습니다.
 * 여러 시간대를 쓰는 나라는 사람이 가장 많은 곳으로 잡습니다(옛 웹과 같은 표).
 */
const COUNTRY_ZONES: Record<string, string> = {
  KR: "Asia/Seoul",
  JP: "Asia/Tokyo",
  CN: "Asia/Shanghai",
  VN: "Asia/Ho_Chi_Minh",
  GB: "Europe/London",
  FR: "Europe/Paris",
  DE: "Europe/Berlin",
  ES: "Europe/Madrid",
  US: "America/New_York",
  CA: "America/Toronto",
  AU: "Australia/Sydney",
  BR: "America/Sao_Paulo",
};

/** 상대 나라의 지금 시각. 시간대를 모르면 빈 문자열 — 내 시각을 상대 시각처럼 보이면 안 됩니다. */
export function localTimeIn(countryCode?: string, now = new Date()): string {
  const zone = COUNTRY_ZONES[(countryCode || "").toUpperCase()];
  return zone ? clock(now, zone) : "";
}
