import { t } from "./i18n";

/**
 * 사용자가 적는 값의 검증을 한곳에 모읍니다.
 *
 * 화면마다 `draft.trim()` 만 하거나 아예 안 하던 것을 통일합니다.
 * mock 이라도 규칙이 흩어져 있으면 화면마다 다르게 동작하고, 나중에 서버를 붙일 때
 * 어디를 믿어야 하는지 알 수 없게 됩니다.
 *
 * 여기서 하는 일은 두 가지뿐입니다.
 *  - 길이·공백 같은 "형식" 검사
 *  - 눈에 안 보이는 제어문자 제거
 * HTML 이스케이프는 하지 않습니다 — React 가 텍스트를 그대로 넣어주므로
 * 여기서 또 손대면 사용자가 적은 `<`, `&` 가 깨집니다.
 */

/** 화면별 최대 길이. 입력칸의 maxLength 와 같은 값을 씁니다. */
export const LIMITS = {
  post: 500,
  message: 1000,
  reply: 500,
  roomTitle: 40,
  roomTopic: 60,
  profileName: 20,
  profileBio: 160,
  profileGoal: 40,
} as const;

export type LimitKey = keyof typeof LIMITS;

/** 눈에 보이지 않는 제어문자. 붙여넣기로 섞여 들어옵니다. */
// eslint-disable-next-line no-control-regex -- 제어문자를 걸러내는 것이 이 정규식의 목적입니다
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
/** 폭 없는 공백 계열 — 빈 글을 "내용 있음"으로 속이는 데 쓰입니다. */
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;

/**
 * 보이지 않는 제어문자를 지우고 앞뒤 공백을 정리합니다.
 * 줄바꿈과 탭은 사용자가 일부러 넣은 것이라 남깁니다.
 */
export function cleanText(value: string): string {
  return value
    .replace(CONTROL_CHARS, "")
    .replace(ZERO_WIDTH, "")
    .trim();
}

export interface CheckResult {
  ok: boolean;
  value: string;
  error?: string;
}

/**
 * 제출 직전 검사. 통과하면 정리된 값을, 아니면 사람이 읽을 이유를 돌려줍니다.
 *   const checked = checkText(draft, "post");
 *   if (!checked.ok) return showToast(checked.error!);
 */
export function checkText(raw: string, limit: LimitKey): CheckResult {
  const value = cleanText(raw);
  if (!value) return { ok: false, value, error: t("내용을 입력해 주세요") };
  const max = LIMITS[limit];
  if (value.length > max) {
    return { ok: false, value, error: t("{max}자까지 쓸 수 있어요", { max }) };
  }
  return { ok: true, value };
}

/** 입력 중에 쓰는 가벼운 판정 — 제출 버튼을 켜고 끄는 용도입니다. */
export function canSubmit(raw: string, limit: LimitKey): boolean {
  const value = cleanText(raw);
  return value.length > 0 && value.length <= LIMITS[limit];
}

/**
 * localStorage 에서 읽은 값은 사용자가 직접 고칠 수 있으므로 그대로 믿지 않습니다.
 * 파싱에 실패하거나 모양이 다르면 기본값으로 돌아갑니다.
 */
export function readStoredJson<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
