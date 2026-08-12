export type Presence = "online" | "recently" | "offline";
export type LanguageLevel = "beginner" | "elementary" | "intermediate" | "advanced" | "native";
export type GenderIdentity = "woman" | "man" | "nonbinary";
export type ConnectionGoal = "friendship" | "language-exchange" | "voice-practice" | "culture";
export type PartnerGenderPreference = "any" | "same" | "women" | "men";

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
  age: number;
  gender: GenderIdentity;
  intents: ConnectionGoal[];
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

export type AvailabilitySlot =
  | "weekday-morning"
  | "weekday-evening"
  | "weekend-morning"
  | "weekend-evening";

export type PreferredPartnerLevel = "any" | "beginner" | "intermediate" | "advanced";

export interface MatchingPreferences {
  targetLanguages: string[];
  preferredCountries: string[];
  interests: string[];
  availability: AvailabilitySlot[];
  partnerLevel: PreferredPartnerLevel;
  onlineOnly: boolean;
  partnerGender: PartnerGenderPreference;
  ageMin: number;
  ageMax: number;
  verifiedOnly: boolean;
  intents: ConnectionGoal[];
}

export interface PartnerMatchingSignal {
  partnerId: string;
  availability: AvailabilitySlot[];
  learningStyle: "casual-chat" | "structured" | "voice-first" | "correction-focused";
  icebreakers: string[];
}

export interface ConversationGuide {
  partnerId: string;
  topics: string[];
  suggestedOpeners: string[];
  followUpQuestions: string[];
  tip: string;
}

export type DmPermission = "matches" | "mutual-follows" | "followers" | "everyone";

export interface DmPrivacySettings {
  whoCanMessage: DmPermission;
  routeOthersToRequests: boolean;
  filterSuspectedSpam: boolean;
  allowVoiceMessagesInRequests: boolean;
  readReceipts: boolean;
}

export interface DmRequest {
  id: string;
  sender: Pick<UserProfile, "id" | "name" | "handle" | "avatar" | "avatarColor" | "verified">;
  preview: string;
  receivedAt: string;
  status: "pending" | "accepted" | "declined" | "blocked";
  relationship: "matched" | "follower" | "not-connected";
  risk: { level: "low" | "medium" | "high"; signals: string[] };
}

export type SafetyReportStatus = "received" | "triaging" | "action-taken" | "closed";

export interface SafetyReport {
  id: string;
  reporterId: string;
  targetType: "user" | "post" | "message" | "room";
  targetId: string;
  reason: "spam" | "scam" | "harassment" | "dating" | "sexual_content" | "hate" | "impersonation" | "other";
  details: string;
  status: SafetyReportStatus;
  submittedAt: string;
  updatedAt: string;
  nextUpdateBy: string;
  reporterAccountStatus: "active";
  statusHistory: { status: SafetyReportStatus; at: string; note: string }[];
}

export interface AccountVerification {
  userId: string;
  accountStatus: "pending-verification" | "active" | "restricted";
  assuranceLevel: "none" | "email" | "phone" | "identity";
  activationEligible: boolean;
  requiredForActivation: Array<"email" | "phone">;
  steps: Array<{
    type: "email" | "phone" | "identity";
    status: "not-started" | "pending" | "verified";
    required: boolean;
    verifiedAt?: string;
    maskedDestination?: string;
  }>;
  reSignupProtection: {
    enabled: boolean;
    identifier: "verified-phone-hash";
    note: string;
  };
  updatedAt: string;
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
  age: 29,
  gender: "man",
  intents: ["language-exchange", "friendship", "voice-practice"],
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
    age: 28,
    gender: "woman",
    intents: ["language-exchange", "friendship"],
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
    age: 27,
    gender: "man",
    intents: ["language-exchange", "friendship", "voice-practice"],
    nativeLanguages: ["ja"],
    learningLanguages: [{ code: "ko", level: "elementary", goal: "드라마를 자막 없이 보기" }],
    bio: "도쿄의 사진가입니다. 천천히 이야기해도 괜찮아요!",
    interests: ["photography", "music", "city walks", "baseball", "travel"],
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
    age: 31,
    gender: "woman",
    intents: ["language-exchange", "culture"],
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
    age: 30,
    gender: "man",
    intents: ["language-exchange", "friendship"],
    nativeLanguages: ["en", "fr"],
    learningLanguages: [{ code: "ko", level: "beginner", goal: "동료와 간단히 대화하기" }],
    bio: "Developer in Toronto. Happy to talk about tech, games, or Montréal food.",
    interests: ["technology", "games", "cycling", "food", "coffee"],
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
    age: 25,
    gender: "woman",
    intents: ["language-exchange", "friendship", "culture"],
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
  {
    id: "user-amelie",
    name: "Amélie",
    handle: "@amelie.paris",
    avatar: "AM",
    avatarColor: "#D65A8D",
    country: { code: "FR", name: "France", flag: "🇫🇷" },
    timezone: "Europe/Paris",
    age: 29,
    gender: "woman",
    intents: ["language-exchange", "voice-practice", "culture"],
    nativeLanguages: ["fr", "en"],
    learningLanguages: [{ code: "ko", level: "elementary", goal: "한국인 동료와 점심 대화하기" }],
    bio: "Editorial illustrator in Paris. I love museum weekends, coffee, and learning through short voice notes.",
    interests: ["illustration", "coffee", "museums", "travel"],
    status: "online",
    lastActive: "2026-08-11T13:21:00.000Z",
    verified: true,
    exchangeScore: 90,
    responseRate: 94,
    correctionsGiven: 163,
  },
  {
    id: "user-ethan",
    name: "Ethan",
    handle: "@ethan.makes",
    avatar: "ET",
    avatarColor: "#4F7CAC",
    country: { code: "US", name: "United States", flag: "🇺🇸" },
    timezone: "America/New_York",
    age: 32,
    gender: "man",
    intents: ["language-exchange", "friendship", "culture"],
    nativeLanguages: ["en"],
    learningLanguages: [{ code: "ko", level: "intermediate", goal: "한국 팀과 자연스럽게 협업하기" }],
    bio: "Product designer in Brooklyn who enjoys travel sketches and neighborhood coffee shops.",
    interests: ["design", "coffee", "travel", "drawing"],
    status: "online",
    lastActive: "2026-08-11T13:16:00.000Z",
    verified: true,
    exchangeScore: 95,
    responseRate: 96,
    correctionsGiven: 182,
  },
  {
    id: "user-yui",
    name: "Yui",
    handle: "@yui.weekends",
    avatar: "YU",
    avatarColor: "#D96C8B",
    country: { code: "JP", name: "Japan", flag: "🇯🇵" },
    timezone: "Asia/Tokyo",
    age: 26,
    gender: "woman",
    intents: ["language-exchange", "friendship", "voice-practice"],
    nativeLanguages: ["ja"],
    learningLanguages: [{ code: "ko", level: "intermediate", goal: "친구와 자연스럽게 통화하기" }],
    bio: "Coffee roaster in Yokohama. I like short voice chats and slow weekend trips.",
    interests: ["coffee", "travel", "music", "food"],
    status: "online",
    lastActive: "2026-08-11T13:17:00.000Z",
    verified: true,
    exchangeScore: 96,
    responseRate: 97,
    correctionsGiven: 231,
  },
  {
    id: "user-chloe",
    name: "Chloe",
    handle: "@chloe.vancouver",
    avatar: "CH",
    avatarColor: "#4AAE9B",
    country: { code: "CA", name: "Canada", flag: "🇨🇦" },
    timezone: "America/Vancouver",
    age: 24,
    gender: "woman",
    intents: ["language-exchange", "friendship"],
    nativeLanguages: ["en"],
    learningLanguages: [{ code: "ko", level: "beginner", goal: "여행에서 친구 사귀기" }],
    bio: "Student and trail runner in Vancouver, planning my first trip to Busan.",
    interests: ["running", "travel", "books", "nature"],
    status: "online",
    lastActive: "2026-08-11T13:12:00.000Z",
    verified: true,
    exchangeScore: 90,
    responseRate: 92,
    correctionsGiven: 78,
  },
  {
    id: "user-haru",
    name: "Haru",
    handle: "@haru.records",
    avatar: "HA",
    avatarColor: "#7C69C7",
    country: { code: "JP", name: "Japan", flag: "🇯🇵" },
    timezone: "Asia/Osaka",
    age: 30,
    gender: "nonbinary",
    intents: ["language-exchange", "friendship", "culture"],
    nativeLanguages: ["ja"],
    learningLanguages: [{ code: "ko", level: "elementary", goal: "음악 이야기를 한국어로 나누기" }],
    bio: "Record-store staff in Osaka. Happy to swap playlists and café recommendations.",
    interests: ["coffee", "music", "design", "city walks"],
    status: "online",
    lastActive: "2026-08-11T13:14:00.000Z",
    verified: true,
    exchangeScore: 93,
    responseRate: 95,
    correctionsGiven: 144,
  },
  {
    id: "user-liam",
    name: "Liam",
    handle: "@liam.products",
    avatar: "LM",
    avatarColor: "#D48645",
    country: { code: "US", name: "United States", flag: "🇺🇸" },
    timezone: "America/Chicago",
    age: 34,
    gender: "man",
    intents: ["language-exchange", "friendship"],
    nativeLanguages: ["en"],
    learningLanguages: [{ code: "ko", level: "beginner", goal: "출장 중 간단한 대화하기" }],
    bio: "Product manager in Chicago. I learn best through practical, friendly corrections.",
    interests: ["design", "coffee", "technology", "baseball"],
    status: "online",
    lastActive: "2026-08-11T13:05:00.000Z",
    verified: true,
    exchangeScore: 92,
    responseRate: 90,
    correctionsGiven: 166,
  },
  {
    id: "user-aiko",
    name: "Aiko",
    handle: "@aiko.cooks",
    avatar: "AI",
    avatarColor: "#E06464",
    country: { code: "JP", name: "Japan", flag: "🇯🇵" },
    timezone: "Asia/Fukuoka",
    age: 28,
    gender: "woman",
    intents: ["language-exchange", "friendship", "culture"],
    nativeLanguages: ["ja"],
    learningLanguages: [{ code: "ko", level: "intermediate", goal: "한일 요리 문화를 소개하기" }],
    bio: "Home cook in Fukuoka who collects recipes while traveling.",
    interests: ["travel", "cooking", "food", "photography"],
    status: "online",
    lastActive: "2026-08-11T13:11:00.000Z",
    verified: true,
    exchangeScore: 94,
    responseRate: 96,
    correctionsGiven: 213,
  },
  {
    id: "user-olivia",
    name: "Olivia",
    handle: "@olivia.reads",
    avatar: "OL",
    avatarColor: "#3A91A8",
    country: { code: "CA", name: "Canada", flag: "🇨🇦" },
    timezone: "America/Toronto",
    age: 27,
    gender: "woman",
    intents: ["language-exchange", "friendship"],
    nativeLanguages: ["en"],
    learningLanguages: [{ code: "ko", level: "advanced", goal: "책과 디자인을 깊이 있게 토론하기" }],
    bio: "Editorial designer in Toronto. I enjoy book clubs and thoughtful language exchange.",
    interests: ["design", "books", "coffee", "art"],
    status: "online",
    lastActive: "2026-08-11T13:09:00.000Z",
    verified: true,
    exchangeScore: 98,
    responseRate: 99,
    correctionsGiven: 348,
  },
  {
    id: "user-kenji",
    name: "Kenji",
    handle: "@kenji.runs",
    avatar: "KJ",
    avatarColor: "#5376C6",
    country: { code: "JP", name: "Japan", flag: "🇯🇵" },
    timezone: "Asia/Tokyo",
    age: 33,
    gender: "man",
    intents: ["language-exchange", "friendship", "voice-practice"],
    nativeLanguages: ["ja"],
    learningLanguages: [{ code: "ko", level: "intermediate", goal: "러닝 친구와 편하게 대화하기" }],
    bio: "Morning runner and travel planner. Ten-minute voice exchanges work best for me.",
    interests: ["running", "travel", "coffee", "sports"],
    status: "online",
    lastActive: "2026-08-11T13:07:00.000Z",
    verified: true,
    exchangeScore: 91,
    responseRate: 94,
    correctionsGiven: 121,
  },
  {
    id: "user-emma",
    name: "Emma",
    handle: "@emma.films",
    avatar: "EM",
    avatarColor: "#C35C9A",
    country: { code: "US", name: "United States", flag: "🇺🇸" },
    timezone: "America/Los_Angeles",
    age: 26,
    gender: "woman",
    intents: ["language-exchange", "friendship", "culture"],
    nativeLanguages: ["en"],
    learningLanguages: [{ code: "ko", level: "elementary", goal: "영화 감상을 한국어로 이야기하기" }],
    bio: "Film editor in Los Angeles. Let’s trade movie picks and café notes.",
    interests: ["coffee", "movies", "design", "travel"],
    status: "online",
    lastActive: "2026-08-11T13:15:00.000Z",
    verified: true,
    exchangeScore: 95,
    responseRate: 97,
    correctionsGiven: 239,
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

export const defaultMatchingPreferences: MatchingPreferences = {
  targetLanguages: ["en", "ja"],
  preferredCountries: ["US", "JP", "CA"],
  interests: ["design", "coffee", "travel"],
  availability: ["weekday-evening", "weekend-morning"],
  partnerLevel: "any",
  onlineOnly: false,
  partnerGender: "any",
  ageMin: 20,
  ageMax: 40,
  verifiedOnly: false,
  intents: ["language-exchange", "friendship"],
};

export const partnerMatchingSignals: PartnerMatchingSignal[] = [
  {
    partnerId: "user-maya",
    availability: ["weekday-evening", "weekend-morning"],
    learningStyle: "casual-chat",
    icebreakers: [
      "Maya에게 최근 인상 깊었던 디자인 이야기를 물어보세요.",
      "서로 좋아하는 주말 산책 코스를 한 문장씩 소개해 보세요.",
    ],
  },
  {
    partnerId: "user-ren",
    availability: ["weekday-evening", "weekend-morning"],
    learningStyle: "voice-first",
    icebreakers: [
      "Ren에게 서울에서 가장 다시 찍고 싶은 장소를 물어보세요.",
      "좋아하는 사진 한 장을 골라 한국어와 일본어로 묘사해 보세요.",
    ],
  },
  {
    partnerId: "user-sofia",
    availability: ["weekday-morning", "weekend-evening"],
    learningStyle: "structured",
    icebreakers: [
      "Sofía에게 마드리드에서 좋아하는 건축물을 추천해 달라고 해보세요.",
      "서로의 여행 버킷리스트에서 도시 하나씩 골라 이야기해 보세요.",
    ],
  },
  {
    partnerId: "user-noah",
    availability: ["weekday-evening", "weekend-morning"],
    learningStyle: "correction-focused",
    icebreakers: [
      "Noah와 최근 써 본 유용한 앱 하나를 서로 소개해 보세요.",
      "토론토와 서울의 출퇴근 문화를 비교해 보세요.",
    ],
  },
  {
    partnerId: "user-lina",
    availability: ["weekday-evening", "weekend-evening"],
    learningStyle: "structured",
    icebreakers: [
      "Lina에게 가장 자신 있는 베이킹 메뉴를 물어보세요.",
      "교환학생으로 꼭 해보고 싶은 일을 세 가지씩 나눠 보세요.",
    ],
  },
  {
    partnerId: "user-amelie",
    availability: ["weekday-morning", "weekend-morning"],
    learningStyle: "voice-first",
    icebreakers: [
      "Amélie에게 파리에서 조용히 그림 보기 좋은 미술관을 물어보세요.",
      "서로의 동네에서 좋아하는 카페를 한 곳씩 소개해 보세요.",
    ],
  },
  {
    partnerId: "user-ethan",
    availability: ["weekday-evening", "weekend-morning"],
    learningStyle: "correction-focused",
    icebreakers: ["Ethan에게 최근 인상 깊었던 제품 디자인을 물어보세요.", "서울과 뉴욕의 동네 카페를 비교해 보세요."],
  },
  {
    partnerId: "user-yui",
    availability: ["weekday-evening", "weekend-morning"],
    learningStyle: "voice-first",
    icebreakers: ["Yui에게 요코하마에서 좋아하는 카페를 물어보세요.", "서로 10초 음성으로 오늘의 커피를 소개해 보세요."],
  },
  {
    partnerId: "user-chloe",
    availability: ["weekday-evening", "weekend-morning"],
    learningStyle: "casual-chat",
    icebreakers: ["Chloe에게 밴쿠버 러닝 코스를 추천해 달라고 해보세요.", "부산에서 가보고 싶은 곳을 함께 골라 보세요."],
  },
  {
    partnerId: "user-haru",
    availability: ["weekday-evening", "weekend-morning"],
    learningStyle: "casual-chat",
    icebreakers: ["Haru와 요즘 자주 듣는 곡을 한 곡씩 나눠 보세요.", "오사카의 조용한 카페를 추천해 달라고 해보세요."],
  },
  {
    partnerId: "user-liam",
    availability: ["weekday-evening", "weekend-morning"],
    learningStyle: "correction-focused",
    icebreakers: ["Liam과 최근 유용했던 제품을 하나씩 소개해 보세요.", "출장에서 꼭 쓰는 표현을 서로 교정해 보세요."],
  },
  {
    partnerId: "user-aiko",
    availability: ["weekday-evening", "weekend-morning"],
    learningStyle: "structured",
    icebreakers: ["Aiko에게 후쿠오카 가정식을 추천해 달라고 해보세요.", "한일 여행에서 기억에 남은 음식을 나눠 보세요."],
  },
  {
    partnerId: "user-olivia",
    availability: ["weekday-evening", "weekend-morning"],
    learningStyle: "structured",
    icebreakers: ["Olivia에게 요즘 읽는 책을 물어보세요.", "좋아하는 책 표지 디자인을 한 개씩 소개해 보세요."],
  },
  {
    partnerId: "user-kenji",
    availability: ["weekday-evening", "weekend-morning"],
    learningStyle: "voice-first",
    icebreakers: ["Kenji와 아침 러닝 습관을 짧게 이야기해 보세요.", "다음 여행에서 달리고 싶은 도시를 골라 보세요."],
  },
  {
    partnerId: "user-emma",
    availability: ["weekday-evening", "weekend-morning"],
    learningStyle: "casual-chat",
    icebreakers: ["Emma에게 최근 재미있게 본 영화를 물어보세요.", "한국과 미국 영화의 대사를 하나씩 추천해 보세요."],
  },
];

export const conversationGuides: ConversationGuide[] = [
  {
    partnerId: "user-maya",
    topics: ["최근 진행한 디자인 프로젝트", "주말 하이킹 코스", "좋아하는 한국 음식"],
    suggestedOpeners: [
      "Hi Maya! Your hiking photos sound fun. Where did you go most recently?",
      "프로필에 디자인을 좋아한다고 봤어요. 요즘 가장 흥미로운 프로젝트가 뭐예요?",
      "떡볶이 말고 새로 도전해 보고 싶은 한국 음식이 있어요?",
    ],
    followUpQuestions: ["What made it memorable?", "한국과 미국에서는 어떤 점이 달라요?", "다음에는 무엇을 해보고 싶어요?"],
    tip: "Maya는 편안한 일상 대화를 선호해요. 짧은 자기 경험을 먼저 나누고 열린 질문을 덧붙여 보세요.",
  },
  {
    partnerId: "user-ren",
    topics: ["도시 사진", "일본 인디 음악", "서울과 도쿄의 동네 산책"],
    suggestedOpeners: [
      "Renさん、最近撮った写真の中で一番気に入っている一枚は何ですか？",
      "서울에서 사진 찍기 좋았던 동네가 어디였어요?",
      "요즘 자주 듣는 일본 밴드를 하나 추천해 줄 수 있어요?",
    ],
    followUpQuestions: ["その写真を選んだ理由は何ですか？", "다음에는 어디를 걷고 싶어요?", "초보자에게도 추천할 만해요?"],
    tip: "Ren은 사진처럼 구체적인 소재와 짧은 음성 메시지에 반응이 좋아요. 한 번에 질문 하나만 보내보세요.",
  },
  {
    partnerId: "user-sofia",
    topics: ["마드리드 건축", "한국 여행 계획", "스페인 가정식"],
    suggestedOpeners: [
      "Hola Sofía! Which building in Madrid would you show an architecture fan first?",
      "한국 여행에서 가장 기대하는 장소가 어디예요?",
      "스페인에서 평일 저녁에 자주 먹는 음식이 궁금해요.",
    ],
    followUpQuestions: ["Why is that place special to you?", "여행 전에 연습하고 싶은 표현이 있어요?", "직접 만들어 본 적도 있어요?"],
    tip: "Sofía는 구체적인 목표를 둔 대화를 좋아해요. 이번 대화에서 서로 연습할 언어 비율을 먼저 제안해 보세요.",
  },
  {
    partnerId: "user-noah",
    topics: ["최근 만든 사이드 프로젝트", "토론토 자전거 생활", "몬트리올 음식"],
    suggestedOpeners: [
      "Hey Noah! What side project have you enjoyed working on lately?",
      "토론토에서 자전거 타기 좋은 계절은 언제예요?",
      "몬트리올에 처음 간다면 꼭 먹어야 할 메뉴가 뭐예요?",
    ],
    followUpQuestions: ["What was the hardest part?", "서울과 비교하면 어떤가요?", "현지인처럼 주문하려면 뭐라고 해야 해요?"],
    tip: "Noah는 서로 문장을 고쳐주는 방식에 익숙해요. 교정을 원한다는 표시와 함께 짧은 문장을 보내보세요.",
  },
  {
    partnerId: "user-lina",
    topics: ["독일식 베이킹", "베를린 전시", "교환학생 준비"],
    suggestedOpeners: [
      "Hi Lina! What is your favorite thing to bake for friends?",
      "최근 베를린에서 본 전시 중에 추천하고 싶은 게 있어요?",
      "교환학생으로 한국에 오면 가장 먼저 해보고 싶은 일이 뭐예요?",
    ],
    followUpQuestions: ["처음 만든 건 언제였어요?", "What did you like most about it?", "준비하면서 궁금한 점이 있어요?"],
    tip: "Lina는 생각할 시간을 두고 정리해서 말하는 편이에요. 여러 질문을 한꺼번에 보내기보다 한 주제씩 이어가세요.",
  },
  {
    partnerId: "user-amelie",
    topics: ["파리의 작은 미술관", "일러스트 작업", "동네 카페"],
    suggestedOpeners: [
      "Bonjour Amélie! Which small museum in Paris do you keep returning to?",
      "요즘 어떤 일러스트를 그리고 있어요?",
      "파리에서 그림 그리기 좋은 조용한 카페를 추천해 줄 수 있어요?",
    ],
    followUpQuestions: ["What keeps inspiring you there?", "작업할 때 어떤 음악을 들어요?", "언젠가 서울에서도 그리고 싶은 장소가 있어요?"],
    tip: "Amélie는 짧은 음성 메시지로 배우는 것을 좋아해요. 텍스트로 먼저 인사한 뒤 10초 정도의 음성을 제안해 보세요.",
  },
];

export const defaultDmPrivacySettings: DmPrivacySettings = {
  whoCanMessage: "mutual-follows",
  routeOthersToRequests: true,
  filterSuspectedSpam: true,
  allowVoiceMessagesInRequests: false,
  readReceipts: true,
};

export const dmRequests: DmRequest[] = [
  {
    id: "dm-request-chloe",
    sender: partners.find((partner) => partner.id === "user-chloe")!,
    preview: "안녕하세요! 부산 여행 표현을 같이 연습하고 싶어요.",
    receivedAt: "2026-08-11T12:32:00.000Z",
    status: "pending",
    relationship: "follower",
    risk: { level: "low", signals: [] },
  },
  {
    id: "dm-request-example",
    sender: {
      id: "user-example",
      name: "Travel Buddy",
      handle: "@travel.fast",
      avatar: "TB",
      avatarColor: "#767676",
      verified: false,
    },
    preview: "다른 메신저로 이동하면 투자 정보를 알려드릴게요.",
    receivedAt: "2026-08-11T11:10:00.000Z",
    status: "pending",
    relationship: "not-connected",
    risk: { level: "high", signals: ["외부 메신저 이동 유도", "금전·투자 관련 표현"] },
  },
];

export const seededSafetyReports: SafetyReport[] = [
  {
    id: "report-demo-scam",
    reporterId: currentUser.id,
    targetType: "user",
    targetId: "user-example",
    reason: "scam",
    details: "외부 메신저에서 투자금을 보내 달라고 요청했습니다.",
    status: "triaging",
    submittedAt: "2026-08-11T11:20:00.000Z",
    updatedAt: "2026-08-11T11:35:00.000Z",
    nextUpdateBy: "2026-08-12T11:20:00.000Z",
    reporterAccountStatus: "active",
    statusHistory: [
      { status: "received", at: "2026-08-11T11:20:00.000Z", note: "신고와 관련 메시지 증거를 안전하게 접수했어요." },
      { status: "triaging", at: "2026-08-11T11:35:00.000Z", note: "자동 분류 후 안전 담당 검토 대기 중이에요." },
    ],
  },
];

export const accountVerification: AccountVerification = {
  userId: currentUser.id,
  accountStatus: "active",
  assuranceLevel: "phone",
  activationEligible: true,
  requiredForActivation: ["email", "phone"],
  steps: [
    { type: "email", status: "verified", required: true, verifiedAt: "2026-07-01T04:20:00.000Z", maskedDestination: "m***@example.com" },
    { type: "phone", status: "verified", required: true, verifiedAt: "2026-07-01T04:23:00.000Z", maskedDestination: "+82 10-****-1234" },
    { type: "identity", status: "not-started", required: false },
  ],
  reSignupProtection: {
    enabled: true,
    identifier: "verified-phone-hash",
    note: "정지된 전화번호 식별자의 즉시 재가입을 제한하는 목업 정책입니다.",
  },
  updatedAt: "2026-08-11T13:22:00.000Z",
};

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
    freeTranslation: true,
    dmRequestInbox: true,
    transparentSafetyReports: true,
  },
};
