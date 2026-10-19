/**
 * 로그인한 화면(탭 묶음)에서 폰 알림을 이어 붙입니다.
 *  - 켜 둔 기기면 등록을 새로 합니다. 화면 언어를 바꾸면 탭 묶음이 새로 그려지므로 새 언어로 다시 등록됩니다.
 *  - 폰 알림을 눌러 앱을 열면 그 알림을 읽음으로 바꾸고, 앱 안 알림 목록과 같은 곳으로 갑니다(target.ts).
 */
import { useEffect } from "react";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { onPushOpen, refreshPush } from "@/lib/push";
import { useNotifications } from "./store";
import { notificationHref } from "./target";

export function usePushSetup() {
  const router = useRouter();
  const { locale } = useLocale();
  const { reload } = useNotifications();

  useEffect(() => {
    void refreshPush(locale);
  }, [locale]);

  useEffect(
    () =>
      onPushOpen((data) => {
        if (data.notificationId && data.eventId) {
          void api(`/api/notifications/${encodeURIComponent(data.notificationId)}/read`, { method: "PATCH", body: { eventId: data.eventId } })
            .catch(() => undefined)
            .finally(() => void reload());
        }
        const href = notificationHref(data);
        if (href) router.push(href);
      }),
    [router, reload],
  );
}
