/**
 * 교환 세션 타이머. 앞 절반은 내가 배우는 말, 뒤 절반은 상대가 배우는 말(내 모국어)로 이야기합니다.
 * 이 기기에서만 재는 타이머입니다(상대 화면과 맞추는 실시간 세션은 3단계).
 * 대화방을 나갔다 와도 이어지도록 대화별로 기억합니다.
 */
import { useCallback, useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { showToast } from "@/ui/Toast";

export const SESSION_MINUTES = 20;

type Session = { startedAt: number; minutes: number };
const sessions = new Map<string, Session>();

export function useExchangeSession(conversationId: string, firstLanguage: string, secondLanguage: string) {
  const [session, setSession] = useState<Session | null>(() => sessions.get(conversationId) ?? null);
  const [now, setNow] = useState(() => Date.now());

  /* 1초마다 시계를 넘기고, 차례가 바뀌거나 끝나면 그 자리에서 알립니다(타이머 안에서 처리해
     렌더 도중에 상태를 다시 바꾸지 않습니다). 이미 절반을 넘긴 세션으로 돌아오면 다시 알리지 않습니다. */
  useEffect(() => {
    if (!session) return;
    const total = session.minutes * 60_000;
    const half = total / 2;
    let announcedHalf = Date.now() - session.startedAt >= half;
    const timer = setInterval(() => {
      const current = Date.now();
      const elapsed = current - session.startedAt;
      if (elapsed >= total) {
        clearInterval(timer);
        sessions.delete(conversationId);
        setSession(null);
        showToast(t("교환 세션을 마쳤어요. 수고했어요!"));
        return;
      }
      if (!announcedHalf && elapsed >= half) {
        announcedHalf = true;
        showToast(t("이제 {language} 차례예요", { language: secondLanguage }));
      }
      setNow(current);
    }, 1000);
    return () => clearInterval(timer);
  }, [session, conversationId, secondLanguage]);

  const start = useCallback(() => {
    const next = { startedAt: Date.now(), minutes: SESSION_MINUTES };
    sessions.set(conversationId, next);
    setNow(next.startedAt);
    setSession(next);
  }, [conversationId]);

  const stop = useCallback(() => {
    sessions.delete(conversationId);
    setSession(null);
  }, [conversationId]);

  const total = session ? session.minutes * 60_000 : 0;
  const half = total / 2;
  const elapsed = session ? Math.max(0, now - session.startedAt) : 0;
  const phase: "first" | "second" | null = !session || elapsed >= total ? null : elapsed < half ? "first" : "second";
  const remaining = phase === "first" ? half - elapsed : phase === "second" ? total - elapsed : 0;
  return {
    active: phase !== null,
    language: phase === "second" ? secondLanguage : firstLanguage,
    nextLanguage: phase === "first" ? secondLanguage : "",
    remaining,
    progress: phase === "first" ? elapsed / half : phase === "second" ? (elapsed - half) / half : 0,
    start,
    stop,
  };
}

/** 06:12 */
export function formatRemaining(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
