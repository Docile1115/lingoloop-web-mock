/**
 * 노트의 재료: 받은 교정(대화·커뮤니티)과 저장한 표현.
 *  - GET /api/corrections/received?include=chat — 대화에서 받은 교정까지 함께(옛 웹은 이 값을 보내지 않습니다)
 *  - GET /api/saved-phrases, DELETE /api/saved-phrases/:id
 */
import { useCallback, useEffect, useState } from "react";
import { api, failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { ReceivedCorrection, SavedPhrase } from "@/lib/types";

export type NotesData = { corrections: ReceivedCorrection[]; phrases: SavedPhrase[] };
type State = { status: "loading" } | { status: "error"; error: string } | { status: "ready"; data: NotesData };

export function useNotesData() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api<ReceivedCorrection[]>("/api/corrections/received?include=chat"),
      api<SavedPhrase[]>("/api/saved-phrases"),
    ])
      .then(([corrections, phrases]) => {
        if (!alive) return;
        setState({
          status: "ready",
          data: {
            corrections: [...(corrections ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
            phrases: [...(phrases ?? [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
          },
        });
      })
      .catch((caught) => {
        if (alive) setState({ status: "error", error: failureText(caught, t("불러오지 못했어요.")) });
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  /** 저장한 표현 지우기. 화면에서 먼저 빼고, 실패하면 다시 받습니다. */
  const removePhrase = useCallback(
    async (id: string) => {
      setState((current) =>
        current.status === "ready" ? { status: "ready", data: { ...current.data, phrases: current.data.phrases.filter((row) => row.id !== id) } } : current,
      );
      try {
        await api(`/api/saved-phrases/${encodeURIComponent(id)}`, { method: "DELETE" });
        return true;
      } catch {
        reload();
        return false;
      }
    },
    [reload],
  );

  return { state, reload, removePhrase };
}
