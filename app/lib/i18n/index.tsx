"use client";

/**
 * 웹의 언어 배선.
 *
 * 번역 규칙과 사전은 전부 ./core 에 있습니다 — 앱(React Native)과 같은 파일을
 * 씁니다. 여기 남은 것은 브라우저에서만 할 수 있는 일뿐입니다: 저장된 언어를
 * localStorage 에서 읽고, <html lang> 과 탭 제목을 맞춥니다.
 *
 * 화면 코드가 부르는 이름(t·tx·msg·useLocale…)은 예전 그대로라 이 분리로
 * 바뀐 화면 코드는 없습니다.
 */

import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  LocaleContext,
  STORAGE_KEY,
  currentLocaleSnapshot,
  isLocale,
  serverLocale,
  setCurrentLocale,
  subscribe,
  type Locale,
} from "./core";
import { SITE_METADATA } from "./metadata";

export * from "./core";

/**
 * 서버는 항상 ko 로 그립니다. 저장된 언어는 마운트 뒤에 적용합니다 —
 * 서버가 알 수 없는 값으로 첫 렌더를 하면 하이드레이션이 깨집니다.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, currentLocaleSnapshot, serverLocale);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) {
      setCurrentLocale(saved);
      return;
    }
    // 저장된 값이 없을 때만 브라우저 언어를 한 번 따릅니다.
    const guess = navigator.language.slice(0, 2);
    if (isLocale(guess)) setCurrentLocale(guess);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;

    // 탭 제목은 서버가 한국어로 그려두므로 사용자가 고른 언어로 다시 맞춥니다.
    //
    // <title> 은 리액트가 스트리밍 메타데이터 경계 안에서 들고 있고, 그 경계는 본문보다
    // 늦게 하이드레이션됩니다. 마운트 직후에 덮어쓰면 리액트가 서버 HTML 과 다른 값을
    // 발견하고 "고쳐지지 않는다"고 경고합니다. load 이후 두 프레임까지 미루면 그때는
    // 경계가 이미 하이드레이션돼 있습니다.
    //
    // 혹시 그보다 늦게 하이드레이션되더라도 손해는 "제목이 한국어로 남는다" 뿐입니다
    // — 리액트가 자기 값으로 되돌릴 뿐 화면이 깨지지는 않습니다.
    let raf1 = 0, raf2 = 0;
    const apply = () => {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => { document.title = SITE_METADATA[locale].title; });
      });
    };
    if (document.readyState === "complete") {
      apply();
    } else {
      window.addEventListener("load", apply, { once: true });
    }
    return () => {
      window.removeEventListener("load", apply);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale: (next: Locale) => {
        setCurrentLocale(next);
        window.localStorage.setItem(STORAGE_KEY, next);
      },
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
