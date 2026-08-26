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
  Cloud,
  Compass,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
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
  PenLine,
  Phone,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Timer,
  Target,
  Trash2,
  Trophy,
  Users,
  User,
  UserPlus,
  UsersRound,
  Volume2,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  currentUser,
  initialRoomMessages,
  languageOptions,
  rooms,
  type SavedPhrase,
  type Accent,
  type ChatMessage,
  type Conversation,
  type FeedPost,
  type Partner,
  type PostReply,
  type PracticeRoom,
  type RoomMessage,
} from "@/app/lib/demo-data";
import { I18nProvider, useLocaleRerender, localizeClock, LOCALES, LOCALE_LABEL, msg, t, tx, useLocale, type MessageKey } from "@/app/lib/i18n";
import { SignIn } from "./SignIn";
import { api, accentFor, relativeTime as liveRelativeTime, type ApiProfile, type ApiPost, type ApiConversation, type ApiMessage, toFeedPost, toConversation, toChatMessage, toSavedPhrase, toPostReply, toPartner, languageName, type ApiSavedPhrase, type ApiCorrection, type ApiReceivedLike, type ApiReply } from "../lib/live-data";
import { canSubmit, checkText, LIMITS, readStoredJson } from "@/app/lib/validation";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type Section = "discover" | "community" | "chats" | "practice" | "learn";

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

/**
 * 설정.
 *
 * 여기 있는 두 항목은 모두 서버에 남고 실제로 무언가를 바꿉니다.
 * 알림 켜고 끄기와 자동 동기화 스위치는 뺐습니다 — 알림을 보낼 곳이 아직
 * 없고, 동기화는 끌 수 있는 것이 아니라 늘 켜져 있습니다. 아무 일도 하지 않는
 * 스위치는 없는 것만 못합니다.
 */
type AppSettings = {
  /** 남에게 내 도시를 감춥니다. 서버의 프로필에 남습니다. */
  hideLocation: boolean;
  /** 누가 바로 DM 을 보낼 수 있는지. 서버가 이 값으로 요청함 라우팅을 정합니다. */
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
  | { type: "review"; items: SavedPhrase[] }
  | { type: "profile"; partner: Partner }
  | { type: "filters" }
  | { type: "compose" }
  | { type: "search" }
  | { type: "room"; room: PracticeRoom }
  | { type: "create-room" }
  | { type: "exchange" }
  | { type: "partner-list" }
  | { type: "likes" }
  | { type: "report"; target: string; targetId?: string; targetType?: "user" | "post" | "room" }
  | { type: "onboarding" }
  | { type: "confirm"; title: string; body: string; confirmLabel: string; onConfirm: () => void }
  | null;

/** 게시물 작성 화면에서 넘기는 옵션. */
type PublishOptions = { requestCorrection: boolean; visibility: "public" | "partners"; tags: string[]; image: string; audio: string };

/** 신고 제출 시 화면에서 넘기는 선택값. */
type ReportOptions = {
  reason?: string;
  block?: boolean;
  targetId?: string;
  targetType?: "user" | "post" | "room";
};

/** mock API 가 돌려주는 신고 접수 상태 중 화면에서 쓰는 부분. */
type SafetyReportInfo = {
  id: string;
  status: "received" | "triaging" | "action-taken" | "closed";
  submittedAt: string;
  nextUpdateBy?: string;
};

const reportStatusLabels: Record<SafetyReportInfo["status"], string> = {
  received: msg("접수 완료"),
  triaging: msg("검토 중"),
  "action-taken": msg("조치 완료"),
  closed: msg("처리 종료"),
};

/** mock API(/api/account/verification) 의 인증 단계. */
type VerificationStepInfo = {
  type: "email" | "phone" | "identity";
  status: "not-started" | "pending" | "verified";
};

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

const genderLabels: Record<PartnerGender, string> = {
  any: msg("성별 무관"),
  same: msg("같은 성별 우선"),
  women: msg("여성"),
  men: msg("남성"),
};

const intentLabels: Record<MatchIntent, string> = {
  "language-exchange": msg("언어 교환"),
  friendship: msg("친구 만들기"),
  "voice-practice": msg("음성 연습"),
  culture: msg("문화 교류"),
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

/** mock 백엔드(mock-api/data.ts)에서 conversationGuides 가 준비된 파트너 ID 목록. */

/** `report-<uuid>` 를 화면용 접수번호로 줄입니다. */
const shortReportId = (id: string): string => `LL-${id.replace(/^report-/, "").slice(0, 8).toUpperCase()}`;

/** 보이스룸 실시간 자막 데모 문장. */
const ROOM_CAPTION = "What is one small win you had today?";

/** 한글 포함 여부(가-힣 유니코드 범위) — 번역 대상 언어와 음성 언어를 고를 때 씁니다. */
const HANGUL_PATTERN = /[\uAC00-\uD7A3]/;

/** 화면의 DM 수신 범위 ↔ mock API(/api/dm/privacy) 의 whoCanMessage 값 대응. */
const dmScopeToApi: Record<DmScope, string> = { matches: "matches", mutuals: "mutual-follows", anyone: "everyone" };
const dmScopeFromApi: Record<string, DmScope> = { matches: "matches", "mutual-follows": "mutuals", followers: "mutuals", everyone: "anyone" };

/**
 * 브라우저 내장 음성 합성으로 문장을 읽어줍니다. 외부 서비스 없이 동작하며,
 * 지원하지 않는 환경이면 false 를 돌려줘 호출한 쪽이 안내할 수 있게 합니다.
 */
function speakText(text: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) return false;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = HANGUL_PATTERN.test(text) ? "ko-KR" : /[ぁ-んァ-ヶ一-龯]/.test(text) ? "ja-JP" : "en-US";
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

/**
 * 서버가 준 사람을 화면이 쓰는 모양으로.
 *
 * 예전에는 이름이 같으면 우리가 들고 있던 fixture 프로필을 대신 썼습니다.
 * 진짜 사용자가 생기고 나서는 그게 곧 거짓말이 됩니다 — 서울에 사는 Aiko 가
 * fixture 때문에 "일본 · 도쿄"로 보였습니다. 이제 서버 값만 씁니다.
 */
function displayPartnerFromApi(partner: ApiProfile, score: number): Partner {
  return toPartner(partner, score);
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
  { id: "learn", label: msg("프로필"), shortLabel: msg("프로필"), icon: User, description: msg("내 글과 학습 기록을 확인하세요") },
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
  const ampm = h < 12 ? t("오전") : t("오후");
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${hour12}:${m}`;
}

const accentStyle = (accent: Accent): CSSProperties => ({
  "--avatar-accent": `var(--accent-${accent})`,
} as CSSProperties);

/**
 * 국기.
 *
 * 이모지 대신 SVG 를 씁니다 — 이모지는 글꼴에 따라 크기와 모양이 제각각이고,
 * 윈도우에서는 국기가 아예 두 글자(KR)로 보입니다. 정사각형 SVG 라 원형으로
 * 잘라도 찌그러지지 않습니다.
 *
 * 아직 파일이 없는 나라는 지구본으로 둡니다 — 다른 나라 국기를 대신 보여주는
 * 것보다는 낫습니다.
 */
function CountryFlag({ code, size = 16 }: { code?: string; size?: number }) {
  const lower = (code || "").trim().toLocaleLowerCase();
  if (!/^[a-z]{2}$/.test(lower)) return <span className="flag-fallback" style={{ fontSize: size }} aria-hidden="true">🌐</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="flag-icon" src={`/flags/${lower}.svg`} alt="" width={size} height={size} loading="lazy" />
  );
}

function Avatar({
  name,
  flag,
  accent = "violet",
  size = "md",
  online,
  photo,
  countryCode,
}: {
  name: string;
  flag?: string;
  accent?: Accent;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  online?: boolean;
  /** 프로필 사진. 없으면 사람 모양 자리표시자를 그립니다. */
  photo?: string;
  /** 국가 코드(KR·JP…). 있으면 국기 배지를 답니다. */
  countryCode?: string;
}) {
  return (
    <span className={`avatar avatar-${size}`} style={accentStyle(accent)} role="img" aria-label={name}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="avatar-photo" src={photo} alt="" />
      ) : (
      <span className="avatar-initials">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8.6" r="3.8" />
          <path d="M12 13.6c-4.2 0-7.6 2.7-7.6 6 0 .6.5 1.1 1.1 1.1h13c.6 0 1.1-.5 1.1-1.1 0-3.3-3.4-6-7.6-6Z" />
        </svg>
      </span>
      )}
      {countryCode || flag ? <span className="avatar-flag"><CountryFlag code={countryCode} /></span> : null}
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

function LingoLoopScreens({ me, onSignedOut }: { me: ApiProfile; onSignedOut: () => void }) {
  setSignedInId(me.id);
  const [section, setSection] = useState<Section>("discover");
  const [modal, setModal] = useState<ModalState>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  /* 내 글은 피드와 다른 목록입니다. 상수로 두면 좋아요·삭제가 화면에 남지 않습니다. */
  const [myPostList, setMyPostList] = useState<FeedPost[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChatId, setSelectedChatId] = useState("");
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [conversationDrafts, setConversationDrafts] = useState<Record<string, string>>({});
  const [requestConversationIds, setRequestConversationIds] = useState<Set<string>>(() => new Set());
  const [feedTab, setFeedTab] = useState<"recommended" | "learning" | "following">("recommended");
  const [translatedPosts, setTranslatedPosts] = useState<Set<string>>(new Set());
  const [postTranslations, setPostTranslations] = useState<Record<string, string>>({});
  const [openCorrections, setOpenCorrections] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [roomHandRaised, setRoomHandRaised] = useState(false);
  const [roomMicOn, setRoomMicOn] = useState(false);
  const [minimizedRoom, setMinimizedRoom] = useState<PracticeRoom | null>(null);
  const [roomMessages, setRoomMessages] = useState<RoomMessage[]>(initialRoomMessages);
  const [exchangeLength, setExchangeLength] = useState(15);
  const [settings, setSettings] = useState<AppSettings>({ hideLocation: me.hideLocation ?? true, dmScope: "matches" });
  const [matchPreferences, setMatchPreferences] = useState<MatchPreferences>(defaultMatchPreferences);
  const [dailyRecommendations, setDailyRecommendations] = useState<DailyMatchRecommendation[]>([]);
  const [matchesFailed, setMatchesFailed] = useState(false);
  /**
   * 사람 명부.
   *
   * 글·대화·좋아요에는 상대의 id 만 실려 옵니다. 프로필을 열거나 이름을 보여주려면
   * 그 id 로 사람을 찾아야 하는데, 예전에는 fixture 배열에서 찾았습니다. 진짜
   * 사용자는 거기 없으니 "프로필은 아직 준비 중이에요" 만 떴습니다.
   */
  const [directory, setDirectory] = useState<Partner[]>([]);
  /* 차단한 사람은 명부에서 빠집니다. 이름을 보여주려면 따로 들고 있어야 합니다. */
  const [blockedPartners, setBlockedPartners] = useState<Partner[]>([]);

  const [detail, setDetail] = useState<DetailRoute>(null);
  const [partnerIndex, setPartnerIndex] = useState(0);
  const [signaledPartners, setSignaledPartners] = useState<string[]>([]);
  const [practiceRooms, setPracticeRooms] = useState<PracticeRoom[]>(rooms);
  /* 아래 상태들은 "토스트만 뜨고 끝나던" 동작을 실제로 반영하기 위한 것입니다.
     mock 이지만 화면에는 진짜로 남아야 눌러본 사람이 결과를 확인할 수 있습니다. */
  /* 저장한 표현 — 데모 씨앗 3개로 시작하고, 사용자가 저장한 것이 앞에 쌓입니다.
     예전에는 id 만 Set 에 담아서 저장해도 목록에 안 보였습니다. */
  const [savedItems, setSavedItems] = useState<SavedPhrase[]>([]);
  const [corrections, setCorrections] = useState<ApiCorrection[]>([]);
  const [likesReceived, setLikesReceived] = useState<ApiReceivedLike[]>([]);
  const [sentLikes, setSentLikes] = useState<ApiReceivedLike[]>([]);
  /** 팔로잉·팔로워 수. 보는 사람마다 달라서 id 별로 담아둡니다. */
  const [followCounts, setFollowCounts] = useState<Record<string, { following: number; followers: number; posts: number }>>({});
  /** 크게 보고 있는 사진. 비어 있으면 안 띄웁니다. */
  const [photoViewer, setPhotoViewer] = useState("");
  useEffect(() => {
    if (!photoViewer) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setPhotoViewer(""); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [photoViewer]);

  const loadFollowCounts = useCallback(async (id: string) => {
    try {
      const counts = await api<{ following: number; followers: number; posts: number }>(`/api/partners/${encodeURIComponent(id)}/follow-counts`);
      setFollowCounts((current) => ({ ...current, [id]: counts }));
    } catch {
      /* 못 받아오면 숫자를 감춥니다 — 0 으로 보여주면 없는 것처럼 보입니다. */
    }
  }, []);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [safetyReports, setSafetyReports] = useState<SafetyReportInfo[]>([]);
  /* 숨긴 사람은 서버에 보관하지 않습니다(차단과 달리 상대에게 아무 영향이 없는,
     이 기기의 취향입니다). 대신 이 기기에는 남겨야 합니다 — 예전에는 새로고침하면
     숨긴 사람이 그대로 돌아왔고 설정의 "숨긴 사용자" 목록도 비어 있었습니다. */
  const hiddenStorageKey = `lingoloop-hidden-authors:${me.id}`;
  const [hiddenAuthorIds, setHiddenAuthorIds] = useState<Set<string>>(new Set());
  const [blockedAuthorIds, setBlockedAuthorIds] = useState<Set<string>>(new Set());
  const [mutedChatIds, setMutedChatIds] = useState<Set<string>>(new Set());
  const [mutedRoomIds, setMutedRoomIds] = useState<Set<string>>(new Set());
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileDraft>({
    name: me.name,
    bio: me.bio,
    goal: t("부담 없는 일상 대화"),
    visibility: "public",
  });
  const [replySort, setReplySort] = useState<"popular" | "recent">("popular");
  const toastTimer = useRef<number | null>(null);

  /**
   * 서버에서 화면에 필요한 것을 한 번에 받아옵니다.
   *
   * 예전에는 fixture 를 들고 시작했습니다. 이제는 빈 화면으로 시작해 여기서 채웁니다 —
   * 실패하면 가짜 데이터로 되돌아가지 않고 빈 상태를 그대로 보여줍니다. 가짜를
   * 섞으면 사용자는 자기 데이터가 사라졌는지 서버가 죽었는지 알 수 없습니다.
   */
  /**
   * id 로 사람 찾기. 명부에 없으면 오늘의 추천에서 찾습니다
   * (추천에는 있지만 명부 100명 안에는 없을 수 있습니다).
   */
  const findPartner = useCallback(
    (id?: string): Partner | undefined => {
      if (!id) return undefined;
      return (
        directory.find((person) => person.id === id || person.handle === `@${id}`) ||
        blockedPartners.find((person) => person.id === id) ||
        dailyRecommendations.find((item) => item.partner.id === id)?.partner
      );
    },
    [directory, blockedPartners, dailyRecommendations],
  );

  /**
   * 프로필 저장.
   *
   * 예전에는 화면 상태만 바꾸고 "저장했어요" 라고 알렸습니다. 새로고침하면
   * 예전 이름으로 돌아왔고, 다른 사람에게는 바뀐 적도 없었습니다.
   * 학습 목표는 서버에서 학습 언어에 딸린 값이라 그 자리에 넣어 보냅니다.
   */
  const saveProfile = async (next: ProfileDraft) => {
    const previous = profile;
    setProfile(next);
    try {
      const learning = me.learningLanguages?.length
        ? me.learningLanguages.map((item, index) => (index === 0 ? { ...item, goal: next.goal || item.goal } : item))
        : undefined;
      await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: next.name, bio: next.bio, ...(learning ? { learningLanguages: learning } : {}) }),
      });
      showToast(t("프로필을 저장했어요"));
      void reload();
    } catch (caught) {
      setProfile(previous);
      showToast(caught instanceof Error ? caught.message : t("프로필을 저장하지 못했어요."));
    }
  };

  const reload = useCallback(async () => {
    try {
      const [postList, conversationList, requestList, phraseList, correctionList, likeList, followList, blockList, peopleList, sentLikeList] = await Promise.all([
        api<ApiPost[]>("/api/posts"),
        api<ApiConversation[]>("/api/conversations"),
        api<ApiConversation[]>("/api/conversations?box=requests"),
        api<ApiSavedPhrase[]>("/api/saved-phrases"),
        api<ApiCorrection[]>("/api/corrections/received"),
        api<ApiReceivedLike[]>("/api/likes/received"),
        api<string[]>("/api/follows"),
        api<Array<{ blockedId: string; partner: ApiProfile }>>("/api/blocks"),
        api<ApiProfile[]>("/api/partners"),
        api<ApiReceivedLike[]>("/api/likes/sent"),
      ]);
      setSentLikes(sentLikeList || []);
      void loadFollowCounts(me.id);
      setSignaledPartners((sentLikeList || []).map((item) => item.partner.id));
      setDirectory((peopleList || []).map((person) => toPartner(person)));
      setSavedItems((phraseList || []).map(toSavedPhrase));
      setCorrections(correctionList || []);
      setLikesReceived(likeList || []);
      setFollowingIds(followList || []);
      setBlockedAuthorIds(new Set((blockList || []).map((row) => row.blockedId)));
      setBlockedPartners((blockList || []).filter((row) => row.partner).map((row) => toPartner(row.partner)));
      const savedIds = new Set((phraseList || []).map((item) => item.id));
      const feed = (postList || []).map((post) => ({ ...toFeedPost(post), saved: savedIds.has(post.id) }));
      setPosts(feed);
      setMyPostList(feed.filter((post) => post.authorId === me.id));

      const rooms = [...(conversationList || []), ...(requestList || [])];
      setConversations(rooms.map((room) => toConversation(room)));
      setRequestConversationIds(new Set((requestList || []).map((room) => room.id)));
      setSelectedChatId((current) => (rooms.some((room) => room.id === current) ? current : rooms[0]?.id ?? ""));
    } catch {
      /* 실패해도 빈 화면을 유지합니다. 오류는 아래 개별 동작에서 알립니다. */
    }
  }, [me.id, loadFollowCounts]);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  // 숨긴 사람 복원. 서버 값이 아니라 이 기기의 기록이라 마운트 이후에 읽습니다.
  // (다른 복원 코드와 같이 rAF 뒤로 미룹니다 — 하이드레이션 중 setState 를 피합니다.)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = readStoredJson<string[]>(hiddenStorageKey, (value): value is string[] =>
        Array.isArray(value) && value.every((item) => typeof item === "string"));
      if (stored?.length) setHiddenAuthorIds(new Set(stored));
      hiddenRestored.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hiddenStorageKey]);

  /* 복원하기 전에는 쓰지 않습니다. 마운트 직후의 빈 Set 이 먼저 저장되면
     복원할 값을 스스로 지워버립니다. */
  const hiddenRestored = useRef(false);
  useEffect(() => {
    if (!hiddenRestored.current) return;
    try {
      window.localStorage.setItem(hiddenStorageKey, JSON.stringify([...hiddenAuthorIds]));
    } catch {
      // 저장 공간을 못 쓰면 이번 세션에만 유지됩니다.
    }
  }, [hiddenAuthorIds, hiddenStorageKey]);

  /** 고른 대화의 메시지를 채웁니다. 목록만으로는 말풍선을 그릴 수 없습니다. */
  useEffect(() => {
    if (!selectedChatId) return;
    let cancelled = false;
    api<ApiMessage[]>(`/api/conversations/${encodeURIComponent(selectedChatId)}/messages`)
      .then((rows) => {
        if (cancelled) return;
        const messages = (rows || []).map((row) => toChatMessage(row, me.id));
        setConversations((current) => current.map((room) => (room.id === selectedChatId ? { ...room, messages } : room)));
      })
      .catch(() => { /* 대화를 못 읽어도 목록은 그대로 둡니다. */ });
    return () => { cancelled = true; };
  }, [selectedChatId, me.id]);

  const selectedConversation = conversations.find((item) => item.id === selectedChatId) ?? conversations[0];
  /* 내비게이션 배지는 실제 안 읽은 수의 합입니다. 대화를 열면 그 방의 안 읽음이 0이 되어 함께 줄어듭니다. */
  const unreadTotal = conversations.reduce((sum, item) => sum + item.unread, 0);
  const draft = selectedConversation ? conversationDrafts[selectedConversation.id] ?? "" : "";
  const setDraft = (text: string) => {
    if (!selectedConversation) return;
    setConversationDrafts((current) => ({ ...current, [selectedConversation.id]: text }));
  };

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
  /** 복습함에 넣고 빼기. 같은 것을 다시 누르면 빠집니다. */
  const savePhrase = async (item: SavedPhrase) => {
    const exists = savedItems.some((saved) => saved.id === item.id);
    // 화면에 먼저 반영하고 서버에 보냅니다. 실패하면 되돌립니다.
    setSavedItems((current) => (exists ? current.filter((saved) => saved.id !== item.id) : [item, ...current]));
    try {
      if (exists) {
        await api(`/api/saved-phrases/${encodeURIComponent(item.id)}`, { method: "DELETE" });
        showToast(t("복습함에서 뺐어요"));
      } else {
        await api("/api/saved-phrases", {
          method: "POST",
          body: JSON.stringify({ id: item.id, phrase: item.phrase, meaning: item.meaning, source: item.source, due: item.due }),
        });
        showToast(t("복습함에 저장했어요"));
      }
    } catch (caught) {
      setSavedItems((current) => (exists ? [item, ...current] : current.filter((saved) => saved.id !== item.id)));
      showToast(caught instanceof Error ? caught.message : t("저장하지 못했어요."));
    }
  };
  const isSaved = (id: string) => savedItems.some((item) => item.id === id);

  /** 숨기기는 되돌릴 수 있어야 합니다 — 프로필 설정의 목록에서 다시 풀 수 있습니다. */
  const hideAuthor = (authorId: string, name: string) =>
    toggleIn(
      setHiddenAuthorIds,
      authorId,
      t("{author}님의 글을 숨겼어요", { author: name }),
      t("{author}님의 글을 다시 봅니다", { author: name }),
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
  const signOut = async () => {
    try {
      await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    } catch {
      /* 서버가 답을 안 해도 이 기기에서는 나갑니다. */
    }
    onSignedOut();
  };

  const blockAuthor = async (authorId: string, name: string) => {
    setBlockedAuthorIds((current) => new Set(current).add(authorId));
    setDetail(null);
    try {
      await api(`/api/partners/${encodeURIComponent(authorId)}/block`, { method: "POST", body: JSON.stringify({}) });
      showToast(t("{author}님을 차단했어요", { author: name }));
      await reload();
    } catch (caught) {
      // 서버에 못 남기면 내 화면에서만 사라진 상태가 됩니다 — 되돌리고 알립니다.
      setBlockedAuthorIds((current) => { const next = new Set(current); next.delete(authorId); return next; });
      showToast(caught instanceof Error ? caught.message : t("차단하지 못했어요."));
    }
  };

  const unblockAuthor = async (authorId: string) => {
    setBlockedAuthorIds((current) => { const next = new Set(current); next.delete(authorId); return next; });
    try {
      await api(`/api/partners/${encodeURIComponent(authorId)}/block`, { method: "DELETE" });
      await reload();
    } catch (caught) {
      setBlockedAuthorIds((current) => new Set(current).add(authorId));
      showToast(caught instanceof Error ? caught.message : t("차단을 풀지 못했어요."));
    }
  };

  // 내가 접수한 신고 상태 — 프로필의 신고센터 카드가 실제 접수 내역을 보여줍니다.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/reports")
      .then((response) => (response.ok ? (response.json() as Promise<{ data?: SafetyReportInfo[] }>) : Promise.reject(new Error(`Mock API returned ${response.status}`))))
      .then((body) => {
        if (!cancelled && body.data?.length) setSafetyReports(body.data);
      })
      .catch(() => {
        // 오프라인이면 카드가 기본 안내 문구를 유지합니다.
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
        return response.json() as Promise<{ data?: { recommendations?: Array<{ partner: ApiProfile; score: number; matchReasons: string[]; icebreaker: string }> } }>;
      })
      .then((body) => {
        if (cancelled) return;
        setDailyRecommendations((body.data?.recommendations || []).slice(0, MAX_DAILY_PARTNERS).map((item) => ({
          partner: displayPartnerFromApi(item.partner, item.score),
          score: item.score,
          matchReasons: item.matchReasons,
          icebreaker: item.icebreaker,
        })));
        setMatchesFailed(false);
      })
      .catch(() => {
        // 추천을 못 받아오면 빈 화면 + 안내입니다. 예전에는 가짜 사람 12명을
        // 대신 보여줬는데, 말을 걸 수 없는 사람들이라 더 나쁩니다.
        if (!cancelled) { setDailyRecommendations([]); setMatchesFailed(true); }
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

  // 검색 모달이 안내하는 전역 단축키 — Ctrl(⌘)+K 로 어디서든 검색을 엽니다.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setModal({ type: "search" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  };

  /**
   * 설정 저장.
   *
   * DM 수신 범위는 서버가 실제로 라우팅에 쓰는 값입니다. 그래서 저장에 실패하면
   * 되돌리고 알립니다 — 예전에는 조용히 넘어가서, 화면에는 "매칭된 사람"이라고
   * 적혀 있는데 서버는 "모든 사람"으로 받는 상태가 될 수 있었습니다.
   * 나머지 항목은 이 기기에만 남습니다.
   */
  const applySettings = (next: AppSettings) => {
    const previous = settings;
    setSettings(next);
    const failed = (caught: unknown) => {
      setSettings(previous);
      showToast(caught instanceof Error ? caught.message : t("설정을 저장하지 못했어요."));
    };

    if (next.hideLocation !== previous.hideLocation) {
      void api("/api/profile", { method: "PATCH", body: JSON.stringify({ hideLocation: next.hideLocation }) })
        .then(() => showToast(next.hideLocation ? t("이제 다른 사람에게 도시가 보이지 않아요") : t("이제 다른 사람에게 도시가 보여요")))
        .catch(failed);
    }

    if (next.dmScope === previous.dmScope) return;
    void api("/api/dm/privacy", {
      method: "POST",
      body: JSON.stringify({
        whoCanMessage: dmScopeToApi[next.dmScope],
        // 허용 범위 밖의 DM 은 받은함이 아니라 요청함으로 갑니다 — 제품 결정이라 항상 켭니다.
        routeOthersToRequests: true,
      }),
    }).catch(failed);
  };

  /**
   * 설정 복원 — 서버에서 가져옵니다.
   *
   * 예전에는 기기(localStorage) 값이 서버를 덮어써서, 폰에서 바꾼 DM 범위가
   * 노트북에서는 옛 값으로 보였습니다. 실제 라우팅은 서버 값으로 도니 서버가 맞습니다.
   * 위치 숨기기도 같은 이유로 프로필(서버)에서 읽습니다.
   */
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void api<{ settings?: { whoCanMessage?: string } }>("/api/dm/privacy")
        .then((body) => {
          const scope = dmScopeFromApi[body.settings?.whoCanMessage ?? ""];
          if (scope) setSettings((current) => ({ ...current, dmScope: scope }));
        })
        .catch(() => {
          // 서버를 못 부르면 기본값(매칭된 사람)을 유지합니다. 안전 설정은 좁은 쪽이 안전합니다.
        });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

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
      showToast(t("매칭 설정을 저장하지 못했어요."));
    }
  };

  const skipPartner = () => {
    setPartnerIndex((current) => current + 1);
  };

  /**
   * 마음 보내기.
   *
   * 예전에는 화면 상태만 바꿨습니다 — 상대에게는 아무 일도 일어나지 않았고
   * 새로고침하면 보낸 기록도 사라졌습니다.
   */
  const signalPartner = (partner: Partner) => {
    setSignaledPartners((current) => (current.includes(partner.id) ? current : [...current, partner.id]));
    setPartnerIndex((current) => current + 1);
    api<{ mutual: boolean }>(`/api/partners/${encodeURIComponent(partner.id)}/like`, { method: "POST" })
      .then((result) =>
        showToast(
          result.mutual
            ? t("{name}님과 서로 마음이 통했어요", { name: partner.name })
            : t("{name}님에게 마음을 보냈어요", { name: partner.name }),
        ),
      )
      .catch((caught) => {
        setSignaledPartners((current) => current.filter((id) => id !== partner.id));
        showToast(caught instanceof Error ? caught.message : t("마음을 보내지 못했어요."));
      });
  };

  /**
   * 팔로우.
   *
   * 커뮤니티에 "팔로잉" 탭이 있고 DM 설정에도 "서로 팔로우" 가 있는데, 정작
   * 팔로우할 자리가 없었습니다. 두 기능 모두 영영 비어 있는 셈이었습니다.
   */
  const toggleFollow = async (partner: Partner) => {
    const wasFollowing = followingIds.includes(partner.id);
    setFollowingIds((current) => (wasFollowing ? current.filter((id) => id !== partner.id) : [...current, partner.id]));
    try {
      const result = await api<{ following: boolean }>(`/api/partners/${encodeURIComponent(partner.id)}/follow`, { method: "POST" });
      setFollowingIds((current) => {
        const without = current.filter((id) => id !== partner.id);
        return result.following ? [...without, partner.id] : without;
      });
      showToast(result.following ? t("{name}님을 팔로우했어요", { name: partner.name }) : t("{name}님 팔로우를 해제했어요", { name: partner.name }));
      void loadFollowCounts(me.id);
      void loadFollowCounts(partner.id);
    } catch (caught) {
      setFollowingIds((current) => (wasFollowing ? [...current.filter((id) => id !== partner.id), partner.id] : current.filter((id) => id !== partner.id)));
      showToast(caught instanceof Error ? caught.message : t("요청을 처리하지 못했어요."));
    }
  };

  /**
   * 대화 기록 내려받기.
   *
   * 예전에는 "준비하고 있어요 · mock" 토스트만 띄우고 끝이었습니다.
   * 메시지는 이미 서버에 다 있으니 받아서 파일로 만들면 됩니다.
   */
  const downloadChats = async () => {
    try {
      const rooms = await api<ApiConversation[]>("/api/conversations");
      const withMessages = await Promise.all(
        (rooms || []).map(async (room) => ({
          [t("상대")]: room.partner?.name ?? t("알 수 없는 상대"),
          [t("메시지")]: (await api<ApiMessage[]>(`/api/conversations/${encodeURIComponent(room.id)}/messages`)).map((message) => ({
            [t("보낸 사람")]: message.senderId === me.id ? me.name : room.partner?.name ?? "",
            [t("시각")]: message.sentAt,
            [t("내용")]: message.text,
          })),
        })),
      );
      const blob = new Blob([JSON.stringify({ [t("내려받은 시각")]: new Date().toISOString(), [t("대화")]: withMessages }, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `lingoloop-${t("대화 기록")}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast(t("대화 기록을 내려받았어요"));
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : t("대화 기록을 내려받지 못했어요."));
    }
  };

  const restartPartners = () => {
    setPartnerIndex(0);
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
    void loadFollowCounts(partner.id);
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

  /** 게시물 번역 — 열려 있으면 닫고, 처음 열면 mock 번역 API 를 호출합니다(실패 시 fixture 번역을 표시). */
  const translatePost = (post: FeedPost) => {
    if (translatedPosts.has(post.id)) {
      toggleSetValue(setTranslatedPosts, post.id);
      return;
    }
    toggleSetValue(setTranslatedPosts, post.id);
    if (postTranslations[post.id]) return;
    void (async () => {
      try {
        const targetLanguage = HANGUL_PATTERN.test(post.text) ? "en" : "ko";
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: post.text, targetLanguage }),
        });
        if (!response.ok) throw new Error(`Mock API returned ${response.status}`);
        const body = await response.json() as { data?: { translatedText?: string } };
        const translatedText = body.data?.translatedText;
        if (translatedText) setPostTranslations((current) => ({ ...current, [post.id]: translatedText }));
      } catch {
        // 오프라인이면 fixture 번역(post.translation)이 그대로 표시됩니다.
      }
    })();
  };

  /** 같은 글이 피드(posts)와 내 글(myPostList)에 따로 있습니다 — id 로 찾아 양쪽 다 고칩니다. */
  const updatePost = (postId: string, change: (post: FeedPost) => FeedPost) => {
    const apply = (items: FeedPost[]) => items.map((post) => (post.id === postId ? change(post) : post));
    setPosts(apply);
    setMyPostList(apply);
    setDetail((current) =>
      current?.kind === "post" && current.post.id === postId
        ? { ...current, post: change(current.post) }
        : current,
    );
  };

  /**
   * 좋아요·복습함 저장.
   *
   * 화면을 먼저 바꾸고 서버에 보냅니다. 예전에는 서버에 아예 보내지 않아서
   * 새로고침하면 눌렀던 하트가 풀렸습니다.
   */
  const togglePost = (postId: string, key: "liked" | "saved") => {
    const post = posts.find((item) => item.id === postId) || myPostList.find((item) => item.id === postId);
    if (!post) return;

    if (key === "saved") {
      // 글 저장은 복습함(저장한 표현)에 그대로 들어갑니다 — 저장 목록이 두 벌이면 어긋납니다.
      void savePhrase({ id: post.id, phrase: post.text, meaning: "", source: post.author, due: "" });
      updatePost(postId, (item) => ({ ...item, saved: !item.saved }));
      return;
    }

    const nextLiked = !post.liked;
    updatePost(postId, (item) => ({ ...item, liked: nextLiked, likes: item.likes + (nextLiked ? 1 : -1) }));
    showToast(nextLiked ? t("좋아요를 눌렀어요") : t("좋아요를 취소했어요"));
    api<{ liked: boolean; likes: number }>(`/api/posts/${encodeURIComponent(postId)}/like`, { method: "POST" })
      .then((result) => updatePost(postId, (item) => ({ ...item, liked: result.liked, likes: result.likes })))
      .catch((caught) => {
        updatePost(postId, (item) => ({ ...item, liked: !nextLiked, likes: item.likes + (nextLiked ? -1 : 1) }));
        showToast(caught instanceof Error ? caught.message : t("요청을 처리하지 못했어요."));
      });
  };

  /** 내 글 삭제. 되돌릴 수 없으므로 한 번 묻고, 상세를 보고 있었다면 함께 닫습니다. */
  const deletePost = (post: FeedPost) => {
    setModal({
      type: "confirm",
      title: t("이 글을 삭제할까요?"),
      body: t("삭제한 글과 거기 달린 답글·교정은 되돌릴 수 없어요."),
      confirmLabel: t("삭제하기"),
      onConfirm: () => {
        /* 화면에서 먼저 지우고 서버에 알립니다. 실패하면 되돌립니다 —
           예전에는 서버에 알리지 않아서 "삭제했어요" 라고 해놓고 새로고침하면
           그대로 있었습니다. */
        const drop = (items: FeedPost[]) => items.filter((item) => item.id !== post.id);
        setPosts(drop);
        setMyPostList(drop);
        setDetail((current) => (current?.kind === "post" && current.post.id === post.id ? null : current));
        api(`/api/posts/${encodeURIComponent(post.id)}`, { method: "DELETE" })
          .then(() => showToast(t("글을 삭제했어요")))
          .catch((caught) => {
            void reload();
            showToast(caught instanceof Error ? caught.message : t("글을 삭제하지 못했어요."));
          });
      },
    });
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
      setConversationDrafts((current) => ({
        ...current,
        [next.id]: dailyRecommendations.find((item) => item.partner.id === partner.id)?.icebreaker ?? dailyMatchDetails[partner.id]?.icebreaker ?? `Hi ${partner.name}! Nice to meet you.`,
      }));
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

    // 화면에는 먼저 붙이고 서버에 보냅니다. 실패하면 방금 붙인 것을 걷어내
    // "보낸 줄 알았는데 안 갔다" 를 만들지 않습니다.
    try {
      await api("/api/conversations/" + encodeURIComponent(selectedConversation.id) + "/messages", {
        method: "POST",
        body: JSON.stringify({ text, type: "text" }),
      });
    } catch (caught) {
      setConversations((items) =>
        items.map((conversation) =>
          conversation.id === selectedConversation.id
            ? { ...conversation, messages: conversation.messages.filter((message) => message.id !== newMessage.id) }
            : conversation,
        ),
      );
      setDraft(text);
      showToast(caught instanceof Error ? caught.message : t("메시지를 보내지 못했어요."));
    }
  };

  /**
   * 사진·음성 보내기.
   *
   * 저장소 버킷이 아직 없어서 파일을 데이터 URI 로 함께 보냅니다. 그대로 보내면
   * 문서 한도(1MB)를 넘기니 사진은 보내기 전에 긴 변 1280px 로 줄이고 JPEG 로
   * 다시 눌러 담습니다(보통 100~200KB). 버킷이 생기면 이 함수가 업로드하고
   * 받은 주소를 media 에 넣기만 하면 됩니다.
   */
  const sendAttachment = async (kind: "image" | "voice", media: string, label: string) => {
    if (!selectedConversation) return;
    const newMessage = { id: `local-${Date.now()}`, mine: true, text: label, time: t("지금"), media, kind };
    setConversations((items) =>
      items.map((conversation) =>
        conversation.id === selectedConversation.id
          ? { ...conversation, preview: label, time: t("지금"), messages: [...conversation.messages, newMessage] }
          : conversation,
      ),
    );
    try {
      await api("/api/conversations/" + encodeURIComponent(selectedConversation.id) + "/messages", {
        method: "POST",
        body: JSON.stringify({ type: kind, media, text: label }),
      });
    } catch (caught) {
      setConversations((items) =>
        items.map((conversation) =>
          conversation.id === selectedConversation.id
            ? { ...conversation, messages: conversation.messages.filter((message) => message.id !== newMessage.id) }
            : conversation,
        ),
      );
      showToast(caught instanceof Error ? caught.message : t("보내지 못했어요."));
    }
  };

  const acceptChatRequest = async (id: string) => {
    try {
      await api(`/api/conversations/${encodeURIComponent(id)}/accept`, { method: "POST", body: JSON.stringify({}) });
      setRequestConversationIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      await reload();
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : t("요청을 수락하지 못했어요."));
    }
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

  const publishPost = async (text: string, options: PublishOptions) => {
    try {
      const saved = await api<ApiPost>("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          text,
          language: me.learningLanguages?.[0]?.code ?? "en",
          targetLanguage: me.nativeLanguages?.[0] ?? "ko",
          visibility: options.visibility,
          requestCorrection: options.requestCorrection,
          tags: options.tags,
          imageUrl: options.image,
          audioUrl: options.audio,
        }),
      });
      const post = toFeedPost(saved);
      setPosts((items) => [post, ...items]);
      setMyPostList((items) => [post, ...items]);
      setModal(null);
      setSection("community");
      showToast(options.requestCorrection ? t("커뮤니티에 게시했어요 · 원어민 교정을 요청했어요") : t("커뮤니티에 게시했어요"));
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : t("글을 올리지 못했어요."));
    }
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
    // 내가 연 방이므로 호스트로 바로 입장합니다. 손들기 없이 처음부터 발언 가능합니다.
    setRoomHandRaised(false);
    setRoomMicOn(true);
    setMinimizedRoom(null);
    setRoomMessages([]);
    setSection("practice");
    setModal({ type: "room", room });
    showToast(t("보이스룸을 열었어요 · 호스트로 입장했어요"));
  };

  /**
   * 신고 접수.
   *
   * 운영자가 보는 화면으로 그대로 갑니다. 그래서 여기서 지어내는 값이 있으면
   * 안 됩니다 — 예전에는 대상 id 가 없으면 "demo-홍길동" 을 만들어 보냈고,
   * 사유 설명에는 늘 "UI 프로토타입에서 제출한 데모 신고입니다" 를 붙였습니다.
   * 진짜 신고가 그 문구를 달고 접수되면 운영자가 걸러낼 수 없습니다.
   */
  const reportTarget = async (target: string, options?: ReportOptions) => {
    if (!options?.targetId) {
      showToast(t("이 대상은 신고할 수 없어요"));
      setModal(null);
      return;
    }
    /* 서버가 받는 사유만 그대로 보내고, 나머지(개인정보 요구 등)는 other 로 접수합니다. */
    const supportedReasons = ["spam", "scam", "harassment", "dating", "other"];
    const reason = options.reason && supportedReasons.includes(options.reason) ? options.reason : "other";
    try {
      const report = await api<SafetyReportInfo>("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          targetType: options.targetType === "room" ? "user" : options.targetType ?? "user",
          targetId: options.targetId,
          reason,
        }),
      });
      setSafetyReports((current) => [report, ...current]);
      setModal(null);
      /* 함께 차단은 서버까지 반영해야 합니다 — 화면에서만 지우면 새로고침에 되살아납니다. */
      if (options.block) await blockAuthor(options.targetId, target);
      showToast(
        options.block
          ? t("신고를 접수하고 {name}님을 차단했어요 · 접수번호 {id}", { name: target, id: shortReportId(report.id) })
          : t("신고가 접수되었어요 · 접수번호 {id}", { id: shortReportId(report.id) }),
      );
    } catch (caught) {
      setModal(null);
      showToast(caught instanceof Error ? caught.message : t("신고를 접수하지 못했어요."));
    }
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
                  aria-label={t(item.label)}
                  aria-current={section === item.id ? "page" : undefined}
                >
                  <Icon size={20} />
                  <span>{t(item.label)}</span>
                  {item.id === "chats" && unreadTotal > 0 ? <span className="nav-count">{unreadTotal}</span> : null}
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
                  aria-label={t(item.label)}
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
        <div className="sidebar-profile-row">
          <button className="sidebar-profile" type="button" aria-label={t("내 프로필")} onClick={() => goToSection("learn")}>
            <Avatar name={profile.name} flag={me.country?.flag ?? "🌐"} accent="violet" size="sm" online photo={me.avatarUrl} countryCode={me.country?.code} />
            <span><strong>{profile.name}</strong><small>{tx(languageName(me.nativeLanguages?.[0] ?? "ko"))} → {tx(languageName(me.learningLanguages?.[0]?.code ?? "en"))}</small></span>
          </button>
          <MenuPopover
            label={t("내 메뉴")}
            align="start"
            items={[
              { id: "settings", label: t("설정"), icon: Settings, onSelect: () => setSettingsOpen(true) },
            ]}
          />
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button className="mobile-brand" type="button" onClick={() => goToSection("discover")} aria-label={t("LingoLoop 홈")}>
            <span className="brand-mark"><Languages size={20} /></span>
            <span className="brand-wordmark">Lingo<span>Loop</span></span>
          </button>
          <div className="topbar-actions">
            <IconButton label={t("검색")} icon={Search} onClick={() => setModal({ type: "search" })} />
            {section === "community" ? <IconButton label={t("글쓰기")} icon={PenLine} className="top-compose-button" onClick={() => setModal({ type: "compose" })} /> : null}
          </div>
        </header>

        <div className="workspace-grid">
          <main id="main-content" className="main-content">
            {detail?.kind === "post" ? (
              <PostDetailView
                post={detail.post}
                onBack={closeDetail}
                onProfile={(authorId) => {
                  if (authorId === me.id) { closeDetail(); goToSection("learn"); return; }
                  const partner = findPartner(authorId);
                  if (partner) openProfile(partner);
                  else showToast(t("이 작성자의 프로필을 열 수 없어요"));
                }}
                onReport={() => setModal({ type: "report", target: detail.post.author, targetId: detail.post.authorId })}
                onToast={showToast}
                saved={isSaved(detail.post.id)}
                onSavePhrase={savePhrase}
                onHideAuthor={hideAuthor}
                onBlockAuthor={blockAuthor}
                onCopyLink={copyLink}
                onTagSelect={(tag) => { setActiveTag(tag); closeDetail(); setSection("community"); }}
                onToggleLike={() => togglePost(detail.post.id, "liked")}
                onDeletePost={() => deletePost(detail.post)}
                sort={replySort}
                onSortChange={setReplySort}
              />
            ) : null}

            {detail?.kind === "profile-edit" ? (
              <ProfileEditView
                value={profile}
                onBack={closeDetail}
                onSave={(next) => { closeDetail(); void saveProfile(next); }}
              />
            ) : null}

            {detail?.kind === "blocked" ? (
              <BlockedListView
                hidden={[...hiddenAuthorIds]}
                blocked={[...blockedAuthorIds]}
                directory={[...directory, ...blockedPartners]}
                onBack={closeDetail}
                onUnhide={(id) => { setHiddenAuthorIds((c) => { const n = new Set(c); n.delete(id); return n; }); }}
                onUnblock={(id) => { void unblockAuthor(id); showToast(t("차단을 해제했어요")); }}
              />
            ) : null}

            {detail?.kind === "profile" ? (
              <ProfileDetailView
                partner={detail.partner}
                onBack={closeDetail}
                onStartChat={(partner) => { closeDetail(); startChat(partner); }}
                onReport={() => setModal({ type: "report", target: detail.partner.name, targetId: detail.partner.id })}
                following={followingIds.includes(detail.partner.id)}
                onToggleFollow={(partner) => void toggleFollow(partner)}
                posts={posts.filter((post) => post.authorId === detail.partner.id)}
                onOpenPost={openPost}
                onBlock={() => blockAuthor(detail.partner.id, detail.partner.name)}
                counts={followCounts[detail.partner.id]}
              />
            ) : null}

            {!detail && section === "discover" ? (
              <DiscoverView
                preferences={matchPreferences}
                dailyRecommendations={dailyRecommendations}
                loadFailed={matchesFailed}
                index={partnerIndex}
                signaledCount={signaledPartners.length}
                onSkip={skipPartner}
                onSignal={signalPartner}
                onRestart={restartPartners}
                onOpenList={() => setModal({ type: "partner-list" })}
                onOpenLikes={() => setModal({ type: "likes" })}
                receivedCount={likesReceived.length}
                onFilters={() => setModal({ type: "filters" })}
              />
            ) : null}
            {!detail && section === "community" ? (
              <CommunityView
                posts={posts}
                tab={feedTab}
                setTab={setFeedTab}
                translated={translatedPosts}
                translations={postTranslations}
                corrections={openCorrections}
                onTranslate={translatePost}
                onCorrection={(id) => toggleSetValue(setOpenCorrections, id)}
                onToggle={togglePost}
                onProfile={(id) => {
                  if (id === me.id) { goToSection("learn"); return; }
                  const partner = findPartner(id);
                  if (partner) openProfile(partner);
                  else showToast(t("이 작성자의 프로필을 열 수 없어요"));
                }}
                onReport={(target, targetId) => setModal({ type: "report", target, targetId })}
                onOpen={openPost}
                hiddenAuthorIds={hiddenAuthorIds}
                blockedAuthorIds={blockedAuthorIds}
                onHideAuthor={hideAuthor}
                onBlockAuthor={blockAuthor}
                activeTag={activeTag}
                onTagSelect={setActiveTag}
                savedItems={savedItems}
                onSavePhrase={savePhrase}
                onCopyLink={copyLink}
                onDeletePost={deletePost}
                myLearningLanguage={languageName(me.learningLanguages?.[0]?.code ?? "en")}
                followingIds={followingIds}
                onOpenPhoto={setPhotoViewer}
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
                  // 대화를 열면 읽은 것으로 처리합니다.
                  setConversations((items) => items.map((item) => (item.id === id && item.unread ? { ...item, unread: 0 } : item)));
                }}
                onBack={() => setMobileThreadOpen(false)}
                onAcceptRequest={acceptChatRequest}
                onDismissRequest={dismissChatRequest}
                draft={draft}
                setDraft={setDraft}
                onSend={sendMessage}
                onSendAttachment={sendAttachment}
                onOpenPhoto={setPhotoViewer}
                onExchange={() => setModal({ type: "exchange" })}
                onProfile={() => {
                  const partner = findPartner(selectedConversation?.partnerId);
                  if (partner) openProfile(partner);
                  else showToast(t("이 작성자의 프로필을 열 수 없어요"));
                }}
                onReport={() => setModal({ type: "report", target: selectedConversation?.name ?? t("대화"), targetId: selectedConversation?.partnerId })}
                onToast={showToast}
                mutedChatIds={mutedChatIds}
                onToggleMute={(id, name) =>
                  toggleIn(setMutedChatIds, id, t("{name}님과의 알림을 껐어요", { name }), t("{name}님과의 알림을 켰어요", { name }))
                }
                onLeaveChat={leaveChat}
                onBlockPartner={(id, name) => leaveChat(id, name, true)}
                onNewChat={() => setModal({ type: "new-chat" })}
                savedItems={savedItems}
                onSavePhrase={savePhrase}
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
                counts={followCounts[me.id]}
                onOpenSettings={() => setSettingsOpen(true)}
                onStartReview={() => setModal({ type: "review", items: savedItems })}
                onOpenPost={openPost}
                onToast={showToast}
                onEditProfile={() => setDetail({ kind: "profile-edit" })}
                savedItems={savedItems}
                onSavePhrase={savePhrase}
                savedCount={savedItems.length}
                profileName={profile.name}
                profileBio={profile.bio}
                me={me}
                corrections={corrections}
                onOpenTag={(tag) => { setActiveTag(tag); goToSection("community"); }}
                myPostList={myPostList}
                onCopyLink={copyLink}
                onDeletePost={deletePost}
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
              <span className="mobile-nav-icon"><Icon size={21} />{item.id === "chats" && unreadTotal > 0 ? <i>{unreadTotal}</i> : null}</span>
              <small>{t(item.shortLabel)}</small>
            </button>
          );
        })}
      </nav>

      {settingsOpen ? (
        <SettingsModal
          settings={settings}
          onChangeSettings={applySettings}
          onDownloadChats={downloadChats}
          onOnboarding={() => setModal({ type: "onboarding" })}
          onOpenBlocked={() => { setSettingsOpen(false); goToSection("learn"); setDetail({ kind: "blocked" }); }}
          onSignOut={signOut}
          onToast={showToast}
          safetyReports={safetyReports}
          onCloseSettings={() => setSettingsOpen(false)}
        />
      ) : null}

      {modal ? (
        <ModalLayer
          modal={modal}
          onClose={() => setModal(null)}
          onStartChat={startChat}
          onOpenProfile={(partner) => { setModal(null); openProfile(partner); }}
          onPublish={publishPost}
          onCreateRoom={createVoiceRoom}
          onReport={reportTarget}
          onToast={showToast}
          mutedRoomIds={mutedRoomIds}
          onToggleRoomMute={(id) => toggleIn(setMutedRoomIds, id, t("이 방의 알림을 껐어요"), t("이 방의 알림을 켰어요"))}
          onCopyLink={copyLink}
          existingPartnerIds={conversations.map((item) => item.partnerId ?? "")}
          onMinimizeRoom={(room) => { setMinimizedRoom(room); setModal(null); }}
          onBlockHost={(room) => { blockAuthor(room.host.toLowerCase(), room.host); setModal(null); }}
          onEndRoom={(room) => {
            setPracticeRooms((items) => items.filter((item) => item.id !== room.id));
            setMinimizedRoom((current) => (current?.id === room.id ? null : current));
            setRoomHandRaised(false);
            setRoomMicOn(false);
            setModal(null);
          }}
          posts={posts}
          directory={directory}
          savedItems={savedItems}
          likesReceived={likesReceived}
          sentLikes={sentLikes}
          followingIds={followingIds}
          onToggleFollow={(partner) => void toggleFollow(partner)}
          onOpenPost={(post) => { setModal(null); openPost(post); }}
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
          dailyQueue={dailyRecommendations}
          partnerIndex={partnerIndex}
          signaledPartners={signaledPartners}
          onJumpPartner={(position) => { setPartnerIndex(position); setModal(null); }}
          onOpenPartnerProfile={(partner) => { setModal(null); openProfile(partner); }}
          onAcceptLike={(partner) => { setModal(null); startChat(partner); showToast(t("{name}님과 대화가 열렸어요", { name: partner.name })); }}
          onUpdateGoal={(goal) => void saveProfile({ ...profile, goal })}
        />
      ) : null}


      {photoViewer ? (
        /* 사진 크게 보기. 사진 바깥을 누르거나 ESC 로 닫습니다. */
        <div className="photo-viewer" role="dialog" aria-modal="true" aria-label={t("사진 크게 보기")}>
          <button type="button" className="photo-viewer-backdrop" aria-label={t("닫기")} onClick={() => setPhotoViewer("")} />
          <button type="button" className="photo-viewer-close" aria-label={t("닫기")} onClick={() => setPhotoViewer("")}>
            <X size={22} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoViewer} alt={t("사진")} />
        </div>
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
}: {
  match: DailyMatchRecommendation;
  depth: number;
  exit: "" | "left" | "right";
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

        {/* ① 누구인가.
            여기서는 프로필로 넘어가지 않습니다 — 오늘의 파트너는 소개받는 자리라
            카드에 담긴 것만 보고 고르는 게 맞습니다. 프로필은 마음이 통해 대화가
            열린 뒤(또는 커뮤니티에서 글을 보고) 들어갑니다. */}
        <div className="single-match-person">
          <Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="xl" online={partner.online} photo={partner.photo} countryCode={partner.countryCode} />
          <div>
            <span><h2>{partner.name}</h2>{partner.verified ? <BadgeCheck size={17} className="verified" aria-label={t("인증됨")} /> : null}</span>
            <p><CountryFlag code={partner.countryCode} size={15} /> {tx(partner.country)}{partner.city ? ` · ${partner.city}` : ""}</p>
            <small className={partner.online ? "is-online" : ""}>
              {partner.online ? t("지금 접속 중") : t("오늘 접속함")}{localTime ? t(" · 현지 {localTime}", { localTime: localizeClock(localTime) }) : ""}
            </small>
          </div>
          <span className="match-score"><strong>{match.score}%</strong><small>{t("잘 맞아요")}</small></span>
        </div>

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

/** 내 글인가. 새로 쓴 글과 데모의 내 글이 같은 id 를 써야 이 판정이 맞습니다. */
/**
 * 지금 로그인한 사람의 id.
 *
 * 모듈 함수(postMenuItems)도 "내 글인가"를 판단해야 하는데, 컴포넌트 밖이라 상태를
 * 읽을 수 없습니다. 로그인할 때 한 번 적어두고 여기서 읽습니다 — 브라우저에는
 * 한 번에 한 사람만 로그인하므로 값이 섞일 일이 없습니다.
 */
let signedInId = "";
export function setSignedInId(id: string) {
  signedInId = id;
}

const isMyPost = (post: FeedPost) => post.authorId === signedInId;

/**
 * 게시물 ··· 메뉴 항목.
 * 내 글과 남의 글은 할 수 있는 일이 다릅니다 — 내 글에 "차단·신고"가 뜨면 안 되고
 * (내가 나를 차단할 수는 없습니다), 남의 글에 "삭제"가 뜨면 안 됩니다.
 * 피드·상세·프로필 세 곳이 같은 메뉴를 쓰도록 여기서 한 번만 만듭니다.
 */
function postMenuItems(
  post: FeedPost,
  actions: {
    saved: boolean;
    onCopyLink: () => void;
    onSavePhrase: () => void;
    onDelete: () => void;
    onHideAuthor: () => void;
    onBlockAuthor: () => void;
    onReport: () => void;
  },
): Array<{ id: string; label: string; icon: LucideIcon; danger?: boolean; onSelect: () => void }> {
  const shared = [
    { id: "link", label: t("링크 복사"), icon: LinkIcon, onSelect: actions.onCopyLink },
    { id: "save", label: actions.saved ? t("복습함에서 빼기") : t("복습에 저장"), icon: Bookmark, onSelect: actions.onSavePhrase },
  ];
  if (isMyPost(post)) {
    return [...shared, { id: "delete", label: t("삭제하기"), icon: Trash2, danger: true, onSelect: actions.onDelete }];
  }
  return [
    ...shared,
    { id: "mute", label: t("이 사용자 글 그만 보기"), icon: EyeOff, onSelect: actions.onHideAuthor },
    { id: "block", label: t("차단하기"), icon: Ban, danger: true, onSelect: actions.onBlockAuthor },
    { id: "report", label: t("신고하기"), icon: Flag, danger: true, onSelect: actions.onReport },
  ];
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
function DetailHeader({
  title,
  onBack,
  menu,
}: {
  title: string;
  onBack: () => void;
  /** 헤더 오른쪽 ··· 메뉴. 신고·차단처럼 자주 쓰지 않는 것을 여기 담습니다. */
  menu?: Array<{ id: string; label: string; icon: LucideIcon; danger?: boolean; onSelect: () => void }>;
}) {
  return (
    <header className="detail-header">
      <button type="button" className="detail-back" onClick={onBack} aria-label={t("뒤로")}>
        <ArrowLeft size={20} />
      </button>
      <span className="detail-title">{title}</span>
      {menu?.length ? <MenuPopover label={t("더 보기")} items={menu} /> : null}
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
  onToggleLike,
  onDeletePost,
  sort,
  onSortChange,
}: {
  post: FeedPost;
  onBack: () => void;
  onProfile: (authorId: string) => void;
  onReport: () => void;
  onToast: (message: string) => void;
  saved: boolean;
  onSavePhrase: (item: SavedPhrase) => void;
  onHideAuthor: (authorId: string, name: string) => void;
  onBlockAuthor: (authorId: string, name: string) => void;
  onCopyLink: (url: string) => void;
  onTagSelect: (tag: string) => void;
  onToggleLike: () => void;
  onDeletePost: () => void;
  sort: "popular" | "recent";
  onSortChange: (value: "popular" | "recent") => void;
}) {
  const [replies, setReplies] = useState<PostReply[]>([]);

  // 글을 열 때 서버에서 답글·교정을 함께 읽습니다.
  useEffect(() => {
    let cancelled = false;
    api<ApiReply[]>(`/api/posts/${encodeURIComponent(post.id)}/replies`)
      .then((rows) => { if (!cancelled) setReplies((rows || []).map(toPostReply).reverse()); })
      .catch(() => { /* 못 읽어도 글 본문은 보여야 합니다. */ });
    return () => { cancelled = true; };
  }, [post.id]);
  const [draft, setDraft] = useState("");
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
    void (async () => {
      try {
        const saved = await api<ApiReply>(`/api/posts/${encodeURIComponent(post.id)}/replies`, {
          method: "POST",
          body: JSON.stringify({
            text,
            kind: replyKind,
            ...(replyKind === "correction" ? { original: correctionSource ?? post.text } : {}),
            ...(replyTo ? { parentId: replyTo.id } : {}),
          }),
        });
        const mine = toPostReply(saved);
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
      } catch (caught) {
        onToast(caught instanceof Error ? caught.message : t("남기지 못했어요."));
      }
    })();
  };

  const startReplyTo = (reply: PostReply) => {
    setReplyTo({ id: reply.id, author: reply.author });
    document.getElementById("reply-input")?.focus();
  };

  const renderReply = (reply: PostReply, isChild: boolean) => (
    <article className={`thread-item reply ${isChild ? "child" : ""}`} key={reply.id}>
      <div className="thread-gutter">
        <Avatar name={reply.author} flag={reply.flag} accent={reply.accent} size={isChild ? "xs" : "sm"} photo={reply.photo} countryCode={reply.countryCode} />
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
            <Avatar name={post.author} flag={post.flag} accent={post.accent} size="sm" photo={post.photo} countryCode={post.countryCode} />
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
              items={postMenuItems(post, {
                saved,
                onCopyLink: () => onCopyLink(`${window.location.origin}/#community/post/${post.id}`),
                onSavePhrase: () => onSavePhrase(savedFromPost(post)),
                onDelete: onDeletePost,
                onHideAuthor: () => onHideAuthor(post.authorId, post.author),
                onBlockAuthor: () => onBlockAuthor(post.authorId, post.author),
                onReport,
              })}
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
            <button type="button" className={post.liked ? "like active" : "like"} aria-pressed={Boolean(post.liked)} onClick={onToggleLike}>
              <Heart size={19} fill={post.liked ? "currentColor" : "none"} /> {post.likes}
            </button>
            <button type="button" onClick={() => document.getElementById("reply-input")?.focus()}>
              <MessageCircle size={18} /> {replies.filter((reply) => reply.kind !== "correction").length}
            </button>
            <button type="button" className="correct" onClick={() => enterCorrectionMode()}>
              <PenLine size={18} /> {t("교정 {n}", { n: post.corrections })}
            </button>
            <button type="button" aria-label={t("링크 복사")} onClick={() => onCopyLink(`${window.location.origin}/#community/post/${post.id}`)}><Send size={18} /></button>
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
  following,
  onToggleFollow,
  posts,
  onOpenPost,
  onBlock,
  counts,
}: {
  partner: Partner;
  onBack: () => void;
  onStartChat: (partner: Partner) => void;
  onReport: () => void;
  /* 예전에는 "관심 파트너 저장" 이 따로 있었는데 어디에도 남지 않았습니다.
     같은 뜻이면서 서버에 남는 팔로우로 합쳤습니다. */
  following: boolean;
  onToggleFollow: (partner: Partner) => void;
  /** 이 사람이 쓴 글. 프로필에서 바로 볼 수 있어야 어떤 사람인지 알 수 있습니다. */
  posts: FeedPost[];
  onOpenPost: (post: FeedPost) => void;
  onBlock: () => void;
  counts?: { following: number; followers: number; posts: number };
}) {
  return (
    <div className="view detail-view">
      <DetailHeader
        title={partner.name}
        onBack={onBack}
        menu={[
          { id: "report", label: t("신고하기"), icon: Flag, danger: true, onSelect: onReport },
          { id: "block", label: t("차단하기"), icon: Ban, danger: true, onSelect: onBlock },
        ]}
      />

      <header className="profile-head">
        <div className="profile-head-id">
          <span className="profile-head-name">
            {partner.name}
            {partner.verified ? <BadgeCheck size={18} className="verified" /> : null}
          </span>
          <p className="profile-head-handle">{partner.handle} · {partner.city}</p>
        </div>
        <Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="xl" online={partner.online} photo={partner.photo} countryCode={partner.countryCode} />
      </header>

      <p className="profile-head-bio">{partner.bio}</p>

      <div className="profile-head-stats">
        <span><strong>{counts ? counts.posts : posts.length}</strong> {t("게시물")}</span>
        {counts ? <span><strong>{counts.following}</strong> {t("팔로잉")}</span> : null}
        {counts ? <span><strong>{counts.followers}</strong> {t("팔로워")}</span> : null}
        <span><strong>{tx(partner.native)}</strong> {t("원어민")}</span>
        <span><strong>{tx(partner.learning)}</strong> {partner.level}</span>
      </div>

      {/* 버튼은 둘입니다 — 팔로우와 메시지. 신고·차단은 헤더의 ··· 메뉴로 뺐습니다.
          자주 쓰는 것과 드물게 쓰는 것이 같은 줄에 나란히 있을 이유가 없습니다. */}
      <div className="profile-head-actions">
        <button className={following ? "secondary-button" : "primary-button"} type="button" aria-pressed={following} onClick={() => onToggleFollow(partner)}>
          <UserPlus size={16} /> {following ? t("팔로잉") : t("팔로우")}
        </button>
        <button className="secondary-button" type="button" onClick={() => onStartChat(partner)}>
          <MessageCircle size={16} /> {t("메시지")}
        </button>
      </div>

      <section className="profile-detail-section">
        <h3>{t("언어 교환")}</h3>
        <div className="profile-language-grid">
          <span><small>{t("가르칠 수 있어요")}</small><strong><CountryFlag code={partner.countryCode} size={15} /> {tx(partner.native)}</strong><em>{t("원어민")}</em></span>
          <span><small>{t("배우고 있어요")}</small><strong>🇰🇷 {tx(partner.learning)}</strong><em>{partner.level}</em></span>
        </div>
      </section>

      <section className="profile-detail-section">
        <h3>{t("관심사")}</h3>
        <div className="interest-row large">{partner.interests.map((item) => <span key={item}>{item}</span>)}</div>
      </section>

      {/* 이 사람이 쓴 글. 어떤 사람인지 아는 데는 소개글보다 쓴 글이 더 도움이 됩니다. */}
      <section className="profile-detail-section">
        <h3>{t("{name}님의 글", { name: partner.name })}</h3>
        {posts.length === 0 ? (
          <p className="phrase-empty">{t("아직 올린 글이 없어요.")}</p>
        ) : (
          <div className="partner-post-list">
            {posts.map((post) => (
              <button type="button" key={post.id} onClick={() => onOpenPost(post)}>
                <span className="partner-post-meta">{tx(post.time)} · {tx(post.language)}</span>
                <span className="partner-post-text">{post.text}</span>
                <span className="partner-post-stats">
                  <span><Heart size={13} /> {post.likes}</span>
                  <span><MessageCircle size={13} /> {post.comments}</span>
                  <span><PenLine size={13} /> {post.corrections}</span>
                </span>
              </button>
            ))}
          </div>
        )}
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
  directory,
  onBack,
  onUnhide,
  onUnblock,
}: {
  hidden: string[];
  blocked: string[];
  directory: Partner[];
  onBack: () => void;
  onUnhide: (id: string) => void;
  onUnblock: (id: string) => void;
}) {
  /* 차단한 사람은 명부(/api/partners)에서 빠지므로 이름을 찾지 못할 수 있습니다.
     그때는 id 를 그대로 보여주는 대신 "차단한 사용자"라고 적습니다 — 화면에 uid 가
     찍히면 무엇을 푸는 건지 알 수 없습니다. */
  const nameOf = (id: string) => directory.find((item) => item.id === id)?.name ?? t("차단한 사용자");
  const [tab, setTab] = useState<"blocked" | "hidden">("blocked");
  const ids = tab === "blocked" ? blocked : hidden;

  return (
    <div className="view detail-view">
      <DetailHeader title={t("신고 및 차단 관리")} onBack={onBack} />
      <Tabs
        tabs={[
          { id: "blocked", label: `${t("차단한 사람")} ${blocked.length}` },
          { id: "hidden", label: `${t("숨긴 사람")} ${hidden.length}` },
        ]}
        active={tab}
        onSelect={(next) => setTab(next as "blocked" | "hidden")}
      />
      {ids.length === 0 ? (
        <div className="empty-state">
          {tab === "blocked" ? <Ban size={28} /> : <EyeOff size={28} />}
          <strong>{tab === "blocked" ? t("차단한 사람이 없어요") : t("숨긴 사람이 없어요")}</strong>
          <p>{tab === "blocked" ? t("프로필이나 대화 메뉴에서 차단할 수 있어요.") : t("게시물 메뉴에서 숨기면 여기에 모입니다.")}</p>
        </div>
      ) : (
        <ul className="blocked-list">
          {ids.map((id) => (
            <li key={`${tab}-${id}`}>
              <Avatar name={nameOf(id)} size="sm" />
              <span>
                <strong>{nameOf(id)}</strong>
                <small>{tab === "blocked" ? t("차단함") : t("글 숨김")}</small>
              </span>
              <button
                type="button"
                className="secondary-button"
                onClick={() => (tab === "blocked" ? onUnblock(id) : onUnhide(id))}
              >
                {tab === "blocked" ? t("차단 해제") : t("다시 보기")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 게시물·메시지를 복습함 항목으로 바꿉니다. 무엇을 저장했는지 목록에서 알아볼 수 있어야 합니다. */
function savedFromPost(post: FeedPost): SavedPhrase {
  return { id: post.id, phrase: post.text.slice(0, 80), meaning: post.translation ?? "", source: t("{author}님의 게시물", { author: post.author }), due: t("오늘") };
}

function savedFromMessage(message: { id: string; text?: string }, partnerName: string): SavedPhrase {
  return { id: message.id, phrase: (message.text ?? "").slice(0, 80), meaning: "", source: t("{name}님과의 대화", { name: partnerName }), due: t("오늘") };
}

function DiscoverView({
  preferences,
  dailyRecommendations,
  index,
  signaledCount,
  onFilters,
  onSkip,
  onSignal,
  onRestart,
  onOpenList,
  onOpenLikes,
  receivedCount,
  loadFailed,
}: {
  preferences: MatchPreferences;
  dailyRecommendations: DailyMatchRecommendation[];
  index: number;
  signaledCount: number;
  onFilters: () => void;
  onSkip: () => void;
  onSignal: (partner: Partner) => void;
  onRestart: () => void;
  onOpenList: () => void;
  onOpenLikes: () => void;
  receivedCount: number;
  loadFailed: boolean;
}) {
  // 부모가 이미 조건에 맞는 12명(또는 조건을 넓힌 후보 포함)을 내려줍니다. 조건 밖 fixture 를 섞지 않습니다.
  const queue = dailyRecommendations.slice(0, MAX_DAILY_PARTNERS);
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
            <h1>{t("오늘의 파트너")}</h1>
            {!loadFailed && total > 0 ? <p>{t("오늘은 여기까지예요.")}</p> : null}
          </div>
          <button className="secondary-button" type="button" onClick={onFilters}><SlidersHorizontal size={16} /> {t("조건 바꾸기")}</button>
        </header>

        <section className="partners-exhausted">
          <span className="partners-exhausted-icon"><CalendarDays size={32} strokeWidth={1.6} /></span>
          <strong>
            {loadFailed
              ? t("추천을 불러오지 못했어요")
              : total === 0
                ? t("조건에 맞는 사람이 아직 없어요")
                : t("오늘 만날 사람을 다 봤어요")}
          </strong>
          <p>
            {loadFailed ? (
              t("잠시 뒤에 다시 시도해 주세요.")
            ) : total === 0 ? (
              t("조건을 조금 넓히면 만날 수 있는 사람이 늘어나요.")
            ) : (
              <>
                {t("오늘 {total}명을 모두 확인했어요", { total })}
                {signaledCount > 0 ? t(" · {signaledCount}명에게 신호를 보냈어요", { signaledCount }) : ""}.
                <br />
                {t("내일 오전 9시에 새로운 파트너를 추천해드릴게요.")}
              </>
            )}
          </p>
          <div className="partners-exhausted-actions">
            <button className="primary-button" type="button" onClick={onFilters}><SlidersHorizontal size={16} /> {t("조건 바꾸기")}</button>
            {total > 0 ? <button className="secondary-button" type="button" onClick={onRestart}><RotateCcw size={16} /> {t("처음부터 다시")}</button> : null}
          </div>
        </section>
      </div>
    );
  }
  const targetLanguage = labelOf(languageLabels, preferences.targetLanguages[0] ?? "en");
  // 내가 건 조건 — 카드가 아니라 헤더에 둡니다 (상대 정보와 섞이지 않게)
  const myFilters = [
    targetLanguage,
    tx(genderLabels[preferences.partnerGender]),
    tx(msg("{min}–{max}세"), { min: preferences.ageMin, max: preferences.ageMax }),
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

      <div className="beta-access-note">
        <Sparkles size={17} />
        <span>
          <strong>{tx(msg("오픈 베타 · 오늘 추천과 기본 번역 무료"))}</strong>
          <small>{tx(msg("조건에 맞는 {total}명을 모두 확인하고 직접 대화 상대를 선택하세요 · 마음 {signaledCount}명"), { total, signaledCount })}</small>
        </span>
        <Pill tone="success">{Math.min(index + 1, total)} / {total}</Pill>
      </div>

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
  translations,
  corrections,
  onTranslate,
  onCorrection,
  onToggle,
  onProfile,
  onReport,
  onOpen,
  hiddenAuthorIds,
  blockedAuthorIds,
  onHideAuthor,
  onBlockAuthor,
  activeTag,
  onTagSelect,
  savedItems,
  onSavePhrase,
  onCopyLink,
  onDeletePost,
  myLearningLanguage,
  followingIds,
  onOpenPhoto,
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
  savedItems: SavedPhrase[];
  onSavePhrase: (item: SavedPhrase) => void;
  onCopyLink: (url: string) => void;
  onDeletePost: (post: FeedPost) => void;
  /** "학습" 탭은 내가 배우는 언어로 쓴 글만 봅니다. */
  myLearningLanguage: string;
  /** "팔로잉" 탭은 내가 팔로우하는 사람의 글만 봅니다. */
  followingIds: string[];
  onOpenPhoto: (src: string) => void;
  translated: Set<string>;
  translations: Record<string, string>;
  corrections: Set<string>;
  onTranslate: (post: FeedPost) => void;
  onCorrection: (id: string) => void;
  onToggle: (id: string, key: "liked" | "saved") => void;
  onProfile: (id: string) => void;
  onReport: (target: string, targetId?: string) => void;
  onOpen: (post: FeedPost) => void;
}) {
  const PAGE = 12;
  const [count, setCount] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement | null>(null);
  // 탭이 실제로 피드를 거릅니다.
  const filteredPosts = posts.filter((post) => {
    // 숨기거나 차단한 사람의 글은 피드에서 빠집니다 — 그래야 눌린 게 보입니다.
    if (hiddenAuthorIds.has(post.authorId) || blockedAuthorIds.has(post.authorId)) return false;
    if (activeTag) return post.tags.includes(activeTag);
    if (tab === "learning") return post.language === myLearningLanguage;
    if (tab === "following") return followingIds.includes(post.authorId);
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
      <div className="translation-access-note"><Languages size={17} /><span><strong>{tx(msg("기본 번역은 무료예요"))}</strong><small>{tx(msg("언어 장벽 없이 피드를 읽을 수 있도록 베타 기간 이후에도 기본 번역은 열어둘 계획이에요."))}</small></span></div>
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
                  <Avatar name={post.author} flag={post.flag} accent={post.accent} size="sm" online={post.authorId === "maya"} photo={post.photo} countryCode={post.countryCode} />
                  <span><strong>{post.author}{post.authorId === "maya" ? <BadgeCheck size={14} className="verified" /> : null}</strong><small>{post.handle} · {tx(post.time)}</small></span>
                </button>
                <div className="post-meta">
                  {post.requestCorrection ? <Pill tone="soft"><WandSparkles size={12} /> {t("교정 부탁해요")}</Pill> : null}
                  {post.visibility === "partners" ? <Pill tone="neutral">{t("파트너 공개")}</Pill> : null}
                  <Pill tone="language">{tx(post.language)} · {post.level}</Pill>
                  <MenuPopover
                    label={t("게시물 메뉴")}
                    items={postMenuItems(post, {
                      saved: savedItems.some((saved) => saved.id === post.id),
                      onCopyLink: () => onCopyLink(`${window.location.origin}/#community/post/${post.id}`),
                      onSavePhrase: () => onSavePhrase(savedFromPost(post)),
                      onDelete: () => onDeletePost(post),
                      onHideAuthor: () => onHideAuthor(post.authorId, post.author),
                      onBlockAuthor: () => onBlockAuthor(post.authorId, post.author),
                      onReport: () => onReport(post.author, post.authorId),
                    })}
                  />
                </div>
              </header>
              <button className="post-copy-open" type="button" onClick={() => onOpen(post)} aria-label={t("{author}님의 게시물 열기", { author: post.author })}>
                <span className="post-copy">{post.text}</span>
              </button>
              {translated.has(post.id) ? <div className="translation-box"><Languages size={16} /><p><span>{t("번역")}</span>{translations[post.id] ?? post.translation}</p></div> : null}
              {post.image ? (
                <button type="button" className="post-image-open" onClick={() => onOpenPhoto(post.image!)} aria-label={t("사진 크게 보기")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="post-image" src={post.image} alt="" loading="lazy" />
                </button>
              ) : null}
              {post.audio ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <audio className="post-audio" src={post.audio} controls preload="none" />
              ) : null}
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
                  <button type="button" className={savedItems.some((saved) => saved.id === post.id) ? "active" : ""} aria-pressed={savedItems.some((saved) => saved.id === post.id)} aria-label={t("복습에 저장")} onClick={() => onSavePhrase(savedFromPost(post))}><Bookmark size={16} /></button>
                </div>
              ) : null}
              <footer className="post-actions">
                <button className={post.liked ? "active like" : ""} type="button" onClick={() => onToggle(post.id, "liked")}><Heart size={18} fill={post.liked ? "currentColor" : "none"} /> {post.likes}</button>
                <button type="button" onClick={() => onOpen(post)}><MessageCircle size={18} /> {post.comments}</button>
                <button className={corrections.has(post.id) ? "active correct" : ""} type="button" onClick={() => (post.correction ? onCorrection(post.id) : onOpen(post))}><PenLine size={18} /> {t("교정 {n}", { n: post.corrections })}</button>
                <button className={translated.has(post.id) ? "active" : ""} type="button" onClick={() => onTranslate(post)}><Languages size={18} /> {t("번역")}</button>
                <button className={post.saved ? "active save" : "post-save"} type="button" aria-label={t("저장")} onClick={() => onToggle(post.id, "saved")}><Bookmark size={18} fill={post.saved ? "currentColor" : "none"} /></button>
              </footer>
          </article>
        ))}
      </div>

      {hasMore ? (
        <div className="feed-sentinel" ref={sentinel} aria-hidden="true">
          <span className="feed-spinner" />
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="empty-state">
          <UsersRound size={30} strokeWidth={1.5} />
          <strong>{tab === "following" ? t("팔로우한 사람의 글이 없어요") : activeTag ? t("이 주제의 글이 없어요") : t("아직 글이 없어요")}</strong>
          <p>
            {tab === "following"
              ? t("프로필에서 팔로우하면 그 사람의 글이 여기 모여요.")
              : activeTag
                ? t("다른 주제를 골라보거나 직접 글을 올려보세요.")
                : t("첫 글을 올려보세요. 원어민이 고쳐줄 수 있어요.")}
          </p>
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
  requestIds,
  onSelect,
  onBack,
  onAcceptRequest,
  onDismissRequest,
  draft,
  setDraft,
  onSend,
  onSendAttachment,
  onOpenPhoto,
  onExchange,
  onProfile,
  onReport,
  onToast,
  mutedChatIds,
  onToggleMute,
  onLeaveChat,
  onBlockPartner,
  onNewChat,
  savedItems,
  onSavePhrase,
}: {
  onNewChat: () => void;
  savedItems: SavedPhrase[];
  onSavePhrase: (item: SavedPhrase) => void;
  conversations: Conversation[];
  /** 고른 대화. 대화가 하나도 없으면 없습니다 — 새로 가입한 사람이 그렇습니다. */
  selected?: Conversation;
  mobileThreadOpen: boolean;
  requestIds: ReadonlySet<string>;
  mutedChatIds: Set<string>;
  onToggleMute: (id: string, name: string) => void;
  onLeaveChat: (id: string, name: string) => void;
  onBlockPartner: (id: string, name: string) => void;
  onSelect: (id: string) => void;
  onBack: () => void;
  onAcceptRequest: (id: string) => void;
  onDismissRequest: (id: string) => void;
  draft: string;
  setDraft: (text: string) => void;
  onSend: (event: FormEvent<HTMLFormElement>) => void;
  onSendAttachment: (kind: "image" | "voice", media: string, label: string) => Promise<void>;
  onOpenPhoto: (src: string) => void;
  onExchange: () => void;
  onProfile: () => void;
  onReport: () => void;
  onToast: (message: string) => void;
}) {
  const [listTab, setListTab] = useState<"all" | "turn" | "requests">("all");
  const [listQuery, setListQuery] = useState("");
  const [translatedMessages, setTranslatedMessages] = useState<Set<string>>(new Set(["m1"]));
  const [messageTranslations, setMessageTranslations] = useState<Record<string, string>>({});
  const [coachOpen, setCoachOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const messageAreaRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const [recording, setRecording] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  /**
   * 사진 보내기.
   *
   * 원본을 그대로 보내면 몇 MB 라 서버에 담기지 않습니다. 긴 변 1280px 로 줄이고
   * JPEG 로 다시 눌러 담습니다 — 대화 사진으로는 충분하고 보통 100~200KB 입니다.
   */
  const pickPhoto = async (file: File) => {
    if (!file.type.startsWith("image/")) return onToast(t("사진 파일만 보낼 수 있어요"));
    try {
      const media = await shrinkImage(file);
      if (media.length > MAX_ATTACHMENT) return onToast(t("사진을 줄여도 너무 커요. 다른 사진을 골라주세요."));
      await onSendAttachment("image", media, t("사진"));
    } catch {
      onToast(t("이 형식은 브라우저가 열지 못해요. JPG·PNG 로 저장해서 올려주세요."));
    }
  };

  /** 음성 메시지 — 브라우저 녹음기를 그대로 씁니다. 다시 누르면 멈추고 보냅니다. */
  const toggleRecording = async () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return onToast(t("이 브라우저에서는 녹음을 쓸 수 없어요"));
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        setRecording(false);
        const reader = new FileReader();
        reader.onload = () => {
          const media = String(reader.result || "");
          if (media.length > 700000) return onToast(t("녹음이 너무 길어요. 30초 안쪽으로 다시 녹음해 주세요."));
          void onSendAttachment("voice", media, t("음성 메시지"));
        };
        reader.readAsDataURL(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      onToast(t("녹음 중이에요. 다시 누르면 보내요."));
    } catch {
      onToast(t("마이크를 쓸 수 없어요. 브라우저 권한을 확인해 주세요."));
    }
  };

  /** 메시지 번역 — 열려 있으면 닫고, fixture 번역이 없으면 mock 번역 API 를 호출합니다. */
  const translateMessage = async (message: ChatMessage) => {
    if (!message.text) return;
    if (translatedMessages.has(message.id) || message.translated || messageTranslations[message.id]) {
      toggleLocalSet(setTranslatedMessages, message.id);
      return;
    }
    try {
      const targetLanguage = HANGUL_PATTERN.test(message.text) ? "en" : "ko";
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: message.text, targetLanguage }),
      });
      if (!response.ok) throw new Error(`Mock API returned ${response.status}`);
      const body = await response.json() as { data?: { translatedText?: string } };
      const translatedText = body.data?.translatedText;
      if (!translatedText) throw new Error("Missing mock translation");
      setMessageTranslations((current) => ({ ...current, [message.id]: translatedText }));
      toggleLocalSet(setTranslatedMessages, message.id);
    } catch {
      onToast(t("번역을 불러오지 못했어요."));
    }
  };
  const [coachLoading, setCoachLoading] = useState(false);
  const [supportResult, setSupportResult] = useState<{ conversationId: string; data: ConversationSupport } | null>(null);
  const conversationSupport = selected && supportResult?.conversationId === selected.id ? supportResult.data : null;
  /* 요청함은 일반 받은 대화와 분리한 뒤, 검색어가 있으면 이름·마지막 메시지에서 찾습니다. */
  const byTab = conversations.filter((item) =>
    listTab === "turn"
      ? item.myTurn && !requestIds.has(item.id)
      : listTab === "requests"
        ? requestIds.has(item.id)
        : !requestIds.has(item.id),
  );
  const needle = listQuery.trim().toLowerCase();
  const filtered = needle
    ? byTab.filter((item) =>
        item.name.toLowerCase().includes(needle) || item.preview.toLowerCase().includes(needle),
      )
    : byTab;
  const unreadTotal = conversations.reduce((sum, item) => sum + item.unread, 0);
  /* 지금 보이는 목록에 선택한 대화가 있는지. 없으면 오른쪽은 비워둡니다. */
  const selectedVisible = Boolean(selected) && filtered.some((item) => item.id === selected?.id);

  /**
   * 새 말풍선이 생기거나 대화를 바꾸면 맨 아래로 내립니다.
   *
   * 보낸 메시지가 화면 밖에 생기면 보낸 사람은 갔는지 알 수 없습니다.
   * 사진은 다 그려진 뒤에야 높이가 정해지므로 그림이 실린 뒤 한 번 더 내립니다.
   */
  /**
   * 입력창 높이를 내용에 맞춥니다.
   *
   * 높이를 24px 로 고정해두는 바람에 줄을 바꿔도 늘어나지 않고 안에서 잘렸습니다.
   * auto 로 되돌린 뒤 실제 내용 높이를 다시 넣습니다. 상한(--composer-max)을 넘으면
   * 더 늘리지 않고 안에서 스크롤합니다 — 그러지 않으면 긴 글에 대화가 다 가립니다.
   */
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, selected?.id]);

  const messageCount = selected?.messages.length ?? 0;
  useEffect(() => {
    const node = messageAreaRef.current;
    if (!node) return;
    const toBottom = () => { node.scrollTop = node.scrollHeight; };
    toBottom();
    const media = [...node.querySelectorAll("img, audio")];
    media.forEach((element) => {
      element.addEventListener("load", toBottom, { once: true });
      element.addEventListener("loadedmetadata", toBottom, { once: true });
    });
    return () => media.forEach((element) => {
      element.removeEventListener("load", toBottom);
      element.removeEventListener("loadedmetadata", toBottom);
    });
  }, [messageCount, selected?.id]);
  /* 오른쪽은 대화창입니다 — 목록이 왜 비었는지(검색 실패 등)는 목록 바로 옆에서 설명하고,
     여기서는 "열어볼 대화가 있는가"만 봅니다. 수락 전 요청은 아직 대화가 아니라 빼고 셉니다. */
  const hasAnyChat = conversations.some((item) => !requestIds.has(item.id));
  const myTurnCount = conversations.filter((item) => item.myTurn && !requestIds.has(item.id)).length;
  const selectedIsRequest = Boolean(selected && requestIds.has(selected.id));
  const acceptRequest = (id: string, name: string) => {
    onAcceptRequest(id);
    setListTab("all");
    onToast(tx(msg("{name}님의 요청을 수락했어요"), { name }));
  };
  const removeRequest = (id: string, name: string) => {
    onDismissRequest(id);
    onToast(tx(msg("{name}님의 요청을 삭제했어요 · 상대에게 알리지 않아요"), { name }));
  };

  /**
   * 대화 코치.
   *
   * 예전에는 상대 id 를 fixture 목록(GUIDE_PARTNER_IDS) 중 하나로 바꿔 보냈습니다.
   * mock 백엔드에는 준비된 사람만 있었기 때문인데, 그 결과 **다른 사람에 대한 조언**을
   * 받아서 보여줬습니다. 지금은 실제 상대를 그대로 묻습니다.
   *
   * 실패하면 준비해둔 예시로 채우지 않습니다 — 지어낸 조언인지 진짜 조언인지
   * 구분할 수 없게 됩니다.
   */
  const requestConversationSupport = async (polishDraft = false) => {
    if (!selected?.partnerId) {
      onToast(t("이 대화에서는 코치를 쓸 수 없어요"));
      return;
    }
    setCoachLoading(true);
    try {
      const data = await api<ConversationSupport>("/api/conversation-support", {
        method: "POST",
        body: JSON.stringify({
          partnerId: selected.partnerId,
          draft: draft.trim() || undefined,
          stage: selected.messages.length > 2 ? "ongoing" : "first-message",
        }),
      });
      setSupportResult({ conversationId: selected.id, data });
      // 다듬기를 눌렀으면 입력창에 바로 넣어줍니다. 그 외에는 코치 패널이 채워지는
      // 것으로 충분해서 따로 알리지 않습니다.
      if (polishDraft && data.improvedDraft) setDraft(data.improvedDraft);
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : t("대화 코치를 부르지 못했어요."));
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
        <div className="chat-sync-note"><Cloud size={15} /><span><strong>{tx(msg("실서비스 설계 · 서버 자동 동기화"))}</strong><small>{tx(msg("앱을 지우거나 기기를 바꿔도 로그인하면 그대로 이어져요."))}</small></span></div>
        <label className="chat-search"><Search size={16} /><input type="search" value={listQuery} onChange={(event) => setListQuery(event.target.value)} placeholder={t("이름 또는 대화 검색")} />{listQuery ? <button type="button" className="chat-search-clear" aria-label={t("검색어 지우기")} onClick={() => setListQuery("")}><X size={14} /></button> : null}</label>
        <div className="chat-list-tabs">
          <button type="button" className={listTab === "all" ? "active" : ""} onClick={() => setListTab("all")}>{t("전체")}</button>
          <button type="button" className={listTab === "turn" ? "active" : ""} onClick={() => setListTab("turn")}>{t("내 차례")}{myTurnCount > 0 ? <span>{myTurnCount}</span> : null}</button>
          <button type="button" className={listTab === "requests" ? "active" : ""} onClick={() => setListTab("requests")}>{t("요청함")}{requestIds.size > 0 ? <span>{requestIds.size}</span> : null}</button>
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
            <div className="conversation-entry" key={conversation.id}>
              <button
                type="button"
                className={`conversation-item ${selected?.id === conversation.id ? "active" : ""}`}
                onClick={() => onSelect(conversation.id)}
              >
                <Avatar name={conversation.name} flag={conversation.flag} accent={conversation.accent} size="lg" online={conversation.online} photo={conversation.photo} countryCode={conversation.countryCode} />
                <span className="conversation-copy">
                  <span className="conversation-name"><strong>{conversation.name}</strong>{mutedChatIds.has(conversation.id) ? <BellOff size={12} className="conversation-muted" /> : null}<small>{tx(conversation.time)}</small></span>
                  <span className={conversation.typing ? "typing" : ""}>{conversation.typing ? t("입력 중…") : conversation.preview}</span>
                  <span className="conversation-labels">
                    {requestIds.has(conversation.id) ? <i>{tx(msg("새 메시지 요청"))}</i> : <i><ShieldCheck size={10} /> {conversation.group ? t("그룹") : tx(msg("매칭됨"))}</i>}
                    {conversation.myTurn ? <i>{t("내 차례")}</i> : null}
                    {conversation.group ? <i className="group-label"><Users size={11} /> {t("그룹")}</i> : null}
                    {conversation.muted || mutedChatIds.has(conversation.id) ? <i>{t("알림 끔")}</i> : null}
                  </span>
                </span>
                {conversation.unread ? <span className="unread-count">{conversation.unread}</span> : null}
              </button>
              {requestIds.has(conversation.id) ? <div className="request-actions"><button type="button" onClick={() => removeRequest(conversation.id, conversation.name)}>{tx(msg("삭제"))}</button><button type="button" onClick={() => acceptRequest(conversation.id, conversation.name)}>{tx(msg("수락"))}</button></div> : null}
            </div>
          ))}
        </div>
      </section>

      {!selectedVisible ? (
        <section className="chat-thread chat-thread-empty" aria-label={t("대화")}>
          <MessageCircle size={30} />
          <strong>{hasAnyChat ? t("왼쪽에서 대화를 골라주세요") : t("아직 대화가 없어요")}</strong>
          <p>{hasAnyChat ? t("고른 대화가 여기에 열립니다.") : t("왼쪽에서 새 대화를 시작해보세요.")}</p>
        </section>
      ) : selected ? (
      <section className="chat-thread" aria-label={t("{name}님과의 대화", { name: selected.name })}>
        <header className="thread-header">
          <button className="mobile-back" type="button" onClick={onBack} aria-label={t("대화 목록으로")}><ArrowLeft size={21} /></button>
          <button className="thread-person" type="button" onClick={onProfile}>
            <Avatar name={selected.name} flag={selected.flag} accent={selected.accent} size="sm" online={selected.online} photo={selected.photo} countryCode={selected.countryCode} />
            <span><strong>{selected.name}</strong><small>{selected.online ? t("온라인 · 영어 ⇄ 한국어") : t("최근 활동 어제")}</small></span>
          </button>
          <div className="thread-actions">
            <button className={`coach-cta ${coachOpen ? "active" : ""}`} type="button" onClick={() => setCoachOpen(!coachOpen)}><WandSparkles size={16} /><span>{t("대화 코치")}</span></button>
            <button className="exchange-cta" type="button" onClick={onExchange}><Timer size={16} /><span>{t("교환 세션")}</span></button>
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

        {selectedIsRequest ? <div className="dm-request-banner"><ShieldCheck size={18} /><span><strong>{tx(msg("{name}님의 메시지 요청"), { name: selected.name })}</strong><small>{tx(msg("수락하기 전까지 읽음 여부와 활동 상태가 상대에게 보이지 않아요."))}</small></span><button type="button" onClick={() => removeRequest(selected.id, selected.name)}>{tx(msg("삭제"))}</button><button type="button" onClick={() => acceptRequest(selected.id, selected.name)}>{tx(msg("수락"))}</button></div> : null}

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
            {!conversationSupport ? (
              <p className="coach-empty">{t("“새로 추천”을 누르면 지금 대화에 맞는 주제를 찾아드려요.")}</p>
            ) : (
            <><div className="coach-grid">
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
            <footer><Sparkles size={12} /><span>{conversationSupport.tip}</span></footer></>
            )}
          </section>
        ) : null}

        <div className="message-area" ref={messageAreaRef}>
          <div className="day-divider"><span>{t("오늘")}</span></div>
          {selected.messages.map((message) => {
            if (message.system) return <div className="system-message" key={message.id}><ShieldCheck size={14} />{message.text}</div>;
            if (message.correction) {
              return (
                <div className="message-row correction-message" key={message.id}>
                  <Avatar name={selected.name} accent={selected.accent} size="xs" photo={selected.photo} countryCode={selected.countryCode} />
                  <div className="chat-correction-card">
                    <span className="correction-label"><PenLine size={14} /> {t("{name}님이 문장을 고쳤어요", { name: selected.name })}</span>
                    <p className="before">{message.correction.original}</p>
                    <p className="after">{message.correction.fixed}</p>
                    <small>{message.correction.note}</small>
                    <button type="button" className={savedItems.some((saved) => saved.id === message.id) ? "active" : ""} aria-pressed={savedItems.some((saved) => saved.id === message.id)} aria-label={t("표현 저장")} onClick={() => onSavePhrase(savedFromMessage(message, selected.name))}><Bookmark size={16} /></button>
                  </div>
                  <time>{localizeClock(message.time)}</time>
                </div>
              );
            }
            return (
              <div className={`message-row ${message.mine ? "mine" : "theirs"}`} key={message.id}>
                {!message.mine ? <Avatar name={selected.name} accent={selected.accent} size="xs" photo={selected.photo} countryCode={selected.countryCode} /> : null}
                <div className="message-stack">
                  <div className={message.kind ? "message-bubble message-bubble-media" : "message-bubble"}>
                    {message.voice ? <button className="voice-message" type="button" onClick={() => { if (message.text && !speakText(message.text)) onToast(t("이 브라우저에서는 음성 재생을 지원하지 않아요")); }}><span className="play-dot"><Play size={13} fill="currentColor" /></span><span className="waveform"><i /><i /><i /><i /><i /><i /><i /><i /><i /></span><small>{message.voice}</small></button> : null}
                    {message.kind === "image" && message.media ? (
                      <button type="button" className="message-media-open" onClick={() => onOpenPhoto(message.media!)} aria-label={t("사진 크게 보기")}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="message-media" src={message.media} alt={t("사진")} loading="lazy" />
                      </button>
                    ) : null}
                    {message.kind === "voice" && message.media ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <audio className="message-audio" src={message.media} controls preload="none" />
                    ) : null}
                    {message.text && !message.kind ? <p>{message.text}</p> : null}
                  </div>
                  {translatedMessages.has(message.id) && (messageTranslations[message.id] ?? message.translated) ? <div className="message-translation"><Languages size={13} /> {messageTranslations[message.id] ?? message.translated}</div> : null}
                  {/* 번역·교정·듣기·저장은 모두 글에 하는 일입니다.
                      사진과 음성 말풍선에는 붙이지 않습니다. */}
                  {message.kind ? null : (
                  <div className="message-tools">
                    {message.text ? <button type="button" onClick={() => void translateMessage(message)}><Languages size={13} /> {t("번역")}</button> : null}
                    <button type="button" onClick={() => { setDraft(message.text ?? ""); onToast(t("문장을 입력창에 가져왔어요 · 고쳐서 보내주세요")); }}><PenLine size={13} /> {t("교정")}</button>
                    <button type="button" className={savedItems.some((saved) => saved.id === message.id) ? "active" : ""} aria-pressed={savedItems.some((saved) => saved.id === message.id)} aria-label={t("저장")} onClick={() => onSavePhrase(savedFromMessage(message, selected.name))}><Bookmark size={16} /></button>
                    <button type="button" onClick={() => { if (!speakText(message.text ?? "")) onToast(t("이 브라우저에서는 음성 재생을 지원하지 않아요")); }}><Volume2 size={13} /> {t("듣기")}</button>
                  </div>
                  )}
                </div>
                <time>{localizeClock(message.time)}{message.mine && message.readByPartner ? t(" · 읽음") : ""}</time>
              </div>
            );
          })}
          {selected.typing ? <div className="typing-indicator"><Avatar name={selected.name} accent={selected.accent} size="xs" photo={selected.photo} countryCode={selected.countryCode} /><span><i /><i /><i /></span><small>{t("{name}님이 입력 중", { name: selected.name })}</small></div> : null}
        </div>

        {selectedIsRequest ? <div className="request-composer-lock"><LockKeyhole size={17} /><span><strong>{tx(msg("요청을 수락하면 답장할 수 있어요"))}</strong><small>{tx(msg("삭제하거나 수락해도 상대에게 별도 알림은 가지 않아요."))}</small></span></div> : <form className="message-composer" onSubmit={onSend}>
          <div className="composer-row">
            <input
              ref={photoInputRef}
              className="sr-only"
              type="file"
              accept="image/*"
              aria-label={t("사진 고르기")}
              onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void pickPhoto(file); }}
            />
            <div className="composer-attach-wrap">
              <button
                type="button"
                className={attachOpen ? "composer-attach active" : "composer-attach"}
                aria-label={t("첨부")}
                aria-haspopup="menu"
                aria-expanded={attachOpen}
                onClick={() => setAttachOpen(!attachOpen)}
              >
                <Plus size={19} />
              </button>
              {attachOpen ? (
                <>
                  <button type="button" className="menu-scrim" aria-label={t("닫기")} onClick={() => setAttachOpen(false)} />
                  <div className="composer-attach-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setAttachOpen(false); photoInputRef.current?.click(); }}>
                      <ImageIcon size={17} /> {t("사진")}
                    </button>
                    <button type="button" role="menuitem" className={recording ? "recording" : ""} onClick={() => { setAttachOpen(false); void toggleRecording(); }}>
                      <Mic size={17} /> {recording ? t("녹음 멈추기") : t("음성")}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
            <label className="message-input">
              <span className="sr-only">{t("메시지 입력")}</span>
              <textarea
                ref={composerRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) return;
                  /* 한글·일본어는 글자를 조합하는 중에도 엔터가 옵니다. 그때 보내면
                     "안녕하세" 같은 조각이 나갑니다 — 조합 중에는 넘깁니다. */
                  if (event.nativeEvent.isComposing) return;
                  event.preventDefault();
                  if (draft.trim()) event.currentTarget.form?.requestSubmit();
                }}
                placeholder={t("{name}님에게 메시지 보내기", { name: selected.name })}
                rows={1}
                maxLength={LIMITS.message}
              />
              <button type="button" aria-label={t("이모지")} onClick={() => setDraft(`${draft} 😊`)}><Smile size={18} /></button>
            </label>
            <button
              type="button"
              className={coachOpen ? "composer-coach active" : "composer-coach"}
              aria-label={t("대화 코치")}
              aria-pressed={coachOpen}
              onClick={() => { const next = !coachOpen; setCoachOpen(next); if (next && !supportResult) void requestConversationSupport(false); }}
            >
              <WandSparkles size={18} />
            </button>
            <button className="send-button" type="submit" disabled={!draft.trim()} aria-label={t("메시지 보내기")}><Send size={18} /></button>
          </div>
        </form>}
      </section>
      ) : null}
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

/** 설정 모달. 어느 탭에 있든 그 위에 열립니다(예전에는 프로필 탭 안에만 있었습니다). */
function SettingsModal({
  settings,
  onChangeSettings,
  onDownloadChats,
  onOnboarding,
  onOpenBlocked,
  onToast,
  safetyReports,
  onCloseSettings,
  onSignOut,
}: {
  settings: AppSettings;
  onChangeSettings: (next: AppSettings) => void;
  onDownloadChats: () => Promise<void>;
  onOnboarding: () => void;
  onOpenBlocked: () => void;
  onToast: (message: string) => void;
  safetyReports: SafetyReportInfo[];
  onCloseSettings: () => void;
  onSignOut: () => Promise<void> | void;
}) {
  const toggle = (key: "hideLocation") => onChangeSettings({ ...settings, [key]: !settings[key] });
  /* 설정 모달 — 좌측 메뉴 선택값. 모바일에서는 pane 을 열었는지도 함께 봅니다. */
  const [settingsPane, setSettingsPane] = useState<SettingsPaneId>("learning");
  const [settingsPaneOpen, setSettingsPaneOpen] = useState(false);
  const currentSettingsSection = SETTINGS_SECTIONS.find((section) => section.id === settingsPane) ?? SETTINGS_SECTIONS[0];

  /* 계정 인증 — mock API 의 단계 상태를 읽고, 버튼으로 시작·완료 상태를 전환합니다. */
  const [verificationSteps, setVerificationSteps] = useState<VerificationStepInfo[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/verification")
      .then((response) => (response.ok ? (response.json() as Promise<{ data?: { steps?: VerificationStepInfo[] } }>) : Promise.reject(new Error(`Mock API returned ${response.status}`))))
      .then((body) => {
        if (!cancelled && body.data?.steps) setVerificationSteps(body.data.steps);
      })
      .catch(() => {
        // 오프라인이면 기본 목업 단계를 보여줍니다.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const advanceVerification = async (type: VerificationStepInfo["type"], action: "start" | "verify") => {
    try {
      const response = await fetch("/api/account/verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, action }),
      });
      if (!response.ok) throw new Error(`Mock API returned ${response.status}`);
      const body = await response.json() as { data?: { verification?: { steps?: VerificationStepInfo[] } } };
      if (body.data?.verification?.steps) setVerificationSteps(body.data.verification.steps);
      onToast(action === "verify" ? t("인증을 완료했어요") : t("인증을 시작했어요 · 확인 중"));
    } catch {
      onToast(t("지금은 인증 서버에 연결할 수 없어요."));
    }
  };

  const verificationRow = (
    type: VerificationStepInfo["type"],
    Icon: LucideIcon,
    title: string,
    subtitle: string,
    fallbackStatus: VerificationStepInfo["status"],
  ) => {
    const status = verificationSteps?.find((step) => step.type === type)?.status ?? fallbackStatus;
    if (status === "verified") {
      return <div className="verification-step done"><CheckCircle2 size={17} /><span><strong>{title}</strong><small>{tx(msg("완료됨"))}</small></span><Pill tone="success">{tx(msg("완료"))}</Pill></div>;
    }
    return (
      <div className="verification-step">
        <Icon size={17} />
        <span><strong>{title}</strong><small>{subtitle}</small></span>
        <button type="button" onClick={() => void advanceVerification(type, status === "pending" ? "verify" : "start")}>
          {status === "pending" ? t("인증 확인") : tx(msg("인증하기"))}
        </button>
      </div>
    );
  };

  return (
<div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseSettings(); }}>
          <div className="modal modal-settings" role="dialog" aria-modal="true" aria-label={t("설정")}>
            <button className="modal-close" type="button" onClick={onCloseSettings} aria-label={t("닫기")}><X size={20} /></button>
            <div className={`settings-shell ${settingsPaneOpen ? "pane-open" : ""}`}>
              <nav className="settings-nav" aria-label={t("설정 메뉴")}>
                <header><strong>{t("설정")}</strong></header>
                <ul>
                  {SETTINGS_SECTIONS.map((section) => {
                    const Icon = section.icon;
                    return (
                      <li key={section.id}>
                        <button
                          type="button"
                          className={settingsPane === section.id ? "active" : ""}
                          aria-current={settingsPane === section.id ? "page" : undefined}
                          onClick={() => { setSettingsPane(section.id); setSettingsPaneOpen(true); }}
                        >
                          <Icon size={17} />
                          <strong>{tx(section.label)}</strong>
                          <ChevronRight size={15} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <section className="settings-pane" aria-label={tx(currentSettingsSection.label)}>
                <header className="settings-pane-head">
                  <button className="settings-pane-back" type="button" onClick={() => setSettingsPaneOpen(false)} aria-label={t("설정 목록으로")}><ArrowLeft size={20} /></button>
                  <strong>{tx(currentSettingsSection.label)}</strong>
                </header>

                <div className="settings-pane-body">
                  {settingsPane === "learning" ? (
                    <>
                      <button className="profile-settings-link" type="button" onClick={onOnboarding}><span className="setting-icon"><Target size={17} /></span><span><strong>{t("언어 및 목표")}</strong><small>{t("학습 언어와 목표 다시 설정")}</small></span><ChevronRight size={15} /></button>
                      <LanguagePicker />
                    </>
                  ) : null}

                  {settingsPane === "privacy" ? (
                    <>
                      <div className="dm-scope-setting"><span className="field-label">{tx(msg("누가 바로 DM을 보낼 수 있나요?"))}</span><div className="choice-row">{([["matches", msg("매칭된 사람")], ["mutuals", msg("서로 팔로우")], ["anyone", msg("모든 사람")]] as Array<[DmScope, string]>).map(([value, label]) => <button type="button" className={settings.dmScope === value ? "active" : ""} key={value} onClick={() => { onChangeSettings({ ...settings, dmScope: value }); onToast(t("DM 수신 범위를 저장했어요")); }}>{tx(label)}</button>)}</div><small>{tx(msg("그 외 DM은 대화 목록이 아닌 요청함으로 분리돼요."))}</small></div>
                      <SettingRow icon={LockKeyhole} title={t("정밀 위치 숨기기")} description={t("도시 수준만 프로필에 표시")} checked={settings.hideLocation} onChange={() => toggle("hideLocation")} />
                    </>
                  ) : null}

                  {/* 켜고 끌 것이 아직 없습니다. 앱 밖으로 알림을 보내는 길(푸시·메일)이
                      없어서, 스위치를 두면 켜도 꺼도 아무 일이 없습니다.
                      지금 어떻게 알려주는지만 사실대로 적습니다. */}
                  {settingsPane === "notifications" ? (
                    <>
                      <div className="data-sync-status"><Bell size={17} /><span><strong>{t("앱 안에서 알려드려요")}</strong><small>{t("새 메시지는 대화 탭의 숫자로, 받은 교정은 프로필에서 확인할 수 있어요.")}</small></span></div>
                      <div className="settings-subhead"><strong>{t("푸시 알림")}</strong><small>{t("휴대폰 알림은 아직 준비 중이에요. 준비되면 여기서 켜고 끌 수 있어요.")}</small></div>
                    </>
                  ) : null}

                  {settingsPane === "data" ? (
                    <>
                      {/* 스위치가 아니었습니다 — 대화는 언제나 서버에 남습니다. 끌 수 있는 척하면
                          꺼둔 사람은 남지 않을 거라고 오해합니다. */}
                      <div className="data-sync-status"><Cloud size={17} /><span><strong>{t("대화는 서버에 저장돼요")}</strong><small>{t("앱을 지우거나 기기를 바꿔도 로그인하면 그대로 이어져요.")}</small></span></div>
                      <button className="profile-settings-link" type="button" onClick={() => void onDownloadChats()}><span className="setting-icon"><Download size={17} /></span><span><strong>{tx(msg("대화 기록 다운로드"))}</strong><small>{tx(msg("내 메시지를 파일로 보관"))}</small></span><ChevronRight size={15} /></button>
                    </>
                  ) : null}

                  {settingsPane === "verification" ? (
                    <>
                      <div className="verification-step done"><CheckCircle2 size={17} /><span><strong>{tx(msg("1단계 · 이메일 인증"))}</strong><small>{tx(msg("완료됨"))}</small></span><Pill tone="success">{tx(msg("완료"))}</Pill></div>
                      {verificationRow("phone", Phone, tx(msg("2단계 · 전화번호 인증")), tx(msg("재가입 악용과 대량 계정 생성을 줄여요")), "not-started")}
                      {verificationRow("identity", ShieldCheck, tx(msg("3단계 · 신원 확인")), tx(msg("선택 사항이며 인증 배지만 표시해요")), "not-started")}
                      <div className="settings-subhead"><strong>{t("이 기기에서 나가기")}</strong><small>{t("다시 로그인하면 대화와 기록이 그대로 돌아와요.")}</small></div>
                      <button className="danger-button settings-signout" type="button" onClick={() => void onSignOut()}><LogOut size={16} /> {t("로그아웃")}</button>
                    </>
                  ) : null}

                  {settingsPane === "safety" ? (
                    <>
                      <div className="settings-subhead first"><strong>{t("내 신고 내역")}</strong><small>{tx(msg("접수 내역과 검토 상태를 투명하게 확인해요"))}</small></div>
                      {safetyReports.length === 0 ? (
                        <p className="settings-empty">{t("아직 접수한 신고가 없어요")}</p>
                      ) : (
                        <ul className="report-case-list">
                          {safetyReports.map((report) => (
                            <li key={report.id}>
                              <div className="report-case-head">
                                <span><small>{tx(msg("접수번호"))}</small><strong>{shortReportId(report.id)}</strong></span>
                                <Pill tone={report.status === "action-taken" ? "success" : "soft"}>{tx(reportStatusLabels[report.status])}</Pill>
                              </div>
                              <ol className="report-timeline">
                                <li className="done"><Check size={12} /> {tx(msg("접수 완료"))}</li>
                                <li className={report.status === "triaging" ? "active" : report.status === "received" ? "" : "done"}><Clock3 size={12} /> {tx(msg("안전팀 검토"))}</li>
                                <li className={report.status === "action-taken" || report.status === "closed" ? "done" : ""}>{tx(msg("결과 안내"))}</li>
                              </ol>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="report-protection-note"><ShieldCheck size={16} /><span>{tx(msg("신고했다는 이유만으로 신고자 계정이 자동 제재되지 않아요. 양쪽 자료를 분리해 검토합니다."))}</span></p>
                      <button className="profile-settings-link" type="button" onClick={onOpenBlocked}><span className="setting-icon"><Flag size={17} /></span><span><strong>{t("신고 및 차단 관리")}</strong><small>{t("차단한 사용자와 지난 신고를 확인해요")}</small></span><ChevronRight size={15} /></button>
                    </>
                  ) : null}
                </div>
              </section>
            </div>
          </div>
        </div>
  );
}

function LearnView({
  counts,
  onToast,
  onEditProfile,
  savedItems,
  onSavePhrase,
  onOpenPost,
  onOpenSettings,
  onStartReview,
  savedCount,
  profileName,
  profileBio,
  me,
  onOpenTag,
  myPostList,
  onCopyLink,
  onDeletePost,
  corrections,
}: {
  /** 팔로잉·팔로워 수. 못 받아왔으면 숫자를 감춥니다. */
  counts?: { following: number; followers: number; posts: number };
  onEditProfile: () => void;
  savedItems: SavedPhrase[];
  onSavePhrase: (item: SavedPhrase) => void;
  onOpenPost: (post: FeedPost) => void;
  onOpenSettings: () => void;
  onStartReview: () => void;
  savedCount: number;
  profileName: string;
  profileBio: string;
  onToast: (message: string) => void;
  onOpenTag: (tag: string) => void;
  myPostList: FeedPost[];
  onCopyLink: (url: string) => void;
  onDeletePost: (post: FeedPost) => void;
  /** 로그인한 사람. 핸들·국기처럼 서버가 주는 값을 그립니다. */
  me: ApiProfile;
  /** 내 글에 달린 교정. 학습 화면이 "받은 교정" 으로 보여줍니다. */
  corrections: ApiCorrection[];
}) {
  const [profileTab, setProfileTab] = useState("posts");
  const [showAllSaved, setShowAllSaved] = useState(false);

  return (
    <div className="view learn-view compact-learn">
      <header className="profile-head">
        <div className="profile-head-id">
          <span className="profile-head-name">{profileName}<BadgeCheck size={18} className="verified" /></span>
          <p className="profile-head-handle">{me.handle}</p>
        </div>
        <Avatar name={profileName} flag={me.country?.flag ?? "🌐"} accent="violet" size="xl" online photo={me.avatarUrl} countryCode={me.country?.code} />
      </header>

      <p className="profile-head-bio">{profileBio}</p>

      <div className="profile-head-stats">
        {/* 연속 일수 같은 것은 서버가 아직 세지 않습니다. 지어낸 숫자를 보여주면
            사용자가 자기 기록으로 믿게 되므로, 셀 수 있는 것만 둡니다. */}
        <span><strong>{counts ? counts.posts : myPostList.length}</strong> {t("게시물")}</span>
        {counts ? <span><strong>{counts.following}</strong> {t("팔로잉")}</span> : null}
        {counts ? <span><strong>{counts.followers}</strong> {t("팔로워")}</span> : null}
      </div>

      <div className="profile-head-actions">
        <button className="secondary-button" type="button" onClick={onEditProfile}><PenLine size={16} /> {t("프로필 편집")}</button>
        <button className="secondary-button" type="button" onClick={onOpenSettings}><Settings size={16} /> {t("설정")}</button>
      </div>

      <Tabs
        tabs={[
          { id: "posts", label: t("내 글") },
          { id: "learning", label: t("학습") },
        ]}
        active={profileTab}
        onSelect={setProfileTab}
      />

      {profileTab === "posts" && myPostList.length === 0 ? (
        <div className="empty-state">
          <PenLine size={30} strokeWidth={1.5} />
          <strong>{t("아직 쓴 글이 없어요")}</strong>
          <p>{t("연습하고 싶은 문장을 짧게 올려보세요. 원어민이 고쳐줄 수 있어요.")}</p>
        </div>
      ) : null}

      {profileTab === "posts" ? (
        <div className="profile-posts">
          {myPostList.map((post) => (
            <article className="my-post" key={post.id}>
              <div className="my-post-head">
                <span className="my-post-time">{tx(post.time)}</span>
                <span className="my-post-lang">{tx(post.language)} · {post.level}</span>
                <span className="my-post-spacer" />
                <MenuPopover
                  label={t("게시물 메뉴")}
                  items={postMenuItems(post, {
                    saved: savedItems.some((saved) => saved.id === post.id),
                    onCopyLink: () => onCopyLink(`${window.location.origin}/#community/post/${post.id}`),
                    onSavePhrase: () => onSavePhrase(savedFromPost(post)),
                    onDelete: () => onDeletePost(post),
                    onHideAuthor: () => {},
                    onBlockAuthor: () => {},
                    onReport: () => {},
                  })}
                />
              </div>
              {/* 커뮤니티 피드와 같이, 본문을 누르면 상세로 갑니다. */}
              <button className="my-post-text post-copy-open" type="button" onClick={() => onOpenPost(post)}>{post.text}</button>
              <div className="post-tags">
                {post.tags.map((tag) => <button type="button" key={tag} onClick={() => onOpenTag(tag)}>{tag}</button>)}
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
        <article><span className="summary-icon violet"><PenLine size={18} /></span><small>{t("내 글")}</small><strong>{myPostList.length}<em>{t("개")}</em></strong></article>
        <article><span className="summary-icon mint"><Bookmark size={18} /></span><small>{t("저장한 표현")}</small><strong>{savedCount}<em>{t("개")}</em></strong></article>
        <article><span className="summary-icon amber"><PenLine size={18} /></span><small>{t("받은 교정")}</small><strong>{corrections.length}<em>{t("개")}</em></strong></article>
      </section>
      ) : null}

      {profileTab === "learning" ? (
      <div className="learn-compact-columns">
        <section className="saved-phrases-card">
          <header><span><strong>{t("저장한 표현")}</strong><small>{t("{n}개 · 약 4분", { n: savedCount })}</small></span>{savedItems.length > 3 ? <button type="button" onClick={() => setShowAllSaved((v) => !v)}>{showAllSaved ? t("접기") : t("전체")} <ChevronRight size={15} /></button> : null}</header>
          {savedItems.length === 0 ? (
            <p className="phrase-empty">{t("아직 저장한 표현이 없어요. 교정이나 게시물에서 저장해 보세요.")}</p>
          ) : (
          <div className="phrase-list">
            {(showAllSaved ? savedItems : savedItems.slice(0, 3)).map((item, index) => <article key={item.id}><button type="button" className="phrase-play" aria-label={t("듣기")} onClick={() => { if (!speakText(item.phrase)) onToast(t("이 브라우저에서는 음성 재생을 지원하지 않아요")); }}><Volume2 size={16} /></button><span><strong>{item.phrase}</strong>{item.meaning ? <small>{item.meaning}</small> : null}<em>{item.source}</em></span><span className={index === 0 ? "due-now" : ""}>{item.due}</span></article>)}
          </div>
          )}
          <button className="review-button" type="button" disabled={savedItems.length === 0} onClick={onStartReview}><BookOpenCheck size={17} /> {t("4분 복습 시작")}</button>
        </section>

        {/* 지금까지 "받은 교정 N개"는 숫자뿐이고 실체가 없었습니다. 여기서 실제로 읽습니다. */}
        <section className="received-corrections-card">
          <header><span><strong>{t("받은 교정")}</strong><small>{t("{n}개 · 내 문장이 어떻게 바뀌었는지", { n: corrections.length })}</small></span></header>
          {corrections.length === 0 ? (
            <p className="phrase-empty">{t("아직 받은 교정이 없어요. 글을 올릴 때 교정을 부탁해 보세요.")}</p>
          ) : null}
          <ul className="received-correction-list">
            {corrections.map((item) => (
              <li key={item.id}>
                <div className="received-correction-head">
                  <Avatar name={item.from ?? "?"} flag={item.fromFlag} accent={accentFor(item.id)} size="xs" />
                  <span><strong>{item.from ?? t("알 수 없는 상대")}</strong><small>{liveRelativeTime(item.createdAt)}</small></span>
                </div>
                <p className="before">{item.original}</p>
                <p className="after">{item.fixed}</p>
                <button
                  type="button"
                  className={savedItems.some((saved) => saved.id === item.id) ? "active" : ""}
                  aria-pressed={savedItems.some((saved) => saved.id === item.id)}
                  aria-label={t("복습에 저장")}
                  onClick={() => onSavePhrase({ id: item.id, phrase: item.fixed, meaning: item.original, source: t("받은 교정"), due: "" })}
                >
                  <Bookmark size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
      ) : null}

    </div>
  );
}

/**
 * 4분 복습 — 지금까지 토스트만 뜨던 자리입니다.
 * 표현을 한 장씩 보여주고, 눌러서 뜻을 확인한 뒤 다음으로 넘어갑니다.
 */
function ReviewModal({ items, onClose }: { items: SavedPhrase[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const item = items[index];
  const last = index === items.length - 1;

  /* 예전에는 "기억했어요 / 다시 볼래요" 를 물었지만, 어느 쪽을 골라도 다음 카드가 같았고
     고른 값은 마지막 숫자에만 쓰였습니다. 아무것도 바꾸지 않는 선택은 묻지 않습니다.
     지금은 버튼 하나로 "뜻 보기 → 다음" 만 반복합니다. */
  if (!item) {
    return (
      <div className="review-content review-done">
        <span className="review-done-icon"><BookOpenCheck size={28} /></span>
        <strong>{t("복습 끝!")}</strong>
        <p>{t("표현 {n}개를 봤어요", { n: items.length })}</p>
        <div className="review-actions">
          <button className="secondary-button" type="button" onClick={() => { setIndex(0); setRevealed(false); }}>{t("다시 하기")}</button>
          <button className="primary-button" type="button" onClick={onClose}>{t("닫기")}</button>
        </div>
      </div>
    );
  }

  const advance = () => {
    if (!revealed) { setRevealed(true); return; }
    setRevealed(false);
    setIndex((current) => current + 1);
  };

  return (
    <div className="review-content">
      <div className="review-head">
        <span className="review-count">{t("{index} / {total}", { index: index + 1, total: items.length })}</span>
        <div className="review-progress"><i style={{ width: `${((index + 1) / items.length) * 100}%` }} /></div>
      </div>

      {/* 카드를 눌러도, 아래 버튼을 눌러도 같은 동작입니다 — 한 손으로 쓰기 편하도록. */}
      <button className="review-card" type="button" onClick={advance}>
        <strong>{item.phrase}</strong>
        {revealed ? <span>{item.meaning || t("뜻이 저장되어 있지 않아요")}</span> : null}
        <small>{item.source}</small>
      </button>

      <button className="primary-button review-next" type="button" onClick={advance}>
        {revealed ? (last ? t("끝내기") : t("다음")) : t("뜻 보기")}
      </button>
    </div>
  );
}

type SettingsPaneId = "learning" | "privacy" | "notifications" | "data" | "verification" | "safety";

/** 설정 좌측 메뉴. 순서가 곧 화면 순서입니다. */
const SETTINGS_SECTIONS: Array<{ id: SettingsPaneId; label: string; icon: LucideIcon }> = [
  { id: "learning", label: msg("학습"), icon: Target },
  { id: "privacy", label: msg("개인정보"), icon: LockKeyhole },
  { id: "notifications", label: msg("알림"), icon: Bell },
  { id: "data", label: msg("대화 데이터"), icon: Cloud },
  { id: "verification", label: msg("계정 인증"), icon: BadgeCheck },
  { id: "safety", label: msg("신고 및 안전"), icon: ShieldCheck },
];

function SettingRow({ icon: Icon, title, description, checked, onChange }: { icon: LucideIcon; title: string; description: string; checked: boolean; onChange: () => void }) {
  return <label className="setting-row"><span className="setting-icon"><Icon size={17} /></span><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={onChange} /><i className="toggle" aria-hidden="true" /></label>;
}

function ModalLayer({
  modal,
  onClose,
  onStartChat,
  onOpenProfile,
  onPublish,
  onCreateRoom,
  onReport,
  onToast,
  mutedRoomIds,
  onToggleRoomMute,
  onCopyLink,
  existingPartnerIds,
  onMinimizeRoom,
  onBlockHost,
  onEndRoom,
  posts,
  directory,
  savedItems,
  likesReceived,
  sentLikes,
  followingIds,
  onToggleFollow,
  onOpenPost,
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
  onUpdateGoal,
}: {
  modal: Exclude<ModalState, null>;
  onClose: () => void;
  onStartChat: (partner: Partner) => void;
  onOpenProfile: (partner: Partner) => void;
  onPublish: (text: string, options: PublishOptions) => void;
  onCreateRoom: (details: { title: string; topic: string; language: string; level: string }) => void;
  onReport: (target: string, options?: ReportOptions) => void;
  mutedRoomIds: Set<string>;
  onToggleRoomMute: (id: string) => void;
  onCopyLink: (url: string) => void;
  existingPartnerIds: string[];
  onToast: (message: string) => void;
  onMinimizeRoom: (room: PracticeRoom) => void;
  onBlockHost: (room: PracticeRoom) => void;
  onEndRoom: (room: PracticeRoom) => void;
  posts: FeedPost[];
  directory: Partner[];
  savedItems: SavedPhrase[];
  likesReceived: ApiReceivedLike[];
  sentLikes: ApiReceivedLike[];
  followingIds: string[];
  onToggleFollow: (partner: Partner) => void;
  onOpenPost: (post: FeedPost) => void;
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
  onUpdateGoal: (goal: string) => void;
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
        {modal.type === "profile" ? <ProfileModal partner={modal.partner} following={followingIds.includes(modal.partner.id)} onToggleFollow={onToggleFollow} onStartChat={onStartChat} onReport={() => onReport(modal.partner.name)} /> : null}
        {modal.type === "filters" ? <MatchingPreferencesModal initial={matchPreferences} onClose={onClose} onSave={onSaveMatchPreferences} /> : null}
        {modal.type === "compose" ? <ComposeModal onPublish={onPublish} onToast={onToast} /> : null}
        {modal.type === "search" ? <SearchModal directory={directory} posts={posts} savedItems={savedItems} onOpenProfile={onOpenProfile} onOpenPost={onOpenPost} onToast={onToast} /> : null}
        {modal.type === "create-room" ? <CreateRoomModal onCreate={onCreateRoom} onToast={onToast} /> : null}
        {modal.type === "room" ? <RoomModal room={modal.room} handRaised={roomHandRaised} setHandRaised={setRoomHandRaised} micOn={roomMicOn} setMicOn={setRoomMicOn} messages={roomMessages} onSendMessage={onSendRoomMessage} onMinimize={() => onMinimizeRoom(modal.room)} onLeave={onClose} onReport={() => onReport(modal.room.title, { targetType: "room", targetId: modal.room.id })} onToast={onToast} onBlockHost={() => onBlockHost(modal.room)} onEndRoom={() => onEndRoom(modal.room)} mutedRoom={mutedRoomIds.has(modal.room.id)} onToggleRoomMute={onToggleRoomMute} onCopyLink={onCopyLink} /> : null}
        {modal.type === "exchange" ? <ExchangeModal length={exchangeLength} setLength={setExchangeLength} onClose={onClose} onToast={onToast} /> : null}
        {modal.type === "review" ? <ReviewModal items={modal.items} onClose={onClose} /> : null}
        {modal.type === "new-chat" ? (
          <NewChatModal
            directory={directory}
            existingPartnerIds={existingPartnerIds}
            onPick={(partner) => { onClose(); onStartChat(partner); }}
          />
        ) : null}
        {modal.type === "partner-list" ? <PartnerListModal queue={dailyQueue} index={partnerIndex} signaled={signaledPartners} onJump={onJumpPartner} onProfile={onOpenPartnerProfile} /> : null}
        {modal.type === "likes" ? (
          <LikesModal
            received={likesReceived.map((item) => ({
              partner: toPartner(item.partner),
              time: liveRelativeTime(item.createdAt),
              // 서버는 좋아요에 메모를 받지 않습니다. 지어내지 않고 비웁니다.
              note: "",
            }))}
            sent={sentLikes.map((item) => toPartner(item.partner))}
            onAccept={onAcceptLike}
            onProfile={onOpenPartnerProfile}
          />
        ) : null}
        {modal.type === "report" ? <ReportModal target={modal.target} onCancel={onClose} onConfirm={(options) => onReport(modal.target, { ...options, targetId: modal.targetId, targetType: modal.targetType })} /> : null}
        {modal.type === "onboarding" ? <OnboardingModal onClose={onClose} onToast={onToast} onUpdateGoal={onUpdateGoal} /> : null}
        {modal.type === "confirm" ? (
          <ConfirmModal
            title={modal.title}
            body={modal.body}
            confirmLabel={modal.confirmLabel}
            onCancel={requestClose}
            onConfirm={() => { modal.onConfirm(); requestClose(); }}
          />
        ) : null}
      </div>
    </div>
  );
}

/** 되돌릴 수 없는 행동을 한 번 묻는 작은 모달. 문구는 부르는 쪽이 정합니다. */
function ConfirmModal({ title, body, confirmLabel, onCancel, onConfirm }: { title: string; body: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="confirm-modal-content">
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="confirm-modal-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>{t("취소")}</button>
        <button className="danger-button" type="button" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </div>
  );
}

function modalLabel(type: Exclude<ModalState, null>["type"]) {
  const labels: Record<Exclude<ModalState, null>["type"], string> = { review: t("4분 복습 시작"), "new-chat": t("새 대화"), profile: t("파트너 프로필"), filters: t("매칭 설정"), compose: t("새 게시물"), search: t("통합 검색"), "create-room": t("보이스룸 만들기"), room: t("보이스룸"), exchange: t("언어 교환 세션"), "partner-list": t("오늘의 파트너 목록"), likes: t("주고받은 마음"), report: t("신고 및 차단"), onboarding: t("학습 목표 설정"), confirm: t("확인") };
  return labels[type];
}




/** 오늘의 파트너 목록. 지금까지 본 사람과 남은 사람을 한눈에 보고 바로 이동합니다. */

/** 마음 목록 행의 메타 줄. 현지 시각을 마운트 이후에 채웁니다. */
function LikeMeta({ partner, time }: { partner: Partner; time: string }) {
  const localTime = useLocalTime(partner.timeOffset);
  return (
    <small>
      <CountryFlag code={partner.countryCode} size={15} /> {tx(partner.country)}
      {localTime ? t(" · 현지 {localTime}", { localTime: localizeClock(localTime) }) : ""}
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
                <Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="sm" online={partner.online} photo={partner.photo} countryCode={partner.countryCode} />
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
  directory,
  existingPartnerIds,
  onPick,
}: {
  directory: Partner[];
  existingPartnerIds: string[];
  onPick: (partner: Partner) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const needle = query.trim().toLowerCase();
  const candidates = directory
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
                <Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="sm" online={partner.online} photo={partner.photo} countryCode={partner.countryCode} />
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
                <Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="sm" online={partner.online} photo={partner.photo} countryCode={partner.countryCode} />
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

function ProfileModal({ partner, following, onToggleFollow, onStartChat, onReport }: { partner: Partner; following: boolean; onToggleFollow: (partner: Partner) => void; onStartChat: (partner: Partner) => void; onReport: () => void }) {
  return (
    <div className="profile-modal-content">
      <div className={`profile-cover cover-${partner.accent}`}><span className="cover-pattern" /></div>
      <div className="profile-modal-head">
        <Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="xl" online={partner.online} photo={partner.photo} countryCode={partner.countryCode} />
        <div><span><h2>{partner.name}</h2>{partner.verified ? <BadgeCheck size={18} className="verified" /> : null}</span><p>{partner.handle} · {partner.city}</p></div>
        <div className="profile-head-actions"><button className="primary-button" type="button" onClick={() => onStartChat(partner)}><MessageCircle size={17} /> {t("대화 시작")}</button><button className={following ? "secondary-button active" : "secondary-button"} type="button" aria-pressed={following} onClick={() => onToggleFollow(partner)}><UserPlus size={16} /> {following ? t("팔로잉") : t("팔로우")}</button><button className="secondary-button" type="button" onClick={onReport}><Flag size={16} /> {t("신고")}</button></div>
      </div>
      <div className="profile-match-strip"><span><Sparkles size={17} /><b>{partner.compatibility}%</b> {t("교환 궁합")}</span><span><Timer size={17} /><b>{partner.balance}</b></span><span><ShieldCheck size={17} />{t("안전 프로필 확인됨")}</span></div>
      <div className="profile-modal-grid">
        <div className="profile-main">
          <section><h3>{t("자기소개")}</h3><p>{partner.bio}</p></section>
          <section><h3>{t("언어 교환")}</h3><div className="profile-language-grid"><span><small>{t("가르칠 수 있어요")}</small><strong><CountryFlag code={partner.countryCode} size={15} /> {tx(partner.native)}</strong><em>{t("원어민")}</em></span><span><small>{t("배우고 있어요")}</small><strong>🇰🇷 {tx(partner.learning)}</strong><em>{partner.level}</em></span></div></section>
          <section><h3>{t("관심사")}</h3><div className="interest-row large">{partner.interests.map((item) => <span key={item}>{item}</span>)}</div></section>
        </div>
        <aside className="profile-details"><h3>{t("잘 맞는 이유")}</h3><p><Clock3 size={16} /><span><strong>{t("활동 시간")}</strong><small>{partner.activeTime}</small></span></p><p><Trophy size={16} /><span><strong>{t("학습 목표")}</strong><small>{partner.goal}</small></span></p><p><PenLine size={16} /><span><strong>{t("교정 스타일")}</strong><small>{t("중요한 오류를 대화 후에")}</small></span></p></aside>
      </div>
    </div>
  );
}

function MatchingPreferencesModal({
  initial,
  onClose,
  onSave,
}: {
  initial: MatchPreferences;
  onClose: () => void;
  onSave: (preferences: MatchPreferences) => Promise<void>;
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
        <h2>{t("매일 만나고 싶은 상대를 설정해요")}</h2>
        <p>{tx(msg("필수 조건은 정확히 맞추고, 선호 조건이 가까운 파트너를 매일 12명 추천해요."))}</p>
      </header>
      <div className="form-section">
        <span className="field-label">{t("배우고 싶은 언어")} <small>{tx(msg("필수 조건"))}</small></span>
        <div className="choice-row three-columns">
          {[{ value: "en", label: t("영어"), flag: "🇺🇸" }, { value: "es", label: t("스페인어"), flag: "🇪🇸" }, { value: "ja", label: t("일본어"), flag: "🇯🇵" }].map((item) => (
            <button type="button" className={preferences.targetLanguages.includes(item.value) ? "active" : ""} key={item.value} onClick={() => setPreferences((current) => ({ ...current, targetLanguages: [item.value] }))}>{item.flag} {item.label}</button>
          ))}
        </div>
      </div>
      <div className="form-section">
        <span className="field-label">{tx(msg("함께할 파트너"))} <small>{tx(msg("개인 매칭 선호 · 프로필에는 공개되지 않아요"))}</small></span>
        <div className="choice-row">
          {(Object.entries(genderLabels) as Array<[PartnerGender, string]>).map(([value, label]) => (
            <button type="button" className={preferences.partnerGender === value ? "active" : ""} key={value} onClick={() => setPreferences((current) => ({ ...current, partnerGender: value }))}>{tx(label)}</button>
          ))}
        </div>
      </div>
      <div className="form-section">
        <span className="field-label">{tx(msg("선호 나이"))} <small>{tx(msg("우선 조건"))}</small></span>
        <div className="age-range-fields">
          <label><span>{tx(msg("최소"))}</span><input aria-label={tx(msg("파트너 최소 나이"))} type="number" min={18} max={preferences.ageMax} value={preferences.ageMin} onChange={(event) => setPreferences((current) => ({ ...current, ageMin: Math.max(18, Math.min(Number(event.target.value), current.ageMax)) }))} /><small>{tx(msg("세"))}</small></label>
          <span>–</span>
          <label><span>{tx(msg("최대"))}</span><input aria-label={tx(msg("파트너 최대 나이"))} type="number" min={preferences.ageMin} max={80} value={preferences.ageMax} onChange={(event) => setPreferences((current) => ({ ...current, ageMax: Math.max(current.ageMin, Math.min(Number(event.target.value), 80)) }))} /><small>{tx(msg("세"))}</small></label>
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
        <span className="field-label">{tx(msg("만남 목적"))} <small>{tx(msg("복수 선택 · 우선 조건"))}</small></span>
        <div className="chip-options">
          {(Object.entries(intentLabels) as Array<[MatchIntent, string]>).map(([intent, label]) => {
            const active = preferences.intents.includes(intent);
            return <button type="button" className={active ? "active" : ""} key={intent} onClick={() => toggleIntent(intent)}>{active ? <Check size={13} /> : <Plus size={13} />}{tx(label)}</button>;
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
      <label className="setting-row standalone">
        <span className="setting-icon"><BadgeCheck size={17} /></span>
        <span><strong>{tx(msg("인증된 프로필 우선"))}</strong><small>{tx(msg("전화번호 또는 신원 확인이 끝난 계정을 먼저 추천해요"))}</small></span>
        <input aria-label={tx(msg("인증된 프로필 우선"))} type="checkbox" checked={preferences.verifiedOnly} onChange={() => setPreferences((current) => ({ ...current, verifiedOnly: !current.verifiedOnly }))} />
        <i className="toggle" />
      </label>
      <div className="matching-schedule-note"><CalendarClock size={18} /><span><strong>{tx(msg("다음 추천 · 내일 오전 9시"))}</strong><small>{tx(msg("선호 조건이 부족해도 필수 조건을 벗어난 사람을 임의로 섞지 않아요."))}</small></span><Pill tone="success">{tx(msg("12명"))}</Pill></div>
      <div className="modal-footer">
        <button className="text-button" type="button" onClick={() => setPreferences(defaultMatchPreferences)}><RotateCcw size={15} /> {t("초기화")}</button>
        <button className="primary-button" type="button" disabled={saving || !preferences.targetLanguages.length || !preferences.availability.length || !preferences.intents.length} onClick={() => void save()}>{saving ? t("저장 중…") : tx(msg("설정 저장하고 12명 보기"))}</button>
      </div>
    </div>
  );
}

/** 붙일 수 있는 파일 크기 상한. 문서 한도(1MB)에 여유를 둡니다. */
const MAX_ATTACHMENT = 520000;

/**
 * 고른 사진을 보낼 수 있는 크기로 줄입니다.
 *
 * 원본은 몇 MB 라 그대로는 담기지 않습니다. 들어갈 때까지 조금씩 더 줄여서,
 * 사진이 몇 KB 인지 사용자가 알 필요가 없게 합니다 — 예전에는 "64KB 이하여야
 * 합니다" 라고만 알리고 얼마나 줄여야 하는지는 알려주지 않았습니다.
 *
 * 저장소 버킷이 생기면 이 함수 대신 업로드하고 받은 주소를 쓰면 됩니다.
 */
async function shrinkImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const attempts: Array<[number, number]> = [
    [1280, 0.75],
    [1024, 0.7],
    [800, 0.65],
    [640, 0.6],
  ];
  let smallest = "";
  for (const [edge, quality] of attempts) {
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    smallest = canvas.toDataURL("image/jpeg", quality);
    if (smallest.length <= MAX_ATTACHMENT) break;
  }
  bitmap.close();
  return smallest;
}

/** 브라우저 녹음기. 멈추면 데이터 URI 를 돌려줍니다. */
function startRecorder(onDone: (media: string) => void, onFail: () => void) {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) { onFail(); return null; }
  let recorder: MediaRecorder | null = null;
  void navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const reader = new FileReader();
        reader.onload = () => onDone(String(reader.result || ""));
        reader.readAsDataURL(new Blob(chunks, { type: recorder?.mimeType || "audio/webm" }));
      };
      recorder.start();
    })
    .catch(onFail);
  return () => recorder?.stop();
}

/** 글에 달 수 있는 주제. 서버의 tags 로 그대로 갑니다. */
const POST_TOPICS: MessageKey[] = [
  msg("오늘의연습"),
  msg("표현질문"),
  msg("문법질문"),
  msg("일상"),
  msg("여행"),
  msg("음식"),
  msg("영화"),
  msg("음악"),
];

function ComposeModal({ onPublish, onToast }: { onPublish: (text: string, options: PublishOptions) => void; onToast: (message: string) => void }) {
  const [text, setText] = useState("");
  const [correction, setCorrection] = useState(true);
  const [visibility, setVisibility] = useState<PublishOptions["visibility"]>("public");
  const [topics, setTopics] = useState<string[]>([]);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [image, setImage] = useState("");
  const [audio, setAudio] = useState("");
  const [recording, setRecording] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const pickPhoto = async (file: File) => {
    try {
      const media = await shrinkImage(file);
      if (media.length > MAX_ATTACHMENT) return onToast(t("사진을 줄여도 너무 커요. 다른 사진을 골라주세요."));
      setImage(media);
    } catch {
      onToast(t("이 형식은 브라우저가 열지 못해요. JPG·PNG 로 저장해서 올려주세요."));
    }
  };

  const toggleRecording = () => {
    if (stopRef.current) { stopRef.current(); stopRef.current = null; setRecording(false); return; }
    const stop = startRecorder(
      (media) => {
        setRecording(false);
        stopRef.current = null;
        if (media.length > MAX_ATTACHMENT) return onToast(t("녹음이 너무 길어요. 30초 안쪽으로 다시 녹음해 주세요."));
        setAudio(media);
      },
      () => { setRecording(false); stopRef.current = null; onToast(t("마이크를 쓸 수 없어요. 브라우저 권한을 확인해 주세요.")); },
    );
    if (stop) { stopRef.current = stop; setRecording(true); onToast(t("녹음 중이에요. 다시 누르면 멈춰요.")); }
  };

  const toggleTopic = (topic: string) =>
    setTopics((current) =>
      current.includes(topic) ? current.filter((item) => item !== topic) : current.length >= 3 ? current : [...current, topic],
    );

  return (
    <div className="compose-modal-content">
      {/* 예전에는 여기 "NEW NOTE" 배지와 내 아바타가 있었습니다. 배지는 번역도 안 되는
          장식이었고, 아바타는 fixture 사용자(내가 아닌 사람)의 이름과 레벨을 보여줬습니다. */}
      <header><h2>{t("글쓰기")}</h2></header>

      <label className="compose-text">
        <span className="sr-only">{t("게시물 내용")}</span>
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={t("연습하고 싶은 문장, 궁금한 표현, 문화 이야기를 짧게 나눠보세요…")} rows={7} maxLength={LIMITS.post} />
        <small>{text.length}/{LIMITS.post}</small>
      </label>

      {image ? (
        <div className="compose-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" />
          <button type="button" aria-label={t("사진 빼기")} onClick={() => setImage("")}><X size={15} /></button>
        </div>
      ) : null}
      {audio ? (
        <div className="compose-preview compose-preview-audio">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={audio} controls preload="none" />
          <button type="button" aria-label={t("음성 빼기")} onClick={() => setAudio("")}><X size={15} /></button>
        </div>
      ) : null}

      <input
        ref={photoInputRef}
        className="sr-only"
        type="file"
        accept="image/*"
        aria-label={t("사진 고르기")}
        onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void pickPhoto(file); }}
      />

      <div className="compose-options">
        <button type="button" className="compose-option" onClick={() => photoInputRef.current?.click()}>
          <ImageIcon size={16} /> {t("사진")}
        </button>
        <button type="button" className={recording ? "compose-option recording" : "compose-option"} onClick={toggleRecording}>
          <Mic size={16} /> {recording ? t("녹음 멈추기") : t("음성")}
        </button>
        <button type="button" className="compose-option" onClick={() => setVisibility(visibility === "public" ? "partners" : "public")}>
          <Users size={16} /> {visibility === "public" ? t("전체 공개") : t("파트너만 공개")} <ChevronDown size={14} />
        </button>
        <button type="button" className={topicsOpen ? "compose-option active" : "compose-option"} aria-expanded={topicsOpen} onClick={() => setTopicsOpen(!topicsOpen)}>
          <Plus size={16} /> {topics.length ? t("주제 {n}개", { n: topics.length }) : t("주제")}
        </button>
      </div>

      {topicsOpen ? (
        <div className="compose-topics" role="group" aria-label={t("주제")}>
          {POST_TOPICS.map((topic) => (
            <button
              type="button"
              key={topic}
              className={topics.includes(topic) ? "active" : ""}
              aria-pressed={topics.includes(topic)}
              onClick={() => toggleTopic(topic)}
            >
              #{t(topic)}
            </button>
          ))}
          <small>{t("최대 3개까지 고를 수 있어요")}</small>
        </div>
      ) : null}

      <label className="correction-request">
        <span className="setting-icon"><WandSparkles size={17} /></span>
        <span><strong>{t("원어민에게 교정 요청")}</strong><small>{t("글에 \"교정 부탁해요\" 표시가 붙어요")}</small></span>
        <input aria-label={t("원어민에게 교정 요청")} type="checkbox" checked={correction} onChange={() => setCorrection(!correction)} />
        <i className="toggle" />
      </label>

      <div className="modal-footer">
        <span className="safety-note"><ShieldCheck size={14} /> {t("연락처와 정밀 위치는 공유하지 마세요.")}</span>
        <button className="primary-button" type="button" disabled={!canSubmit(text, "post")} onClick={() => { const checked = checkText(text, "post"); if (!checked.ok) { if (checked.error) onToast(checked.error); return; } onPublish(checked.value, { requestCorrection: correction, visibility, tags: topics, image, audio }); }}>{t("게시하기")} <Send size={16} /></button>
      </div>
    </div>
  );
}

function SearchModal({ directory, posts, savedItems, onOpenProfile, onOpenPost, onToast }: { directory: Partner[]; posts: FeedPost[]; savedItems: SavedPhrase[]; onOpenProfile: (partner: Partner) => void; onOpenPost: (post: FeedPost) => void; onToast: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  /* 자리표시자가 약속하는 대로 사람 · 게시물 · 저장한 표현을 함께 찾습니다.
     검색어가 없으면 아무것도 내지 않습니다 — 예전에는 빈 검색어가 모두와 일치해서
     아직 찾지도 않은 사람이 결과처럼 보였습니다. */
  const partnerResults = needle ? directory.filter((partner) => `${partner.name} ${partner.handle} ${partner.native} ${partner.interests.join(" ")}`.toLowerCase().includes(needle)).slice(0, 3) : [];
  const postResults = needle ? posts.filter((post) => `${post.text} ${post.tags.join(" ")} ${post.author}`.toLowerCase().includes(needle)).slice(0, 4) : [];
  const phraseResults = needle ? savedItems.filter((item) => `${item.phrase} ${item.meaning}`.toLowerCase().includes(needle)).slice(0, 3) : [];
  const nothingFound = needle && !partnerResults.length && !postResults.length && !phraseResults.length;

  const copyPhrase = async (phrase: string) => {
    try {
      await navigator.clipboard.writeText(phrase);
      onToast(t("표현을 복사했어요"));
    } catch {
      onToast(t("복사하지 못했어요 · 브라우저가 막았어요"));
    }
  };

  return (
    <div className="search-modal-content">
      <header><Search size={21} /><input aria-label={t("검색")} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("사람, 언어, 주제, 저장한 표현 검색")} /></header>
      <div className="search-chips"><span>{t("빠른 검색")}</span>{[t("영어 원어민"), t("지금 온라인"), t("#여행"), t("저장한 표현")].map((item) => <button type="button" key={item} onClick={() => setQuery(item.replace("#", ""))}>{item}</button>)}</div>
      <section>
        <h3>{query ? t("“{query}” 검색 결과", { query }) : t("추천 파트너")}</h3>
        {partnerResults.map((partner) => <button className="search-result" type="button" key={partner.id} aria-label={t("{name} 프로필 보기", { name: partner.name })} onClick={() => onOpenProfile(partner)}><Avatar name={partner.name} flag={partner.flag} accent={partner.accent} size="sm" online={partner.online} photo={partner.photo} countryCode={partner.countryCode} /><span><strong>{partner.name}</strong><small>{partner.native} ⇄ {partner.learning} · {partner.interests.join(" · ")}</small></span><Pill tone="success">{partner.compatibility}%</Pill><ChevronRight size={16} /></button>)}
        {nothingFound ? <div className="empty-search"><Search size={28} /><strong>{t("검색 결과가 없어요")}</strong><p>{t("언어나 관심사를 더 짧게 입력해보세요.")}</p></div> : null}
      </section>
      {postResults.length ? (
        <section>
          <h3>{t("게시물")}</h3>
          {postResults.map((post) => <button className="search-result" type="button" key={post.id} onClick={() => onOpenPost(post)}><Avatar name={post.author} flag={post.flag} accent={post.accent} size="sm" photo={post.photo} countryCode={post.countryCode} /><span><strong>{post.author}</strong><small>{post.text.length > 64 ? `${post.text.slice(0, 64)}…` : post.text}</small></span><ChevronRight size={16} /></button>)}
        </section>
      ) : null}
      {phraseResults.length ? (
        <section>
          <h3>{t("저장한 표현")}</h3>
          {phraseResults.map((item) => <button className="search-result" type="button" key={item.phrase} onClick={() => void copyPhrase(item.phrase)}><span><strong>{item.phrase}</strong><small>{item.meaning} · {t("누르면 복사돼요")}</small></span><ChevronRight size={16} /></button>)}
        </section>
      ) : null}
    </div>
  );
}

function CreateRoomModal({ onCreate, onToast }: { onCreate: (details: { title: string; topic: string; language: string; level: string }) => void; onToast: (message: string) => void }) {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState(t("영어"));
  const [level, setLevel] = useState(t("모든 레벨"));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const checkedTitle = checkText(title, "roomTitle");
    if (!checkedTitle.ok) { if (checkedTitle.error) onToast(checkedTitle.error); return; }
    const checkedTopic = checkText(topic, "roomTopic");
    if (!checkedTopic.ok) { if (checkedTopic.error) onToast(checkedTopic.error); return; }
    onCreate({ title: checkedTitle.value, topic: checkedTopic.value, language, level });
  };

  return (
    <form className="create-room-form" onSubmit={submit}>
      <header><span className="summary-icon violet"><Mic size={20} /></span><div><h2>{t("보이스룸 만들기")}</h2><p>{t("제목과 대화 주제만 정하면 바로 목록에 추가돼요.")}</p></div></header>
      <label><span className="field-label">{t("방 제목")}</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("예: 퇴근 후 15분 영어")} maxLength={LIMITS.roomTitle} /></label>
      <label><span className="field-label">{t("대화 주제")}</span><input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder={t("예: 여행에서 기억에 남는 순간")} maxLength={LIMITS.roomTopic} /></label>
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
  onBlockHost,
  onEndRoom,
}: {
  mutedRoom: boolean;
  onToggleRoomMute: (id: string) => void;
  onCopyLink: (url: string) => void;
  onBlockHost: () => void;
  onEndRoom: () => void;
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
  const [captionTranslation, setCaptionTranslation] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);

  /** 자막 번역 — mock 번역 API 를 부르고, 오프라인이면 준비된 번역을 보여줍니다. */
  const translateCaption = async () => {
    if (captionTranslation) {
      setCaptionTranslation(null);
      return;
    }
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: ROOM_CAPTION, targetLanguage: "ko" }),
      });
      if (!response.ok) throw new Error(`Mock API returned ${response.status}`);
      const body = await response.json() as { data?: { translatedText?: string } };
      if (!body.data?.translatedText) throw new Error("Missing mock translation");
      setCaptionTranslation(body.data.translatedText);
      onToast(t("선택한 문장을 번역했어요"));
    } catch {
      setCaptionTranslation(t("오늘 하루 작은 성공이 있었다면 무엇인가요?"));
      onToast(t("준비된 번역을 보여드려요 · 오프라인 데모"));
    }
  };

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

  /** 내가 연 방인지. 호스트는 손들기 없이 바로 발언하고, 신고·차단 대상이 되지 않습니다. */
  const isHost = room.host === currentUser.name;
  const canSpeak = isHost || handRaised;
  const micLabel = !canSpeak ? t("발언 요청을 먼저 해주세요") : micOn ? t("마이크 끄기") : t("마이크 켜기");

  return (
    <div className={`room-modal-content room-state-${room.accent}`}>
      <header>
        <div>
          <Pill tone="live"><span className="live-dot" /> LIVE · {t("{n}명", { n: room.listeners || 1 })}</Pill>
          <h2>{room.title}</h2>
          <p>{tx(room.language)} · {tx(room.level)} · {isHost ? t("내가 호스트") : `${t("호스트")} ${room.hostFlag} ${room.host}`}</p>
        </div>
        <div className="room-header-actions">
          <IconButton label={t("보이스룸 축소")} icon={Minimize2} onClick={onMinimize} />
          <MenuPopover
            label={t("방 메뉴")}
            items={[
              { id: "link", label: t("방 링크 복사"), icon: LinkIcon, onSelect: () => onCopyLink(`${window.location.origin}/#practice/room/${room.id}`) },
              { id: "mute", label: mutedRoom ? t("이 방 알림 켜기") : t("이 방 알림 끄기"), icon: BellOff, onSelect: () => onToggleRoomMute(room.id) },
              ...(isHost
                ? [{ id: "end", label: t("방 종료하기"), icon: LogOut, danger: true, onSelect: () => { onToast(t("보이스룸을 종료했어요")); onEndRoom(); } }]
                : [
                    { id: "leave", label: t("방 나가기"), icon: LogOut, onSelect: () => { onToast(t("보이스룸에서 나왔어요")); onLeave(); } },
                    { id: "block", label: t("호스트 차단하기"), icon: Ban, danger: true, onSelect: onBlockHost },
                    { id: "report", label: t("신고하기"), icon: Flag, danger: true, onSelect: onReport },
                  ]),
            ]}
          />
        </div>
      </header>

      <div className="room-stage">
        <div className={`stage-seat ${isHost && !micOn ? "" : "speaking"}`}>
          <Avatar name={room.host} flag={room.hostFlag} accent={room.accent} size="lg" online />
          <strong>{isHost ? t("나") : room.host}</strong>
          <small>{isHost && !micOn ? t("호스트 · 음소거") : t("호스트 · 말하는 중")}</small>
          <span>{isHost && !micOn ? <MicOff size={13} /> : <Mic size={13} />}</span>
        </div>
        {room.speakers.slice(1).map((speaker, index) => (
          <div className="stage-seat" key={speaker}>
            <Avatar name={speaker} accent={(["mint", "amber", "blue"] as Accent[])[index % 3]} size="md" />
            <strong>{speaker}</strong>
            <small>{index === 0 ? t("모더레이터") : t("스피커")}</small>
            <span><Mic size={13} /></span>
          </div>
        ))}
        {isHost ? (
          <div className="stage-seat empty is-host">
            <span><Hand size={20} /></span>
            <strong>{t("발언 요청 없음")}</strong>
            <small>{t("요청이 오면 여기에 표시돼요")}</small>
          </div>
        ) : (
          <button
            className={`stage-seat empty ${handRaised ? "waiting" : ""}`}
            type="button"
            onClick={toggleHand}
          >
            <span><Plus size={20} /></span>
            <strong>{handRaised ? t("승인 대기 중") : t("빈 자리")}</strong>
            <small>{handRaised ? t("호스트가 확인하고 있어요") : t("눌러서 발언 요청")}</small>
          </button>
        )}
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
            {room.audience.length === 0 ? (
              <li className="room-audience-more">{t("아직 듣는 사람이 없어요")}</li>
            ) : null}
            {room.listeners > room.audience.length ? (
              <li className="room-audience-more">{t("외 {n}명", { n: room.listeners - room.audience.length })}</li>
            ) : null}
          </ul>
        ) : null}
      </section>

      <div className="live-caption">
        <span><Volume2 size={15} /> {t("실시간 자막 · 데모")}</span>
        <p>“{ROOM_CAPTION}”</p>
        {captionTranslation ? <p><Languages size={13} /> {captionTranslation}</p> : null}
        <button type="button" onClick={() => void translateCaption()}>{captionTranslation ? t("번역 닫기") : t("문장 번역")}</button>
      </div>

      <div className="room-chat" ref={chatRef} role="log" aria-label={t("보이스룸 채팅")}>
        {messages.length === 0 ? <p className="room-chat-empty">{t("아직 대화가 없어요. 먼저 인사해보세요")}</p> : null}
        {messages.map((message) => (
          <p key={message.id} className={message.mine ? "mine" : ""}>
            <b>{message.mine ? t("나") : message.name}</b> {message.text}
          </p>
        ))}
      </div>

      <footer>
        <button
          className={`room-action ${micOn ? "mic-active" : canSpeak ? "mic-muted" : ""}`}
          type="button"
          onClick={toggleMic}
          disabled={!canSpeak}
          aria-label={micLabel}
          aria-pressed={micOn}
          title={micLabel}
        >
          {micOn ? <Mic size={19} /> : <MicOff size={19} />}
        </button>
        {isHost ? null : (
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
        )}
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

function ReportModal({ target, onCancel, onConfirm }: { target: string; onCancel: () => void; onConfirm: (options: { reason: string; block: boolean }) => void }) {
  const [reason, setReason] = useState("spam");
  const [block, setBlock] = useState(false);
  return (
    <div className="report-content">
      <span className="report-icon"><ShieldCheck size={24} /></span>
      <h2>{t("안전하게 이용할 수 있도록 도와주세요")}</h2>
      <p><b>{target}</b>{t("을(를) 신고하거나 차단할 수 있어요. 신고 내용은 상대에게 알려지지 않습니다.")}</p>
      <div className="report-options">
        {[["spam", t("스팸 또는 광고")], ["scam", t("사기 · 금전 요구")], ["dating", t("데이트·연애 목적")], ["harassment", t("괴롭힘 또는 혐오 표현")], ["privacy", t("개인정보 요구")], ["other", t("기타")]].map(([id, label]) => (
          <label key={id}>
            <input aria-label={label} type="radio" name="reason" value={id} checked={reason === id} onChange={() => setReason(id)} />
            <span>{label}</span><CheckCircle2 size={17} />
          </label>
        ))}
      </div>
      <label className="block-option">
        <input aria-label={t("이 사용자도 함께 차단")} type="checkbox" checked={block} onChange={() => setBlock(!block)} />
        <span><strong>{t("이 사용자도 함께 차단")}</strong><small>{t("프로필과 메시지가 서로 보이지 않아요.")}</small></span>
      </label>
      <div className="reporter-protection-note"><ShieldCheck size={17} /><span><strong>{tx(msg("신고자 보호 원칙"))}</strong><small>{tx(msg("신고했다는 이유만으로 계정을 정지하지 않으며, 자동 제재 없이 안전팀이 맥락을 검토해요."))}</small></span></div>
      <div className="modal-footer"><button className="secondary-button" type="button" onClick={onCancel}>{t("취소")}</button><button className="danger-button" type="button" onClick={() => onConfirm({ reason, block })}><Flag size={16} /> {t("신고 보내기")}</button></div>
    </div>
  );
}

const RHYTHM_TIMES = [msg("평일 낮"), msg("평일 저녁 7–10시"), msg("주말 오전"), msg("밤 늦게")];
const RHYTHM_CORRECTIONS = [msg("바로바로 고쳐주기"), msg("대화 후 중요한 오류만"), msg("요청할 때만")];

function OnboardingModal({ onClose, onToast, onUpdateGoal }: { onClose: () => void; onToast: (message: string) => void; onUpdateGoal: (goal: string) => void }) {
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState("conversation");
  const [nativeCode, setNativeCode] = useState("ko");
  const [learningCode, setLearningCode] = useState("en");
  const [openRhythm, setOpenRhythm] = useState<"time" | "correction" | null>(null);
  const [activeTime, setActiveTime] = useState<string>(RHYTHM_TIMES[1]);
  const [correctionStyle, setCorrectionStyle] = useState<string>(RHYTHM_CORRECTIONS[1]);
  const goals: Array<[string, LucideIcon, string, string]> = [
    ["conversation", MessageCircle, t("일상 대화"), t("자연스럽고 편하게 말하기")],
    ["career", Trophy, t("업무 · 커리어"), t("회의와 발표 자신감")],
    ["travel", Globe2, t("여행"), t("현지에서 바로 쓰기")],
    ["exam", BookOpenCheck, t("시험 · 자격"), t("정확한 문법과 어휘")],
  ];

  return (
    <div className="onboarding-content">
      <header>
        <strong>{t("언어 및 목표")}</strong>
        <span>{t("STEP {step} / 3", { step })}</span>
      </header>
      <div className="onboarding-progress"><i style={{ width: `${step * 33.333}%` }} /></div>

      {step === 1 ? (
        <section>
          <Pill tone="soft">LANGUAGE</Pill>
          <h2>{t("어떤 언어를 함께 나누고 싶나요?")}</h2>
          <p>{t("나중에 프로필에서 언제든 바꿀 수 있어요.")}</p>
          <div className="onboarding-language-groups">
            <div className="form-section">
              <span className="field-label">{t("내 모국어")}</span>
              <div className="chip-options">
                {languageOptions.map((option) => (
                  <button
                    key={option.code}
                    type="button"
                    className={nativeCode === option.code ? "active" : ""}
                    aria-pressed={nativeCode === option.code}
                    onClick={() => { setNativeCode(option.code); if (learningCode === option.code) setLearningCode(languageOptions.find((item) => item.code !== option.code)!.code); }}
                  >
                    <span aria-hidden="true">{option.flag}</span> {tx(option.label)}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-section">
              <span className="field-label">{t("배울 언어")}</span>
              <div className="chip-options">
                {languageOptions.map((option) => (
                  <button
                    key={option.code}
                    type="button"
                    className={learningCode === option.code ? "active" : ""}
                    aria-pressed={learningCode === option.code}
                    disabled={nativeCode === option.code}
                    onClick={() => setLearningCode(option.code)}
                  >
                    <span aria-hidden="true">{option.flag}</span> {tx(option.label)}
                  </button>
                ))}
              </div>
            </div>
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
            <div className={`rhythm-row ${openRhythm === "time" ? "open" : ""}`}>
              <button type="button" aria-expanded={openRhythm === "time"} onClick={() => setOpenRhythm(openRhythm === "time" ? null : "time")}>
                <Clock3 size={18} /><span><strong>{t("주 활동 시간")}</strong><small>{tx(activeTime)}</small></span><ChevronDown size={16} />
              </button>
              {openRhythm === "time" ? (
                <div className="chip-options">
                  {RHYTHM_TIMES.map((option) => (
                    <button key={option} type="button" className={activeTime === option ? "active" : ""} aria-pressed={activeTime === option} onClick={() => { setActiveTime(option); setOpenRhythm(null); }}>{tx(option)}</button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className={`rhythm-row ${openRhythm === "correction" ? "open" : ""}`}>
              <button type="button" aria-expanded={openRhythm === "correction"} onClick={() => setOpenRhythm(openRhythm === "correction" ? null : "correction")}>
                <PenLine size={18} /><span><strong>{t("교정 선호")}</strong><small>{tx(correctionStyle)}</small></span><ChevronDown size={16} />
              </button>
              {openRhythm === "correction" ? (
                <div className="chip-options">
                  {RHYTHM_CORRECTIONS.map((option) => (
                    <button key={option} type="button" className={correctionStyle === option ? "active" : ""} aria-pressed={correctionStyle === option} onClick={() => { setCorrectionStyle(option); setOpenRhythm(null); }}>{tx(option)}</button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="rhythm-row">
              <label><ShieldCheck size={18} /><span><strong>{t("프로필 공개 범위")}</strong><small>{t("위치는 도시 수준까지만 공개")}</small></span><input aria-label={t("정밀 위치 숨기기")} type="checkbox" defaultChecked /><i className="toggle" /></label>
            </div>
          </div>
        </section>
      ) : null}

      <footer>
        <button className="secondary-button" type="button" onClick={() => step === 1 ? onClose() : setStep(step - 1)}>{step === 1 ? t("나중에") : t("이전")}</button>
        <button className="primary-button" type="button" onClick={() => { if (step < 3) setStep(step + 1); else { onUpdateGoal(goals.find(([id]) => id === goal)?.[2] ?? t("일상 대화")); onClose(); onToast(t("학습 목표를 업데이트했어요")); } }}>{step < 3 ? t("다음") : t("추천 시작")}<ChevronRight size={16} /></button>
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
      <AuthGate />
    </I18nProvider>
  );
}

/**
 * 로그인한 사람만 안쪽 화면을 봅니다.
 *
 * 세션 확인이 끝나기 전에는 아무것도 그리지 않습니다 — 로그인 화면을 잠깐 보여줬다가
 * 안쪽으로 바뀌면 이미 로그인한 사람에게는 깜빡임으로 보입니다.
 */
function AuthGate() {
  useLocaleRerender();
  const [state, setState] = useState<"checking" | "in" | "out">("checking");
  const [me, setMe] = useState<ApiProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ user: ApiProfile }>("/api/auth/me")
      .then((result) => {
        if (cancelled) return;
        setMe(result.user);
        setState("in");
      })
      .catch(() => {
        if (!cancelled) setState("out");
      });
    return () => { cancelled = true; };
  }, []);

  if (state === "checking") {
    return (
      <main className="signin-page">
        <section className="signin-intro">
          <div className="signin-brand">
            <span className="brand-mark"><Languages size={22} /></span>
            <span>Lingo<strong>Loop</strong></span>
          </div>
          <p>{t("로그인 상태를 확인하고 있어요.")}</p>
        </section>
      </main>
    );
  }

  if (state === "out" || !me) {
    return <SignIn onSignedIn={(user) => { setMe(user); setState("in"); }} />;
  }

  // 계정이 바뀌면 화면 상태를 처음부터 다시 만듭니다.
  return <LingoLoopScreens key={me.id} me={me} onSignedOut={() => { setMe(null); setState("out"); }} />;
}
