/**
 * 데모 데이터 채우기 — 로컬 에뮬레이터를 진짜 서비스처럼 보이게 합니다.
 *
 *   source dev.local.sh && node scripts/seed-demo.mjs
 *
 * 사람 · 글 · 대화 · 마음 · 팔로우를 실제 API 로 만듭니다. 서버를 우회해서
 * Firestore 에 직접 쓰지 않는 이유: 그러면 검증·차단·카운터 같은 규칙을 건너뛰어
 * "화면에서만 그럴듯한" 데이터가 생깁니다. API 로 만들면 진짜와 같은 데이터입니다.
 *
 * 사진은 얼굴 사진 대신 사람마다 다른 추상 무늬(SVG)를 씁니다 — 있지도 않은
 * 사람의 얼굴을 만들어 붙이지 않기 위해서입니다. 저장소 버킷이 생기면
 * avatarUrl/imageUrl 에 그 주소를 넣기만 하면 됩니다.
 */
const API = process.env.LINGOLOOP_API_URL || "http://127.0.0.1:8080";
const PASSWORD = "TestPassword1234!";

const svgUri = (svg) => "data:image/svg+xml;utf8," + encodeURIComponent(svg.replace(/\s+/g, " ").trim());

/** 사람마다 다른 아바타 — 두 색 그라데이션 + 원 무늬 + 머리글자. */
const avatar = (initial, from, to) => svgUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="96" height="96" fill="url(#g)"/>
    <circle cx="26" cy="72" r="34" fill="#ffffff" opacity="0.10"/>
    <circle cx="76" cy="22" r="24" fill="#ffffff" opacity="0.12"/>
    <text x="48" y="58" font-family="Inter,system-ui,sans-serif" font-size="38" font-weight="700"
          fill="#ffffff" text-anchor="middle" opacity="0.92">${initial}</text>
  </svg>`);

/** 글에 붙일 그림 — 풍경 느낌의 도형. 사진 대신 쓰되 사진 자리를 그대로 채웁니다. */
const scene = (top, bottom, accent) => svgUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
    <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>
    </linearGradient></defs>
    <rect width="640" height="360" fill="url(#s)"/>
    <circle cx="512" cy="86" r="42" fill="#ffffff" opacity="0.55"/>
    <path d="M0 268 L150 176 L268 268 L360 214 L470 300 L640 208 L640 360 L0 360 Z" fill="${accent}" opacity="0.85"/>
    <path d="M0 306 L190 232 L330 306 L470 254 L640 320 L640 360 L0 360 Z" fill="${accent}" opacity="0.55"/>
  </svg>`);

const PEOPLE = [
  { email: "yuna@example.com", name: "유나", city: "부산", country: "KR", native: ["ko"], learn: [{ code: "en", level: "intermediate", goal: "면접에서 막힘 없이 말하기" }],
    bio: "부산에서 마케팅 일을 해요. 퇴근하고 30분씩 영어로 이야기할 사람을 찾고 있어요.",
    interests: ["travel", "movies", "coffee"], availability: ["weekday-evening"], avatar: avatar("유", "#7C5CFF", "#B08BFF") },
  { email: "haruto@example.com", name: "Haruto", city: "오사카", country: "JP", native: ["ja"], learn: [{ code: "ko", level: "beginner", goal: "드라마를 자막 없이 보기" }],
    bio: "한국 드라마를 좋아해서 한국어를 배우기 시작했어요. 아직 서툴지만 천천히 이야기해요.",
    interests: ["movies", "music", "food"], availability: ["weekend-morning"], avatar: avatar("H", "#FF7A59", "#FFB199") },
  { email: "emma@example.com", name: "Emma", city: "런던", country: "GB", native: ["en"], learn: [{ code: "ko", level: "intermediate", goal: "한국 여행에서 혼자 다니기" }],
    bio: "Teacher in London. I lived in Seoul for a year and I miss speaking Korean every day.",
    interests: ["books", "travel", "coffee"], availability: ["weekday-evening"], avatar: avatar("E", "#2BB673", "#7BE0AE") },
  { email: "mateo@example.com", name: "Mateo", city: "마드리드", country: "ES", native: ["es"], learn: [{ code: "en", level: "advanced", goal: "회의에서 자연스럽게 끼어들기" }],
    bio: "Software engineer. Happy to trade Spanish for English — I can explain grammar without being boring.",
    interests: ["technology", "football", "cooking"], availability: ["weekday-morning"], avatar: avatar("M", "#F2A93B", "#FFD08A") },
  { email: "sena@example.com", name: "세나", city: "서울", country: "KR", native: ["ko"], learn: [{ code: "ja", level: "beginner", goal: "일본 친구와 문자로 대화하기" }],
    bio: "일본어는 히라가나부터 다시 시작했어요. 매일 한 문장씩 써보려고 해요.",
    interests: ["music", "art", "food"], availability: ["weekend-evening"], avatar: avatar("세", "#4C8DFF", "#96BFFF") },
  { email: "linh@example.com", name: "Linh", city: "하노이", country: "VN", native: ["vi"], learn: [{ code: "ko", level: "intermediate", goal: "한국 회사에서 일하기" }],
    bio: "하노이에서 한국어를 공부하고 있어요. 존댓말이 아직 어려워요. 편하게 고쳐주세요.",
    interests: ["cooking", "travel", "books"], availability: ["weekday-evening"], avatar: avatar("L", "#E45A92", "#FF9EC4") },
];

const POSTS = [
  { by: 0, text: "어제 면접 연습을 했는데 \"제 강점은 꼼꼼함입니다\" 를 영어로 어떻게 말하는지 모르겠어요.\n\"I'm a detail-oriented person\" 이 자연스러운가요?", tags: ["표현질문"], correction: true },
  { by: 1, text: "오늘 처음으로 한국 카페에서 한국어로 주문했어요!\n\"아이스 아메리카노 한 잔 주세요\" 라고 했는데 통했어요. 조금 뿌듯했습니다.", tags: ["오늘의연습"], correction: true, image: scene("#1B2A4A", "#3E5C8C", "#0F1B33") },
  { by: 2, text: "Korean word order still breaks my brain. I keep saying \"저는 커피 좋아요 마셔요\" 😅\nAny trick for remembering the verb goes last?", tags: ["문법질문"], correction: true },
  { by: 3, text: "Made 김치찌개 for the first time today. My Korean flatmate said it was \"괜찮아\" which I have learned means it was not good.", tags: ["음식"], correction: false, image: scene("#3A1E24", "#7A3B3B", "#241318") },
  { by: 4, text: "일본어 공부 3일차. 오늘 배운 문장:\n「はじめまして、セナです。よろしくおねがいします。」\n발음이 아직 어색해요.", tags: ["오늘의연습"], correction: true, image: scene("#2C2140", "#5A4478", "#1B1428") },
  { by: 5, text: "존댓말과 반말을 언제 바꿔야 하는지 아직도 헷갈려요.\n처음 만난 사람에게는 무조건 존댓말이 맞나요?", tags: ["문법질문"], correction: true },
  { by: 2, text: "Watched a Korean film without subtitles for the first time. I understood maybe 30% but that is 30% more than last year.", tags: ["영화"], correction: false, image: scene("#20304A", "#4E6B96", "#16202F") },
  { by: 0, text: "출근길에 팟캐스트를 들으면서 따라 말해봤어요. 입이 안 따라가는데 계속하면 나아지겠죠?", tags: ["일상"], correction: false },
  { by: 5, text: "한국 친구가 \"밥 먹었어요?\" 라고 물어봤는데, 진짜 밥을 물어본 게 아니라 인사였다는 걸 나중에 알았어요.", tags: ["일상"], correction: false },
  { by: 3, text: "Is there a difference between 매우 and 아주? My textbook uses both and I cannot tell when to pick which.", tags: ["표현질문"], correction: true },
];

const REPLIES = [
  { post: 0, by: 2, text: "\"Detail-oriented\" works, but in an interview I'd say \"I pay close attention to the details\" — it sounds less like a résumé.", kind: "reply" },
  { post: 2, by: 0, text: "저는 \"주어 - 목적어 - 동사\" 순서라고 외웠어요. 커피를(목적어) 마셔요(동사)!", kind: "reply" },
  { post: 4, by: 1, text: "はじめまして、いい発音です！「よろしくおねがいします」は少しゆっくり言うと自然です。", kind: "reply" },
  { post: 5, by: 0, text: "처음 만난 사이면 존댓말이 안전해요. 상대가 \"말 편하게 해요\" 라고 하면 그때 바꾸면 돼요.", kind: "reply" },
  { post: 9, by: 4, text: "아주가 더 일상적이에요. 매우는 글이나 발표에서 많이 쓰고, 말할 때는 아주/정말을 더 써요.", kind: "reply" },
];

const CHATS = [
  { with: 0, lines: [[0, "안녕하세요! 프로필 보고 연락드렸어요. 저도 퇴근 후에 연습하고 있어요."], [1, "반가워요! 어떤 걸 주로 연습하세요?"], [0, "요즘은 면접 준비 중이에요. 영어로 자기소개 하는 게 제일 어렵네요."]] },
  { with: 2, lines: [[0, "Hi Emma! I saw you lived in Seoul — which neighbourhood?"], [1, "연남동! 카페가 너무 많아서 매일 다른 곳에 갔어요."], [0, "연남동 좋죠. 저도 주말마다 가요."]] },
];

const jar = new Map();
async function call(email, path, init = {}) {
  const cookie = jar.get(email);
  const response = await fetch(API + path, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      origin: process.env.APP_ORIGIN || "http://localhost:5174",
      // 서버는 웹 프록시를 거친 요청만 받습니다. 이 스크립트도 같은 열쇠를 씁니다.
      "x-lingoloop-proxy": process.env.PROXY_SHARED_SECRET || "",
      ...(init.headers || {}),
    },
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) jar.set(email, setCookie.split(";")[0]);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} → ${response.status} ${JSON.stringify(body.error || body).slice(0, 160)}`);
  return body.data;
}

async function signIn(person) {
  try {
    return await call(person.email, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: person.email, password: PASSWORD, name: person.name }),
    });
  } catch {
    return await call(person.email, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: person.email, password: PASSWORD }),
    });
  }
}

const ids = [];
console.log("■ 사람 만들기");
for (const person of PEOPLE) {
  await signIn(person);
  const saved = await call(person.email, "/api/profile", {
    method: "PATCH",
    body: JSON.stringify({
      name: person.name,
      bio: person.bio,
      city: person.city,
      countryCode: person.country,
      nativeLanguages: person.native,
      learningLanguages: person.learn,
      interests: person.interests,
      availability: person.availability,
      avatarUrl: person.avatar,
      hideLocation: false,
    }),
  });
  ids.push(saved.id);
  console.log(`   ${person.name} · ${person.city} · ${saved.handle}`);
}

console.log("■ 글 올리기");
const postIds = [];
for (const item of POSTS) {
  const person = PEOPLE[item.by];
  const saved = await call(person.email, "/api/posts", {
    method: "POST",
    body: JSON.stringify({
      text: item.text,
      language: person.native[0],
      targetLanguage: person.learn[0].code,
      tags: item.tags,
      visibility: "public",
      requestCorrection: item.correction,
      ...(item.image ? { imageUrl: item.image } : {}),
    }),
  });
  postIds.push(saved.id);
}
console.log(`   ${postIds.length}개`);

console.log("■ 댓글 달기");
for (const reply of REPLIES) {
  await call(PEOPLE[reply.by].email, `/api/posts/${postIds[reply.post]}/replies`, {
    method: "POST",
    body: JSON.stringify({ text: reply.text, kind: reply.kind }),
  });
}
console.log(`   ${REPLIES.length}개`);

console.log("■ 좋아요 · 팔로우 · 마음");
let reactions = 0;
for (let index = 0; index < postIds.length; index += 1) {
  for (const person of PEOPLE.filter((_, at) => (at + index) % 3 === 0)) {
    if (PEOPLE[POSTS[index].by].email === person.email) continue;
    await call(person.email, `/api/posts/${postIds[index]}/like`, { method: "POST" });
    reactions += 1;
  }
}
for (let index = 0; index < PEOPLE.length; index += 1) {
  const next = ids[(index + 1) % ids.length];
  await call(PEOPLE[index].email, `/api/partners/${next}/follow`, { method: "POST" });
  await call(PEOPLE[index].email, `/api/partners/${next}/like`, { method: "POST" });
}
console.log(`   좋아요 ${reactions} · 팔로우/마음 ${PEOPLE.length}쌍`);

console.log("■ 대화 만들기");
for (const chat of CHATS) {
  const a = PEOPLE[chat.with];
  const b = PEOPLE[(chat.with + 2) % PEOPLE.length];
  const partnerId = ids[(chat.with + 2) % ids.length];
  const room = await call(a.email, "/api/conversations", { method: "POST", body: JSON.stringify({ partnerId }) });
  // 두 번 돌려도 대화가 겹치지 않게 — 이미 말이 오간 방이면 건너뜁니다.
  const existing = await call(a.email, `/api/conversations/${room.id}/messages`).catch(() => []);
  if (existing.length) { console.log(`   이미 있음 — 건너뜀 (${existing.length}개)`); continue; }
  // 첫 메시지를 보내고 상대가 요청을 수락한 뒤에야 대화가 이어집니다(DM 정책).
  // 실제 사용자가 거치는 순서를 그대로 따릅니다 — 규칙을 우회하면 진짜와 다른 데이터가 됩니다.
  const [firstSide, firstText] = chat.lines[0];
  await call((firstSide === 0 ? a : b).email, `/api/conversations/${room.id}/messages`, { method: "POST", body: JSON.stringify({ text: firstText }) });
  await call(b.email, `/api/conversations/${room.id}/accept`, { method: "POST", body: "{}" }).catch(() => {});
  for (const [side, text] of chat.lines.slice(1)) {
    const who = side === 0 ? a : b;
    await call(who.email, `/api/conversations/${room.id}/messages`, { method: "POST", body: JSON.stringify({ text }) });
  }
}
console.log(`   ${CHATS.length}개`);

console.log("\n다 됐습니다. 로그인해서 보세요:");
for (const person of PEOPLE) console.log(`   ${person.email} / ${PASSWORD}`);
