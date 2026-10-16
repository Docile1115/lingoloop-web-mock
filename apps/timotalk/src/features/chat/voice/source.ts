/**
 * 음성 재생 소스. 플랫폼마다 따로 만듭니다 — Metro 가 source.web.ts·source.native.ts 를 고릅니다.
 * 이 파일은 타입 검사(tsc)가 읽는 자리로, 웹 구현을 그대로 내보냅니다.
 */
export { useVoiceSource } from "./source.web";
