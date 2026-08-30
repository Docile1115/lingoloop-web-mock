/**
 * 로그인 상태.
 *
 * 토큰을 우리가 들고 있지 않습니다 — 세션은 서버가 준 httpOnly 쿠키이고,
 * iOS·안드로이드의 네이티브 쿠키 항아리가 저장하고 다시 붙여줍니다.
 * 그래서 "로그인했나"는 저장된 값을 보는 게 아니라 서버에 물어서 압니다.
 *
 * 앱을 껐다 켜도 이 확인이 통과하면 그대로 이어집니다. 안드로이드에서 쿠키가
 * 앱 재시작 뒤 사라지는 알려진 문제가 있는데, 그러면 여기서 로그인 화면으로
 * 돌아갑니다 — 조용히 깨지지 않고 눈에 보이는 것이 중요합니다.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, get, post } from "./api";

export type Me = {
  id: string;
  name: string;
  handle: string;
  email: string;
  avatarUrl?: string;
  city?: string;
  bio?: string;
  age?: number;
  gender?: string;
  country?: { code: string; name: string; flag: string };
  nativeLanguages?: string[];
  learningLanguages?: Array<{ code: string; level: string; goal?: string }>;
};

type SessionValue = {
  me: Me | null;
  /** 첫 확인이 끝나기 전. 이 동안 로그인 화면을 보여주면 깜빡입니다. */
  checking: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** 프로필을 고친 뒤 서버 값을 다시 읽어옵니다. */
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionValue>({
  me: null,
  checking: true,
  signIn: async () => {},
  signOut: async () => {},
  refresh: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    get<{ user: Me }>("/api/auth/me")
      .then((data) => { if (alive) setMe(data.user); })
      .catch((error) => {
        // 401 은 "아직 로그인 안 함" 이라 정상입니다. 그 밖의 오류만 눈에 띄게 둡니다.
        if (alive && !(error instanceof ApiError && error.status === 401)) {
          console.warn("세션 확인 실패", error);
        }
      })
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await post<{ user: Me }>("/api/auth/login", { email, password });
    setMe(data.user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await post("/api/auth/logout", {});
    } finally {
      // 서버가 실패해도 화면에서는 내보냅니다 — 로그아웃을 눌렀는데 남아 있으면 안 됩니다.
      setMe(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    const data = await get<{ user: Me }>("/api/auth/me");
    setMe(data.user);
  }, []);

  const value = useMemo(
    () => ({ me, checking, signIn, signOut, refresh }),
    [me, checking, signIn, signOut, refresh],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
