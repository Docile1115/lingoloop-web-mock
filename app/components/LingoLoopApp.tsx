"use client";

import {
  ArrowLeft,
  BadgeCheck,
  Bell,
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
  Flame,
  Flag,
  Globe2,
  GraduationCap,
  Heart,
  Image as ImageIcon,
  Languages,
  Lightbulb,
  LockKeyhole,
  MessageCircle,
  Mic,
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
  UserPlus,
  Users,
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
  partners,
  rooms,
  savedPhrases,
  type Accent,
  type Conversation,
  type FeedPost,
  type Partner,
  type PracticeRoom,
} from "@/app/lib/demo-data";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

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

type ModalState =
  | { type: "profile"; partner: Partner }
  | { type: "filters" }
  | { type: "compose" }
  | { type: "search" }
  | { type: "room"; room: PracticeRoom }
  | { type: "create-room" }
  | { type: "exchange" }
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
      city: `${partner.country.name} · 오늘 활동`,
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
    city: `${partner.country.name} · 오늘 활동`,
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
  return [partners[0]].map((partner) => ({
    partner,
    score: partner.compatibility,
    matchReasons: dailyMatchDetails[partner.id]?.reasons ?? ["학습 목표 일치", "비슷한 활동 시간"],
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
  { id: "learn", label: "내 학습", shortLabel: "내 학습", icon: GraduationCap, description: "쌓인 표현과 학습 리듬을 확인하세요" },
];

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
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className={`avatar avatar-${size}`} style={accentStyle(accent)} aria-hidden="true">
      <span className="avatar-initials">{initials}</span>
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
  const [draft, setDraft] = useState("");
  const [feedTab, setFeedTab] = useState<"recommended" | "learning" | "following">("recommended");
  const [translatedPosts, setTranslatedPosts] = useState<Set<string>>(new Set());
  const [openCorrections, setOpenCorrections] = useState<Set<string>>(new Set(["post-1"]));
  const [toast, setToast] = useState<string | null>(null);
  const [apiState, setApiState] = useState<ApiState>("checking");
  const [roomHandRaised, setRoomHandRaised] = useState(false);
  const [roomMicOn, setRoomMicOn] = useState(false);
  const [exchangeLength, setExchangeLength] = useState(15);
  const [settings, setSettings] = useState({ dmRequests: true, hideLocation: true, correctionAlerts: true });
  const [matchPreferences, setMatchPreferences] = useState<MatchPreferences>(defaultMatchPreferences);
  const [dailyRecommendations, setDailyRecommendations] = useState<DailyMatchRecommendation[]>(fallbackDailyRecommendations);
  const [practiceRooms, setPracticeRooms] = useState<PracticeRoom[]>(rooms);
  const toastTimer = useRef<number | null>(null);

  const currentNav = navItems.find((item) => item.id === section) ?? navItems[0];
  const selectedConversation = conversations.find((item) => item.id === selectedChatId) ?? conversations[0];

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
        setDailyRecommendations(body.data.recommendations.map((item, index) => ({
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

  const goToSection = (next: Section) => {
    setSection(next);
    if (next === "chats") setMobileThreadOpen(false);
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
    showToast(key === "liked" ? "응원을 보냈어요" : "복습 컬렉션에 저장했어요");
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
      setDraft(dailyRecommendations.find((item) => item.partner.id === partner.id)?.icebreaker ?? dailyMatchDetails[partner.id]?.icebreaker ?? `Hi ${partner.name}! Nice to meet you.`);
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
          <span className="nav-label">LEARN TOGETHER</span>
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
                <Icon size={20} />
                <span>{item.label}</span>
                {item.id === "chats" ? <span className="nav-count">7</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />
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
          <div className="desktop-page-title">
            <strong>{currentNav.label}</strong>
            <span>{currentNav.description}</span>
          </div>
          <div className="topbar-actions">
            <span className={`api-indicator api-${apiState}`} title="mock API 상태">
              <span />{apiState === "ready" ? "Mock API 연결됨" : apiState === "checking" ? "연결 확인 중" : "오프라인 데모"}
            </span>
            {section === "community" ? <button className="top-compose-button" type="button" onClick={() => setModal({ type: "compose" })}><PenLine size={16} /> 글쓰기</button> : <IconButton label="통합 검색" icon={Search} onClick={() => setModal({ type: "search" })} />}
            <button className="top-profile" type="button" onClick={() => goToSection("learn")} aria-label="내 학습 프로필">
              <Avatar name={currentUser.name} flag={currentUser.flag} accent="violet" size="xs" />
              <ChevronDown size={15} />
            </button>
          </div>
        </header>

        <div className="workspace-grid">
          <main id="main-content" className="main-content">
            {section === "discover" ? (
              <DiscoverView
                preferences={matchPreferences}
                dailyRecommendations={dailyRecommendations}
                onProfile={(partner) => setModal({ type: "profile", partner })}
                onChat={startChat}
                onFilters={() => setModal({ type: "filters" })}
              />
            ) : null}
            {section === "community" ? (
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
                  if (partner) setModal({ type: "profile", partner });
                }}
                onReport={(target) => setModal({ type: "report", target })}
                onToast={showToast}
              />
            ) : null}
            {section === "chats" ? (
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
                  if (partner) setModal({ type: "profile", partner });
                  else showToast("그룹 정보 패널을 열었어요");
                }}
                onReport={() => setModal({ type: "report", target: selectedConversation?.name ?? "대화" })}
                onToast={showToast}
              />
            ) : null}
            {section === "practice" ? (
              <PracticeView
                rooms={practiceRooms}
                onJoin={(room) => {
                  setRoomHandRaised(false);
                  setRoomMicOn(false);
                  setModal({ type: "room", room });
                }}
                onCreate={() => setModal({ type: "create-room" })}
              />
            ) : null}
            {section === "learn" ? (
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
          roomHandRaised={roomHandRaised}
          setRoomHandRaised={setRoomHandRaised}
          roomMicOn={roomMicOn}
          setRoomMicOn={setRoomMicOn}
          exchangeLength={exchangeLength}
          setExchangeLength={setExchangeLength}
          matchPreferences={matchPreferences}
          onSaveMatchPreferences={saveMatchPreferences}
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

function DiscoverView({
  preferences,
  dailyRecommendations,
  onProfile,
  onChat,
  onFilters,
}: {
  preferences: MatchPreferences;
  dailyRecommendations: DailyMatchRecommendation[];
  onProfile: (partner: Partner) => void;
  onChat: (partner: Partner) => void;
  onFilters: () => void;
}) {
  const match = dailyRecommendations[0] ?? fallbackDailyRecommendations()[0];
  const partner = match.partner;
  const targetLanguage = languageLabels[preferences.targetLanguages[0] ?? "en"] ?? "영어";
  const preferenceSummary = [
    targetLanguage,
    preferences.interests.slice(0, 2).map((item) => interestLabels[item] ?? item).join(" · "),
    availabilityLabels[preferences.availability[0] ?? "weekday-evening"],
  ].filter(Boolean);

  return (
    <div className="view discover-view compact-discover">
      <header className="simple-view-header partner-view-header">
        <div>
          <span><CalendarClock size={14} /> 매일 오전 9시 자동 매칭</span>
          <h1>오늘의 파트너</h1>
          <p>설정한 조건에 가장 가까운 한 사람만 추천해요.</p>
        </div>
        <button className="secondary-button" type="button" onClick={onFilters}><SlidersHorizontal size={16} /> 매칭 설정</button>
      </header>

      <article className="single-match-card">
        <div className="single-match-person">
          <Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="xl" online={partner.online} />
          <div><span><h2>{partner.name}</h2>{partner.verified ? <BadgeCheck size={17} className="verified" aria-label="인증됨" /> : null}</span><p>{partner.handle} · {partner.city}</p><small>{partner.online ? "지금 대화 가능" : "오늘 활동"}</small></div>
          <span className="match-score"><strong>{match.score}</strong><small>% 일치</small></span>
        </div>

        <div className="single-match-facts">
          <span><Languages size={15} /><small>언어 교환</small><strong>{partner.native} ⇄ {partner.learning}</strong></span>
          <span><Clock3 size={15} /><small>활동 시간</small><strong>{partner.activeTime}</strong></span>
          <span><Target size={15} /><small>학습 목표</small><strong>{partner.goal}</strong></span>
        </div>

        <p className="single-match-bio">{partner.bio}</p>
        <div className="preference-summary compact">{preferenceSummary.map((item) => <span key={item}><Check size={11} /> {item}</span>)}</div>

        <div className="single-match-reasons">
          <strong><Sparkles size={14} /> 자동 매칭된 이유</strong>
          <div>{match.matchReasons.slice(0, 3).map((reason) => <span key={reason}><Check size={11} /> {reason}</span>)}</div>
        </div>

        <button className="single-match-opener" type="button" onClick={() => onChat(partner)}><MessageCircle size={16} /><span><small>추천 첫 질문</small><strong>{match.icebreaker}</strong></span><ChevronRight size={16} /></button>
        <footer><button type="button" onClick={() => onProfile(partner)}>프로필 보기</button><button type="button" onClick={() => onChat(partner)}><MessageCircle size={16} /> 대화 시작</button></footer>
      </article>

      <div className="next-match-note"><CalendarDays size={16} /><span><strong>다음 자동 매칭은 내일 오전 9시</strong><small>조건을 바꾸면 오늘의 추천도 바로 다시 계산돼요.</small></span><button type="button" onClick={onFilters}>조건 변경</button></div>
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
  onToast: (message: string) => void;
}) {
  return (
    <div className="view community-view">
      <div className="community-toolbar">
        <div className="segmented-tabs" role="tablist" aria-label="커뮤니티 피드">
          <button type="button" role="tab" aria-selected={tab === "recommended"} className={tab === "recommended" ? "active" : ""} onClick={() => setTab("recommended")}>추천</button>
          <button type="button" role="tab" aria-selected={tab === "learning"} className={tab === "learning" ? "active" : ""} onClick={() => setTab("learning")}>영어</button>
          <button type="button" role="tab" aria-selected={tab === "following"} className={tab === "following" ? "active" : ""} onClick={() => setTab("following")}>팔로잉</button>
        </div>
        <span>{posts.length}개의 새 글</span>
      </div>

      <div className="feed-grid">
        {posts.map((post) => (
            <article className="feed-post" key={post.id}>
              <header className="post-header">
                <button className="post-author" type="button" onClick={() => onProfile(post.authorId)}>
                  <Avatar name={post.author} flag={post.flag} accent={post.accent} size="sm" online={post.authorId === "maya"} />
                  <span><strong>{post.author}{post.authorId === "maya" ? <BadgeCheck size={14} className="verified" /> : null}</strong><small>{post.handle} · {post.time}</small></span>
                </button>
                <div className="post-meta">
                  <Pill tone="language">{post.language} · {post.level}</Pill>
                  <button type="button" aria-label="게시물 메뉴" onClick={() => onReport(post.author)}><Ellipsis size={19} /></button>
                </div>
              </header>
              <p className="post-copy">{post.text}</p>
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
                  <button type="button" onClick={() => onToast("교정 문장을 복습 카드에 저장했어요")}><Bookmark size={14} /> 복습에 저장</button>
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
}: {
  conversations: Conversation[];
  selected: Conversation;
  mobileThreadOpen: boolean;
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
  const [translatedMessages, setTranslatedMessages] = useState<Set<string>>(new Set(["m1"]));
  const [coachOpen, setCoachOpen] = useState(true);
  const [coachLoading, setCoachLoading] = useState(false);
  const [supportResult, setSupportResult] = useState<{ conversationId: string; data: ConversationSupport } | null>(null);
  const conversationSupport = supportResult?.conversationId === selected.id ? supportResult.data : fallbackConversationSupport(selected.name);
  const filtered = conversations.filter((item) => listTab === "turn" ? item.myTurn : listTab === "requests" ? item.id === "chat-aiko" : true);

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
        <label className="chat-search"><Search size={16} /><input type="search" placeholder="이름 또는 대화 검색" /></label>
        <div className="chat-list-tabs">
          <button type="button" className={listTab === "all" ? "active" : ""} onClick={() => setListTab("all")}>전체</button>
          <button type="button" className={listTab === "turn" ? "active" : ""} onClick={() => setListTab("turn")}>내 차례 <span>4</span></button>
          <button type="button" className={listTab === "requests" ? "active" : ""} onClick={() => setListTab("requests")}>요청함</button>
        </div>
        <div className="conversation-list">
          {filtered.map((conversation) => (
            <button
              type="button"
              className={`conversation-item ${selected.id === conversation.id ? "active" : ""}`}
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
            >
              <Avatar name={conversation.name} flag={conversation.flag} accent={conversation.accent} size="sm" online={conversation.online} />
              <span className="conversation-copy">
                <span className="conversation-name"><strong>{conversation.name}</strong><small>{conversation.time}</small></span>
                <span className={conversation.typing ? "typing" : ""}>{conversation.typing ? "입력 중…" : conversation.preview}</span>
                <span className="conversation-labels">
                  {conversation.myTurn ? <i>내 차례</i> : null}
                  {conversation.group ? <i className="group-label"><Users size={11} /> 그룹</i> : null}
                  {conversation.muted ? <i>알림 끔</i> : null}
                </span>
              </span>
              {conversation.unread ? <span className="unread-count">{conversation.unread}</span> : null}
            </button>
          ))}
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
            <IconButton label="대화 메뉴" icon={Ellipsis} onClick={onReport} />
          </div>
        </header>

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
                    <button type="button" onClick={() => onToast("교정 문장을 복습 카드에 저장했어요")}><Bookmark size={14} /> 표현 저장</button>
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

        <form className="message-composer" onSubmit={onSend}>
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
          <small className="composer-hint"><WandSparkles size={12} /> Enter로 줄바꿈 · 전송 전 문법 힌트는 데모로 제공돼요</small>
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
        <div><span>VOICE ROOMS</span><h1>보이스룸</h1><p>관심 있는 주제의 방을 골라 듣거나 직접 만들어보세요.</p></div>
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

function LearnView({
  settings,
  setSettings,
  onOnboarding,
  onToast,
}: {
  settings: { dmRequests: boolean; hideLocation: boolean; correctionAlerts: boolean };
  setSettings: React.Dispatch<React.SetStateAction<{ dmRequests: boolean; hideLocation: boolean; correctionAlerts: boolean }>>;
  onOnboarding: () => void;
  onToast: (message: string) => void;
}) {
  const toggle = (key: keyof typeof settings) => setSettings((current) => ({ ...current, [key]: !current[key] }));
  return (
    <div className="view learn-view compact-learn">
      <header className="simple-view-header">
        <div><span>MY LEARNING</span><h1>내 학습</h1><p>프로필, 학습 기록과 주요 설정을 한 화면에서 관리하세요.</p></div>
        <button className="secondary-button profile-settings-link" type="button" onClick={() => onToast("프로필 설정을 열었어요")}><Settings size={16} /> 프로필 설정</button>
      </header>

      <section className="compact-profile-card">
        <Avatar name={currentUser.name} flag={currentUser.flag} accent="violet" size="lg" online />
        <div><span><h2>{currentUser.name}</h2><BadgeCheck size={16} className="verified" /></span><p>{currentUser.handle}</p><small>한국어 원어민 · 영어 {currentUser.level}</small></div>
        <button type="button" onClick={() => onToast("프로필 설정을 열었어요")}><PenLine size={15} /> 수정</button>
      </section>

      <section className="learn-overview-grid" aria-label="학습 요약">
        <article><span className="summary-icon coral"><Flame size={18} /></span><small>연속 학습</small><strong>{currentUser.streak}<em>일</em></strong></article>
        <article><span className="summary-icon violet"><Timer size={18} /></span><small>이번 주 대화</small><strong>145<em>분</em></strong></article>
        <article><span className="summary-icon mint"><Bookmark size={18} /></span><small>저장한 표현</small><strong>{savedPhrases.length}<em>개</em></strong></article>
        <article><span className="summary-icon amber"><PenLine size={18} /></span><small>받은 교정</small><strong>18<em>개</em></strong></article>
      </section>

      <div className="learn-compact-columns">
        <section className="saved-phrases-card">
          <header><span><strong>저장한 표현</strong><small>{savedPhrases.length}개 · 약 4분</small></span><button type="button" onClick={() => onToast("전체 저장 표현을 열었어요")}>전체 <ChevronRight size={15} /></button></header>
          <div className="phrase-list">
            {savedPhrases.map((item, index) => <article key={item.phrase}><button type="button" className="phrase-play" onClick={() => onToast("표현을 재생했어요")}><Volume2 size={16} /></button><span><strong>{item.phrase}</strong><small>{item.meaning}</small><em>{item.source}</em></span><span className={index === 0 ? "due-now" : ""}>{item.due}</span></article>)}
          </div>
          <button className="review-button" type="button" onClick={() => onToast("4분 복습 세션을 시작했어요")}><BookOpenCheck size={17} /> 4분 복습 시작</button>
        </section>

        <section className="settings-card">
          <header><span><strong>계정 및 학습 설정</strong><small>변경 내용은 이 기기에 반영돼요</small></span><Settings size={18} /></header>
          <button className="profile-settings-link" type="button" onClick={() => onToast("프로필 설정을 열었어요")}><span className="setting-icon"><PenLine size={17} /></span><span><strong>프로필 설정</strong><small>사진, 자기소개, 관심사 수정</small></span><ChevronRight size={15} /></button>
          <button className="profile-settings-link" type="button" onClick={onOnboarding}><span className="setting-icon"><Target size={17} /></span><span><strong>언어 및 목표</strong><small>학습 언어와 목표 다시 설정</small></span><ChevronRight size={15} /></button>
          <SettingRow icon={Bell} title="메시지 알림" description="새 메시지가 오면 알려주기" checked={settings.dmRequests} onChange={() => toggle("dmRequests")} />
          <SettingRow icon={LockKeyhole} title="정밀 위치 숨기기" description="도시 수준만 프로필에 표시" checked={settings.hideLocation} onChange={() => toggle("hideLocation")} />
          <SettingRow icon={PenLine} title="교정 알림" description="내 문장이 교정되면 알려주기" checked={settings.correctionAlerts} onChange={() => toggle("correctionAlerts")} />
          <button className="blocked-link" type="button" onClick={() => onToast("차단 사용자 목록을 열었어요")}><Flag size={16} /> 신고 및 차단 관리 <ChevronRight size={15} /></button>
        </section>
      </div>
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
  roomHandRaised,
  setRoomHandRaised,
  roomMicOn,
  setRoomMicOn,
  exchangeLength,
  setExchangeLength,
  matchPreferences,
  onSaveMatchPreferences,
}: {
  modal: Exclude<ModalState, null>;
  onClose: () => void;
  onStartChat: (partner: Partner) => void;
  onPublish: (text: string) => void;
  onCreateRoom: (details: { title: string; topic: string; language: string; level: string }) => void;
  onReport: (target: string) => void;
  onToast: (message: string) => void;
  roomHandRaised: boolean;
  setRoomHandRaised: (value: boolean) => void;
  roomMicOn: boolean;
  setRoomMicOn: (value: boolean) => void;
  exchangeLength: number;
  setExchangeLength: (value: number) => void;
  matchPreferences: MatchPreferences;
  onSaveMatchPreferences: (preferences: MatchPreferences) => Promise<void>;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={`modal modal-${modal.type}`} role="dialog" aria-modal="true" aria-label={modalLabel(modal.type)}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="닫기"><X size={20} /></button>
        {modal.type === "profile" ? <ProfileModal partner={modal.partner} onStartChat={onStartChat} onReport={() => onReport(modal.partner.name)} onToast={onToast} /> : null}
        {modal.type === "filters" ? <MatchingPreferencesModal initial={matchPreferences} onClose={onClose} onSave={onSaveMatchPreferences} onToast={onToast} /> : null}
        {modal.type === "compose" ? <ComposeModal onPublish={onPublish} onToast={onToast} /> : null}
        {modal.type === "search" ? <SearchModal onStartChat={onStartChat} onToast={onToast} /> : null}
        {modal.type === "create-room" ? <CreateRoomModal onCreate={onCreateRoom} /> : null}
        {modal.type === "room" ? <RoomModal room={modal.room} handRaised={roomHandRaised} setHandRaised={setRoomHandRaised} micOn={roomMicOn} setMicOn={setRoomMicOn} onClose={onClose} onReport={() => onReport(modal.room.title)} onToast={onToast} /> : null}
        {modal.type === "exchange" ? <ExchangeModal length={exchangeLength} setLength={setExchangeLength} onClose={onClose} onToast={onToast} /> : null}
        {modal.type === "report" ? <ReportModal target={modal.target} onCancel={onClose} onConfirm={() => onReport(modal.target)} /> : null}
        {modal.type === "onboarding" ? <OnboardingModal onClose={onClose} onToast={onToast} /> : null}
      </div>
    </div>
  );
}

function modalLabel(type: Exclude<ModalState, null>["type"]) {
  const labels: Record<Exclude<ModalState, null>["type"], string> = { profile: "파트너 프로필", filters: "매칭 설정", compose: "새 게시물", search: "통합 검색", "create-room": "보이스룸 만들기", room: "보이스룸", exchange: "언어 교환 세션", report: "신고 및 차단", onboarding: "학습 목표 설정" };
  return labels[type];
}

function ProfileModal({ partner, onStartChat, onReport, onToast }: { partner: Partner; onStartChat: (partner: Partner) => void; onReport: () => void; onToast: (message: string) => void }) {
  return (
    <div className="profile-modal-content">
      <div className={`profile-cover cover-${partner.accent}`}><span className="cover-pattern" /></div>
      <div className="profile-modal-head">
        <Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="xl" online={partner.online} />
        <div><span><h2>{partner.name}</h2>{partner.verified ? <BadgeCheck size={18} className="verified" /> : null}</span><p>{partner.handle} · {partner.city}</p></div>
        <div className="profile-head-actions"><IconButton label="프로필 신고" icon={Flag} onClick={onReport} /><button className="primary-button" type="button" onClick={() => onStartChat(partner)}><MessageCircle size={17} /> 대화 시작</button></div>
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
        <p>언어, 지역, 관심사와 활동 시간이 가까운 한 사람을 매일 오전 9시에 자동으로 연결해요.</p>
      </header>
      <div className="form-section">
        <span className="field-label">배우고 싶은 언어</span>
        <div className="choice-row three-columns">
          {[{ value: "en", label: "영어", flag: "🇺🇸" }, { value: "es", label: "스페인어", flag: "🇪🇸" }, { value: "ja", label: "일본어", flag: "🇯🇵" }].map((item) => (
            <button type="button" className={preferences.targetLanguages.includes(item.value) ? "active" : ""} key={item.value} onClick={() => setPreferences((current) => ({ ...current, targetLanguages: [item.value] }))}>{item.flag} {item.label}</button>
          ))}
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
      <div className="matching-schedule-note"><CalendarClock size={18} /><span><strong>다음 매칭 · 내일 오전 9시</strong><small>설정은 이 기기에 저장되며 오늘의 mock 추천에도 즉시 반영됩니다.</small></span><Pill tone="success">1명</Pill></div>
      <div className="modal-footer">
        <button className="text-button" type="button" onClick={() => { setPreferences(defaultMatchPreferences); onToast("기본 매칭 조건으로 되돌렸어요"); }}><RotateCcw size={15} /> 초기화</button>
        <button className="primary-button" type="button" disabled={saving || !preferences.targetLanguages.length || !preferences.availability.length} onClick={() => void save()}>{saving ? "저장 중…" : "설정 저장하고 오늘의 매칭 보기"}</button>
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
  return <div className="search-modal-content"><header><Search size={21} /><input aria-label="통합 검색" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="사람, 언어, 주제, 저장한 표현 검색" /><kbd>ESC</kbd></header><div className="search-chips"><span>빠른 검색</span>{["영어 원어민", "지금 온라인", "#여행", "저장한 표현"].map((item) => <button type="button" key={item} onClick={() => setQuery(item.replace("#", ""))}>{item}</button>)}</div><section><h3>{query ? `“${query}” 검색 결과` : "추천 파트너"}</h3>{results.length ? results.map((partner) => <button className="search-result" type="button" key={partner.id} onClick={() => onStartChat(partner)}><Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="sm" online={partner.online} /><span><strong>{partner.name}</strong><small>{partner.native} ⇄ {partner.learning} · {partner.interests.join(" · ")}</small></span><Pill tone="success">{partner.compatibility}%</Pill><ChevronRight size={16} /></button>) : <div className="empty-search"><Search size={28} /><strong>검색 결과가 없어요</strong><p>언어나 관심사를 더 짧게 입력해보세요.</p></div>}</section><footer><span><Monitor size={14} /> 어디서든 <kbd>Ctrl</kbd> + <kbd>K</kbd></span><button type="button" onClick={() => onToast("전체 검색 결과 화면을 열었어요")}>전체 검색 보기</button></footer></div>;
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

function RoomModal({ room, handRaised, setHandRaised, micOn, setMicOn, onClose, onReport, onToast }: { room: PracticeRoom; handRaised: boolean; setHandRaised: (value: boolean) => void; micOn: boolean; setMicOn: (value: boolean) => void; onClose: () => void; onReport: () => void; onToast: (message: string) => void }) {
  return <div className={`room-modal-content room-state-${room.accent}`}><header><div><Pill tone="live"><span className="live-dot" /> LIVE · {room.listeners || 1}명</Pill><h2>{room.title}</h2><p>{room.language} · {room.level} · 호스트 {room.hostFlag} {room.host}</p></div><IconButton label="방 신고" icon={Flag} onClick={onReport} /></header><div className="room-stage"><div className="stage-seat speaking"><Avatar name={room.host} flag={room.hostFlag} accent={room.accent} size="lg" online /><strong>{room.host}</strong><small>호스트 · 말하는 중</small><span><Mic size={13} /></span></div>{room.speakers.slice(1).map((speaker, index) => <div className="stage-seat" key={speaker}><Avatar name={speaker} accent={(["mint", "amber", "blue"] as Accent[])[index % 3]} size="md" /><strong>{speaker}</strong><small>{index === 0 ? "모더레이터" : "스피커"}</small><span><Mic size={13} /></span></div>)}<button className={`stage-seat empty ${handRaised ? "waiting" : ""}`} type="button" onClick={() => setHandRaised(!handRaised)}><span><Plus size={20} /></span><strong>{handRaised ? "승인 대기 중" : "빈 자리"}</strong><small>{handRaised ? "호스트가 확인하고 있어요" : "눌러서 발언 요청"}</small></button></div><div className="live-caption"><span><Volume2 size={15} /> 실시간 자막 · 데모</span><p>“What is one small win you had today?”</p><button type="button" onClick={() => onToast("선택한 문장을 번역했어요")}>문장 번역</button></div><div className="room-chat"><span><b>Nina</b> Welcome! Listening only is totally okay 👋</span><span><b>Joon</b> My small win was finishing a book!</span></div><footer><button className={micOn ? "mic-active" : ""} type="button" onClick={() => { setMicOn(!micOn); onToast(micOn ? "마이크를 껐어요" : "마이크를 켰어요 · 데모"); }} disabled={!handRaised}><Mic size={19} />{micOn ? "마이크 켜짐" : handRaised ? "마이크 켜기" : "먼저 손들기"}</button><button type="button" onClick={() => { setHandRaised(!handRaised); onToast(handRaised ? "발언 요청을 취소했어요" : "손을 들었어요. 호스트 승인을 기다려요"); }}><UserPlus size={19} />{handRaised ? "손 내리기" : "손들기"}</button><button className="leave-room" type="button" onClick={onClose}>나가기</button></footer></div>;
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
      <div className="modal-footer"><button className="secondary-button" type="button" onClick={onCancel}>취소</button><button className="danger-button" type="button" onClick={onConfirm}><Flag size={16} /> 신고 보내기</button></div>
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
