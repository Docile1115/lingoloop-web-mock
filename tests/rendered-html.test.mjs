import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { SITE_METADATA } from "../app/lib/i18n/metadata.ts";

// 요청에 Accept-Language 가 없으면 서버는 ko 로 그립니다.
// 페이지가 제목을 따로 정하지 않으므로 layout 의 default 가 그대로 쓰입니다
// (template "%s | LingoLoop" 은 하위 페이지가 제목을 줄 때만 붙습니다).
const expectedTitle = SITE_METADATA.ko.title;
const expectedDescription = SITE_METADATA.ko.description;

let workerPromise;

function loadWorker() {
  workerPromise ??= import(
    new URL(
      `../dist/server/index.js?test=${process.pid}-${Date.now()}`,
      import.meta.url,
    ).href
  ).then(({ default: worker }) => worker);
  return workerPromise;
}

async function fetchApp(path = "/", init = {}, bindings = {}) {
  const worker = await loadWorker();
  return worker.fetch(
    new Request(new URL(path, "http://lingoloop.test"), init),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      ...bindings,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("운영 메타데이터와 인증 확인 화면을 서버 렌더링한다", async () => {
  const response = await fetchApp("/", {
    headers: { accept: "text/html" },
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*\blang="ko"/i);
  assert.ok(html.includes(`<title>${expectedTitle}</title>`));
  assert.ok(
    html.includes(`<meta name="description" content="${expectedDescription}"`),
  );
  assert.match(
    html,
    /<meta(?=[^>]*\bname="application-name")(?=[^>]*\bcontent="LingoLoop")[^>]*>/i,
  );
  assert.match(html, /LingoLoop/);
  assert.match(html, /로그인 상태를 확인하고 있어요\./);
  assert.doesNotMatch(html, /Mock API 연결됨|오프라인 데모|웹 mock|mock API 프로토타입/i);
});

test("운영 화면은 원래 디자인을 쓰고 데이터는 서버에서 온다", async () => {
  // 화면은 오래 다듬어 온 LingoLoopApp 을 그대로 쓰고, fixture 대신 서버를 봅니다.
  // 디자인과 데이터 출처는 따로 정할 수 있는 문제라 둘을 함께 고정합니다.
  const [page, app, adapter, signIn, socialAuth] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/LingoLoopApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/live-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/SignIn.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/social-auth.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /import LingoLoopApp from/);
  assert.match(page, /return <LingoLoopApp \/>/);
  assert.doesNotMatch(page, /ProductionLingoLoopApp/);

  // 로그인을 거쳐야 안쪽 화면이 나옵니다.
  assert.match(app, /"\/api\/auth\/me"/);
  assert.match(app, /<AuthGate \/>/);
  assert.match(signIn, /"\/api\/auth\/config"/);
  assert.match(signIn, /"\/api\/auth\/session"/);
  assert.match(signIn, /getSocialIdToken/);
  assert.match(socialAuth, /signInWithPopup/);
  assert.match(socialAuth, /inMemoryPersistence/);
  assert.match(socialAuth, /signOut\(auth\)/);

  // 목록은 fixture 가 아니라 서버에서 받습니다.
  for (const route of ["/api/posts", "/api/conversations", "/api/saved-phrases", "/api/corrections/received"]) {
    assert.ok(app.includes(`"${route}"`) || app.includes(`\`${route}`), `${route} 를 불러와야 합니다`);
  }
  assert.doesNotMatch(app, /useState<FeedPost\[\]>\(initialPosts\)/);
  assert.doesNotMatch(app, /useState<Conversation\[\]>\(initialConversations\)/);

  // 서버에 없는 값(색·시차)은 어댑터에서만 만듭니다.
  assert.match(adapter, /export function toPartner/);
  assert.match(adapter, /export function toFeedPost/);
});

test("API 프록시는 설정이 없을 때 mock으로 후퇴하지 않고 닫힌 상태로 실패한다", async () => {
  const response = await fetchApp("/api/health", {
    headers: { accept: "application/json" },
  });

  assert.equal(response.status, 503);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^application\/json\b/i,
  );
  assert.equal(response.headers.get("cache-control"), "no-store");

  const payload = await response.json();
  assert.equal(payload.error.code, "API_NOT_CONFIGURED");
  assert.equal(payload.meta.mock, false);
  assert.equal(payload.meta.persistent, false);
  assert.ok(Number.isFinite(Date.parse(payload.meta.timestamp)));
});

test("웹 Worker는 same-origin 요청을 운영 API로만 전달한다", async () => {
  const source = await readFile(
    new URL("../worker/index.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /LINGOLOOP_API_URL/);
  assert.match(source, /PROXY_SHARED_SECRET/);
  assert.match(source, /headers\.set\("x-lingoloop-proxy", proxySecret\)/);
  assert.match(source, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.doesNotMatch(source, /handleMockApi|\.\.\/mock-api/);
});

test("운영 API는 Identity Platform 세션과 Firestore 영속 경계를 선언한다", async () => {
  const source = await readFile(
    new URL("../backend/server.mjs", import.meta.url),
    "utf8",
  );

  assert.match(source, /applicationDefault\(\)/);
  assert.match(source, /auth\.createSessionCookie/);
  assert.match(source, /auth\.verifySessionCookie/);
  assert.match(source, /app\.post\("\/api\/auth\/session"/);
  assert.match(source, /verifyRecentIdToken/);
  assert.match(source, /httpOnly: true/);
  assert.match(source, /secure: COOKIE_SECURE/);
  assert.match(source, /sameSite: "lax"/);
  assert.match(source, /mock: false/);
  assert.match(source, /persistent: true/);

  for (const collection of [
    "profiles",
    "matchingPreferences",
    "dailyMatches",
    "likes",
    "follows",
    "posts",
    "reactions",
    "conversations",
    "messages",
    "dmPolicies",
    "reports",
    "aiUsage",
    "blocks",
    "replies",
    "savedPhrases",
  ]) {
    assert.match(source, new RegExp(`collection\\("${collection}"\\)`));
  }

  for (const route of [
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/me",
    "/api/profile",
    "/api/matching/daily",
    "/api/posts",
    "/api/conversations",
    "/api/conversations/:conversationId/accept",
    "/api/reports",
    "/api/blocks",
    "/api/posts/:postId/replies",
    "/api/saved-phrases",
    "/api/corrections/received",
    "/api/likes/received",
    "/api/countries",
    "/api/partners/:partnerId/block",
  ]) {
    assert.ok(source.includes(`"${route}"`), `${route} 운영 route가 필요합니다`);
  }
});

test("Gemini AI는 운영 API와 실제 대화 UI에 연결된다", async () => {
  const [backend, productionApp, backendDockerfile] = await Promise.all([
    readFile(new URL("../backend/server.mjs", import.meta.url), "utf8"),
    readFile(
      new URL("../app/components/ProductionLingoLoopApp.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../backend/Dockerfile", import.meta.url), "utf8"),
  ]);

  assert.match(backend, /GEMINI_MODEL = process\.env\.GEMINI_MODEL \|\| "gemini-2\.5-flash-lite"/);
  assert.match(backend, /AI_NOT_CONFIGURED/);
  assert.match(backend, /generateGeminiContent/);
  assert.match(backend, /aiplatform\.googleapis\.com/);
  assert.match(backend, /google-vertex-ai/);
  assert.match(backendDockerfile, /gemini\.mjs/);
  assert.match(backend, /responseJsonSchema/);
  assert.match(backend, /AI_TRANSLATION_DAILY_LIMIT/);
  assert.match(backend, /AI_SUPPORT_DAILY_LIMIT/);
  assert.match(backend, /collection\("aiUsage"\)/);
  assert.match(productionApp, /"\/api\/translate"/);
  assert.match(productionApp, /"\/api\/conversation-support"/);
  assert.match(productionApp, /AI 대화 도움/);
  assert.doesNotMatch(backend, /api\.openai\.com|OPENAI_API_KEY|gpt-5-nano|handleMockApi|translationFree|mock translation/i);
});
