/**
 * 화면 사이의 작은 신호.
 *
 * 한 화면에서 저장한 것이 다른 화면이 받아 둔 목록을 낡게 만들 때 씁니다
 * (예: 매칭 조건을 저장하면 오늘의 파트너 목록을 다시 받아야 합니다).
 * 돌아올 때마다 다시 받으면 요청이 쓸데없이 늘어서, 바뀌었을 때만 알립니다.
 */
import { useEffect, useRef } from "react";

export type Signal = "matching-preferences";

const listeners = new Map<Signal, Set<() => void>>();

export function emitSignal(signal: Signal) {
  for (const listener of listeners.get(signal) ?? []) listener();
}

export function useSignal(signal: Signal, handler: () => void) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const listener = () => latest.current();
    const set = listeners.get(signal) ?? new Set<() => void>();
    listeners.set(signal, set);
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }, [signal]);
}
