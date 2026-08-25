import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const expectedTitle =
  "LingoLoop — 함께 말하고, 함께 배우는 언어 교환 | LingoLoop";
const expectedDescription =
  "Firebase Identity Platform 인증과 Firestore 영구 저장으로 파트너 매칭, 커뮤니티와 대화를 이어가는 언어 교환 서비스입니다.";

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
  assert.match(html, /안전한 로그인 상태를 확인하고 있어요\./);
  assert.doesNotMatch(html, /Mock API 연결됨|오프라인 데모|웹 mock|mock API 프로토타입/i);
});

test("운영 화면 진입점은 fixture 기반 앱 대신 Production 앱을 사용한다", async () => {
  const [page, productionApp] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/components/ProductionLingoLoopApp.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(page, /import ProductionLingoLoopApp from/);
  assert.match(page, /return <ProductionLingoLoopApp \/>/);
  assert.doesNotMatch(page, /import LingoLoopApp from/);
  assert.match(productionApp, /\/api\/auth\/me/);
  assert.match(productionApp, /\/api\/auth\/register/);
  assert.match(productionApp, /\/api\/auth\/login/);
  assert.doesNotMatch(productionApp, /demo-data|initialPosts|initialConversations/);
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
