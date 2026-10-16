/**
 * 화면 언어.
 *
 * 번역 규칙·사전·"현재 언어"는 웹·옛 앱과 같은 모듈(@shared/i18n/core)을 씁니다.
 * 여기서는 처음 언어를 정하고(저장한 값 → 기기·브라우저 언어), 바꾼 값을 기억하는 일만 합니다.
 *  - 웹: 지금 웹과 같은 localStorage 키에 저장합니다. 옛 웹에서 고른 언어가 그대로 이어집니다.
 *  - 앱: 지금은 기기 언어를 따릅니다(앱 저장은 설정 화면과 함께 2단계).
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Platform } from "react-native";
import { getLocales } from "expo-localization";
import {
  LocaleContext,
  STORAGE_KEY,
  currentLocaleSnapshot,
  isLocale,
  setCurrentLocale,
  subscribe,
  type Locale,
} from "@shared/i18n/core";

export {
  LOCALES,
  LOCALE_LABEL,
  localizeClock,
  msg,
  t,
  translate,
  tx,
  useLocale,
  type Locale,
  type MessageKey,
  type Vars,
} from "@shared/i18n/core";

function savedLocale(): Locale | null {
  if (Platform.OS !== "web") return null;
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY);
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

/** 기기에 여러 언어가 있으면 아는 것이 나올 때까지 훑습니다. 하나도 모르면 영어입니다. */
function deviceLocale(): Locale {
  for (const entry of getLocales()) {
    const guess = entry.languageCode?.slice(0, 2);
    if (isLocale(guess)) return guess;
  }
  return "en";
}

export function changeLocale(next: Locale) {
  setCurrentLocale(next);
  if (Platform.OS !== "web") return;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, next);
  } catch {
    // 저장이 막힌 브라우저(사생활 보호 창 등)에서도 이번 화면은 바뀐 언어로 보입니다.
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, currentLocaleSnapshot, currentLocaleSnapshot);
  const value = useMemo(() => ({ locale, setLocale: changeLocale }), [locale]);
  useEffect(() => {
    // 화면 읽기 프로그램과 번역 도구가 문서 언어를 보고 읽는 법을 정합니다.
    if (Platform.OS === "web" && typeof document !== "undefined") document.documentElement.lang = locale;
  }, [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

// 처음 언어는 모듈이 불릴 때 한 번만 정합니다 — 렌더 중에 바꾸면 화면이 두 번 그려집니다.
setCurrentLocale(savedLocale() ?? deviceLocale());
