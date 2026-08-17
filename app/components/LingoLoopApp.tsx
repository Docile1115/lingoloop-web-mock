"use client";

import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowUp,
  BadgeCheck,
  Ban,
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
  Cloud,
  Compass,
  Download,
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
  Trash2,
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
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type Section = "discover" | "community" | "chats" | "practice" | "learn";
type ApiState = "checking" | "ready" | "fallback";

type MatchAvailability = "weekday-morning" | "weekday-evening" | "weekend-morning" | "weekend-evening";
type PartnerLevel = "any" | "beginner" | "intermediate" | "advanced";
type PartnerGender = "any" | "same" | "women" | "men";
type MatchIntent = "language-exchange" | "friendship" | "voice-practice" | "culture";
type DmScope = "matches" | "mutuals" | "anyone";

type MatchPreferences = {
  targetLanguages: string[];
  preferredCountries: string[];
  interests: string[];
  availability: MatchAvailability[];
  partnerLevel: PartnerLevel;
  partnerGender: PartnerGender;
  ageMin: number;
  ageMax: number;
  verifiedOnly: boolean;
  intents: MatchIntent[];
  onlineOnly: boolean;
};

type AppSettings = {
  dmRequests: boolean;
  hideLocation: boolean;
  correctionAlerts: boolean;
  autoSync: boolean;
  dmScope: DmScope;
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
  | null;

type ModalState =
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
  partnerGender: "any",
  ageMin: 20,
  ageMax: 35,
  verifiedOnly: true,
  intents: ["language-exchange", "friendship"],
  onlineOnly: false,
};

const languageLabels: Record<string, string> = { en: "영어", es: "스페인어", ja: "일본어" };
const countryLabels: Record<string, string> = { CA: "캐나다", US: "미국", GB: "영국", AU: "호주", ES: "스페인", JP: "일본" };
const interestLabels: Record<string, string> = { movies: "영화", travel: "여행", coffee: "카페", music: "음악", technology: "기술", cooking: "요리", books: "독서", running: "운동" };

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

const availabilityLabels: Record<MatchAvailability, string> = {
  "weekday-morning": "평일 아침",
  "weekday-evening": "평일 저녁",
  "weekend-morning": "주말 오전",
  "weekend-evening": "주말 저녁",
};

const levelLabels: Record<PartnerLevel, string> = {
  any: "레벨 무관",
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};

const genderLabels: Record<PartnerGender, string> = {
  any: "성별 무관",
  same: "같은 성별 우선",
  women: "여성",
  men: "남성",
};

const intentLabels: Record<MatchIntent, string> = {
  "language-exchange": "언어 교환",
  friendship: "친구 만들기",
  "voice-practice": "음성 연습",
  culture: "문화 교류",
};

const dailyMatchDetails: Record<string, { reasons: string[]; icebreaker: string }> = {
  maya: {
    reasons: ["영어 원어민", "평일 저녁 활동", "영화·카페 관심사"],
    icebreaker: "Hi Maya! What is the best movie you watched at a café lately?",
  },
  omar: {
    reasons: ["영어 원어민", "짧은 음성 연습", "기술 관심사"],
    icebreaker: "Hi Omar! What kind of game are you working on these days?",
  },
  lucas: {
    reasons: ["여행 목표 일치", "한국어 B1", "저녁 활동"],
    icebreaker: "Hi Lucas! Which Korean city is at the top of your travel list?",
  },
  aiko: {
    reasons: ["학습 리듬 일치", "디자인 관심사", "꼼꼼한 교정"],
    icebreaker: "Hi Aiko! What design detail inspired you this week?",
  },
  clara: {
    reasons: ["주말 활동", "문장 교정 선호", "문화 관심사"],
    icebreaker: "Hi Clara! Which museum would you recommend to a first-time visitor?",
  },
};

function fallbackConversationSupport(name: string): ConversationSupport {
  return {
    stage: "ongoing",
    topics: ["이번 주 가장 좋았던 순간", "서로의 도시에서 꼭 해볼 일", "최근 새로 배운 표현"],
    suggestedOpeners: [`Hi ${name}! What was the highlight of your week?`],
    followUpQuestions: ["What made it memorable?", "How would you say that in Korean?", "Would you recommend it to a friend?"],
    tip: "한 번에 질문 하나만 보내고, 상대 답변의 단어를 이어서 물으면 대화가 자연스러워져요.",
  };
}

function displayPartnerFromApi(partner: MatchingApiPartner, score: number, index: number): Partner {
  const localId = partner.id.replace(/^user-/, "");
  const existing = partners.find((item) => item.id === localId || item.name === partner.name);
  if (existing) {
    return {
      ...existing,
      flag: partner.country.flag,
      compatibility: score,
    };
  }

  const accents: Accent[] = ["violet", "coral", "mint", "amber", "blue", "rose"];
  const learning = partner.learningLanguages[0];
  const languageNames: Record<string, string> = { ...languageLabels, ko: "한국어", fr: "프랑스어", de: "독일어" };
  const levelNames: Record<string, string> = { beginner: "A1–A2", intermediate: "B1–B2", advanced: "C1+" };

  return {
    id: localId,
    name: partner.name,
    handle: partner.handle,
    flag: partner.country.flag,
    city: partner.country.name,
    country: partner.country.name,
    timeOffset: 0,
    native: partner.nativeLanguages.map((code) => languageNames[code] ?? code.toUpperCase()).join(" · "),
    learning: languageNames[learning?.code ?? "ko"] ?? "한국어",
    level: levelNames[learning?.level ?? "intermediate"] ?? learning?.level ?? "B1",
    interests: partner.interests.slice(0, 3).map((item) => interestLabels[item] ?? item),
    bio: partner.bio,
    online: partner.status === "online",
    compatibility: score,
    accent: accents[index % accents.length],
    goal: learning?.goal ?? "부담 없는 일상 대화",
    activeTime: "내가 선택한 시간대와 겹쳐요",
    balance: `응답률 ${partner.responseRate ?? 90}%`,
    verified: partner.verified,
  };
}

function fallbackDailyRecommendations(): DailyMatchRecommendation[] {
  return partners.slice(0, MAX_DAILY_PARTNERS).map((partner, index) => ({
    partner,
    score: Math.max(partner.compatibility, 82 - index),
    matchReasons: dailyMatchDetails[partner.id]?.reasons ?? [partner.goal, partner.activeTime, partner.verified ? "인증 프로필" : "공통 관심사"],
    icebreaker: dailyMatchDetails[partner.id]?.icebreaker ?? `Hi ${partner.name}! What would you like to practice today?`,
  }));
}

const navItems: Array<{
  id: Section;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
}> = [
  { id: "discover", label: "파트너", shortLabel: "파트너", icon: Compass, description: "나와 잘 맞는 언어 파트너를 찾아보세요" },
  { id: "community", label: "커뮤니티", shortLabel: "피드", icon: UsersRound, description: "짧은 글과 교정을 빠르게 확인하세요" },
  { id: "chats", label: "대화", shortLabel: "대화", icon: MessageCircle, description: "대화 속에서 바로 배우고 복습하세요" },
  { id: "practice", label: "보이스룸", shortLabel: "연습", icon: Radio, description: "보이스룸을 만들거나 바로 참여하세요" },
  { id: "learn", label: "프로필", shortLabel: "프로필", icon: User, description: "내 글과 학습 기록을 확인하세요" },
];

/** 하루에 제시하는 파트너 최대 인원. */
const MAX_DAILY_PARTNERS = 12;

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
  const ampm = h < 12 ? "오전" : "오후";
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

export default function LingoLoopApp() {
  const [section, setSection] = useState<Section>("discover");
  const [modal, setModal] = useState<ModalState>(null);
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts);
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [selectedChatId, setSelectedChatId] = useState(initialConversations[0].id);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [conversationDrafts, setConversationDrafts] = useState<Record<string, string>>({});
  const [requestConversationIds, setRequestConversationIds] = useState<Set<string>>(() => new Set(["chat-aiko"]));
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
  const [settings, setSettings] = useState<AppSettings>({ dmRequests: true, hideLocation: true, correctionAlerts: true, autoSync: true, dmScope: "matches" });
  const [matchPreferences, setMatchPreferences] = useState<MatchPreferences>(defaultMatchPreferences);
  const [dailyRecommendations, setDailyRecommendations] = useState<DailyMatchRecommendation[]>(fallbackDailyRecommendations);
  const [detail, setDetail] = useState<DetailRoute>(null);
  const [partnerIndex, setPartnerIndex] = useState(0);
  const [signaledPartners, setSignaledPartners] = useState<string[]>([]);
  const [practiceRooms, setPracticeRooms] = useState<PracticeRoom[]>(rooms);
  const toastTimer = useRef<number | null>(null);

  const selectedConversation = conversations.find((item) => item.id === selectedChatId) ?? conversations[0];
  const draft = selectedConversation ? conversationDrafts[selectedConversation.id] ?? "" : "";
  const setDraft = (text: string) => {
    if (!selectedConversation) return;
    setConversationDrafts((current) => ({ ...current, [selectedConversation.id]: text }));
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
      partnerGender: matchPreferences.partnerGender,
      ageMin: String(matchPreferences.ageMin),
      ageMax: String(matchPreferences.ageMax),
      verifiedOnly: String(matchPreferences.verifiedOnly),
      intents: matchPreferences.intents.join(","),
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
        const saved = window.localStorage.getItem("lingoloop-match-preferences");
        if (!saved) return;
        const parsed = JSON.parse(saved) as Partial<MatchPreferences>;
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
      showToast("매칭 설정을 저장했어요 · 오늘의 파트너에 바로 반영돼요");
    } catch {
      showToast("매칭 설정을 이 기기에 저장했어요 · 오프라인 데모");
    }
  };

  const skipPartner = () => {
    setPartnerIndex((current) => current + 1);
    showToast("다음 사람을 보여드릴게요");
  };

  const signalPartner = (partner: Partner) => {
    setSignaledPartners((current) => (current.includes(partner.id) ? current : [...current, partner.id]));
    setPartnerIndex((current) => current + 1);
    showToast(`${partner.name}님에게 마음을 보냈어요`);
  };

  const restartPartners = () => {
    setPartnerIndex(0);
    showToast("처음부터 다시 볼게요");
  };

  const resetViewScroll = () => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.querySelector<HTMLElement>(".main-content")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  };

  const openPost = (post: FeedPost) => {
    setDetail({ kind: "post", post });
    window.history.pushState(null, "", `#${section}/post/${post.id}`);
    resetViewScroll();
  };

  const openProfile = (partner: Partner) => {
    setDetail({ kind: "profile", partner });
    window.history.pushState(null, "", `#${section}/user/${partner.id}`);
    resetViewScroll();
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
    resetViewScroll();
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
    showToast(key === "liked" ? "좋아요를 눌렀어요" : "복습함에 저장했어요");
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
      setRequestConversationIds((current) => {
        if (!current.has(existing.id)) return current;
        const next = new Set(current);
        next.delete(existing.id);
        return next;
      });
    } else {
      const next: Conversation = {
        id: `chat-${partner.id}`,
        partnerId: partner.id,
        name: partner.name,
        flag: partner.flag,
        accent: partner.accent,
        preview: "새로운 연습 제안을 보내보세요",
        time: "지금",
        unread: 0,
        online: partner.online,
        messages: [
          {
            id: `welcome-${partner.id}`,
            mine: false,
            system: true,
            text: `${partner.name}님과 언어 교환을 시작했어요. 친절하고 안전한 대화를 만들어주세요.`,
            time: "지금",
          },
        ],
      };
      setConversations((items) => [next, ...items]);
      setSelectedChatId(next.id);
      setConversationDrafts((current) => ({
        ...current,
        [next.id]: dailyRecommendations.find((item) => item.partner.id === partner.id)?.icebreaker ?? dailyMatchDetails[partner.id]?.icebreaker ?? `Hi ${partner.name}! Nice to meet you.`,
      }));
    }
    setSection("chats");
    setMobileThreadOpen(true);
    setModal(null);
    showToast(`${partner.name}님과 대화를 열었어요`);
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !selectedConversation) return;

    const newMessage = { id: `local-${Date.now()}`, mine: true, text, time: "지금" };
    setConversations((items) =>
      items.map((conversation) =>
        conversation.id === selectedConversation.id
          ? { ...conversation, preview: text, time: "지금", messages: [...conversation.messages, newMessage] }
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
      showToast("메시지를 보냈어요 · mock API 동기화 완료");
    } catch {
      showToast("메시지를 기기에 저장했어요 · 오프라인 데모");
    }
  };

  const acceptChatRequest = (id: string) => {
    setRequestConversationIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const dismissChatRequest = (id: string) => {
    const remaining = conversations.filter((conversation) => conversation.id !== id);
    setRequestConversationIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setConversations(remaining);
    setConversationDrafts((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    if (selectedChatId === id) {
      setSelectedChatId(remaining[0]?.id ?? "");
      setMobileThreadOpen(false);
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
      time: "방금",
      language: "영어",
      level: currentUser.level,
      text,
      translation: "이 게시물은 데모 번역을 요청하면 한국어로 표시됩니다.",
      tags: ["#오늘의연습", "#영어"],
      likes: 0,
      comments: 0,
      corrections: 0,
    };
    setPosts((items) => [post, ...items]);
    setModal(null);
    setSection("community");
    showToast("커뮤니티에 게시했어요");
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
    showToast("보이스룸을 만들었어요 · mock room");
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
          details: "UI 프로토타입에서 제출한 데모 신고입니다.",
        }),
      });
      if (!response.ok) throw new Error(`Mock API returned ${response.status}`);
    } catch {
      showToast("신고를 기기에 임시 저장했어요 · 오프라인 데모");
      setModal(null);
      return;
    }
    setModal(null);
    showToast("신고가 접수되었어요 · 상대에게 알리지 않아요");
  };

  return (
    <div className={`app-root section-${section}`}>
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <aside className="desktop-sidebar" aria-label="주요 메뉴">
        <button className="brand" type="button" onClick={() => goToSection("discover")} aria-label="LingoLoop 홈">
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
                  <span>{item.label}</span>
                  {item.id === "chats" ? <span className="nav-count">7</span> : null}
                </button>
              );
            })}
          </div>

          {/* 그룹 2 — 액션 */}
          <div className="nav-group">
            <button type="button" onClick={() => setModal({ type: "compose" })}>
              <PenLine size={20} />
              <span>글쓰기</span>
            </button>
            <button type="button" onClick={() => setModal({ type: "search" })}>
              <Search size={20} />
              <span>검색</span>
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
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="sidebar-spacer" />
        <span className={`api-indicator api-${apiState}`} title="mock API 상태">
          <span />{apiState === "ready" ? "Mock API 연결됨" : apiState === "checking" ? "연결 확인 중" : "오프라인 데모"}
        </span>
        <button className="sidebar-profile" type="button" onClick={() => goToSection("learn")}>
          <Avatar name={currentUser.name} flag={currentUser.flag} accent="violet" size="sm" online />
          <span><strong>{currentUser.name}</strong><small>{currentUser.native} → {currentUser.learning}</small></span>
          <MoreHorizontal size={18} />
        </button>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button className="mobile-brand" type="button" onClick={() => goToSection("discover")} aria-label="LingoLoop 홈">
            <span className="brand-mark"><Languages size={20} /></span>
            <span className="brand-wordmark">Lingo<span>Loop</span></span>
          </button>
          <div className="topbar-actions">
            {section === "community" ? <IconButton label="글쓰기" icon={PenLine} className="top-compose-button" onClick={() => setModal({ type: "compose" })} /> : null}
            <IconButton label="검색" icon={Search} onClick={() => setModal({ type: "search" })} />
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
                  else showToast("이 작성자의 프로필은 아직 준비 중이에요");
                }}
                onReport={() => setModal({ type: "report", target: detail.post.author })}
                onToast={showToast}
              />
            ) : null}

            {detail?.kind === "profile" ? (
              <ProfileDetailView
                partner={detail.partner}
                onBack={closeDetail}
                onStartChat={(partner) => { closeDetail(); startChat(partner); }}
                onReport={() => setModal({ type: "report", target: detail.partner.name })}
                onToast={showToast}
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
              />
            ) : null}
            {!detail && section === "chats" ? (
              <ChatsView
                conversations={conversations}
                selected={selectedConversation}
                mobileThreadOpen={mobileThreadOpen}
                requestIds={requestConversationIds}
                onSelect={(id) => {
                  setSelectedChatId(id);
                  setMobileThreadOpen(true);
                }}
                onBack={() => setMobileThreadOpen(false)}
                onAcceptRequest={acceptChatRequest}
                onDismissRequest={dismissChatRequest}
                draft={draft}
                setDraft={setDraft}
                onSend={sendMessage}
                onExchange={() => setModal({ type: "exchange" })}
                onProfile={() => {
                  const partner = partners.find((item) => item.id === selectedConversation?.partnerId);
                  if (partner) openProfile(partner);
                  else showToast("그룹 정보 패널을 열었어요");
                }}
                onReport={() => setModal({ type: "report", target: selectedConversation?.name ?? "대화" })}
                onToast={showToast}
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
              />
            ) : null}
          </main>

        </div>
      </div>

      <nav className="mobile-nav" aria-label="모바일 주요 메뉴">
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
              <small>{item.shortLabel}</small>
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
          onAcceptLike={(partner) => { setModal(null); startChat(partner); showToast(`${partner.name}님과 대화가 열렸어요`); }}
        />
      ) : null}

      {minimizedRoom && !modal ? (
        <MiniRoom
          room={minimizedRoom}
          handRaised={roomHandRaised}
          micOn={roomMicOn}
          onExpand={() => { setModal({ type: "room", room: minimizedRoom }); setMinimizedRoom(null); }}
          onLeave={() => { setMinimizedRoom(null); setRoomHandRaised(false); setRoomMicOn(false); showToast("보이스룸에서 나갔어요"); }}
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
          aria-label={`${partner.name} 프로필 보기`}
        >
          <Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="xl" online={partner.online} />
          <div>
            <span><h2>{partner.name}</h2>{partner.verified ? <BadgeCheck size={17} className="verified" aria-label="인증됨" /> : null}</span>
            <p>{partner.flag} {partner.country} · {partner.city}</p>
            <small className={partner.online ? "is-online" : ""}>
              {partner.online ? "지금 접속 중" : "오늘 접속함"}{localTime ? ` · 현지 ${localTime}` : ""}
            </small>
          </div>
          <span className="match-score"><strong>{match.score}%</strong><small>잘 맞아요</small></span>
        </button>

        {/* ② 언어 교환 — 무엇을 주고받는지 */}
        <div className="match-langs">
          <span className="match-lang give">
            <small>가르쳐줘요</small>
            <strong>{partner.native}</strong>
            <em>원어민</em>
          </span>
          <span className="match-lang-arrow"><ArrowLeftRight size={16} /></span>
          <span className="match-lang take">
            <small>배우고 있어요</small>
            <strong>{partner.learning}</strong>
            <em>{partner.level}</em>
          </span>
        </div>

        <div className="match-reasons">
          {match.matchReasons.slice(0, 3).map((reason) => <span key={reason}><Check size={12} /> {reason}</span>)}
        </div>

    </article>
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
      <button type="button" className="detail-back" onClick={onBack} aria-label="뒤로">
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
}: {
  post: FeedPost;
  onBack: () => void;
  onProfile: (authorId: string) => void;
  onReport: () => void;
  onToast: (message: string) => void;
}) {
  const [replies, setReplies] = useState<PostReply[]>(postReplies[post.id] ?? []);
  const [draft, setDraft] = useState("");
  const [liked, setLiked] = useState(Boolean(post.liked));
  const [likedReplies, setLikedReplies] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<{ id: string; author: string } | null>(null);
  const [replyKind, setReplyKind] = useState<"reply" | "correction">("reply");
  const [correctionSource, setCorrectionSource] = useState<string | null>(null);
  const replyInputRef = useRef<HTMLTextAreaElement | null>(null);

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
    const text = draft.trim();
    if (!text) return;
    if (replyKind === "correction" && text === correctionSource?.trim()) {
      onToast("원문에서 고친 부분이 없어요");
      return;
    }
    const mine: PostReply = {
      id: `local-${Date.now()}`,
      author: currentUser.name,
      handle: currentUser.handle,
      flag: currentUser.flag,
      accent: currentUser.accent,
      time: "방금",
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
    onToast(replyKind === "correction" ? "교정을 남겼어요" : "답글을 남겼어요");
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
          {reply.kind === "correction" ? <span className="reply-kind-badge"><PenLine size={12} /> 교정</span> : null}
          <span className="thread-meta">{reply.time}</span>
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
            aria-label="답글 좋아요"
          >
            <Heart size={15} /> {reply.likes + (likedReplies.has(reply.id) ? 1 : 0) || ""}
          </button>
          {!isChild ? (
            <button type="button" onClick={() => startReplyTo(reply)}>
              <MessageCircle size={15} /> 답글
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
      <DetailHeader title="게시물" onBack={onBack} />

      <article className="thread-item">
        <div className="thread-gutter">
          <button type="button" className="thread-avatar" onClick={() => onProfile(post.authorId)} aria-label={`${post.author} 프로필`}>
            <Avatar name={post.author} flag={post.flag} accent={post.accent} size="sm" />
          </button>
        </div>
        <div className="thread-body">
          <div className="thread-head">
            <button type="button" className="thread-author" onClick={() => onProfile(post.authorId)}>{post.author}</button>
            <span className="thread-meta">{post.time}</span>
            <span className="thread-meta">{post.language} · {post.level}</span>
            <span className="thread-spacer" />
            <MenuPopover
              label="게시물 메뉴"
              items={[
                { id: "link", label: "링크 복사", icon: LinkIcon, onSelect: () => onToast("링크를 복사했어요") },
                { id: "save", label: "복습에 저장", icon: Bookmark, onSelect: () => onToast("복습함에 저장했어요") },
                { id: "mute", label: "이 사용자 글 그만 보기", icon: EyeOff, onSelect: () => onToast(`${post.author}님의 글을 숨겼어요`) },
                { id: "block", label: "차단하기", icon: Ban, danger: true, onSelect: () => onToast(`${post.author}님을 차단했어요`) },
                { id: "report", label: "신고하기", icon: Flag, danger: true, onSelect: onReport },
              ]}
            />
          </div>

          <p className="thread-text">{post.text}</p>
          <p className="post-detail-translation"><Languages size={15} /> {post.translation}</p>

          <div className="post-tags">
            {post.tags.map((tag) => (
              <button type="button" key={tag} onClick={() => onToast(`${tag} 주제를 열었어요`)}>{tag}</button>
            ))}
          </div>

          <div className="post-actions detail-actions">
            <button type="button" className={liked ? "like active" : "like"} onClick={() => { setLiked((v) => !v); onToast(liked ? "좋아요를 취소했어요" : "응원을 보냈어요"); }}>
              <Heart size={19} /> {post.likes + (liked && !post.liked ? 1 : 0)}
            </button>
            <button type="button" onClick={() => document.getElementById("reply-input")?.focus()}>
              <MessageCircle size={18} /> {post.comments + replies.length - (postReplies[post.id]?.length ?? 0)}
            </button>
            <button type="button" className="correct" onClick={() => onToast("교정 모드를 열었어요")}>
              <PenLine size={18} /> 교정 {post.corrections}
            </button>
            <button type="button" onClick={() => onToast("게시물을 공유했어요")}><Send size={18} /></button>
          </div>
        </div>
      </article>

      <div className="reply-composer">
        {replyTo ? (
          <span className="reply-target">
            {replyTo.author}님에게
            <button type="button" onClick={() => setReplyTo(null)} aria-label="대댓글 취소"><X size={13} /></button>
          </span>
        ) : (
          <Avatar name={currentUser.name} flag={currentUser.flag} accent={currentUser.accent} size="sm" />
        )}
        <textarea
          id="reply-input"
          ref={replyInputRef}
          rows={1}
          placeholder={replyKind === "correction" ? "교정할 문장을 고쳐서 적어주세요" : replyTo ? `${replyTo.author}님에게 답글 남기기` : `${post.author}님에게 답글 남기기`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submitReply();
            }
          }}
        />
        <div className="reply-kind-toggle" role="radiogroup" aria-label="답글 종류">
          <button
            type="button"
            role="radio"
            aria-checked={replyKind === "reply"}
            className={replyKind === "reply" ? "on" : ""}
            title="일반 답글"
            onClick={exitCorrectionMode}
          >
            <MessageCircle size={15} />
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={replyKind === "correction"}
            className={replyKind === "correction" ? "on correction" : ""}
            title="교정 남기기"
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
          aria-label={replyKind === "correction" ? "교정 남기기" : "답글 남기기"}
          title={replyKind === "correction" ? "교정 남기기" : "답글 남기기"}
        >
          <ArrowUp size={18} strokeWidth={2.4} />
        </button>
      </div>

      <div className="replies-head">
        <strong>답글</strong>
        <button type="button" onClick={() => onToast("정렬 기준을 변경했어요")}>인기순 <ChevronDown size={14} /></button>
      </div>

      {replies.length === 0 ? (
        <p className="replies-empty">아직 답글이 없습니다</p>
      ) : (
        replies.map((reply) => renderReply(reply, false))
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
  onToast,
}: {
  partner: Partner;
  onBack: () => void;
  onStartChat: (partner: Partner) => void;
  onReport: () => void;
  onToast: (message: string) => void;
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
        <span><strong>{partner.compatibility}%</strong> 교환 궁합</span>
        <span><strong>{partner.native}</strong> 원어민</span>
        <span><strong>{partner.learning}</strong> {partner.level}</span>
      </div>

      <div className="profile-head-actions">
        <button className="primary-button" type="button" onClick={() => onStartChat(partner)}>
          <MessageCircle size={16} /> 대화 시작
        </button>
        <button className="secondary-button" type="button" onClick={() => onToast("관심 파트너로 저장했어요")}>
          <Star size={16} /> 저장
        </button>
        <button className="secondary-button" type="button" onClick={onReport}>
          <Flag size={16} /> 신고
        </button>
      </div>

      <section className="profile-detail-section">
        <h3>언어 교환</h3>
        <div className="profile-language-grid">
          <span><small>가르칠 수 있어요</small><strong>{partner.flag} {partner.native}</strong><em>원어민</em></span>
          <span><small>배우고 있어요</small><strong>🇰🇷 {partner.learning}</strong><em>{partner.level}</em></span>
        </div>
      </section>

      <section className="profile-detail-section">
        <h3>관심사</h3>
        <div className="interest-row large">{partner.interests.map((item) => <span key={item}>{item}</span>)}</div>
      </section>

      <section className="profile-detail-section">
        <h3>잘 맞는 이유</h3>
        <p className="profile-detail-row"><Clock3 size={16} /><span><strong>활동 시간</strong><small>{partner.activeTime}</small></span></p>
        <p className="profile-detail-row"><Trophy size={16} /><span><strong>학습 목표</strong><small>{partner.goal}</small></span></p>
      </section>
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
  const queue = [...dailyRecommendations, ...fallbackDailyRecommendations()]
    .filter((item, index, list) => list.findIndex((candidate) => candidate.partner.id === item.partner.id) === index)
    .slice(0, MAX_DAILY_PARTNERS);
  const total = queue.length;
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
            <h1>오늘의 파트너</h1>
            <p>오늘은 여기까지예요.</p>
          </div>
          <button className="secondary-button" type="button" onClick={onFilters}><SlidersHorizontal size={16} /> 조건 바꾸기</button>
        </header>

        <section className="partners-exhausted">
          <span className="partners-exhausted-icon"><CalendarDays size={32} strokeWidth={1.6} /></span>
          <strong>오늘 만날 사람을 다 봤어요</strong>
          <p>
            오늘 {total}명을 모두 확인했어요
            {signaledCount > 0 ? ` · ${signaledCount}명에게 신호를 보냈어요` : ""}.
            <br />
            내일 오전 9시에 새로운 파트너를 추천해드릴게요.
          </p>
          <div className="partners-exhausted-actions">
            <button className="primary-button" type="button" onClick={onFilters}><SlidersHorizontal size={16} /> 조건 바꾸기</button>
            <button className="secondary-button" type="button" onClick={onRestart}><RotateCcw size={16} /> 처음부터 다시</button>
          </div>
        </section>
      </div>
    );
  }
  const targetLanguage = languageLabels[preferences.targetLanguages[0] ?? "en"] ?? "영어";
  // 내가 건 조건 — 카드가 아니라 헤더에 둡니다 (상대 정보와 섞이지 않게)
  const myFilters = [
    targetLanguage,
    genderLabels[preferences.partnerGender],
    `${preferences.ageMin}–${preferences.ageMax}세`,
    preferences.interests.slice(0, 2).map((item) => interestLabels[item] ?? item).join(" · "),
    availabilityLabels[preferences.availability[0] ?? "weekday-evening"],
  ].filter(Boolean).join(" · ");

  return (
    <div className="view discover-view compact-discover">
      <header className="simple-view-header partner-view-header">
        <div>
          <h1>오늘의 파트너</h1>
          <p>
            {myFilters} ·{" "}
            <button type="button" className="link-underline" onClick={onOpenList}>
              오늘 {total}명 중 {index + 1}번째
            </button>
          </p>
        </div>
        <div className="partner-header-actions">
          <button className="secondary-button likes-entry" type="button" onClick={onOpenLikes}>
            <Heart size={16} /> 받은 마음
            {receivedCount > 0 ? <i>{receivedCount}</i> : null}
          </button>
          <button className="secondary-button" type="button" onClick={onFilters}><SlidersHorizontal size={16} /> 조건 바꾸기</button>
        </div>
      </header>

      <div className="beta-access-note">
        <Sparkles size={17} />
        <span><strong>오픈 베타 · 오늘 추천과 기본 번역 무료</strong><small>조건에 맞는 {total}명을 모두 확인하고 직접 대화 상대를 선택하세요 · 마음 {signaledCount}명</small></span>
        <Pill tone="success">{Math.min(index + 1, total)} / {total}</Pill>
      </div>

      <div className="partner-arena">
        <button
          type="button"
          className="swipe-button skip"
          onClick={handleSkip}
          aria-label="다음 사람 보기"
          title="다음"
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
          aria-label="대화하고 싶어요"
          title="대화하고 싶어요"
        >
          <Heart size={30} strokeWidth={2.4} />
        </button>
      </div>

      <div className="partner-progress" aria-label={`${total}명 중 ${index + 1}번째`}>
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
}: {
  posts: FeedPost[];
  tab: "recommended" | "learning" | "following";
  setTab: (value: "recommended" | "learning" | "following") => void;
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
      <div className="translation-access-note"><Languages size={17} /><span><strong>기본 번역은 무료예요</strong><small>언어 장벽 없이 피드를 읽을 수 있도록 베타 기간 이후에도 기본 번역은 열어둘 계획이에요.</small></span><Pill tone="success">FREE</Pill></div>
      <div className="community-toolbar">
        <div className="segmented-tabs" role="tablist" aria-label="커뮤니티 피드">
          <button type="button" role="tab" aria-selected={tab === "recommended"} className={tab === "recommended" ? "active" : ""} onClick={() => setTab("recommended")}>추천</button>
          <button type="button" role="tab" aria-selected={tab === "learning"} className={tab === "learning" ? "active" : ""} onClick={() => setTab("learning")}>영어</button>
          <button type="button" role="tab" aria-selected={tab === "following"} className={tab === "following" ? "active" : ""} onClick={() => setTab("following")}>팔로잉</button>
        </div>

      </div>

      <div className="feed-grid">
        {visible.map((post) => (
            <article className="feed-post" key={post.id}>
              <header className="post-header">
                <button className="post-author" type="button" onClick={() => onProfile(post.authorId)}>
                  <Avatar name={post.author} flag={post.flag} accent={post.accent} size="sm" online={post.authorId === "maya"} />
                  <span><strong>{post.author}{post.authorId === "maya" ? <BadgeCheck size={14} className="verified" /> : null}</strong><small>{post.handle} · {post.time}</small></span>
                </button>
                <div className="post-meta">
                  <Pill tone="language">{post.language} · {post.level}</Pill>
                  <MenuPopover
                    label="게시물 메뉴"
                    items={[
                      { id: "link", label: "링크 복사", icon: LinkIcon, onSelect: () => onToast("링크를 복사했어요") },
                      { id: "save", label: "복습에 저장", icon: Bookmark, onSelect: () => onToast("복습함에 저장했어요") },
                      { id: "mute", label: "이 사용자 글 그만 보기", icon: EyeOff, onSelect: () => onToast(`${post.author}님의 글을 숨겼어요`) },
                      { id: "report", label: "신고하기", icon: Flag, danger: true, onSelect: () => onReport(post.author) },
                    ]}
                  />
                </div>
              </header>
              <button className="post-copy-open" type="button" onClick={() => onOpen(post)} aria-label={`${post.author}님의 게시물 열기`}>
                <span className="post-copy">{post.text}</span>
              </button>
              {translated.has(post.id) ? <div className="translation-box"><Languages size={16} /><p><span>데모 번역</span>{post.translation}</p></div> : null}
              <div className="post-tags">{post.tags.map((tag) => <button type="button" key={tag} onClick={() => onToast(`${tag} 주제를 팔로우했어요`)}>{tag}</button>)}</div>
              {post.visual ? (
                <div className={`post-visual visual-${post.accent}`}>
                  <span className="visual-grid" />
                  <span className="visual-emoji">{post.visual.emoji}</span>
                  <span className="visual-copy"><small>{post.visual.eyebrow}</small><strong>{post.visual.title}</strong><em>{post.visual.caption}</em></span>
                </div>
              ) : null}
              {post.correction && corrections.has(post.id) ? (
                <div className="correction-card">
                  <header><span><WandSparkles size={16} /> 문장 교정</span><small>Jisoo 🇰🇷 · 2분 전</small></header>
                  <p className="before"><span>–</span>{post.correction.original}</p>
                  <p className="after"><span>+</span>{post.correction.fixed}</p>
                  <div className="correction-note"><BookOpenCheck size={15} /> {post.correction.note}</div>
                  <button type="button" onClick={() => onToast("복습함에 저장했어요")}><Bookmark size={14} /> 복습에 저장</button>
                </div>
              ) : null}
              <footer className="post-actions">
                <button className={post.liked ? "active like" : ""} type="button" onClick={() => onToggle(post.id, "liked")}><Heart size={18} fill={post.liked ? "currentColor" : "none"} /> {post.likes}</button>
                <button type="button" onClick={() => onToast("댓글 패널을 열었어요")}><MessageCircle size={18} /> {post.comments}</button>
                <button className={corrections.has(post.id) ? "active correct" : ""} type="button" onClick={() => onCorrection(post.id)}><PenLine size={18} /> 교정 {post.corrections}</button>
                <button className={translated.has(post.id) ? "active" : ""} type="button" onClick={() => onTranslate(post.id)}><Languages size={18} /> 번역</button>
                <button className={post.saved ? "active save" : "post-save"} type="button" aria-label="저장" onClick={() => onToggle(post.id, "saved")}><Bookmark size={18} fill={post.saved ? "currentColor" : "none"} /></button>
              </footer>
          </article>
        ))}
      </div>

      {hasMore ? (
        <div className="feed-sentinel" ref={sentinel} aria-hidden="true">
          <span className="feed-spinner" />
        </div>
      ) : (
        <p className="feed-end">모든 글을 확인했어요 · {filteredPosts.length}개</p>
      )}
    </div>
  );
}

function ChatsView({
  conversations,
  selected,
  mobileThreadOpen,
  requestIds,
  onSelect,
  onBack,
  onAcceptRequest,
  onDismissRequest,
  draft,
  setDraft,
  onSend,
  onExchange,
  onProfile,
  onReport,
  onToast,
}: {
  conversations: Conversation[];
  selected: Conversation;
  mobileThreadOpen: boolean;
  requestIds: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onBack: () => void;
  onAcceptRequest: (id: string) => void;
  onDismissRequest: (id: string) => void;
  draft: string;
  setDraft: (text: string) => void;
  onSend: (event: FormEvent<HTMLFormElement>) => void;
  onExchange: () => void;
  onProfile: () => void;
  onReport: () => void;
  onToast: (message: string) => void;
}) {
  const [listTab, setListTab] = useState<"inbox" | "turn" | "requests">("inbox");
  const [translatedMessages, setTranslatedMessages] = useState<Set<string>>(new Set(["m1"]));
  const [coachOpen, setCoachOpen] = useState(true);
  const [coachLoading, setCoachLoading] = useState(false);
  const [supportResult, setSupportResult] = useState<{ conversationId: string; data: ConversationSupport } | null>(null);
  const conversationSupport = supportResult?.conversationId === selected.id ? supportResult.data : fallbackConversationSupport(selected.name);
  const filtered = conversations.filter((item) => listTab === "turn" ? item.myTurn && !requestIds.has(item.id) : listTab === "requests" ? requestIds.has(item.id) : !requestIds.has(item.id));
  const selectedIsRequest = requestIds.has(selected.id);
  const acceptRequest = (id: string, name: string) => {
    onAcceptRequest(id);
    setListTab("inbox");
    onToast(`${name}님의 요청을 수락했어요`);
  };
  const removeRequest = (id: string, name: string) => {
    onDismissRequest(id);
    onToast(`${name}님의 요청을 삭제했어요 · 상대에게 알리지 않아요`);
  };

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
        onToast("대화 코치가 문장을 자연스럽게 다듬었어요");
      } else {
        onToast("지금 대화에 맞는 주제를 새로 추천했어요");
      }
    } catch {
      const fallback = fallbackConversationSupport(selected.name);
      const improvedDraft = draft.trim() ? `${draft.trim()} I’d love to hear more about it!` : undefined;
      setSupportResult({ conversationId: selected.id, data: { ...fallback, improvedDraft } });
      if (polishDraft && improvedDraft) setDraft(improvedDraft);
      onToast("준비된 대화 코칭 예시를 보여드려요 · 오프라인 데모");
    } finally {
      setCoachLoading(false);
    }
  };

  return (
    <div className={`chat-shell ${mobileThreadOpen ? "mobile-thread-open" : ""}`}>
      <section className="conversation-panel">
        <header className="conversation-title">
          <div><h1>대화</h1><Pill tone="soft">7 unread</Pill></div>
          <IconButton label="새 대화" icon={PenLine} onClick={() => onToast("파트너 검색에서 새 대화를 시작해보세요")} />
        </header>
        <div className="chat-sync-note"><Cloud size={15} /><span><strong>실서비스 설계 · 서버 자동 동기화</strong><small>출시 버전에서는 앱을 삭제하거나 기기를 바꿔도 로그인하면 복원돼요. 현재는 mock입니다.</small></span><Pill tone="soft">DEMO</Pill></div>
        <label className="chat-search"><Search size={16} /><input type="search" placeholder="이름 또는 대화 검색" /></label>
        <div className="chat-list-tabs">
          <button type="button" className={listTab === "inbox" ? "active" : ""} onClick={() => setListTab("inbox")}>매칭 · 맞팔</button>
          <button type="button" className={listTab === "turn" ? "active" : ""} onClick={() => setListTab("turn")}>내 차례 <span>4</span></button>
          <button type="button" className={listTab === "requests" ? "active" : ""} onClick={() => setListTab("requests")}>요청함 <span>{requestIds.size}</span></button>
        </div>
        <div className="conversation-list">
          {filtered.map((conversation) => (
            <div className="conversation-entry" key={conversation.id}>
              <button
                type="button"
                className={`conversation-item ${selected.id === conversation.id ? "active" : ""}`}
                onClick={() => onSelect(conversation.id)}
              >
                <Avatar name={conversation.name} flag={conversation.flag} accent={conversation.accent} size="sm" online={conversation.online} />
                <span className="conversation-copy">
                  <span className="conversation-name"><strong>{conversation.name}</strong><small>{conversation.time}</small></span>
                  <span className={conversation.typing ? "typing" : ""}>{conversation.typing ? "입력 중…" : conversation.preview}</span>
                  <span className="conversation-labels">
                    {listTab === "requests" ? <i>새 메시지 요청</i> : <i><ShieldCheck size={10} /> {conversation.group ? "그룹" : "매칭됨"}</i>}
                    {conversation.myTurn ? <i>내 차례</i> : null}
                    {conversation.group ? <i className="group-label"><Users size={11} /> 그룹</i> : null}
                    {conversation.muted ? <i>알림 끔</i> : null}
                  </span>
                </span>
                {conversation.unread ? <span className="unread-count">{conversation.unread}</span> : null}
              </button>
              {listTab === "requests" ? <div className="request-actions"><button type="button" onClick={() => removeRequest(conversation.id, conversation.name)}>삭제</button><button type="button" onClick={() => acceptRequest(conversation.id, conversation.name)}>수락</button></div> : null}
            </div>
          ))}
          {listTab === "requests" && !filtered.length ? <div className="empty-search"><ShieldCheck size={26} /><strong>새 메시지 요청이 없어요</strong><p>매칭되지 않았거나 맞팔이 아닌 사람의 DM은 여기에 모여요.</p></div> : null}
        </div>
      </section>

      <section className="chat-thread" aria-label={`${selected.name}님과의 대화`}>
        <header className="thread-header">
          <button className="mobile-back" type="button" onClick={onBack} aria-label="대화 목록으로"><ArrowLeft size={21} /></button>
          <button className="thread-person" type="button" onClick={onProfile}>
            <Avatar name={selected.name} flag={selected.flag} accent={selected.accent} size="sm" online={selected.online} />
            <span><strong>{selected.name}</strong><small>{selected.online ? "온라인 · 영어 ⇄ 한국어" : "최근 활동 어제"}</small></span>
          </button>
          <div className="thread-actions">
            <button className={`coach-cta ${coachOpen ? "active" : ""}`} type="button" onClick={() => setCoachOpen(!coachOpen)}><WandSparkles size={16} /><span>대화 코치</span></button>
            <button className="exchange-cta" type="button" onClick={onExchange}><Timer size={16} /><span>교환 세션</span></button>
            <IconButton label="음성 통화" icon={Phone} onClick={() => onToast("음성 통화 데모를 시작했어요")} />
            <IconButton label="영상 통화" icon={Video} onClick={() => onToast("영상 통화 데모를 시작했어요")} />
            <MenuPopover
              label="대화 메뉴"
              items={[
                { id: "mute", label: "알림 끄기", icon: BellOff, onSelect: () => onToast("이 대화의 알림을 껐어요") },
                { id: "leave", label: "대화방 나가기", icon: LogOut, onSelect: () => onToast("대화방에서 나갔어요") },
                { id: "block", label: "차단하기", icon: Ban, danger: true, onSelect: () => onToast("상대를 차단했어요") },
                { id: "report", label: "신고하기", icon: Flag, danger: true, onSelect: onReport },
              ]}
            />
          </div>
        </header>

        {selectedIsRequest ? <div className="dm-request-banner"><ShieldCheck size={18} /><span><strong>{selected.name}님의 메시지 요청</strong><small>수락하기 전까지 읽음 여부와 활동 상태가 상대에게 보이지 않아요.</small></span><button type="button" onClick={() => removeRequest(selected.id, selected.name)}>삭제</button><button type="button" onClick={() => acceptRequest(selected.id, selected.name)}>수락</button></div> : null}

        <div className="exchange-banner">
          <span className="exchange-banner-icon"><Languages size={18} /></span>
          <span><strong>오늘의 교환 균형</strong><small>영어 8분 · 한국어 7분</small></span>
          <div className="balance-bar"><i style={{ width: "53%" }} /></div>
          <button type="button" onClick={onExchange}>15분 이어하기 <ChevronRight size={15} /></button>
        </div>

        {coachOpen ? (
          <section className="conversation-coach" aria-label="대화 코치">
            <header>
              <span className="coach-title-icon"><WandSparkles size={18} /></span>
              <span><strong>대화 코치</strong><small>{selected.name}님과의 공통점과 지금까지의 흐름을 바탕으로 준비했어요.</small></span>
              <button type="button" onClick={() => void requestConversationSupport(false)} disabled={coachLoading}><RefreshCw size={14} className={coachLoading ? "spinning" : ""} /> 새로 추천</button>
              <button type="button" className="coach-close" aria-label="대화 코치 닫기" onClick={() => setCoachOpen(false)}><X size={15} /></button>
            </header>
            <div className="coach-grid">
              <div className="coach-topic-list">
                <span className="coach-label"><Lightbulb size={13} /> 대화 주제</span>
                {conversationSupport.topics.slice(0, 3).map((topic, index) => (
                  <button type="button" key={topic} onClick={() => setDraft(index === 0 ? conversationSupport.suggestedOpeners[0] ?? `Hi ${selected.name}! What was the highlight of your week?` : `Hi ${selected.name}! Can we talk about “${topic}” today?`)}>
                    <span>{index + 1}</span>{topic}<ChevronRight size={13} />
                  </button>
                ))}
              </div>
              <div className="coach-response-card">
                <span className="coach-label"><MessageCircle size={13} /> 추천 오프너</span>
                <p>{conversationSupport.suggestedOpeners[0]}</p>
                <div className="coach-followups">{conversationSupport.followUpQuestions.slice(0, 2).map((question) => <button type="button" key={question} onClick={() => setDraft(question)}>{question}</button>)}</div>
                <div className="coach-actions">
                  <button type="button" onClick={() => setDraft(conversationSupport.suggestedOpeners[0] ?? "")}>입력창에 넣기</button>
                  <button type="button" onClick={() => void requestConversationSupport(true)} disabled={!draft.trim() || coachLoading}><WandSparkles size={13} /> 작성 문장 다듬기</button>
                </div>
              </div>
            </div>
            <footer><Sparkles size={12} /><span>{conversationSupport.tip}</span><small>DEMO COACH</small></footer>
          </section>
        ) : null}

        <div className="message-area">
          <div className="day-divider"><span>오늘</span></div>
          {selected.messages.map((message) => {
            if (message.system) return <div className="system-message" key={message.id}><ShieldCheck size={14} />{message.text}</div>;
            if (message.correction) {
              return (
                <div className="message-row correction-message" key={message.id}>
                  <Avatar name={selected.name} accent={selected.accent} size="xs" />
                  <div className="chat-correction-card">
                    <span className="correction-label"><PenLine size={14} /> {selected.name}님이 문장을 고쳤어요</span>
                    <p className="before">{message.correction.original}</p>
                    <p className="after">{message.correction.fixed}</p>
                    <small>{message.correction.note}</small>
                    <button type="button" onClick={() => onToast("복습함에 저장했어요")}><Bookmark size={14} /> 표현 저장</button>
                  </div>
                  <time>{message.time}</time>
                </div>
              );
            }
            return (
              <div className={`message-row ${message.mine ? "mine" : "theirs"}`} key={message.id}>
                {!message.mine ? <Avatar name={selected.name} accent={selected.accent} size="xs" /> : null}
                <div className="message-stack">
                  <div className="message-bubble">
                    {message.voice ? <button className="voice-message" type="button" onClick={() => onToast("음성 메시지를 재생 중이에요")}><span className="play-dot"><Play size={13} fill="currentColor" /></span><span className="waveform"><i /><i /><i /><i /><i /><i /><i /><i /><i /></span><small>{message.voice}</small></button> : null}
                    {message.text ? <p>{message.text}</p> : null}
                  </div>
                  {message.translated && translatedMessages.has(message.id) ? <div className="message-translation"><Languages size={13} /> {message.translated}</div> : null}
                  <div className="message-tools">
                    {message.translated ? <button type="button" onClick={() => toggleLocalSet(setTranslatedMessages, message.id)}><Languages size={13} /> 번역</button> : null}
                    <button type="button" onClick={() => onToast("문장 교정 편집기를 열었어요")}><PenLine size={13} /> 교정</button>
                    <button type="button" onClick={() => onToast("표현을 저장했어요")}><Bookmark size={13} /> 저장</button>
                    <button type="button" onClick={() => onToast("문장을 원어민 발음으로 재생했어요")}><Volume2 size={13} /> 듣기</button>
                  </div>
                </div>
                <time>{message.time}{message.mine ? " · 읽음" : ""}</time>
              </div>
            );
          })}
          <div className="typing-indicator"><Avatar name={selected.name} accent={selected.accent} size="xs" /><span><i /><i /><i /></span><small>{selected.name}님이 입력 중</small></div>
        </div>

        {selectedIsRequest ? <div className="request-composer-lock"><LockKeyhole size={17} /><span><strong>요청을 수락하면 답장할 수 있어요</strong><small>삭제하거나 수락해도 상대에게 별도 알림은 가지 않아요.</small></span></div> : <form className="message-composer" onSubmit={onSend}>
          <div className="writing-language"><span>EN</span> 영어로 작성 중 <ChevronDown size={13} /></div>
          <div className="composer-row">
            <IconButton label="파일 첨부" icon={Paperclip} onClick={() => onToast("파일 첨부 데모를 열었어요")} />
            <IconButton label="음성 메시지" icon={Mic} onClick={() => onToast("녹음 데모 · 다시 누르면 전송돼요")} />
            <label className="message-input">
              <span className="sr-only">메시지 입력</span>
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`${selected.name}님에게 메시지 보내기`} rows={1} />
              <button type="button" aria-label="이모지" onClick={() => setDraft(`${draft} 😊`)}><Smile size={18} /></button>
            </label>
            <button className="send-button" type="submit" disabled={!draft.trim()} aria-label="메시지 보내기"><Send size={18} /></button>
          </div>
          <small className="composer-hint"><Languages size={12} /> 기본 번역 무료 · 서버 자동 저장은 실서비스 설계 목업</small>
        </form>}
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
        <div><h1>보이스룸</h1><p>관심 있는 주제의 방을 골라 듣거나 직접 만들어보세요.</p></div>
        <button className="primary-button" type="button" onClick={onCreate}><Plus size={17} /> 보이스룸 만들기</button>
      </header>

      <div className="voice-room-toolbar"><strong>열려 있는 방</strong><span>{availableRooms.length}개</span></div>
      <div className="voice-room-list">
        {availableRooms.map((room) => (
          <article className={`voice-room-list-card room-${room.accent}`} key={room.id}>
            <div className="room-card-head">
              <span className="room-language"><Globe2 size={14} /> {room.language}</span>
              {room.scheduled ? <Pill tone="neutral"><CalendarDays size={12} /> {room.scheduled}</Pill> : <span className="room-live"><i /> LIVE</span>}
            </div>
            <div className="voice-room-main">
              <span className="voice-room-host"><Avatar name={room.host} flag={room.hostFlag} accent={room.accent} size="sm" online={!room.scheduled} /></span>
              <span><h2>{room.title}</h2><p>{room.topic} · {room.level}</p><small>{room.host} · {room.listeners ?? 1}명 참여 중</small></span>
              <button type="button" onClick={() => onJoin(room)}>{room.scheduled ? "미리보기" : "입장"}<ChevronRight size={16} /></button>
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
}: {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onOnboarding: () => void;
  onToast: (message: string) => void;
}) {
  const toggle = (key: "dmRequests" | "hideLocation" | "correctionAlerts" | "autoSync") => setSettings((current) => ({ ...current, [key]: !current[key] }));
  const [profileTab, setProfileTab] = useState("posts");
  return (
    <div className="view learn-view compact-learn">
      <div className="profile-toolbar">
        <IconButton label="설정" icon={Settings} onClick={() => setProfileTab("learning")} />
      </div>

      <header className="profile-head">
        <div className="profile-head-id">
          <span className="profile-head-name">{currentUser.name}<BadgeCheck size={18} className="verified" /></span>
          <p className="profile-head-handle">{currentUser.handle}</p>
        </div>
        <Avatar name={currentUser.name} flag={currentUser.flag} accent="violet" size="xl" online />
      </header>

      <p className="profile-head-bio">{currentUser.bio}</p>

      <div className="profile-head-stats">
        <span><strong>{currentUser.partners}</strong> 파트너</span>
        <span><strong>{currentUser.posts}</strong> 게시물</span>
        <span><strong>{currentUser.streak}</strong>일 연속</span>
      </div>

      <div className="profile-head-actions">
        <button className="secondary-button" type="button" onClick={() => onToast("프로필을 수정합니다")}><PenLine size={16} /> 프로필 편집</button>
      </div>

      <Tabs
        tabs={[
          { id: "posts", label: "내 글" },
          { id: "saved", label: "저장한 표현" },
          { id: "learning", label: "학습·설정" },
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
                {post.tags.map((tag) => <button type="button" key={tag} onClick={() => onToast(`${tag} 주제를 열었어요`)}>{tag}</button>)}
              </div>
              <div className="my-post-stats">
                <span><Heart size={15} /> {post.likes}</span>
                <span><MessageCircle size={15} /> {post.comments}</span>
                <span><PenLine size={15} /> 교정 {post.corrections}</span>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {profileTab === "learning" ? (
      <section className="learn-overview-grid" aria-label="학습 요약">
        <article><span className="summary-icon coral"><Flame size={18} /></span><small>연속 학습</small><strong>{currentUser.streak}<em>일</em></strong></article>
        <article><span className="summary-icon violet"><Timer size={18} /></span><small>이번 주 대화</small><strong>145<em>분</em></strong></article>
        <article><span className="summary-icon mint"><Bookmark size={18} /></span><small>저장한 표현</small><strong>{savedPhrases.length}<em>개</em></strong></article>
        <article><span className="summary-icon amber"><PenLine size={18} /></span><small>받은 교정</small><strong>18<em>개</em></strong></article>
      </section>
      ) : null}

      {profileTab === "saved" ? (
      <div className="learn-compact-columns">
        <section className="saved-phrases-card">
          <header><span><strong>저장한 표현</strong><small>{savedPhrases.length}개 · 약 4분</small></span><button type="button" onClick={() => onToast("전체 저장 표현을 열었어요")}>전체 <ChevronRight size={15} /></button></header>
          <div className="phrase-list">
            {savedPhrases.map((item, index) => <article key={item.phrase}><button type="button" className="phrase-play" onClick={() => onToast("표현을 재생했어요")}><Volume2 size={16} /></button><span><strong>{item.phrase}</strong><small>{item.meaning}</small><em>{item.source}</em></span><span className={index === 0 ? "due-now" : ""}>{item.due}</span></article>)}
          </div>
          <button className="review-button" type="button" onClick={() => onToast("4분 복습 세션을 시작했어요")}><BookOpenCheck size={17} /> 4분 복습 시작</button>
        </section>

      </div>
      ) : null}

      {profileTab === "learning" ? (<>
      <div className="learn-compact-columns">
        <section className="settings-card">
          <header><span><strong>계정 및 학습 설정</strong><small>변경 내용은 이 기기에 반영돼요</small></span><Settings size={18} /></header>
          <button className="profile-settings-link" type="button" onClick={() => onToast("프로필 설정을 열었어요")}><span className="setting-icon"><PenLine size={17} /></span><span><strong>프로필 설정</strong><small>사진, 자기소개, 관심사 수정</small></span><ChevronRight size={15} /></button>
          <button className="profile-settings-link" type="button" onClick={onOnboarding}><span className="setting-icon"><Target size={17} /></span><span><strong>언어 및 목표</strong><small>학습 언어와 목표 다시 설정</small></span><ChevronRight size={15} /></button>
          <div className="dm-scope-setting"><span className="field-label">누가 바로 DM을 보낼 수 있나요?</span><div className="choice-row">{([['matches', '매칭된 사람'], ['mutuals', '서로 팔로우'], ['anyone', '모든 사람']] as Array<[DmScope, string]>).map(([value, label]) => <button type="button" className={settings.dmScope === value ? "active" : ""} key={value} onClick={() => setSettings((current) => ({ ...current, dmScope: value }))}>{label}</button>)}</div><small>그 외 DM은 대화 목록이 아닌 요청함으로 분리돼요.</small></div>
          <SettingRow icon={Bell} title="메시지 요청 알림" description="요청함에 새 DM이 오면 알려주기" checked={settings.dmRequests} onChange={() => toggle("dmRequests")} />
          <SettingRow icon={Cloud} title="대화 자동 동기화" description="재설치·기기 변경 후에도 서버에서 복원" checked={settings.autoSync} onChange={() => toggle("autoSync")} />
          <SettingRow icon={LockKeyhole} title="정밀 위치 숨기기" description="도시 수준만 프로필에 표시" checked={settings.hideLocation} onChange={() => toggle("hideLocation")} />
          <SettingRow icon={PenLine} title="교정 알림" description="내 문장이 교정되면 알려주기" checked={settings.correctionAlerts} onChange={() => toggle("correctionAlerts")} />
          <button className="blocked-link" type="button" onClick={() => onToast("차단 사용자 목록을 열었어요")}><Flag size={16} /> 신고 및 차단 관리 <ChevronRight size={15} /></button>
        </section>
      </div>
      <div className="account-safety-grid">
        <section className="settings-card verification-card">
          <header><span><strong>계정 인증</strong><small>단계별 신뢰 표시 · 과도한 가입 장벽 없이 운영</small></span><BadgeCheck size={18} /></header>
          <div className="verification-step done"><CheckCircle2 size={17} /><span><strong>1단계 · 이메일 인증</strong><small>완료됨</small></span><Pill tone="success">완료</Pill></div>
          <div className="verification-step"><Phone size={17} /><span><strong>2단계 · 전화번호 인증</strong><small>재가입 악용과 대량 계정 생성을 줄여요</small></span><button type="button" onClick={() => onToast("전화번호 인증 흐름을 열었어요 · mock")}>인증하기</button></div>
          <div className="verification-step"><ShieldCheck size={17} /><span><strong>3단계 · 신원 확인</strong><small>선택 사항이며 인증 배지만 표시해요</small></span><button type="button" onClick={() => onToast("선택 신원 인증 안내를 열었어요 · mock")}>자세히</button></div>
        </section>

        <section className="settings-card conversation-data-card">
          <header><span><strong>대화 데이터</strong><small>내 기록은 내가 관리해요</small></span><Cloud size={18} /></header>
          <div className="data-sync-status"><CheckCircle2 size={17} /><span><strong>{settings.autoSync ? "자동 동기화 켜짐 · DEMO" : "자동 동기화 꺼짐"}</strong><small>{settings.autoSync ? "실서비스 동작을 보여주는 목업이며 현재 재로그인 복원은 지원하지 않아요." : "출시 버전에서는 이 기기의 새 메시지가 복원되지 않을 수 있어요."}</small></span></div>
          <button className="profile-settings-link" type="button" onClick={() => onToast("대화 기록 다운로드 파일을 준비하고 있어요 · mock")}><span className="setting-icon"><Download size={17} /></span><span><strong>대화 기록 다운로드</strong><small>내 메시지를 파일로 보관</small></span><ChevronRight size={15} /></button>
          <button className="blocked-link" type="button" onClick={() => onToast("본인 확인 후 삭제 범위와 보관 정책을 안내하는 단계예요 · mock")}><Trash2 size={16} /> 대화 기록 삭제 요청 <ChevronRight size={15} /></button>
        </section>

        <section className="settings-card report-status-card">
          <header><span><strong>신고센터</strong><small>접수 내역과 검토 상태를 투명하게 확인해요</small></span><Flag size={18} /></header>
          <div className="report-case-head"><span><small>접수번호</small><strong>LL-2026-0812-0042</strong></span><Pill tone="soft">검토 중</Pill></div>
          <p><ShieldCheck size={16} /> 신고했다는 이유만으로 신고자 계정이 자동 제재되지 않아요. 양쪽 자료를 분리해 검토합니다.</p>
          <div className="report-timeline"><span className="done"><Check size={12} /> 접수 완료</span><span className="active"><Clock3 size={12} /> 안전팀 검토</span><span>결과 안내</span></div>
          <button className="profile-settings-link" type="button" onClick={() => onToast("추가 자료 제출 및 이의제기 화면을 열었어요 · mock")}><span className="setting-icon"><MessageCircle size={17} /></span><span><strong>추가 자료 제출 · 이의제기</strong><small>처리 결과에도 이의를 제기할 수 있어요</small></span><ChevronRight size={15} /></button>
        </section>
      </div>
      </>) : null}
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
        <button className="modal-close" type="button" onClick={requestClose} aria-label="닫기"><X size={20} /></button>
        {modal.type === "profile" ? <ProfileModal partner={modal.partner} onStartChat={onStartChat} onReport={() => onReport(modal.partner.name)} onToast={onToast} /> : null}
        {modal.type === "filters" ? <MatchingPreferencesModal initial={matchPreferences} onClose={onClose} onSave={onSaveMatchPreferences} onToast={onToast} /> : null}
        {modal.type === "compose" ? <ComposeModal onPublish={onPublish} onToast={onToast} /> : null}
        {modal.type === "search" ? <SearchModal onStartChat={onStartChat} onToast={onToast} /> : null}
        {modal.type === "create-room" ? <CreateRoomModal onCreate={onCreateRoom} /> : null}
        {modal.type === "room" ? <RoomModal room={modal.room} handRaised={roomHandRaised} setHandRaised={setRoomHandRaised} micOn={roomMicOn} setMicOn={setRoomMicOn} messages={roomMessages} onSendMessage={onSendRoomMessage} onMinimize={() => onMinimizeRoom(modal.room)} onLeave={onClose} onReport={() => onReport(modal.room.title)} onToast={onToast} /> : null}
        {modal.type === "exchange" ? <ExchangeModal length={exchangeLength} setLength={setExchangeLength} onClose={onClose} onToast={onToast} /> : null}
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
  const labels: Record<Exclude<ModalState, null>["type"], string> = { profile: "파트너 프로필", filters: "매칭 설정", compose: "새 게시물", search: "통합 검색", "create-room": "보이스룸 만들기", room: "보이스룸", exchange: "언어 교환 세션", "partner-list": "오늘의 파트너 목록", likes: "주고받은 마음", report: "신고 및 차단", onboarding: "학습 목표 설정" };
  return labels[type];
}




/** 오늘의 파트너 목록. 지금까지 본 사람과 남은 사람을 한눈에 보고 바로 이동합니다. */

/** 마음 목록 행의 메타 줄. 현지 시각을 마운트 이후에 채웁니다. */
function LikeMeta({ partner, time }: { partner: Partner; time: string }) {
  const localTime = useLocalTime(partner.timeOffset);
  return (
    <small>
      {partner.flag} {partner.country}
      {localTime ? ` · 현지 ${localTime}` : ""}
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
        <h2>주고받은 마음</h2>
        <p>서로 마음을 보내면 대화가 열려요</p>
      </header>

      <div className="likes-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "received"} className={tab === "received" ? "active" : ""} onClick={() => setTab("received")}>
          받은 마음 <span>{received.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "sent"} className={tab === "sent" ? "active" : ""} onClick={() => setTab("sent")}>
          보낸 마음 <span>{sent.length}</span>
        </button>
      </div>

      {list.length === 0 ? (
        <p className="likes-empty">{tab === "received" ? "아직 받은 마음이 없어요" : "아직 보낸 마음이 없어요"}</p>
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
                  <MessageCircle size={15} /> 대화 열기
                </button>
              ) : (
                <span className="likes-waiting">답장 기다리는 중</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="likes-hint">
        <Sparkles size={14} /> 받은 마음에 답하면 바로 대화가 시작돼요
      </p>
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
        <h2>오늘의 파트너</h2>
        <p>{queue.length}명 중 {Math.min(index + 1, queue.length)}번째를 보고 있어요</p>
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
                  <small>{partner.native} 가르치고 {partner.learning} 배워요</small>
                </span>
                <span className="partner-list-state">
                  {isSignaled ? <em className="signaled"><Heart size={13} /> 마음 보냄</em>
                    : isCurrent ? <em className="now">보는 중</em>
                    : isSeen ? <em className="seen">지나감</em>
                    : <em>{item.score}%</em>}
                </span>
              </button>
              <button
                type="button"
                className="partner-list-profile"
                onClick={() => onProfile(partner)}
                aria-label={`${partner.name} 프로필 보기`}
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
        <div className="profile-head-actions"><button className="primary-button" type="button" onClick={() => onStartChat(partner)}><MessageCircle size={17} /> 대화 시작</button><button className="secondary-button" type="button" onClick={onReport}><Flag size={16} /> 신고</button></div>
      </div>
      <div className="profile-match-strip"><span><Sparkles size={17} /><b>{partner.compatibility}%</b> 교환 궁합</span><span><Timer size={17} /><b>{partner.balance}</b></span><span><ShieldCheck size={17} />안전 프로필 확인됨</span></div>
      <div className="profile-modal-grid">
        <div className="profile-main">
          <section><h3>자기소개</h3><p>{partner.bio}</p></section>
          <section><h3>언어 교환</h3><div className="profile-language-grid"><span><small>가르칠 수 있어요</small><strong>{partner.flag} {partner.native}</strong><em>원어민</em></span><span><small>배우고 있어요</small><strong>🇰🇷 {partner.learning}</strong><em>{partner.level}</em></span></div></section>
          <section><h3>관심사</h3><div className="interest-row large">{partner.interests.map((item) => <span key={item}>{item}</span>)}</div></section>
        </div>
        <aside className="profile-details"><h3>잘 맞는 이유</h3><p><Clock3 size={16} /><span><strong>활동 시간</strong><small>{partner.activeTime}</small></span></p><p><Trophy size={16} /><span><strong>학습 목표</strong><small>{partner.goal}</small></span></p><p><PenLine size={16} /><span><strong>교정 스타일</strong><small>중요한 오류를 대화 후에</small></span></p><button type="button" onClick={() => onToast("파트너를 관심 목록에 저장했어요")}><Star size={16} /> 관심 파트너로 저장</button></aside>
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
  const availabilityOptions: Array<[MatchAvailability, string]> = [
    ["weekday-morning", "평일 아침"],
    ["weekday-evening", "평일 저녁"],
    ["weekend-morning", "주말 오전"],
    ["weekend-evening", "주말 저녁"],
  ];

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
  const toggleIntent = (intent: MatchIntent) => setPreferences((current) => ({
    ...current,
    intents: current.intents.includes(intent) ? current.intents.filter((item) => item !== intent) : [...current.intents, intent],
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
        <h2>매일 만나고 싶은 상대를 설정해요</h2>
        <p>필수 조건은 정확히 맞추고, 선호 조건이 가까운 파트너를 매일 12명 추천해요.</p>
      </header>
      <div className="form-section">
        <span className="field-label">배우고 싶은 언어 <small>필수 조건</small></span>
        <div className="choice-row three-columns">
          {[{ value: "en", label: "영어", flag: "🇺🇸" }, { value: "es", label: "스페인어", flag: "🇪🇸" }, { value: "ja", label: "일본어", flag: "🇯🇵" }].map((item) => (
            <button type="button" className={preferences.targetLanguages.includes(item.value) ? "active" : ""} key={item.value} onClick={() => setPreferences((current) => ({ ...current, targetLanguages: [item.value] }))}>{item.flag} {item.label}</button>
          ))}
        </div>
      </div>
      <div className="form-section">
        <span className="field-label">함께할 파트너 <small>개인 매칭 선호 · 프로필에는 공개되지 않아요</small></span>
        <div className="choice-row">
          {(Object.entries(genderLabels) as Array<[PartnerGender, string]>).map(([value, label]) => (
            <button type="button" className={preferences.partnerGender === value ? "active" : ""} key={value} onClick={() => setPreferences((current) => ({ ...current, partnerGender: value }))}>{label}</button>
          ))}
        </div>
      </div>
      <div className="form-section">
        <span className="field-label">선호 나이 <small>우선 조건</small></span>
        <div className="age-range-fields">
          <label><span>최소</span><input aria-label="파트너 최소 나이" type="number" min={18} max={preferences.ageMax} value={preferences.ageMin} onChange={(event) => setPreferences((current) => ({ ...current, ageMin: Math.max(18, Math.min(Number(event.target.value), current.ageMax)) }))} /><small>세</small></label>
          <span>–</span>
          <label><span>최대</span><input aria-label="파트너 최대 나이" type="number" min={preferences.ageMin} max={80} value={preferences.ageMax} onChange={(event) => setPreferences((current) => ({ ...current, ageMax: Math.max(current.ageMin, Math.min(Number(event.target.value), 80)) }))} /><small>세</small></label>
        </div>
      </div>
      <div className="form-section">
        <span className="field-label">파트너의 한국어 수준</span>
        <div className="choice-row">
          {(Object.entries(levelLabels) as Array<[PartnerLevel, string]>).map(([value, label]) => (
            <button type="button" className={preferences.partnerLevel === value ? "active" : ""} key={value} onClick={() => setPreferences((current) => ({ ...current, partnerLevel: value }))}>{label}</button>
          ))}
        </div>
      </div>
      <div className="form-section">
        <span className="field-label">선호 지역 <small>복수 선택</small></span>
        <div className="chip-options">
          {Object.entries(countryLabels).map(([country, label]) => {
            const active = preferences.preferredCountries.includes(country);
            return <button type="button" className={active ? "active" : ""} key={country} onClick={() => toggleCountry(country)}>{active ? <Check size={13} /> : <Plus size={13} />}{label}</button>;
          })}
        </div>
      </div>
      <div className="form-section">
        <span className="field-label">공통 관심사</span>
        <div className="chip-options">
          {Object.entries(interestLabels).map(([interest, label]) => {
            const active = preferences.interests.includes(interest);
            return <button type="button" className={active ? "active" : ""} key={interest} onClick={() => toggleInterest(interest)}>{active ? <Check size={13} /> : <Plus size={13} />}{label}</button>;
          })}
        </div>
      </div>
      <div className="form-section">
        <span className="field-label">만남 목적 <small>복수 선택 · 우선 조건</small></span>
        <div className="chip-options">
          {(Object.entries(intentLabels) as Array<[MatchIntent, string]>).map(([intent, label]) => {
            const active = preferences.intents.includes(intent);
            return <button type="button" className={active ? "active" : ""} key={intent} onClick={() => toggleIntent(intent)}>{active ? <Check size={13} /> : <Plus size={13} />}{label}</button>;
          })}
        </div>
      </div>
      <div className="form-section">
        <span className="field-label">주로 대화 가능한 시간</span>
        <div className="choice-row">
          {availabilityOptions.map(([value, label]) => (
            <button type="button" className={preferences.availability.includes(value) ? "active" : ""} key={value} onClick={() => toggleAvailability(value)}>{preferences.availability.includes(value) ? <Check size={13} /> : null}{label}</button>
          ))}
        </div>
      </div>
      <label className="setting-row standalone">
        <span className="setting-icon"><Eye size={17} /></span>
        <span><strong>현재 온라인인 사람만</strong><small>바로 답장할 가능성이 높아요</small></span>
        <input aria-label="현재 온라인인 사람만 보기" type="checkbox" checked={preferences.onlineOnly} onChange={() => setPreferences((current) => ({ ...current, onlineOnly: !current.onlineOnly }))} />
        <i className="toggle" />
      </label>
      <label className="setting-row standalone">
        <span className="setting-icon"><BadgeCheck size={17} /></span>
        <span><strong>인증된 프로필 우선</strong><small>전화번호 또는 신원 확인이 끝난 계정을 먼저 추천해요</small></span>
        <input aria-label="인증된 프로필 우선" type="checkbox" checked={preferences.verifiedOnly} onChange={() => setPreferences((current) => ({ ...current, verifiedOnly: !current.verifiedOnly }))} />
        <i className="toggle" />
      </label>
      <div className="matching-schedule-note"><CalendarClock size={18} /><span><strong>다음 추천 · 내일 오전 9시</strong><small>선호 조건이 부족해도 필수 조건을 벗어난 사람을 임의로 섞지 않아요.</small></span><Pill tone="success">12명</Pill></div>
      <div className="modal-footer">
        <button className="text-button" type="button" onClick={() => { setPreferences(defaultMatchPreferences); onToast("기본 매칭 조건으로 되돌렸어요"); }}><RotateCcw size={15} /> 초기화</button>
        <button className="primary-button" type="button" disabled={saving || !preferences.targetLanguages.length || !preferences.availability.length || !preferences.intents.length} onClick={() => void save()}>{saving ? "저장 중…" : "설정 저장하고 12명 보기"}</button>
      </div>
    </div>
  );
}

function ComposeModal({ onPublish, onToast }: { onPublish: (text: string) => void; onToast: (message: string) => void }) {
  const [text, setText] = useState("");
  const [correction, setCorrection] = useState(true);
  return (
    <div className="compose-modal-content">
      <header><Pill tone="soft"><PenLine size={13} /> NEW NOTE</Pill><h2>커뮤니티에 공유하기</h2></header>
      <div className="compose-author">
        <Avatar name={currentUser.name} flag={currentUser.flag} accent="violet" size="sm" />
        <span><strong>{currentUser.name}</strong><small>영어 학습자 · {currentUser.level}</small></span>
        <button type="button">전체 공개 <ChevronDown size={14} /></button>
      </div>
      <label className="compose-text">
        <span className="sr-only">게시물 내용</span>
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="연습하고 싶은 문장, 궁금한 표현, 문화 이야기를 짧게 나눠보세요…" rows={7} />
        <small>{text.length}/700</small>
      </label>
      <div className="compose-attachments">
        <button type="button" onClick={() => onToast("사진 첨부 데모를 열었어요")}><ImageIcon size={17} /> 사진</button>
        <button type="button" onClick={() => onToast("음성 녹음 데모를 열었어요")}><Mic size={17} /> 음성</button>
        <button type="button" onClick={() => onToast("주제를 선택했어요")}><Plus size={17} /> 주제</button>
      </div>
      <label className="correction-request">
        <span className="setting-icon"><WandSparkles size={17} /></span>
        <span><strong>원어민에게 교정 요청</strong><small>게시물에 교정 버튼이 표시돼요</small></span>
        <input aria-label="원어민에게 교정 요청" type="checkbox" checked={correction} onChange={() => setCorrection(!correction)} />
        <i className="toggle" />
      </label>
      <div className="modal-footer">
        <span className="safety-note"><ShieldCheck size={14} /> 연락처와 정밀 위치는 공유하지 마세요.</span>
        <button className="primary-button" type="button" disabled={!text.trim()} onClick={() => onPublish(text.trim())}>게시하기 <Send size={16} /></button>
      </div>
    </div>
  );
}

function SearchModal({ onStartChat, onToast }: { onStartChat: (partner: Partner) => void; onToast: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const results = partners.filter((partner) => `${partner.name} ${partner.native} ${partner.interests.join(" ")}`.toLowerCase().includes(query.toLowerCase())).slice(0, 3);
  return <div className="search-modal-content"><header><Search size={21} /><input aria-label="검색" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="사람, 언어, 주제, 저장한 표현 검색" /><kbd>ESC</kbd></header><div className="search-chips"><span>빠른 검색</span>{["영어 원어민", "지금 온라인", "#여행", "저장한 표현"].map((item) => <button type="button" key={item} onClick={() => setQuery(item.replace("#", ""))}>{item}</button>)}</div><section><h3>{query ? `“${query}” 검색 결과` : "추천 파트너"}</h3>{results.length ? results.map((partner) => <button className="search-result" type="button" key={partner.id} onClick={() => onStartChat(partner)}><Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="sm" online={partner.online} /><span><strong>{partner.name}</strong><small>{partner.native} ⇄ {partner.learning} · {partner.interests.join(" · ")}</small></span><Pill tone="success">{partner.compatibility}%</Pill><ChevronRight size={16} /></button>) : <div className="empty-search"><Search size={28} /><strong>검색 결과가 없어요</strong><p>언어나 관심사를 더 짧게 입력해보세요.</p></div>}</section><footer><span><Monitor size={14} /> 어디서든 <kbd>Ctrl</kbd> + <kbd>K</kbd></span><button type="button" onClick={() => onToast("전체 검색 결과 화면을 열었어요")}>전체 검색 보기</button></footer></div>;
}

function CreateRoomModal({ onCreate }: { onCreate: (details: { title: string; topic: string; language: string; level: string }) => void }) {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("영어");
  const [level, setLevel] = useState("모든 레벨");

  return (
    <form className="create-room-form" onSubmit={(event) => { event.preventDefault(); if (title.trim() && topic.trim()) onCreate({ title: title.trim(), topic: topic.trim(), language, level }); }}>
      <header><span className="summary-icon violet"><Mic size={20} /></span><div><h2>보이스룸 만들기</h2><p>제목과 대화 주제만 정하면 바로 목록에 추가돼요.</p></div></header>
      <label><span className="field-label">방 제목</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 퇴근 후 15분 영어" maxLength={48} /></label>
      <label><span className="field-label">대화 주제</span><input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="예: 여행에서 기억에 남는 순간" maxLength={64} /></label>
      <div className="create-room-options">
        <label><span className="field-label">사용 언어</span><select value={language} onChange={(event) => setLanguage(event.target.value)}><option>영어</option><option>한국어</option><option>일본어</option><option>스페인어</option></select></label>
        <label><span className="field-label">참여 레벨</span><select value={level} onChange={(event) => setLevel(event.target.value)}><option>모든 레벨</option><option>초급</option><option>중급</option><option>고급</option></select></label>
      </div>
      <div className="modal-footer"><small>생성 결과는 현재 브라우저에서만 유지되는 mock입니다.</small><button className="primary-button" type="submit" disabled={!title.trim() || !topic.trim()}><Plus size={16} /> 방 만들기</button></div>
    </form>
  );
}

function MiniRoom({ room, handRaised, micOn, onExpand, onLeave }: { room: PracticeRoom; handRaised: boolean; micOn: boolean; onExpand: () => void; onLeave: () => void }) {
  const status = micOn ? "마이크 켜짐" : handRaised ? "발언 승인 대기 중" : `${room.host} · 말하는 중`;
  return (
    <aside className="mini-room" aria-label="보이스룸 미니 플레이어">
      <button className="mini-room-open" type="button" onClick={onExpand}>
        <span className="mini-room-wave" aria-hidden="true"><i /><i /><i /><i /></span>
        <span className="mini-room-copy"><strong>{room.title}</strong><small>{status}</small></span>
      </button>
      <IconButton label="보이스룸 펼치기" icon={Maximize2} onClick={onExpand} />
      <IconButton label="보이스룸 나가기" icon={X} onClick={onLeave} />
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
}: {
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
    onToast(micOn ? "마이크를 껐어요" : "마이크를 켰어요 · 데모");
  };

  const toggleHand = () => {
    setHandRaised(!handRaised);
    if (handRaised) setMicOn(false);
    onToast(handRaised ? "발언 요청을 취소했어요" : "손을 들었어요. 호스트 승인을 기다려요");
  };

  const micLabel = !handRaised ? "발언 요청을 먼저 해주세요" : micOn ? "마이크 끄기" : "마이크 켜기";

  return (
    <div className={`room-modal-content room-state-${room.accent}`}>
      <header>
        <div>
          <Pill tone="live"><span className="live-dot" /> LIVE · {room.listeners || 1}명</Pill>
          <h2>{room.title}</h2>
          <p>{room.language} · {room.level} · 호스트 {room.hostFlag} {room.host}</p>
        </div>
        <div className="room-header-actions">
          <IconButton label="보이스룸 축소" icon={Minimize2} onClick={onMinimize} />
          <MenuPopover
            label="방 메뉴"
            items={[
              { id: "link", label: "방 링크 복사", icon: LinkIcon, onSelect: () => onToast("방 링크를 복사했어요") },
              { id: "mute", label: "이 방 알림 끄기", icon: BellOff, onSelect: () => onToast("이 방의 알림을 껐어요") },
              { id: "leave", label: "방 나가기", icon: LogOut, onSelect: () => { onToast("보이스룸에서 나왔어요"); onLeave(); } },
              { id: "block", label: "호스트 차단하기", icon: Ban, danger: true, onSelect: () => onToast("호스트를 차단했어요") },
              { id: "report", label: "신고하기", icon: Flag, danger: true, onSelect: onReport },
            ]}
          />
        </div>
      </header>

      <div className="room-stage">
        <div className="stage-seat speaking">
          <Avatar name={room.host} flag={room.hostFlag} accent={room.accent} size="lg" online />
          <strong>{room.host}</strong>
          <small>호스트 · 말하는 중</small>
          <span><Mic size={13} /></span>
        </div>
        {room.speakers.slice(1).map((speaker, index) => (
          <div className="stage-seat" key={speaker}>
            <Avatar name={speaker} accent={(["mint", "amber", "blue"] as Accent[])[index % 3]} size="md" />
            <strong>{speaker}</strong>
            <small>{index === 0 ? "모더레이터" : "스피커"}</small>
            <span><Mic size={13} /></span>
          </div>
        ))}
        <button
          className={`stage-seat empty ${handRaised ? "waiting" : ""}`}
          type="button"
          onClick={toggleHand}
        >
          <span><Plus size={20} /></span>
          <strong>{handRaised ? "승인 대기 중" : "빈 자리"}</strong>
          <small>{handRaised ? "호스트가 확인하고 있어요" : "눌러서 발언 요청"}</small>
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
          <strong>듣는 사람 {room.listeners}명</strong>
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
              <li className="room-audience-more">외 {room.listeners - room.audience.length}명</li>
            ) : null}
          </ul>
        ) : null}
      </section>

      <div className="live-caption">
        <span><Volume2 size={15} /> 실시간 자막 · 데모</span>
        <p>“What is one small win you had today?”</p>
        <button type="button" onClick={() => onToast("선택한 문장을 번역했어요")}>문장 번역</button>
      </div>

      <div className="room-chat" ref={chatRef} role="log" aria-label="보이스룸 채팅">
        {messages.map((message) => (
          <p key={message.id} className={message.mine ? "mine" : ""}>
            <b>{message.mine ? "나" : message.name}</b> {message.text}
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
          aria-label={handRaised ? "손 내리기" : "손들기"}
          aria-pressed={handRaised}
          title={handRaised ? "손 내리기" : "손들기"}
        >
          <Hand size={19} />
        </button>
        <form className="room-composer" onSubmit={send}>
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="채팅으로 인사해보세요"
            aria-label="보이스룸 채팅 입력"
          />
          <button type="submit" disabled={!draft.trim()} aria-label="채팅 보내기" title="채팅 보내기">
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
        <h2>언어 교환 세션</h2>
        <p>한 언어씩 공평하게 연습하고, 끝나면 서로 짧은 피드백을 남겨요.</p>
      </header>
      <div className="exchange-partners">
        <span><Avatar name={currentUser.name} flag={currentUser.flag} accent="violet" size="md" /><strong>{currentUser.name}</strong><small>영어 연습</small></span>
        <i><Languages size={18} /></i>
        <span><Avatar name="Maya" flag="🇨🇦" accent="coral" size="md" /><strong>Maya</strong><small>한국어 연습</small></span>
      </div>
      <section>
        <span className="field-label">세션 길이</span>
        <div className="duration-options">
          {[10, 15, 20, 30].map((value) => <button type="button" className={length === value ? "active" : ""} key={value} onClick={() => setLength(value)}><strong>{value}</strong><small>분</small></button>)}
        </div>
      </section>
      <div className="exchange-timeline"><span style={{ width: "50%" }}><b>EN</b><strong>{half}분</strong><small>서준의 영어</small></span><span><b>KO</b><strong>{half}분</strong><small>Maya의 한국어</small></span></div>
      <div className="exchange-features"><span><CheckCircle2 size={15} /> 턴 타이머</span><span><CheckCircle2 size={15} /> 실시간 메모</span><span><CheckCircle2 size={15} /> 종료 후 피드백</span></div>
      <div className="modal-footer">
        <button className="secondary-button" type="button" onClick={() => { onClose(); onToast("내일 오후 8시에 세션을 예약했어요"); }}><CalendarDays size={16} /> 예약하기</button>
        <button className="primary-button" type="button" onClick={() => { onClose(); onToast(`${length}분 교환 세션을 시작했어요 · 타이머 데모`); }}><Phone size={16} /> 지금 시작</button>
      </div>
    </div>
  );
}

function ReportModal({ target, onCancel, onConfirm }: { target: string; onCancel: () => void; onConfirm: () => void }) {
  const [reason, setReason] = useState("spam");
  const [submitted, setSubmitted] = useState(false);
  if (submitted) {
    return (
      <div className="report-content report-receipt">
        <span className="report-icon"><CheckCircle2 size={25} /></span>
        <Pill tone="success">접수 완료</Pill>
        <h2>신고가 안전팀에 전달됐어요</h2>
        <p><b>{target}</b>님에게 신고자 정보나 신고 여부를 알리지 않아요.</p>
        <div className="report-receipt-card"><span><small>접수번호</small><strong>LL-2026-0812-0042</strong></span><span><small>현재 상태</small><strong>검토 대기</strong></span></div>
        <div className="reporter-protection-note"><ShieldCheck size={18} /><span><strong>신고자는 자동 제재되지 않아요</strong><small>신고 내용과 계정 활동은 분리해 검토하며, 처리 결과에 이의를 제기할 수 있어요.</small></span></div>
        <div className="modal-footer"><button className="secondary-button" type="button" onClick={onCancel}>닫기</button><button className="primary-button" type="button" onClick={onConfirm}>접수 내역 보기</button></div>
      </div>
    );
  }
  return (
    <div className="report-content">
      <span className="report-icon"><ShieldCheck size={24} /></span>
      <h2>안전하게 이용할 수 있도록 도와주세요</h2>
      <p><b>{target}</b>을(를) 신고하거나 차단할 수 있어요. 신고 내용은 상대에게 알려지지 않습니다.</p>
      <div className="report-options">
        {[["spam", "스팸 또는 광고"], ["dating", "데이트·연애 목적"], ["harassment", "괴롭힘 또는 혐오 표현"], ["privacy", "개인정보 요구"], ["other", "기타"]].map(([id, label]) => (
          <label key={id}>
            <input aria-label={label} type="radio" name="reason" value={id} checked={reason === id} onChange={() => setReason(id)} />
            <span>{label}</span><CheckCircle2 size={17} />
          </label>
        ))}
      </div>
      <label className="block-option">
        <input aria-label="이 사용자도 함께 차단" type="checkbox" />
        <span><strong>이 사용자도 함께 차단</strong><small>프로필과 메시지가 서로 보이지 않아요.</small></span>
      </label>
      <div className="reporter-protection-note"><ShieldCheck size={17} /><span><strong>신고자 보호 원칙</strong><small>신고했다는 이유만으로 계정을 정지하지 않으며, 자동 제재 없이 안전팀이 맥락을 검토해요.</small></span></div>
      <div className="modal-footer"><button className="secondary-button" type="button" onClick={onCancel}>취소</button><button className="danger-button" type="button" onClick={() => setSubmitted(true)}><Flag size={16} /> 신고 보내기</button></div>
    </div>
  );
}

function OnboardingModal({ onClose, onToast }: { onClose: () => void; onToast: (message: string) => void }) {
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState("conversation");
  const goals: Array<[string, LucideIcon, string, string]> = [
    ["conversation", MessageCircle, "일상 대화", "자연스럽고 편하게 말하기"],
    ["career", Trophy, "업무 · 커리어", "회의와 발표 자신감"],
    ["travel", Globe2, "여행", "현지에서 바로 쓰기"],
    ["exam", BookOpenCheck, "시험 · 자격", "정확한 문법과 어휘"],
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
          <h2>어떤 언어를 함께 나누고 싶나요?</h2>
          <p>나중에 프로필에서 언제든 바꿀 수 있어요.</p>
          <div className="language-picker">
            <button className="selected" type="button"><span>🇰🇷</span><p><small>내 모국어</small><strong>한국어</strong></p><CheckCircle2 size={18} /></button>
            <button className="selected" type="button"><span>🇺🇸</span><p><small>배울 언어</small><strong>영어</strong></p><CheckCircle2 size={18} /></button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section>
          <Pill tone="soft">GOAL</Pill>
          <h2>지금 가장 중요한 학습 목표는?</h2>
          <p>추천 파트너와 연습 콘텐츠가 이 목표에 맞춰져요.</p>
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
          <h2>언제, 어떻게 교정받고 싶나요?</h2>
          <p>편안한 대화를 위한 기본 약속을 정해요.</p>
          <div className="rhythm-options">
            <button type="button"><Clock3 size={18} /><span><strong>주 활동 시간</strong><small>평일 저녁 7–10시</small></span><ChevronDown size={16} /></button>
            <button type="button"><PenLine size={18} /><span><strong>교정 선호</strong><small>대화 후 중요한 오류만</small></span><ChevronDown size={16} /></button>
            <label><ShieldCheck size={18} /><span><strong>프로필 공개 범위</strong><small>위치는 도시 수준까지만 공개</small></span><input aria-label="정밀 위치 숨기기" type="checkbox" defaultChecked /><i className="toggle" /></label>
          </div>
        </section>
      ) : null}

      <footer>
        <button className="secondary-button" type="button" onClick={() => step === 1 ? onClose() : setStep(step - 1)}>{step === 1 ? "나중에" : "이전"}</button>
        <button className="primary-button" type="button" onClick={() => { if (step < 3) setStep(step + 1); else { onClose(); onToast("학습 목표를 업데이트했어요"); } }}>{step < 3 ? "다음" : "추천 시작"}<ChevronRight size={16} /></button>
      </footer>
    </div>
  );
}
