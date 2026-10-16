/**
 * 다른 사람 프로필의 메뉴: 차단 · 신고. 대화방 밖(프로필·더 찾아보기)에서 씁니다.
 * 차단하면 그 사람과의 대화도 목록에서 빼고 onBlocked 를 부릅니다(화면을 닫게).
 */
import { useState } from "react";
import { failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Profile } from "@/lib/types";
import { ConfirmDialog, Dialog } from "@/ui/Dialog";
import { ListGroup, ListRow } from "@/ui/List";
import { showToast } from "@/ui/Toast";
import { blockUser } from "@/features/chats/actions";
import { ReportDialog } from "@/features/chats/ReportDialog";
import { useConversations } from "@/features/chats/store";

type Mode = "menu" | "block" | "report" | null;

export function PartnerMenu({ partner, open, onClose, onBlocked }: { partner: Profile; open: boolean; onClose: () => void; onBlocked: () => void }) {
  const { conversations, requests, remove } = useConversations();
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const shown: Mode = open ? (mode ?? "menu") : null;

  const close = () => {
    if (busy) return;
    setMode(null);
    onClose();
  };

  const blocked = () => {
    for (const row of [...conversations, ...requests]) if (row.partner?.id === partner.id) remove(row.id);
    setMode(null);
    onClose();
    onBlocked();
  };

  const block = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await blockUser(partner.id);
      showToast(t("{name}님을 차단했어요", { name: partner.name }));
      blocked();
    } catch (caught) {
      showToast(failureText(caught, t("차단하지 못했어요.")), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog visible={shown === "menu"} title={partner.name} onClose={close}>
        <ListGroup>
          <ListRow icon="block" title={t("차단하기")} danger onPress={() => setMode("block")} trailing={null} />
          <ListRow icon="flag" title={t("신고하기")} danger onPress={() => setMode("report")} trailing={null} />
        </ListGroup>
      </Dialog>
      <ConfirmDialog
        visible={shown === "block"}
        title={t("{name}님을 차단할까요?", { name: partner.name })}
        body={t("서로 보이지 않고 대화할 수 없어요. 차단은 나 > 차단한 사람에서 풀 수 있어요.")}
        confirmLabel={t("차단하기")}
        danger
        busy={busy}
        onClose={() => setMode("menu")}
        onConfirm={() => void block()}
      />
      <ReportDialog
        partner={partner}
        visible={shown === "report"}
        onClose={() => setMode("menu")}
        onReported={(wasBlocked) => {
          if (wasBlocked) blocked();
          else close();
        }}
      />
    </>
  );
}
