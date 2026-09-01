"use client";

import { Languages } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { t } from "../lib/i18n";
import { api, type ApiProfile } from "../lib/live-data";
import { isIOSDevice } from "../lib/platform";
import type { SocialAuthConfig, SocialAuthFailure, SocialProvider } from "../lib/social-auth";

function subscribeToPlatform() {
  return () => undefined;
}

function browserProvider(): SocialProvider {
  return isIOSDevice(window.navigator) ? "apple" : "google";
}

function serverProvider(): SocialProvider | null {
  return null;
}

/**
 * 소셜 로그인 화면.
 *
 * 앱 안쪽 화면과 같은 전역 클래스(globals.css)를 씁니다 — 여기만 다른 스타일 체계를
 * 쓰면 같은 서비스처럼 보이지 않습니다.
 */
export function SignIn({ onSignedIn }: { onSignedIn: (user: ApiProfile) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [socialConfig, setSocialConfig] = useState<SocialAuthConfig | null>(null);
  const provider = useSyncExternalStore<SocialProvider | null>(subscribeToPlatform, browserProvider, serverProvider);

  useEffect(() => {
    let active = true;
    api<SocialAuthConfig>("/api/auth/config")
      .then((config) => {
        if (active) setSocialConfig(config);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const submitSocial = async (provider: SocialProvider) => {
    if (!socialConfig) return;
    setBusy(true);
    setError("");
    try {
      const { getSocialIdToken } = await import("../lib/social-auth");
      const idToken = await getSocialIdToken(socialConfig, provider);
      const result = await api<{ user: ApiProfile }>("/api/auth/session", {
        method: "POST",
        body: JSON.stringify({ idToken }),
      });
      onSignedIn(result.user);
    } catch (caught) {
      const messages: Record<SocialAuthFailure, string> = {
        "provider-disabled": t("이 로그인 방식은 아직 준비 중이에요."),
        "popup-closed": t("로그인 창이 닫혔어요. 다시 시도해 주세요."),
        "popup-blocked": t("브라우저에서 로그인 팝업을 허용한 뒤 다시 시도해 주세요."),
        "account-exists": t("같은 이메일로 가입된 계정이 있어요. 기존 로그인 방식으로 먼저 로그인해 주세요."),
        "unauthorized-domain": t("현재 서비스 주소에서는 로그인할 수 없어요. 관리자에게 알려 주세요."),
      };
      const reason = typeof caught === "object" && caught && "reason" in caught
        ? String(caught.reason) as SocialAuthFailure
        : undefined;
      setError(reason && reason in messages ? messages[reason] : t("소셜 로그인을 처리하지 못했어요. 잠시 후 다시 시도해 주세요."));
    } finally {
      setBusy(false);
    }
  };

  const providerEnabled = provider ? Boolean(socialConfig?.providers[provider]) : false;
  const providerLabel = provider === "apple"
    ? t("Apple로 계속하기")
    : provider === "google"
      ? t("Google로 계속하기")
      : t("로그인 준비 중…");

  return (
    <main className="signin-page">
      <div className="signin-panel">
        <div className="signin-brand">
          <span className="signin-mark" aria-hidden="true"><Languages size={26} /></span>
          <span className="signin-wordmark">Timo<strong>Talk</strong></span>
        </div>

        {/* 한 문장으로 둡니다. 조각으로 쪼개면 영어·일본어에서 어순이 깨집니다. */}
        <h1 className="signin-title">{t("진짜 사람과 이야기하며 배워요.")}</h1>
        <p className="signin-sub">
          {t("주고받은 대화와 써둔 글은 계정에 남아요. 폰을 바꿔도 그대로 이어져요.")}
        </p>

        <div className="signin-social">
          <button
            type="button"
            className={`signin-provider ${provider ? `signin-provider-${provider}` : "signin-provider-loading"}`}
            onClick={() => provider && void submitSocial(provider)}
            disabled={busy || !provider || !providerEnabled}
          >
            <span className={`signin-provider-mark ${provider ? `signin-provider-mark-${provider}` : ""}`} aria-hidden="true">
              {provider === "google" ? "G" : provider === "apple" ? "" : "…"}
            </span>
            <span>{busy ? t("처리 중…") : providerLabel}</span>
          </button>

          {/* 설정이 안 끝난 것은 사용자 잘못이 아닙니다. 버튼 이름에 섞지 않고 따로 알립니다. */}
          {provider && !providerEnabled && !busy ? (
            <p className="signin-note">{t("관리자가 로그인 설정을 마치면 바로 쓸 수 있어요.")}</p>
          ) : null}
          {error ? <p className="signin-error" role="alert">{error}</p> : null}
        </div>

        <ul className="signin-points">
          <li>{t("나와 맞는 사람을 매일 골라드려요")}</li>
          <li>{t("배우는 말로 쓴 글을 원어민이 고쳐줘요")}</li>
          <li>{t("대화는 계정에 남아 기기를 바꿔도 이어져요")}</li>
        </ul>

        <small className="signin-legal">
          <a href="/terms">{t("이용약관")}</a>
          <span aria-hidden="true"> · </span>
          <a href="/privacy">{t("개인정보 처리방침")}</a>
        </small>
      </div>
    </main>
  );
}
