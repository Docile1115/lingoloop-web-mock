/**
 * 대화 목록. 탭 배지·오늘의 "내 차례"·대화 탭·대화방이 같은 값을 봅니다.
 * 따로 받으면 대화방에서 읽어도 다른 화면의 안 읽음 수가 그대로 남습니다.
 *
 * 앱이 앞에 있는 동안 1분마다 다시 받습니다(대화방 안은 따로 더 자주 받습니다).
 * 늦게 도착한 이전 응답은 버립니다.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Conversation } from "@/lib/types";
import { useAppActive } from "@/lib/useAppActive";

const LIST_REFRESH_MS = 60_000;

type ConversationsValue = {
  conversations: Conversation[];
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  /** 대화방을 열어 서버가 읽음 처리한 뒤, 목록의 안 읽음 수를 바로 지웁니다. */
  markRead: (id: string) => void;
  /** 새로 만든 대화나 바뀐 대화를 목록에 바로 반영합니다. */
  upsert: (conversation: Conversation) => void;
  unreadTotal: number;
};

const ConversationsContext = createContext<ConversationsValue | null>(null);

function sortByRecent(rows: Conversation[]): Conversation[] {
  return [...rows].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function ConversationsProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const ticket = useRef(0);
  const active = useAppActive();

  /** 늦게 도착한 이전 응답은 버립니다(가장 나중에 보낸 요청만 씁니다). */
  const load = useCallback(
    (mine: number) =>
      api<Conversation[]>("/api/conversations")
        .then((rows) => {
          if (mine !== ticket.current) return;
          setConversations(sortByRecent(rows ?? []));
          setError("");
        })
        .catch((caught) => {
          if (mine === ticket.current) setError(failureText(caught, t("불러오지 못했어요.")));
        })
        .finally(() => {
          if (mine === ticket.current) setLoading(false);
        }),
    [],
  );

  const reload = useCallback(() => load(++ticket.current), [load]);

  // 로그아웃하면 바깥(_layout)이 key 를 바꿔 이 저장소를 새로 만듭니다 — 남의 목록이 남지 않습니다.
  useEffect(() => {
    if (enabled) void load(++ticket.current);
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled || !active) return;
    const timer = setInterval(() => void reload(), LIST_REFRESH_MS);
    return () => clearInterval(timer);
  }, [enabled, active, reload]);

  const markRead = useCallback((id: string) => {
    setConversations((rows) => rows.map((row) => (row.id === id && row.unreadCount ? { ...row, unreadCount: 0 } : row)));
  }, []);

  const upsert = useCallback((conversation: Conversation) => {
    setConversations((rows) => sortByRecent([conversation, ...rows.filter((row) => row.id !== conversation.id)]));
  }, []);

  const unreadTotal = useMemo(() => conversations.reduce((sum, row) => sum + (row.unreadCount || 0), 0), [conversations]);

  const value = useMemo(
    () => ({ conversations, loading, error, reload, markRead, upsert, unreadTotal }),
    [conversations, loading, error, reload, markRead, upsert, unreadTotal],
  );
  return <ConversationsContext.Provider value={value}>{children}</ConversationsContext.Provider>;
}

export function useConversations(): ConversationsValue {
  const value = useContext(ConversationsContext);
  if (!value) throw new Error("useConversations must be used inside ConversationsProvider");
  return value;
}

/** 상대가 마지막으로 말한 대화 — 내가 답할 차례 */
export function isMyTurn(conversation: Conversation): boolean {
  return Boolean(conversation.partner && conversation.lastSenderId === conversation.partner.id && conversation.requestStatus !== "pending");
}
