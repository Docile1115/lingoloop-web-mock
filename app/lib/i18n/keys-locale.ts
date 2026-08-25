/**
 * 지원 언어 목록만 따로 둡니다.
 *
 * index.tsx 는 "use client" 라서 서버 컴포넌트(layout.tsx 의 generateMetadata)가
 * 가져다 쓸 수 없습니다. 언어 목록은 양쪽 모두 필요한 순수한 값이라 여기에 둡니다.
 */
export const LOCALES = ["ko", "en", "ja"] as const;
export type Locale = (typeof LOCALES)[number];
