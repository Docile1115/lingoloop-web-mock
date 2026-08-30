/**
 * 앱의 언어 배선.
 *
 * 번역 규칙·사전·"현재 언어" 저장소는 전부 웹과 **같은 모듈**(@shared/i18n/core)을
 * 씁니다. 따로 두면 앱에서 언어를 바꿔도 서버 응답 어댑터(live-data.ts)가 부르는
 * t() 는 계속 한국어를 냅니다 — 저장소가 둘로 갈라지기 때문입니다.
 *
 * 여기 남은 것은 앱에서만 할 수 있는 일뿐입니다: 기기 설정 언어 읽기.
 * (언어 고르기 화면이 생기면 setLocale 에 AsyncStorage 저장을 붙이면 됩니다.)
 */
import { useMemo, useSyncExternalStore } from "react";
import { getLocales } from "expo-localization";
import {
  LocaleContext,
  currentLocaleSnapshot,
  isLocale,
  setCurrentLocale,
  subscribe,
  type Locale,
} from "@shared/i18n/core";

export {
  LOCALES,
  localizeClock,
  msg,
  t,
  translate,
  tx,
  useLocale,
  useLocaleRerender,
  useT,
  type Locale,
  type MessageKey,
  type Vars,
} from "@shared/i18n/core";

/**
 * 기기 설정 언어. 지원하지 않는 언어면 한국어로 둡니다.
 *
 * 기기에 여러 언어가 순서대로 설정돼 있을 수 있어서 우리가 아는 것이 나올 때까지
 * 훑습니다 — 1순위가 프랑스어이고 2순위가 영어인 사람에게 한국어를 보여줄 이유가
 * 없습니다.
 */
function deviceLocale(): Locale {
  for (const entry of getLocales()) {
    const guess = entry.languageCode?.slice(0, 2);
    if (isLocale(guess)) return guess;
  }
  return "ko";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, currentLocaleSnapshot, currentLocaleSnapshot);
  const value = useMemo(() => ({ locale, setLocale: setCurrentLocale }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

// 기기 언어는 모듈이 처음 불릴 때 한 번만 정합니다 — 렌더 중에 바꾸면 안 됩니다.
setCurrentLocale(deviceLocale());
