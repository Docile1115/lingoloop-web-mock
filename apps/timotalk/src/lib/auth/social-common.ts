/**
 * 소셜 로그인 — 플랫폼과 상관없는 부분(타입·오류·서버 설정 읽기).
 *
 * 플랫폼 파일(social.web.ts·social.native.ts)은 이 파일을 가져다 씁니다. "./social" 에서 가져오면
 * Metro 가 그 이름을 다시 플랫폼 파일 자신으로 풀어서 끝없이 자기를 불러옵니다 — 그래서 따로 둡니다.
 */
import { api } from "../api";
import { t } from "../i18n";

export type Provider = "google" | "apple";

export type AuthConfig = {
  firebase: { apiKey: string; authDomain: string; projectId: string };
  providers: Record<Provider, boolean>;
  /** 앱의 Google 로그인에 필요한 "웹 애플리케이션" OAuth client ID */
  googleWebClientId?: string;
  /** 로컬 에뮬레이터 주소. 운영에서는 비어 있습니다. */
  authEmulatorHost?: string;
};

export class SignInError extends Error {
  constructor(
    readonly kind: "cancelled" | "unavailable" | "failed",
    message: string,
  ) {
    super(message);
    this.name = "SignInError";
  }
}

export async function loadAuthConfig(): Promise<AuthConfig> {
  const config = await api<AuthConfig>("/api/auth/config");
  if (!config?.firebase?.apiKey || !config.firebase.authDomain || !config.firebase.projectId || !config.providers) {
    throw new SignInError("unavailable", t("로그인 설정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."));
  }
  return config;
}
