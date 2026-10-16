/**
 * 문장 소리 내어 듣기. 플랫폼마다 따로 만듭니다 — Metro 가 speak.web.ts·speak.native.ts 를 고릅니다.
 * 이 파일은 타입 검사(tsc)가 읽는 자리로, 웹 구현을 그대로 내보냅니다.
 */
export { canSpeak, speak, stopSpeaking } from "./speak.web";
