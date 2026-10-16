/**
 * 음성 녹음. 플랫폼마다 따로 만듭니다 — Metro 가 recorder.web.ts·recorder.native.ts 를 고릅니다.
 * 이 파일은 타입 검사(tsc)가 읽는 자리로, 웹 구현을 그대로 내보냅니다(auth/social.ts 와 같은 방식).
 */
export { useVoiceRecorder } from "./recorder.web";
