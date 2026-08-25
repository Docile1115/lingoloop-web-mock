import { msg, t, tx } from "./i18n";
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

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as Envelope<T>;
  if (!response.ok) {
    throw new ApiError(response.status, body.error?.code || "REQUEST_FAILED", body.error?.message || msg("요청을 처리하지 못했어요."));
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
  /** 남에게 도시를 감출지. 본인 프로필에만 실려 옵니다. */
  hideLocation?: boolean;
}

export interface ApiPost {
  id: string;
  authorId: string;
  author: { id: string; name: string; handle: string; flag: string; avatarUrl?: string; countryCode?: string };
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
  type: "text" | "voice" | "image";
  text: string;
  media?: string;
  sentAt: string;
  status: string;
  readByPartner?: boolean;
}

export interface ApiConversation {
  id: string;
  partner: ApiProfile | null;
  preview: string;
  updatedAt: string;
  unreadCount: number;
  requestStatus?: string;
  isIncomingRequest?: boolean;
  spamSignals?: string[];
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

const LEVEL_NAMES: Record<string, string> = {
  beginner: "A2",
  intermediate: "B1",
  advanced: "C1",
};

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

export function toPartner(profile: ApiProfile, score = 0): Partner {
  const learning = profile.learningLanguages?.[0];
  return {
    id: profile.id,
    name: profile.name,
    handle: profile.handle,
    flag: profile.country?.flag || "🌐",
    city: profile.city || "",
    country: profile.country?.name || "",
    // 서버는 상대의 시간대를 주지 않습니다. 시차를 지어내면 틀린 시각을 보여주게
    // 되므로 0 으로 두고, 화면은 시차가 0 이면 현지 시각을 감춥니다.
    timeOffset: 0,
    native: (profile.nativeLanguages?.length ? profile.nativeLanguages : ["ko"])
      .map((code) => tx(languageName(code)))
      .join(" · "),
    learning: tx(languageName(learning?.code || "en")),
    level: LEVEL_NAMES[learning?.level || "beginner"] || "A2",
    interests: profile.interests || [],
    bio: profile.bio || "",
    online: profile.status === "online",
    compatibility: score,
    accent: accentFor(profile.id),
    photo: profile.avatarUrl || "",
    countryCode: profile.country?.code || "",
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
    countryCode: post.author.countryCode || "",
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
    readByPartner: message.readByPartner,
    media: message.media || "",
    kind: message.type === "text" ? undefined : message.type,
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
    countryCode: partner?.country?.code || "",
    accent: accentFor(partner?.id || conversation.id),
    preview: conversation.preview,
    time: relativeTime(conversation.updatedAt),
    unread: conversation.unreadCount || 0,
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
  author: { id: string; name: string | null; handle: string | null; flag: string; avatarUrl?: string; countryCode?: string };
}

export interface ApiReceivedLike {
  partner: ApiProfile;
  createdAt: string;
  mutual: boolean;
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
    countryCode: reply.author?.countryCode || "",
    time: relativeTime(reply.createdAt),
    text: reply.text,
    likes: reply.likes,
    kind: reply.kind,
    original: reply.original || undefined,
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
