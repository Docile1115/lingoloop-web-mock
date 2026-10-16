/**
 * 대화방 메시지.
 *
 * 처음에는 최근 메시지를 통째로, 그 뒤로는 ?after= 로 새것만 받습니다.
 * 같은 id 는 새 값으로 바꾸고 보낸 시각 순서로 둡니다 — 내가 보낸 말이 갱신으로 또 와도 한 번만 보입니다.
 * 보낸 시각을 기준점(latestAt)으로 쓰지 않습니다. 그 사이 상대가 보낸 말을 건너뛰게 됩니다.
 */
import { useCallback, useRef, useState } from "react";
import { api, failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Message } from "@/lib/types";
import { newMessageId } from "@/features/today/data";

export type ChatMessage = Message & { state?: "sending" | "failed" };

/**
 * 보낼 말. 사진·음성은 media(데이터 URI)를 담고, text 는 비워 두면 서버가 목록에 보일 한 줄("사진"·"음성 메시지")을 채웁니다.
 * 교정은 text 가 고친 문장이고 targetMessageId 로 고친 메시지를 가리킵니다. original 은 보내는 동안 화면에만 씁니다
 * (서버는 대상 메시지에서 원문을 직접 복사합니다).
 */
export type Outgoing = {
  type: "text" | "image" | "voice" | "correction";
  text: string;
  media?: string;
  targetMessageId?: string;
  original?: string;
  note?: string;
};

function merge(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (!incoming.length) return current;
  const byId = new Map(current.map((row) => [row.id, row]));
  for (const row of incoming) byId.set(row.id, row);
  return [...byId.values()].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}

export function useMessages(conversationId: string, myId: string, onFetched?: (newFromPartner: boolean) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const latestAt = useRef("");
  const fetching = useRef(false);

  const fetchMessages = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    const after = latestAt.current;
    try {
      const rows = await api<Message[]>(
        `/api/conversations/${encodeURIComponent(conversationId)}/messages${after ? `?after=${encodeURIComponent(after)}` : ""}`,
      );
      let newFromPartner = false;
      for (const row of rows ?? []) {
        if (row.sentAt > latestAt.current) latestAt.current = row.sentAt;
        if (row.senderId !== myId) newFromPartner = true;
      }
      setMessages((current) => merge(current, rows ?? []));
      setStatus("ready");
      setError("");
      onFetched?.(newFromPartner);
    } catch (caught) {
      // 주기적 받기가 실패하면 조용히 넘기고 다음 차례에 다시 받습니다. 처음 받기만 알립니다.
      setStatus((current) => (current === "ready" ? current : "error"));
      setError(failureText(caught, t("불러오지 못했어요.")));
    } finally {
      fetching.current = false;
    }
  }, [conversationId, myId, onFetched]);

  const send = useCallback(
    async (payload: Outgoing | string): Promise<boolean> => {
      const outgoing: Outgoing = typeof payload === "string" ? { type: "text", text: payload } : payload;
      const id = newMessageId();
      const optimistic: ChatMessage = {
        id,
        conversationId,
        senderId: myId,
        type: outgoing.type,
        text: outgoing.text,
        media: outgoing.media,
        original: outgoing.original,
        targetMessageId: outgoing.targetMessageId,
        note: outgoing.note,
        sentAt: new Date().toISOString(),
        state: "sending",
      };
      setMessages((current) => merge(current, [optimistic]));
      try {
        const result = await api<{ message: Message }>(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
          body: {
            type: outgoing.type,
            text: outgoing.text,
            ...(outgoing.media ? { media: outgoing.media } : {}),
            ...(outgoing.type === "correction" ? { targetMessageId: outgoing.targetMessageId, note: outgoing.note ?? "" } : {}),
            clientMessageId: id,
          },
          // 사진·음성은 수백 KB 라 느린 망에서 올리는 데 오래 걸릴 수 있습니다.
          slow: outgoing.type !== "text",
        });
        // 서버는 보낸 id(clientMessageId)를 그대로 씁니다 — 같은 id 라 화면의 임시 말풍선을 바꿉니다.
        setMessages((current) => merge(current, [result.message]));
        return true;
      } catch (caught) {
        setMessages((current) => current.map((row) => (row.id === id ? { ...row, state: "failed" } : row)));
        setError(failureText(caught, t("보내지 못했어요.")));
        return false;
      }
    },
    [conversationId, myId],
  );

  /** 보내지 못한 말을 지우고 새로 보냅니다(같은 id 로 다시 보내면 서버가 거절할 수 있습니다). */
  const resend = useCallback(
    async (message: ChatMessage) => {
      setMessages((current) => current.filter((row) => row.id !== message.id));
      return send({
        type: message.type,
        text: message.type === "text" || message.type === "correction" ? message.text : "",
        media: message.media,
        targetMessageId: message.targetMessageId,
        original: message.original,
        note: message.note,
      });
    },
    [send],
  );

  return { messages, status, error, fetchMessages, send, resend };
}
