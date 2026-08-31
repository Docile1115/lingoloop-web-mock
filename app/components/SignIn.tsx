"use client";

import { Languages, LockKeyhole, Mail, User } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { api, type ApiProfile } from "../lib/live-data";
import type { SocialAuthConfig, SocialAuthFailure, SocialProvider } from "../lib/social-auth";

/**
 * 로그인·가입 화면.
 *
 * 앱 안쪽 화면과 같은 전역 클래스(globals.css)를 씁니다 — 여기만 다른 스타일 체계를
 * 쓰면 같은 서비스처럼 보이지 않습니다.
 */
export function SignIn({ onSignedIn }: { onSignedIn: (user: ApiProfile) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [socialConfig, setSocialConfig] = useState<SocialAuthConfig | null>(null);

  useEffect(() => {
    let active = true;
    api<SocialAuthConfig>("/api/auth/config")
      .then((config) => {
        if (active) setSocialConfig(config);
      })
      .catch(() => {
        // 이메일 로그인은 소셜 공급자 설정 조회가 실패해도 계속 사용할 수 있습니다.
      });
    return () => {
      active = false;
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ user: ApiProfile }>(
        mode === "login" ? "/api/auth/login" : "/api/auth/register",
        {
          method: "POST",
          body: JSON.stringify(mode === "login" ? { email, password } : { name, email, password }),
        },
      );
      onSignedIn(result.user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("요청을 처리하지 못했어요."));
    } finally {
      setBusy(false);
    }
  };

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

  return (
    <main className="signin-page">
      <section className="signin-intro">
        <div className="signin-brand">
          <span className="brand-mark"><Languages size={22} /></span>
          <span>Lingo<strong>Loop</strong></span>
        </div>
        <h1>{t("진짜 사람과 이야기하며 배워요.")}</h1>
        <p>{t("주고받은 대화와 써둔 글은 계정에 남아요. 폰을 바꿔도 그대로 이어져요.")}</p>
      </section>

      <section className="signin-card">
        <div className="signin-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            {t("로그인")}
          </button>
          <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            {t("회원가입")}
          </button>
        </div>

        <h2>{mode === "login" ? t("다시 만나서 반가워요") : t("TimoTalk 시작하기")}</h2>
        <p className="signin-lead">
          {mode === "login" ? t("하던 대화와 기록을 그대로 가져올게요.") : t("프로필은 가입한 뒤에 천천히 채워도 돼요.")}
        </p>

        <div className="signin-social" aria-label={t("간편 로그인")}>
          <button
            type="button"
            className="signin-provider signin-provider-google"
            onClick={() => void submitSocial("google")}
            disabled={busy || !socialConfig?.providers.google}
          >
            <span className="signin-provider-mark signin-provider-mark-google" aria-hidden="true">G</span>
            <span>{socialConfig?.providers.google ? t("Google로 계속하기") : t("Google 로그인 · 설정 필요")}</span>
          </button>
          <button
            type="button"
            className="signin-provider signin-provider-apple"
            onClick={() => void submitSocial("apple")}
            disabled={busy || !socialConfig?.providers.apple}
          >
            <span className="signin-provider-mark signin-provider-mark-apple" aria-hidden="true">Apple</span>
            <span>{socialConfig?.providers.apple ? t("Apple로 계속하기") : t("Apple 로그인 · 설정 필요")}</span>
          </button>
          <div className="signin-divider"><span>{t("또는 이메일로 계속하기")}</span></div>
        </div>

        <form onSubmit={submit} className="signin-form">
          {mode === "register" ? (
            <label>
              {t("이름")}
              <span className="signin-field">
                <User size={16} />
                <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={40} placeholder={t("다른 사람에게 보일 이름")} autoComplete="name" required />
              </span>
            </label>
          ) : null}
          <label>
            {t("이메일")}
            <span className="signin-field">
              <Mail size={16} />
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.com" autoComplete="email" required />
            </span>
          </label>
          <label>
            {t("비밀번호")}
            <span className="signin-field">
              <LockKeyhole size={16} />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                minLength={mode === "register" ? 10 : 1}
                maxLength={128}
                placeholder={mode === "register" ? t("10자 이상") : t("비밀번호")}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                required
              />
            </span>
          </label>
          {error ? <p className="signin-error" role="alert">{error}</p> : null}
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? t("처리 중…") : mode === "login" ? t("로그인") : t("계정 만들기")}
          </button>
        </form>

        <small className="signin-legal">{t("가입하면 커뮤니티 운영정책과 개인정보 처리 방침에 동의하게 돼요.")}</small>
      </section>
    </main>
  );
}
