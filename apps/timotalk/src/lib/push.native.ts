/**
 * 폰 알림 — 앱(iOS·Android). 보내는 쪽은 backend/push.mjs 입니다.
 *
 *  - 켜기: 알림 권한을 묻고, Expo 푸시 토큰을 받아 서버에 이 기기를 등록합니다. 화면 언어도 함께 보내
 *    알림 문구가 그 말로 옵니다.
 *  - 끄기·로그아웃: 서버에서 이 기기를 뺍니다. 다른 계정으로 로그인하면 그 사람이 다시 켜야 합니다.
 *  - 앱을 열 때: 켜 둔 기기면 토큰과 화면 언어를 다시 등록합니다(토큰은 바뀔 수 있습니다).
 *  - 켜 둔 상태와 토큰은 이 기기에만 둡니다(deviceStore). 권한은 기기 설정이 기준입니다.
 *
 * Expo 푸시 토큰에는 EAS 프로젝트 id 가 필요합니다(app.json 의 extra.eas.projectId — `eas init` 이 넣습니다).
 * 없으면 "이 빌드에서는 쓸 수 없음"(unconfigured)으로 둡니다.
 * 앱을 보고 있는 동안 온 알림은 배너·소리 없이 알림 센터에만 둡니다 — 화면이 이미 새로 받아 보여 줍니다.
 */
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";
import { readJson, writeJson } from "./deviceStore";
import { t } from "./i18n";
import type { PushOpen, PushStatus } from "./pushTypes";

export type { PushOpen, PushStatus } from "./pushTypes";

const STORE_KEY = "push";
type Saved = { enabled: boolean; token: string };
const OFF: Saved = { enabled: false, token: "" };

const projectId = (): string => Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? "";
const saved = () => readJson<Saved>(STORE_KEY, OFF);

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function pushStatus(): Promise<PushStatus> {
  if (!projectId()) return "unconfigured";
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return permission.canAskAgain ? "off" : "denied";
  return (await saved()).enabled ? "on" : "off";
}

async function register(locale: string): Promise<void> {
  if (Platform.OS === "android") {
    // 서버가 channelId "default" 로 보냅니다. 중요도가 높아야 화면 위에 잠깐 뜹니다.
    await Notifications.setNotificationChannelAsync("default", { name: t("메시지와 교정"), importance: Notifications.AndroidImportance.HIGH });
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  const before = await saved();
  await api("/api/push/devices", { body: { token, platform: Platform.OS, locale } });
  // 토큰이 바뀌었으면 옛 토큰은 뺍니다. 실패해도 Expo 가 "없는 기기"라고 알려 주면 서버가 지웁니다.
  if (before.token && before.token !== token) {
    await api("/api/push/devices", { method: "DELETE", body: { token: before.token } }).catch(() => undefined);
  }
  await writeJson(STORE_KEY, { enabled: true, token });
}

/** 켜기. 권한을 막아 두었으면 denied, 묻는 창에서 거절하면 off 를 돌려줍니다. 등록 실패는 던집니다. */
export async function enablePush(locale: string): Promise<PushStatus> {
  if (!projectId()) return "unconfigured";
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return permission.canAskAgain ? "off" : "denied";
  await register(locale);
  return "on";
}

/** 끄기. 서버에서 빼지 못하면 던지고 켜 둔 상태를 그대로 둡니다(끈 줄 알았는데 울리면 안 됩니다). */
export async function disablePush(): Promise<void> {
  const { token } = await saved();
  if (token) await api("/api/push/devices", { method: "DELETE", body: { token } });
  await writeJson(STORE_KEY, OFF);
}

/** 로그아웃 직전: 서버에서 이 기기를 빼 보고, 실패해도 이 기기의 기록은 지웁니다. */
export async function forgetPush(): Promise<void> {
  await disablePush().catch(() => writeJson(STORE_KEY, OFF));
}

/** 앱을 열 때. 켜 둔 기기만 다시 등록합니다. 실패는 다음에 열 때 다시 합니다. */
export async function refreshPush(locale: string): Promise<void> {
  try {
    if (!projectId() || !(await saved()).enabled) return;
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    await register(locale);
  } catch {
    // 화면에는 영향이 없습니다.
  }
}

const text = (value: unknown) => (typeof value === "string" ? value : "");
/** 같은 알림을 두 번 열지 않게(앱을 연 알림은 리스너와 getLastNotificationResponseAsync 양쪽에서 옵니다) */
const opened = new Set<string>();

/** 폰 알림을 눌러 앱을 열 때마다 handle 을 부릅니다. 앱이 꺼져 있다가 알림으로 열린 경우도 포함합니다. */
export function onPushOpen(handle: (data: PushOpen) => void): () => void {
  const take = (response: Notifications.NotificationResponse | null) => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (opened.has(id)) return;
    opened.add(id);
    const data = response.notification.request.content.data ?? {};
    handle({
      notificationId: text(data.notificationId),
      eventId: text(data.eventId),
      type: text(data.type),
      conversationId: text(data.conversationId),
      postId: text(data.postId),
    });
  };
  void Notifications.getLastNotificationResponseAsync().then(take);
  const subscription = Notifications.addNotificationResponseReceivedListener(take);
  return () => subscription.remove();
}
