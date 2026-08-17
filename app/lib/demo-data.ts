export type Accent = "violet" | "coral" | "mint" | "amber" | "blue" | "rose";

export type Partner = {
  id: string;
  name: string;
  handle: string;
  flag: string;
  city: string;
  /** 국가명. 국기만으로는 어디인지 모르는 경우가 많습니다. */
  country: string;
  /** 나와의 시차(시간). 양수면 상대가 빠릅니다. */
  timeOffset: number;
  native: string;
  nativeLevel?: string;
  learning: string;
  level: string;
  interests: string[];
  bio: string;
  online: boolean;
  compatibility: number;
  accent: Accent;
  goal: string;
  activeTime: string;
  balance: string;
  verified?: boolean;
};

export type FeedPost = {
  id: string;
  authorId: string;
  author: string;
  handle: string;
  flag: string;
  accent: Accent;
  time: string;
  language: string;
  level: string;
  text: string;
  translation: string;
  tags: string[];
  likes: number;
  comments: number;
  corrections: number;
  liked?: boolean;
  saved?: boolean;
  visual?: {
    emoji: string;
    eyebrow: string;
    title: string;
    caption: string;
  };
  correction?: {
    original: string;
    fixed: string;
    note: string;
  };
};

export type ChatMessage = {
  id: string;
  mine: boolean;
  text?: string;
  time: string;
  translated?: string;
  voice?: string;
  correction?: {
    original: string;
    fixed: string;
    note: string;
  };
  system?: boolean;
};

export type Conversation = {
  id: string;
  partnerId?: string;
  name: string;
  flag: string;
  accent: Accent;
  preview: string;
  time: string;
  unread: number;
  online: boolean;
  myTurn?: boolean;
  typing?: boolean;
  group?: boolean;
  muted?: boolean;
  messages: ChatMessage[];
};

export type PracticeRoom = {
  id: string;
  title: string;
  topic: string;
  language: string;
  level: string;
  host: string;
  hostFlag: string;
  listeners: number;
  speakers: string[];
  /** 듣고만 있는 사람. listeners 총원 중 화면에 노출할 일부입니다. */
  audience: RoomListener[];
  accent: Accent;
  scheduled?: string;
};

export type RoomListener = { name: string; flag: string };

export type RoomMessage = { id: string; name: string; text: string; mine?: boolean };

export const currentUser = {
  name: "서준",
  handle: "@seojun.learns",
  flag: "🇰🇷",
  native: "한국어",
  learning: "영어",
  level: "B1",
  streak: 12,
  points: 1840,
  accent: "violet" as Accent,
  bio: "한국어 원어민 · 영어 B1\n평일 저녁에 대화 연습해요. 발음 교정 환영합니다.",
  partners: 24,
  posts: 8,
};

/** 내가 쓴 글. 프로필의 "내 글" 탭에서 보여줍니다. */
export const myPosts: FeedPost[] = [
  {
    id: "my-1", authorId: "seojun", author: "서준", handle: "@seojun.learns",
    flag: "🇰🇷", accent: "violet", time: "2시간 전", language: "영어", level: "B1",
    text: "회의에서 써본 표현: ‘I’m on the fence.’ 결정을 못 내렸다는 뜻이래요. 바로 사용해봤는데 통했어요!",
    translation: "Today's expression means being undecided. I used it in a meeting and it worked!",
    tags: ["#오늘의문장", "#English"], likes: 42, comments: 7, corrections: 2,
  },
  {
    id: "my-2", authorId: "seojun", author: "서준", handle: "@seojun.learns",
    flag: "🇰🇷", accent: "violet", time: "어제", language: "영어", level: "B1",
    text: "‘Could you say that again?’와 ‘Come again?’의 뉘앙스 차이가 궁금해요. 후자는 좀 캐주얼한가요?",
    translation: "What is the nuance difference between these two ways of asking someone to repeat?",
    tags: ["#질문", "#English"], likes: 18, comments: 12, corrections: 4,
  },
  {
    id: "my-3", authorId: "seojun", author: "서준", handle: "@seojun.learns",
    flag: "🇰🇷", accent: "violet", time: "3일 전", language: "영어", level: "B1",
    text: "발음 연습 30일째. 오늘 처음으로 원어민 파트너가 “네 발음 많이 좋아졌다”고 해줬어요 🎉",
    translation: "Day 30 of pronunciation practice. My partner said my pronunciation improved a lot today!",
    tags: ["#기록", "#발음"], likes: 96, comments: 15, corrections: 1,
  },
];

export const partners: Partner[] = [
  {
    id: "maya",
    name: "Maya",
    handle: "@maya.speaks",
    flag: "🇨🇦",
    city: "밴쿠버", country: "캐나다", timeOffset: -17,
    native: "영어",
    learning: "한국어",
    level: "A2",
    interests: ["영화", "러닝", "카페"],
    bio: "서울 독립영화를 좋아해요. 자연스러운 영어 표현과 발음을 도와드릴게요!",
    online: true,
    compatibility: 96,
    accent: "coral",
    goal: "자연스러운 일상 대화",
    activeTime: "평일 저녁 · 주말 오전",
    balance: "도움 4h 20m · 배움 4h 05m",
    verified: true,
  },
  {
    id: "lucas",
    name: "Lucas",
    handle: "@lucas.enruta",
    flag: "🇪🇸",
    city: "마드리드", country: "스페인", timeOffset: -8,
    native: "스페인어",
    learning: "한국어",
    level: "B1",
    interests: ["여행", "축구", "요리"],
    bio: "한국 여행을 준비하고 있어요. 타파스 이야기라면 밤새 이야기할 수 있습니다.",
    online: true,
    compatibility: 91,
    accent: "amber",
    goal: "여행 회화와 문화 교류",
    activeTime: "매일 밤 9시 이후",
    balance: "도움 2h 40m · 배움 2h 45m",
  },
  {
    id: "aiko",
    name: "Aiko",
    handle: "@aiko.notes",
    flag: "🇯🇵",
    city: "도쿄", country: "일본", timeOffset: 0,
    native: "일본어",
    learning: "한국어",
    level: "B2",
    interests: ["디자인", "책", "사진"],
    bio: "제품 디자이너예요. 틀려도 편하게 이야기하는 교환 파트너를 찾고 있어요.",
    online: false,
    compatibility: 89,
    accent: "rose",
    goal: "업무 표현과 발표 연습",
    activeTime: "주중 아침 7–9시",
    balance: "도움 6h 10m · 배움 5h 50m",
    verified: true,
  },
  {
    id: "omar",
    name: "Omar",
    handle: "@omar.words",
    flag: "🇬🇧",
    city: "런던", country: "영국", timeOffset: -9,
    native: "영어",
    learning: "한국어",
    level: "A1",
    interests: ["음악", "게임", "기술"],
    bio: "인디 게임 개발자입니다. 짧지만 꾸준한 음성 메시지 연습을 좋아해요.",
    online: true,
    compatibility: 87,
    accent: "blue",
    goal: "한국 친구와 부담 없는 대화",
    activeTime: "화·목 저녁",
    balance: "도움 1h 50m · 배움 1h 42m",
  },
  {
    id: "clara",
    name: "Clara",
    handle: "@claraparis",
    flag: "🇫🇷",
    city: "파리", country: "프랑스", timeOffset: -8,
    native: "프랑스어",
    learning: "한국어",
    level: "A2",
    interests: ["미술", "베이킹", "재즈"],
    bio: "박물관과 빵을 사랑해요. 서로 일주일에 문장 세 개씩 고쳐줘요.",
    online: false,
    compatibility: 84,
    accent: "mint",
    goal: "정확한 문장 만들기",
    activeTime: "토·일 오후",
    balance: "도움 3h 35m · 배움 3h 25m",
  },
  {
    id: "nina",
    name: "Nina",
    handle: "@nina.talks",
    flag: "🇺🇸",
    city: "시애틀", country: "미국", timeOffset: -17,
    native: "영어",
    learning: "한국어",
    level: "B1",
    interests: ["책", "하이킹", "커피"],
    bio: "긴 대화보다 매일 10분씩 꾸준히 연습하는 친구를 찾고 있어요.",
    online: true,
    compatibility: 94,
    accent: "violet",
    goal: "꾸준한 일상 회화",
    activeTime: "평일 저녁 · 주말 오전",
    balance: "도움 5h 10m · 배움 5h 00m",
    verified: true,
  },
  {
    id: "jamie",
    name: "Jamie",
    handle: "@jamie.daily",
    flag: "🇦🇺",
    city: "시드니", country: "호주", timeOffset: 1,
    native: "영어",
    learning: "한국어",
    level: "A2",
    interests: ["러닝", "여행", "음악"],
    bio: "한국 마라톤 여행을 준비하며 자연스러운 표현을 배우고 있어요.",
    online: false,
    compatibility: 92,
    accent: "mint",
    goal: "여행과 운동 이야기",
    activeTime: "주말 오전",
    balance: "도움 3h 15m · 배움 3h 08m",
    verified: true,
  },
  {
    id: "elliot",
    name: "Elliot",
    handle: "@elliot.makes",
    flag: "🇬🇧",
    city: "맨체스터", country: "영국", timeOffset: -9,
    native: "영어",
    learning: "한국어",
    level: "B2",
    interests: ["디자인", "기술", "사진"],
    bio: "제품을 만드는 사람끼리 업무 표현과 피드백 문장을 연습하고 싶어요.",
    online: true,
    compatibility: 90,
    accent: "blue",
    goal: "업무 회화와 발표",
    activeTime: "평일 저녁",
    balance: "도움 7h 20m · 배움 7h 05m",
  },
  {
    id: "sora",
    name: "Sora",
    handle: "@sora.weekend",
    flag: "🇯🇵",
    city: "오사카", country: "일본", timeOffset: 0,
    native: "일본어",
    learning: "한국어",
    level: "A2",
    interests: ["요리", "영화", "여행"],
    bio: "주말에 요리하면서 편하게 음성 메시지를 주고받고 싶어요.",
    online: true,
    compatibility: 88,
    accent: "coral",
    goal: "친구와 편한 일상 대화",
    activeTime: "주말 오전 · 저녁",
    balance: "도움 2h 55m · 배움 2h 50m",
    verified: true,
  },
  {
    id: "theo",
    name: "Theo",
    handle: "@theo.reads",
    flag: "🇨🇦",
    city: "토론토", country: "캐나다", timeOffset: -14,
    native: "영어",
    learning: "한국어",
    level: "A1",
    interests: ["책", "재즈", "카페"],
    bio: "짧은 책 문장과 음악 이야기를 번갈아 나누는 교환을 좋아해요.",
    online: false,
    compatibility: 86,
    accent: "amber",
    goal: "기초 표현을 천천히 익히기",
    activeTime: "평일 저녁",
    balance: "도움 1h 40m · 배움 1h 35m",
  },
  {
    id: "emma",
    name: "Emma",
    handle: "@emma.cooks",
    flag: "🇺🇸",
    city: "뉴욕", country: "미국", timeOffset: -14,
    native: "영어",
    learning: "한국어",
    level: "B1",
    interests: ["요리", "사진", "영화"],
    bio: "서로의 레시피를 소개하면서 표현을 친절하게 고쳐주고 싶어요.",
    online: true,
    compatibility: 85,
    accent: "rose",
    goal: "문화와 취미 대화",
    activeTime: "화·목 저녁",
    balance: "도움 4h 35m · 배움 4h 22m",
    verified: true,
  },
  {
    id: "daniel",
    name: "Daniel",
    handle: "@daniel.moves",
    flag: "🇦🇺",
    city: "멜버른", country: "호주", timeOffset: 1,
    native: "영어",
    learning: "한국어",
    level: "B2",
    interests: ["축구", "여행", "기술"],
    bio: "한국에서 일할 계획이라 실제 상황 중심으로 연습하고 있어요.",
    online: false,
    compatibility: 83,
    accent: "violet",
    goal: "생활과 업무 적응",
    activeTime: "매일 밤 8시 이후",
    balance: "도움 6h 00m · 배움 5h 48m",
    verified: true,
  },
];

/** 피드 목업을 결정론적으로 늘립니다. 같은 index면 항상 같은 결과입니다. */
const FEED_SEEDS: Array<{
  author: string;
  handle: string;
  flag: string;
  accent: Accent;
  language: string;
  level: string;
  text: string;
  translation: string;
  tags: string[];
}> = [
  {
    author: "Maya", handle: "@maya.speaks", flag: "🇨🇦", accent: "coral",
    language: "한국어", level: "A2",
    text: "오늘 카페에서 ‘아이스 아메리카노 얼죽아’라는 말을 들었어요. 줄임말이 너무 많아서 매번 새로워요!",
    translation: "I heard a slang phrase at a cafe today. Korean abbreviations are always new to me!",
    tags: ["#한국어", "#줄임말"],
  },
  {
    author: "Lucas", handle: "@lucas.enruta", flag: "🇪🇸", accent: "amber",
    language: "영어", level: "B1",
    text: "Small win: I ordered coffee in English without rehearsing the sentence first.",
    translation: "작은 성공: 문장을 미리 연습하지 않고 영어로 커피를 주문했어요.",
    tags: ["#English", "#smallwins"],
  },
  {
    author: "Aiko", handle: "@aiko.notes", flag: "🇯🇵", accent: "rose",
    language: "한국어", level: "B2",
    text: "‘눈치가 빠르다’를 일본어로 어떻게 번역하면 자연스러울까요? 직역이 안 되는 것 같아요.",
    translation: "How would you naturally translate this Korean expression into Japanese?",
    tags: ["#번역", "#표현"],
  },
  {
    author: "Omar", handle: "@omar.learns", flag: "🇦🇪", accent: "mint",
    language: "한국어", level: "A1",
    text: "받침 발음이 제일 어려워요. ‘밖’과 ‘박’ 구분이 아직도 잘 안 됩니다.",
    translation: "Final consonants are the hardest part for me.",
    tags: ["#발음", "#한국어"],
  },
  {
    author: "Clara", handle: "@clara.kr", flag: "🇩🇪", accent: "blue",
    language: "영어", level: "C1",
    text: "회의에서 ‘let’s circle back’ 같은 표현을 자주 듣는데, 한국어로는 어떻게 말하나요?",
    translation: "I often hear business idioms in meetings. What is the Korean equivalent?",
    tags: ["#비즈니스", "#English"],
  },
  {
    author: "서준", handle: "@seojun", flag: "🇰🇷", accent: "violet",
    language: "영어", level: "B2",
    text: "요즘 연습 중인 표현: ‘I’m on the fence.’ 결정을 못 내렸다는 뜻이래요. 바로 써먹어야지.",
    translation: "Today's expression means being undecided about something.",
    tags: ["#오늘의문장", "#English"],
  },
];

const FEED_TIMES = ["방금", "3분 전", "12분 전", "27분 전", "1시간 전", "2시간 전", "5시간 전", "어제", "2일 전"];

/** 표시 이름 → 정식 작성자 id. 파트너 목록·상세 화면과 같은 값을 씁니다. */
const AUTHOR_IDS: Record<string, string> = {
  Maya: "maya",
  Lucas: "lucas",
  Aiko: "aiko",
  Omar: "omar",
  Clara: "clara",
  "서준": "seojun",
};

export function generateFeedPosts(count: number, startIndex = 0): FeedPost[] {
  return Array.from({ length: count }, (_, i) => {
    const n = startIndex + i;
    const seed = FEED_SEEDS[n % FEED_SEEDS.length];
    return {
      id: `post-gen-${n}`,
      // 한 사람은 하나의 id 여야 합니다 — 손으로 쓴 글과 생성된 글의 작성자가 갈라지면
      // 숨기기·차단이 그 사람 글의 일부에만 걸립니다.
      authorId: AUTHOR_IDS[seed.author] ?? seed.handle.replace("@", ""),
      author: seed.author,
      handle: seed.handle,
      flag: seed.flag,
      accent: seed.accent,
      time: FEED_TIMES[n % FEED_TIMES.length],
      language: seed.language,
      level: seed.level,
      text: seed.text,
      translation: seed.translation,
      tags: seed.tags,
      likes: 6 + ((n * 37) % 240),
      comments: 1 + ((n * 13) % 48),
      corrections: (n * 7) % 9,
    };
  });
}

const seededPosts: FeedPost[] = [
  {
    id: "post-1",
    authorId: "maya",
    author: "Maya",
    handle: "@maya.speaks",
    flag: "🇨🇦",
    accent: "coral",
    time: "8분 전",
    language: "한국어",
    level: "A2",
    text: "오늘 처음으로 혼자 김치찌개를 만들었어요! 생각보다 매워서 우유를 두 잔 마셨어요 😅 ‘손이 크다’는 요리를 많이 만들었다는 뜻으로도 쓸 수 있어요?",
    translation: "I made kimchi stew by myself for the first time today! It was spicier than I expected, so I drank two glasses of milk. Can ‘having big hands’ also mean making too much food?",
    tags: ["#한국어", "#오늘의문장", "#요리"],
    likes: 128,
    comments: 24,
    corrections: 6,
    visual: {
      emoji: "🍲",
      eyebrow: "오늘의 한 그릇",
      title: "첫 김치찌개",
      caption: "맵지만 성공!",
    },
    correction: {
      original: "생각보다 매워서 우유를 두 잔 마셨어요.",
      fixed: "생각보다 매워서 우유를 두 잔이나 마셨어요.",
      note: "‘이나’를 넣으면 예상보다 많았다는 느낌이 자연스럽게 살아나요.",
    },
  },
  {
    id: "post-2",
    authorId: "lucas",
    author: "Lucas",
    handle: "@lucas.enruta",
    flag: "🇪🇸",
    accent: "amber",
    time: "32분 전",
    language: "영어",
    level: "B1",
    text: "Small win: I gave a five-minute presentation in English without reading my notes today. I still mixed up ‘sheet’ and… the other word, but everyone was kind about it.",
    translation: "작은 성공: 오늘 메모를 읽지 않고 영어로 5분 발표를 했어요. 아직 ‘sheet’와… 다른 단어를 헷갈렸지만, 모두 친절하게 대해줬어요.",
    tags: ["#English", "#speaking", "#smallwins"],
    likes: 86,
    comments: 18,
    corrections: 3,
  },
  {
    id: "post-3",
    authorId: "aiko",
    author: "Aiko",
    handle: "@aiko.notes",
    flag: "🇯🇵",
    accent: "rose",
    time: "1시간 전",
    language: "한국어",
    level: "B2",
    text: "디자인 회의에서 ‘여백이 답답하다’라는 표현을 들었어요. 공간이 좁다는 뜻인가요, 아니면 전체 분위기가 복잡하다는 뜻인가요? 비슷한 표현도 알려주세요!",
    translation: "In a design meeting, I heard the expression ‘the whitespace feels suffocating.’ Does it mean the space is narrow, or that the overall mood is complicated? Please share similar expressions too!",
    tags: ["#디자인", "#업무한국어", "#질문"],
    likes: 61,
    comments: 31,
    corrections: 8,
    visual: {
      emoji: "✦",
      eyebrow: "DESIGN NOTE 024",
      title: "여백에도 리듬이 있어요",
      caption: "space · rhythm · clarity",
    },
  },
];

export const initialConversations: Conversation[] = [
  {
    id: "chat-maya",
    partnerId: "maya",
    name: "Maya",
    flag: "🇨🇦",
    accent: "coral",
    preview: "오늘 저녁에 15분 연습 어때요?",
    time: "2분",
    unread: 2,
    online: true,
    myTurn: true,
    messages: [
      { id: "m1", mine: false, text: "Hey! How did your interview go?", time: "오후 6:14", translated: "안녕! 면접은 어떻게 됐어?" },
      { id: "m2", mine: true, text: "It went better than I expected. I was nervous at first, though.", time: "오후 6:16" },
      {
        id: "m3",
        mine: false,
        correction: {
          original: "I was nervous at first, though.",
          fixed: "I was a little nervous at first, though.",
          note: "‘a little’을 넣으면 부담 없이 자연스럽게 들려요.",
        },
        time: "오후 6:18",
      },
      { id: "m4", mine: false, voice: "0:18", text: "오늘 저녁에 15분 연습 어때요?", time: "오후 6:21" },
    ],
  },
  {
    id: "chat-lucas",
    partnerId: "lucas",
    name: "Lucas",
    flag: "🇪🇸",
    accent: "amber",
    preview: "¡Perfecto! 내일 봐요 👋",
    time: "38분",
    unread: 0,
    online: true,
    messages: [
      { id: "l1", mine: true, text: "Can we practice ordering at a restaurant?", time: "오후 5:02" },
      { id: "l2", mine: false, text: "¡Claro! Yo seré el camarero.", translated: "물론이죠! 제가 웨이터 역할을 할게요.", time: "오후 5:03" },
      { id: "l3", mine: false, text: "¡Perfecto! 내일 봐요 👋", time: "오후 5:05" },
    ],
  },
  {
    id: "chat-group",
    name: "퇴근 후 English Club",
    flag: "🌏",
    accent: "violet",
    preview: "Nina: 오늘 주제는 작은 성공이에요!",
    time: "1시간",
    unread: 5,
    online: true,
    group: true,
    muted: true,
    messages: [
      { id: "g1", mine: false, system: true, text: "Nina가 오늘의 주제를 ‘Small wins’로 바꿨어요.", time: "오후 4:10" },
      { id: "g2", mine: false, text: "My small win is waking up before my alarm!", time: "오후 4:12" },
      { id: "g3", mine: true, text: "Mine is finishing a book in English 📚", time: "오후 4:15" },
    ],
  },
  {
    id: "chat-aiko",
    partnerId: "aiko",
    name: "Aiko",
    flag: "🇯🇵",
    accent: "rose",
    preview: "그 표현 저장했어요. 고마워요!",
    time: "어제",
    unread: 0,
    online: false,
    messages: [
      { id: "a1", mine: false, text: "‘여백을 조금 더 주면 좋겠어요’ is this natural?", time: "어제" },
      { id: "a2", mine: true, text: "Yes, it sounds very natural in a design review!", time: "어제" },
    ],
  },
];

export const rooms: PracticeRoom[] = [
  {
    id: "room-1",
    title: "영어로 말하는 오늘의 작은 성공",
    topic: "Small wins",
    language: "영어",
    level: "A2–B2",
    host: "Nina",
    hostFlag: "🇦🇺",
    listeners: 42,
    speakers: ["Nina", "Joon", "Sofia", "Ken"],
    audience: [{ name: "Emma", flag: "🇬🇧" }, { name: "지훈", flag: "🇰🇷" }, { name: "Marco", flag: "🇮🇹" }, { name: "Yuki", flag: "🇯🇵" }, { name: "Ana", flag: "🇧🇷" }, { name: "Tom", flag: "🇺🇸" }, { name: "수아", flag: "🇰🇷" }, { name: "Pierre", flag: "🇫🇷" }],
    accent: "violet",
  },
  {
    id: "room-2",
    title: "ゆっくり話す朝の日本語",
    topic: "아침 루틴",
    language: "일본어",
    level: "A1–A2",
    host: "Haruto",
    hostFlag: "🇯🇵",
    listeners: 28,
    speakers: ["Haruto", "Mina", "Leo"],
    audience: [{ name: "서준", flag: "🇰🇷" }, { name: "Aiko", flag: "🇯🇵" }, { name: "민서", flag: "🇰🇷" }, { name: "Kenji", flag: "🇯🇵" }, { name: "Chloe", flag: "🇫🇷" }, { name: "태윤", flag: "🇰🇷" }],
    accent: "rose",
  },
  {
    id: "room-3",
    title: "Travel stories around the world",
    topic: "여행과 문화",
    language: "영어 · 스페인어",
    level: "모든 레벨",
    host: "Sofia",
    hostFlag: "🇲🇽",
    listeners: 76,
    speakers: ["Sofia", "Dan", "Lina", "Omar"],
    audience: [{ name: "Diego", flag: "🇪🇸" }, { name: "Nina", flag: "🇦🇺" }, { name: "하은", flag: "🇰🇷" }, { name: "Ravi", flag: "🇮🇳" }, { name: "Lucia", flag: "🇦🇷" }, { name: "Ben", flag: "🇨🇦" }, { name: "Mei", flag: "🇹🇼" }],
    accent: "amber",
  },
  {
    id: "room-4",
    title: "면접 영어: 나를 소개하는 30초",
    topic: "커리어",
    language: "영어",
    level: "B1–C1",
    host: "Alex",
    hostFlag: "🇺🇸",
    listeners: 0,
    speakers: ["Alex"],
    audience: [],
    accent: "mint",
    scheduled: "오늘 오후 9:00",
  },
];

export const initialRoomMessages: RoomMessage[] = [
  { id: "rm-1", name: "Nina", text: "Welcome! Listening only is totally okay 👋" },
  { id: "rm-2", name: "Joon", text: "My small win was finishing a book!" },
  { id: "rm-3", name: "Emma", text: "That's great. I finally called a cafe in English today ☕" },
  { id: "rm-4", name: "지훈", text: "듣고만 있어도 도움이 많이 되네요" },
];

export const savedPhrases = [
  { phrase: "That makes sense.", meaning: "그 말 이해돼요 / 일리가 있어요", source: "Maya와의 대화", due: "오늘" },
  { phrase: "Could you say that again?", meaning: "다시 한번 말해주시겠어요?", source: "보이스룸", due: "내일" },
  { phrase: "여백을 조금 더 주면 좋겠어요.", meaning: "It would be nice to add more whitespace.", source: "Aiko의 게시물", due: "3일 후" },
];

/** 손으로 쓴 3개 + 생성분 97개 = 100개 피드. */
export const initialPosts: FeedPost[] = [...seededPosts, ...generateFeedPosts(97, 3)];

/** 내가 팔로우한 작성자. "팔로잉" 탭에서 이 사람들 글만 봅니다. */
export const followingAuthors = ["maya", "aiko", "seojun", "maya.speaks", "aiko.notes"];

export type PostReply = {
  id: string;
  author: string;
  handle: string;
  flag: string;
  accent: Accent;
  time: string;
  text: string;
  likes: number;
  /** 일반 답글인지 교정인지. 기본은 답글입니다. */
  kind?: "reply" | "correction";
  /** 교정일 때 원문. text가 고친 문장입니다. */
  original?: string;
  /** 대댓글. 한 단계만 들여씁니다. */
  replies?: PostReply[];
};

/** 게시물별 답글. 상세 화면에서 원글 아래에 이어집니다. */
export const postReplies: Record<string, PostReply[]> = {
  "post-1": [
    {
      id: "r-1", author: "Jisoo", handle: "@jisoo.daily", flag: "🇰🇷", accent: "mint", time: "5분 전",
      text: "‘손이 크다’는 요리를 많이 한다는 뜻으로도 쓸 수 있나요?", original: "‘손이 크다’는 요리를 많이 만들었다는 뜻으로도 쓸 수 있어요?", likes: 12, kind: "correction",
      replies: [
        { id: "r-1-1", author: "Maya", handle: "@maya.speaks", flag: "🇨🇦", accent: "coral", time: "4분 전", text: "감사해요! 다음엔 ‘손맛’도 배워볼게요 😄", likes: 3 },
      ],
    },
    { id: "r-2", author: "Lucas", handle: "@lucas.enruta", flag: "🇪🇸", accent: "amber", time: "2분 전", text: "김치찌개 만들기 도전해보고 싶네요. 레시피 공유해주세요!", likes: 4 },
  ],
  "post-2": [
    { id: "r-3", author: "Maya", handle: "@maya.speaks", flag: "🇨🇦", accent: "coral", time: "10분 전", text: "Congrats! Presentations are scary even in your first language.", likes: 8 },
  ],
};

/** 상대가 먼저 마음을 보낸 사람들. 내가 답하면 대화가 열립니다. */
export const receivedLikes: Array<{ partnerId: string; time: string; note?: string }> = [
  { partnerId: "aiko", time: "12분 전", note: "한국어 발음 도와주실 수 있나요?" },
  { partnerId: "clara", time: "2시간 전" },
  { partnerId: "omar", time: "어제" },
];
