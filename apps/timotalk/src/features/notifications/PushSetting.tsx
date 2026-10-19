/**
 * "나" 화면의 알림 묶음: 이 기기에서 폰 알림 받기. 웹에서는 묶음째 보이지 않습니다(pushStatus 가 unsupported).
 *  - 기기 설정에서 막아 두었으면 앱이 다시 물을 수 없으므로 기기 설정을 여는 줄로 바꿉니다.
 *  - 앱으로 돌아올 때마다 다시 확인합니다(기기 설정에서 바꾸고 올 수 있음).
 */
import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { failureText } from "@/lib/api";
import { t, useLocale } from "@/lib/i18n";
import { disablePush, enablePush, pushStatus, type PushStatus } from "@/lib/push";
import { useAppActive } from "@/lib/useAppActive";
import { ListGroup, ListRow, SwitchRow } from "@/ui/List";
import { showToast } from "@/ui/Toast";

export function PushSetting() {
  const { locale } = useLocale();
  const active = useAppActive();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    pushStatus()
      .then((value) => {
        if (alive) setStatus(value);
      })
      .catch(() => {
        if (alive) setStatus("unconfigured");
      });
    return () => {
      alive = false;
    };
  }, [active]);

  if (!status || status === "unsupported") return null;

  const toggle = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (next) {
        const result = await enablePush(locale);
        setStatus(result);
        if (result === "off") showToast(t("알림을 허용해야 받을 수 있어요."), "error");
      } else {
        await disablePush();
        setStatus("off");
      }
    } catch (caught) {
      showToast(failureText(caught, next ? t("알림을 켜지 못했어요.") : t("알림을 끄지 못했어요.")), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ListGroup title={t("알림")}>
      {status === "denied" ? (
        <ListRow
          icon="bellOff"
          title={t("폰 알림")}
          detail={t("기기 설정에서 TimoTalk 알림이 꺼져 있어요. 눌러서 설정을 열어요.")}
          onPress={() => void Linking.openSettings()}
        />
      ) : (
        <SwitchRow
          title={t("폰 알림")}
          detail={status === "unconfigured" ? t("이 버전의 앱에서는 아직 쓸 수 없어요.") : t("새 메시지·요청·교정을 이 기기로 알려 줘요.")}
          value={status === "on"}
          onValueChange={(next) => void toggle(next)}
          disabled={busy || status === "unconfigured"}
        />
      )}
    </ListGroup>
  );
}
