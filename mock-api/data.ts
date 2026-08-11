export type Presence = "online" | "recently" | "offline";
export type LanguageLevel = "beginner" | "elementary" | "intermediate" | "advanced" | "native";

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export interface LearningLanguage {
  code: string;
  level: LanguageLevel;
  goal: string;
}

export interface UserProfile {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  avatarColor: string;
  country: { code: string; name: string; flag: string };
  timezone: string;
  nativeLanguages: string[];
  learningLanguages: LearningLanguage[];
  bio: string;
  interests: string[];
  status: Presence;
  lastActive: string;
  verified: boolean;
  exchangeScore: number;
  responseRate: number;
  correctionsGiven: number;
}

export interface FeedPost {
  id: string;
  author: Pick<UserProfile, "id" | "name" | "handle" | "avatar" | "avatarColor" | "country">;
  text: string;
  language: string;
  targetLanguage?: string;
  createdAt: string;
  visibility: "everyone" | "partners";
  tags: string[];
  media?: { type: "image" | "audio"; url: string; alt?: string; durationSeconds?: number }[];
  translation?: { language: string; text: string };
  correctionCount: number;
  commentCount: number;
  likeCount: number;
  liked: boolean;
  bookmarked: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  type: "text" | "voice" | "system";
  text: string;
  sentAt: string;
  status: "sent" | "delivered" | "read";
  translation?: { language: string; text: string };
  correction?: { original: string; corrected: string; note: string };
  durationSeconds?: number;
}

export interface Conversation {
  id: string;
  partner: Pick<UserProfile, "id" | "name" | "handle" | "avatar" | "avatarColor" | "status">;
  languagePair: { from: string; to: string };
  unreadCount: number;
  pinned: boolean;
  muted: boolean;
  lastMessageAt: string;
  messages: ChatMessage[];
}

export interface Correction {
  id: string;
  sourceType: "post" | "message";
  sourceId: string;
  author: Pick<UserProfile, "id" | "name" | "avatar" | "avatarColor">;
  original: string;
  corrected: string;
  explanation: string;
  createdAt: string;
  helpfulCount: number;
  markedHelpful: boolean;
}

export interface VoiceRoom {
  id: string;
  title: string;
  topic: string;
  host: Pick<UserProfile, "id" | "name" | "avatar" | "avatarColor">;
  languages: string[];
  participantCount: number;
  capacity: number;
  status: "live" | "scheduled";
  startsAt: string;
}

export const languages: Language[] = [
  { code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷" },
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "zh", name: "Chinese", nativeName: "中文", flag: "🇨🇳" },
];

export const currentUser: UserProfile = {
  id: "user-me",
  name: "민준",
  handle: "@minjun.learns",
  avatar: "MJ",
  avatarColor: "#6657E8",
  country: { code: "KR", name: "South Korea", flag: "🇰🇷" },
  timezone: "Asia/Seoul",
  nativeLanguages: ["ko"],
  learningLanguages: [
    { code: "en", level: "intermediate", goal: "자연스러운 일상 대화" },
    { code: "ja", level: "beginner", goal: "여행 회화" },
  ],
  bio: "서울에서 제품을 만드는 디자이너예요. 커피와 러닝 이야기를 좋아해요.",
  interests: ["product design", "coffee", "running", "travel"],
  status: "online",
  lastActive: "2026-08-11T13:22:00.000Z",
  verified: true,
  exchangeScore: 92,
  responseRate: 96,
  correctionsGiven: 148,
};

export const partners: UserProfile[] = [
  {
    id: "user-maya",
    name: "Maya",
    handle: "@maya.speaks",
    avatar: "MA",
    avatarColor: "#F06A6A",
    country: { code: "US", name: "United States", flag: "🇺🇸" },
    timezone: "America/Los_Angeles",
    nativeLanguages: ["en"],
    learningLanguages: [{ code: "ko", level: "intermediate", goal: "한국 친구들과 자연스럽게 대화하기" }],
    bio: "UX researcher, weekend hiker, and enthusiastic 떡볶이 student.",
    interests: ["hiking", "design", "food", "movies"],
    status: "online",
    lastActive: "2026-08-11T13:20:00.000Z",
    verified: true,
    exchangeScore: 97,
    responseRate: 98,
    correctionsGiven: 326,
  },
  {
    id: "user-ren",
    name: "Ren",
    handle: "@ren.tokyo",
    avatar: "RN",
    avatarColor: "#2DAA8A",
    country: { code: "JP", name: "Japan", flag: "🇯🇵" },
    timezone: "Asia/Tokyo",
    nativeLanguages: ["ja"],
    learningLanguages: [{ code: "ko", level: "elementary", goal: "드라마를 자막 없이 보기" }],
    bio: "도쿄의 사진가입니다. 천천히 이야기해도 괜찮아요!",
    interests: ["photography", "music", "city walks", "baseball"],
    status: "recently",
    lastActive: "2026-08-11T12:54:00.000Z",
    verified: true,
    exchangeScore: 91,
    responseRate: 93,
    correctionsGiven: 204,
  },
  {
    id: "user-sofia",
    name: "Sofía",
    handle: "@sofia.travels",
    avatar: "SF",
    avatarColor: "#EE9B45",
    country: { code: "ES", name: "Spain", flag: "🇪🇸" },
    timezone: "Europe/Madrid",
    nativeLanguages: ["es"],
    learningLanguages: [
      { code: "en", level: "advanced", goal: "업무 프레젠테이션" },
      { code: "ko", level: "beginner", goal: "한국 여행 준비" },
    ],
    bio: "Arquitecta de Madrid. I swap Spanish practice for Korean travel tips.",
    interests: ["architecture", "travel", "books", "cooking"],
    status: "online",
    lastActive: "2026-08-11T13:18:00.000Z",
    verified: false,
    exchangeScore: 88,
    responseRate: 89,
    correctionsGiven: 119,
  },
  {
    id: "user-noah",
    name: "Noah",
    handle: "@noah.codes",
    avatar: "NO",
    avatarColor: "#3E86DB",
    country: { code: "CA", name: "Canada", flag: "🇨🇦" },
    timezone: "America/Toronto",
    nativeLanguages: ["en", "fr"],
    learningLanguages: [{ code: "ko", level: "beginner", goal: "동료와 간단히 대화하기" }],
    bio: "Developer in Toronto. Happy to talk about tech, games, or Montréal food.",
    interests: ["technology", "games", "cycling", "food"],
    status: "offline",
    lastActive: "2026-08-10T23:14:00.000Z",
    verified: true,
    exchangeScore: 94,
    responseRate: 91,
    correctionsGiven: 271,
  },
  {
    id: "user-lina",
    name: "Lina",
    handle: "@lina.berlin",
    avatar: "LI",
    avatarColor: "#A65DC9",
    country: { code: "DE", name: "Germany", flag: "🇩🇪" },
    timezone: "Europe/Berlin",
    nativeLanguages: ["de"],
    learningLanguages: [{ code: "ko", level: "intermediate", goal: "교환학생 생활 준비" }],
    bio: "Graduate student, amateur baker, language notebook collector.",
    interests: ["baking", "art", "languages", "indie music"],
    status: "recently",
    lastActive: "2026-08-11T11:45:00.000Z",
    verified: false,
    exchangeScore: 86,
    responseRate: 87,
    correctionsGiven: 95,
  },
];

const maya = partners[0];
const ren = partners[1];
const sofia = partners[2];
const noah = partners[3];

export const posts: FeedPost[] = [
  {
    id: "post-101",
    author: maya,
    text: "오늘은 ‘눈치’라는 단어를 배웠어요. 영어로 딱 맞는 표현이 없는 것 같은데, 이런 상황에서 쓰는 게 맞나요? 회의가 끝날 눈치라서 노트북을 닫았어요.",
    language: "ko",
    targetLanguage: "ko",
    createdAt: "2026-08-11T12:48:00.000Z",
    visibility: "everyone",
    tags: ["오늘의표현", "한국어질문"],
    translation: { language: "en", text: "Today I learned the word ‘nunchi’. Is this the right situation to use it?" },
    correctionCount: 4,
    commentCount: 12,
    likeCount: 48,
    liked: true,
    bookmarked: false,
  },
  {
    id: "post-102",
    author: ren,
    text: "ソウルで撮った朝の光。『朝早く散歩すると、街の違う顔が見える』を韓国語で自然に言いたいです。",
    language: "ja",
    targetLanguage: "ko",
    createdAt: "2026-08-11T10:35:00.000Z",
    visibility: "everyone",
    tags: ["사진", "서울", "문장교정"],
    media: [{ type: "image", url: "/feed/seoul-morning.svg", alt: "서울 골목의 아침 풍경" }],
    translation: { language: "ko", text: "서울에서 찍은 아침 햇살. ‘아침 일찍 산책하면 도시의 다른 얼굴이 보인다’를 자연스럽게 말하고 싶어요." },
    correctionCount: 7,
    commentCount: 9,
    likeCount: 73,
    liked: false,
    bookmarked: true,
  },
  {
    id: "post-103",
    author: sofia,
    text: "Small win: I ordered an entire lunch in Korean today! The server understood me on the first try 🎉",
    language: "en",
    targetLanguage: "ko",
    createdAt: "2026-08-11T08:12:00.000Z",
    visibility: "partners",
    tags: ["smallwins", "speaking"],
    translation: { language: "ko", text: "작은 성취: 오늘 점심 주문을 전부 한국어로 했어요! 직원분이 한 번에 알아들었어요." },
    correctionCount: 0,
    commentCount: 18,
    likeCount: 106,
    liked: false,
    bookmarked: false,
  },
  {
    id: "post-104",
    author: noah,
    text: "What's a Korean phrase you use every day but textbooks rarely teach? I'll start: 수고하셨습니다.",
    language: "en",
    targetLanguage: "ko",
    createdAt: "2026-08-10T22:40:00.000Z",
    visibility: "everyone",
    tags: ["question", "realkorean"],
    correctionCount: 1,
    commentCount: 31,
    likeCount: 89,
    liked: true,
    bookmarked: true,
  },
];

export const conversations: Conversation[] = [
  {
    id: "conversation-maya",
    partner: maya,
    languagePair: { from: "ko", to: "en" },
    unreadCount: 2,
    pinned: true,
    muted: false,
    lastMessageAt: "2026-08-11T13:19:00.000Z",
    messages: [
      { id: "msg-1001", senderId: "user-me", type: "text", text: "How did your presentation go?", sentAt: "2026-08-11T13:10:00.000Z", status: "read" },
      { id: "msg-1002", senderId: "user-maya", type: "text", text: "It went better than I expected! 긴장했지만 재미있었어요.", sentAt: "2026-08-11T13:17:00.000Z", status: "read", translation: { language: "en", text: "I was nervous, but it was fun." } },
      { id: "msg-1003", senderId: "user-maya", type: "text", text: "Is 긴장했는데 더 natural here?", sentAt: "2026-08-11T13:19:00.000Z", status: "delivered" },
    ],
  },
  {
    id: "conversation-ren",
    partner: ren,
    languagePair: { from: "ko", to: "ja" },
    unreadCount: 0,
    pinned: false,
    muted: false,
    lastMessageAt: "2026-08-11T09:02:00.000Z",
    messages: [
      { id: "msg-2001", senderId: "user-ren", type: "voice", text: "오늘도 좋은 하루 보내세요.", sentAt: "2026-08-11T08:56:00.000Z", status: "read", durationSeconds: 7 },
      { id: "msg-2002", senderId: "user-me", type: "text", text: "ありがとう！発音がとても自然ですね。", sentAt: "2026-08-11T09:02:00.000Z", status: "read" },
    ],
  },
  {
    id: "conversation-sofia",
    partner: sofia,
    languagePair: { from: "ko", to: "es" },
    unreadCount: 1,
    pinned: false,
    muted: false,
    lastMessageAt: "2026-08-10T20:41:00.000Z",
    messages: [
      { id: "msg-3001", senderId: "user-me", type: "text", text: "스페인에서는 저녁을 정말 9시 이후에 먹어요?", sentAt: "2026-08-10T20:30:00.000Z", status: "read" },
      { id: "msg-3002", senderId: "user-sofia", type: "text", text: "Sí, especialmente en verano. We start late!", sentAt: "2026-08-10T20:41:00.000Z", status: "delivered", translation: { language: "ko", text: "네, 특히 여름에는요. 늦게 시작해요!" } },
    ],
  },
];

export const corrections: Correction[] = [
  {
    id: "correction-201",
    sourceType: "message",
    sourceId: "msg-1002",
    author: { id: "user-me", name: "민준", avatar: "MJ", avatarColor: "#6657E8" },
    original: "긴장했지만 재미있었어요.",
    corrected: "긴장했지만 즐거웠어요.",
    explanation: "발표 경험에는 ‘재미있다’보다 ‘즐겁다’가 조금 더 자연스러워요. 원문도 문법적으로는 맞습니다.",
    createdAt: "2026-08-11T13:20:00.000Z",
    helpfulCount: 3,
    markedHelpful: true,
  },
  {
    id: "correction-202",
    sourceType: "post",
    sourceId: "post-101",
    author: { id: "user-ren", name: "Ren", avatar: "RN", avatarColor: "#2DAA8A" },
    original: "회의가 끝날 눈치라서 노트북을 닫았어요.",
    corrected: "회의가 끝날 눈치여서 노트북을 닫았어요.",
    explanation: "명사 ‘눈치’ 뒤에서는 ‘-라서’도 가능하지만 이 문맥에서는 ‘-여서’가 부드럽습니다.",
    createdAt: "2026-08-11T12:56:00.000Z",
    helpfulCount: 6,
    markedHelpful: false,
  },
];

export const voiceRooms: VoiceRoom[] = [
  {
    id: "room-301",
    title: "퇴근 후 15분 English",
    topic: "오늘 하루 한 문장씩 말하기",
    host: { id: maya.id, name: maya.name, avatar: maya.avatar, avatarColor: maya.avatarColor },
    languages: ["ko", "en"],
    participantCount: 8,
    capacity: 12,
    status: "live",
    startsAt: "2026-08-11T13:00:00.000Z",
  },
  {
    id: "room-302",
    title: "はじめての日本語 카페",
    topic: "여행에서 바로 쓰는 표현",
    host: { id: ren.id, name: ren.name, avatar: ren.avatar, avatarColor: ren.avatarColor },
    languages: ["ja", "ko"],
    participantCount: 0,
    capacity: 16,
    status: "scheduled",
    startsAt: "2026-08-11T15:00:00.000Z",
  },
];

export const notifications = [
  { id: "notification-1", type: "correction", title: "Maya가 교정을 남겼어요", body: "‘I look forward to meet you’를 확인해 보세요.", read: false, createdAt: "2026-08-11T12:20:00.000Z" },
  { id: "notification-2", type: "partner", title: "새 파트너 추천", body: "학습 시간대와 관심사가 비슷한 파트너 4명을 찾았어요.", read: false, createdAt: "2026-08-11T09:05:00.000Z" },
  { id: "notification-3", type: "streak", title: "7일 연속 학습 중", body: "오늘 5분만 더 연습하면 기록을 이어갈 수 있어요.", read: true, createdAt: "2026-08-10T23:00:00.000Z" },
] as const;

export const bootstrap = {
  currentUser,
  languages,
  learning: {
    streakDays: 7,
    weeklyMinutes: 84,
    weeklyGoalMinutes: 120,
    wordsSaved: 236,
    correctionsReceived: 42,
    exchangeBalance: { givenMinutes: 48, receivedMinutes: 44 },
  },
  trendingTopics: ["#오늘의표현", "#여행한국어", "#smallwins", "#발음연습"],
  unread: {
    messages: conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0),
    notifications: notifications.filter((notification) => !notification.read).length,
  },
  featureFlags: {
    voiceRooms: true,
    instantTranslation: true,
    inlineCorrections: true,
    videoCalls: false,
  },
};
