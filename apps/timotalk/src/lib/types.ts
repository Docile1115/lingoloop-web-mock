/**
 * 서버(backend/server.mjs) 응답 모양. 서버가 실제로 보내는 필드만 적습니다.
 * 화면에서 쓰기 좋게 바꾸는 일은 각 기능 폴더에서 합니다.
 */
import type { AvatarConfig, AvatarMode } from "@shared/avatar";

export type LearningLanguage = { code: string; level: string; goal: string };

export type Profile = {
  id: string;
  name: string;
  handle: string;
  country?: { code: string; name: string; flag: string };
  city?: string;
  nativeLanguages: string[];
  learningLanguages: LearningLanguage[];
  bio?: string;
  interests?: string[];
  availability?: string[];
  age?: number;
  gender?: string;
  /** 서버가 lastActiveAt 으로 정합니다. */
  status?: "online" | "offline" | string;
  verified?: boolean;
  avatarUrl?: string;
  avatarMode?: AvatarMode;
  avatarConfig?: AvatarConfig | null;
  /** 본인 프로필에만 있습니다. null 이면 첫 설정 전입니다. */
  onboardedAt?: string | null;
};

export type MatchReasonCode = {
  code: string;
  languages?: string;
  languageCodes?: string[];
  country?: string;
  countryCode?: string;
  flag?: string;
  interests?: string;
  interestCodes?: string[];
};

export type Recommendation = {
  partner: Profile;
  score: number;
  matchReasons: string[];
  matchReasonCodes?: MatchReasonCode[];
  icebreaker: string;
  meetsAllPreferences: boolean;
};

export type DailyMatches = {
  date: string;
  recommendations: Recommendation[];
  /** 이번 추천에 쓴 조건. 오늘 화면 머리말에 "무슨 말을 알려 줄 사람"인지 적을 때 씁니다. */
  preferencesApplied?: { targetLanguages?: string[] };
  nextRefreshAt?: string;
};

export type Conversation = {
  id: string;
  partner: Profile | null;
  preview: string;
  updatedAt: string;
  lastSenderId?: string | null;
  partnerReadAt?: string | null;
  unreadCount: number;
  requestStatus?: "pending" | "accepted" | string;
  isIncomingRequest?: boolean;
  muted?: boolean;
  /** 요청함 첫 메시지의 스팸 신호(off-platform·money·link·contact) */
  spamSignals?: string[];
};

export type MessageType = "text" | "voice" | "image";

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  text: string;
  media?: string;
  sentAt: string;
  status?: string;
};

/** AI 가 고른 문장 한 줄. text 는 연습하는 말, translation 은 내 말입니다. */
export type SupportLine = { text: string; translation: string };

export type ConversationSupport = {
  topics: string[];
  /** 서버가 새로 주는 형태. 예전 서버에는 없을 수 있습니다. */
  openers?: SupportLine[];
  followUps?: SupportLine[];
  suggestedOpeners: string[];
  followUpQuestions: string[];
  improvedDraft: string;
  tip: string;
};

export type Translation = {
  sourceText: string;
  targetLanguage: string;
  translatedText: string;
};

export type SavedPhrase = {
  id: string;
  phrase: string;
  meaning: string;
  source: string;
  createdAt: string;
};
