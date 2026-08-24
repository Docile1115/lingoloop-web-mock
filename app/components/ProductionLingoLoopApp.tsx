"use client";

import {
  BadgeCheck,
  CheckCircle2,
  Compass,
  Database,
  Heart,
  Languages,
  LockKeyhole,
  LogOut,
  Mail,
  MessageCircle,
  PenLine,
  Plus,
  Radio,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  User,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import styles from "./ProductionLingoLoopApp.module.css";

type Tab = "partners" | "community" | "chats" | "rooms" | "profile";

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
};

type Conversation = {
  id: string;
  partner: UserProfile | null;
  preview: string;
  updatedAt: string;
  unreadCount: number;
  messages?: Message[];
};

type VoiceRoom = {
  id: string;
  title: string;
  topic: string;
  language: string;
  level: string;
  hostId: string;
  host: string;
  hostFlag: string;
  listeners: number;
  active: boolean;
  audioTransport: string;
  createdAt: string;
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
  routeOthersToRequests: boolean;
  filterSuspectedSpam: boolean;
  allowVoiceMessagesInRequests: boolean;
  readReceipts: boolean;
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

type ApiEnvelope<T> = {
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
    mock: false;
    persistent: boolean;
  };
};

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
      body.error?.message || "요청을 처리하지 못했습니다.",
    );
  }
  return body.data;
}

const LANGUAGE_LABELS: Record<string, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  zh: "中文",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

const navItems: Array<{ id: Tab; label: string; mobileLabel: string; icon: LucideIcon }> = [
  { id: "partners", label: "파트너", mobileLabel: "파트너", icon: Compass },
  { id: "community", label: "커뮤니티", mobileLabel: "피드", icon: UsersRound },
  { id: "chats", label: "대화", mobileLabel: "대화", icon: MessageCircle },
  { id: "rooms", label: "보이스룸", mobileLabel: "연습", icon: Radio },
  { id: "profile", label: "프로필", mobileLabel: "프로필", icon: User },
];

function languageLabel(code: string) {
  return LANGUAGE_LABELS[code] || code.toLocaleUpperCase();
}

function relativeTime(value: string) {
  const milliseconds = Date.now() - Date.parse(value);
  const minutes = Math.max(0, Math.floor(milliseconds / 60000));
  if (minutes < 1) return "방금";
  if (minutes < 60) return minutes + "분 전";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "시간 전";
  return Math.floor(hours / 24) + "일 전";
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
      <strong>LingoLoop</strong>
      <p>안전한 로그인 상태를 확인하고 있어요.</p>
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
      if (result.emailVerificationSent) setNotice("확인 메일을 보냈습니다.");
      onAuthenticated(result.user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "로그인 요청을 처리하지 못했습니다.");
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
        <h1>실제 사람과 대화하고,<br />기록은 계정에 안전하게 남겨요.</h1>
        <p className={styles.authDescription}>
          프로필, 커뮤니티 글, 매칭 설정과 모든 메시지는 Firestore에 저장되어
          기기를 바꾸거나 다시 로그인해도 이어집니다.
        </p>
        <ul className={styles.authFacts}>
          <li><Database size={18} /> 서버 영구 저장</li>
          <li><LockKeyhole size={18} /> 보안 세션 쿠키</li>
          <li><ShieldCheck size={18} /> 사용자별 접근 권한</li>
        </ul>
      </section>

      <section className={styles.authCard}>
        <div className={styles.authTabs}>
          <button type="button" className={mode === "login" ? styles.active : ""} onClick={() => setMode("login")}>로그인</button>
          <button type="button" className={mode === "register" ? styles.active : ""} onClick={() => setMode("register")}>회원가입</button>
        </div>
        <div>
          <h2>{mode === "login" ? "다시 만나서 반가워요" : "LingoLoop 시작하기"}</h2>
          <p>{mode === "login" ? "기존 대화와 학습 기록을 불러옵니다." : "첫 프로필은 가입 후 언제든 수정할 수 있어요."}</p>
        </div>
        <form onSubmit={submit} className={styles.authForm}>
          {mode === "register" ? (
            <label>
              이름
              <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={40} placeholder="표시할 이름" autoComplete="name" required />
            </label>
          ) : null}
          <label>
            이메일
            <span className={styles.inputWithIcon}><Mail size={17} /><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.com" autoComplete="email" required /></span>
          </label>
          <label>
            비밀번호
            <span className={styles.inputWithIcon}><LockKeyhole size={17} /><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={mode === "register" ? 10 : 1} maxLength={128} placeholder={mode === "register" ? "10자 이상" : "비밀번호"} autoComplete={mode === "register" ? "new-password" : "current-password"} required /></span>
          </label>
          {error ? <p className={styles.formError} role="alert">{error}</p> : null}
          {notice ? <p className={styles.formNotice}>{notice}</p> : null}
          <button className={styles.primaryButton} type="submit" disabled={busy}>
            {busy ? "처리 중…" : mode === "login" ? "로그인" : "계정 만들기"}
          </button>
        </form>
        <small className={styles.authLegal}>가입하면 커뮤니티 운영정책과 개인정보 처리 기준에 동의하는 것으로 간주합니다.</small>
      </section>
    </main>
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
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
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
  const [roomFormOpen, setRoomFormOpen] = useState(false);
  const [roomTitle, setRoomTitle] = useState("");
  const [roomTopic, setRoomTopic] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [profileDraft, setProfileDraft] = useState({
    name: initialUser.name,
    bio: initialUser.bio,
    city: initialUser.city || "",
  });
  const sessionEmail = initialUser.email;
  const sessionEmailVerified = initialUser.emailVerified;

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const loadData = useCallback(async () => {
    try {
      const [bootstrap, matchData, postData, conversationData, roomData, preferenceData, privacyData] = await Promise.all([
        apiRequest<{ currentUser: UserProfile; featureFlags: FeatureFlags }>("/api/bootstrap"),
        apiRequest<{ recommendations: MatchRecommendation[] }>("/api/matching/daily"),
        apiRequest<Post[]>("/api/posts"),
        apiRequest<Conversation[]>("/api/conversations"),
        apiRequest<VoiceRoom[]>("/api/rooms"),
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
      setRooms(roomData || []);
      setPreferences(preferenceData.preferences);
      setPrivacy(privacyData.settings);
      setAiConfigured(Boolean(bootstrap.featureFlags?.aiConfigured));
      setSelectedConversationId((current) => current || conversationData[0]?.id || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "운영 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [onUserChanged, sessionEmail, sessionEmailVerified]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const selectedConversation = conversations.find((item) => item.id === selectedConversationId);

  const loadMessages = useCallback(async (conversationId: string, quiet = false) => {
    try {
      const result = await apiRequest<Message[]>("/api/conversations/" + encodeURIComponent(conversationId) + "/messages");
      setMessages(result);
    } catch (caught) {
      if (!quiet) setError(caught instanceof Error ? caught.message : "메시지를 불러오지 못했습니다.");
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
      showToast(partner.name + "님과 실제 대화방을 만들었어요.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "대화를 시작하지 못했습니다.");
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
      showToast(result.mutual ? "서로 마음을 보냈어요. 대화를 시작해 보세요!" : partner.name + "님에게 마음을 보냈어요.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "마음을 보내지 못했습니다.");
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
      setError(caught instanceof Error ? caught.message : "메시지를 보내지 못했습니다.");
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
      showToast("번역 완료 · 오늘 " + result.entitlement.usage.remaining + "회 남음");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "메시지를 번역하지 못했습니다.");
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
      setError(caught instanceof Error ? caught.message : "AI 대화 도움을 불러오지 못했습니다.");
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
          tags: ["오늘의연습"],
          visibility: "public",
          requestCorrection: true,
        }),
      });
      setPosts((current) => [post, ...current]);
      setPostDraft("");
      setComposeOpen(false);
      showToast("게시물이 Firestore에 저장됐어요.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "게시물을 저장하지 못했습니다.");
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
      setError(caught instanceof Error ? caught.message : "좋아요를 저장하지 못했습니다.");
    }
  };

  const createRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      const room = await apiRequest<VoiceRoom>("/api/rooms", {
        method: "POST",
        body: JSON.stringify({
          title: roomTitle,
          topic: roomTopic,
          language: user.learningLanguages[0]?.code || "en",
          level: user.learningLanguages[0]?.level || "all",
        }),
      });
      setRooms((current) => [room, ...current]);
      setRoomTitle("");
      setRoomTopic("");
      setRoomFormOpen(false);
      showToast("보이스룸 정보가 서버에 저장됐어요.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "보이스룸을 만들지 못했습니다.");
    } finally {
      setBusy(false);
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
      showToast("매칭 조건을 계정에 저장했어요.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "매칭 설정을 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await apiRequest<UserProfile>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify(profileDraft),
      });
      setUser(result);
      onUserChanged(result);
      showToast("프로필을 계정에 저장했어요.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "프로필을 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const savePrivacy = async (scope: string) => {
    if (!privacy) return;
    try {
      const result = await apiRequest<{ settings: DmPrivacy }>("/api/dm/privacy", {
        method: "POST",
        body: JSON.stringify({ ...privacy, whoCanMessage: scope }),
      });
      setPrivacy(result.settings);
      showToast("DM 수신 범위를 계정에 저장했어요.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "DM 설정을 저장하지 못했습니다.");
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
          <p>{recommendation.partner.country?.flag} {recommendation.partner.country?.name}{recommendation.partner.city ? " · " + recommendation.partner.city : ""}</p>
          <small>{recommendation.partner.status === "online" ? "지금 접속 중" : "최근 활동"}</small>
        </div>
        <span className={styles.score}><strong>{recommendation.score}%</strong><small>잘 맞아요</small></span>
      </header>
      <p className={styles.partnerBio}>{recommendation.partner.bio}</p>
      <div className={styles.languagePair}>
        <span><small>가르쳐줘요</small><strong>{recommendation.partner.nativeLanguages.map(languageLabel).join(" · ")}</strong></span>
        <span>↔</span>
        <span><small>배우고 있어요</small><strong>{recommendation.partner.learningLanguages.map((item) => languageLabel(item.code)).join(" · ")}</strong></span>
      </div>
      <div className={styles.reasonList}>
        {recommendation.matchReasons.map((reason) => <span key={reason}><CheckCircle2 size={14} /> {reason}</span>)}
      </div>
      <footer>
        <button type="button" className={styles.secondaryButton} onClick={() => void likePartner(recommendation.partner)}><Heart size={17} /> 마음 보내기</button>
        <button type="button" className={styles.primaryButton} onClick={() => void startConversation(recommendation.partner)} disabled={busy}><MessageCircle size={17} /> 대화 시작</button>
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
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" className={tab === item.id ? styles.active : ""} onClick={() => setTab(item.id)}>
                <Icon size={20} /><span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className={styles.sidebarSpacer} />
        <div className={styles.liveStatus}><span /> 운영 API · Firestore</div>
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
          <span className={styles.liveDot} title="운영 API 연결" />
        </header>

        <main className={styles.main}>
          {error ? (
            <div className={styles.errorBanner} role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => { setLoading(true); setError(""); void loadData(); }}><RefreshCw size={16} /> 다시 시도</button>
            </div>
          ) : null}

          {loading ? (
            <div className={styles.sectionLoading}><RefreshCw size={22} /> 실제 데이터를 불러오는 중…</div>
          ) : null}

          {!loading && tab === "partners" ? (
            <section className={styles.pageSection}>
              <header className={styles.pageHeader}>
                <div><p className={styles.eyebrow}>DAILY MATCH</p><h1>오늘의 파트너</h1><p>실제 가입 사용자 중 내 설정과 가까운 파트너를 보여드립니다.</p></div>
                <button type="button" className={styles.secondaryButton} onClick={() => setFiltersOpen((value) => !value)}><SlidersHorizontal size={17} /> 조건 설정</button>
              </header>
              {filtersOpen && preferences ? (
                <form className={styles.settingsPanel} onSubmit={savePreferences}>
                  <label>배울 언어
                    <select value={preferences.targetLanguages[0] || "en"} onChange={(event) => setPreferences({ ...preferences, targetLanguages: [event.target.value] })}>
                      {Object.entries(LANGUAGE_LABELS).filter(([code]) => code !== "ko").map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                    </select>
                  </label>
                  <label>최소 나이<input type="number" min={18} max={100} value={preferences.ageMin} onChange={(event) => setPreferences({ ...preferences, ageMin: Number(event.target.value) })} /></label>
                  <label>최대 나이<input type="number" min={18} max={100} value={preferences.ageMax} onChange={(event) => setPreferences({ ...preferences, ageMax: Number(event.target.value) })} /></label>
                  <label className={styles.checkLabel}><input type="checkbox" checked={preferences.onlineOnly} onChange={(event) => setPreferences({ ...preferences, onlineOnly: event.target.checked })} /> 접속 중인 사용자 우선</label>
                  <button type="submit" className={styles.primaryButton} disabled={busy}>계정에 저장</button>
                </form>
              ) : null}
              <div className={styles.partnerGrid}>
                {partnerCards.length ? partnerCards : (
                  <EmptyState
                    icon={UsersRound}
                    title="아직 조건에 맞는 실제 파트너가 없어요"
                    description="두 번째 사용자가 가입해 프로필을 설정하면 이곳에 바로 추천됩니다. 가상 프로필은 표시하지 않습니다."
                    action={<button type="button" className={styles.secondaryButton} onClick={() => setFiltersOpen(true)}>조건 넓히기</button>}
                  />
                )}
              </div>
            </section>
          ) : null}

          {!loading && tab === "community" ? (
            <section className={styles.pageSection}>
              <header className={styles.pageHeader}>
                <div><p className={styles.eyebrow}>COMMUNITY</p><h1>커뮤니티</h1><p>실제 회원이 작성한 글만 최신순으로 표시합니다.</p></div>
                <button type="button" className={styles.primaryButton} onClick={() => setComposeOpen(true)}><PenLine size={17} /> 글쓰기</button>
              </header>
              {composeOpen ? (
                <form className={styles.composeCard} onSubmit={publishPost}>
                  <header><strong>새 게시물</strong><button type="button" onClick={() => setComposeOpen(false)} aria-label="닫기"><X size={18} /></button></header>
                  <textarea value={postDraft} onChange={(event) => setPostDraft(event.target.value)} maxLength={3000} placeholder="오늘 연습한 문장이나 궁금한 표현을 적어보세요." required />
                  <footer><small>{postDraft.length} / 3000 · 서버에 영구 저장</small><button className={styles.primaryButton} type="submit" disabled={busy || !postDraft.trim()}>게시하기</button></footer>
                </form>
              ) : null}
              <div className={styles.feed}>
                {posts.length ? posts.map((post) => (
                  <article key={post.id} className={styles.postCard}>
                    <header>
                      <span className={styles.postAvatar}>{post.author.name.slice(0, 1)}<i>{post.author.flag}</i></span>
                      <div><strong>{post.author.name}</strong><small>{post.author.handle} · {relativeTime(post.createdAt)}</small></div>
                      <span className={styles.languageTag}>{languageLabel(post.language)}</span>
                    </header>
                    <p>{post.text}</p>
                    <div className={styles.tags}>{post.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                    <footer>
                      <button type="button" onClick={() => void togglePostLike(post)}><Heart size={17} /> {post.likes}</button>
                      <span><MessageCircle size={17} /> {post.comments}</span>
                      {post.requestCorrection ? <span><PenLine size={16} /> 교정 요청</span> : null}
                    </footer>
                  </article>
                )) : <EmptyState icon={PenLine} title="첫 게시물을 기다리고 있어요" description="작성한 글은 Firestore에 저장되고 다른 계정에서도 바로 볼 수 있습니다." />}
              </div>
            </section>
          ) : null}

          {!loading && tab === "chats" ? (
            <section className={styles.pageSection}>
              <header className={styles.pageHeader}>
                <div><p className={styles.eyebrow}>MESSAGES</p><h1>대화</h1><p>메시지는 서버에 저장되어 다시 로그인해도 복원됩니다.</p></div>
              </header>
              {conversations.length ? (
                <div className={styles.chatLayout}>
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
                          <Avatar profile={selectedConversation.partner} size="small" />
                          <span><strong>{selectedConversation.partner.name}</strong><small>{selectedConversation.partner.status === "online" ? "접속 중" : "오프라인"}</small></span>
                          <div className={styles.threadActions}>
                            <i><Database size={15} /> 자동 저장</i>
                            <button
                              type="button"
                              className={styles.aiButton}
                              onClick={() => {
                                if (aiPanelOpen) setAiPanelOpen(false);
                                else if (aiSupport) setAiPanelOpen(true);
                                else void requestConversationSupport();
                              }}
                              disabled={!aiConfigured || aiBusy}
                              title={aiConfigured ? "대화 주제와 문장을 추천받기" : "AI 기능이 아직 연결되지 않았습니다"}
                            >
                              <Sparkles size={15} /> AI 도움
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
                                {message.senderId !== user.id && aiConfigured ? (
                                  <button type="button" onClick={() => void translateMessage(message)} disabled={translatingMessageId === message.id}>
                                    <Languages size={12} />
                                    {translatingMessageId === message.id ? "번역 중" : translatedMessages[message.id] ? "원문만" : "번역"}
                                  </button>
                                ) : null}
                              </footer>
                            </div>
                          )) : <p className={styles.threadEmpty}>첫 메시지를 보내 대화를 시작해 보세요.</p>}
                        </div>
                        <div className={styles.composerArea}>
                          {aiPanelOpen ? (
                            <section className={styles.aiPanel} aria-label="AI 대화 도움">
                              <header>
                                <strong><Sparkles size={15} /> AI 대화 도움</strong>
                                <button type="button" onClick={() => setAiPanelOpen(false)} aria-label="AI 도움 닫기"><X size={16} /></button>
                              </header>
                              {aiBusy ? <p className={styles.aiLoading}><RefreshCw size={15} /> 대화 주제를 만드는 중…</p> : null}
                              {!aiBusy && aiSupport ? (
                                <div className={styles.aiContent}>
                                  <p className={styles.aiTip}>{aiSupport.tip}</p>
                                  <div className={styles.aiTopics}>{aiSupport.topics.map((topic) => <span key={topic}>{topic}</span>)}</div>
                                  <div className={styles.aiSuggestions}>
                                    {[...aiSupport.suggestedOpeners, ...aiSupport.followUpQuestions].map((suggestion, index) => (
                                      <button key={index + "-" + suggestion} type="button" onClick={() => setMessageDraft(suggestion)}>{suggestion}</button>
                                    ))}
                                    {aiSupport.improvedDraft && aiSupport.improvedDraft !== messageDraft ? (
                                      <button type="button" onClick={() => setMessageDraft(aiSupport.improvedDraft)}>다듬은 문장: {aiSupport.improvedDraft}</button>
                                    ) : null}
                                  </div>
                                  <small>추천 문장을 누르면 입력창에 넣습니다 · 오늘 {aiSupport.entitlement.usage.remaining}회 남음</small>
                                </div>
                              ) : null}
                            </section>
                          ) : null}
                          <form className={styles.messageForm} onSubmit={sendMessage}>
                            <input value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} maxLength={4000} placeholder="메시지 입력" />
                            <button type="submit" className={styles.primaryButton} disabled={busy || !messageDraft.trim()} aria-label="전송"><Send size={18} /></button>
                          </form>
                        </div>
                      </>
                    ) : null}
                  </article>
                </div>
              ) : <EmptyState icon={MessageCircle} title="아직 대화가 없어요" description="오늘의 파트너에서 실제 사용자에게 대화를 시작하면 이곳에 영구 저장됩니다." action={<button type="button" className={styles.primaryButton} onClick={() => setTab("partners")}>파트너 찾기</button>} />}
            </section>
          ) : null}

          {!loading && tab === "rooms" ? (
            <section className={styles.pageSection}>
              <header className={styles.pageHeader}>
                <div><p className={styles.eyebrow}>VOICE ROOMS</p><h1>보이스룸</h1><p>방 정보와 참여 목록은 실제 서버 데이터로 관리합니다.</p></div>
                <button type="button" className={styles.primaryButton} onClick={() => setRoomFormOpen(true)}><Plus size={17} /> 방 만들기</button>
              </header>
              <div className={styles.voiceNotice}><Radio size={18} /><span><strong>현재 운영 범위</strong><small>방 생성·목록은 실제 저장됩니다. 실시간 음성은 아직 연결되지 않았습니다(WebRTC/SFU 준비 중).</small></span></div>
              {roomFormOpen ? (
                <form className={styles.roomForm} onSubmit={createRoom}>
                  <label>방 제목<input value={roomTitle} onChange={(event) => setRoomTitle(event.target.value)} minLength={2} maxLength={80} required /></label>
                  <label>대화 주제<input value={roomTopic} onChange={(event) => setRoomTopic(event.target.value)} minLength={2} maxLength={160} required /></label>
                  <button className={styles.primaryButton} type="submit" disabled={busy}>서버에 방 만들기</button>
                  <button className={styles.secondaryButton} type="button" onClick={() => setRoomFormOpen(false)}>취소</button>
                </form>
              ) : null}
              <div className={styles.roomGrid}>
                {rooms.length ? rooms.map((room) => (
                  <article key={room.id} className={styles.roomCard}>
                    <span className={styles.roomIcon}><Radio size={22} /></span>
                    <div><small>{languageLabel(room.language)} · {room.level}</small><h3>{room.title}</h3><p>{room.topic}</p><span>{room.hostFlag} {room.host} 호스트 · {room.listeners}명</span></div>
                    <button type="button" className={styles.secondaryButton} disabled>음성 연결 준비 중</button>
                  </article>
                )) : <EmptyState icon={Radio} title="열린 보이스룸이 없어요" description="새 방을 만들면 다른 계정의 목록에도 실제로 표시됩니다." />}
              </div>
            </section>
          ) : null}

          {!loading && tab === "profile" ? (
            <section className={styles.pageSection}>
              <header className={styles.pageHeader}>
                <div><p className={styles.eyebrow}>ACCOUNT</p><h1>내 프로필</h1><p>프로필과 개인정보 설정은 계정 단위로 동기화됩니다.</p></div>
              </header>
              <div className={styles.profileGrid}>
                <article className={styles.profileSummary}>
                  <Avatar profile={user} size="large" />
                  <div><span className={styles.nameLine}><h2>{user.name}</h2>{user.emailVerified ? <BadgeCheck size={18} /> : null}</span><p>{user.handle}</p><small>{user.email}</small></div>
                  <div className={styles.syncBadge}><Database size={16} /> Firestore 동기화</div>
                </article>
                <form className={styles.profileForm} onSubmit={saveProfile}>
                  <header><Settings size={19} /><strong>프로필 설정</strong></header>
                  <label>이름<input value={profileDraft.name} onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })} minLength={2} maxLength={40} required /></label>
                  <label>도시<input value={profileDraft.city} onChange={(event) => setProfileDraft({ ...profileDraft, city: event.target.value })} maxLength={80} placeholder="예: 서울" /></label>
                  <label>소개<textarea value={profileDraft.bio} onChange={(event) => setProfileDraft({ ...profileDraft, bio: event.target.value })} maxLength={500} /></label>
                  <button type="submit" className={styles.primaryButton} disabled={busy}>변경사항 저장</button>
                </form>
                <article className={styles.privacyCard}>
                  <header><ShieldCheck size={19} /><strong>DM 수신 범위</strong></header>
                  <p>서버가 메시지 요청 권한을 판단할 때 사용하는 실제 설정입니다.</p>
                  <div className={styles.scopeButtons}>
                    {[
                      ["matches", "추천·매칭된 사용자"],
                      ["mutual-follows", "서로 팔로우"],
                      ["everyone", "모든 사용자"],
                    ].map(([value, label]) => (
                      <button key={value} type="button" className={privacy?.whoCanMessage === value ? styles.active : ""} onClick={() => void savePrivacy(value)}>{label}</button>
                    ))}
                  </div>
                </article>
                <article className={styles.accountCard}>
                  <header><LockKeyhole size={19} /><strong>계정 및 세션</strong></header>
                  <p>{user.emailVerified ? "이메일 인증 완료" : "이메일 인증 대기 중"} · 세션은 보안 쿠키로 관리됩니다.</p>
                  <button type="button" className={styles.dangerButton} onClick={() => void signOut()}><LogOut size={17} /> 로그아웃</button>
                </article>
              </div>
            </section>
          ) : null}
        </main>
      </div>

      <nav className={styles.mobileNav}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return <button key={item.id} type="button" className={tab === item.id ? styles.active : ""} onClick={() => setTab(item.id)}><Icon size={20} /><span>{item.mobileLabel}</span></button>;
        })}
      </nav>
      {toast ? <div className={styles.toast}>{toast}</div> : null}
    </div>
  );
}

export default function ProductionLingoLoopApp() {
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
