/**
 * 로그인 상태.
 *
 * 실제 API 인증은 서버가 준 httpOnly 쿠키이고 iOS·안드로이드의 네이티브 쿠키
 * 저장소가 붙입니다. Firebase ID/refresh token은 앱 저장소에 남기지 않습니다.
 * 앱을 열 때 서버에 확인하고, 사용 중 세션이 만료되어 401이 오면 로그인 화면으로
 * 돌아갑니다.
 *
 * 401 만 로그인을 지웁니다. 연결 끊김·시간 초과·5xx·503 은 잠깐의 문제라서
 * 마지막으로 받은 프로필로 앱을 열거나(있으면) "다시 시도"를 보여줍니다 —
 * 지하철에서 앱을 열 때마다 로그인 화면으로 쫓겨나면 안 됩니다.
 *
 * 기기에는 토큰 대신 두 가지만 남깁니다(앱 문서 폴더, 앱을 지우면 함께 지워짐):
 *  - 마지막 프로필: 서버에 닿지 않을 때 앱을 열기 위해
 *  - 로그아웃 미완료 표시: 오프라인에서 로그아웃하면 서버가 쿠키를 지우지 못했으므로,
 *    다음 실행 때 로그아웃을 먼저 다시 보내고 그 전에는 로그인된 것으로 보지 않습니다.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { File, Paths } from "expo-file-system";
import type { AvatarConfig, AvatarMode } from "@shared/avatar";
import type { RoomConfig } from "@shared/room";
import { ApiError, get, isTransient, post, setUnauthorizedHandler } from "./api";
import { t } from "./i18n";
import type { FirebaseSessionCredential } from "./socialAuth";

export type Me = {
  id: string;
  name: string;
  handle: string;
  email: string;
  avatarUrl?: string;
  avatarMode?: AvatarMode;
  avatarConfig?: AvatarConfig | null;
  roomConfig?: RoomConfig | null;
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
  /** 서버에 닿지 못해 로그인 여부를 확인하지 못했을 때의 이유. 비어 있으면 문제없음입니다. */
  unavailable: string;
  /** 첫 확인을 다시 합니다(unavailable 화면의 "다시 시도"). */
  retry: () => void;
  signIn: (credential: FirebaseSessionCredential) => Promise<void>;
  signOut: () => Promise<void>;
  /** 프로필을 고친 뒤 서버 값을 다시 읽어옵니다. */
  refresh: () => Promise<void>;
  /** PATCH /api/profile* 가 돌려준 최신 프로필을 그대로 반영합니다. 다시 요청하지 않습니다. */
  applyMe: (next: Me) => void;
};

const SessionContext = createContext<SessionValue>({
  me: null,
  checking: true,
  unavailable: "",
  retry: () => {},
  signIn: async () => {},
  signOut: async () => {},
  refresh: async () => {},
  applyMe: () => {},
});

type Stored = { me?: Me; pendingLogout?: boolean };

const storeFile = () => new File(Paths.document, "timotalk-session.json");

function readStored(): Stored {
  try {
    const file = storeFile();
    if (!file.exists) return {};
    const value = JSON.parse(file.textSync()) as Stored;
    return value && typeof value === "object" ? value : {};
  } catch {
    // 읽지 못하면 아무것도 기억하지 않은 것으로 봅니다(서버에 다시 묻습니다).
    return {};
  }
}

function writeStored(value: Stored) {
  try {
    const file = storeFile();
    if (!file.exists) file.create({ intermediates: true });
    file.write(JSON.stringify(value));
  } catch {
    // 기기 저장에 실패해도 이번 실행은 그대로 동작합니다.
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);
  const [unavailable, setUnavailable] = useState("");
  const [attempt, setAttempt] = useState(0);
  /** 서버 확인 없이 기기에 남은 프로필로 연 상태. 앱이 다시 앞으로 오면 서버에 다시 묻습니다. */
  const fromCache = useRef(false);

  const keep = useCallback((next: Me | null) => {
    setMe(next);
    if (next) writeStored({ me: next });
  }, []);

  useEffect(() => {
    // 어느 화면의 API 호출에서든 세션 만료(401)가 확인되면 즉시 인증 화면으로 돌아갑니다.
    setUnauthorizedHandler(() => {
      fromCache.current = false;
      writeStored({});
      setMe(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let alive = true;
    const stored = readStored();
    const check = async () => {
      if (stored.pendingLogout) {
        // 지난번 로그아웃이 서버에 닿지 못했습니다. 쿠키가 남아 있으니 먼저 지웁니다.
        // 이번에도 실패하면 로그인 화면에 머뭅니다 — 몰래 로그인된 채로 열지 않습니다.
        try {
          await post("/api/auth/logout", {});
          writeStored({});
        } catch {
          // 다음 실행 때 다시 보냅니다.
        }
        return;
      }
      try {
        const data = await get<{ user: Me }>("/api/auth/me");
        if (!alive) return;
        fromCache.current = false;
        setUnavailable("");
        keep(data.user);
      } catch (error) {
        if (!alive) return;
        // 401은 "아직 로그인 안 함"이라 정상입니다(위의 401 처리가 기록도 지웁니다).
        if (error instanceof ApiError && error.status === 401) return;
        if (stored.me && isTransient(error)) {
          // 서버에 잠깐 닿지 않을 뿐입니다. 마지막 프로필로 열고, 화면마다 "다시 시도"를 보여줍니다.
          fromCache.current = true;
          setMe(stored.me);
          return;
        }
        setUnavailable(error instanceof Error && error.message ? error.message : t("서버에 연결할 수 없어요. 연결을 확인해 주세요."));
      }
    };
    setChecking(true);
    void check().finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, [attempt, keep]);

  /* 기기에 남은 프로필로 열었다면, 앱이 다시 앞으로 올 때 서버에 다시 묻습니다.
     401 이면 위의 처리로 로그인 화면으로 갑니다. */
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !fromCache.current) return;
      get<{ user: Me }>("/api/auth/me")
        .then((data) => {
          fromCache.current = false;
          keep(data.user);
        })
        .catch(() => {
          // 아직 닿지 않습니다. 다음에 다시 묻습니다.
        });
    });
    return () => subscription.remove();
  }, [keep]);

  const retry = useCallback(() => {
    setUnavailable("");
    setAttempt((n) => n + 1);
  }, []);

  const signIn = useCallback(async (credential: FirebaseSessionCredential) => {
    const data = await post<{ user: Me }>("/api/auth/session", {
      idToken: credential.idToken,
    });
    // 새 세션 쿠키가 예전 쿠키를 덮으므로, 남아 있던 로그아웃 미완료 표시도 여기서 지웁니다.
    fromCache.current = false;
    setUnavailable("");
    keep(data.user);
  }, [keep]);

  const signOut = useCallback(async () => {
    // 먼저 "로그아웃 중"을 기기에 남깁니다. 서버에 닿지 못하거나 도중에 앱이 꺼져도
    // 다음 실행 때 로그아웃을 다시 보냅니다.
    writeStored({ pendingLogout: true });
    fromCache.current = false;
    setUnavailable("");
    // 서버가 실패해도 화면에서는 내보냅니다 — 로그아웃을 눌렀는데 남아 있으면 안 됩니다.
    setMe(null);
    try {
      await post("/api/auth/logout", {});
      writeStored({});
    } catch {
      // 다음 실행 때 다시 보냅니다.
    }
  }, []);

  const refresh = useCallback(async () => {
    const data = await get<{ user: Me }>("/api/auth/me");
    fromCache.current = false;
    keep(data.user);
  }, [keep]);

  const applyMe = useCallback((next: Me) => keep(next), [keep]);

  const value = useMemo(
    () => ({ me, checking, unavailable, retry, signIn, signOut, refresh, applyMe }),
    [me, checking, unavailable, retry, signIn, signOut, refresh, applyMe],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
