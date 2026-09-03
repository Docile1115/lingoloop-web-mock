import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  initializeAuth,
  OAuthProvider,
  signInWithCredential,
  signOut,
  updateProfile,
} from "firebase/auth";
import { get } from "./api";

export type SocialProvider = "google" | "apple";

export type MobileSocialAuthConfig = {
  firebase: Pick<FirebaseOptions, "apiKey" | "authDomain" | "projectId">;
  providers: Record<SocialProvider, boolean>;
  /** 공개 식별자. 운영에서는 API가 내려주고, 로컬 빌드 env는 fallback입니다. */
  googleWebClientId?: string;
};

export type FirebaseSessionCredential = {
  idToken: string;
};

export class MobileSocialAuthError extends Error {
  constructor(
    readonly code:
      | "PROVIDER_DISABLED"
      | "MISSING_PROVIDER_TOKEN"
      | "AUTH_CONFIG_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "MobileSocialAuthError";
  }
}

const FIREBASE_APP_NAME = "timotalk-native-auth";

export async function loadSocialAuthConfig() {
  const config = await get<MobileSocialAuthConfig>("/api/auth/config");
  if (
    !config?.firebase?.apiKey ||
    !config.firebase.authDomain ||
    !config.firebase.projectId ||
    !config.providers
  ) {
    throw new MobileSocialAuthError(
      "AUTH_CONFIG_INVALID",
      "로그인 설정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
    );
  }
  return config;
}

function nativeAuth(config: MobileSocialAuthConfig) {
  const app = getApps().some((candidate) => candidate.name === FIREBASE_APP_NAME)
    ? getApp(FIREBASE_APP_NAME)
    : initializeApp(config.firebase, FIREBASE_APP_NAME);

  try {
    // 모바일의 장기 세션은 서버 httpOnly 쿠키가 담당합니다. Firebase JS 상태는
    // 메모리에만 두어 토큰이 앱 저장소에 남지 않게 합니다.
    return initializeAuth(app, { persistence: inMemoryPersistence });
  } catch (caught) {
    const code =
      typeof caught === "object" && caught && "code" in caught ? String(caught.code) : "";
    if (code !== "auth/already-initialized") throw caught;
    return getAuth(app);
  }
}

type ProviderCredential = {
  provider: SocialProvider;
  providerIdToken: string;
  rawNonce?: string;
  displayName?: string;
};

/** 공급자의 ID token을 최근 로그인이 확인된 Firebase ID token으로 교환합니다. */
export async function exchangeProviderCredential(
  config: MobileSocialAuthConfig,
  credential: ProviderCredential,
): Promise<FirebaseSessionCredential> {
  if (!config.providers[credential.provider]) {
    throw new MobileSocialAuthError(
      "PROVIDER_DISABLED",
      "현재 이 로그인 방법을 사용할 수 없어요.",
    );
  }
  if (!credential.providerIdToken) {
    throw new MobileSocialAuthError(
      "MISSING_PROVIDER_TOKEN",
      "로그인 확인 정보를 받지 못했어요. 다시 시도해 주세요.",
    );
  }

  const auth = nativeAuth(config);
  const firebaseCredential =
    credential.provider === "google"
      ? GoogleAuthProvider.credential(credential.providerIdToken)
      : new OAuthProvider("apple.com").credential({
          idToken: credential.providerIdToken,
          rawNonce: credential.rawNonce,
        });

  try {
    const result = await signInWithCredential(auth, firebaseCredential);
    // Apple은 이름을 최초 동의 때만 반환하므로 그 순간 Firebase 프로필에 보존합니다.
    if (credential.displayName && !result.user.displayName) {
      await updateProfile(result.user, { displayName: credential.displayName });
    }
    const idToken = await result.user.getIdToken(true);
    return { idToken };
  } finally {
    // Firebase 인증 상태 자체는 남기지 않습니다. ID token은 서버 세션으로
    // 즉시 교환하고 이후 API 인증은 httpOnly 쿠키만 사용합니다.
    await signOut(auth).catch(() => undefined);
  }
}
