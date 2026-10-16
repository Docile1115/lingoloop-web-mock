/**
 * 이 기기에만 두는 작은 기록(복습 일정 등). 플랫폼마다 따로 만듭니다 — Metro 가 .web.ts·.native.ts 를 고릅니다.
 * 이 파일은 타입 검사(tsc)가 읽는 자리로, 웹 구현을 그대로 내보냅니다.
 */
export { readJson, writeJson } from "./deviceStore.web";
