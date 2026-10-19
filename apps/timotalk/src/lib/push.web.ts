/**
 * 폰 알림 — 웹에서는 쓰지 않습니다. 알림은 앱 안 알림 목록으로 보고, "나" 화면에도 설정이 보이지 않습니다.
 * 앱 구현은 push.native.ts 입니다.
 */
import type { PushStatus } from "./pushTypes";

export type { PushOpen, PushStatus } from "./pushTypes";

export async function pushStatus(): Promise<PushStatus> {
  return "unsupported";
}

export async function enablePush(): Promise<PushStatus> {
  return "unsupported";
}

export async function disablePush(): Promise<void> {}

export async function forgetPush(): Promise<void> {}

export async function refreshPush(): Promise<void> {}

export function onPushOpen(): () => void {
  return () => undefined;
}
