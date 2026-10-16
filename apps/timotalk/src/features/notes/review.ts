/**
 * 복습 일정. 처음엔 이 기기에만 둡니다(기획: 여러 기기 동기화가 필요해지면 서버로). lib/deviceStore 에 저장합니다.
 *
 * 간단한 상자 방식(라이트너): 알았으면 다음 상자로(1→3→7→14→30일 뒤), 다시 보기로 하면 첫 상자(내일).
 * 처음 보는 문장은 바로 복습 대상입니다. 한 번에 최대 SESSION_SIZE 개 — "3분 복습".
 * 날짜는 이 기기의 날짜(YYYY-MM-DD)로 셉니다. 연속 학습일은 오늘(또는 어제)까지 하루도 빠지지 않고 복습한 날 수입니다.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { readJson, writeJson } from "@/lib/deviceStore";
import type { ReceivedCorrection, SavedPhrase } from "@/lib/types";

const STORE_KEY = "review-v1";
const INTERVALS = [1, 3, 7, 14, 30];
export const SESSION_SIZE = 10;

type Slot = { box: number; due: string };
export type ReviewState = { schedule: Record<string, Slot>; log: Record<string, number> };

export type ReviewItem =
  | { key: string; kind: "correction"; correction: ReceivedCorrection }
  | { key: string; kind: "phrase"; phrase: SavedPhrase };

export function localDay(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return localDay(new Date(year, month - 1, date + days));
}

/** 오늘 복습할 것: 교정(최근 것부터) 다음 저장한 표현. 일정에 없거나 기한이 된 것만. */
export function dueItems(corrections: ReceivedCorrection[], phrases: SavedPhrase[], state: ReviewState, today = localDay()): ReviewItem[] {
  const due = (key: string) => {
    const slot = state.schedule[key];
    return !slot || slot.due <= today;
  };
  const items: ReviewItem[] = [
    // 대화 교정(메시지 id)과 글 교정(댓글 id)은 서로 다른 곳에서 정한 id 라 출처까지 붙여 구분합니다.
    ...corrections.map((correction) => ({ key: `c:${correction.source ?? "community"}:${correction.id}`, kind: "correction" as const, correction })),
    ...phrases.filter((phrase) => phrase.meaning.trim()).map((phrase) => ({ key: `p:${phrase.id}`, kind: "phrase" as const, phrase })),
  ];
  return items.filter((item) => due(item.key));
}

export function nextState(state: ReviewState, key: string, knew: boolean, today = localDay()): ReviewState {
  const box = knew ? Math.min((state.schedule[key]?.box ?? -1) + 1, INTERVALS.length - 1) : 0;
  return {
    schedule: { ...state.schedule, [key]: { box, due: addDays(today, knew ? INTERVALS[box] : 1) } },
    log: { ...state.log, [today]: (state.log[today] ?? 0) + 1 },
  };
}

/** 오늘(오늘 아직 안 했으면 어제)부터 거꾸로 하루도 빠지지 않은 날 수 */
export function streak(log: Record<string, number>, today = localDay()): number {
  let day = log[today] ? today : addDays(today, -1);
  let count = 0;
  while (log[day]) {
    count += 1;
    day = addDays(day, -1);
  }
  return count;
}

/** 최근 7일(오늘 포함) 동안 복습한 문장 수 */
export function weekCount(log: Record<string, number>, today = localDay()): number {
  let total = 0;
  for (let offset = 0; offset < 7; offset += 1) total += log[addDays(today, -offset)] ?? 0;
  return total;
}

const EMPTY: ReviewState = { schedule: {}, log: {} };

/*
 * 복습 상태는 노트와 복습 화면이 함께 봅니다 — 복습을 마치고 돌아오면 노트의 숫자도 바로 바뀌어야 합니다.
 * 그래서 화면마다 따로 읽지 않고 계정별로 하나를 두고 구독합니다(한 기기를 두 계정이 써도 섞이지 않게).
 */
const states = new Map<string, ReviewState>();
const loads = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
const storeKey = (userId: string) => `${STORE_KEY}-${userId}`;
const notify = () => listeners.forEach((listener) => listener());

function load(userId: string) {
  if (!loads.has(userId)) {
    loads.set(
      userId,
      readJson<ReviewState>(storeKey(userId), EMPTY).then((stored) => {
        states.set(userId, { schedule: stored.schedule ?? {}, log: stored.log ?? {} });
        notify();
      }),
    );
  }
  return loads.get(userId);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useReviewState(userId: string) {
  const state = useSyncExternalStore(
    subscribe,
    () => states.get(userId) ?? null,
    () => states.get(userId) ?? null,
  );

  useEffect(() => {
    void load(userId);
  }, [userId]);

  const grade = useCallback(
    (key: string, knew: boolean) => {
      const next = nextState(states.get(userId) ?? EMPTY, key, knew);
      states.set(userId, next);
      void writeJson(storeKey(userId), next);
      notify();
    },
    [userId],
  );

  return { state, grade };
}
