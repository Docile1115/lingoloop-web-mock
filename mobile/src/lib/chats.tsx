/**
 * 대화 목록 — 받은 대화함과 메시지 요청함.
 *
 * 대화 탭의 목록, 대화방의 요청 수락·알림 끄기·나가기가 같은 값을 봐야 해서 화면마다
 * 따로 받지 않고 여기 한곳에 둡니다. 따로 받으면 요청을 수락하거나 방을 나가도
 * 다른 화면의 목록에는 그대로 남습니다.
 *
 * 웹(LingoLoopApp 의 loadChats)과 같이 두 함을 함께 받습니다.
 *  - /api/conversations                → 수락된 대화 + 내가 보낸(아직 대기 중인) 요청
 *  - /api/conversations?box=requests   → 내가 받은 메시지 요청
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toConversation, type ApiConversation } from "@shared/live-data";
import type { Conversation } from "@shared/demo-data";
import { ApiError, get } from "./api";
import { t } from "./i18n";

type ChatsValue = {
  /** 받은 대화함. 수락된 대화와 내가 보낸 대기 중 요청입니다. */
  conversations: Conversation[];
  /** 내가 받은 메시지 요청. 수락하기 전에는 답장할 수 없습니다. */
  requests: Conversation[];
  /** 내가 보냈고 상대가 아직 수락하지 않은 대화. 서버가 "나가기"를 받지 않습니다. */
  pendingIds: ReadonlySet<string>;
  loading: boolean;
  refreshing: boolean;
  /** 사람이 읽을 수 있는 실패 이유. 빈 문자열이면 실패하지 않은 것입니다. */
  error: string;
  /** 당겨서 새로고침 표시 없이 다시 받습니다. */
  reload: () => Promise<void>;
  /** 당겨서 새로고침. */
  refresh: () => void;
  /** 서버에 반영된 변경(알림 끄기 등)을 다시 받지 않고 바로 보여줍니다. */
  update: (id: string, patch: Partial<Conversation>) => void;
  /** 나가기·차단·요청 삭제가 끝난 방을 목록에서 뺍니다. */
  remove: (id: string) => void;
};

type Edit = { seq: number; apply: (rows: Conversation[]) => Conversation[] };

const ChatsContext = createContext<ChatsValue | null>(null);

export function ChatsProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [requests, setRequests] = useState<Conversation[]>([]);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  // 늦게 도착한 이전 요청의 응답은 버립니다(가장 나중에 보낸 요청만 씁니다).
  const generation = useRef(0);
  /* 받는 동안 화면에서 고친 것(방금 나간 방, 알림 끄기)은 응답 위에 다시 얹습니다.
     서버가 이미 반영했어도 같은 결과라 두 번 얹어도 괜찮습니다 — 안 얹으면 나간 방이 되살아납니다. */
  const edits = useRef<Edit[]>([]);
  const editSeq = useRef(0);

  const reload = useCallback(async () => {
    const ticket = ++generation.current;
    const since = editSeq.current;
    try {
      const [inbox, incoming] = await Promise.all([
        get<ApiConversation[]>("/api/conversations"),
        get<ApiConversation[]>("/api/conversations?box=requests"),
      ]);
      if (ticket !== generation.current) return;
      const later = edits.current.filter((edit) => edit.seq > since);
      edits.current = later;
      const settle = (rows: Conversation[]) => later.reduce((current, edit) => edit.apply(current), rows);
      // .map(toConversation) 로 쓰면 map 이 넘기는 index 가 두 번째 인자(messages)로 들어갑니다.
      setConversations(settle((inbox ?? []).map((row) => toConversation(row))));
      setRequests(settle((incoming ?? []).map((row) => toConversation(row))));
      setPendingIds(new Set((inbox ?? []).filter((row) => row.requestStatus === "pending").map((row) => row.id)));
      setError("");
    } catch (caught) {
      // 실패해도 이미 받아 둔 목록은 그대로 둡니다. 비어 있을 때만 화면이 이유와 다시 시도를 보여줍니다.
      if (ticket === generation.current) {
        setError(caught instanceof ApiError ? caught.message : t("불러오지 못했어요."));
      }
    } finally {
      if (ticket === generation.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void reload();
  }, [reload]);

  const edit = useCallback((apply: (rows: Conversation[]) => Conversation[]) => {
    editSeq.current += 1;
    edits.current.push({ seq: editSeq.current, apply });
    setConversations(apply);
    setRequests(apply);
  }, []);

  const update = useCallback(
    (id: string, patch: Partial<Conversation>) =>
      edit((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row))),
    [edit],
  );

  const remove = useCallback(
    (id: string) => edit((rows) => rows.filter((row) => row.id !== id)),
    [edit],
  );

  const value = useMemo(
    () => ({ conversations, requests, pendingIds, loading, refreshing, error, reload, refresh, update, remove }),
    [conversations, requests, pendingIds, loading, refreshing, error, reload, refresh, update, remove],
  );
  return <ChatsContext.Provider value={value}>{children}</ChatsContext.Provider>;
}

export function useChats(): ChatsValue {
  const value = useContext(ChatsContext);
  if (!value) throw new Error("useChats must be used inside ChatsProvider");
  return value;
}
