"use client";

import { Languages, LockKeyhole, Mail, User } from "lucide-react";
import { type FormEvent, useState } from "react";
import { t } from "../lib/i18n";
import { api, type ApiProfile } from "../lib/live-data";

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

        <h2>{mode === "login" ? t("다시 만나서 반가워요") : t("LingoLoop 시작하기")}</h2>
        <p className="signin-lead">
          {mode === "login" ? t("하던 대화와 기록을 그대로 가져올게요.") : t("프로필은 가입한 뒤에 천천히 채워도 돼요.")}
        </p>

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
