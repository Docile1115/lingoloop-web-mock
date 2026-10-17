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

export type MessageType = "text" | "voice" | "image" | "correction";

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  /** 교정 메시지에서는 고친 문장입니다. */
  text: string;
  media?: string;
  sentAt: string;
  status?: string;
  /** 교정 메시지만: 고치기 전 문장(서버가 대상 메시지에서 복사), 대상 메시지 id, 한 줄 설명 */
  original?: string;
  targetMessageId?: string;
  note?: string;
};

/** 받은 교정 한 건(GET /api/corrections/received). 대화에서 받은 것(chat)과 커뮤니티 글에서 받은 것(community)이 섞여 옵니다. */
export type ReceivedCorrection = {
  id: string;
  source?: "chat" | "community";
  conversationId?: string;
  messageId?: string;
  postId?: string;
  postText?: string;
  original: string;
  fixed: string;
  note?: string;
  createdAt: string;
  fromUserId?: string;
  from: string | null;
  fromAvatarUrl?: string;
  fromAvatarMode?: Profile["avatarMode"];
  fromAvatarConfig?: Profile["avatarConfig"];
  fromCountryCode?: string;
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

/** 커뮤니티 글의 작성자 카드(서버 postAuthorView). 글에 굳히지 않고 지금 프로필로 채워 옵니다. */
export type PostAuthor = {
  id: string;
  name: string | null;
  handle?: string | null;
  avatarUrl?: string;
  avatarMode?: Profile["avatarMode"];
  avatarConfig?: Profile["avatarConfig"];
  countryCode?: string;
  /** 가르칠 수 있는 말 */
  native?: string;
  /** 배우는 말과 단계 */
  learning?: { code: string; level: string } | null;
};

/** 커뮤니티 글(GET /api/posts · /api/posts/:id) */
export type Post = {
  id: string;
  authorId: string;
  author: PostAuthor;
  text: string;
  /** 글을 쓴 말 */
  language: string;
  tags: string[];
  visibility: "public" | "partners" | string;
  requestCorrection: boolean;
  imageUrl?: string;
  audioUrl?: string;
  likes: number;
  comments: number;
  corrections: number;
  liked?: boolean;
  createdAt: string;
};

/** 댓글·교정(GET /api/posts/:id/replies). 교정은 고친 문장(text)과 고치기 전 문장(original)을 함께 듭니다. */
export type PostReply = {
  id: string;
  postId: string;
  authorId: string;
  text: string;
  kind: "reply" | "correction";
  original: string;
  parentId: string;
  createdAt: string;
  author: PostAuthor;
};
