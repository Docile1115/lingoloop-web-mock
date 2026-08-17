"use client";

import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowUp,
  BadgeCheck,
  Ban,
  Hash,
  Bell,
  BellOff,
  BookOpenCheck,
  Bookmark,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Compass,
  Ellipsis,
  Eye,
  EyeOff,
  Flame,
  Flag,
  Globe2,
  Hand,
  Heart,
  Image as ImageIcon,
  Languages,
  Link as LinkIcon,
  LogOut,
  Lightbulb,
  LockKeyhole,
  Maximize2,
  MessageCircle,
  Mic,
  MicOff,
  Minimize2,
  Monitor,
  MoreHorizontal,
  Paperclip,
  PenLine,
  Phone,
  Play,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Star,
  Timer,
  Target,
  Trophy,
  Users,
  User,
  UsersRound,
  Video,
  Volume2,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  currentUser,
  initialConversations,
  initialPosts,
  myPosts,
  followingAuthors,
  postReplies,
  receivedLikes,
  partners,
  initialRoomMessages,
  rooms,
  savedPhrases,
  type Accent,
  type Conversation,
  type FeedPost,
  type Partner,
  type PostReply,
  type PracticeRoom,
  type RoomMessage,
} from "@/app/lib/demo-data";
import { I18nProvider, localizeClock, LOCALES, LOCALE_LABEL, msg, t, tx, useLocale, type MessageKey } from "@/app/lib/i18n";
import { canSubmit, checkText, LIMITS, readStoredJson } from "@/app/lib/validation";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type Section = "discover" | "community" | "chats" | "practice" | "learn";
type ApiState = "checking" | "ready" | "fallback";

type MatchAvailability = "weekday-morning" | "weekday-evening" | "weekend-morning" | "weekend-evening";
type PartnerLevel = "any" | "beginner" | "intermediate" | "advanced";

type MatchPreferences = {
  targetLanguages: string[];
  preferredCountries: string[];
  interests: string[];
  availability: MatchAvailability[];
  partnerLevel: PartnerLevel;
  onlineOnly: boolean;
};

type ConversationSupport = {
  partner?: { id?: string; name?: string };
  stage: string;
  topics: string[];
  suggestedOpeners: string[];
  followUpQuestions: string[];
  improvedDraft?: string;
  translation?: { language: string; text: string };
  tip: string;
};

type DailyMatchRecommendation = {
  partner: Partner;
  score: number;
  matchReasons: string[];
  icebreaker: string;
};

type MatchingApiPartner = {
  id: string;
  name: string;
  handle: string;
  country: { code: string; name: string; flag: string };
  nativeLanguages: string[];
  learningLanguages: Array<{ code: string; level: string; goal: string }>;
  bio: string;
  interests: string[];
  status: string;
  verified?: boolean;
  responseRate?: number;
};

/** 탭 위에 얹히는 상세 화면. 모달이 아니라 화면 이동입니다. */
type DetailRoute =
  | { kind: "post"; post: FeedPost }
  | { kind: "profile"; partner: Partner }
  | { kind: "profile-edit" }
  | { kind: "blocked" }
  | null;

/** 프로필 편집에서 고칠 수 있는 값. mock 이라 이 브라우저에만 남습니다. */
type ProfileDraft = {
  name: string;
  bio: string;
  goal: string;
  visibility: "public" | "partners";
};

type ModalState =
  | { type: "new-chat" }
  | { type: "profile"; partner: Partner }
  | { type: "filters" }
  | { type: "compose" }
  | { type: "search" }
  | { type: "room"; room: PracticeRoom }
  | { type: "create-room" }
  | { type: "exchange" }
  | { type: "partner-list" }
  | { type: "likes" }
  | { type: "report"; target: string }
  | { type: "onboarding" }
  | null;

const defaultMatchPreferences: MatchPreferences = {
  targetLanguages: ["en"],
  preferredCountries: ["CA", "US"],
  interests: ["travel", "movies", "coffee"],
  availability: ["weekday-evening", "weekend-morning"],
  partnerLevel: "intermediate",
  onlineOnly: false,
};

/* 라벨 표는 화면 밖에서 만들어지므로 문구를 msg() 로 표시해 두고, 읽는 쪽에서 t() 로 번역합니다. */
const languageLabels: Record<string, MessageKey> = { en: msg("영어"), es: msg("스페인어"), ja: msg("일본어") };
const countryLabels: Record<string, MessageKey> = { CA: msg("캐나다"), US: msg("미국"), GB: msg("영국"), AU: msg("호주"), ES: msg("스페인"), JP: msg("일본") };
const interestLabels: Record<string, MessageKey> = { movies: msg("영화"), travel: msg("여행"), coffee: msg("카페"), music: msg("음악"), technology: msg("기술"), cooking: msg("요리"), books: msg("독서"), running: msg("운동") };

/** 코드를 현재 언어의 라벨로. 모르는 코드는 원래 값을 그대로 보여줍니다. */
const labelOf = (table: Record<string, MessageKey>, code: string): string =>
  table[code] ? t(table[code]) : code;

function normalizeMatchPreferences(preferences: MatchPreferences): MatchPreferences {
  const languageAliases: Record<string, string> = { 영어: "en", 스페인어: "es", 일본어: "ja" };
  const countryAliases: Record<string, string> = { 캐나다: "CA", 미국: "US", 영국: "GB", 호주: "AU", 스페인: "ES", 일본: "JP" };
  const interestAliases: Record<string, string> = { 영화: "movies", 여행: "travel", 카페: "coffee", 음악: "music", 기술: "technology", 요리: "cooking", 독서: "books", 운동: "running" };
  return {
    ...preferences,
    targetLanguages: preferences.targetLanguages.map((item) => languageAliases[item] ?? item),
    preferredCountries: preferences.preferredCountries.map((item) => countryAliases[item] ?? item),
    interests: preferences.interests.map((item) => interestAliases[item] ?? item),
  };
}

const availabilityLabels: Record<MatchAvailability, MessageKey> = {
  "weekday-morning": msg("평일 아침"),
  "weekday-evening": msg("평일 저녁"),
  "weekend-morning": msg("주말 오전"),
  "weekend-evening": msg("주말 저녁"),
};

const levelLabels: Record<PartnerLevel, MessageKey> = {
  any: msg("레벨 무관"),
  beginner: msg("초급"),
  intermediate: msg("중급"),
  advanced: msg("고급"),
};

const dailyMatchDetails: Record<string, { reasons: MessageKey[]; icebreaker: string }> = {
  maya: {
    reasons: [msg("영어 원어민"), msg("평일 저녁 활동"), msg("영화·카페 관심사")],
    icebreaker: "Hi Maya! What is the best movie you watched at a café lately?",
  },
  omar: {
    reasons: [msg("영어 원어민"), msg("짧은 음성 연습"), msg("기술 관심사")],
    icebreaker: "Hi Omar! What kind of game are you working on these days?",
  },
  lucas: {
    reasons: [msg("여행 목표 일치"), msg("한국어 B1"), msg("저녁 활동")],
    icebreaker: "Hi Lucas! Which Korean city is at the top of your travel list?",
  },
  aiko: {
    reasons: [msg("학습 리듬 일치"), msg("디자인 관심사"), msg("꼼꼼한 교정")],
    icebreaker: "Hi Aiko! What design detail inspired you this week?",
  },
  clara: {
    reasons: [msg("주말 활동"), msg("문장 교정 선호"), msg("문화 관심사")],
    icebreaker: "Hi Clara! Which museum would you recommend to a first-time visitor?",
  },
};

function fallbackConversationSupport(name: string): ConversationSupport {
  return {
    stage: "ongoing",
    topics: [t("이번 주 가장 좋았던 순간"), t("서로의 도시에서 꼭 해볼 일"), t("최근 새로 배운 표현")],
    suggestedOpeners: [`Hi ${name}! What was the highlight of your week?`],
    followUpQuestions: ["What made it memorable?", "How would you say that in Korean?", "Would you recommend it to a friend?"],
    tip: t("한 번에 질문 하나만 보내고, 상대 답변의 단어를 이어서 물으면 대화가 자연스러워져요."),
  };
}

function displayPartnerFromApi(partner: MatchingApiPartner, score: number, index: number): Partner {
  const localId = partner.id.replace(/^user-/, "");
  const existing = partners.find((item) => item.id === localId || item.name === partner.name);
  if (existing) {
    return {
      ...existing,
      flag: partner.country.flag,
      city: partner.country.name,
      country: partner.country.name,
      timeOffset: 0,
      compatibility: score,
    };
  }

  const accents: Accent[] = ["violet", "coral", "mint", "amber", "blue", "rose"];
  const learning = partner.learningLanguages[0];
  const languageNames: Record<string, MessageKey> = { ...languageLabels, ko: msg("한국어"), fr: msg("프랑스어"), de: msg("독일어") };
  const levelNames: Record<string, string> = { beginner: "A1–A2", intermediate: "B1–B2", advanced: "C1+" };

  return {
    id: localId,
    name: partner.name,
    handle: partner.handle,
    flag: partner.country.flag,
    city: partner.country.name,
    country: partner.country.name,
    timeOffset: 0,
    native: partner.nativeLanguages.map((code) => (languageNames[code] ? t(languageNames[code]) : code.toUpperCase())).join(" · "),
    learning: labelOf(languageNames, learning?.code ?? "ko"),
    level: levelNames[learning?.level ?? "intermediate"] ?? learning?.level ?? "B1",
    interests: partner.interests.slice(0, 3).map((item) => labelOf(interestLabels, item)),
    bio: partner.bio,
    online: partner.status === "online",
    compatibility: score,
    accent: accents[index % accents.length],
    goal: learning?.goal ?? t("부담 없는 일상 대화"),
    activeTime: t("내가 선택한 시간대와 겹쳐요"),
    balance: t("응답률 {value}%", { value: partner.responseRate ?? 90 }),
    verified: partner.verified,
  };
}

function fallbackDailyRecommendations(): DailyMatchRecommendation[] {
  return partners.slice(0, MAX_DAILY_PARTNERS).map((partner) => ({
    partner,
    score: partner.compatibility,
    matchReasons: dailyMatchDetails[partner.id]?.reasons ?? [msg("학습 목표 일치"), msg("비슷한 활동 시간")],
    icebreaker: dailyMatchDetails[partner.id]?.icebreaker ?? `Hi ${partner.name}! What would you like to practice today?`,
  }));
}

const navItems: Array<{
  id: Section;
  label: MessageKey;
  shortLabel: MessageKey;
  icon: LucideIcon;
  description: MessageKey;
}> = [
  { id: "discover", label: msg("파트너"), shortLabel: msg("파트너"), icon: Compass, description: msg("나와 잘 맞는 언어 파트너를 찾아보세요") },
  { id: "community", label: msg("커뮤니티"), shortLabel: msg("피드"), icon: UsersRound, description: msg("짧은 글과 교정을 빠르게 확인하세요") },
  { id: "chats", label: msg("대화"), shortLabel: msg("대화"), icon: MessageCircle, description: msg("대화 속에서 바로 배우고 복습하세요") },
  { id: "practice", label: msg("보이스룸"), shortLabel: msg("연습"), icon: Radio, description: msg("보이스룸을 만들거나 바로 참여하세요") },
  { id: "learn", label: msg("프로필"), shortLabel: msg("프로필"), icon: User, description: msg("내 글과 학습 기록을 확인하세요") },
];

/** 하루에 제시하는 파트너 최대 인원. */
const MAX_DAILY_PARTNERS = 10;

/**
 * 현지 시각은 마운트 이후에만 계산합니다.
 * 서버와 클라이언트의 시각이 달라 하이드레이션이 깨지기 때문입니다.
 */
function useLocalTime(offsetHours: number): string {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(localTimeOf(offsetHours));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [offsetHours]);
  return time;
}

/** 나(한국) 기준 시차를 적용한 상대 현지 시각. */
function localTimeOf(offsetHours: number): string {
  const now = new Date();
  const there = new Date(now.getTime() + offsetHours * 3600 * 1000);
  const h = there.getHours();
  const m = `${there.getMinutes()}`.padStart(2, "0");
  const ampm = h < 12 ? t("오전") : t("오후");
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${hour12}:${m}`;
}

const accentStyle = (accent: Accent): CSSProperties => ({
  "--avatar-accent": `var(--accent-${accent})`,
} as CSSProperties);

function Avatar({
  name,
  flag,
  accent = "violet",
  size = "md",
  online,
}: {
  name: string;
  flag?: string;
  accent?: Accent;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  online?: boolean;
}) {
  return (
    <span className={`avatar avatar-${size}`} style={accentStyle(accent)} role="img" aria-label={name}>
      <span className="avatar-initials">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8.6" r="3.8" />
          <path d="M12 13.6c-4.2 0-7.6 2.7-7.6 6 0 .6.5 1.1 1.1 1.1h13c.6 0 1.1-.5 1.1-1.1 0-3.3-3.4-6-7.6-6Z" />
        </svg>
      </span>
      {flag ? <span className="avatar-flag">{flag}</span> : null}
      {online ? <span className="avatar-online" /> : null}
    </span>
  );
}

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function IconButton({
  label,
  icon: Icon,
  onClick,
  badge,
  className = "",
}: {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  badge?: number | string;
  className?: string;
}) {
  return (
    <button className={`icon-button ${className}`} type="button" aria-label={label} title={label} onClick={onClick}>
      <Icon size={19} strokeWidth={2} />
      {badge ? <span className="icon-badge">{badge}</span> : null}
    </button>
  );
}

function LingoLoopScreens() {
  const [section, setSection] = useState<Section>("discover");
  const [modal, setModal] = useState<ModalState>(null);
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts);
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [selectedChatId, setSelectedChatId] = useState(initialConversations[0].id);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [feedTab, setFeedTab] = useState<"recommended" | "learning" | "following">("recommended");
  const [translatedPosts, setTranslatedPosts] = useState<Set<string>>(new Set());
  const [openCorrections, setOpenCorrections] = useState<Set<string>>(new Set(["post-1"]));
  const [toast, setToast] = useState<string | null>(null);
  const [apiState, setApiState] = useState<ApiState>("checking");
  const [roomHandRaised, setRoomHandRaised] = useState(false);
  const [roomMicOn, setRoomMicOn] = useState(false);
  const [minimizedRoom, setMinimizedRoom] = useState<PracticeRoom | null>(null);
  const [roomMessages, setRoomMessages] = useState<RoomMessage[]>(initialRoomMessages);
  const [exchangeLength, setExchangeLength] = useState(15);
  const [settings, setSettings] = useState({ dmRequests: true, hideLocation: true, correctionAlerts: true });
  const [matchPreferences, setMatchPreferences] = useState<MatchPreferences>(defaultMatchPreferences);
  const [dailyRecommendations, setDailyRecommendations] = useState<DailyMatchRecommendation[]>(fallbackDailyRecommendations);
  const [detail, setDetail] = useState<DetailRoute>(null);
  const [partnerIndex, setPartnerIndex] = useState(0);
  const [signaledPartners, setSignaledPartners] = useState<string[]>([]);
  const [practiceRooms, setPracticeRooms] = useState<PracticeRoom[]>(rooms);
  /* 아래 상태들은 "토스트만 뜨고 끝나던" 동작을 실제로 반영하기 위한 것입니다.
     mock 이지만 화면에는 진짜로 남아야 눌러본 사람이 결과를 확인할 수 있습니다. */
  const [savedPhraseIds, setSavedPhraseIds] = useState<Set<string>>(new Set());
  const [savedPartnerIds, setSavedPartnerIds] = useState<Set<string>>(new Set());
  const [hiddenAuthorIds, setHiddenAuthorIds] = useState<Set<string>>(new Set());
  const [blockedAuthorIds, setBlockedAuthorIds] = useState<Set<string>>(new Set());
  const [mutedChatIds, setMutedChatIds] = useState<Set<string>>(new Set());
  const [mutedRoomIds, setMutedRoomIds] = useState<Set<string>>(new Set());
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileDraft>({
    name: currentUser.name,
    bio: currentUser.bio,
    goal: t("부담 없는 일상 대화"),
    visibility: "public",
  });
  const [replySort, setReplySort] = useState<"popular" | "recent">("popular");
  const toastTimer = useRef<number | null>(null);

  const selectedConversation = conversations.find((item) => item.id === selectedChatId) ?? conversations[0];

  /** 눌린 항목을 집합에 넣거나 뺍니다. 되돌릴 수 있어야 실수해도 안전합니다. */
  const toggleIn = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
    onAdd: string,
    onRemove: string,
  ) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      showToast(next.has(id) ? onAdd : onRemove);
      return next;
    });
  };

  /** 링크 복사 — 클립보드가 막힌 환경에서도 조용히 실패하지 않게 결과를 알려줍니다. */
  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast(t("링크를 복사했어요"));
    } catch {
      showToast(t("링크를 복사하지 못했어요 · 브라우저가 막았어요") as string);
    }
  };

  /** 복습함 저장 — 다시 누르면 빠집니다. 프로필의 "저장한 표현" 수에 바로 반영됩니다. */
  const savePhrase = (postId: string) =>
    toggleIn(setSavedPhraseIds, postId, t("복습함에 저장했어요"), t("복습함에서 뺐어요"));

  /** 숨기기는 되돌릴 수 있어야 합니다 — 프로필 설정의 목록에서 다시 풀 수 있습니다. */
  const hideAuthor = (authorId: string, name: string) =>
    toggleIn(
      setHiddenAuthorIds,
      authorId,
      t("{author}님의 글을 숨겼어요", { author: name }),
      t("{author}님의 글을 다시 봅니다", { author: name }),
    );

  /** 관심 파트너 저장 — 다시 누르면 빠집니다. */
  const savePartner = (id: string, name: string) =>
    toggleIn(
      setSavedPartnerIds,
      id,
      t("{name}님을 관심 파트너로 저장했어요", { name }),
      t("{name}님을 관심 목록에서 뺐어요", { name }),
    );

  /** 대화방을 실제로 목록에서 뺍니다. 나간 방을 고르고 있었다면 남은 첫 방으로 옮깁니다. */
  const leaveChat = (id: string, name: string, block = false) => {
    setConversations((current) => {
      const next = current.filter((item) => item.id !== id);
      setSelectedChatId((chosen) => (chosen === id ? next[0]?.id ?? "" : chosen));
      return next;
    });
    setMobileThreadOpen(false);
    showToast(block ? t("{name}님을 차단하고 대화방에서 나갔어요", { name }) : t("{name}님과의 대화방에서 나갔어요", { name }));
  };

  /** 차단하면 그 사람 글이 피드에서 사라져야 "차단됐다"는 게 보입니다. */
  const blockAuthor = (authorId: string, name: string) => {
    setBlockedAuthorIds((current) => new Set(current).add(authorId));
    setDetail(null);
    showToast(t("{author}님을 차단했어요", { author: name }));
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/health"),
      fetch("/api/bootstrap"),
      fetch("/api/partners"),
      fetch("/api/posts"),
      fetch("/api/conversations"),
      fetch("/api/matching/preferences"),
      fetch("/api/matching/daily"),
    ])
      .then((responses) => {
        if (!cancelled) setApiState(responses.every((response) => response.ok) ? "ready" : "fallback");
      })
      .catch(() => {
        if (!cancelled) setApiState("fallback");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({
      targetLanguages: matchPreferences.targetLanguages.join(","),
      preferredCountries: matchPreferences.preferredCountries.join(","),
      interests: matchPreferences.interests.join(","),
      availability: matchPreferences.availability.join(","),
      partnerLevel: matchPreferences.partnerLevel,
      onlineOnly: String(matchPreferences.onlineOnly),
    });

    fetch(`/api/matching/daily?${query.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Mock API returned ${response.status}`);
        return response.json() as Promise<{ data?: { recommendations?: Array<{ partner: MatchingApiPartner; score: number; matchReasons: string[]; icebreaker: string }> } }>;
      })
      .then((body) => {
        if (cancelled || !body.data?.recommendations?.length) return;
        setDailyRecommendations(body.data.recommendations.slice(0, MAX_DAILY_PARTNERS).map((item, index) => ({
          partner: displayPartnerFromApi(item.partner, item.score, index),
          score: item.score,
          matchReasons: item.matchReasons,
          icebreaker: item.icebreaker,
        })));
      })
      .catch(() => {
        // Keep the deterministic local fallback when the mock API is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [matchPreferences]);

  // 매칭 조건이 바뀌면 큐를 처음부터 다시 봅니다.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPartnerIndex(0));
    return () => window.cancelAnimationFrame(frame);
  }, [matchPreferences]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        // 사용자가 직접 고칠 수 있는 값이라 모양을 확인하고 씁니다.
        const parsed = readStoredJson<Partial<MatchPreferences>>(
          "lingoloop-match-preferences",
          (value): value is Partial<MatchPreferences> =>
            typeof value === "object" && value !== null && !Array.isArray(value),
        );
        if (!parsed) return;
        setMatchPreferences(normalizeMatchPreferences({ ...defaultMatchPreferences, ...parsed }));
      } catch {
        // Device-local preferences are optional in this mock.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // 새로고침·뒤로가기에서 현재 탭을 유지합니다. SSR 이후에 읽어 하이드레이션 불일치를 피합니다.
  useEffect(() => {
    const fromHash = (): Section | null => {
      const id = window.location.hash.replace("#", "");
      return navItems.some((item) => item.id === id) ? (id as Section) : null;
    };
    const frame = window.requestAnimationFrame(() => {
      const initial = fromHash();
      if (initial) setSection(initial);
    });
    const onHashChange = () => {
      const raw = window.location.hash.replace("#", "");
      const [sectionId] = raw.split("/");
      if (navItems.some((item) => item.id === sectionId)) setSection(sectionId as Section);
      // 상세 경로가 사라지면 목록으로 돌아옵니다 (뒤로가기)
      if (!raw.includes("/")) setDetail(null);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  };

  const saveMatchPreferences = async (preferences: MatchPreferences) => {
    const normalized = normalizeMatchPreferences(preferences);
    setMatchPreferences(normalized);
    try {
      window.localStorage.setItem("lingoloop-match-preferences", JSON.stringify(normalized));
    } catch {
      // Continue with in-memory state if browser storage is unavailable.
    }

    try {
      const response = await fetch("/api/matching/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(normalized),
      });
      if (!response.ok) throw new Error(`Mock API returned ${response.status}`);
      showToast(t("매칭 설정을 저장했어요 · 오늘의 파트너에 바로 반영돼요"));
    } catch {
      showToast(t("매칭 설정을 이 기기에 저장했어요 · 오프라인 데모"));
    }
  };

  const skipPartner = () => {
    setPartnerIndex((current) => current + 1);
    showToast(t("다음 사람을 보여드릴게요"));
  };

  const signalPartner = (partner: Partner) => {
    setSignaledPartners((current) => (current.includes(partner.id) ? current : [...current, partner.id]));
    setPartnerIndex((current) => current + 1);
    showToast(t("{name}님에게 마음을 보냈어요", { name: partner.name }));
  };

  const restartPartners = () => {
    setPartnerIndex(0);
    showToast(t("처음부터 다시 볼게요"));
  };

  const openPost = (post: FeedPost) => {
    setDetail({ kind: "post", post });
    window.history.pushState(null, "", `#${section}/post/${post.id}`);
  };

  const openProfile = (partner: Partner) => {
    setDetail({ kind: "profile", partner });
    window.history.pushState(null, "", `#${section}/user/${partner.id}`);
  };

  const closeDetail = () => {
    setDetail(null);
    window.history.replaceState(null, "", `#${section}`);
  };

  const goToSection = (next: Section) => {
    setDetail(null);
    setSection(next);
    if (next === "chats") setMobileThreadOpen(false);
    window.history.replaceState(null, "", `#${next}`);
  };

  const togglePost = (postId: string, key: "liked" | "saved") => {
    setPosts((items) =>
      items.map((post) => {
        if (post.id !== postId) return post;
        if (key === "liked") {
          const nextLiked = !post.liked;
          return { ...post, liked: nextLiked, likes: post.likes + (nextLiked ? 1 : -1) };
        }
        return { ...post, saved: !post.saved };
      }),
    );
    showToast(key === "liked" ? t("좋아요를 눌렀어요") : t("복습함에 저장했어요"));
  };

  const toggleSetValue = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startChat = (partner: Partner) => {
    const existing = conversations.find((item) => item.partnerId === partner.id);
    if (existing) {
      setSelectedChatId(existing.id);
    } else {
      const next: Conversation = {
        id: `chat-${partner.id}`,
        partnerId: partner.id,
        name: partner.name,
        flag: partner.flag,
        accent: partner.accent,
        preview: t("새로운 연습 제안을 보내보세요"),
        time: t("지금"),
        unread: 0,
        online: partner.online,
        messages: [
          {
            id: `welcome-${partner.id}`,
            mine: false,
            system: true,
            text: t("{name}님과 언어 교환을 시작했어요. 친절하고 안전한 대화를 만들어주세요.", { name: partner.name }),
            time: t("지금"),
          },
        ],
      };
      setConversations((items) => [next, ...items]);
      setSelectedChatId(next.id);
      setDraft(dailyRecommendations.find((item) => item.partner.id === partner.id)?.icebreaker ?? dailyMatchDetails[partner.id]?.icebreaker ?? `Hi ${partner.name}! Nice to meet you.`);
    }
    setSection("chats");
    setMobileThreadOpen(true);
    setModal(null);
    showToast(t("{name}님과 대화를 열었어요", { name: partner.name }));
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const checked = checkText(draft, "message");
    if (!checked.ok) { if (checked.error) showToast(checked.error); return; }
    const text = checked.value;
    if (!selectedConversation) return;

    const newMessage = { id: `local-${Date.now()}`, mine: true, text, time: t("지금") };
    setConversations((items) =>
      items.map((conversation) =>
        conversation.id === selectedConversation.id
          ? { ...conversation, preview: text, time: t("지금"), messages: [...conversation.messages, newMessage] }
          : conversation,
      ),
    );
    setDraft("");

    try {
      const apiConversationId = {
        "chat-maya": "conversation-maya",
        "chat-lucas": "conversation-sofia",
        "chat-aiko": "conversation-ren",
        "chat-group": "conversation-sofia",
      }[selectedConversation.id] ?? "conversation-maya";
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: apiConversationId, text, type: "text" }),
      });
      if (!response.ok) throw new Error(`Mock API returned ${response.status}`);
      showToast(t("메시지를 보냈어요 · mock API 동기화 완료"));
    } catch {
      showToast(t("메시지를 기기에 저장했어요 · 오프라인 데모"));
    }
  };

  const publishPost = (text: string) => {
    const post: FeedPost = {
      id: `post-${Date.now()}`,
      authorId: "me",
      author: currentUser.name,
      handle: currentUser.handle,
      flag: currentUser.flag,
      accent: currentUser.accent,
      time: t("방금"),
      language: t("영어"),
      level: currentUser.level,
      text,
      translation: t("이 게시물은 데모 번역을 요청하면 한국어로 표시됩니다."),
      tags: [t("#오늘의연습"), t("#영어")],
      likes: 0,
      comments: 0,
      corrections: 0,
    };
    setPosts((items) => [post, ...items]);
    setModal(null);
    setSection("community");
    showToast(t("커뮤니티에 게시했어요"));
  };

  const createVoiceRoom = (details: { title: string; topic: string; language: string; level: string }) => {
    const room: PracticeRoom = {
      id: `room-${Date.now()}`,
      title: details.title,
      topic: details.topic,
      language: details.language,
      level: details.level,
      host: currentUser.name,
      hostFlag: currentUser.flag,
      listeners: 1,
      speakers: [currentUser.name],
      audience: [],
      accent: "violet",
    };
    setPracticeRooms((items) => [room, ...items]);
    setModal(null);
    setSection("practice");
    showToast(t("보이스룸을 만들었어요 · mock room"));
  };

  const reportTarget = async (target: string) => {
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType: "user",
          targetId: `demo-${target.toLowerCase().replace(/\s+/g, "-")}`,
          reason: "other",
          details: t("UI 프로토타입에서 제출한 데모 신고입니다."),
        }),
      });
      if (!response.ok) throw new Error(`Mock API returned ${response.status}`);
    } catch {
      showToast(t("신고를 기기에 임시 저장했어요 · 오프라인 데모"));
      setModal(null);
      return;
    }
    setModal(null);
    showToast(t("신고가 접수되었어요 · 상대에게 알리지 않아요"));
  };

  return (
    <div className={`app-root section-${section}`}>
      <a className="skip-link" href="#main-content">{t("본문으로 건너뛰기")}</a>
      <aside className="desktop-sidebar" aria-label={t("주요 메뉴")}>
        <button className="brand" type="button" onClick={() => goToSection("discover")} aria-label={t("LingoLoop 홈")}>
          <span className="brand-mark"><Languages size={22} strokeWidth={2.4} /></span>
          <span className="brand-wordmark">Lingo<span>Loop</span></span>
        </button>

        <nav className="side-nav">
          {/* 그룹 1 — 탐색 */}
          <div className="nav-group">
            {navItems.filter((item) => item.id !== "learn").map((item) => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={section === item.id ? "active" : ""}
                  onClick={() => goToSection(item.id)}
                  aria-current={section === item.id ? "page" : undefined}
                >
                  <Icon size={20} />
                  <span>{t(item.label)}</span>
                  {item.id === "chats" ? <span className="nav-count">7</span> : null}
                </button>
              );
            })}
          </div>

          {/* 그룹 2 — 액션 */}
          <div className="nav-group">
            <button type="button" onClick={() => setModal({ type: "compose" })}>
              <PenLine size={20} />
              <span>{t("글쓰기")}</span>
            </button>
            <button type="button" onClick={() => setModal({ type: "search" })}>
              <Search size={20} />
              <span>{t("검색")}</span>
            </button>
          </div>

          {/* 그룹 3 — 내 정보 */}
          <div className="nav-group">
            {navItems.filter((item) => item.id === "learn").map((item) => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={section === item.id ? "active" : ""}
                  onClick={() => goToSection(item.id)}
                  aria-current={section === item.id ? "page" : undefined}
                >
                  <Icon size={20} />
                  <span>{t(item.label)}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="sidebar-spacer" />
        <span className={`api-indicator api-${apiState}`} title={t("mock API 상태")}>
          <span />{apiState === "ready" ? t("Mock API 연결됨") : apiState === "checking" ? t("연결 확인 중") : t("오프라인 데모")}
        </span>
        <button className="sidebar-profile" type="button" onClick={() => goToSection("learn")}>
          <Avatar name={currentUser.name} flag={currentUser.flag} accent="violet" size="sm" online />
          <span><strong>{currentUser.name}</strong><small>{tx(currentUser.native)} → {tx(currentUser.learning)}</small></span>
          <MoreHorizontal size={18} />
        </button>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button className="mobile-brand" type="button" onClick={() => goToSection("discover")} aria-label={t("LingoLoop 홈")}>
            <span className="brand-mark"><Languages size={20} /></span>
            <span className="brand-wordmark">Lingo<span>Loop</span></span>
          </button>
          <div className="topbar-actions">
            <IconButton label={t("검색")} icon={Search} onClick={() => setModal({ type: "search" })} />
            <IconButton label={t("글쓰기")} icon={PenLine} onClick={() => setModal({ type: "compose" })} />
          </div>
        </header>

        <div className="workspace-grid">
          <main id="main-content" className="main-content">
            {detail?.kind === "post" ? (
              <PostDetailView
                post={detail.post}
                onBack={closeDetail}
                onProfile={(authorId) => {
                  const partner = partners.find((item) => item.id === authorId || item.handle === `@${authorId}`);
                  if (partner) openProfile(partner);
                  else showToast(t("이 작성자의 프로필은 아직 준비 중이에요"));
                }}
                onReport={() => setModal({ type: "report", target: detail.post.author })}
                onToast={showToast}
                saved={savedPhraseIds.has(detail.post.id)}
                onSavePhrase={savePhrase}
                onHideAuthor={hideAuthor}
                onBlockAuthor={blockAuthor}
                onCopyLink={copyLink}
                onTagSelect={(tag) => { setActiveTag(tag); closeDetail(); setSection("community"); }}
                sort={replySort}
                onSortChange={setReplySort}
              />
            ) : null}

            {detail?.kind === "profile-edit" ? (
              <ProfileEditView
                value={profile}
                onBack={closeDetail}
                onSave={(next) => { setProfile(next); closeDetail(); showToast(t("프로필을 저장했어요")); }}
              />
            ) : null}

            {detail?.kind === "blocked" ? (
              <BlockedListView
                hidden={[...hiddenAuthorIds]}
                blocked={[...blockedAuthorIds]}
                onBack={closeDetail}
                onUnhide={(id) => { setHiddenAuthorIds((c) => { const n = new Set(c); n.delete(id); return n; }); showToast(t("다시 보기로 바꿨어요")); }}
                onUnblock={(id) => { setBlockedAuthorIds((c) => { const n = new Set(c); n.delete(id); return n; }); showToast(t("차단을 해제했어요")); }}
              />
            ) : null}

            {detail?.kind === "profile" ? (
              <ProfileDetailView
                partner={detail.partner}
                onBack={closeDetail}
                onStartChat={(partner) => { closeDetail(); startChat(partner); }}
                onReport={() => setModal({ type: "report", target: detail.partner.name })}
                saved={savedPartnerIds.has(detail.partner.id)}
                onSavePartner={savePartner}
              />
            ) : null}

            {!detail && section === "discover" ? (
              <DiscoverView
                preferences={matchPreferences}
                dailyRecommendations={dailyRecommendations}
                index={partnerIndex}
                signaledCount={signaledPartners.length}
                onSkip={skipPartner}
                onSignal={signalPartner}
                onRestart={restartPartners}
                onOpenList={() => setModal({ type: "partner-list" })}
                onOpenLikes={() => setModal({ type: "likes" })}
                receivedCount={receivedLikes.length}
                onProfile={openProfile}
                onFilters={() => setModal({ type: "filters" })}
              />
            ) : null}
            {!detail && section === "community" ? (
              <CommunityView
                posts={posts}
                tab={feedTab}
                setTab={setFeedTab}
                translated={translatedPosts}
                corrections={openCorrections}
                onTranslate={(id) => toggleSetValue(setTranslatedPosts, id)}
                onCorrection={(id) => toggleSetValue(setOpenCorrections, id)}
                onToggle={togglePost}
                onProfile={(id) => {
                  const partner = partners.find((item) => item.id === id);
                  if (partner) openProfile(partner);
                }}
                onReport={(target) => setModal({ type: "report", target })}
                onOpen={openPost}
                onToast={showToast}
                hiddenAuthorIds={hiddenAuthorIds}
                blockedAuthorIds={blockedAuthorIds}
                onHideAuthor={hideAuthor}
                onBlockAuthor={blockAuthor}
                activeTag={activeTag}
                onTagSelect={setActiveTag}
                savedPhraseIds={savedPhraseIds}
                onSavePhrase={savePhrase}
                onCopyLink={copyLink}
              />
            ) : null}
            {!detail && section === "chats" ? (
              <ChatsView
                conversations={conversations}
                selected={selectedConversation}
                mobileThreadOpen={mobileThreadOpen}
                onSelect={(id) => {
                  setSelectedChatId(id);
                  setMobileThreadOpen(true);
                }}
                onBack={() => setMobileThreadOpen(false)}
                draft={draft}
                setDraft={setDraft}
                onSend={sendMessage}
                onExchange={() => setModal({ type: "exchange" })}
                onProfile={() => {
                  const partner = partners.find((item) => item.id === selectedConversation?.partnerId);
                  if (partner) openProfile(partner);
                  else showToast(t("그룹 정보 패널을 열었어요"));
                }}
                onReport={() => setModal({ type: "report", target: selectedConversation?.name ?? t("대화") })}
                onToast={showToast}
                mutedChatIds={mutedChatIds}
                onToggleMute={(id, name) =>
                  toggleIn(setMutedChatIds, id, t("{name}님과의 알림을 껐어요", { name }), t("{name}님과의 알림을 켰어요", { name }))
                }
                onLeaveChat={leaveChat}
                onBlockPartner={(id, name) => leaveChat(id, name, true)}
                onNewChat={() => setModal({ type: "new-chat" })}
              />
            ) : null}
            {!detail && section === "practice" ? (
              <PracticeView
                rooms={practiceRooms}
                onJoin={(room) => {
                  setRoomHandRaised(false);
                  setRoomMicOn(false);
                  setMinimizedRoom(null);
                  setRoomMessages(initialRoomMessages);
                  setModal({ type: "room", room });
                }}
                onCreate={() => setModal({ type: "create-room" })}
              />
            ) : null}
            {!detail && section === "learn" ? (
              <LearnView
                settings={settings}
                setSettings={setSettings}
                onOnboarding={() => setModal({ type: "onboarding" })}
                onToast={showToast}
                onEditProfile={() => setDetail({ kind: "profile-edit" })}
                onOpenBlocked={() => setDetail({ kind: "blocked" })}
                savedCount={savedPhrases.length + savedPhraseIds.size}
                profileName={profile.name}
                profileBio={profile.bio}
              />
            ) : null}
          </main>

        </div>
      </div>

      <nav className="mobile-nav" aria-label={t("모바일 주요 메뉴")}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              type="button"
              key={item.id}
              className={section === item.id ? "active" : ""}
              onClick={() => goToSection(item.id)}
              aria-current={section === item.id ? "page" : undefined}
            >
              <span className="mobile-nav-icon"><Icon size={21} />{item.id === "chats" ? <i>7</i> : null}</span>
              <small>{t(item.shortLabel)}</small>
            </button>
          );
        })}
      </nav>

      {modal ? (
        <ModalLayer
          modal={modal}
          onClose={() => setModal(null)}
          onStartChat={startChat}
          onPublish={publishPost}
          onCreateRoom={createVoiceRoom}
          onReport={reportTarget}
          onToast={showToast}
          mutedRoomIds={mutedRoomIds}
          onToggleRoomMute={(id) => toggleIn(setMutedRoomIds, id, t("이 방의 알림을 껐어요"), t("이 방의 알림을 켰어요"))}
          onCopyLink={copyLink}
          existingPartnerIds={conversations.map((item) => item.partnerId ?? "")}
          onMinimizeRoom={(room) => { setMinimizedRoom(room); setModal(null); }}
          roomMessages={roomMessages}
          onSendRoomMessage={(text) => setRoomMessages((list) => [...list, { id: `rm-${list.length + 1}-${text.length}`, name: currentUser.name, text, mine: true }])}
          roomHandRaised={roomHandRaised}
          setRoomHandRaised={setRoomHandRaised}
          roomMicOn={roomMicOn}
          setRoomMicOn={setRoomMicOn}
          exchangeLength={exchangeLength}
          setExchangeLength={setExchangeLength}
          matchPreferences={matchPreferences}
          onSaveMatchPreferences={saveMatchPreferences}
          dailyQueue={dailyRecommendations.length ? dailyRecommendations : fallbackDailyRecommendations()}
          partnerIndex={partnerIndex}
          signaledPartners={signaledPartners}
          onJumpPartner={(position) => { setPartnerIndex(position); setModal(null); }}
          onOpenPartnerProfile={(partner) => { setModal(null); openProfile(partner); }}
          onAcceptLike={(partner) => { setModal(null); startChat(partner); showToast(t("{name}님과 대화가 열렸어요", { name: partner.name })); }}
        />
      ) : null}

      {minimizedRoom && !modal ? (
        <MiniRoom
          room={minimizedRoom}
          handRaised={roomHandRaised}
          micOn={roomMicOn}
          onExpand={() => { setModal({ type: "room", room: minimizedRoom }); setMinimizedRoom(null); }}
          onLeave={() => { setMinimizedRoom(null); setRoomHandRaised(false); setRoomMicOn(false); showToast(t("보이스룸에서 나갔어요")); }}
        />
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          <CheckCircle2 size={18} /> {toast}
        </div>
      ) : null}
    </div>
  );
}


/** 카드 스택의 카드 한 장. 상단 카드만 액션이 동작합니다. */
function PartnerCard({
  match,
  depth,
  exit,
  onProfile,
}: {
  match: DailyMatchRecommendation;
  depth: number;
  exit: "" | "left" | "right";
  onProfile: (id: string) => void;
}) {
  const partner = match.partner;
  const top = depth === 0;
  const localTime = useLocalTime(partner.timeOffset);
  return (
    <article
      className={`single-match-card partner-card depth-${depth} ${exit ? `exit-${exit}` : ""}`.trim()}
      aria-hidden={!top}
      style={{ zIndex: 10 - depth }}
    >

        {/* ① 누구인가 — 이 영역을 누르면 프로필로 갑니다 */}
        <button
          type="button"
          className="single-match-person"
          onClick={() => onProfile(partner.id)}
          disabled={!top}
          aria-label={t("{name} 프로필 보기", { name: partner.name })}
        >
          <Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="xl" online={partner.online} />
          <div>
            <span><h2>{partner.name}</h2>{partner.verified ? <BadgeCheck size={17} className="verified" aria-label={t("인증됨")} /> : null}</span>
            <p>{partner.flag} {partner.country} · {partner.city}</p>
            <small className={partner.online ? "is-online" : ""}>
              {partner.online ? t("지금 접속 중") : t("오늘 접속함")}{localTime ? t(" · 현지 {localTime}", { localTime }) : ""}
            </small>
          </div>
          <span className="match-score"><strong>{match.score}%</strong><small>{t("잘 맞아요")}</small></span>
        </button>

        {/* ② 언어 교환 — 무엇을 주고받는지 */}
        <div className="match-langs">
          <span className="match-lang give">
            <small>{t("가르쳐줘요")}</small>
            <strong>{tx(partner.native)}</strong>
            <em>{t("원어민")}</em>
          </span>
          <span className="match-lang-arrow"><ArrowLeftRight size={16} /></span>
          <span className="match-lang take">
            <small>{t("배우고 있어요")}</small>
            <strong>{tx(partner.learning)}</strong>
            <em>{partner.level}</em>
          </span>
        </div>

        <div className="match-reasons">
          {match.matchReasons.slice(0, 3).map((reason) => <span key={reason}><Check size={12} /> {tx(reason)}</span>)}
        </div>

    </article>
  );
}


/**
 * 선택 드롭다운. 브라우저 기본 select 는 OS마다 생김새가 달라 앱 안에서 혼자 튑니다.
 * 열리는 목록을 MenuPopover 와 같은 판(.menu-panel)으로 그려 «···» 메뉴와 문법을 맞춥니다.
 */
function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="select-field" ref={wrap}>
      <span className="field-label">{label}</span>
      <button
        type="button"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{value}</span>
        <ChevronDown size={16} />
      </button>
      {open ? (
        <div className="menu-panel menu-start select-panel" role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === value}
              className={option === value ? "selected" : ""}
              onClick={() => { onChange(option); setOpen(false); }}
            >
              {option}
              {option === value ? <Check size={16} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * 드롭다운 메뉴. 바깥 클릭·ESC로 닫히고, 항목 선택 시 자동으로 닫힙니다.
 */
function MenuPopover({
  label,
  items,
  align = "end",
}: {
  label: string;
  items: Array<{ id: string; label: string; icon: LucideIcon; danger?: boolean; onSelect: () => void }>;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);

  // 아래 공간이 부족하면 위로 엽니다. 스크롤 컨테이너에 잘리는 것을 막습니다.
  const toggle = () => {
    setOpen((current) => {
      if (current) return false;
      const rect = wrap.current?.getBoundingClientRect();
      const needed = items.length * 40 + 24;
      setDropUp(Boolean(rect && window.innerHeight - rect.bottom < needed && rect.top > needed));
      return true;
    });
  };

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
    <div className="menu-wrap" ref={wrap}>
      <button
        type="button"
        className="menu-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <Ellipsis size={19} />
      </button>
      {open ? (
        <div className={`menu-panel menu-${align} ${dropUp ? "menu-up" : ""}`.trim()} role="menu">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={item.danger ? "danger" : ""}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              <item.icon size={17} />
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}


/** 상세 화면 공통 헤더. 뒤로가기 + 제목. */
function DetailHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="detail-header">
      <button type="button" className="detail-back" onClick={onBack} aria-label={t("뒤로")}>
        <ArrowLeft size={20} />
      </button>
      <span className="detail-title">{title}</span>
    </header>
  );
}

/** 게시물 상세 화면 — 원글(48px 그리드) → 액션 → 구분선 → 답글 → 답글 입력. */
function PostDetailView({
  post,
  onBack,
  onProfile,
  onReport,
  onToast,
  saved,
  onSavePhrase,
  onHideAuthor,
  onBlockAuthor,
  onCopyLink,
  onTagSelect,
  sort,
  onSortChange,
}: {
  post: FeedPost;
  onBack: () => void;
  onProfile: (authorId: string) => void;
  onReport: () => void;
  onToast: (message: string) => void;
  saved: boolean;
  onSavePhrase: (postId: string) => void;
  onHideAuthor: (authorId: string, name: string) => void;
  onBlockAuthor: (authorId: string, name: string) => void;
  onCopyLink: (url: string) => void;
  onTagSelect: (tag: string) => void;
  sort: "popular" | "recent";
  onSortChange: (value: "popular" | "recent") => void;
}) {
  const [replies, setReplies] = useState<PostReply[]>(postReplies[post.id] ?? []);
  const [draft, setDraft] = useState("");
  const [liked, setLiked] = useState(Boolean(post.liked));
  const [likedReplies, setLikedReplies] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<{ id: string; author: string } | null>(null);
  const [replyKind, setReplyKind] = useState<"reply" | "correction">("reply");
  const [correctionSource, setCorrectionSource] = useState<string | null>(null);
  const replyInputRef = useRef<HTMLTextAreaElement | null>(null);
  /* 인기순은 좋아요 많은 순, 최신순은 나중에 달린 순(배열 뒤쪽)입니다. */
  const sortedReplies = sort === "popular"
    ? [...replies].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
    : [...replies].reverse();

  // 내용에 따라 입력창 높이를 맞춥니다 (프리필·삭제 포함).
  useEffect(() => {
    const el = replyInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  // 교정 모드: 대상 원문을 입력창에 채워서 고치게 합니다.
  const enterCorrectionMode = () => {
    const findText = (list: PostReply[]): string | null => {
      for (const item of list) {
        if (item.id === replyTo?.id) return item.text;
        const inner = item.replies ? findText(item.replies) : null;
        if (inner) return inner;
      }
      return null;
    };
    const source = replyTo ? findText(replies) ?? post.text : post.text;
    setReplyKind("correction");
    setCorrectionSource(source);
    if (!draft.trim() || draft === correctionSource) setDraft(source);
    document.getElementById("reply-input")?.focus();
  };

  const exitCorrectionMode = () => {
    setReplyKind("reply");
    // 원문을 손대지 않았다면 비웁니다 (실수로 원문이 일반 답글로 나가지 않게)
    if (draft === correctionSource) setDraft("");
    setCorrectionSource(null);
  };

  const toggleReplyLike = (id: string) => {
    setLikedReplies((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitReply = () => {
    const checked = checkText(draft, "reply");
    if (!checked.ok) { if (checked.error) onToast(checked.error); return; }
    const text = checked.value;
    if (replyKind === "correction" && text === correctionSource?.trim()) {
      onToast(t("원문에서 고친 부분이 없어요"));
      return;
    }
    const mine: PostReply = {
      id: `local-${Date.now()}`,
      author: currentUser.name,
      handle: currentUser.handle,
      flag: currentUser.flag,
      accent: currentUser.accent,
      time: t("방금"),
      text,
      likes: 0,
      kind: replyKind,
      ...(replyKind === "correction" && correctionSource ? { original: correctionSource } : {}),
    };
    setReplies((current) => {
      if (!replyTo) return [mine, ...current];
      // 대댓글: 부모의 replies 앞에 붙입니다.
      return current.map((reply) =>
        reply.id === replyTo.id ? { ...reply, replies: [mine, ...(reply.replies ?? [])] } : reply,
      );
    });
    setDraft("");
    setReplyTo(null);
    onToast(replyKind === "correction" ? t("교정을 남겼어요") : t("답글을 남겼어요"));
    setReplyKind("reply");
    setCorrectionSource(null);
  };

  const startReplyTo = (reply: PostReply) => {
    setReplyTo({ id: reply.id, author: reply.author });
    document.getElementById("reply-input")?.focus();
  };

  const renderReply = (reply: PostReply, isChild: boolean) => (
    <article className={`thread-item reply ${isChild ? "child" : ""}`} key={reply.id}>
      <div className="thread-gutter">
        <Avatar name={reply.author} flag={reply.flag} accent={reply.accent} size={isChild ? "xs" : "sm"} />
      </div>
      <div className="thread-body">
        <div className="thread-head">
          <span className="thread-author">{reply.author}</span>
          {reply.kind === "correction" ? <span className="reply-kind-badge"><PenLine size={12} /> {t("교정")}</span> : null}
          <span className="thread-meta">{tx(reply.time)}</span>
        </div>
        {reply.kind === "correction" && reply.original ? (
          <div className="reply-correction">
            <p className="was">{reply.original}</p>
            <p className="now">{reply.text}</p>
          </div>
        ) : (
          <p className={reply.kind === "correction" ? "thread-text correction" : "thread-text"}>{reply.text}</p>
        )}
        <div className="reply-actions">
          <button
            type="button"
            className={likedReplies.has(reply.id) ? "active" : ""}
            onClick={() => toggleReplyLike(reply.id)}
            aria-label={t("답글 좋아요")}
          >
            <Heart size={15} /> {reply.likes + (likedReplies.has(reply.id) ? 1 : 0) || ""}
          </button>
          {!isChild ? (
            <button type="button" onClick={() => startReplyTo(reply)}>
              <MessageCircle size={15} /> {t("답글")}
            </button>
          ) : null}
        </div>
        {reply.replies?.length ? (
          <div className="reply-children">{reply.replies.map((child) => renderReply(child, true))}</div>
        ) : null}
      </div>
    </article>
  );

  return (
    <div className="view detail-view">
      <DetailHeader title={t("게시물")} onBack={onBack} />

      <article className="thread-item">
        <div className="thread-gutter">
          <button type="button" className="thread-avatar" onClick={() => onProfile(post.authorId)} aria-label={t("{author} 프로필", { author: post.author })}>
            <Avatar name={post.author} flag={post.flag} accent={post.accent} size="sm" />
          </button>
        </div>
        <div className="thread-body">
          <div className="thread-head">
            <button type="button" className="thread-author" onClick={() => onProfile(post.authorId)}>{post.author}</button>
            <span className="thread-meta">{tx(post.time)}</span>
            <span className="thread-meta">{tx(post.language)} · {post.level}</span>
            <span className="thread-spacer" />
            <MenuPopover
              label={t("게시물 메뉴")}
              items={[
                { id: "link", label: t("링크 복사"), icon: LinkIcon, onSelect: () => onCopyLink(`${window.location.origin}/#community/post/${post.id}`) },
                { id: "save", label: saved ? t("복습함에서 빼기") : t("복습에 저장"), icon: Bookmark, onSelect: () => onSavePhrase(post.id) },
                { id: "mute", label: t("이 사용자 글 그만 보기"), icon: EyeOff, onSelect: () => onHideAuthor(post.authorId, post.author) },
                { id: "block", label: t("차단하기"), icon: Ban, danger: true, onSelect: () => onBlockAuthor(post.authorId, post.author) },
                { id: "report", label: t("신고하기"), icon: Flag, danger: true, onSelect: onReport },
              ]}
            />
          </div>

          <p className="thread-text">{post.text}</p>
          <p className="post-detail-translation"><Languages size={15} /> {post.translation}</p>

          <div className="post-tags">
            {post.tags.map((tag) => (
              <button type="button" key={tag} onClick={() => onTagSelect(tag)}>{tag}</button>
            ))}
          </div>

          <div className="post-actions detail-actions">
            <button type="button" className={liked ? "like active" : "like"} onClick={() => { setLiked((v) => !v); onToast(liked ? t("좋아요를 취소했어요") : t("응원을 보냈어요")); }}>
              <Heart size={19} /> {post.likes + (liked && !post.liked ? 1 : 0)}
            </button>
            <button type="button" onClick={() => document.getElementById("reply-input")?.focus()}>
              <MessageCircle size={18} /> {post.comments + replies.length - (postReplies[post.id]?.length ?? 0)}
            </button>
            <button type="button" className="correct" onClick={() => onToast(t("교정 모드를 열었어요"))}>
              <PenLine size={18} /> {t("교정 {n}", { n: post.corrections })}
            </button>
            <button type="button" onClick={() => onToast(t("게시물을 공유했어요"))}><Send size={18} /></button>
          </div>
        </div>
      </article>

      <div className="reply-composer">
        {replyTo ? (
          <span className="reply-target">
            {t("{author}님에게", { author: replyTo.author })}
            <button type="button" onClick={() => setReplyTo(null)} aria-label={t("대댓글 취소")}><X size={13} /></button>
          </span>
        ) : (
          <Avatar name={currentUser.name} flag={currentUser.flag} accent={currentUser.accent} size="sm" />
        )}
        <textarea
          id="reply-input"
          ref={replyInputRef}
          rows={1}
          maxLength={LIMITS.reply}
          placeholder={replyKind === "correction" ? t("교정할 문장을 고쳐서 적어주세요") : replyTo ? t("{author}님에게 답글 남기기", { author: replyTo.author }) : t("{author}님에게 답글 남기기", { author: post.author })}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submitReply();
            }
          }}
        />
        <div className="reply-kind-toggle" role="radiogroup" aria-label={t("답글 종류")}>
          <button
            type="button"
            role="radio"
            aria-checked={replyKind === "reply"}
            className={replyKind === "reply" ? "on" : ""}
            title={t("일반 답글")}
            onClick={exitCorrectionMode}
          >
            <MessageCircle size={15} />
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={replyKind === "correction"}
            className={replyKind === "correction" ? "on correction" : ""}
            title={t("교정 남기기")}
            onClick={enterCorrectionMode}
          >
            <PenLine size={15} />
          </button>
        </div>
        <button
          type="button"
          className="reply-send"
          disabled={!draft.trim()}
          onClick={submitReply}
          aria-label={replyKind === "correction" ? t("교정 남기기") : t("답글 남기기")}
          title={replyKind === "correction" ? t("교정 남기기") : t("답글 남기기")}
        >
          <ArrowUp size={18} strokeWidth={2.4} />
        </button>
      </div>

      <div className="replies-head">
        <strong>{t("답글")}</strong>
        <button type="button" onClick={() => onSortChange(sort === "popular" ? "recent" : "popular")}>
          {sort === "popular" ? t("인기순") : t("최신순")} <ChevronDown size={14} />
        </button>
      </div>

      {replies.length === 0 ? (
        <p className="replies-empty">{t("아직 답글이 없습니다")}</p>
      ) : (
        sortedReplies.map((reply) => renderReply(reply, false))
      )}

    </div>
  );
}

/** 파트너 프로필 상세 화면. */
function ProfileDetailView({
  partner,
  onBack,
  onStartChat,
  onReport,
  saved,
  onSavePartner,
}: {
  partner: Partner;
  onBack: () => void;
  onStartChat: (partner: Partner) => void;
  onReport: () => void;
  saved: boolean;
  onSavePartner: (id: string, name: string) => void;
}) {
  return (
    <div className="view detail-view">
      <DetailHeader title={partner.name} onBack={onBack} />

      <header className="profile-head">
        <div className="profile-head-id">
          <span className="profile-head-name">
            {partner.name}
            {partner.verified ? <BadgeCheck size={18} className="verified" /> : null}
          </span>
          <p className="profile-head-handle">{partner.handle} · {partner.city}</p>
        </div>
        <Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="xl" online={partner.online} />
      </header>

      <p className="profile-head-bio">{partner.bio}</p>

      <div className="profile-head-stats">
        <span><strong>{partner.compatibility}%</strong> {t("교환 궁합")}</span>
        <span><strong>{tx(partner.native)}</strong> {t("원어민")}</span>
        <span><strong>{tx(partner.learning)}</strong> {partner.level}</span>
      </div>

      <div className="profile-head-actions">
        <button className="primary-button" type="button" onClick={() => onStartChat(partner)}>
          <MessageCircle size={16} /> {t("대화 시작")}
        </button>
        <button className={saved ? "primary-button" : "secondary-button"} type="button" onClick={() => onSavePartner(partner.id, partner.name)}>
          <Star size={16} /> {saved ? t("저장됨") : t("저장")}
        </button>
        <button className="secondary-button" type="button" onClick={onReport}>
          <Flag size={16} /> {t("신고")}
        </button>
      </div>

      <section className="profile-detail-section">
        <h3>{t("언어 교환")}</h3>
        <div className="profile-language-grid">
          <span><small>{t("가르칠 수 있어요")}</small><strong>{partner.flag} {tx(partner.native)}</strong><em>{t("원어민")}</em></span>
          <span><small>{t("배우고 있어요")}</small><strong>🇰🇷 {tx(partner.learning)}</strong><em>{partner.level}</em></span>
        </div>
      </section>

      <section className="profile-detail-section">
        <h3>{t("관심사")}</h3>
        <div className="interest-row large">{partner.interests.map((item) => <span key={item}>{item}</span>)}</div>
      </section>

      <section className="profile-detail-section">
        <h3>{t("잘 맞는 이유")}</h3>
        <p className="profile-detail-row"><Clock3 size={16} /><span><strong>{t("활동 시간")}</strong><small>{partner.activeTime}</small></span></p>
        <p className="profile-detail-row"><Trophy size={16} /><span><strong>{t("학습 목표")}</strong><small>{partner.goal}</small></span></p>
      </section>
    </div>
  );
}

/**
 * 프로필 편집 — 지금까지 "프로필을 수정합니다" 토스트만 뜨던 자리입니다.
 * 저장하면 사이드바·프로필 화면에 바로 반영됩니다.
 */
function ProfileEditView({
  value,
  onBack,
  onSave,
}: {
  value: ProfileDraft;
  onBack: () => void;
  onSave: (next: ProfileDraft) => void;
}) {
  const [draft, setDraft] = useState<ProfileDraft>(value);
  const changed = JSON.stringify(draft) !== JSON.stringify(value);

  return (
    <div className="view detail-view">
      <DetailHeader title={t("프로필 편집")} onBack={onBack} />
      <div className="form-section">
        <label className="field-label" htmlFor="profile-name">{t("이름")}</label>
        <input
          id="profile-name"
          className="text-input"
          value={draft.name}
          maxLength={LIMITS.profileName}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </div>
      <div className="form-section">
        <label className="field-label" htmlFor="profile-bio">{t("자기소개")}</label>
        <textarea
          id="profile-bio"
          className="text-input"
          rows={4}
          value={draft.bio}
          maxLength={LIMITS.profileBio}
          onChange={(event) => setDraft({ ...draft, bio: event.target.value })}
        />
        <small className="field-hint">{t("{n}/{max}자", { n: draft.bio.length, max: LIMITS.profileBio })}</small>
      </div>
      <div className="form-section">
        <label className="field-label" htmlFor="profile-goal">{t("학습 목표")}</label>
        <input
          id="profile-goal"
          className="text-input"
          value={draft.goal}
          maxLength={LIMITS.profileGoal}
          onChange={(event) => setDraft({ ...draft, goal: event.target.value })}
        />
      </div>
      <div className="form-section">
        <span className="field-label">{t("프로필 공개 범위")}</span>
        <div className="choice-row">
          <button
            type="button"
            className={draft.visibility === "public" ? "active" : ""}
            onClick={() => setDraft({ ...draft, visibility: "public" })}
          >
            {t("전체 공개")}
          </button>
          <button
            type="button"
            className={draft.visibility === "partners" ? "active" : ""}
            onClick={() => setDraft({ ...draft, visibility: "partners" })}
          >
            {t("매칭된 파트너만")}
          </button>
        </div>
      </div>
      <div className="modal-footer">
        <small>{t("변경 내용은 이 기기에 반영돼요")}</small>
        <button className="primary-button" type="button" disabled={!changed} onClick={() => onSave(draft)}>
          {t("저장")}
        </button>
      </div>
    </div>
  );
}

/**
 * 숨김·차단 목록 — 눌러서 숨긴 사람을 여기서 다시 풀 수 있어야
 * 잘못 누른 사람이 되돌릴 방법이 생깁니다.
 */
function BlockedListView({
  hidden,
  blocked,
  onBack,
  onUnhide,
  onUnblock,
}: {
  hidden: string[];
  blocked: string[];
  onBack: () => void;
  onUnhide: (id: string) => void;
  onUnblock: (id: string) => void;
}) {
  const nameOf = (id: string) => partners.find((item) => item.id === id)?.name ?? id;
  const rows = [
    ...hidden.map((id) => ({ id, kind: "hidden" as const })),
    ...blocked.map((id) => ({ id, kind: "blocked" as const })),
  ];

  return (
    <div className="view detail-view">
      <DetailHeader title={t("신고 및 차단 관리")} onBack={onBack} />
      {rows.length === 0 ? (
        <div className="empty-state">
          <EyeOff size={28} />
          <strong>{t("숨기거나 차단한 사람이 없어요")}</strong>
          <p>{t("게시물 메뉴에서 숨기거나 차단하면 여기에 모입니다.")}</p>
        </div>
      ) : (
        <ul className="blocked-list">
          {rows.map((row) => (
            <li key={`${row.kind}-${row.id}`}>
              <Avatar name={nameOf(row.id)} size="sm" />
              <span>
                <strong>{nameOf(row.id)}</strong>
                <small>{row.kind === "blocked" ? t("차단함") : t("글 숨김")}</small>
              </span>
              <button
                type="button"
                className="secondary-button"
                onClick={() => (row.kind === "blocked" ? onUnblock(row.id) : onUnhide(row.id))}
              >
                {row.kind === "blocked" ? t("차단 해제") : t("다시 보기")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DiscoverView({
  preferences,
  dailyRecommendations,
  index,
  signaledCount,
  onProfile,
  onFilters,
  onSkip,
  onSignal,
  onRestart,
  onOpenList,
  onOpenLikes,
  receivedCount,
}: {
  preferences: MatchPreferences;
  dailyRecommendations: DailyMatchRecommendation[];
  index: number;
  signaledCount: number;
  onProfile: (partner: Partner) => void;
  onFilters: () => void;
  onSkip: () => void;
  onSignal: (partner: Partner) => void;
  onRestart: () => void;
  onOpenList: () => void;
  onOpenLikes: () => void;
  receivedCount: number;
}) {
  const queue = dailyRecommendations.length ? dailyRecommendations : fallbackDailyRecommendations();
  const total = Math.min(queue.length, MAX_DAILY_PARTNERS);
  const match = queue[index];
  const [exiting, setExiting] = useState<"" | "left" | "right">("");

  // 카드가 빠져나가는 애니메이션을 끝까지 재생한 뒤 다음 카드로 넘깁니다.
  const runExit = (direction: "left" | "right", after: () => void) => {
    if (exiting) return;
    setExiting(direction);
    window.setTimeout(() => {
      setExiting("");
      after();
    }, 260);
  };

  const handleSkip = () => runExit("left", onSkip);
  const handleSignal = (partner: Partner) => runExit("right", () => onSignal(partner));

  // 오늘 볼 파트너를 모두 확인한 상태
  if (!match) {
    return (
      <div className="view discover-view compact-discover">
        <header className="simple-view-header partner-view-header">
          <div>
            <h1>{t("오늘의 파트너")}</h1>
            <p>{t("오늘은 여기까지예요.")}</p>
          </div>
          <button className="secondary-button" type="button" onClick={onFilters}><SlidersHorizontal size={16} /> {t("조건 바꾸기")}</button>
        </header>

        <section className="partners-exhausted">
          <span className="partners-exhausted-icon"><CalendarDays size={32} strokeWidth={1.6} /></span>
          <strong>{t("오늘 만날 사람을 다 봤어요")}</strong>
          <p>
            {t("오늘 {total}명을 모두 확인했어요", { total })}
            {signaledCount > 0 ? t(" · {signaledCount}명에게 신호를 보냈어요", { signaledCount }) : ""}.
            <br />
            {t("내일 오전 9시에 새로운 파트너를 추천해드릴게요.")}
          </p>
          <div className="partners-exhausted-actions">
            <button className="primary-button" type="button" onClick={onFilters}><SlidersHorizontal size={16} /> {t("조건 바꾸기")}</button>
            <button className="secondary-button" type="button" onClick={onRestart}><RotateCcw size={16} /> {t("처음부터 다시")}</button>
          </div>
        </section>
      </div>
    );
  }

  const targetLanguage = labelOf(languageLabels, preferences.targetLanguages[0] ?? "en");
  // 내가 건 조건 — 카드가 아니라 헤더에 둡니다 (상대 정보와 섞이지 않게)
  const myFilters = [
    targetLanguage,
    preferences.interests.slice(0, 2).map((item) => labelOf(interestLabels, item)).join(" · "),
    t(availabilityLabels[preferences.availability[0] ?? "weekday-evening"]),
  ].filter(Boolean).join(" · ");

  return (
    <div className="view discover-view compact-discover">
      <header className="simple-view-header partner-view-header">
        <div>
          <h1>{t("오늘의 파트너")}</h1>
          <p>
            {myFilters} ·{" "}
            <button type="button" className="link-underline" onClick={onOpenList}>
              {t("오늘 {total}명 중 {index}번째", { total, index: index + 1 })}
            </button>
          </p>
        </div>
        <div className="partner-header-actions">
          <button className="secondary-button likes-entry" type="button" onClick={onOpenLikes}>
            <Heart size={16} /> {t("받은 마음")}
            {receivedCount > 0 ? <i>{receivedCount}</i> : null}
          </button>
          <button className="secondary-button" type="button" onClick={onFilters}><SlidersHorizontal size={16} /> {t("조건 바꾸기")}</button>
        </div>
      </header>

      <div className="partner-arena">
        <button
          type="button"
          className="swipe-button skip"
          onClick={handleSkip}
          aria-label={t("다음 사람 보기")}
          title={t("다음")}
        >
          <X size={30} strokeWidth={2.4} />
        </button>

        <div className="partner-stack">
        {queue.slice(index, index + 3).map((item, depth) => (
          <PartnerCard
            key={item.partner.id}
            match={item}
            depth={depth}
            exit={depth === 0 ? exiting : ""}
            onProfile={(id) => { const p = queue.find((q) => q.partner.id === id)?.partner; if (p) onProfile(p); }}
          />
        ))}
        </div>

        <button
          type="button"
          className="swipe-button like"
          onClick={() => handleSignal(match.partner)}
          aria-label={t("대화하고 싶어요")}
          title={t("대화하고 싶어요")}
        >
          <Heart size={30} strokeWidth={2.4} />
        </button>
      </div>

      <div className="partner-progress" aria-label={t("{total}명 중 {index}번째", { total, index: index + 1 })}>
        {Array.from({ length: total }, (_, i) => <i key={i} className={i <= index ? "done" : ""} />)}
      </div>
    </div>
  );
}

function CommunityView({
  posts,
  tab,
  setTab,
  translated,
  corrections,
  onTranslate,
  onCorrection,
  onToggle,
  onProfile,
  onReport,
  onOpen,
  onToast,
  hiddenAuthorIds,
  blockedAuthorIds,
  onHideAuthor,
  onBlockAuthor,
  activeTag,
  onTagSelect,
  savedPhraseIds,
  onSavePhrase,
  onCopyLink,
}: {
  posts: FeedPost[];
  tab: "recommended" | "learning" | "following";
  setTab: (value: "recommended" | "learning" | "following") => void;
  hiddenAuthorIds: Set<string>;
  blockedAuthorIds: Set<string>;
  onHideAuthor: (authorId: string, name: string) => void;
  onBlockAuthor: (authorId: string, name: string) => void;
  activeTag: string | null;
  onTagSelect: (tag: string | null) => void;
  savedPhraseIds: Set<string>;
  onSavePhrase: (postId: string) => void;
  onCopyLink: (url: string) => void;
  translated: Set<string>;
  corrections: Set<string>;
  onTranslate: (id: string) => void;
  onCorrection: (id: string) => void;
  onToggle: (id: string, key: "liked" | "saved") => void;
  onProfile: (id: string) => void;
  onReport: (target: string) => void;
  onOpen: (post: FeedPost) => void;
  onToast: (message: string) => void;
}) {
  const PAGE = 12;
  const [count, setCount] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement | null>(null);
  // 탭이 실제로 피드를 거릅니다.
  const filteredPosts = posts.filter((post) => {
    // 숨기거나 차단한 사람의 글은 피드에서 빠집니다 — 그래야 눌린 게 보입니다.
    if (hiddenAuthorIds.has(post.authorId) || blockedAuthorIds.has(post.authorId)) return false;
    if (activeTag) return post.tags.includes(activeTag);
    if (tab === "learning") return post.language === currentUser.learning;
    if (tab === "following") return followingAuthors.includes(post.authorId);
    return true;
  });
  const visible = filteredPosts.slice(0, count);
  const hasMore = count < filteredPosts.length;

  // IntersectionObserver로 바닥 감시 — 스크롤 이벤트보다 가볍습니다.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setCount((current) => Math.min(current + PAGE, filteredPosts.length));
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasMore, filteredPosts.length]);

  // 탭을 바꾸면 처음부터
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setCount(PAGE));
    return () => window.cancelAnimationFrame(frame);
  }, [tab]);

  return (
    <div className="view community-view">
      <div className="community-toolbar">
        <div className="segmented-tabs" role="tablist" aria-label={t("커뮤니티 피드")}>
          <button type="button" role="tab" aria-selected={tab === "recommended"} className={tab === "recommended" ? "active" : ""} onClick={() => setTab("recommended")}>{t("추천")}</button>
          <button type="button" role="tab" aria-selected={tab === "learning"} className={tab === "learning" ? "active" : ""} onClick={() => setTab("learning")}>{t("영어")}</button>
          <button type="button" role="tab" aria-selected={tab === "following"} className={tab === "following" ? "active" : ""} onClick={() => setTab("following")}>{t("팔로잉")}</button>
        </div>
      </div>

      {activeTag ? (
        <div className="tag-filter-bar">
          <span><Hash size={14} />{activeTag.replace("#", "")}</span>
          <small>{t("{n}개의 글", { n: filteredPosts.length })}</small>
          <button type="button" onClick={() => onTagSelect(null)}><X size={14} /> {t("필터 해제")}</button>
        </div>
      ) : null}

      <div className="feed-grid">
        {visible.map((post) => (
            <article className="feed-post" key={post.id}>
              <header className="post-header">
                <button className="post-author" type="button" onClick={() => onProfile(post.authorId)}>
                  <Avatar name={post.author} flag={post.flag} accent={post.accent} size="sm" online={post.authorId === "maya"} />
                  <span><strong>{post.author}{post.authorId === "maya" ? <BadgeCheck size={14} className="verified" /> : null}</strong><small>{post.handle} · {tx(post.time)}</small></span>
                </button>
                <div className="post-meta">
                  <Pill tone="language">{tx(post.language)} · {post.level}</Pill>
                  <MenuPopover
                    label={t("게시물 메뉴")}
                    items={[
                      { id: "link", label: t("링크 복사"), icon: LinkIcon, onSelect: () => onCopyLink(`${window.location.origin}/#community/post/${post.id}`) },
                      { id: "save", label: savedPhraseIds.has(post.id) ? t("복습함에서 빼기") : t("복습에 저장"), icon: Bookmark, onSelect: () => onSavePhrase(post.id) },
                      { id: "mute", label: t("이 사용자 글 그만 보기"), icon: EyeOff, onSelect: () => onHideAuthor(post.authorId, post.author) },
                      { id: "block", label: t("차단하기"), icon: Ban, onSelect: () => onBlockAuthor(post.authorId, post.author) },
                      { id: "report", label: t("신고하기"), icon: Flag, danger: true, onSelect: () => onReport(post.author) },
                    ]}
                  />
                </div>
              </header>
              <button className="post-copy-open" type="button" onClick={() => onOpen(post)} aria-label={t("{author}님의 게시물 열기", { author: post.author })}>
                <span className="post-copy">{post.text}</span>
              </button>
              {translated.has(post.id) ? <div className="translation-box"><Languages size={16} /><p><span>{t("데모 번역")}</span>{post.translation}</p></div> : null}
              <div className="post-tags">{post.tags.map((tag) => <button type="button" key={tag} className={activeTag === tag ? "active" : ""} onClick={() => onTagSelect(activeTag === tag ? null : tag)}>{tag}</button>)}</div>
              {post.visual ? (
                <div className={`post-visual visual-${post.accent}`}>
                  <span className="visual-grid" />
                  <span className="visual-emoji">{post.visual.emoji}</span>
                  <span className="visual-copy"><small>{post.visual.eyebrow}</small><strong>{post.visual.title}</strong><em>{post.visual.caption}</em></span>
                </div>
              ) : null}
              {post.correction && corrections.has(post.id) ? (
                <div className="correction-card">
                  <header><span><WandSparkles size={16} /> {t("문장 교정")}</span><small>{t("Jisoo 🇰🇷 · 2분 전")}</small></header>
                  <p className="before"><span>–</span>{post.correction.original}</p>
                  <p className="after"><span>+</span>{post.correction.fixed}</p>
                  <div className="correction-note"><BookOpenCheck size={15} /> {post.correction.note}</div>
                  <button type="button" onClick={() => onToast(t("복습함에 저장했어요"))}><Bookmark size={14} /> {t("복습에 저장")}</button>
                </div>
              ) : null}
              <footer className="post-actions">
                <button className={post.liked ? "active like" : ""} type="button" onClick={() => onToggle(post.id, "liked")}><Heart size={18} fill={post.liked ? "currentColor" : "none"} /> {post.likes}</button>
                <button type="button" onClick={() => onToast(t("댓글 패널을 열었어요"))}><MessageCircle size={18} /> {post.comments}</button>
                <button className={corrections.has(post.id) ? "active correct" : ""} type="button" onClick={() => onCorrection(post.id)}><PenLine size={18} /> {t("교정 {n}", { n: post.corrections })}</button>
                <button className={translated.has(post.id) ? "active" : ""} type="button" onClick={() => onTranslate(post.id)}><Languages size={18} /> {t("번역")}</button>
                <button className={post.saved ? "active save" : "post-save"} type="button" aria-label={t("저장")} onClick={() => onToggle(post.id, "saved")}><Bookmark size={18} fill={post.saved ? "currentColor" : "none"} /></button>
              </footer>
          </article>
        ))}
      </div>

      {hasMore ? (
        <div className="feed-sentinel" ref={sentinel} aria-hidden="true">
          <span className="feed-spinner" />
        </div>
      ) : (
        <p className="feed-end">{t("모든 글을 확인했어요 · {n}개", { n: filteredPosts.length })}</p>
      )}
    </div>
  );
}

function ChatsView({
  conversations,
  selected,
  mobileThreadOpen,
  onSelect,
  onBack,
  draft,
  setDraft,
  onSend,
  onExchange,
  onProfile,
  onReport,
  onToast,
  mutedChatIds,
  onToggleMute,
  onLeaveChat,
  onBlockPartner,
  onNewChat,
}: {
  onNewChat: () => void;
  conversations: Conversation[];
  selected: Conversation;
  mobileThreadOpen: boolean;
  mutedChatIds: Set<string>;
  onToggleMute: (id: string, name: string) => void;
  onLeaveChat: (id: string, name: string) => void;
  onBlockPartner: (id: string, name: string) => void;
  onSelect: (id: string) => void;
  onBack: () => void;
  draft: string;
  setDraft: (text: string) => void;
  onSend: (event: FormEvent<HTMLFormElement>) => void;
  onExchange: () => void;
  onProfile: () => void;
  onReport: () => void;
  onToast: (message: string) => void;
}) {
  const [listTab, setListTab] = useState<"all" | "turn" | "requests">("all");
  const [listQuery, setListQuery] = useState("");
  const [translatedMessages, setTranslatedMessages] = useState<Set<string>>(new Set(["m1"]));
  const [coachOpen, setCoachOpen] = useState(true);
  const [coachLoading, setCoachLoading] = useState(false);
  const [supportResult, setSupportResult] = useState<{ conversationId: string; data: ConversationSupport } | null>(null);
  const conversationSupport = supportResult?.conversationId === selected.id ? supportResult.data : fallbackConversationSupport(selected.name);
  /* 탭으로 먼저 좁히고, 검색어가 있으면 이름·마지막 메시지에서 찾습니다. */
  const byTab = conversations.filter((item) =>
    listTab === "turn" ? item.myTurn : listTab === "requests" ? item.id === "chat-aiko" : true,
  );
  const needle = listQuery.trim().toLowerCase();
  const filtered = needle
    ? byTab.filter((item) =>
        item.name.toLowerCase().includes(needle) || item.preview.toLowerCase().includes(needle),
      )
    : byTab;
  const unreadTotal = conversations.reduce((sum, item) => sum + item.unread, 0);
  const myTurnCount = conversations.filter((item) => item.myTurn).length;

  const requestConversationSupport = async (polishDraft = false) => {
    setCoachLoading(true);
    const partnerId = {
      maya: "user-maya",
      aiko: "user-ren",
      lucas: "user-sofia",
    }[selected.partnerId ?? ""] ?? (selected.partnerId ? `user-${selected.partnerId}` : "user-maya");

    try {
      const response = await fetch("/api/conversation-support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ partnerId, draft: draft.trim() || undefined, stage: selected.messages.length > 2 ? "ongoing" : "first-message" }),
      });
      if (!response.ok) throw new Error(`Mock API returned ${response.status}`);
      const body = await response.json() as { data?: ConversationSupport };
      if (!body.data) throw new Error("Missing mock support data");
      setSupportResult({ conversationId: selected.id, data: body.data });
      if (polishDraft && body.data.improvedDraft) {
        setDraft(body.data.improvedDraft);
        onToast(t("대화 코치가 문장을 자연스럽게 다듬었어요"));
      } else {
        onToast(t("지금 대화에 맞는 주제를 새로 추천했어요"));
      }
    } catch {
      const fallback = fallbackConversationSupport(selected.name);
      const improvedDraft = draft.trim() ? `${draft.trim()} I’d love to hear more about it!` : undefined;
      setSupportResult({ conversationId: selected.id, data: { ...fallback, improvedDraft } });
      if (polishDraft && improvedDraft) setDraft(improvedDraft);
      onToast(t("준비된 대화 코칭 예시를 보여드려요 · 오프라인 데모"));
    } finally {
      setCoachLoading(false);
    }
  };

  return (
    <div className={`chat-shell ${mobileThreadOpen ? "mobile-thread-open" : ""}`}>
      <section className="conversation-panel">
        <header className="conversation-title">
          <div><h1>{t("대화")}</h1>{unreadTotal > 0 ? <Pill tone="soft">{t("안 읽음 {n}", { n: unreadTotal })}</Pill> : null}</div>
          <IconButton label={t("새 대화")} icon={PenLine} onClick={onNewChat} />
        </header>
        <label className="chat-search"><Search size={16} /><input type="search" value={listQuery} onChange={(event) => setListQuery(event.target.value)} placeholder={t("이름 또는 대화 검색")} />{listQuery ? <button type="button" className="chat-search-clear" aria-label={t("검색어 지우기")} onClick={() => setListQuery("")}><X size={14} /></button> : null}</label>
        <div className="chat-list-tabs">
          <button type="button" className={listTab === "all" ? "active" : ""} onClick={() => setListTab("all")}>{t("전체")}</button>
          <button type="button" className={listTab === "turn" ? "active" : ""} onClick={() => setListTab("turn")}>{t("내 차례")}{myTurnCount > 0 ? <span>{myTurnCount}</span> : null}</button>
          <button type="button" className={listTab === "requests" ? "active" : ""} onClick={() => setListTab("requests")}>{t("요청함")}</button>
        </div>
        <div className="conversation-list">
          {filtered.length === 0 ? (
            <div className="conversation-empty">
              <Search size={24} />
              <strong>{needle ? t("찾는 대화가 없어요") : t("여기에 표시할 대화가 없어요")}</strong>
              <p>{needle ? t("이름이나 대화 내용을 더 짧게 입력해보세요.") : t("새 대화를 시작하면 여기에 모입니다.")}</p>
              <button className="secondary-button" type="button" onClick={onNewChat}><PenLine size={15} /> {t("새 대화")}</button>
            </div>
          ) : null}
          {filtered.map((conversation) => (
            <button
              type="button"
              className={`conversation-item ${selected.id === conversation.id ? "active" : ""}`}
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
            >
              <Avatar name={conversation.name} flag={conversation.flag} accent={conversation.accent} size="lg" online={conversation.online} />
              <span className="conversation-copy">
                <span className="conversation-name"><strong>{conversation.name}</strong>{mutedChatIds.has(conversation.id) ? <BellOff size={12} className="conversation-muted" /> : null}<small>{tx(conversation.time)}</small></span>
                <span className={conversation.typing ? "typing" : ""}>{conversation.typing ? t("입력 중…") : conversation.preview}</span>
                <span className="conversation-labels">
                  {conversation.myTurn ? <i>{t("내 차례")}</i> : null}
                  {conversation.group ? <i className="group-label"><Users size={11} /> {t("그룹")}</i> : null}
                  {conversation.muted ? <i>{t("알림 끔")}</i> : null}
                </span>
              </span>
              {conversation.unread ? <span className="unread-count">{conversation.unread}</span> : null}
            </button>
          ))}
        </div>
      </section>

      <section className="chat-thread" aria-label={t("{name}님과의 대화", { name: selected.name })}>
        <header className="thread-header">
          <button className="mobile-back" type="button" onClick={onBack} aria-label={t("대화 목록으로")}><ArrowLeft size={21} /></button>
          <button className="thread-person" type="button" onClick={onProfile}>
            <Avatar name={selected.name} flag={selected.flag} accent={selected.accent} size="sm" online={selected.online} />
            <span><strong>{selected.name}</strong><small>{selected.online ? t("온라인 · 영어 ⇄ 한국어") : t("최근 활동 어제")}</small></span>
          </button>
          <div className="thread-actions">
            <button className={`coach-cta ${coachOpen ? "active" : ""}`} type="button" onClick={() => setCoachOpen(!coachOpen)}><WandSparkles size={16} /><span>{t("대화 코치")}</span></button>
            <button className="exchange-cta" type="button" onClick={onExchange}><Timer size={16} /><span>{t("교환 세션")}</span></button>
            <IconButton label={t("음성 통화")} icon={Phone} onClick={() => onToast(t("음성 통화 데모를 시작했어요"))} />
            <IconButton label={t("영상 통화")} icon={Video} onClick={() => onToast(t("영상 통화 데모를 시작했어요"))} />
            <MenuPopover
              label={t("대화 메뉴")}
              items={[
                { id: "mute", label: mutedChatIds.has(selected.id) ? t("알림 켜기") : t("알림 끄기"), icon: BellOff, onSelect: () => onToggleMute(selected.id, selected.name) },
                { id: "leave", label: t("대화방 나가기"), icon: LogOut, onSelect: () => onLeaveChat(selected.id, selected.name) },
                { id: "block", label: t("차단하기"), icon: Ban, danger: true, onSelect: () => onBlockPartner(selected.id, selected.name) },
                { id: "report", label: t("신고하기"), icon: Flag, danger: true, onSelect: onReport },
              ]}
            />
          </div>
        </header>

        <div className="exchange-banner">
          <span className="exchange-banner-icon"><Languages size={18} /></span>
          <span><strong>{t("오늘의 교환 균형")}</strong><small>{t("영어 8분 · 한국어 7분")}</small></span>
          <div className="balance-bar"><i style={{ width: "53%" }} /></div>
          <button type="button" onClick={onExchange}>{t("15분 이어하기")} <ChevronRight size={15} /></button>
        </div>

        {coachOpen ? (
          <section className="conversation-coach" aria-label={t("대화 코치")}>
            <header>
              <span className="coach-title-icon"><WandSparkles size={18} /></span>
              <span><strong>{t("대화 코치")}</strong><small>{t("{name}님과의 공통점과 지금까지의 흐름을 바탕으로 준비했어요.", { name: selected.name })}</small></span>
              <button type="button" onClick={() => void requestConversationSupport(false)} disabled={coachLoading}><RefreshCw size={14} className={coachLoading ? "spinning" : ""} /> {t("새로 추천")}</button>
              <button type="button" className="coach-close" aria-label={t("대화 코치 닫기")} onClick={() => setCoachOpen(false)}><X size={15} /></button>
            </header>
            <div className="coach-grid">
              <div className="coach-topic-list">
                <span className="coach-label"><Lightbulb size={13} /> {t("대화 주제")}</span>
                {conversationSupport.topics.slice(0, 3).map((topic, index) => (
                  <button type="button" key={topic} onClick={() => setDraft(index === 0 ? conversationSupport.suggestedOpeners[0] ?? `Hi ${selected.name}! What was the highlight of your week?` : `Hi ${selected.name}! Can we talk about “${topic}” today?`)}>
                    <span>{index + 1}</span>{topic}<ChevronRight size={13} />
                  </button>
                ))}
              </div>
              <div className="coach-response-card">
                <span className="coach-label"><MessageCircle size={13} /> {t("추천 오프너")}</span>
                <p>{conversationSupport.suggestedOpeners[0]}</p>
                <div className="coach-followups">{conversationSupport.followUpQuestions.slice(0, 2).map((question) => <button type="button" key={question} onClick={() => setDraft(question)}>{question}</button>)}</div>
                <div className="coach-actions">
                  <button type="button" onClick={() => setDraft(conversationSupport.suggestedOpeners[0] ?? "")}>{t("입력창에 넣기")}</button>
                  <button type="button" onClick={() => void requestConversationSupport(true)} disabled={!draft.trim() || coachLoading}><WandSparkles size={13} /> {t("작성 문장 다듬기")}</button>
                </div>
              </div>
            </div>
            <footer><Sparkles size={12} /><span>{conversationSupport.tip}</span><small>DEMO COACH</small></footer>
          </section>
        ) : null}

        <div className="message-area">
          <div className="day-divider"><span>{t("오늘")}</span></div>
          {selected.messages.map((message) => {
            if (message.system) return <div className="system-message" key={message.id}><ShieldCheck size={14} />{message.text}</div>;
            if (message.correction) {
              return (
                <div className="message-row correction-message" key={message.id}>
                  <Avatar name={selected.name} accent={selected.accent} size="xs" />
                  <div className="chat-correction-card">
                    <span className="correction-label"><PenLine size={14} /> {t("{name}님이 문장을 고쳤어요", { name: selected.name })}</span>
                    <p className="before">{message.correction.original}</p>
                    <p className="after">{message.correction.fixed}</p>
                    <small>{message.correction.note}</small>
                    <button type="button" onClick={() => onToast(t("복습함에 저장했어요"))}><Bookmark size={14} /> {t("표현 저장")}</button>
                  </div>
                  <time>{localizeClock(message.time)}</time>
                </div>
              );
            }
            return (
              <div className={`message-row ${message.mine ? "mine" : "theirs"}`} key={message.id}>
                {!message.mine ? <Avatar name={selected.name} accent={selected.accent} size="xs" /> : null}
                <div className="message-stack">
                  <div className="message-bubble">
                    {message.voice ? <button className="voice-message" type="button" onClick={() => onToast(t("음성 메시지를 재생 중이에요"))}><span className="play-dot"><Play size={13} fill="currentColor" /></span><span className="waveform"><i /><i /><i /><i /><i /><i /><i /><i /><i /></span><small>{message.voice}</small></button> : null}
                    {message.text ? <p>{message.text}</p> : null}
                  </div>
                  {message.translated && translatedMessages.has(message.id) ? <div className="message-translation"><Languages size={13} /> {message.translated}</div> : null}
                  <div className="message-tools">
                    {message.translated ? <button type="button" onClick={() => toggleLocalSet(setTranslatedMessages, message.id)}><Languages size={13} /> {t("번역")}</button> : null}
                    <button type="button" onClick={() => onToast(t("문장 교정 편집기를 열었어요"))}><PenLine size={13} /> {t("교정")}</button>
                    <button type="button" onClick={() => onToast(t("표현을 저장했어요"))}><Bookmark size={13} /> {t("저장")}</button>
                    <button type="button" onClick={() => onToast(t("문장을 원어민 발음으로 재생했어요"))}><Volume2 size={13} /> {t("듣기")}</button>
                  </div>
                </div>
                <time>{localizeClock(message.time)}{message.mine ? t(" · 읽음") : ""}</time>
              </div>
            );
          })}
          <div className="typing-indicator"><Avatar name={selected.name} accent={selected.accent} size="xs" /><span><i /><i /><i /></span><small>{t("{name}님이 입력 중", { name: selected.name })}</small></div>
        </div>

        <form className="message-composer" onSubmit={onSend}>
          <div className="writing-language"><span>EN</span> {t("영어로 작성 중")} <ChevronDown size={13} /></div>
          <div className="composer-row">
            <IconButton label={t("파일 첨부")} icon={Paperclip} onClick={() => onToast(t("파일 첨부 데모를 열었어요"))} />
            <IconButton label={t("음성 메시지")} icon={Mic} onClick={() => onToast(t("녹음 데모 · 다시 누르면 전송돼요"))} />
            <label className="message-input">
              <span className="sr-only">{t("메시지 입력")}</span>
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t("{name}님에게 메시지 보내기", { name: selected.name })} rows={1} maxLength={LIMITS.message} />
              <button type="button" aria-label={t("이모지")} onClick={() => setDraft(`${draft} 😊`)}><Smile size={18} /></button>
            </label>
            <button className="send-button" type="submit" disabled={!draft.trim()} aria-label={t("메시지 보내기")}><Send size={18} /></button>
          </div>
          <small className="composer-hint"><WandSparkles size={12} /> {t("Enter로 줄바꿈 · 전송 전 문법 힌트는 데모로 제공돼요")}</small>
        </form>
      </section>
    </div>
  );
}

function toggleLocalSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
  setter((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

function PracticeView({
  rooms: availableRooms,
  onJoin,
  onCreate,
}: {
  rooms: PracticeRoom[];
  onJoin: (room: PracticeRoom) => void;
  onCreate: () => void;
}) {
  return (
    <div className="view practice-view simple-practice">
      <header className="simple-view-header">
        <div><h1>{t("보이스룸")}</h1><p>{t("관심 있는 주제의 방을 골라 듣거나 직접 만들어보세요.")}</p></div>
        <button className="primary-button" type="button" onClick={onCreate}><Plus size={17} /> {t("보이스룸 만들기")}</button>
      </header>

      <div className="voice-room-toolbar"><strong>{t("열려 있는 방")}</strong><span>{t("{n}개", { n: availableRooms.length })}</span></div>
      <div className="voice-room-list">
        {availableRooms.map((room) => (
          <article className={`voice-room-list-card room-${room.accent}`} key={room.id}>
            <div className="room-card-head">
              <span className="room-language"><Globe2 size={14} /> {room.language}</span>
              {room.scheduled ? <Pill tone="neutral"><CalendarDays size={12} /> {room.scheduled}</Pill> : <span className="room-live"><i /> LIVE</span>}
            </div>
            <div className="voice-room-main">
              <span className="voice-room-host"><Avatar name={room.host} flag={room.hostFlag} accent={room.accent} size="sm" online={!room.scheduled} /></span>
              <span><h2>{room.title}</h2><p>{tx(room.topic)} · {tx(room.level)}</p><small>{room.host} · {t("{n}명 참여 중", { n: room.listeners ?? 1 })}</small></span>
              <button type="button" onClick={() => onJoin(room)}>{room.scheduled ? t("미리보기") : t("입장")}<ChevronRight size={16} /></button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}


/** 밑줄형 탭. 활성은 검정 밑줄 2px, 굵기는 그대로 400. */
function Tabs({
  tabs,
  active,
  onSelect,
}: {
  tabs: Array<{ id: string; label: string }>;
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="profile-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === active}
          className={tab.id === active ? "active" : ""}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function LearnView({
  settings,
  setSettings,
  onOnboarding,
  onToast,
  onEditProfile,
  onOpenBlocked,
  savedCount,
  profileName,
  profileBio,
}: {
  onEditProfile: () => void;
  onOpenBlocked: () => void;
  savedCount: number;
  profileName: string;
  profileBio: string;
  settings: { dmRequests: boolean; hideLocation: boolean; correctionAlerts: boolean };
  setSettings: React.Dispatch<React.SetStateAction<{ dmRequests: boolean; hideLocation: boolean; correctionAlerts: boolean }>>;
  onOnboarding: () => void;
  onToast: (message: string) => void;
}) {
  const toggle = (key: keyof typeof settings) => setSettings((current) => ({ ...current, [key]: !current[key] }));
  const [profileTab, setProfileTab] = useState("posts");
  return (
    <div className="view learn-view compact-learn">
      <div className="profile-toolbar">
        <IconButton label={t("설정")} icon={Settings} onClick={onEditProfile} />
      </div>

      <header className="profile-head">
        <div className="profile-head-id">
          <span className="profile-head-name">{profileName}<BadgeCheck size={18} className="verified" /></span>
          <p className="profile-head-handle">{currentUser.handle}</p>
        </div>
        <Avatar name={profileName} flag={currentUser.flag} accent="violet" size="xl" online />
      </header>

      <p className="profile-head-bio">{profileBio}</p>

      <div className="profile-head-stats">
        <span><strong>{currentUser.partners}</strong> {t("파트너")}</span>
        <span><strong>{currentUser.posts}</strong> {t("게시물")}</span>
        <span><strong>{currentUser.streak}</strong>{t("일 연속")}</span>
      </div>

      <div className="profile-head-actions">
        <button className="secondary-button" type="button" onClick={onEditProfile}><PenLine size={16} /> {t("프로필 편집")}</button>
      </div>

      <Tabs
        tabs={[
          { id: "posts", label: t("내 글") },
          { id: "saved", label: t("저장한 표현") },
          { id: "learning", label: t("학습") },
        ]}
        active={profileTab}
        onSelect={setProfileTab}
      />

      {profileTab === "posts" ? (
        <div className="profile-posts">
          {myPosts.map((post) => (
            <article className="my-post" key={post.id}>
              <div className="my-post-head">
                <span className="my-post-time">{post.time}</span>
                <span className="my-post-lang">{post.language} · {post.level}</span>
              </div>
              <p className="my-post-text">{post.text}</p>
              <div className="post-tags">
                {post.tags.map((tag) => <button type="button" key={tag} onClick={() => onToast(t("{tag} 주제를 열었어요", { tag }))}>{tag}</button>)}
              </div>
              <div className="my-post-stats">
                <span><Heart size={15} /> {post.likes}</span>
                <span><MessageCircle size={15} /> {post.comments}</span>
                <span><PenLine size={15} /> {t("교정 {n}", { n: post.corrections })}</span>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {profileTab === "learning" ? (
      <section className="learn-overview-grid" aria-label={t("학습 요약")}>
        <article><span className="summary-icon coral"><Flame size={18} /></span><small>{t("연속 학습")}</small><strong>{currentUser.streak}<em>{t("일")}</em></strong></article>
        <article><span className="summary-icon violet"><Timer size={18} /></span><small>{t("이번 주 대화")}</small><strong>145<em>{t("분")}</em></strong></article>
        <article><span className="summary-icon mint"><Bookmark size={18} /></span><small>{t("저장한 표현")}</small><strong>{savedCount}<em>{t("개")}</em></strong></article>
        <article><span className="summary-icon amber"><PenLine size={18} /></span><small>{t("받은 교정")}</small><strong>18<em>{t("개")}</em></strong></article>
      </section>
      ) : null}

      {profileTab === "saved" ? (
      <div className="learn-compact-columns">
        <section className="saved-phrases-card">
          <header><span><strong>{t("저장한 표현")}</strong><small>{t("{n}개 · 약 4분", { n: savedCount })}</small></span><button type="button" onClick={() => onToast(t("전체 저장 표현을 열었어요"))}>{t("전체")} <ChevronRight size={15} /></button></header>
          <div className="phrase-list">
            {savedPhrases.map((item, index) => <article key={item.phrase}><button type="button" className="phrase-play" onClick={() => onToast(t("표현을 재생했어요"))}><Volume2 size={16} /></button><span><strong>{item.phrase}</strong><small>{item.meaning}</small><em>{item.source}</em></span><span className={index === 0 ? "due-now" : ""}>{item.due}</span></article>)}
          </div>
          <button className="review-button" type="button" onClick={() => onToast(t("4분 복습 세션을 시작했어요"))}><BookOpenCheck size={17} /> {t("4분 복습 시작")}</button>
        </section>

      </div>
      ) : null}

      {profileTab === "learning" ? (
      <div className="learn-compact-columns">
        <section className="settings-card">
          <header><span><strong>{t("계정 및 학습 설정")}</strong><small>{t("변경 내용은 이 기기에 반영돼요")}</small></span><Settings size={18} /></header>
          <button className="profile-settings-link" type="button" onClick={onEditProfile}><span className="setting-icon"><PenLine size={17} /></span><span><strong>{t("프로필 설정")}</strong><small>{t("사진, 자기소개, 관심사 수정")}</small></span><ChevronRight size={15} /></button>
          <button className="profile-settings-link" type="button" onClick={onOnboarding}><span className="setting-icon"><Target size={17} /></span><span><strong>{t("언어 및 목표")}</strong><small>{t("학습 언어와 목표 다시 설정")}</small></span><ChevronRight size={15} /></button>
          <LanguagePicker />
          <SettingRow icon={Bell} title={t("메시지 알림")} description={t("새 메시지가 오면 알려주기")} checked={settings.dmRequests} onChange={() => toggle("dmRequests")} />
          <SettingRow icon={LockKeyhole} title={t("정밀 위치 숨기기")} description={t("도시 수준만 프로필에 표시")} checked={settings.hideLocation} onChange={() => toggle("hideLocation")} />
          <SettingRow icon={PenLine} title={t("교정 알림")} description={t("내 문장이 교정되면 알려주기")} checked={settings.correctionAlerts} onChange={() => toggle("correctionAlerts")} />
          <button className="blocked-link" type="button" onClick={onOpenBlocked}><Flag size={16} /> {t("신고 및 차단 관리")} <ChevronRight size={15} /></button>
        </section>
      </div>
      ) : null}
    </div>
  );
}

function SettingRow({ icon: Icon, title, description, checked, onChange }: { icon: LucideIcon; title: string; description: string; checked: boolean; onChange: () => void }) {
  return <label className="setting-row"><span className="setting-icon"><Icon size={17} /></span><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={onChange} /><i className="toggle" aria-hidden="true" /></label>;
}

function ModalLayer({
  modal,
  onClose,
  onStartChat,
  onPublish,
  onCreateRoom,
  onReport,
  onToast,
  mutedRoomIds,
  onToggleRoomMute,
  onCopyLink,
  existingPartnerIds,
  onMinimizeRoom,
  roomMessages,
  onSendRoomMessage,
  roomHandRaised,
  setRoomHandRaised,
  roomMicOn,
  setRoomMicOn,
  exchangeLength,
  setExchangeLength,
  matchPreferences,
  onSaveMatchPreferences,
  dailyQueue,
  partnerIndex,
  signaledPartners,
  onJumpPartner,
  onOpenPartnerProfile,
  onAcceptLike,
}: {
  modal: Exclude<ModalState, null>;
  onClose: () => void;
  onStartChat: (partner: Partner) => void;
  onPublish: (text: string) => void;
  onCreateRoom: (details: { title: string; topic: string; language: string; level: string }) => void;
  onReport: (target: string) => void;
  mutedRoomIds: Set<string>;
  onToggleRoomMute: (id: string) => void;
  onCopyLink: (url: string) => void;
  existingPartnerIds: string[];
  onToast: (message: string) => void;
  onMinimizeRoom: (room: PracticeRoom) => void;
  roomMessages: RoomMessage[];
  onSendRoomMessage: (text: string) => void;
  roomHandRaised: boolean;
  setRoomHandRaised: (value: boolean) => void;
  roomMicOn: boolean;
  setRoomMicOn: (value: boolean) => void;
  exchangeLength: number;
  setExchangeLength: (value: number) => void;
  matchPreferences: MatchPreferences;
  onSaveMatchPreferences: (preferences: MatchPreferences) => Promise<void>;
  dailyQueue: DailyMatchRecommendation[];
  partnerIndex: number;
  signaledPartners: string[];
  onJumpPartner: (position: number) => void;
  onOpenPartnerProfile: (partner: Partner) => void;
  onAcceptLike: (partner: Partner) => void;
}) {
  const [closing, setClosing] = useState(false);

  // 닫힘 애니메이션을 끝까지 재생한 뒤 언마운트합니다.
  const requestClose = useCallback(() => {
    setClosing((current) => {
      if (current) return current;
      window.setTimeout(onClose, 180);
      return true;
    });
  }, [onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose]);

  return (
    <div className={`modal-backdrop ${closing ? "is-closing" : ""}`.trim()} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <div className={`modal modal-${modal.type}`} role="dialog" aria-modal="true" aria-label={modalLabel(modal.type)}>
        <button className="modal-close" type="button" onClick={requestClose} aria-label={t("닫기")}><X size={20} /></button>
        {modal.type === "profile" ? <ProfileModal partner={modal.partner} onStartChat={onStartChat} onReport={() => onReport(modal.partner.name)} onToast={onToast} /> : null}
        {modal.type === "filters" ? <MatchingPreferencesModal initial={matchPreferences} onClose={onClose} onSave={onSaveMatchPreferences} onToast={onToast} /> : null}
        {modal.type === "compose" ? <ComposeModal onPublish={onPublish} onToast={onToast} /> : null}
        {modal.type === "search" ? <SearchModal onStartChat={onStartChat} onToast={onToast} /> : null}
        {modal.type === "create-room" ? <CreateRoomModal onCreate={onCreateRoom} /> : null}
        {modal.type === "room" ? <RoomModal room={modal.room} handRaised={roomHandRaised} setHandRaised={setRoomHandRaised} micOn={roomMicOn} setMicOn={setRoomMicOn} messages={roomMessages} onSendMessage={onSendRoomMessage} onMinimize={() => onMinimizeRoom(modal.room)} onLeave={onClose} onReport={() => onReport(modal.room.title)} onToast={onToast} mutedRoom={mutedRoomIds.has(modal.room.id)} onToggleRoomMute={onToggleRoomMute} onCopyLink={onCopyLink} /> : null}
        {modal.type === "exchange" ? <ExchangeModal length={exchangeLength} setLength={setExchangeLength} onClose={onClose} onToast={onToast} /> : null}
        {modal.type === "new-chat" ? (
          <NewChatModal
            existingPartnerIds={existingPartnerIds}
            onPick={(partner) => { onClose(); onStartChat(partner); }}
          />
        ) : null}
        {modal.type === "partner-list" ? <PartnerListModal queue={dailyQueue} index={partnerIndex} signaled={signaledPartners} onJump={onJumpPartner} onProfile={onOpenPartnerProfile} /> : null}
        {modal.type === "likes" ? (
          <LikesModal
            received={receivedLikes.flatMap((item) => {
              const partner = partners.find((p) => p.id === item.partnerId);
              return partner ? [{ partner, time: item.time, note: item.note }] : [];
            })}
            sent={signaledPartners.flatMap((id) => { const p = partners.find((x) => x.id === id); return p ? [p] : []; })}
            onAccept={onAcceptLike}
            onProfile={onOpenPartnerProfile}
          />
        ) : null}
        {modal.type === "report" ? <ReportModal target={modal.target} onCancel={onClose} onConfirm={() => onReport(modal.target)} /> : null}
        {modal.type === "onboarding" ? <OnboardingModal onClose={onClose} onToast={onToast} /> : null}
      </div>
    </div>
  );
}

function modalLabel(type: Exclude<ModalState, null>["type"]) {
  const labels: Record<Exclude<ModalState, null>["type"], string> = { "new-chat": t("새 대화"), profile: t("파트너 프로필"), filters: t("매칭 설정"), compose: t("새 게시물"), search: t("통합 검색"), "create-room": t("보이스룸 만들기"), room: t("보이스룸"), exchange: t("언어 교환 세션"), "partner-list": t("오늘의 파트너 목록"), likes: t("주고받은 마음"), report: t("신고 및 차단"), onboarding: t("학습 목표 설정") };
  return labels[type];
}




/** 오늘의 파트너 목록. 지금까지 본 사람과 남은 사람을 한눈에 보고 바로 이동합니다. */

/** 마음 목록 행의 메타 줄. 현지 시각을 마운트 이후에 채웁니다. */
function LikeMeta({ partner, time }: { partner: Partner; time: string }) {
  const localTime = useLocalTime(partner.timeOffset);
  return (
    <small>
      {partner.flag} {partner.country}
      {localTime ? t(" · 현지 {localTime}", { localTime }) : ""}
      {time ? ` · ${time}` : ""}
    </small>
  );
}

/** 주고받은 마음. 상대가 보낸 마음에 답하면 대화가 열립니다. */
function LikesModal({
  received,
  sent,
  onAccept,
  onProfile,
}: {
  received: Array<{ partner: Partner; time: string; note?: string }>;
  sent: Partner[];
  onAccept: (partner: Partner) => void;
  onProfile: (partner: Partner) => void;
}) {
  const [tab, setTab] = useState<"received" | "sent">("received");
  const list = tab === "received" ? received : sent.map((partner) => ({ partner, time: "", note: undefined }));

  return (
    <div className="likes-modal">
      <header>
        <h2>{t("주고받은 마음")}</h2>
        <p>{t("서로 마음을 보내면 대화가 열려요")}</p>
      </header>

      <div className="likes-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "received"} className={tab === "received" ? "active" : ""} onClick={() => setTab("received")}>
          {t("받은 마음")} <span>{received.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "sent"} className={tab === "sent" ? "active" : ""} onClick={() => setTab("sent")}>
          {t("보낸 마음")} <span>{sent.length}</span>
        </button>
      </div>

      {list.length === 0 ? (
        <p className="likes-empty">{tab === "received" ? t("아직 받은 마음이 없어요") : t("아직 보낸 마음이 없어요")}</p>
      ) : (
        <ul className="likes-list">
          {list.map(({ partner, time, note }) => (
            <li key={partner.id}>
              <button type="button" className="likes-row" onClick={() => onProfile(partner)}>
                <Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="sm" online={partner.online} />
                <span className="likes-copy">
                  <strong>{partner.name}</strong>
                  <LikeMeta partner={partner} time={time} />
                  {note ? <em>“{note}”</em> : null}
                </span>
              </button>
              {tab === "received" ? (
                <button type="button" className="primary-button likes-accept" onClick={() => onAccept(partner)}>
                  <MessageCircle size={15} /> {t("대화 열기")}
                </button>
              ) : (
                <span className="likes-waiting">{t("답장 기다리는 중")}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="likes-hint">
        <Sparkles size={14} /> {t("받은 마음에 답하면 바로 대화가 시작돼요")}
      </p>
    </div>
  );
}

/**
 * 새 대화 — 이미 대화방이 있는 사람은 목록에서 빼고, 고르면 바로 그 방으로 들어갑니다.
 * "파트너 검색에서 시작해보세요" 토스트만 뜨던 자리를 대신합니다.
 */
function NewChatModal({
  existingPartnerIds,
  onPick,
}: {
  existingPartnerIds: string[];
  onPick: (partner: Partner) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const needle = query.trim().toLowerCase();
  const candidates = partners
    .filter((partner) => !existingPartnerIds.includes(partner.id))
    .filter((partner) =>
      needle
        ? partner.name.toLowerCase().includes(needle) ||
          partner.native.toLowerCase().includes(needle) ||
          partner.interests.some((item) => item.toLowerCase().includes(needle))
        : true,
    );

  return (
    <div className="new-chat-content">
      <header>
        <Search size={18} />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("이름, 언어, 관심사로 찾기")}
          aria-label={t("파트너 검색")}
        />
      </header>
      {candidates.length === 0 ? (
        <div className="empty-state">
          <MessageCircle size={26} />
          <strong>{needle ? t("찾는 파트너가 없어요") : t("이미 모든 파트너와 대화 중이에요")}</strong>
          <p>{t("파트너 탭에서 새로운 사람을 추천받아보세요.")}</p>
        </div>
      ) : (
        <ul className="new-chat-list">
          {candidates.map((partner) => (
            <li key={partner.id}>
              <button type="button" onClick={() => onPick(partner)}>
                <Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="sm" online={partner.online} />
                <span>
                  <strong>{partner.name}</strong>
                  <small>{tx(partner.native)} ⇄ {tx(partner.learning)} · {partner.interests.slice(0, 2).join(" · ")}</small>
                </span>
                <Pill tone="success">{partner.compatibility}%</Pill>
                <ChevronRight size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <footer>
        <small>{t("고르면 바로 대화방이 열려요")}</small>
      </footer>
    </div>
  );
}

function PartnerListModal({
  queue,
  index,
  signaled,
  onJump,
  onProfile,
}: {
  queue: DailyMatchRecommendation[];
  index: number;
  signaled: string[];
  onJump: (position: number) => void;
  onProfile: (partner: Partner) => void;
}) {
  return (
    <div className="partner-list-modal">
      <header>
        <h2>{t("오늘의 파트너")}</h2>
        <p>{t("{total}명 중 {index}번째를 보고 있어요", { total: queue.length, index: Math.min(index + 1, queue.length) })}</p>
      </header>

      <ul className="partner-list">
        {queue.map((item, position) => {
          const partner = item.partner;
          const isCurrent = position === index;
          const isSeen = position < index;
          const isSignaled = signaled.includes(partner.id);
          return (
            <li key={partner.id} className={isCurrent ? "current" : ""}>
              <button type="button" className="partner-list-row" onClick={() => onJump(position)}>
                <Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="sm" online={partner.online} />
                <span className="partner-list-copy">
                  <strong>{partner.name}</strong>
                  <small>{t("{native} 가르치고 {learning} 배워요", { native: tx(partner.native), learning: tx(partner.learning) })}</small>
                </span>
                <span className="partner-list-state">
                  {isSignaled ? <em className="signaled"><Heart size={13} /> {t("마음 보냄")}</em>
                    : isCurrent ? <em className="now">{t("보는 중")}</em>
                    : isSeen ? <em className="seen">{t("지나감")}</em>
                    : <em>{item.score}%</em>}
                </span>
              </button>
              <button
                type="button"
                className="partner-list-profile"
                onClick={() => onProfile(partner)}
                aria-label={t("{name} 프로필 보기", { name: partner.name })}
              >
                <ChevronRight size={16} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ProfileModal({ partner, onStartChat, onReport, onToast }: { partner: Partner; onStartChat: (partner: Partner) => void; onReport: () => void; onToast: (message: string) => void }) {
  return (
    <div className="profile-modal-content">
      <div className={`profile-cover cover-${partner.accent}`}><span className="cover-pattern" /></div>
      <div className="profile-modal-head">
        <Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="xl" online={partner.online} />
        <div><span><h2>{partner.name}</h2>{partner.verified ? <BadgeCheck size={18} className="verified" /> : null}</span><p>{partner.handle} · {partner.city}</p></div>
        <div className="profile-head-actions"><button className="primary-button" type="button" onClick={() => onStartChat(partner)}><MessageCircle size={17} /> {t("대화 시작")}</button><button className="secondary-button" type="button" onClick={onReport}><Flag size={16} /> {t("신고")}</button></div>
      </div>
      <div className="profile-match-strip"><span><Sparkles size={17} /><b>{partner.compatibility}%</b> {t("교환 궁합")}</span><span><Timer size={17} /><b>{partner.balance}</b></span><span><ShieldCheck size={17} />{t("안전 프로필 확인됨")}</span></div>
      <div className="profile-modal-grid">
        <div className="profile-main">
          <section><h3>{t("자기소개")}</h3><p>{partner.bio}</p></section>
          <section><h3>{t("언어 교환")}</h3><div className="profile-language-grid"><span><small>{t("가르칠 수 있어요")}</small><strong>{partner.flag} {tx(partner.native)}</strong><em>{t("원어민")}</em></span><span><small>{t("배우고 있어요")}</small><strong>🇰🇷 {tx(partner.learning)}</strong><em>{partner.level}</em></span></div></section>
          <section><h3>{t("관심사")}</h3><div className="interest-row large">{partner.interests.map((item) => <span key={item}>{item}</span>)}</div></section>
        </div>
        <aside className="profile-details"><h3>{t("잘 맞는 이유")}</h3><p><Clock3 size={16} /><span><strong>{t("활동 시간")}</strong><small>{partner.activeTime}</small></span></p><p><Trophy size={16} /><span><strong>{t("학습 목표")}</strong><small>{partner.goal}</small></span></p><p><PenLine size={16} /><span><strong>{t("교정 스타일")}</strong><small>{t("중요한 오류를 대화 후에")}</small></span></p><button type="button" onClick={() => onToast(t("파트너를 관심 목록에 저장했어요"))}><Star size={16} /> {t("관심 파트너로 저장")}</button></aside>
      </div>
    </div>
  );
}

function MatchingPreferencesModal({
  initial,
  onClose,
  onSave,
  onToast,
}: {
  initial: MatchPreferences;
  onClose: () => void;
  onSave: (preferences: MatchPreferences) => Promise<void>;
  onToast: (message: string) => void;
}) {
  const [preferences, setPreferences] = useState<MatchPreferences>(initial);
  const [saving, setSaving] = useState(false);
  const availabilityOptions = Object.entries(availabilityLabels) as Array<[MatchAvailability, MessageKey]>;

  const toggleCountry = (country: string) => setPreferences((current) => ({
    ...current,
    preferredCountries: current.preferredCountries.includes(country) ? current.preferredCountries.filter((item) => item !== country) : [...current.preferredCountries, country],
  }));
  const toggleInterest = (interest: string) => setPreferences((current) => ({
    ...current,
    interests: current.interests.includes(interest) ? current.interests.filter((item) => item !== interest) : [...current.interests, interest],
  }));
  const toggleAvailability = (availability: MatchAvailability) => setPreferences((current) => ({
    ...current,
    availability: current.availability.includes(availability) ? current.availability.filter((item) => item !== availability) : [...current.availability, availability],
  }));

  const save = async () => {
    setSaving(true);
    await onSave(preferences);
    setSaving(false);
    onClose();
  };

  return (
    <div className="form-modal">
      <header>
        <Pill tone="soft"><Target size={13} /> DAILY MATCH</Pill>
        <h2>{t("매일 만나고 싶은 상대를 설정해요")}</h2>
        <p>{t("언어, 지역, 관심사와 활동 시간이 가까운 한 사람을 매일 오전 9시에 자동으로 연결해요.")}</p>
      </header>
      <div className="form-section">
        <span className="field-label">{t("배우고 싶은 언어")}</span>
        <div className="choice-row three-columns">
          {[{ value: "en", label: t("영어"), flag: "🇺🇸" }, { value: "es", label: t("스페인어"), flag: "🇪🇸" }, { value: "ja", label: t("일본어"), flag: "🇯🇵" }].map((item) => (
            <button type="button" className={preferences.targetLanguages.includes(item.value) ? "active" : ""} key={item.value} onClick={() => setPreferences((current) => ({ ...current, targetLanguages: [item.value] }))}>{item.flag} {item.label}</button>
          ))}
        </div>
      </div>
      <div className="form-section">
        <span className="field-label">{t("파트너의 한국어 수준")}</span>
        <div className="choice-row">
          {(Object.entries(levelLabels) as Array<[PartnerLevel, MessageKey]>).map(([value, label]) => (
            <button type="button" className={preferences.partnerLevel === value ? "active" : ""} key={value} onClick={() => setPreferences((current) => ({ ...current, partnerLevel: value }))}>{t(label)}</button>
          ))}
        </div>
      </div>
      <div className="form-section">
        <span className="field-label">{t("선호 지역")} <small>{t("복수 선택")}</small></span>
        <div className="chip-options">
          {Object.entries(countryLabels).map(([country, label]) => {
            const active = preferences.preferredCountries.includes(country);
            return <button type="button" className={active ? "active" : ""} key={country} onClick={() => toggleCountry(country)}>{active ? <Check size={13} /> : <Plus size={13} />}{t(label)}</button>;
          })}
        </div>
      </div>
      <div className="form-section">
        <span className="field-label">{t("공통 관심사")}</span>
        <div className="chip-options">
          {Object.entries(interestLabels).map(([interest, label]) => {
            const active = preferences.interests.includes(interest);
            return <button type="button" className={active ? "active" : ""} key={interest} onClick={() => toggleInterest(interest)}>{active ? <Check size={13} /> : <Plus size={13} />}{t(label)}</button>;
          })}
        </div>
      </div>
      <div className="form-section">
        <span className="field-label">{t("주로 대화 가능한 시간")}</span>
        <div className="choice-row">
          {availabilityOptions.map(([value, label]) => (
            <button type="button" className={preferences.availability.includes(value) ? "active" : ""} key={value} onClick={() => toggleAvailability(value)}>{preferences.availability.includes(value) ? <Check size={13} /> : null}{t(label)}</button>
          ))}
        </div>
      </div>
      <label className="setting-row standalone">
        <span className="setting-icon"><Eye size={17} /></span>
        <span><strong>{t("현재 온라인인 사람만")}</strong><small>{t("바로 답장할 가능성이 높아요")}</small></span>
        <input aria-label={t("현재 온라인인 사람만 보기")} type="checkbox" checked={preferences.onlineOnly} onChange={() => setPreferences((current) => ({ ...current, onlineOnly: !current.onlineOnly }))} />
        <i className="toggle" />
      </label>
      <div className="matching-schedule-note"><CalendarClock size={18} /><span><strong>{t("다음 매칭 · 내일 오전 9시")}</strong><small>{t("설정은 이 기기에 저장되며 오늘의 mock 추천에도 즉시 반영됩니다.")}</small></span><Pill tone="success">{t("1명")}</Pill></div>
      <div className="modal-footer">
        <button className="text-button" type="button" onClick={() => { setPreferences(defaultMatchPreferences); onToast(t("기본 매칭 조건으로 되돌렸어요")); }}><RotateCcw size={15} /> {t("초기화")}</button>
        <button className="primary-button" type="button" disabled={saving || !preferences.targetLanguages.length || !preferences.availability.length} onClick={() => void save()}>{saving ? t("저장 중…") : t("설정 저장하고 오늘의 매칭 보기")}</button>
      </div>
    </div>
  );
}

function ComposeModal({ onPublish, onToast }: { onPublish: (text: string) => void; onToast: (message: string) => void }) {
  const [text, setText] = useState("");
  const [correction, setCorrection] = useState(true);
  return (
    <div className="compose-modal-content">
      <header><Pill tone="soft"><PenLine size={13} /> NEW NOTE</Pill><h2>{t("커뮤니티에 공유하기")}</h2></header>
      <div className="compose-author">
        <Avatar name={currentUser.name} flag={currentUser.flag} accent="violet" size="sm" />
        <span><strong>{currentUser.name}</strong><small>{t("영어 학습자")} · {currentUser.level}</small></span>
        <button type="button">{t("전체 공개")} <ChevronDown size={14} /></button>
      </div>
      <label className="compose-text">
        <span className="sr-only">{t("게시물 내용")}</span>
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={t("연습하고 싶은 문장, 궁금한 표현, 문화 이야기를 짧게 나눠보세요…")} rows={7} maxLength={LIMITS.post} />
        <small>{text.length}/{LIMITS.post}</small>
      </label>
      <div className="compose-attachments">
        <button type="button" onClick={() => onToast(t("사진 첨부 데모를 열었어요"))}><ImageIcon size={17} /> {t("사진")}</button>
        <button type="button" onClick={() => onToast(t("음성 녹음 데모를 열었어요"))}><Mic size={17} /> {t("음성")}</button>
        <button type="button" onClick={() => onToast(t("주제를 선택했어요"))}><Plus size={17} /> {t("주제")}</button>
      </div>
      <label className="correction-request">
        <span className="setting-icon"><WandSparkles size={17} /></span>
        <span><strong>{t("원어민에게 교정 요청")}</strong><small>{t("게시물에 교정 버튼이 표시돼요")}</small></span>
        <input aria-label={t("원어민에게 교정 요청")} type="checkbox" checked={correction} onChange={() => setCorrection(!correction)} />
        <i className="toggle" />
      </label>
      <div className="modal-footer">
        <span className="safety-note"><ShieldCheck size={14} /> {t("연락처와 정밀 위치는 공유하지 마세요.")}</span>
        <button className="primary-button" type="button" disabled={!canSubmit(text, "post")} onClick={() => { const checked = checkText(text, "post"); if (!checked.ok) { if (checked.error) onToast(checked.error); return; } onPublish(checked.value); }}>{t("게시하기")} <Send size={16} /></button>
      </div>
    </div>
  );
}

function SearchModal({ onStartChat, onToast }: { onStartChat: (partner: Partner) => void; onToast: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const results = partners.filter((partner) => `${partner.name} ${partner.native} ${partner.interests.join(" ")}`.toLowerCase().includes(query.toLowerCase())).slice(0, 3);
  return <div className="search-modal-content"><header><Search size={21} /><input aria-label={t("검색")} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("사람, 언어, 주제, 저장한 표현 검색")} /><kbd>ESC</kbd></header><div className="search-chips"><span>{t("빠른 검색")}</span>{[t("영어 원어민"), t("지금 온라인"), t("#여행"), t("저장한 표현")].map((item) => <button type="button" key={item} onClick={() => setQuery(item.replace("#", ""))}>{item}</button>)}</div><section><h3>{query ? t("“{query}” 검색 결과", { query }) : t("추천 파트너")}</h3>{results.length ? results.map((partner) => <button className="search-result" type="button" key={partner.id} onClick={() => onStartChat(partner)}><Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="sm" online={partner.online} /><span><strong>{partner.name}</strong><small>{partner.native} ⇄ {partner.learning} · {partner.interests.join(" · ")}</small></span><Pill tone="success">{partner.compatibility}%</Pill><ChevronRight size={16} /></button>) : <div className="empty-search"><Search size={28} /><strong>{t("검색 결과가 없어요")}</strong><p>{t("언어나 관심사를 더 짧게 입력해보세요.")}</p></div>}</section><footer><span><Monitor size={14} /> {t("어디서든")} <kbd>Ctrl</kbd> + <kbd>K</kbd></span><button type="button" onClick={() => onToast(t("전체 검색 결과 화면을 열었어요"))}>{t("전체 검색 보기")}</button></footer></div>;
}

function CreateRoomModal({ onCreate }: { onCreate: (details: { title: string; topic: string; language: string; level: string }) => void }) {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState(t("영어"));
  const [level, setLevel] = useState(t("모든 레벨"));

  return (
    <form className="create-room-form" onSubmit={(event) => { event.preventDefault(); const t1 = checkText(title, "roomTitle"); const t2 = checkText(topic, "roomTopic"); if (!t1.ok || !t2.ok) return; onCreate({ title: t1.value, topic: t2.value, language, level }); }}>
      <header><span className="summary-icon violet"><Mic size={20} /></span><div><h2>{t("보이스룸 만들기")}</h2><p>{t("제목과 대화 주제만 정하면 바로 목록에 추가돼요.")}</p></div></header>
      <label><span className="field-label">{t("방 제목")}</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("예: 퇴근 후 15분 영어")} maxLength={LIMITS.roomTitle} /></label>
      <label><span className="field-label">{t("대화 주제")}</span><input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder={t("예: 여행에서 기억에 남는 순간")} maxLength={64} /></label>
      <div className="create-room-options">
        <SelectField label={t("사용 언어")} value={language} onChange={setLanguage} options={[t("영어"), t("한국어"), t("일본어"), t("스페인어")]} />
        <SelectField label={t("참여 레벨")} value={level} onChange={setLevel} options={[t("모든 레벨"), t("초급"), t("중급"), t("고급")]} />
      </div>
      <div className="modal-footer"><small>{t("생성 결과는 현재 브라우저에서만 유지되는 mock입니다.")}</small><button className="primary-button" type="submit" disabled={!title.trim() || !topic.trim()}><Plus size={16} /> {t("방 만들기")}</button></div>
    </form>
  );
}

function MiniRoom({ room, handRaised, micOn, onExpand, onLeave }: { room: PracticeRoom; handRaised: boolean; micOn: boolean; onExpand: () => void; onLeave: () => void }) {
  const status = micOn ? t("마이크 켜짐") : handRaised ? t("발언 승인 대기 중") : t("{host} · 말하는 중", { host: room.host });
  return (
    <aside className="mini-room" aria-label={t("보이스룸 미니 플레이어")}>
      <button className="mini-room-open" type="button" onClick={onExpand}>
        <span className="mini-room-wave" aria-hidden="true"><i /><i /><i /><i /></span>
        <span className="mini-room-copy"><strong>{room.title}</strong><small>{status}</small></span>
      </button>
      <IconButton label={t("보이스룸 펼치기")} icon={Maximize2} onClick={onExpand} />
      <IconButton label={t("보이스룸 나가기")} icon={X} onClick={onLeave} />
    </aside>
  );
}

function RoomModal({
  room,
  handRaised,
  setHandRaised,
  micOn,
  setMicOn,
  messages,
  onSendMessage,
  onMinimize,
  onLeave,
  onReport,
  onToast,
  mutedRoom,
  onToggleRoomMute,
  onCopyLink,
}: {
  mutedRoom: boolean;
  onToggleRoomMute: (id: string) => void;
  onCopyLink: (url: string) => void;
  room: PracticeRoom;
  handRaised: boolean;
  setHandRaised: (value: boolean) => void;
  micOn: boolean;
  setMicOn: (value: boolean) => void;
  messages: RoomMessage[];
  onSendMessage: (text: string) => void;
  onMinimize: () => void;
  onLeave: () => void;
  onReport: () => void;
  onToast: (message: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [audienceOpen, setAudienceOpen] = useState(false);
  const chatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = chatRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSendMessage(text);
    setDraft("");
  };

  const toggleMic = () => {
    setMicOn(!micOn);
    onToast(micOn ? t("마이크를 껐어요") : t("마이크를 켰어요 · 데모"));
  };

  const toggleHand = () => {
    setHandRaised(!handRaised);
    if (handRaised) setMicOn(false);
    onToast(handRaised ? t("발언 요청을 취소했어요") : t("손을 들었어요. 호스트 승인을 기다려요"));
  };

  const micLabel = !handRaised ? t("발언 요청을 먼저 해주세요") : micOn ? t("마이크 끄기") : t("마이크 켜기");

  return (
    <div className={`room-modal-content room-state-${room.accent}`}>
      <header>
        <div>
          <Pill tone="live"><span className="live-dot" /> LIVE · {t("{n}명", { n: room.listeners || 1 })}</Pill>
          <h2>{room.title}</h2>
          <p>{tx(room.language)} · {tx(room.level)} · {t("호스트")} {room.hostFlag} {room.host}</p>
        </div>
        <div className="room-header-actions">
          <IconButton label={t("보이스룸 축소")} icon={Minimize2} onClick={onMinimize} />
          <MenuPopover
            label={t("방 메뉴")}
            items={[
              { id: "link", label: t("방 링크 복사"), icon: LinkIcon, onSelect: () => onCopyLink(`${window.location.origin}/#practice/room/${room.id}`) },
              { id: "mute", label: mutedRoom ? t("이 방 알림 켜기") : t("이 방 알림 끄기"), icon: BellOff, onSelect: () => onToggleRoomMute(room.id) },
              { id: "leave", label: t("방 나가기"), icon: LogOut, onSelect: () => { onToast(t("보이스룸에서 나왔어요")); onLeave(); } },
              { id: "block", label: t("호스트 차단하기"), icon: Ban, danger: true, onSelect: () => onToast(t("호스트를 차단했어요")) },
              { id: "report", label: t("신고하기"), icon: Flag, danger: true, onSelect: onReport },
            ]}
          />
        </div>
      </header>

      <div className="room-stage">
        <div className="stage-seat speaking">
          <Avatar name={room.host} flag={room.hostFlag} accent={room.accent} size="lg" online />
          <strong>{room.host}</strong>
          <small>{t("호스트 · 말하는 중")}</small>
          <span><Mic size={13} /></span>
        </div>
        {room.speakers.slice(1).map((speaker, index) => (
          <div className="stage-seat" key={speaker}>
            <Avatar name={speaker} accent={(["mint", "amber", "blue"] as Accent[])[index % 3]} size="md" />
            <strong>{speaker}</strong>
            <small>{index === 0 ? t("모더레이터") : t("스피커")}</small>
            <span><Mic size={13} /></span>
          </div>
        ))}
        <button
          className={`stage-seat empty ${handRaised ? "waiting" : ""}`}
          type="button"
          onClick={toggleHand}
        >
          <span><Plus size={20} /></span>
          <strong>{handRaised ? t("승인 대기 중") : t("빈 자리")}</strong>
          <small>{handRaised ? t("호스트가 확인하고 있어요") : t("눌러서 발언 요청")}</small>
        </button>
      </div>

      <section className="room-audience">
        <button
          className="room-audience-toggle"
          type="button"
          aria-expanded={audienceOpen}
          onClick={() => setAudienceOpen((open) => !open)}
        >
          <span className="room-audience-stack" aria-hidden="true">
            {room.audience.slice(0, 5).map((listener) => (
              <Avatar key={listener.name} name={listener.name} accent="blue" size="xs" />
            ))}
          </span>
          <strong>{t("듣는 사람 {n}명", { n: room.listeners })}</strong>
          <ChevronDown size={16} className={audienceOpen ? "rotated" : ""} />
        </button>
        {audienceOpen ? (
          <ul className="room-audience-list">
            {room.audience.map((listener) => (
              <li key={listener.name}>
                <Avatar name={listener.name} flag={listener.flag} accent="blue" size="xs" />
                <span>{listener.name}</span>
              </li>
            ))}
            {room.listeners > room.audience.length ? (
              <li className="room-audience-more">{t("외 {n}명", { n: room.listeners - room.audience.length })}</li>
            ) : null}
          </ul>
        ) : null}
      </section>

      <div className="live-caption">
        <span><Volume2 size={15} /> {t("실시간 자막 · 데모")}</span>
        <p>“What is one small win you had today?”</p>
        <button type="button" onClick={() => onToast(t("선택한 문장을 번역했어요"))}>{t("문장 번역")}</button>
      </div>

      <div className="room-chat" ref={chatRef} role="log" aria-label={t("보이스룸 채팅")}>
        {messages.map((message) => (
          <p key={message.id} className={message.mine ? "mine" : ""}>
            <b>{message.mine ? t("나") : message.name}</b> {message.text}
          </p>
        ))}
      </div>

      <footer>
        <button
          className={`room-action ${micOn ? "mic-active" : handRaised ? "mic-muted" : ""}`}
          type="button"
          onClick={toggleMic}
          disabled={!handRaised}
          aria-label={micLabel}
          aria-pressed={micOn}
          title={micLabel}
        >
          {micOn ? <Mic size={19} /> : <MicOff size={19} />}
        </button>
        <button
          className={`room-action ${handRaised ? "hand-active" : ""}`}
          type="button"
          onClick={toggleHand}
          aria-label={handRaised ? t("손 내리기") : t("손들기")}
          aria-pressed={handRaised}
          title={handRaised ? t("손 내리기") : t("손들기")}
        >
          <Hand size={19} />
        </button>
        <form className="room-composer" onSubmit={send}>
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("채팅으로 인사해보세요")}
            aria-label={t("보이스룸 채팅 입력")}
          />
          <button type="submit" disabled={!draft.trim()} aria-label={t("채팅 보내기")} title={t("채팅 보내기")}>
            <Send size={17} />
          </button>
        </form>
      </footer>
    </div>
  );
}

function ExchangeModal({ length, setLength, onClose, onToast }: { length: number; setLength: (value: number) => void; onClose: () => void; onToast: (message: string) => void }) {
  const half = length / 2;
  return (
    <div className="exchange-modal-content">
      <header>
        <span className="exchange-modal-icon"><Timer size={24} /></span>
        <Pill tone="soft">BALANCED SESSION</Pill>
        <h2>{t("언어 교환 세션")}</h2>
        <p>{t("한 언어씩 공평하게 연습하고, 끝나면 서로 짧은 피드백을 남겨요.")}</p>
      </header>
      <div className="exchange-partners">
        <span><Avatar name={currentUser.name} flag={currentUser.flag} accent="violet" size="md" /><strong>{currentUser.name}</strong><small>{t("영어 연습")}</small></span>
        <i><Languages size={18} /></i>
        <span><Avatar name="Maya" flag="🇨🇦" accent="coral" size="md" /><strong>Maya</strong><small>{t("한국어 연습")}</small></span>
      </div>
      <section>
        <span className="field-label">{t("세션 길이")}</span>
        <div className="duration-options">
          {[10, 15, 20, 30].map((value) => <button type="button" className={length === value ? "active" : ""} key={value} onClick={() => setLength(value)}><strong>{value}</strong><small>{t("분")}</small></button>)}
        </div>
      </section>
      <div className="exchange-timeline"><span style={{ width: "50%" }}><b>EN</b><strong>{t("{n}분", { n: half })}</strong><small>{t("서준의 영어")}</small></span><span><b>KO</b><strong>{t("{n}분", { n: half })}</strong><small>{t("Maya의 한국어")}</small></span></div>
      <div className="exchange-features"><span><CheckCircle2 size={15} /> {t("턴 타이머")}</span><span><CheckCircle2 size={15} /> {t("실시간 메모")}</span><span><CheckCircle2 size={15} /> {t("종료 후 피드백")}</span></div>
      <div className="modal-footer">
        <button className="secondary-button" type="button" onClick={() => { onClose(); onToast(t("내일 오후 8시에 세션을 예약했어요")); }}><CalendarDays size={16} /> {t("예약하기")}</button>
        <button className="primary-button" type="button" onClick={() => { onClose(); onToast(t("{length}분 교환 세션을 시작했어요 · 타이머 데모", { length })); }}><Phone size={16} /> {t("지금 시작")}</button>
      </div>
    </div>
  );
}

function ReportModal({ target, onCancel, onConfirm }: { target: string; onCancel: () => void; onConfirm: () => void }) {
  const [reason, setReason] = useState("spam");
  return (
    <div className="report-content">
      <span className="report-icon"><ShieldCheck size={24} /></span>
      <h2>{t("안전하게 이용할 수 있도록 도와주세요")}</h2>
      <p><b>{target}</b>{t("을(를) 신고하거나 차단할 수 있어요. 신고 내용은 상대에게 알려지지 않습니다.")}</p>
      <div className="report-options">
        {[["spam", t("스팸 또는 광고")], ["dating", t("데이트·연애 목적")], ["harassment", t("괴롭힘 또는 혐오 표현")], ["privacy", t("개인정보 요구")], ["other", t("기타")]].map(([id, label]) => (
          <label key={id}>
            <input aria-label={label} type="radio" name="reason" value={id} checked={reason === id} onChange={() => setReason(id)} />
            <span>{label}</span><CheckCircle2 size={17} />
          </label>
        ))}
      </div>
      <label className="block-option">
        <input aria-label={t("이 사용자도 함께 차단")} type="checkbox" />
        <span><strong>{t("이 사용자도 함께 차단")}</strong><small>{t("프로필과 메시지가 서로 보이지 않아요.")}</small></span>
      </label>
      <div className="modal-footer"><button className="secondary-button" type="button" onClick={onCancel}>{t("취소")}</button><button className="danger-button" type="button" onClick={onConfirm}><Flag size={16} /> {t("신고 보내기")}</button></div>
    </div>
  );
}

function OnboardingModal({ onClose, onToast }: { onClose: () => void; onToast: (message: string) => void }) {
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState("conversation");
  const goals: Array<[string, LucideIcon, string, string]> = [
    ["conversation", MessageCircle, t("일상 대화"), t("자연스럽고 편하게 말하기")],
    ["career", Trophy, t("업무 · 커리어"), t("회의와 발표 자신감")],
    ["travel", Globe2, t("여행"), t("현지에서 바로 쓰기")],
    ["exam", BookOpenCheck, t("시험 · 자격"), t("정확한 문법과 어휘")],
  ];

  return (
    <div className="onboarding-content">
      <header>
        <button className="onboarding-brand" type="button"><span className="brand-mark"><Languages size={20} /></span><span className="brand-wordmark">Lingo<span>Loop</span></span></button>
        <span>STEP {step} / 3</span>
      </header>
      <div className="onboarding-progress"><i style={{ width: `${step * 33.333}%` }} /></div>

      {step === 1 ? (
        <section>
          <Pill tone="soft">LANGUAGE</Pill>
          <h2>{t("어떤 언어를 함께 나누고 싶나요?")}</h2>
          <p>{t("나중에 프로필에서 언제든 바꿀 수 있어요.")}</p>
          <div className="language-picker">
            <button className="selected" type="button"><span>🇰🇷</span><p><small>{t("내 모국어")}</small><strong>{t("한국어")}</strong></p><CheckCircle2 size={18} /></button>
            <button className="selected" type="button"><span>🇺🇸</span><p><small>{t("배울 언어")}</small><strong>{t("영어")}</strong></p><CheckCircle2 size={18} /></button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section>
          <Pill tone="soft">GOAL</Pill>
          <h2>{t("지금 가장 중요한 학습 목표는?")}</h2>
          <p>{t("추천 파트너와 연습 콘텐츠가 이 목표에 맞춰져요.")}</p>
          <div className="goal-picker">
            {goals.map(([id, GoalIcon, title, description]) => (
              <button className={goal === id ? "selected" : ""} type="button" key={id} onClick={() => setGoal(id)}>
                <GoalIcon size={19} /><span><strong>{title}</strong><small>{description}</small></span>{goal === id ? <CheckCircle2 size={18} /> : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section>
          <Pill tone="soft">YOUR RHYTHM</Pill>
          <h2>{t("언제, 어떻게 교정받고 싶나요?")}</h2>
          <p>{t("편안한 대화를 위한 기본 약속을 정해요.")}</p>
          <div className="rhythm-options">
            <button type="button"><Clock3 size={18} /><span><strong>{t("주 활동 시간")}</strong><small>{t("평일 저녁 7–10시")}</small></span><ChevronDown size={16} /></button>
            <button type="button"><PenLine size={18} /><span><strong>{t("교정 선호")}</strong><small>{t("대화 후 중요한 오류만")}</small></span><ChevronDown size={16} /></button>
            <label><ShieldCheck size={18} /><span><strong>{t("프로필 공개 범위")}</strong><small>{t("위치는 도시 수준까지만 공개")}</small></span><input aria-label={t("정밀 위치 숨기기")} type="checkbox" defaultChecked /><i className="toggle" /></label>
          </div>
        </section>
      ) : null}

      <footer>
        <button className="secondary-button" type="button" onClick={() => step === 1 ? onClose() : setStep(step - 1)}>{step === 1 ? t("나중에") : t("이전")}</button>
        <button className="primary-button" type="button" onClick={() => { if (step < 3) setStep(step + 1); else { onClose(); onToast(t("학습 목표를 업데이트했어요")); } }}>{step < 3 ? t("다음") : t("추천 시작")}<ChevronRight size={16} /></button>
      </footer>
    </div>
  );
}

/**
 * 언어 선택 — 설정 화면에 놓습니다.
 * 라벨은 각 언어를 그 언어로 적으므로 번역하지 않습니다.
 */
function LanguagePicker() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="profile-settings-link language-picker-row">
      <span className="setting-icon"><Languages size={17} /></span>
      <span>
        <strong>{t("표시 언어")}</strong>
        <small>{t("앱 화면에 쓰는 언어를 고릅니다")}</small>
      </span>
      <div className="choice-row language-choices">
        {LOCALES.map((code) => (
          <button
            key={code}
            type="button"
            lang={code}
            className={code === locale ? "active" : ""}
            aria-pressed={code === locale}
            onClick={() => setLocale(code)}
          >
            {LOCALE_LABEL[code]}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LingoLoopApp() {
  return (
    <I18nProvider>
      <LingoLoopScreens />
    </I18nProvider>
  );
}
