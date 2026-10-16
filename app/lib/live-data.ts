// 브라우저 배선이 들어 있는 ./i18n 이 아니라 플랫폼 공용 core 를 봅니다 —
// 이 파일은 앱(React Native)에서도 그대로 씁니다.
import { currentLocaleSnapshot, msg, t, tx } from "./i18n/core";
import { normalizeAvatarConfig, normalizeAvatarMode, type AvatarConfig, type AvatarMode } from "./avatar";
import { normalizeRoom, type RoomConfig } from "./room";
import type {
  Accent,
  ChatMessage,
  Conversation,
  FeedPost,
  Partner,
  PostReply,
  SavedPhrase,
} from "./demo-data";

/**
 * 서버가 주는 모양을 화면이 쓰는 모양으로 옮깁니다.
 *
 * 화면(LingoLoopApp)은 오래전에 만든 fixture 모양에 맞춰져 있고, 서버는 그와 다른
 * 모양으로 답합니다. 둘 중 하나를 상대에 맞춰 고치는 대신 여기서 옮깁니다 —
 * 화면을 고치면 공들여 잡아둔 레이아웃이 흔들리고, 서버를 고치면 이미 도는
 * 운영 계약이 흔들립니다.
 *
 * 서버에 없는 값(시차, 색, 말풍선 시각 표기 등)은 여기서 만들어 채웁니다.
 * "없어서 비는 것"과 "서버가 준 것"이 섞이지 않게 이 파일에만 둡니다.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type Envelope<T> = { data: T; error?: { code?: string; message?: string } };

/** 세션이 끝났을 때(401) 화면 맨 바깥(AuthGate)이 로그인 화면으로 돌아가도록 알립니다. */
export const SESSION_EXPIRED_EVENT = "timotalk:session-expired";

const AI_UNAVAILABLE = msg("AI가 지금 답하지 못했어요. 잠시 후 다시 시도해 주세요.");
/**
 * 오류 코드별 문장. 서버 문장은 늘 한국어라 영어·일본어 화면에 그대로 띄울 수 없었고,
 * 몇몇은 내부 사정("Gemini API 키…")까지 드러냈습니다.
 */
const ERROR_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: msg("인터넷 연결을 확인해 주세요."),
  AUTH_REQUIRED: msg("다시 로그인해 주세요."),
  INVALID_SESSION: msg("다시 로그인해 주세요."),
  RATE_LIMITED: msg("요청이 너무 많아요. 잠시 후 다시 시도해 주세요."),
  VALIDATION_ERROR: msg("입력한 내용을 확인해 주세요."),
  PAYLOAD_TOO_LARGE: msg("파일이 너무 커요."),
  ACCOUNT_RESTRICTED: msg("사용이 제한된 계정이에요."),
  PARTNER_NOT_FOUND: msg("상대를 찾을 수 없어요."),
  PARTNER_BLOCKED: msg("차단된 상대와는 이 기능을 쓸 수 없어요."),
  CONVERSATION_BLOCKED: msg("차단된 상대와는 이 기능을 쓸 수 없어요."),
  CONVERSATION_NOT_FOUND: msg("대화를 찾을 수 없어요."),
  POST_NOT_FOUND: msg("글을 찾을 수 없어요."),
  DM_NOT_ALLOWED: msg("이 사람은 지금 메시지를 받지 않아요."),
  MESSAGE_REQUEST_PENDING: msg("상대가 메시지 요청을 수락하면 이어서 보낼 수 있어요."),
  AI_DAILY_LIMIT_REACHED: msg("오늘의 무료 AI 사용량을 모두 썼어요."),
  AI_SAFETY_BLOCKED: msg("이 내용은 AI가 처리할 수 없어요."),
  AI_NOT_CONFIGURED: msg("지금은 AI 기능을 쓸 수 없어요."),
  AI_PROVIDER_UNAVAILABLE: AI_UNAVAILABLE,
  AI_PROVIDER_RATE_LIMITED: AI_UNAVAILABLE,
  AI_PROVIDER_ERROR: AI_UNAVAILABLE,
  AI_MODEL_UNAVAILABLE: AI_UNAVAILABLE,
  AI_INVALID_RESPONSE: AI_UNAVAILABLE,
  AI_EMPTY_RESPONSE: AI_UNAVAILABLE,
  AI_INCOMPLETE_RESPONSE: msg("AI 응답이 완성되지 않았어요. 내용을 줄여 다시 시도해 주세요."),
};
/** 서버 문장에 내부 사정이 담기는 코드. 한국어 화면에서도 서버 문장 대신 위 문장을 씁니다. */
const INTERNAL_CODES = new Set(["AI_NOT_CONFIGURED", "INTERNAL_ERROR", "INVALID_USAGE_STATE", "INVALID_PROXY", "INVALID_ORIGIN", "AI_PROVIDER_ERROR"]);

/**
 * 화면에 띄울 오류 문장. 한국어 화면에서는 서버 문장이 더 자세하므로 그대로 씁니다
 * (내부 사정이 담긴 코드는 빼고). 다른 언어에서는 코드별 문장, 모르는 코드는 일반 문장입니다.
 */
export function apiErrorMessage(status: number, code: string, serverMessage?: string): string {
  if (currentLocaleSnapshot() === "ko" && serverMessage && !INTERNAL_CODES.has(code)) return serverMessage;
  const mapped = ERROR_MESSAGES[code] ?? (status === 429 ? ERROR_MESSAGES.RATE_LIMITED : undefined);
  return mapped ? tx(mapped) : t("요청을 처리하지 못했어요.");
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: "same-origin",
      ...init,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.headers || {}),
      },
    });
  } catch {
    // fetch 자체가 실패했습니다(오프라인 등). 브라우저 영어 문장("Failed to fetch") 대신 알립니다.
    throw new ApiError(0, "NETWORK_ERROR", apiErrorMessage(0, "NETWORK_ERROR"));
  }
  const body = (await response.json().catch(() => ({}))) as Envelope<T>;
  if (!response.ok) {
    const code = body.error?.code || "REQUEST_FAILED";
    if (response.status === 401 && !path.startsWith("/api/auth/") && typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(response.status, code, apiErrorMessage(response.status, code, body.error?.message));
  }
  return body.data;
}

/** 서버가 주는 사용자. 화면의 Partner 보다 항목이 적습니다. */
export interface ApiProfile {
  id: string;
  name: string;
  handle: string;
  country?: { code: string; name: string; flag: string };
  city?: string;
  nativeLanguages: string[];
  learningLanguages: Array<{ code: string; level: string; goal: string }>;
  bio: string;
  interests: string[];
  availability: string[];
  age: number;
  gender: string;
  status: string;
  verified?: boolean;
  exchangeScore?: number;
  /** 프로필 사진 주소(데이터 URI 도 됩니다). 비면 자리표시자를 그립니다. */
  avatarUrl?: string;
  /** Which profile representation is active. Older profiles omit this and remain photos. */
  avatarMode?: AvatarMode;
  avatarConfig?: AvatarConfig | null;
  roomConfig?: RoomConfig | null;
  /** 남에게 도시를 감출지. 본인 프로필에만 실려 옵니다. */
  hideLocation?: boolean;
  /**
   * 첫 설정을 마친 시각. 본인 프로필에만 실려 옵니다. null 이면 아직 첫 설정 전이라
   * 다른 사람의 추천·검색에 나오지 않습니다. 이 값이 없는 예전 계정은 마친 것으로 봅니다.
   */
  onboardedAt?: string | null;
}

export interface ApiPost {
  id: string;
  authorId: string;
  author: {
    id: string;
    name: string;
    handle: string;
    flag: string;
    avatarUrl?: string;
    avatarMode?: AvatarMode;
    avatarConfig?: AvatarConfig | null;
    countryCode?: string;
    /** 글쓴이의 나이·성별. */
    age?: number;
    gender?: string;
    /** 글쓴이가 가르칠 수 있는 말. */
    native?: string;
    /** 글쓴이가 배우는 말과 그 단계. */
    learning?: { code: string; level: string } | null;
  };
  text: string;
  language: string;
  targetLanguage: string;
  tags: string[];
  visibility: string;
  requestCorrection: boolean;
  imageUrl?: string;
  audioUrl?: string;
  likes: number;
  comments: number;
  corrections: number;
  liked?: boolean;
  saved?: boolean;
  createdAt: string;
}

export interface ApiMessage {
  id: string;
  conversationId: string;
  senderId: string;
  /** correction 은 새 앱이 보내는 교정 메시지입니다. text 가 고친 문장이라 이 화면은 글로 그립니다. */
  type: "text" | "voice" | "image" | "correction";
  text: string;
  media?: string;
  sentAt: string;
  status: string;
  readByPartner?: boolean;
}

export interface ApiCreateMessageResult {
  conversationId: string;
  message: ApiMessage;
}

export interface ApiConversation {
  id: string;
  partner: ApiProfile | null;
  preview: string;
  updatedAt: string;
  unreadCount: number;
  messages?: ApiMessage[];
  requestStatus?: string;
  isIncomingRequest?: boolean;
  spamSignals?: string[];
  muted?: boolean;
  /** 마지막 메시지를 보낸 사람. 상대가 마지막이면 내가 답할 차례입니다. */
  lastSenderId?: string | null;
  /** 상대가 마지막으로 읽은 메시지 시각. */
  partnerReadAt?: string | null;
}

export interface ApiRecommendation {
  partner: ApiProfile;
  score: number;
  matchReasons: string[];
  matchReasonCodes?: Array<{ code: string; languages?: string; interests?: string; flag?: string; country?: string }>;
  icebreaker: string;
  meetsAllPreferences: boolean;
}

/**
 * 낱말은 사전에 담아 두고(msg), 이어붙이기 전에 tx() 로 옮깁니다.
 * "한국어 · 영어" 처럼 이어붙인 문장은 사전에 통째로 담을 수 없어서,
 * 화면에 넘기기 전 여기서 옮겨야 합니다.
 */
const LANGUAGE_NAMES: Record<string, string> = {
  ko: msg("한국어"),
  en: msg("영어"),
  ja: msg("일본어"),
  zh: msg("중국어"),
  es: msg("스페인어"),
  fr: msg("프랑스어"),
  de: msg("독일어"),
  vi: msg("베트남어"),
  pt: msg("포르투갈어"),
  it: msg("이탈리아어"),
  th: msg("태국어"),
  id: msg("인도네시아어"),
  ru: msg("러시아어"),
};

/**
 * 활동 시간대. 서버는 "weekday-evening" 같은 코드를 주는데 화면은 사람이 읽을
 * 문장을 그립니다. 여기서 옮기지 않으면 프로필에 코드가 그대로 찍힙니다.
 */
const AVAILABILITY_NAMES: Record<string, string> = {
  "weekday-morning": msg("평일 아침"),
  "weekday-evening": msg("평일 저녁"),
  "weekend-morning": msg("주말 오전"),
  "weekend-evening": msg("주말 저녁"),
};

/* 서버의 다섯 단계(LEARNING_LEVELS)를 CEFR 표기로. 예전에는 세 단계만 있어서
   elementary·upper 를 고른 사람도 모두 A2 로 보였습니다. */
const LEVEL_NAMES: Record<string, string> = {
  beginner: "A1",
  elementary: "A2",
  intermediate: "B1",
  upper: "B2",
  advanced: "C1",
};

/** 관심사 코드를 지금 언어의 이름으로. 모르는 코드는 그대로 둡니다. */
const INTEREST_NAMES: Record<string, string> = {
  movies: msg("영화"), travel: msg("여행"), coffee: msg("카페"), music: msg("음악"),
  technology: msg("기술"), cooking: msg("요리"), books: msg("독서"), running: msg("운동"),
};

export function interestName(code: string): string {
  const key = INTEREST_NAMES[code];
  return key ? tx(key) : code;
}

export function languageName(code: string): string {
  return LANGUAGE_NAMES[code] || code.toLocaleUpperCase();
}

/**
 * 사람마다 늘 같은 색을 줍니다.
 * 서버는 색을 모르지만 화면은 아바타·카드에 색이 필요합니다. id 로 정하면
 * 새로고침해도, 다른 기기에서도 같은 사람은 같은 색으로 보입니다.
 */
const ACCENTS: Accent[] = ["violet", "coral", "mint", "amber", "blue", "rose"];
export function accentFor(id: string): Accent {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

/** "3분 전" 같은 표기. 화면이 문자열을 그대로 그리므로 여기서 만듭니다. */
export function relativeTime(value: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000));
  if (minutes < 1) return t("방금");
  if (minutes < 60) return t("{n}분 전", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("{n}시간 전", { n: hours });
  const days = Math.floor(hours / 24);
  return days === 1 ? t("어제") : t("{n}일 전", { n: days });
}

/** 말풍선 옆의 "오후 6:14". 화면이 localizeClock 으로 번역합니다. */
export function clockTime(value: string): string {
  const date = new Date(value);
  const hours = date.getHours();
  const meridiem = hours < 12 ? t("오전") : t("오후");
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${meridiem} ${hour12}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * 나라별 대표 시간대.
 *
 * 서버는 사람마다 시간대를 저장하지 않습니다. 나라를 알면 대부분은 맞고, 여러
 * 시간대를 쓰는 나라(미국·캐나다·호주·브라질)는 가장 사람이 많은 곳으로 잡습니다.
 * 정확한 값이 필요해지면 프로필에 시간대를 받아 여기를 대신하면 됩니다.
 */
const COUNTRY_ZONES: Record<string, string> = {
  KR: "Asia/Seoul",
  JP: "Asia/Tokyo",
  CN: "Asia/Shanghai",
  VN: "Asia/Ho_Chi_Minh",
  GB: "Europe/London",
  FR: "Europe/Paris",
  DE: "Europe/Berlin",
  ES: "Europe/Madrid",
  US: "America/New_York",
  CA: "America/Toronto",
  AU: "Australia/Sydney",
  BR: "America/Sao_Paulo",
};

/** 그 나라의 현지 시각을 알 수 있는지. 모르면 "현지 시각"을 감춰야 합니다(0 시차로 그리면 내 시각이 나옵니다). */
export function knowsLocalTime(countryCode?: string): boolean {
  return Boolean(COUNTRY_ZONES[(countryCode || "").toLocaleUpperCase()]);
}

/** 상대 지역이 나보다 몇 시간 앞/뒤인지. 모르면 0 입니다 — knowsLocalTime 으로 먼저 확인합니다. */
export function offsetHoursFor(countryCode?: string): number {
  const zone = COUNTRY_ZONES[(countryCode || "").toLocaleUpperCase()];
  if (!zone) return 0;
  try {
    const now = new Date();
    const there = new Date(now.toLocaleString("en-US", { timeZone: zone }));
    const here = new Date(now.toLocaleString("en-US"));
    return Math.round((there.getTime() - here.getTime()) / 3600000);
  } catch {
    return 0;
  }
}

/**
 * 추천 이유. 서버가 준 코드를 지금 언어로 그립니다.
 *
 * 서버는 사람이 읽는 문장(matchReasons)과 코드+값(matchReasonCodes)을 함께
 * 보냅니다. 문장은 늘 한국어라, 영어·일본어 화면에서 그것만 한국어로 남아
 * 있었습니다 — 웹도 앱도 코드를 안 쓰고 문장을 그대로 뿌리고 있었습니다.
 *
 * 모르는 코드가 오면 서버가 준 문장으로 되돌아갑니다. 새 코드가 생겨도
 * 빈칸이 뜨지 않습니다.
 */
export type MatchReasonCode = {
  code: string;
  /** 그 언어로 적힌 이름(English·日本語). 코드가 있으면 코드를 씁니다. */
  languages?: string;
  languageCodes?: string[];
  country?: string;
  countryCode?: string;
  flag?: string;
  interests?: string;
  interestCodes?: string[];
};

export function matchReasonText(reason: MatchReasonCode, fallback = ""): string {
  switch (reason.code) {
    case "native-speaker":
      // 코드가 있으면 지금 언어로 적습니다 — 없으면 서버가 준 이름 그대로.
      return t("{languages} 원어민 파트너예요", {
        languages: reason.languageCodes?.length
          // languageName 은 사전 키를 돌려줍니다 — tx 로 감싸야 지금 언어가 됩니다.
          ? reason.languageCodes.map((code) => tx(languageName(code))).join(" · ")
          : tx(reason.languages || ""),
      });
    case "preferred-country":
      return t("희망 지역인 {country}에 있어요", { country: tx(reason.country || "") });
    case "shared-interests":
      return t("{interests} 관심사가 같아요", {
        interests: reason.interestCodes?.length
          ? reason.interestCodes.map((code) => interestName(code)).join(" · ")
          : tx(reason.interests || ""),
      });
    case "level-in-range":
      return t("찾으시는 학습 단계예요");
    case "time-overlap":
      return t("선호하는 학습 시간대가 겹쳐요");
    case "first-exchange":
      return t("새로운 실제 회원과 첫 언어 교환을 시작해 보세요");
    case "broadened":
      return t("일부 조건을 넓혀 찾은 가까운 파트너예요");
    default:
      return tx(fallback);
  }
}

export function toPartner(profile: ApiProfile, score = 0): Partner {
  const learning = profile.learningLanguages?.[0];
  return {
    id: profile.id,
    name: profile.name,
    handle: profile.handle,
    flag: profile.country?.flag || "🌐",
    city: profile.city || "",
    country: profile.country?.name || "",
    timeOffset: offsetHoursFor(profile.country?.code),
    native: (profile.nativeLanguages?.length ? profile.nativeLanguages : ["ko"])
      .map((code) => tx(languageName(code)))
      .join(" · "),
    learning: tx(languageName(learning?.code || "en")),
    level: LEVEL_NAMES[learning?.level || "beginner"] || "A1",
    interests: profile.interests || [],
    bio: profile.bio || "",
    online: profile.status === "online",
    compatibility: score,
    accent: accentFor(profile.id),
    photo: profile.avatarUrl || "",
    roomConfig: profile.roomConfig ? normalizeRoom(profile.roomConfig) : undefined,
    avatarMode: normalizeAvatarMode(profile.avatarMode),
    avatarConfig: profile.avatarConfig ? normalizeAvatarConfig(profile.avatarConfig) : undefined,
    countryCode: profile.country?.code || "",
    age: profile.age || 0,
    gender: profile.gender || "",
    nativeCode: profile.nativeLanguages?.[0] || "",
    learningCode: learning?.code || "",
    learningLevel: learning?.level || "",
    goal: learning?.goal || "",
    activeTime: (profile.availability || [])
      .map((code) => AVAILABILITY_NAMES[code])
      .filter(Boolean)
      .map((name) => tx(name))
      .join(" · "),
    // 서버는 "도움 4h 20m · 배움 4h 05m" 같은 교환 기록을 아직 남기지 않습니다.
    // 지어내지 않고 비워두면 화면이 그 줄을 감춥니다.
    balance: "",
    verified: Boolean(profile.verified),
  };
}

export function toFeedPost(post: ApiPost): FeedPost {
  return {
    id: post.id,
    authorId: post.authorId,
    author: post.author.name,
    handle: post.author.handle,
    flag: post.author.flag || "🌐",
    accent: accentFor(post.authorId),
    photo: post.author.avatarUrl || "",
    avatarMode: normalizeAvatarMode(post.author.avatarMode),
    avatarConfig: post.author.avatarConfig ? normalizeAvatarConfig(post.author.avatarConfig) : undefined,
    countryCode: post.author.countryCode || "",
    age: post.author.age || 0,
    gender: post.author.gender || "",
    nativeCode: post.author.native || "",
    learningCode: post.author.learning?.code || "",
    learningLevel: post.author.learning?.level || "",
    image: post.imageUrl || "",
    audio: post.audioUrl || "",
    time: relativeTime(post.createdAt),
    language: languageName(post.language),
    level: "",
    text: post.text,
    // 번역은 AI 를 불러야 나옵니다. 여기서 비워두면 화면의 "번역" 버튼이
    // 눌렸을 때 채웁니다.
    translation: "",
    tags: post.tags || [],
    likes: post.likes,
    comments: post.comments,
    corrections: post.corrections,
    liked: post.liked,
    saved: post.saved,
    visibility: post.visibility === "partners" ? "partners" : "public",
    requestCorrection: post.requestCorrection,
  };
}

export function toChatMessage(message: ApiMessage, myId: string): ChatMessage {
  return {
    id: message.id,
    mine: message.senderId === myId,
    text: message.text,
    time: clockTime(message.sentAt),
    sentAt: message.sentAt,
    readByPartner: message.readByPartner,
    media: message.media || "",
    // 첨부 말풍선은 사진·음성뿐입니다. 그 밖의 형식(교정 등)은 빈 첨부 말풍선이 되지 않게 글로 그립니다.
    kind: message.type === "image" || message.type === "voice" ? message.type : undefined,
  };
}

export function toConversation(conversation: ApiConversation, messages: ChatMessage[] = []): Conversation {
  const partner = conversation.partner;
  return {
    id: conversation.id,
    partnerId: partner?.id,
    name: partner?.name || t("알 수 없는 상대"),
    flag: partner?.country?.flag || "🌐",
    photo: partner?.avatarUrl || "",
    avatarMode: normalizeAvatarMode(partner?.avatarMode),
    avatarConfig: partner?.avatarConfig ? normalizeAvatarConfig(partner.avatarConfig) : undefined,
    countryCode: partner?.country?.code || "",
    timeOffset: offsetHoursFor(partner?.country?.code),
    accent: accentFor(partner?.id || conversation.id),
    preview: conversation.preview,
    time: relativeTime(conversation.updatedAt),
    unread: conversation.unreadCount || 0,
    // "내 차례" 탭. 예전에는 이 값을 채우지 않아 탭이 늘 비어 있었습니다.
    myTurn: Boolean(partner?.id) && conversation.lastSenderId === partner?.id,
    partnerReadAt: conversation.partnerReadAt || undefined,
    muted: Boolean(conversation.muted),
    online: partner?.status === "online",
    messages,
  };
}

export interface ApiReply {
  id: string;
  postId: string;
  authorId: string;
  text: string;
  kind: "reply" | "correction";
  original: string;
  parentId: string;
  likes: number;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    handle: string | null;
    flag: string;
    avatarUrl?: string;
    avatarMode?: AvatarMode;
    avatarConfig?: AvatarConfig | null;
    countryCode?: string;
  };
}

export interface ApiReceivedLike {
  partner: ApiProfile;
  createdAt: string;
  mutual: boolean;
}

export type ApiNotificationType =
  | "home_entry" | "home_reply" | "home_visit" | "home_heart"
  | "post_like"
  | "post_reply"
  | "post_correction"
  | "comment_reply"
  | "partner_like"
  | "follow"
  | "message_request"
  | "request_accepted"
  /** 이미 열린 대화의 새 메시지. 대화당 한 줄로 모입니다. */
  | "message";

export interface ApiNotification {
  homeOwnerId?:string;
  id: string;
  type: ApiNotificationType;
  actorId: string;
  actor: ApiProfile | null;
  postId: string;
  replyId: string;
  conversationId: string;
  eventId?: string;
  excerpt: string;
  createdAt: string;
  readAt: string | null;
}

export interface ApiNotificationPage {
  items: ApiNotification[];
  unreadCount: number;
}

export interface ApiCorrection {
  id: string;
  postId: string;
  postText: string;
  original: string;
  fixed: string;
  createdAt: string;
  from: string | null;
  fromFlag: string;
  fromAvatarUrl?: string;
  fromAvatarMode?: AvatarMode;
  fromAvatarConfig?: AvatarConfig | null;
  fromCountryCode?: string;
}

export interface ApiSavedPhrase {
  id: string;
  phrase: string;
  meaning: string;
  source: string;
  due: string;
  createdAt: string;
}

/** 서버 댓글을 화면의 답글 모양으로. 교정은 원문을 함께 든 답글입니다. */
export function toPostReply(reply: ApiReply): PostReply {
  return {
    id: reply.id,
    author: reply.author?.name ?? t("알 수 없는 상대"),
    handle: reply.author?.handle ?? "",
    flag: reply.author?.flag || "🌐",
    accent: accentFor(reply.authorId),
    photo: reply.author?.avatarUrl || "",
    avatarMode: normalizeAvatarMode(reply.author?.avatarMode),
    avatarConfig: reply.author?.avatarConfig ? normalizeAvatarConfig(reply.author.avatarConfig) : undefined,
    countryCode: reply.author?.countryCode || "",
    time: relativeTime(reply.createdAt),
    text: reply.text,
    likes: reply.likes,
    kind: reply.kind,
    original: reply.original || undefined,
    parentId: reply.parentId || undefined,
  };
}

export function toSavedPhrase(item: ApiSavedPhrase): SavedPhrase {
  return {
    id: item.id,
    phrase: item.phrase,
    meaning: item.meaning,
    source: item.source,
    // 서버는 복습 주기를 아직 계산하지 않습니다. 비워두면 화면이 그 줄을 감춥니다.
    due: item.due,
  };
}
