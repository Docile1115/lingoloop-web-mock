/**
 * 로그인 상태.
 *
 * 실제 API 인증은 서버가 준 httpOnly 쿠키이고 iOS·안드로이드의 네이티브 쿠키
 * 저장소가 붙입니다. Firebase ID/refresh token은 앱 저장소에 남기지 않습니다.
 * 앱을 열 때 서버에 확인하고, 사용 중 세션이 만료되어 401이 오면 로그인 화면으로
 * 돌아갑니다.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, get, post, setUnauthorizedHandler } from "./api";
import type { FirebaseSessionCredential } from "./socialAuth";

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
  signIn: (credential: FirebaseSessionCredential) => Promise<void>;
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
    // 어느 화면의 API 호출에서든 세션 만료가 확인되면 즉시 인증 화면으로 돌아갑니다.
    setUnauthorizedHandler(() => setMe(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let alive = true;
    get<{ user: Me }>("/api/auth/me")
      .then((data) => { if (alive) setMe(data.user); })
      .catch((error) => {
        // 401은 "아직 로그인 안 함"이라 정상입니다. 그 밖의 오류만 기록합니다.
        if (alive && !(error instanceof ApiError && error.status === 401)) {
          console.warn("세션 확인 실패", error);
        }
      })
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, []);

  const signIn = useCallback(async (credential: FirebaseSessionCredential) => {
    const data = await post<{ user: Me }>("/api/auth/session", {
      idToken: credential.idToken,
    });
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
