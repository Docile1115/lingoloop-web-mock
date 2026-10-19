/**
 * 처음 메시지를 보낸 뒤 한 번 묻습니다: "상대가 답하면 알려 드릴까요?" — 답을 기다리는 순간이 알림이 필요한 순간입니다.
 * 폰 알림이 꺼져 있을 때만 묻습니다(웹·푸시 설정이 없는 빌드·기기 설정에서 막아 둔 경우는 묻지 않음).
 * 이 기기에서 한 번 물으면(켜든 나중에든) 다시 묻지 않습니다. 나 > 알림에서 언제든 켤 수 있습니다.
 */
import { useCallback, useRef, useState } from "react";
import { failureText } from "@/lib/api";
import { readJson, writeJson } from "@/lib/deviceStore";
import { t, useLocale } from "@/lib/i18n";
import { enablePush, pushStatus } from "@/lib/push";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { showToast } from "@/ui/Toast";

const ASKED_KEY = "push-asked";

export function usePushNudge() {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const checked = useRef(false);

  /** 메시지를 보낸 뒤 부릅니다. 화면이 열려 있는 동안 한 번만 확인합니다. */
  const afterSend = useCallback(async () => {
    if (checked.current) return;
    checked.current = true;
    const [asked, status] = await Promise.all([readJson<boolean>(ASKED_KEY, false), pushStatus().catch(() => null)]);
    if (asked || status !== "off") return;
    await writeJson(ASKED_KEY, true);
    setOpen(true);
  }, []);

  const turnOn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await enablePush(locale);
      if (result === "on") showToast(t("폰 알림을 켰어요"));
      else if (result === "off" || result === "denied") showToast(t("알림을 허용해야 받을 수 있어요."), "error");
      setOpen(false);
    } catch (caught) {
      showToast(failureText(caught, t("알림을 켜지 못했어요.")), "error");
    } finally {
      setBusy(false);
    }
  };

  const dialog = open ? (
    <Dialog
      visible
      title={t("상대가 답하면 알려 드릴까요?")}
      body={t("새 메시지·요청·교정을 폰 알림으로 받아요. 나 > 알림에서 언제든 끌 수 있어요.")}
      onClose={() => (busy ? undefined : setOpen(false))}
      actions={
        <>
          <Button label={t("나중에")} variant="secondary" disabled={busy} onPress={() => setOpen(false)} />
          <Button label={t("알림 받기")} icon="bell" busy={busy} onPress={() => void turnOn()} />
        </>
      }
    />
  ) : null;

  return { afterSend, dialog };
}
