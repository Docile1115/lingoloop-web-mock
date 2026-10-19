/**
 * 폰 알림. 플랫폼마다 따로 만듭니다 — Metro 가 push.web.ts·push.native.ts 를 고릅니다.
 * 이 파일은 타입 검사(tsc)가 읽는 자리입니다. 다른 기능과 달리 앱 구현을 내보냅니다 — 웹 쪽은 아무 일도 하지 않는
 * 빈 함수라, 부르는 쪽의 인자와 결과를 앱 구현에 맞춰 검사해야 의미가 있습니다.
 */
export { disablePush, enablePush, forgetPush, onPushOpen, pushStatus, refreshPush } from "./push.native";
export type { PushOpen, PushStatus } from "./pushTypes";
