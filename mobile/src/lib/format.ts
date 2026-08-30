/**
 * 시각 표기.
 *
 * 웹은 서버가 준 ISO 를 relativeTime() 으로 옮겨 "3분 전" 같은 문자열을 만들고,
 * 어댑터(live-data.ts)가 그걸 화면 모양에 넣어 줍니다. 앱도 그 값을 그대로
 * 쓰므로 여기서 다시 만들지 않습니다.
 *
 * 여기 있는 것은 대화방 안에서만 쓰는 묶음 규칙입니다 — 카카오톡처럼 같은
 * 시간대의 메시지를 한 덩어리로 보여주고, 30분이 지나거나 날짜가 바뀌면
 * 시각을 다시 적습니다.
 */
import { localizeClock, t, tx } from "./i18n";

const HALF_HOUR = 30 * 60 * 1000;

/** 두 메시지 사이에 시각을 다시 적어야 하는가. */
export function needsTimeMark(current: string, previous?: string): boolean {
  if (!previous) return true;
  const a = new Date(current).getTime();
  const b = new Date(previous).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return true;
  if (new Date(current).toDateString() !== new Date(previous).toDateString()) return true;
  return a - b >= HALF_HOUR;
}

/** "오후 6:14" — 기기 언어에 맞춰 옮깁니다. */
export function clockOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const meridiem = hours < 12 ? "오전" : "오후";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return localizeClock(`${meridiem} ${hour12}:${minutes}`);
}

/** 날짜 구분선. 오늘·어제는 낱말로, 그 밖에는 날짜로 적습니다. */
export function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return t("오늘");
  if (date.toDateString() === yesterday.toDateString()) return t("어제");
  return tx(`${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`);
}

/** RN 의 Image 는 SVG 를 못 그립니다 — 웹의 <img> 는 그립니다. */
export function drawablePhoto(photo?: string): string {
  if (!photo) return "";
  return photo.startsWith("data:image/svg") ? "" : photo;
}
