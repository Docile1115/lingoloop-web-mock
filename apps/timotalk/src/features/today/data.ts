/**
 * 오늘 화면의 데이터: 오늘의 파트너와 AI 첫 인사.
 */
import { useCallback, useEffect, useState } from "react";
import { currentLocaleSnapshot } from "@shared/i18n/core";
import { api, failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { ConversationSupport, DailyMatches, Profile, Recommendation, SupportLine } from "@/lib/types";

/** 오늘 화면에 크게 보여줄 사람 수. 서버는 하루 최대 12명을 고르고, 나머지는 "더 찾아보기"에서 봅니다. */
export const TODAY_COUNT = 3;

export type Load<T> = { status: "loading" } | { status: "error"; error: string } | { status: "ready"; data: T };

export function useDailyMatches() {
  const [state, setState] = useState<Load<{ recommendations: Recommendation[]; targetLanguages: string[] }>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    api<DailyMatches>("/api/matching/daily")
      .then((data) => {
        if (!alive) return;
        setState({
          status: "ready",
          data: { recommendations: (data?.recommendations ?? []).slice(0, TODAY_COUNT), targetLanguages: data?.preferencesApplied?.targetLanguages ?? [] },
        });
      })
      .catch((caught) => {
        if (alive) setState({ status: "error", error: failureText(caught, t("불러오지 못했어요.")) });
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);
  return { state, reload };
}

/*
 * AI 첫 인사는 하루 AI 사용량(대화 도움 하루 30번)을 씁니다. 같은 날 같은 사람에게는
 * 한 번만 묻고 기억해 둡니다 — 화면을 오가도 다시 부르지 않습니다.
 */
const openerCache = new Map<string, SupportLine[]>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useOpeners(partner: Profile | null, fallback: string) {
  const key = partner ? `${todayKey()}:${currentLocaleSnapshot()}:${partner.id}` : "";
  // 받아 온 결과. 어느 사람(key)의 것인지 함께 둡니다 — 다른 사람으로 바뀌면 쓰지 않습니다.
  const [result, setResult] = useState<{ key: string; lines: SupportLine[]; status: "ready" | "fallback" } | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!partner || !key || openerCache.has(key)) return;
    let alive = true;
    api<ConversationSupport>("/api/conversation-support", {
      body: { partnerId: partner.id, stage: "first-message", locale: currentLocaleSnapshot() },
      slow: true,
    })
      .then((support) => {
        // 새 서버는 문장과 번역을 함께 줍니다. 예전 서버면 문장만 씁니다.
        const next = support.openers?.length ? support.openers : support.suggestedOpeners.map((text) => ({ text, translation: "" }));
        const usable = next.filter((line) => line.text.trim());
        if (!usable.length) throw new Error("empty");
        openerCache.set(key, usable);
        if (alive) setResult({ key, lines: usable, status: "ready" });
      })
      .catch(() => {
        // AI 를 못 쓰면(사용량 소진·일시 장애) 서버가 준 기본 인사로 시작합니다. 다음에 열면 다시 물어봅니다.
        if (alive) setResult({ key, lines: fallback ? [{ text: fallback, translation: "" }] : [], status: "fallback" });
      });
    return () => {
      alive = false;
    };
  }, [key, partner, fallback]);

  const cached = key ? openerCache.get(key) : undefined;
  const current = result?.key === key ? result : cached ? { key, lines: cached, status: "ready" as const } : null;
  const status: "idle" | "loading" | "ready" | "fallback" = !key ? "idle" : current ? current.status : "loading";
  const lines = current?.lines ?? [];
  const next = useCallback(() => setIndex((n) => n + 1), []);
  return { status, current: lines.length ? lines[index % lines.length] : undefined, hasAlternatives: lines.length > 1, next };
}

/** 메시지 id. 서버 문서 id 규칙(영문·숫자·_·-, 8자 이상)을 지킵니다. */
export function newMessageId(): string {
  return `app-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
