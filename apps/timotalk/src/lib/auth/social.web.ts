/**
 * 웹 소셜 로그인. 지금 웹(app/lib/social-auth.ts)과 같은 방식입니다.
 * Firebase 팝업으로 로그인해 ID 토큰을 받고, Firebase 로그인 상태는 바로 지웁니다 —
 * 장기 세션은 서버의 httpOnly 쿠키가 맡습니다.
 */
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  OAuthProvider,
  setPersistence,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { t } from "../i18n";
import { SignInError, type AuthConfig, type Provider } from "./social-common";

export { loadAuthConfig, SignInError, type AuthConfig, type Provider } from "./social-common";

const FIREBASE_APP_NAME = "timotalk-web-auth";
/** connectAuthEmulator 는 같은 auth 에 두 번 부르면 던집니다. */
let emulatorConnected = false;

export async function availableProviders(config: AuthConfig): Promise<Provider[]> {
  return (["google", "apple"] as const).filter((provider) => config.providers[provider]);
}

function providerFor(provider: Provider) {
  if (provider === "google") {
    const google = new GoogleAuthProvider();
    google.setCustomParameters({ prompt: "select_account" });
    return google;
  }
  const apple = new OAuthProvider("apple.com");
  apple.addScope("email");
  apple.addScope("name");
  return apple;
}

export async function signInWith(provider: Provider, config: AuthConfig): Promise<string> {
  if (!config.providers[provider]) throw new SignInError("unavailable", t("현재 이 로그인 방법을 사용할 수 없어요."));
  const app = getApps().some((candidate) => candidate.name === FIREBASE_APP_NAME)
    ? getApp(FIREBASE_APP_NAME)
    : initializeApp(config.firebase, FIREBASE_APP_NAME);
  const auth = getAuth(app);
  // 서버가 에뮬레이터를 쓰면 브라우저도 같은 곳에 로그인해야 서버가 토큰을 알아봅니다.
  if (config.authEmulatorHost && !emulatorConnected) {
    connectAuthEmulator(auth, `http://${config.authEmulatorHost}`, { disableWarnings: true });
    emulatorConnected = true;
  }
  await setPersistence(auth, inMemoryPersistence);
  try {
    const credential = await signInWithPopup(auth, providerFor(provider));
    return await credential.user.getIdToken();
  } catch (caught) {
    const code = typeof caught === "object" && caught && "code" in caught ? String(caught.code) : "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") throw new SignInError("cancelled", "");
    if (code === "auth/popup-blocked") throw new SignInError("failed", t("팝업이 차단됐어요. 브라우저에서 팝업을 허용한 뒤 다시 시도해 주세요."));
    if (code === "auth/account-exists-with-different-credential") throw new SignInError("failed", t("같은 이메일이 다른 로그인 방법에 연결되어 있어요."));
    if (code === "auth/unauthorized-domain") throw new SignInError("unavailable", t("이 주소에서는 아직 로그인할 수 없어요. 관리자에게 알려 주세요."));
    if (code === "auth/operation-not-allowed") throw new SignInError("unavailable", t("현재 이 로그인 방법을 사용할 수 없어요."));
    if (code === "auth/network-request-failed") throw new SignInError("failed", t("네트워크 연결을 확인하고 다시 시도해 주세요."));
    throw new SignInError("failed", t("로그인하지 못했어요. 다시 시도해 주세요."));
  } finally {
    await signOut(auth).catch(() => undefined);
  }
}
