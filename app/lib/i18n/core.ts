/**
 * 로컬라이즈 — 한국어 원문이 곧 키입니다. (플랫폼 공용)
 *
 * 이 파일에는 DOM 도 React Native 도 모르는 것만 둡니다 — 웹과 앱이 **같은 사전과
 * 같은 현재 언어 저장소**를 쓰기 위해서입니다. 둘로 나뉘면 앱에서 언어를 바꿔도
 * 어댑터(live-data.ts)가 부르는 t() 는 계속 한국어를 냅니다.
 *
 * 언어를 무엇으로 정하느냐(브라우저 localStorage / 기기 설정)는 플랫폼마다
 * 다르므로 각자의 Provider 가 setCurrentLocale 로 밀어 넣습니다.
 *
 * 왜 원문을 키로 쓰나:
 *  - 화면 코드를 읽을 때 무슨 문구인지 바로 보입니다(`t("오늘의 파트너")`).
 *  - 키를 새로 짓다가 문구와 어긋나는 일이 없습니다.
 *  - 문구를 고치면 키가 바뀌어 번역도 강제로 다시 검토하게 됩니다. 버그가 아니라 의도입니다.
 *
 * 빠뜨림을 어떻게 막나:
 *  - `npm run i18n` 이 소스에서 t(...)·msg(...) 를 모두 긁어 keys.ts 를 다시 씁니다.
 *  - en/ja 사전은 `Record<MessageKey, string>` 이라 키가 하나라도 없으면 타입 에러입니다.
 *  - tests/i18n.test.mjs 가 사전 정합성과 화면에 남은 하드코딩 한글을 함께 검사합니다.
 *
 * 왜 훅이 아니라 모듈 함수 t() 인가:
 *  - 화면 컴포넌트가 38개인데 전부 훅을 심으면 문구 하나 쓰려고 배선부터 해야 합니다.
 *  - 언어는 앱 전체에 하나뿐이고 바뀌면 루트가 다시 그리므로, 렌더 중 읽는 모듈 값으로 충분합니다.
 *  - 서버에서는 항상 ko 이고 setLocale 은 브라우저에서만 불립니다. 요청 간에 섞일 값이 없습니다.
 *    (서버에서 요청별 언어를 정하게 되면 이 전제가 깨집니다 — 그때는 컨텍스트로 옮겨야 합니다.)
 */

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import type { MessageKey } from "./keys";
import { LOCALES, type Locale } from "./keys-locale";
import { en } from "./en";
import { ja } from "./ja";

export { LOCALES } from "./keys-locale";
export type { Locale } from "./keys-locale";

/** 언어 선택 UI용 이름 — 각 언어를 그 언어로 적습니다(자기 언어를 찾을 수 있도록). */
export const LOCALE_LABEL: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
};

/** ko 는 원문이 곧 번역이라 사전이 비어 있습니다. */
const DICTIONARIES: Record<Locale, Partial<Record<MessageKey, string>>> = { ko: {}, en, ja };

export type Vars = Record<string, string | number>;

export const STORAGE_KEY = "lingoloop.locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * 단수·복수. 값에 `|` 가 있으면 앞이 단수, 뒤가 복수입니다.
 * 한국어·일본어는 구분이 없어 한 덩어리로 두고, 영어만 나눠 적습니다.
 *   "{n} partner|{n} partners"
 */
function pickPlural(raw: string, vars?: Vars): string {
  if (!raw.includes("|")) return raw;
  const [one, other] = raw.split("|");
  const n = Number(vars?.n ?? vars?.count ?? 0);
  return Math.abs(n) === 1 ? one : other;
}

/** `{name}` 자리를 채웁니다. 값이 없으면 자리표시자를 남겨 누락이 눈에 띄게 합니다. */
function interpolate(raw: string, vars: Vars): string {
  return raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/** 로케일을 명시해서 번역합니다. 렌더 밖(테스트·유틸)에서 씁니다. */
export function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
  const raw = DICTIONARIES[locale][key] ?? key;
  const form = pickPlural(raw, vars);
  return vars ? interpolate(form, vars) : form;
}

/**
 * 현재 언어를 담는 작은 외부 스토어.
 * 리액트 상태가 아니라 모듈에 두는 이유는 t() 를 훅 없이 어디서나 부르기 위해서입니다.
 * 렌더 중에 값을 바꾸면 안 되므로(리액트 규칙), 바꾸는 건 항상 setCurrentLocale 로만 합니다.
 */
let currentLocale: Locale = "ko";
const listeners = new Set<() => void>();

export function setCurrentLocale(next: Locale) {
  if (currentLocale === next) return;
  currentLocale = next;
  for (const notify of listeners) notify();
}

export function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/** 서버 렌더에는 항상 ko — 요청마다 다른 값을 주면 하이드레이션이 깨집니다. */
export const serverLocale = (): Locale => "ko";

/** useSyncExternalStore 용 스냅샷. 매번 같은 함수여야 무한 렌더를 피합니다. */
export const currentLocaleSnapshot = (): Locale => currentLocale;

/** 화면에서 쓰는 번역 함수. `t("오늘의 파트너")`, `t("{n}명", { n: 3 })`. */
export function t(key: MessageKey, vars?: Vars): string {
  return translate(currentLocale, key, vars);
}

/**
 * 사전에 있을 수도, 없을 수도 있는 문구.
 * mock API 응답처럼 런타임에 들어오는 값에 씁니다 — 사전에 있으면 번역하고 없으면 원문 그대로 둡니다.
 * 화면에 직접 적은 문구에는 쓰지 마세요. t() 를 써야 번역 누락이 타입으로 잡힙니다.
 */
export function tx(text: string, vars?: Vars): string {
  return translate(currentLocale, text as MessageKey, vars);
}

/**
 * "오후 6:14" 같은 시각 표기를 현재 언어로 옮깁니다.
 * 시·분은 그대로 두고 오전/오후 낱말과 어순만 바꿉니다 —
 * ko "오후 6:14" / en "6:14 PM" / ja "午後6:14".
 * 여기에 두는 이유: 오전/오후를 알아보는 정규식은 화면 문구가 아니라 데이터 해석 규칙이라,
 * 로케일을 다루는 이 모듈이 맞는 자리입니다.
 */
export function localizeClock(value: string): string {
  const parsed = value.match(/^(오전|오후)\s*(.+)$/);
  if (!parsed) return tx(value);
  return t("{meridiem} {time}" as MessageKey, {
    meridiem: t(parsed[1] as MessageKey),
    time: parsed[2],
  });
}

/**
 * 사전에 담을 문구임을 표시만 하는 항등 함수.
 * 라벨 표처럼 렌더 밖에서 문구를 모아둘 때 씁니다 — 스캐너가 이것도 키로 수집합니다.
 *   const levelLabels: Record<Level, MessageKey> = { a1: msg("입문"), ... };
 *   ... t(levelLabels[level])
 */
export const msg = <K extends string>(key: K): K => key;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
}

export const LocaleContext = createContext<LocaleContextValue>({ locale: "ko", setLocale: () => {} });

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

/**
 * 언어가 바뀔 때 이 컴포넌트를 다시 그리게 합니다.
 *
 * 화면들은 훅이 아니라 모듈 함수 t() 로 문구를 읽습니다(그래야 컴포넌트마다 배선을
 * 하지 않아도 됩니다). 대신 t() 는 구독을 하지 않으므로, 언어만 바뀌어서는 아무것도
 * 다시 그려지지 않습니다. 앱의 최상위 화면에서 이 훅을 한 번 부르면 그 아래가
 * 전부 다시 그려집니다.
 */
export function useLocaleRerender(): Locale {
  return useSyncExternalStore(subscribe, () => currentLocale, serverLocale);
}

/** 훅 형태가 필요할 때(메모이제이션된 자식 등). 평소에는 모듈 함수 t 를 쓰면 됩니다. */
export function useT() {
  const { locale } = useContext(LocaleContext);
  return useCallback((key: MessageKey, vars?: Vars) => translate(locale, key, vars), [locale]);
}

export type { MessageKey };
