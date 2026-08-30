/**
 * 서버에서 받아오는 화면의 공통 상태.
 *
 * 화면마다 loading·error·refreshing 을 따로 쓰면 매번 조금씩 달라집니다.
 * 특히 "못 받아왔을 때 무엇을 보여줄지" 가 어긋나기 쉬워서 한곳에 둡니다 —
 * 실패했을 때 빈 목록만 보여주면 데이터가 없는 건지 못 받은 건지 알 수 없습니다.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError, get } from "./api";

export type Loadable<T> = {
  data: T;
  loading: boolean;
  refreshing: boolean;
  /** 사람이 읽을 수 있는 실패 이유. 빈 문자열이면 실패하지 않은 것입니다. */
  error: string;
  refresh: () => void;
  /** 목록을 화면에서 직접 고칠 때(좋아요 등). 서버 재요청 없이 즉시 반영합니다. */
  set: React.Dispatch<React.SetStateAction<T>>;
};

export function useApi<T>(path: string | null, initial: T, pick: (raw: never) => T): Loadable<T> {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(path !== null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) { setLoading(false); return; }
    let alive = true;
    setError("");
    get(path)
      .then((raw) => { if (alive) setData(pick(raw as never)); })
      .catch((caught) => {
        if (!alive) return;
        setError(caught instanceof ApiError ? caught.message : "불러오지 못했어요.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => { alive = false; };
    // pick 은 화면마다 인라인으로 넘기는 함수라 매 렌더 새로 만들어집니다.
    // 의존성에 넣으면 무한 요청이 됩니다 — path 와 tick 만 봅니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setTick((n) => n + 1);
  }, []);

  return { data, loading, refreshing, error, refresh, set: setData };
}
