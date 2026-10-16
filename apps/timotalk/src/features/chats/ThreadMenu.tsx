/**
 * 대화방 메뉴: 알림 끄기 · 대화 나가기 · 차단 · 신고.
 * 나가기·차단은 한 번 더 묻고, 신고는 사유를 고르는 창(ReportDialog)을 엽니다(함께 차단할 수 있음).
 * 나가기·차단이 끝나면 onGone 을 불러 대화방을 닫게 합니다.
 */
import { useState } from "react";
import { failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Conversation } from "@/lib/types";
import { ConfirmDialog, Dialog } from "@/ui/Dialog";
import { ListGroup, ListRow } from "@/ui/List";
import { showToast } from "@/ui/Toast";
import { blockUser, leaveConversation, setMuted } from "./actions";
import { ReportDialog } from "./ReportDialog";
import { useConversations } from "./store";

type Mode = "menu" | "leave" | "block" | "report" | null;

export function ThreadMenu({
  conversation,
  open,
  onClose,
  onGone,
}: {
  conversation: Conversation;
  open: boolean;
  onClose: () => void;
  /** 대화가 내 목록에서 사라졌을 때(나가기·차단) */
  onGone: () => void;
}) {
  const { upsert, remove } = useConversations();
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const partner = conversation.partner;
  const name = partner?.name ?? t("알 수 없는 사용자");
  const accepted = conversation.requestStatus !== "pending";
  // 메뉴를 열면 처음 화면부터 보여 줍니다.
  const shown: Mode = open ? (mode ?? "menu") : null;

  const close = () => {
    if (busy) return;
    setMode(null);
    onClose();
  };

  const run = async (task: () => Promise<void>, failure: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await task();
    } catch (caught) {
      showToast(failureText(caught, failure), "error");
    } finally {
      setBusy(false);
    }
  };

  /** 나가기·차단 뒤: 목록에서 빼고 대화방을 닫습니다. */
  const gone = () => {
    remove(conversation.id);
    setMode(null);
    onClose();
    onGone();
  };

  const toggleMute = () =>
    run(async () => {
      const muted = !conversation.muted;
      await setMuted(conversation.id, muted);
      upsert({ ...conversation, muted });
      showToast(muted ? t("이 대화의 알림을 껐어요") : t("이 대화의 알림을 켰어요"));
      setMode(null);
      onClose();
    }, t("알림 설정을 바꾸지 못했어요."));

  const leave = () =>
    run(async () => {
      await leaveConversation(conversation.id);
      showToast(t("대화에서 나갔어요"));
      gone();
    }, t("대화에서 나가지 못했어요."));

  const block = () =>
    run(async () => {
      if (!partner) return;
      await blockUser(partner.id);
      showToast(t("{name}님을 차단했어요", { name }));
      gone();
    }, t("차단하지 못했어요."));

  return (
    <>
      <Dialog visible={shown === "menu"} title={name} onClose={close}>
        <ListGroup>
          <ListRow
            icon={conversation.muted ? "bell" : "bellOff"}
            title={conversation.muted ? t("알림 켜기") : t("알림 끄기")}
            detail={conversation.muted ? t("새 메시지를 다시 알려 드려요.") : t("이 대화의 새 메시지를 알리지 않아요.")}
            disabled={busy}
            onPress={() => void toggleMute()}
            trailing={null}
          />
          {accepted ? (
            <ListRow icon="logout" title={t("대화 나가기")} detail={t("내 목록에서 사라져요. 상대가 다시 말을 걸면 돌아와요.")} onPress={() => setMode("leave")} trailing={null} />
          ) : null}
          {partner ? <ListRow icon="block" title={t("차단하기")} danger onPress={() => setMode("block")} trailing={null} /> : null}
          {partner ? <ListRow icon="flag" title={t("신고하기")} danger onPress={() => setMode("report")} trailing={null} /> : null}
        </ListGroup>
      </Dialog>

      <ConfirmDialog
        visible={shown === "leave"}
        title={t("대화에서 나갈까요?")}
        body={t("내 목록에서 사라져요. 상대가 다시 말을 걸면 대화가 돌아와요.")}
        confirmLabel={t("나가기")}
        busy={busy}
        onClose={() => setMode("menu")}
        onConfirm={() => void leave()}
      />

      <ConfirmDialog
        visible={shown === "block"}
        title={t("{name}님을 차단할까요?", { name })}
        body={t("서로 보이지 않고 대화할 수 없어요. 차단은 나 > 차단한 사람에서 풀 수 있어요.")}
        confirmLabel={t("차단하기")}
        danger
        busy={busy}
        onClose={() => setMode("menu")}
        onConfirm={() => void block()}
      />

      {partner ? (
        <ReportDialog
          partner={partner}
          visible={shown === "report"}
          onClose={() => setMode("menu")}
          onReported={(blocked) => {
            if (blocked) gone();
            else close();
          }}
        />
      ) : null}
    </>
  );
}
