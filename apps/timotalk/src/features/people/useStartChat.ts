/**
 * 다른 사람과 대화 시작하기(프로필·더 찾아보기).
 * 이미 대화(또는 요청)가 있으면 그 대화방으로 가고, 없으면 서버에 대화를 만든 뒤 엽니다.
 * 상대의 받는 메시지 설정에 따라 바로 열리거나(accepted) 요청이 됩니다(pending) — 서버가 정합니다.
 */
import { useState } from "react";
import { useRouter } from "expo-router";
import { useConversations } from "@/features/chats/store";
import { api, failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Conversation, Profile } from "@/lib/types";
import { showToast } from "@/ui/Toast";

export function useStartChat() {
  const router = useRouter();
  const { conversations, requests, upsert } = useConversations();
  const [busy, setBusy] = useState<string | null>(null);

  const existing = (partnerId: string) =>
    conversations.find((row) => row.partner?.id === partnerId) ?? requests.find((row) => row.partner?.id === partnerId);

  const start = async (partner: Profile) => {
    const found = existing(partner.id);
    if (found) {
      router.push({ pathname: "/chat/[id]", params: { id: found.id } });
      return;
    }
    if (busy) return;
    setBusy(partner.id);
    try {
      const conversation = await api<Conversation>("/api/conversations", { body: { partnerId: partner.id } });
      upsert(conversation);
      router.push({ pathname: "/chat/[id]", params: { id: conversation.id } });
    } catch (caught) {
      showToast(failureText(caught, t("대화를 열지 못했어요.")), "error");
    } finally {
      setBusy(null);
    }
  };

  return { start, busy, existing };
}
