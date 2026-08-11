export type Accent = "violet" | "coral" | "mint" | "amber" | "blue" | "rose";

export type Partner = {
  id: string;
  name: string;
  handle: string;
  flag: string;
  city: string;
  native: string;
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
  accent: Accent;
  scheduled?: string;
};

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
};

export const partners: Partner[] = [
  {
    id: "maya",
    name: "Maya",
    handle: "@maya.speaks",
    flag: "🇨🇦",
    city: "밴쿠버 · 오전 10:24",
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
    city: "마드리드 · 오후 7:24",
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
    city: "도쿄 · 오전 2:24",
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
    city: "런던 · 오후 6:24",
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
    city: "파리 · 오후 7:24",
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
];

export const initialPosts: FeedPost[] = [
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
    accent: "mint",
    scheduled: "오늘 오후 9:00",
  },
];

export const savedPhrases = [
  { phrase: "That makes sense.", meaning: "그 말 이해돼요 / 일리가 있어요", source: "Maya와의 대화", due: "오늘" },
  { phrase: "Could you say that again?", meaning: "다시 한번 말해주시겠어요?", source: "보이스룸", due: "내일" },
  { phrase: "여백을 조금 더 주면 좋겠어요.", meaning: "It would be nice to add more whitespace.", source: "Aiko의 게시물", due: "3일 후" },
];
