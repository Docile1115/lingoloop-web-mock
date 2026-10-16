/**
 * 앱 소셜 로그인. 옛 앱(mobile/src/lib/socialAuth.ts, SignInScreen)과 같은 방식입니다.
 *  - Google: 기기 Google 로그인 → Google ID 토큰
 *  - Apple: iOS 기본 Apple 로그인 → Apple ID 토큰(+ nonce)
 * 공급자 토큰을 Firebase 토큰으로 바꾼 뒤 Firebase 로그인 상태는 바로 지웁니다.
 * 장기 세션은 서버의 httpOnly 쿠키가 맡습니다.
 */
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  initializeAuth,
  OAuthProvider,
  signInWithCredential,
  signOut,
  updateProfile,
  type Auth,
} from "firebase/auth";
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from "@react-native-google-signin/google-signin";
import { t } from "../i18n";
import { SignInError, type AuthConfig, type Provider } from "./social-common";

export { loadAuthConfig, SignInError, type AuthConfig, type Provider } from "./social-common";

const FIREBASE_APP_NAME = "timotalk-native-auth";

function nativeAuth(config: AuthConfig): Auth {
  const app = getApps().some((candidate) => candidate.name === FIREBASE_APP_NAME)
    ? getApp(FIREBASE_APP_NAME)
    : initializeApp(config.firebase, FIREBASE_APP_NAME);
  try {
    return initializeAuth(app, { persistence: inMemoryPersistence });
  } catch (caught) {
    const code = typeof caught === "object" && caught && "code" in caught ? String(caught.code) : "";
    if (code !== "auth/already-initialized") throw caught;
    return getAuth(app);
  }
}

export async function availableProviders(config: AuthConfig): Promise<Provider[]> {
  const providers: Provider[] = [];
  if (config.providers.google && config.googleWebClientId) providers.push("google");
  if (config.providers.apple && Platform.OS === "ios" && (await AppleAuthentication.isAvailableAsync().catch(() => false))) {
    providers.push("apple");
  }
  return providers;
}

async function exchange(config: AuthConfig, credential: ReturnType<typeof GoogleAuthProvider.credential>, displayName?: string) {
  const auth = nativeAuth(config);
  try {
    const result = await signInWithCredential(auth, credential);
    // Apple 은 이름을 처음 동의할 때만 줍니다. 그 순간 Firebase 프로필에 남깁니다.
    if (displayName && !result.user.displayName) await updateProfile(result.user, { displayName });
    return await result.user.getIdToken(true);
  } finally {
    await signOut(auth).catch(() => undefined);
  }
}

async function google(config: AuthConfig): Promise<string> {
  if (!config.googleWebClientId) throw new SignInError("unavailable", t("Google 로그인 설정이 필요해요. 앱 관리자에게 알려 주세요."));
  // 반드시 Google Cloud 의 "웹 애플리케이션" client ID 여야 Firebase 가 검증할 수 있는 토큰을 줍니다.
  GoogleSignin.configure({ webClientId: config.googleWebClientId, offlineAccess: false });
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    if (!isSuccessResponse(result)) throw new SignInError("cancelled", "");
    if (!result.data.idToken) throw new SignInError("failed", t("Google 로그인 확인 정보를 받지 못했어요. 다시 시도해 주세요."));
    return await exchange(config, GoogleAuthProvider.credential(result.data.idToken));
  } catch (caught) {
    if (caught instanceof SignInError) throw caught;
    if (isErrorWithCode(caught)) {
      if (caught.code === statusCodes.SIGN_IN_CANCELLED) throw new SignInError("cancelled", "");
      if (caught.code === statusCodes.IN_PROGRESS) throw new SignInError("failed", t("Google 로그인이 이미 진행 중이에요."));
      if (caught.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new SignInError("unavailable", t("Google Play 서비스를 사용할 수 없어요. 업데이트 후 다시 시도해 주세요."));
      }
    }
    throw firebaseFailure(caught);
  } finally {
    await GoogleSignin.signOut().catch(() => undefined);
  }
}

async function apple(config: AuthConfig): Promise<string> {
  try {
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const result = await AppleAuthentication.signInAsync({
      nonce: hashedNonce,
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!result.identityToken) throw new SignInError("failed", t("Apple 로그인 확인 정보를 받지 못했어요. 다시 시도해 주세요."));
    const displayName = result.fullName ? AppleAuthentication.formatFullName(result.fullName).trim() : "";
    const credential = new OAuthProvider("apple.com").credential({ idToken: result.identityToken, rawNonce });
    return await exchange(config, credential, displayName || undefined);
  } catch (caught) {
    if (caught instanceof SignInError) throw caught;
    const code = typeof caught === "object" && caught && "code" in caught ? String(caught.code) : "";
    if (code === "ERR_REQUEST_CANCELED") throw new SignInError("cancelled", "");
    throw firebaseFailure(caught);
  }
}

function firebaseFailure(caught: unknown): SignInError {
  const code = typeof caught === "object" && caught && "code" in caught ? String(caught.code) : "";
  if (code === "auth/account-exists-with-different-credential") return new SignInError("failed", t("같은 이메일이 다른 로그인 방법에 연결되어 있어요."));
  if (code === "auth/operation-not-allowed") return new SignInError("unavailable", t("현재 이 로그인 방법을 사용할 수 없어요."));
  if (code === "auth/network-request-failed") return new SignInError("failed", t("네트워크 연결을 확인하고 다시 시도해 주세요."));
  if (code === "auth/invalid-credential") return new SignInError("failed", t("로그인 확인 정보가 만료됐어요. 다시 시도해 주세요."));
  return new SignInError("failed", t("로그인하지 못했어요. 다시 시도해 주세요."));
}

export async function signInWith(provider: Provider, config: AuthConfig): Promise<string> {
  if (!config.providers[provider]) throw new SignInError("unavailable", t("현재 이 로그인 방법을 사용할 수 없어요."));
  return provider === "google" ? google(config) : apple(config);
}
