/**
 * 로그인 상태.
 *
 * 서버가 httpOnly 쿠키로 세션을 들고 있으므로 앱은 토큰을 저장하지 않습니다.
 * 앱을 열 때 /api/auth/me 로 확인하고, 사용 중 401 이 오면 로그인 화면으로 돌아갑니다.
 * 서버에 닿지 않을 때는 로그아웃시키지 않고 "다시 시도"를 보여줍니다(unavailable).
 * 로그아웃할 때는 먼저 이 기기를 폰 알림에서 뺍니다 — 다음 사람이 앞사람의 알림을 받지 않게.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, api, onUnauthorized } from "./api";
import { t } from "./i18n";
import { forgetPush } from "./push";
import type { Profile } from "./types";

export type SessionStatus = "checking" | "in" | "out" | "unavailable";

type SessionValue = {
  status: SessionStatus;
  me: Profile | null;
  /** 신고 검토(운영자 화면)를 볼 수 있는 사람인가(서버 ADMIN_UIDS) */
  isAdmin: boolean;
  /** 로그인 화면이나 "다시 시도" 화면에 보여줄 이유 */
  problem: string;
  retry: () => void;
  signIn: (firebaseIdToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** 프로필을 고친 뒤 서버 값으로 바꿉니다. */
  setMe: (profile: Profile) => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("checking");
  const [me, setMeState] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [problem, setProblem] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => onUnauthorized(() => {
    setMeState(null);
    setIsAdmin(false);
    setProblem(t("로그인이 만료됐어요. 다시 로그인해 주세요."));
    setStatus("out");
  }), []);

  useEffect(() => {
    let alive = true;
    api<{ user: Profile; isAdmin?: boolean }>("/api/auth/me")
      .then((data) => {
        if (!alive) return;
        setMeState(data.user);
        setIsAdmin(Boolean(data.isAdmin));
        setProblem("");
        setStatus("in");
      })
      .catch((caught) => {
        if (!alive) return;
        if (caught instanceof ApiError && (caught.status === 401 || caught.status === 403)) {
          // 401 은 "아직 로그인 안 함"이라 정상입니다. 403 은 이용 제한 등 — 이유를 보여줍니다.
          setProblem(caught.status === 403 ? caught.message : "");
          setStatus("out");
          return;
        }
        setProblem(caught instanceof ApiError && caught.message ? caught.message : t("서버에 연결하지 못했어요."));
        setStatus("unavailable");
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setStatus("checking");
    setAttempt((n) => n + 1);
  }, []);

  const signIn = useCallback(async (firebaseIdToken: string) => {
    const data = await api<{ user: Profile; isAdmin?: boolean }>("/api/auth/session", { body: { idToken: firebaseIdToken } });
    setMeState(data.user);
    setIsAdmin(Boolean(data.isAdmin));
    setProblem("");
    setStatus("in");
  }, []);

  const signOut = useCallback(async () => {
    try {
      await forgetPush();
      await api("/api/auth/logout", { body: {} });
    } finally {
      // 서버에 닿지 못해도 화면에서는 내보냅니다 — 로그아웃을 눌렀는데 남아 있으면 안 됩니다.
      setMeState(null);
      setIsAdmin(false);
      setProblem("");
      setStatus("out");
    }
  }, []);

  const setMe = useCallback((profile: Profile) => setMeState(profile), []);

  const value = useMemo(
    () => ({ status, me, isAdmin, problem, retry, signIn, signOut, setMe }),
    [status, me, isAdmin, problem, retry, signIn, signOut, setMe],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}

/** 로그인한 화면에서만 씁니다. */
export function useMe(): Profile {
  const { me } = useSession();
  if (!me) throw new Error("useMe used while signed out");
  return me;
}
