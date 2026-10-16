/**
 * 앱 안 알림(GET /api/notifications). 오늘 화면의 종 모양과 알림 화면이 같은 값을 봅니다.
 * 앱이 앞에 있는 동안 1분마다 다시 받습니다(대화 목록과 같은 주기).
 *
 * 읽음 표시는 서버가 알림 문서마다 eventId 로 확인합니다 — 같은 대화의 새 메시지가 그 사이 같은 문서를
 * 덮었다면, 화면이 본 예전 이벤트만 읽은 것으로 남고 새 메시지는 안 읽은 채로 둡니다.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Profile } from "@/lib/types";
import { useAppActive } from "@/lib/useAppActive";

const REFRESH_MS = 60_000;

export type NotificationType =
  | "home_entry"
  | "home_reply"
  | "home_visit"
  | "home_heart"
  | "post_like"
  | "post_reply"
  | "post_correction"
  | "comment_reply"
  | "partner_like"
  | "follow"
  | "message_request"
  | "request_accepted"
  | "message";

export type AppNotification = {
  id: string;
  type: NotificationType;
  actorId: string;
  actor: Profile | null;
  postId?: string;
  replyId?: string;
  conversationId?: string;
  homeOwnerId?: string;
  eventId: string;
  excerpt?: string;
  createdAt: string;
  readAt: string | null;
};

type NotificationsValue = {
  items: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  markRead: (notification: AppNotification) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsValue | null>(null);

export function NotificationsProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const ticket = useRef(0);
  const active = useAppActive();

  const load = useCallback(
    (mine: number) =>
      api<{ items: AppNotification[]; unreadCount: number }>("/api/notifications")
        .then((data) => {
          if (mine !== ticket.current) return;
          setItems(data?.items ?? []);
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

  useEffect(() => {
    if (enabled) void load(++ticket.current);
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled || !active) return;
    const timer = setInterval(() => void reload(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [enabled, active, reload]);

  const markRead = useCallback(async (notification: AppNotification) => {
    if (notification.readAt) return;
    const readAt = new Date().toISOString();
    setItems((rows) => rows.map((row) => (row.id === notification.id ? { ...row, readAt } : row)));
    try {
      await api(`/api/notifications/${encodeURIComponent(notification.id)}/read`, { method: "PATCH", body: { eventId: notification.eventId } });
    } catch {
      // 읽음 표시가 실패해도 화면 이동은 막지 않습니다. 다음에 받을 때 서버 값으로 돌아옵니다.
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const readAt = new Date().toISOString();
    setItems((rows) => rows.map((row) => (row.readAt ? row : { ...row, readAt })));
    try {
      await api("/api/notifications/read-all", { body: {} });
    } finally {
      void reload();
    }
  }, [reload]);

  const unreadCount = useMemo(() => items.filter((row) => !row.readAt).length, [items]);
  const value = useMemo(
    () => ({ items, unreadCount, loading, error, reload, markRead, markAllRead }),
    [items, unreadCount, loading, error, reload, markRead, markAllRead],
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsValue {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error("useNotifications must be used inside NotificationsProvider");
  return value;
}
