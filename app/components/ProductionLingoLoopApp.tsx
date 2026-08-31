"use client";

import {
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  Compass,
  ArrowLeft,
  Ban,
  Database,
  Flag,
  Heart,
  Languages,
  LockKeyhole,
  LogOut,
  Mail,
  MessageCircle,
  MoreHorizontal,
  PenLine,
  RefreshCw,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  User,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { I18nProvider, type MessageKey, msg, t, tx, useLocale, useLocaleRerender, LOCALES, LOCALE_LABEL } from "../lib/i18n";
import styles from "./ProductionLingoLoopApp.module.css";

type Tab = "partners" | "community" | "chats" | "profile" | "reports";

type Country = {
  code: string;
  name: string;
  flag: string;
};

type LearningLanguage = {
  code: string;
  level: string;
  goal: string;
};

type UserProfile = {
  id: string;
  email?: string;
  emailVerified?: boolean;
  name: string;
  handle: string;
  country: Country;
  city?: string;
  nativeLanguages: string[];
  learningLanguages: LearningLanguage[];
  bio: string;
  interests: string[];
  availability: string[];
  intents: string[];
  age: number;
  gender: string;
  status: string;
  verified: boolean;
  responseRate: number;
  exchangeScore: number;
};

type MatchRecommendation = {
  partner: UserProfile;
  score: number;
  matchReasons: string[];
  /* 서버가 만든 문장 대신 코드로 받으면 화면 언어로 그릴 수 있습니다. */
  matchReasonCodes?: Array<{ code: string; languages?: string; interests?: string; flag?: string; country?: string }>;
  icebreaker: string;
  meetsAllPreferences: boolean;
};

type Post = {
  id: string;
  authorId: string;
  author: {
    id: string;
    name: string;
    handle: string;
    flag: string;
  };
  text: string;
  language: string;
  targetLanguage: string;
  tags: string[];
  visibility: string;
  requestCorrection: boolean;
  likes: number;
  comments: number;
  corrections: number;
  createdAt: string;
};

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  type: "text" | "voice";
  text: string;
  sentAt: string;
  status: string;
  /** 내가 보낸 메시지에만 옵니다 — 상대가 읽었는지. */
  readByPartner?: boolean;
};

type Conversation = {
  id: string;
  partner: UserProfile | null;
  preview: string;
  updatedAt: string;
  unreadCount: number;
  messages?: Message[];
  /** 요청함으로 들어온 대화에서 발견한 스팸 신호. 막지는 않고 표시만 합니다. */
  spamSignals?: string[];
};

type MatchingPreferences = {
  targetLanguages: string[];
  preferredCountries: string[];
  interests: string[];
  availability: string[];
  partnerLevel: string;
  partnerGender: string;
  ageMin: number;
  ageMax: number;
  verifiedOnly: boolean;
  intents: string[];
  onlineOnly: boolean;
};

type DmPrivacy = {
  whoCanMessage: string;
  /** 수신 범위 밖에서 온 대화를 요청함으로 보낼지. 끄면 아예 막습니다. */
  routeOthersToRequests: boolean;
  /** 요청함의 첫 메시지에서 스팸 신호를 찾아 표시할지. */
  flagSuspectedSpam: boolean;
};

type AiUsage = {
  remaining: number;
  limit: number;
  resetsAt: string;
};

type TranslationResult = {
  translatedText: string;
  provider: string;
  model: string;
  entitlement: { usage: AiUsage };
};

type ConversationSupport = {
  topics: string[];
  suggestedOpeners: string[];
  followUpQuestions: string[];
  improvedDraft: string;
  tip: string;
  provider: string;
  model: string;
  entitlement: { usage: AiUsage };
};

type FeatureFlags = {
  aiConfigured: boolean;
};

/** 운영자가 보는 신고 한 건. */
type AdminReport = {
  id: string;
  targetType: string;
  reason: string;
  details: string;
  status: string;
  submittedAt: string;
  resolution: string;
  reporter: { id: string; name: string | null; handle: string | null };
  target: { id: string; name: string | null; handle: string | null };
};

type ApiEnvelope<T> = {
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
    mock: false;
    persistent: boolean;
  };
};

/** 서버 오류를 화면에 보여줄 문구로. 모르는 code 는 서버가 준 말을 그대로 씁니다. */
function errorText(caught: unknown): string {
  if (caught instanceof ApiClientError) {
    const known = ERROR_MESSAGES[caught.code];
    if (known) return t(known as MessageKey);
    return caught.message;
  }
  return caught instanceof Error ? caught.message : t("문제가 생겼어요. 잠시 후 다시 시도해 주세요.");
}

class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({})) as ApiEnvelope<T> & {
    error?: { code?: string; message?: string };
  };
  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      body.error?.code || "REQUEST_FAILED",
      body.error?.message || t("요청을 처리하지 못했어요."),
    );
  }
  return body.data;
}

/**
 * 파트너가 쓰는·배우는 언어 이름.
 * 화면 언어로 번역합니다 — 영어 화면에서 "Learning 한국어" 는 읽히지 않습니다.
 * (표시 언어를 고르는 목록은 반대로 각 언어를 그 언어로 적습니다. 자기 언어를
 *  찾아야 하는 자리라 번역하면 오히려 못 찾습니다 — LOCALE_LABEL 참고.)
 */
const LANGUAGE_LABELS: Record<string, string> = {
  ko: msg("한국어"),
  en: msg("영어"),
  ja: msg("일본어"),
  zh: msg("중국어"),
  es: msg("스페인어"),
  fr: msg("프랑스어"),
  de: msg("독일어"),
};

/**
 * 서버 오류를 화면 언어로 옮깁니다.
 *
 * 서버는 한 벌의 한국어 메시지만 보냅니다 — 로그와 디버깅에는 그게 편하지만
 * 화면에 그대로 내보내면 영어·일본어 사용자가 한국어 오류를 보게 됩니다.
 * 같이 오는 code 로 우리 문구를 고르고, 모르는 code 는 서버 메시지를 그대로 씁니다
 * (문구가 없다고 오류를 숨기는 것보다 낫습니다).
 */
const ERROR_MESSAGES: Record<string, string> = {
  ACCOUNT_DISABLED: msg("사용할 수 없는 계정이에요."),
  ACCOUNT_RESTRICTED: msg("이용이 제한된 계정이에요."),
  AI_DAILY_LIMIT_REACHED: msg("오늘 쓸 수 있는 AI 도움을 다 썼어요. 내일 다시 만나요."),
  AI_NOT_CONFIGURED: msg("AI 기능은 아직 연결되지 않았어요."),
  AI_INVALID_RESPONSE: msg("AI 응답을 읽지 못했어요. 다시 시도해 주세요."),
  AUTH_REQUIRED: msg("로그인이 필요해요."),
  BLOCK_NOT_FOUND: msg("차단하지 않은 사람이에요."),
  CONVERSATION_BLOCKED: msg("차단한 사이에는 메시지를 보낼 수 없어요."),
  CONVERSATION_CLOSED: msg("이 대화에는 메시지를 보낼 수 없어요."),
  CONVERSATION_FORBIDDEN: msg("이 대화를 열 수 없어요."),
  CONVERSATION_NOT_FOUND: msg("대화를 찾을 수 없어요."),
  DM_NOT_ALLOWED: msg("상대가 정한 수신 범위 밖이라 대화를 시작할 수 없어요."),
  EMAIL_EXISTS: msg("이미 가입된 이메일이에요."),
  IDENTITY_PROVIDER_ERROR: msg("로그인 처리 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요."),
  IDENTITY_PROVIDER_UNAVAILABLE: msg("로그인 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요."),
  INTERNAL_ERROR: msg("문제가 생겼어요. 잠시 후 다시 시도해 주세요."),
  INVALID_EMAIL: msg("이메일 주소를 다시 확인해 주세요."),
  INVALID_LOGIN_CREDENTIALS: msg("이메일이나 비밀번호가 맞지 않아요."),
  INVALID_PARTNER: msg("나에게는 할 수 없는 동작이에요."),
  INVALID_SESSION: msg("로그인이 만료됐어요. 다시 로그인해 주세요."),
  MESSAGE_REQUEST_LIMIT: msg("상대가 요청을 수락하기 전까지는 한 통만 보낼 수 있어요."),
  MESSAGE_REQUEST_PENDING: msg("요청을 수락해야 답장할 수 있어요."),
  PARTNER_BLOCKED: msg("차단한 사이라 할 수 없어요."),
  PARTNER_NOT_FOUND: msg("그 사용자를 찾을 수 없어요."),
  POST_FORBIDDEN: msg("내가 쓴 글만 지울 수 있어요."),
  POST_NOT_FOUND: msg("글을 찾을 수 없어요."),
  RATE_LIMITED: msg("시도가 너무 잦아요. 잠시 후 다시 해주세요."),
  RECENT_LOGIN_REQUIRED: msg("보안을 위해 다시 로그인해 주세요."),
  REQUEST_ACCEPT_FORBIDDEN: msg("이 요청은 수락할 수 없어요."),
  TOO_MANY_ATTEMPTS: msg("시도가 너무 잦아요. 잠시 후 다시 해주세요."),
  WEAK_PASSWORD: msg("비밀번호는 10자 이상으로 정해 주세요."),
};

/** 신고 사유·대상을 사람이 읽는 말로. 서버가 저장하는 값과 짝이 맞아야 합니다. */
const REPORT_REASON_LABELS: Record<string, string> = {
  spam: msg("스팸·광고"),
  scam: msg("사기·금전 요구"),
  harassment: msg("괴롭힘·욕설"),
  dating: msg("데이트 목적 접근"),
  sexual_content: msg("성적인 내용"),
  hate: msg("혐오 표현"),
  impersonation: msg("사칭"),
  other: msg("기타"),
};

const REPORT_TARGET_LABELS: Record<string, string> = {
  user: msg("사용자"),
  post: msg("게시물"),
  message: msg("메시지"),
};

/** 서버가 요청함 첫 메시지에서 찾은 신호. 판정이 아니라 "먼저 살펴보라"는 표시입니다. */
const SPAM_LABELS: Record<string, string> = {
  "off-platform": msg("다른 앱으로 옮기자고 해요"),
  money: msg("돈 이야기가 있어요"),
  link: msg("링크가 있어요"),
  contact: msg("연락처가 있어요"),
};

/** 서버가 받는 신고 사유. 목록이 어긋나면 422 로 되돌아옵니다. */
const REPORT_REASONS: Array<{ value: string; label: string }> = [
  { value: "spam", label: msg("스팸·광고") },
  { value: "scam", label: msg("사기·금전 요구") },
  { value: "harassment", label: msg("괴롭힘·욕설") },
  { value: "dating", label: msg("데이트 목적 접근") },
  { value: "sexual_content", label: msg("성적인 내용") },
  { value: "hate", label: msg("혐오 표현") },
  { value: "impersonation", label: msg("사칭") },
  { value: "other", label: msg("기타") },
];

/** 서버가 learningLanguages.level 로 저장하는 값들. 화면에는 사람이 읽는 말로 보여줍니다. */
const LEVEL_LABELS: Record<string, string> = {
  beginner: msg("입문"),
  intermediate: msg("중급"),
  advanced: msg("고급"),
};

const navItems: Array<{ id: Tab; label: string; mobileLabel: string; icon: LucideIcon }> = [
  { id: "partners", label: msg("파트너"), mobileLabel: msg("파트너"), icon: Compass },
  { id: "community", label: msg("커뮤니티"), mobileLabel: msg("피드"), icon: UsersRound },
  { id: "chats", label: msg("대화"), mobileLabel: msg("대화"), icon: MessageCircle },
  { id: "profile", label: msg("프로필"), mobileLabel: msg("프로필"), icon: User },
];

/** 운영자에게만 붙는 메뉴. 서버가 운영자라고 알려줄 때만 보여줍니다. */
const adminNavItem = { id: "reports" as Tab, label: msg("신고"), mobileLabel: msg("신고"), icon: Flag };

function languageLabel(code: string) {
  const label = LANGUAGE_LABELS[code];
  return label ? t(label as MessageKey) : code.toLocaleUpperCase();
}

function relativeTime(value: string) {
  const milliseconds = Date.now() - Date.parse(value);
  const minutes = Math.max(0, Math.floor(milliseconds / 60000));
  if (minutes < 1) return t("방금");
  if (minutes < 60) return t("{n}분 전", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("{n}시간 전", { n: hours });
  return t("{n}일 전", { n: Math.floor(hours / 24) });
}

function Avatar({ profile, size = "medium" }: { profile: UserProfile; size?: "small" | "medium" | "large" }) {
  return (
    <span className={styles.avatar + " " + styles["avatar_" + size]} aria-label={profile.name}>
      <span>{profile.name.slice(0, 1).toLocaleUpperCase()}</span>
      <i>{profile.country?.flag || "🌐"}</i>
      {profile.status === "online" ? <b /> : null}
    </span>
  );
}

function LoadingScreen() {
  return (
    <main className={styles.loading}>
      <span className={styles.brandMark}><Languages size={24} /></span>
      <strong>TimoTalk</strong>
      <p>{t("로그인 상태를 확인하고 있어요.")}</p>
    </main>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: UserProfile) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<{ user: UserProfile; emailVerificationSent?: boolean }>(
        mode === "login" ? "/api/auth/login" : "/api/auth/register",
        {
          method: "POST",
          body: JSON.stringify(mode === "login" ? { email, password } : { name, email, password }),
        },
      );
      if (result.emailVerificationSent) setNotice(t("확인 메일을 보냈어요."));
      onAuthenticated(result.user);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={styles.authPage}>
      <section className={styles.authIntro}>
        <div className={styles.authBrand}>
          <span className={styles.brandMark}><Languages size={24} /></span>
          <span>Lingo<strong>Loop</strong></span>
        </div>
        <p className={styles.eyebrow}>REAL LANGUAGE EXCHANGE</p>
        <h1>{t("진짜 사람과 이야기하며 배워요.")}</h1>
        <p className={styles.authDescription}>
          {t("주고받은 대화와 써둔 글은 계정에 남아요. 폰을 바꿔도 그대로 이어져요.")}
        </p>
        <ul className={styles.authFacts}>
          <li><Database size={18} /> {t("기록이 남아요")}</li>
          <li><LockKeyhole size={18} /> {t("안전한 로그인")}</li>
          <li><ShieldCheck size={18} /> {t("내 정보는 나만")}</li>
        </ul>
      </section>

      <section className={styles.authCard}>
        <div className={styles.authTabs}>
          <button type="button" className={mode === "login" ? styles.active : ""} onClick={() => setMode("login")}>{t("로그인")}</button>
          <button type="button" className={mode === "register" ? styles.active : ""} onClick={() => setMode("register")}>{t("회원가입")}</button>
        </div>
        <div>
          <h2>{mode === "login" ? t("다시 만나서 반가워요") : t("TimoTalk 시작하기")}</h2>
          <p>{mode === "login" ? t("하던 대화와 기록을 그대로 가져올게요.") : t("프로필은 가입한 뒤에 천천히 채워도 돼요.")}</p>
        </div>
        <form onSubmit={submit} className={styles.authForm}>
          {mode === "register" ? (
            <label>
              {t("이름")}
              <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={40} placeholder={t("다른 사람에게 보일 이름")} autoComplete="name" required />
            </label>
          ) : null}
          <label>
            {t("이메일")}
            <span className={styles.inputWithIcon}><Mail size={17} /><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.com" autoComplete="email" required /></span>
          </label>
          <label>
            {t("비밀번호")}
            <span className={styles.inputWithIcon}><LockKeyhole size={17} /><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={mode === "register" ? 10 : 1} maxLength={128} placeholder={mode === "register" ? t("10자 이상") : t("비밀번호")} autoComplete={mode === "register" ? "new-password" : "current-password"} required /></span>
          </label>
          {error ? <p className={styles.formError} role="alert">{error}</p> : null}
          {notice ? <p className={styles.formNotice}>{notice}</p> : null}
          <button className={styles.primaryButton} type="submit" disabled={busy}>
            {busy ? t("처리 중…") : mode === "login" ? t("로그인") : t("계정 만들기")}
          </button>
        </form>
        <small className={styles.authLegal}>{t("가입하면 커뮤니티 운영정책과 개인정보 처리 방침에 동의하게 돼요.")}</small>
      </section>
    </main>
  );
}

/**
 * 게시물 ··· 메뉴. 내 글과 남의 글은 할 수 있는 일이 다릅니다 —
 * 내 글에 "신고하기"가 뜨면 안 되고, 남의 글에 "삭제하기"가 뜨면 안 됩니다.
 */
function OverflowMenu({ label, items }: { label: string; items: Array<{ id: string; label: string; icon: LucideIcon; danger?: boolean; onSelect: () => void }> }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.postMenu} ref={wrap}>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open} aria-label={label}>
        <MoreHorizontal size={18} />
      </button>
      {open ? (
        <div className={styles.postMenuList} role="menu">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={item.danger ? styles.danger : ""}
                onClick={() => { setOpen(false); item.onSelect(); }}
              >
                <Icon size={15} /> {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** 되돌릴 수 없는 행동을 한 번 묻습니다. */
function ConfirmDialog({ title, body, confirmLabel, onCancel, onConfirm }: { title: string; body: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className={styles.confirmBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div className={styles.confirmCard} role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <p>{body}</p>
        <div className={styles.confirmActions}>
          <button type="button" className={styles.secondaryButton} onClick={onCancel}>{t("취소")}</button>
          <button type="button" className={styles.dangerButton} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/**
 * 값 고르기. 브라우저 기본 select 는 OS 마다 열리는 모습이 달라
 * 앱 안에서 혼자 튑니다 — 우리 패널로 통일합니다.
 */
function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((option) => option.value === value);

  return (
    <div className={styles.selectField} ref={wrap}>
      <span>{label}</span>
      <button
        type="button"
        className={styles.selectTrigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value_) => !value_)}
      >
        <span>{current?.label ?? value}</span>
        <ChevronDown size={16} />
      </button>
      {open ? (
        <div className={styles.selectPanel} role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? styles.selected : ""}
              onClick={() => { onChange(option.value); setOpen(false); }}
            >
              {option.label}
              {option.value === value ? <Check size={16} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** 매칭 이유를 화면 언어로 그립니다. 서버가 코드를 안 주면 받은 문장을 그대로 씁니다. */
function matchReasonText(reason: { code: string; languages?: string; interests?: string; flag?: string; country?: string }): string {
  if (reason.code === "native-speaker") return t("{languages}를 모국어로 쓰는 사람이에요", { languages: reason.languages ?? "" });
  if (reason.code === "preferred-country") return t("찾던 지역인 {flag} {country}에 살아요", { flag: reason.flag ?? "", country: tx(reason.country ?? "") });
  if (reason.code === "shared-interests") return t("{interests}에 같이 관심이 있어요", { interests: reason.interests ?? "" });
  if (reason.code === "time-overlap") return t("연습하고 싶은 시간대가 비슷해요");
  if (reason.code === "broadened") return t("조건을 조금 넓혀서 찾은 사람이에요");
  return t("새로 들어온 사람과 첫 대화를 시작해 보세요");
}

/** 신고 사유를 고르는 창. 사유 없이 보내면 운영이 판단할 근거가 없습니다. */
function ReportDialog({ title, onCancel, onSubmit }: { title: string; onCancel: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("spam");
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className={styles.confirmBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div className={styles.confirmCard} role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <p>{t("가장 가까운 이유를 골라주세요. 내용은 운영팀만 봐요.")}</p>
        <div className={styles.reasonGrid} role="radiogroup" aria-label={t("신고 사유")}>
          {REPORT_REASONS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={reason === item.value}
              className={reason === item.value ? styles.selected : ""}
              onClick={() => setReason(item.value)}
            >
              {t(item.label as MessageKey)}
            </button>
          ))}
        </div>
        <div className={styles.confirmActions}>
          <button type="button" className={styles.secondaryButton} onClick={onCancel}>{t("취소")}</button>
          <button type="button" className={styles.dangerButton} onClick={() => onSubmit(reason)}>{t("신고하기")}</button>
        </div>
      </div>
    </div>
  );
}

/**
 * 신고 한 건. 목록에서 바로 판단할 수 있게 필요한 것만 보여줍니다 —
 * 누가 누구를, 왜, 언제. 닫을 때는 왜 그렇게 판단했는지 한 줄 남깁니다.
 */
function ReportRow({
  report,
  busy,
  onResolve,
}: {
  report: AdminReport;
  busy: boolean;
  onResolve: (report: AdminReport, outcome: "actioned" | "dismissed", note: string) => void;
}) {
  const [note, setNote] = useState(report.resolution || "");
  const open = report.status === "received";
  const who = (person: AdminReport["reporter"]) => person.name ?? t("탈퇴한 사용자");
  return (
    <article className={styles.reportRow}>
      <header>
        <strong>{t(REPORT_REASON_LABELS[report.reason] as MessageKey)}</strong>
        <span className={styles.languageTag}>{t(REPORT_TARGET_LABELS[report.targetType] as MessageKey)}</span>
        <time>{relativeTime(report.submittedAt)}</time>
      </header>
      <p>{t("{reporter}님이 {target}님을 신고했어요.", { reporter: who(report.reporter), target: who(report.target) })}</p>
      {report.details ? <blockquote>{report.details}</blockquote> : null}
      {open ? (
        <div className={styles.reportActions}>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            placeholder={t("어떻게 판단했는지 한 줄")}
            aria-label={t("어떻게 판단했는지 한 줄")}
          />
          <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => onResolve(report, "dismissed", note)}>
            {t("문제없음")}
          </button>
          <button type="button" className={styles.dangerButton} disabled={busy} onClick={() => onResolve(report, "actioned", note)}>
            {t("조치함")}
          </button>
        </div>
      ) : (
        <p className={styles.reportClosed}>
          {report.status === "actioned" ? t("조치함") : t("문제없음")}
          {report.resolution ? " · " + report.resolution : ""}
        </p>
      )}
    </article>
  );
}

function LanguagePicker() {
  const { locale, setLocale } = useLocale();
  return (
    <article className={styles.localeCard}>
      <header><Languages size={19} /><strong>{t("표시 언어")}</strong></header>
      <p>{t("앱을 어떤 언어로 볼지 고르세요. 이 기기에만 적용돼요.")}</p>
      <div className={styles.scopeButtons}>
        {LOCALES.map((code) => (
          <button key={code} type="button" className={locale === code ? styles.active : ""} onClick={() => setLocale(code)}>
            {LOCALE_LABEL[code]}
          </button>
        ))}
      </div>
    </article>
  );
}

function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return (
    <div className={styles.emptyState}>
      <span><Icon size={25} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function OperationalApp({
  initialUser,
  onSignedOut,
  onUserChanged,
}: {
  initialUser: UserProfile;
  onSignedOut: () => void;
  onUserChanged: (user: UserProfile) => void;
}) {
  const [tab, setTab] = useState<Tab>("partners");
  const [user, setUser] = useState(initialUser);
  const [matches, setMatches] = useState<MatchRecommendation[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [preferences, setPreferences] = useState<MatchingPreferences | null>(null);
  const [privacy, setPrivacy] = useState<DmPrivacy | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [aiConfigured, setAiConfigured] = useState(false);
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const [translatingMessageId, setTranslatingMessageId] = useState("");
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiSupport, setAiSupport] = useState<ConversationSupport | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [postDraft, setPostDraft] = useState("");
  /* 교정 요청은 글마다 다른 선택입니다 — 조용히 켜두면 원하지 않는 글에도 붙습니다. */
  const [askCorrection, setAskCorrection] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  /* 삭제를 누른 글. 되돌릴 수 없어서 확인을 한 번 거칩니다. */
  const [postPendingDelete, setPostPendingDelete] = useState<Post | null>(null);
  /* 차단은 되돌릴 수 있지만 대화가 사라지므로 한 번 묻습니다. */
  const [partnerPendingBlock, setPartnerPendingBlock] = useState<UserProfile | null>(null);
  /* 신고 대상. 사유를 고른 뒤에 접수합니다. */
  const [reportTargetState, setReportTargetState] = useState<{ type: "user" | "post" | "message"; id: string; name: string } | null>(null);
  const [blockedPartners, setBlockedPartners] = useState<Array<{ blockedId: string; partner: UserProfile }>>([]);
  /* 요청함 — 수신 범위 밖에서 온 대화. 화면이 없으면 영영 안 보입니다. */
  const [requests, setRequests] = useState<Conversation[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  /* 운영자에게만 보이는 신고 처리 화면. 서버가 판단해서 알려줍니다. */
  const [isAdmin, setIsAdmin] = useState(false);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [reportBox, setReportBox] = useState<"open" | "closed">("open");
  /* 좁은 화면에서는 목록과 대화창을 한 번에 보여줄 자리가 없어 번갈아 보여줍니다.
     넓은 화면에서는 이 값과 상관없이 둘 다 보입니다. */
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [profileDraft, setProfileDraft] = useState({
    name: initialUser.name,
    bio: initialUser.bio,
    city: initialUser.city || "",
    // 매칭은 "내가 쓰는 말"과 "배우려는 말"이 서로 맞물릴 때만 성립합니다.
    // 이 둘을 고칠 수 없으면 모두가 가입 기본값에 묶여 추천이 영영 비게 됩니다.
    countryCode: initialUser.country?.code || "KR",
    nativeLanguage: initialUser.nativeLanguages?.[0] || "ko",
    learningLanguage: initialUser.learningLanguages?.[0]?.code || "en",
    learningLevel: initialUser.learningLanguages?.[0]?.level || "beginner",
    age: initialUser.age || 18,
  });
  const sessionEmail = initialUser.email;
  const sessionEmailVerified = initialUser.emailVerified;

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const loadReports = useCallback(async (box: "open" | "closed") => {
    try {
      const rows = await apiRequest<AdminReport[]>("/api/admin/reports?status=" + box);
      setReports(rows || []);
    } catch {
      /* 운영자가 아니면 404 입니다. 화면에는 메뉴 자체가 없으니 조용히 넘어갑니다. */
    }
  }, []);

  const loadBlocks = useCallback(async () => {
    try {
      const rows = await apiRequest<Array<{ blockedId: string; partner: UserProfile }>>("/api/blocks");
      setBlockedPartners(rows || []);
    } catch {
      /* 차단 목록은 없어도 나머지 화면이 동작해야 합니다. */
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [bootstrap, matchData, postData, conversationData, requestData, preferenceData, privacyData] = await Promise.all([
        apiRequest<{ currentUser: UserProfile; featureFlags: FeatureFlags; countries: Country[]; isAdmin?: boolean }>("/api/bootstrap"),
        apiRequest<{ recommendations: MatchRecommendation[] }>("/api/matching/daily"),
        apiRequest<Post[]>("/api/posts"),
        apiRequest<Conversation[]>("/api/conversations"),
        apiRequest<Conversation[]>("/api/conversations?box=requests"),
        apiRequest<{ preferences: MatchingPreferences }>("/api/matching/preferences"),
        apiRequest<{ settings: DmPrivacy }>("/api/dm/privacy"),
      ]);
      const nextUser = {
        ...bootstrap.currentUser,
        email: sessionEmail,
        emailVerified: sessionEmailVerified,
      };
      setUser(nextUser);
      onUserChanged(nextUser);
      setMatches(matchData.recommendations || []);
      setPosts(postData || []);
      setConversations(conversationData || []);
      setRequests(requestData || []);
      setPreferences(preferenceData.preferences);
      setPrivacy(privacyData.settings);
      setAiConfigured(Boolean(bootstrap.featureFlags?.aiConfigured));
      setCountries(bootstrap.countries || []);
      setIsAdmin(Boolean(bootstrap.isAdmin));
      setSelectedConversationId((current) => current || conversationData[0]?.id || "");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setLoading(false);
    }
  }, [onUserChanged, sessionEmail, sessionEmailVerified]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); void loadBlocks(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData, loadBlocks]);

  useEffect(() => {
    if (tab !== "reports") return;
    const timer = window.setTimeout(() => void loadReports(reportBox), 0);
    return () => window.clearTimeout(timer);
  }, [tab, reportBox, loadReports]);

  const selectedConversation = conversations.find((item) => item.id === selectedConversationId);

  const loadMessages = useCallback(async (conversationId: string, quiet = false) => {
    try {
      const result = await apiRequest<Message[]>("/api/conversations/" + encodeURIComponent(conversationId) + "/messages");
      setMessages(result);
    } catch (caught) {
      if (!quiet) setError(errorText(caught));
    }
  }, []);

  useEffect(() => {
    if (!selectedConversationId) return;
    const initialTimer = window.setTimeout(() => void loadMessages(selectedConversationId), 0);
    const pollingTimer = window.setInterval(() => void loadMessages(selectedConversationId, true), 4000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(pollingTimer);
    };
  }, [selectedConversationId, loadMessages]);

  const selectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setMobileThreadOpen(true);
    setAiPanelOpen(false);
    setAiSupport(null);
  };

  const startConversation = async (partner: UserProfile) => {
    setBusy(true);
    try {
      const conversation = await apiRequest<Conversation>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ partnerId: partner.id }),
      });
      setConversations((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)]);
      selectConversation(conversation.id);
      setMessages(conversation.messages || []);
      setTab("chats");
      showToast(t("{name}님과 대화를 시작했어요.", { name: partner.name }));
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const likePartner = async (partner: UserProfile) => {
    try {
      const result = await apiRequest<{ mutual: boolean }>("/api/partners/" + encodeURIComponent(partner.id) + "/like", {
        method: "POST",
        body: JSON.stringify({}),
      });
      showToast(result.mutual ? t("서로 마음을 보냈어요. 대화를 시작해 보세요!") : t("{name}님에게 마음을 보냈어요.", { name: partner.name }));
    } catch (caught) {
      setError(errorText(caught));
    }
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedConversationId || !messageDraft.trim()) return;
    const text = messageDraft.trim();
    setBusy(true);
    try {
      const result = await apiRequest<{ message: Message }>(
        "/api/conversations/" + encodeURIComponent(selectedConversationId) + "/messages",
        {
          method: "POST",
          body: JSON.stringify({
            text,
            type: "text",
            clientMessageId: "message-" + crypto.randomUUID(),
          }),
        },
      );
      setMessages((current) => [...current.filter((item) => item.id !== result.message.id), result.message]);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversationId
            ? { ...conversation, preview: text, updatedAt: result.message.sentAt }
            : conversation,
        ),
      );
      setMessageDraft("");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const translateMessage = async (message: Message) => {
    if (translatedMessages[message.id]) {
      setTranslatedMessages((current) => {
        const next = { ...current };
        delete next[message.id];
        return next;
      });
      return;
    }
    setTranslatingMessageId(message.id);
    setError("");
    try {
      const result = await apiRequest<TranslationResult>("/api/translate", {
        method: "POST",
        body: JSON.stringify({
          text: message.text,
          sourceLanguage: "auto",
          targetLanguage: user.nativeLanguages[0] || "ko",
        }),
      });
      setTranslatedMessages((current) => ({ ...current, [message.id]: result.translatedText }));
      showToast(t("번역했어요 · 오늘 {n}번 더 쓸 수 있어요", { n: result.entitlement.usage.remaining }));
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setTranslatingMessageId("");
    }
  };

  const requestConversationSupport = async () => {
    const partner = selectedConversation?.partner;
    if (!partner) return;
    setAiPanelOpen(true);
    setAiBusy(true);
    setError("");
    try {
      const result = await apiRequest<ConversationSupport>("/api/conversation-support", {
        method: "POST",
        body: JSON.stringify({
          partnerId: partner.id,
          stage: messageDraft.trim() ? "draft" : messages.length ? "ongoing" : "first-message",
          draft: messageDraft.trim(),
        }),
      });
      setAiSupport(result);
    } catch (caught) {
      setError(errorText(caught));
      setAiPanelOpen(false);
    } finally {
      setAiBusy(false);
    }
  };

  const publishPost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!postDraft.trim()) return;
    setBusy(true);
    try {
      const post = await apiRequest<Post>("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          text: postDraft.trim(),
          language: user.learningLanguages[0]?.code || "en",
          targetLanguage: user.nativeLanguages[0] || "ko",
          visibility: "public",
          requestCorrection: askCorrection,
        }),
      });
      setPosts((current) => [post, ...current]);
      setPostDraft("");
      setComposeOpen(false);
      showToast(t("글을 올렸어요."));
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const togglePostLike = async (post: Post) => {
    try {
      const result = await apiRequest<{ liked: boolean; likes: number }>("/api/posts/" + encodeURIComponent(post.id) + "/like", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, likes: result.likes } : item));
    } catch (caught) {
      setError(errorText(caught));
    }
  };

  const savePreferences = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!preferences) return;
    setBusy(true);
    try {
      const result = await apiRequest<{ preferences: MatchingPreferences }>("/api/matching/preferences", {
        method: "POST",
        body: JSON.stringify(preferences),
      });
      setPreferences(result.preferences);
      const nextMatches = await apiRequest<{ recommendations: MatchRecommendation[] }>("/api/matching/daily");
      setMatches(nextMatches.recommendations || []);
      setFiltersOpen(false);
      showToast(t("조건을 저장했어요."));
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  /** 신고는 접수 화면이 따로 없으므로 사유를 other 로 보내고 접수만 확인시킵니다. */
  const submitReport = async (reason: string) => {
    if (!reportTargetState) return;
    const { type: targetType, id: targetId } = reportTargetState;
    setReportTargetState(null);
    try {
      await apiRequest("/api/reports", {
        method: "POST",
        body: JSON.stringify({ targetType, targetId, reason }),
      });
      showToast(t("신고를 접수했어요. 운영팀이 확인할게요."));
    } catch (caught) {
      setError(errorText(caught));
    }
  };

  const blockPartner = async (partner: UserProfile) => {
    setBusy(true);
    try {
      await apiRequest("/api/partners/" + encodeURIComponent(partner.id) + "/block", { method: "POST", body: JSON.stringify({}) });
      showToast(t("{name}님을 차단했어요.", { name: partner.name }));
      await loadData();
      await loadBlocks();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPartnerPendingBlock(null);
      setBusy(false);
    }
  };

  const unblockPartner = async (partner: UserProfile) => {
    setBusy(true);
    try {
      await apiRequest("/api/partners/" + encodeURIComponent(partner.id) + "/block", { method: "DELETE" });
      showToast(t("{name}님 차단을 풀었어요.", { name: partner.name }));
      await loadData();
      await loadBlocks();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const acceptRequest = async (conversation: Conversation) => {
    setBusy(true);
    try {
      await apiRequest("/api/conversations/" + encodeURIComponent(conversation.id) + "/accept", { method: "POST", body: JSON.stringify({}) });
      showToast(t("메시지 요청을 수락했어요."));
      await loadData();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const resolveReport = async (report: AdminReport, outcome: "actioned" | "dismissed", note: string) => {
    setBusy(true);
    try {
      await apiRequest("/api/admin/reports/" + encodeURIComponent(report.id), {
        method: "PATCH",
        body: JSON.stringify({ outcome, resolution: note }),
      });
      showToast(outcome === "actioned" ? t("조치했다고 기록했어요.") : t("문제없음으로 닫았어요."));
      await loadReports(reportBox);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const deletePost = async (post: Post) => {
    setBusy(true);
    try {
      await apiRequest("/api/posts/" + encodeURIComponent(post.id), { method: "DELETE" });
      setPosts((items) => items.filter((item) => item.id !== post.id));
      showToast(t("글을 삭제했어요."));
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPostPendingDelete(null);
      setBusy(false);
    }
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (profileDraft.nativeLanguage === profileDraft.learningLanguage) {
        setError(t("모국어와 배우는 언어는 서로 달라야 해요."));
        return;
      }
      const result = await apiRequest<UserProfile>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: profileDraft.name,
          bio: profileDraft.bio,
          city: profileDraft.city,
          countryCode: profileDraft.countryCode,
          age: Number(profileDraft.age),
          nativeLanguages: [profileDraft.nativeLanguage],
          learningLanguages: [
            {
              code: profileDraft.learningLanguage,
              level: profileDraft.learningLevel,
              goal: initialUser.learningLanguages?.[0]?.goal || t("일상 대화"),
            },
          ],
        }),
      });
      setUser(result);
      onUserChanged(result);
      // "배우려는 말"과 매칭 조건의 targetLanguages 는 같은 것을 뜻합니다.
      // 따로 두면 프로필에서 일본어로 바꿔도 추천은 계속 영어 파트너를 줍니다.
      if (preferences && preferences.targetLanguages[0] !== profileDraft.learningLanguage) {
        const synced = { ...preferences, targetLanguages: [profileDraft.learningLanguage] };
        const saved = await apiRequest<{ preferences: MatchingPreferences }>("/api/matching/preferences", {
          method: "POST",
          body: JSON.stringify(synced),
        });
        setPreferences(saved.preferences);
        const refreshed = await apiRequest<{ recommendations: MatchRecommendation[] }>("/api/matching/daily");
        setMatches(refreshed.recommendations || []);
      }
      showToast(t("프로필을 저장했어요."));
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const savePrivacy = async (patch: Partial<DmPrivacy>) => {
    if (!privacy) return;
    try {
      const result = await apiRequest<{ settings: DmPrivacy }>("/api/dm/privacy", {
        method: "POST",
        body: JSON.stringify({ ...privacy, ...patch }),
      });
      setPrivacy(result.settings);
      showToast(t("설정을 저장했어요."));
    } catch (caught) {
      setError(errorText(caught));
    }
  };

  const signOut = async () => {
    try {
      await apiRequest<{ signedOut: boolean }>("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({}),
      });
    } finally {
      onSignedOut();
    }
  };

  const partnerCards = matches.map((recommendation) => (
    <article key={recommendation.partner.id} className={styles.partnerCard}>
      <header>
        <Avatar profile={recommendation.partner} size="large" />
        <div>
          <span className={styles.nameLine}>
            <h3>{recommendation.partner.name}</h3>
            {recommendation.partner.verified ? <BadgeCheck size={17} /> : null}
          </span>
          <p>{recommendation.partner.country?.flag} {tx(recommendation.partner.country?.name ?? "")}{recommendation.partner.city ? " · " + recommendation.partner.city : ""}</p>
          <small>{recommendation.partner.status === "online" ? t("지금 접속 중") : t("최근 활동")}</small>
        </div>
        <span className={styles.score}><strong>{recommendation.score}%</strong><small>{t("잘 맞아요")}</small></span>
        <OverflowMenu
          label={t("파트너 메뉴")}
          items={[
            { id: "report", label: t("신고하기"), icon: Flag, danger: true, onSelect: () => setReportTargetState({ type: "user", id: recommendation.partner.id, name: recommendation.partner.name }) },
            { id: "block", label: t("차단하기"), icon: Ban, danger: true, onSelect: () => setPartnerPendingBlock(recommendation.partner) },
          ]}
        />
      </header>
      <p className={styles.partnerBio}>{recommendation.partner.bio}</p>
      <div className={styles.languagePair}>
        <span><small>{t("가르쳐줄 수 있어요")}</small><strong>{recommendation.partner.nativeLanguages.map(languageLabel).join(" · ")}</strong></span>
        <span>↔</span>
        <span><small>{t("배우는 중이에요")}</small><strong>{recommendation.partner.learningLanguages.map((item) => languageLabel(item.code)).join(" · ")}</strong></span>
      </div>
      <div className={styles.reasonList}>
        {(recommendation.matchReasonCodes ?? []).length
          ? recommendation.matchReasonCodes!.map((reason, index) => (
              <span key={reason.code + index}><CheckCircle2 size={14} /> {matchReasonText(reason)}</span>
            ))
          : recommendation.matchReasons.map((reason) => <span key={reason}><CheckCircle2 size={14} /> {tx(reason)}</span>)}
      </div>
      <footer>
        <button type="button" className={styles.secondaryButton} onClick={() => void likePartner(recommendation.partner)}><Heart size={17} /> {t("마음 보내기")}</button>
        <button type="button" className={styles.primaryButton} onClick={() => void startConversation(recommendation.partner)} disabled={busy}><MessageCircle size={17} /> {t("대화 시작")}</button>
      </footer>
    </article>
  ));

  return (
    <div className={styles.root}>
      <aside className={styles.sidebar}>
        <button type="button" className={styles.brand} onClick={() => setTab("partners")}>
          <span className={styles.brandMark}><Languages size={22} /></span>
          <span>Lingo<strong>Loop</strong></span>
        </button>
        <nav>
          {(isAdmin ? [...navItems, adminNavItem] : navItems).map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" className={tab === item.id ? styles.active : ""} onClick={() => setTab(item.id)}>
                <Icon size={20} /><span>{t(item.label as MessageKey)}</span>
              </button>
            );
          })}
        </nav>
        <div className={styles.sidebarSpacer} />
        <div className={styles.liveStatus}><span /> {t("연결됨")}</div>
        <button type="button" className={styles.userButton} onClick={() => setTab("profile")}>
          <Avatar profile={user} size="small" />
          <span><strong>{user.name}</strong><small>{user.handle}</small></span>
        </button>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.mobileHeader}>
          <button type="button" className={styles.brand} onClick={() => setTab("partners")}>
            <span className={styles.brandMark}><Languages size={20} /></span>
            <span>Lingo<strong>Loop</strong></span>
          </button>
          <span className={styles.liveDot} title={t("서버에 연결되어 있어요")} />
        </header>

        <main className={styles.main}>
          {error ? (
            <div className={styles.errorBanner} role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => { setLoading(true); setError(""); void loadData(); }}><RefreshCw size={16} /> {t("다시 시도")}</button>
            </div>
          ) : null}

          {loading ? (
            <div className={styles.sectionLoading}><RefreshCw size={22} /> {t("불러오는 중…")}</div>
          ) : null}

          {!loading && tab === "partners" ? (
            <section className={styles.pageSection}>
              <header className={styles.pageHeader}>
                <div><p className={styles.eyebrow}>DAILY MATCH</p><h1>{t("오늘의 파트너")}</h1><p>{t("내 설정과 잘 맞는 사람들을 골라왔어요.")}</p></div>
                <button type="button" className={styles.secondaryButton} onClick={() => setFiltersOpen((value) => !value)}><SlidersHorizontal size={17} /> {t("조건 설정")}</button>
              </header>
              {filtersOpen && preferences ? (
                <form className={styles.settingsPanel} onSubmit={savePreferences}>
                  <p className={styles.settingsNote}>{t("배울 언어는 반드시 맞춰서 찾고, 나머지는 가까운 사람까지 함께 보여드려요.")}</p>
                  <SelectField
                    label={t("배울 언어")}
                    value={preferences.targetLanguages[0] || "en"}
                    options={Object.keys(LANGUAGE_LABELS).filter((code) => code !== "ko").map((code) => ({ value: code, label: languageLabel(code) }))}
                    onChange={(next) => setPreferences({ ...preferences, targetLanguages: [next] })}
                  />
                  <label>{t("최소 나이")}<input type="number" min={18} max={100} value={preferences.ageMin} onChange={(event) => setPreferences({ ...preferences, ageMin: Number(event.target.value) })} /></label>
                  <label>{t("최대 나이")}<input type="number" min={18} max={100} value={preferences.ageMax} onChange={(event) => setPreferences({ ...preferences, ageMax: Number(event.target.value) })} /></label>
                  <label className={styles.checkLabel}><input type="checkbox" checked={preferences.onlineOnly} onChange={(event) => setPreferences({ ...preferences, onlineOnly: event.target.checked })} /> {t("접속 중인 사용자 우선")}</label>
                  <button type="submit" className={styles.primaryButton} disabled={busy}>{t("저장하기")}</button>
                </form>
              ) : null}
              <div className={styles.partnerGrid}>
                {partnerCards.length ? partnerCards : (
                  <EmptyState
                    icon={UsersRound}
                    title={t("조건에 맞는 사람이 아직 없어요")}
                    description={t("조건을 넓히거나, 새로운 사람이 들어오면 여기에 나타나요. 없는 사람을 지어내지는 않아요.")}
                    action={<button type="button" className={styles.secondaryButton} onClick={() => setFiltersOpen(true)}>{t("조건 넓히기")}</button>}
                  />
                )}
              </div>
            </section>
          ) : null}

          {!loading && tab === "community" ? (
            <section className={styles.pageSection}>
              <header className={styles.pageHeader}>
                <div><p className={styles.eyebrow}>COMMUNITY</p><h1>{t("커뮤니티")}</h1><p>{t("사람들이 올린 글을 최신순으로 보여드려요.")}</p></div>
                <button type="button" className={styles.primaryButton} onClick={() => setComposeOpen(true)}><PenLine size={17} /> {t("글쓰기")}</button>
              </header>
              {composeOpen ? (
                <form className={styles.composeCard} onSubmit={publishPost}>
                  <header><strong>{t("새 게시물")}</strong><button type="button" onClick={() => setComposeOpen(false)} aria-label={t("닫기")}><X size={18} /></button></header>
                  <textarea value={postDraft} onChange={(event) => setPostDraft(event.target.value)} maxLength={3000} placeholder={t("오늘 연습한 문장이나 궁금한 표현을 적어보세요.")} required />
                  <label className={styles.checkLabel}>
                    <input type="checkbox" aria-label={t("원어민 교정 요청하기")} checked={askCorrection} onChange={(event) => setAskCorrection(event.target.checked)} />
                    <span aria-hidden="true">
                      <strong>{t("원어민 교정 요청하기")}</strong>
                      <small>{t("이 글을 보는 원어민이 고쳐줄 수 있게 표시해요.")}</small>
                    </span>
                  </label>
                  <footer><small>{t("{n} / 3000", { n: postDraft.length })}</small><button className={styles.primaryButton} type="submit" disabled={busy || !postDraft.trim()}>{t("게시하기")}</button></footer>
                </form>
              ) : null}
              <div className={styles.feed}>
                {posts.length ? posts.map((post) => (
                  <article key={post.id} className={styles.postCard}>
                    <header>
                      <span className={styles.postAvatar}>{post.author.name.slice(0, 1)}<i>{post.author.flag}</i></span>
                      <div><strong>{post.author.name}</strong><small>{post.author.handle} · {relativeTime(post.createdAt)}</small></div>
                      <span className={styles.languageTag}>{languageLabel(post.language)}</span>
                      <OverflowMenu
                        label={t("게시물 메뉴")}
                        items={post.authorId === user.id
                          ? [{ id: "delete", label: t("삭제하기"), icon: Trash2, danger: true, onSelect: () => setPostPendingDelete(post) }]
                          : [
                              { id: "report", label: t("신고하기"), icon: Flag, danger: true, onSelect: () => setReportTargetState({ type: "post", id: post.id, name: post.author.name }) },
                              { id: "block", label: t("이 사람 차단하기"), icon: Ban, danger: true, onSelect: () => setPartnerPendingBlock({ id: post.authorId, name: post.author.name } as UserProfile) },
                            ]}
                      />
                    </header>
                    <p>{post.text}</p>
                    <div className={styles.tags}>{post.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                    <footer>
                      <button type="button" onClick={() => void togglePostLike(post)}><Heart size={17} /> {post.likes}</button>
                      <span><MessageCircle size={17} /> {post.comments}</span>
                      {post.requestCorrection ? <span><PenLine size={16} /> {t("교정 요청")}</span> : null}
                    </footer>
                  </article>
                )) : <EmptyState icon={PenLine} title={t("아직 올라온 글이 없어요")} description={t("첫 글을 남겨보세요. 다른 사람들에게 바로 보여요.")} />}
              </div>
            </section>
          ) : null}

          {!loading && tab === "chats" ? (
            <section className={styles.pageSection}>
              <header className={styles.pageHeader}>
                <div><p className={styles.eyebrow}>MESSAGES</p><h1>{t("대화")}</h1><p>{t("주고받은 메시지는 계정에 남아요.")}</p></div>
              </header>
              {requests.length ? (
                <section className={styles.requestBox} aria-label={t("메시지 요청")}>
                  <header><Mail size={18} /><strong>{t("메시지 요청 {n}건", { n: requests.length })}</strong></header>
                  <p>{t("내가 정한 범위 밖에서 온 대화예요. 수락해야 답장할 수 있어요.")}</p>
                  {requests.map((request) => (
                    <div key={request.id} className={styles.requestRow}>
                      {request.partner ? <Avatar profile={request.partner} size="small" /> : null}
                      <span>
                        <strong>{request.partner?.name}</strong>
                        <small>{request.preview}</small>
                        {request.spamSignals?.length ? (
                          <em className={styles.spamFlag}>
                            <ShieldAlert size={13} /> {request.spamSignals.map((code) => t(SPAM_LABELS[code] as MessageKey)).join(" · ")}
                          </em>
                        ) : null}
                      </span>
                      <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => request.partner && setPartnerPendingBlock(request.partner)}>{t("차단")}</button>
                      <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void acceptRequest(request)}>{t("수락")}</button>
                    </div>
                  ))}
                </section>
              ) : null}
              {conversations.length ? (
                <div className={`${styles.chatLayout} ${mobileThreadOpen ? styles.threadOpen : ""}`.trim()}>
                  <aside className={styles.chatList}>
                    {conversations.map((conversation) => conversation.partner ? (
                      <button key={conversation.id} type="button" className={selectedConversationId === conversation.id ? styles.active : ""} onClick={() => selectConversation(conversation.id)}>
                        <Avatar profile={conversation.partner} size="small" />
                        <span><strong>{conversation.partner.name}</strong><small>{conversation.preview}</small></span>
                        <time>{relativeTime(conversation.updatedAt)}</time>
                      </button>
                    ) : null)}
                  </aside>
                  <article className={styles.thread}>
                    {selectedConversation?.partner ? (
                      <>
                        <header>
                          <button type="button" className={styles.threadBack} aria-label={t("대화 목록으로")} onClick={() => setMobileThreadOpen(false)}>
                            <ArrowLeft size={20} />
                          </button>
                          <Avatar profile={selectedConversation.partner} size="small" />
                          <span><strong>{selectedConversation.partner.name}</strong><small>{selectedConversation.partner.status === "online" ? t("접속 중") : t("오프라인")}</small></span>
                          <div className={styles.threadActions}>
                            <i><Database size={15} /> {t("자동 저장")}</i>
                            <button
                              type="button"
                              className={styles.aiButton}
                              onClick={() => {
                                if (aiPanelOpen) setAiPanelOpen(false);
                                else if (aiSupport) setAiPanelOpen(true);
                                else void requestConversationSupport();
                              }}
                              disabled={!aiConfigured || aiBusy}
                              title={aiConfigured ? t("무슨 말을 할지 추천받기") : t("AI 기능은 아직 준비 중이에요")}
                            >
                              <Sparkles size={15} /> {t("AI 도움")}
                            </button>
                          </div>
                        </header>
                        <div className={styles.messages}>
                          {messages.length ? messages.map((message) => (
                            <div key={message.id} className={message.senderId === user.id ? styles.mine : styles.theirs}>
                              <p>
                                <span>{message.text}</span>
                                {translatedMessages[message.id] ? <em className={styles.translation}>{translatedMessages[message.id]}</em> : null}
                              </p>
                              <footer className={styles.messageMeta}>
                                <small>{relativeTime(message.sentAt)}</small>
                                {message.senderId === user.id && message.readByPartner ? <small>{t("읽음")}</small> : null}
                                {message.senderId !== user.id && aiConfigured ? (
                                  <button type="button" onClick={() => void translateMessage(message)} disabled={translatingMessageId === message.id}>
                                    <Languages size={12} />
                                    {translatingMessageId === message.id ? t("번역 중") : translatedMessages[message.id] ? t("원문만") : t("번역")}
                                  </button>
                                ) : null}
                              </footer>
                            </div>
                          )) : <p className={styles.threadEmpty}>{t("첫 메시지를 보내 대화를 시작해 보세요.")}</p>}
                        </div>
                        <div className={styles.composerArea}>
                          {aiPanelOpen ? (
                            <section className={styles.aiPanel} aria-label={t("AI 대화 도움")}>
                              <header>
                                <strong><Sparkles size={15} /> {t("AI 대화 도움")}</strong>
                                <button type="button" onClick={() => setAiPanelOpen(false)} aria-label={t("AI 도움 닫기")}><X size={16} /></button>
                              </header>
                              {aiBusy ? <p className={styles.aiLoading}><RefreshCw size={15} /> {t("대화 주제를 만드는 중…")}</p> : null}
                              {!aiBusy && aiSupport ? (
                                <div className={styles.aiContent}>
                                  <p className={styles.aiTip}>{aiSupport.tip}</p>
                                  <div className={styles.aiTopics}>{aiSupport.topics.map((topic) => <span key={topic}>{topic}</span>)}</div>
                                  <div className={styles.aiSuggestions}>
                                    {[...aiSupport.suggestedOpeners, ...aiSupport.followUpQuestions].map((suggestion, index) => (
                                      <button key={index + "-" + suggestion} type="button" onClick={() => setMessageDraft(suggestion)}>{suggestion}</button>
                                    ))}
                                    {aiSupport.improvedDraft && aiSupport.improvedDraft !== messageDraft ? (
                                      <button type="button" onClick={() => setMessageDraft(aiSupport.improvedDraft)}>{t("다듬은 문장: {draft}", { draft: aiSupport.improvedDraft })}</button>
                                    ) : null}
                                  </div>
                                  <small>{t("누르면 입력창에 들어가요 · 오늘 {n}번 더 쓸 수 있어요", { n: aiSupport.entitlement.usage.remaining })}</small>
                                </div>
                              ) : null}
                            </section>
                          ) : null}
                          <form className={styles.messageForm} onSubmit={sendMessage}>
                            <input value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} maxLength={4000} placeholder={t("메시지 입력")} />
                            <button type="submit" className={styles.primaryButton} disabled={busy || !messageDraft.trim()} aria-label={t("전송")}><Send size={18} /></button>
                          </form>
                        </div>
                      </>
                    ) : null}
                  </article>
                </div>
              ) : <EmptyState icon={MessageCircle} title={t("아직 대화가 없어요")} description={t("파트너 탭에서 대화를 시작하면 여기에 쌓여요.")} action={<button type="button" className={styles.primaryButton} onClick={() => setTab("partners")}>{t("파트너 찾기")}</button>} />}
            </section>
          ) : null}


          {!loading && tab === "reports" ? (
            <section className={styles.pageSection}>
              <header className={styles.pageHeader}>
                <div><p className={styles.eyebrow}>REPORTS</p><h1>{t("신고 처리")}</h1><p>{t("접수된 신고를 확인하고 닫습니다.")}</p></div>
                <div className={styles.scopeButtons}>
                  <button type="button" className={reportBox === "open" ? styles.active : ""} onClick={() => setReportBox("open")}>{t("처리 전")}</button>
                  <button type="button" className={reportBox === "closed" ? styles.active : ""} onClick={() => setReportBox("closed")}>{t("처리함")}</button>
                </div>
              </header>
              {reports.length ? (
                <div className={styles.reportList}>
                  {reports.map((report) => (
                    <ReportRow key={report.id} report={report} busy={busy} onResolve={resolveReport} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Flag}
                  title={reportBox === "open" ? t("처리할 신고가 없어요") : t("처리한 신고가 없어요")}
                  description={t("신고가 들어오면 여기에 모입니다.")}
                />
              )}
            </section>
          ) : null}

          {!loading && tab === "profile" ? (
            <section className={styles.pageSection}>
              <header className={styles.pageHeader}>
                <div><p className={styles.eyebrow}>ACCOUNT</p><h1>{t("내 프로필")}</h1><p>{t("여기서 바꾼 내용은 로그인한 모든 기기에 반영돼요.")}</p></div>
              </header>
              <div className={styles.profileGrid}>
                <article className={styles.profileSummary}>
                  <Avatar profile={user} size="large" />
                  <div><span className={styles.nameLine}><h2>{user.name}</h2>{user.emailVerified ? <BadgeCheck size={18} /> : null}</span><p>{user.handle}</p><small>{user.email}</small></div>
                  <div className={styles.syncBadge}><Database size={16} /> {t("계정에 저장됨")}</div>
                </article>
                <form className={styles.profileForm} onSubmit={saveProfile}>
                  <header><Settings size={19} /><strong>{t("프로필 설정")}</strong></header>
                  <label>{t("이름")}<input value={profileDraft.name} onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })} minLength={2} maxLength={40} required /></label>
                  <label>{t("도시")}<input value={profileDraft.city} onChange={(event) => setProfileDraft({ ...profileDraft, city: event.target.value })} maxLength={80} placeholder={t("예: 서울")} /></label>
                  <label>{t("나이")}<input type="number" min={18} max={100} value={profileDraft.age} onChange={(event) => setProfileDraft({ ...profileDraft, age: Number(event.target.value) })} required /></label>
                  {/* 이 두 줄이 매칭의 전제입니다 — 내가 쓰는 말과 배우려는 말이 맞물려야 파트너가 잡힙니다. */}
                  <SelectField
                    label={t("사는 곳")}
                    value={profileDraft.countryCode}
                    options={countries.map((country) => ({ value: country.code, label: country.flag + " " + tx(country.name) }))}
                    onChange={(next) => setProfileDraft({ ...profileDraft, countryCode: next })}
                  />
                  <SelectField
                    label={t("내가 쓰는 말")}
                    value={profileDraft.nativeLanguage}
                    options={Object.keys(LANGUAGE_LABELS).map((code) => ({ value: code, label: languageLabel(code) }))}
                    onChange={(next) => setProfileDraft({ ...profileDraft, nativeLanguage: next })}
                  />
                  <SelectField
                    label={t("배우려는 말")}
                    value={profileDraft.learningLanguage}
                    options={Object.keys(LANGUAGE_LABELS).map((code) => ({ value: code, label: languageLabel(code) }))}
                    onChange={(next) => setProfileDraft({ ...profileDraft, learningLanguage: next })}
                  />
                  <SelectField
                    label={t("내 수준")}
                    value={profileDraft.learningLevel}
                    options={Object.entries(LEVEL_LABELS).map(([value, label]) => ({ value, label: t(label as MessageKey) }))}
                    onChange={(next) => setProfileDraft({ ...profileDraft, learningLevel: next })}
                  />
                  <label>{t("소개")}<textarea value={profileDraft.bio} onChange={(event) => setProfileDraft({ ...profileDraft, bio: event.target.value })} maxLength={500} /></label>
                  <button type="submit" className={styles.primaryButton} disabled={busy}>{t("변경사항 저장")}</button>
                </form>
                <article className={styles.privacyCard}>
                  <header><ShieldCheck size={19} /><strong>{t("DM 수신 범위")}</strong></header>
                  <p>{t("누가 나에게 먼저 말을 걸 수 있는지 정해요.")}</p>
                  <div className={styles.scopeButtons}>
                    {[
                      ["matches", msg("추천·매칭된 사용자")],
                      ["mutual-follows", msg("서로 팔로우")],
                      ["everyone", msg("모든 사용자")],
                    ].map(([value, label]) => (
                      <button key={value} type="button" className={privacy?.whoCanMessage === value ? styles.active : ""} onClick={() => void savePrivacy({ whoCanMessage: value })}>{t(label as MessageKey)}</button>
                    ))}
                  </div>
                  <label className={styles.checkLabel}>
                    <input
                      type="checkbox"
                      aria-label={t("범위 밖 대화는 요청함으로")}
                      checked={Boolean(privacy?.routeOthersToRequests)}
                      onChange={(event) => void savePrivacy({ routeOthersToRequests: event.target.checked })}
                    />
                    <span aria-hidden="true">
                      <strong>{t("범위 밖 대화는 요청함으로")}</strong>
                      <small>{t("끄면 범위 밖에서 오는 대화를 아예 받지 않아요.")}</small>
                    </span>
                  </label>
                  <label className={styles.checkLabel}>
                    <input
                      type="checkbox"
                      aria-label={t("수상한 첫 메시지에 표시하기")}
                      checked={Boolean(privacy?.flagSuspectedSpam)}
                      onChange={(event) => void savePrivacy({ flagSuspectedSpam: event.target.checked })}
                    />
                    <span aria-hidden="true">
                      <strong>{t("수상한 첫 메시지에 표시하기")}</strong>
                      <small>{t("링크·연락처처럼 자주 쓰이는 수법이 보이면 요청함에 알려드려요. 막지는 않아요.")}</small>
                    </span>
                  </label>
                </article>
                <article className={styles.blockCard}>
                  <header><Ban size={19} /><strong>{t("차단한 사용자")}</strong></header>
                  <p>{t("차단하면 서로의 글과 프로필이 보이지 않고, 메시지도 오가지 않아요.")}</p>
                  {blockedPartners.length ? (
                    <div className={styles.blockList}>
                      {blockedPartners.map((row) => (
                        <div key={row.blockedId} className={styles.requestRow}>
                          <Avatar profile={row.partner} size="small" />
                          <span><strong>{row.partner.name}</strong><small>{row.partner.handle}</small></span>
                          <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => void unblockPartner(row.partner)}>{t("차단 풀기")}</button>
                        </div>
                      ))}
                    </div>
                  ) : <small>{t("아직 차단한 사용자가 없어요.")}</small>}
                </article>
                <LanguagePicker />
                <article className={styles.accountCard}>
                  <header><LockKeyhole size={19} /><strong>{t("계정 및 세션")}</strong></header>
                  <p>{user.emailVerified ? t("이메일 인증 완료") : t("이메일 인증 대기 중")} · {t("로그인 정보는 안전하게 보관돼요.")}</p>
                  <button type="button" className={styles.dangerButton} onClick={() => void signOut()}><LogOut size={17} /> {t("로그아웃")}</button>
                </article>
              </div>
            </section>
          ) : null}
        </main>
      </div>

      <nav className={styles.mobileNav}>
        {(isAdmin ? [...navItems, adminNavItem] : navItems).map((item) => {
          const Icon = item.icon;
          return <button key={item.id} type="button" className={tab === item.id ? styles.active : ""} onClick={() => setTab(item.id)}><Icon size={20} /><span>{t(item.mobileLabel as MessageKey)}</span></button>;
        })}
      </nav>
      {reportTargetState ? (
        <ReportDialog
          title={t("{name}님을 신고할까요?", { name: reportTargetState.name })}
          onCancel={() => setReportTargetState(null)}
          onSubmit={(reason) => void submitReport(reason)}
        />
      ) : null}
      {partnerPendingBlock ? (
        <ConfirmDialog
          title={t("{name}님을 차단할까요?", { name: partnerPendingBlock.name })}
          body={t("서로의 글과 프로필이 보이지 않고, 메시지도 오가지 않아요. 차단을 풀면 다시 이어져요.")}
          confirmLabel={t("차단하기")}
          onCancel={() => setPartnerPendingBlock(null)}
          onConfirm={() => void blockPartner(partnerPendingBlock)}
        />
      ) : null}
      {postPendingDelete ? (
        <ConfirmDialog
          title={t("이 글을 삭제할까요?")}
          body={t("지운 글은 되돌릴 수 없어요.")}
          confirmLabel={t("삭제하기")}
          onCancel={() => setPostPendingDelete(null)}
          onConfirm={() => void deletePost(postPendingDelete)}
        />
      ) : null}
      {toast ? <div className={styles.toast}>{toast}</div> : null}
    </div>
  );
}

export default function ProductionLingoLoopApp() {
  return (
    <I18nProvider>
      <ProductionLingoLoopScreens />
    </I18nProvider>
  );
}

function ProductionLingoLoopScreens() {
  // 화면 문구는 모듈 함수 t() 로 읽습니다. 언어가 바뀔 때 여기부터 다시 그려야
  // 아래 화면들이 새 언어로 바뀝니다 — 자세한 이유는 useLocaleRerender 주석 참고.
  useLocaleRerender();
  const [authState, setAuthState] = useState<"loading" | "authenticated" | "anonymous">("loading");
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ user: UserProfile }>("/api/auth/me")
      .then((result) => {
        if (cancelled) return;
        setUser(result.user);
        setAuthState("authenticated");
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiClientError && error.status === 401) {
          setAuthState("anonymous");
          return;
        }
        setAuthState("anonymous");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (authState === "loading") return <LoadingScreen />;
  if (authState === "anonymous" || !user) {
    return (
      <AuthScreen
        onAuthenticated={(authenticatedUser) => {
          setUser(authenticatedUser);
          setAuthState("authenticated");
        }}
      />
    );
  }
  return (
    <OperationalApp
      initialUser={user}
      onSignedOut={() => {
        setUser(null);
        setAuthState("anonymous");
      }}
      onUserChanged={setUser}
    />
  );
}
