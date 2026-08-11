import assert from "node:assert/strict";
import test from "node:test";

const expectedTitle =
  "LingoLoop — 함께 말하고, 함께 배우는 언어 교환 | LingoLoop";
const expectedDescription =
  "파트너 매칭, 커뮤니티 교정, 학습형 채팅과 음성 라운지를 경험하는 반응형 언어 교환 서비스 데모입니다.";

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

async function fetchApp(path = "/", init = {}) {
  const worker = await loadWorker();
  return worker.fetch(
    new Request(new URL(path, "http://lingoloop.test"), init),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

function assertCommonApiHeaders(response, requestId) {
  assert.match(
    response.headers.get("content-type") ?? "",
    /^application\/json\b/i,
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal(response.headers.get("x-request-id"), requestId);
}

function assertMeta(meta, requestId) {
  assert.equal(meta.requestId, requestId);
  assert.equal(meta.mock, true);
  assert.equal(typeof meta.timestamp, "string");
  assert.ok(Number.isFinite(Date.parse(meta.timestamp)), "meta.timestamp must be an ISO date");
}

test("server-renders the LingoLoop product metadata and responsive application shell", async () => {
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

  assert.match(html, /<a class="skip-link" href="#main-content">본문으로 건너뛰기<\/a>/);
  assert.match(html, /<aside class="desktop-sidebar" aria-label="주요 메뉴">/);
  assert.match(html, /<main id="main-content" class="main-content">/);
  assert.match(html, /<aside class="right-rail" aria-label="학습 컨텍스트">/);
  assert.match(html, /<nav class="mobile-nav" aria-label="모바일 주요 메뉴">/);
  assert.match(html, /aria-label="오늘의 매칭 요약"/);
  assert.match(html, /aria-label="추천 언어 파트너"/);
  assert.match(html, /배우는 만큼,/);
  assert.match(html, /가르치며 가까워져요\./);
  assert.match(
    html,
    /class="api-indicator api-(?:ready|checking|offline)" title="mock API 상태"/,
  );
  assert.match(html, /Mock API 연결됨|연결 확인 중|오프라인 데모/);
});

test("removes every starter-preview marker from the rendered product", async () => {
  const response = await fetchApp("/", {
    headers: { accept: "text/html" },
  });
  const html = await response.text();

  assert.doesNotMatch(
    html,
    /Starter Project|Your site is taking shape|Building your site|react-loading-skeleton|codex-preview|_sites-preview|SkeletonPreview/i,
  );
});

test("mock API health endpoint returns the versioned success envelope", async () => {
  const requestId = "health-contract-test";
  const response = await fetchApp("/api/health", {
    headers: { "x-request-id": requestId },
  });

  assert.equal(response.status, 200);
  assertCommonApiHeaders(response, requestId);

  const body = await response.json();
  assert.deepEqual(body.data, {
    service: "language-exchange-mock-api",
    version: "0.1.0",
    status: "ok",
    environment: "mock",
    uptime: "stateless-worker",
  });
  assertMeta(body.meta, requestId);
});

test("mock API list endpoint paginates its stable partner collection", async () => {
  const requestId = "partners-contract-test";
  const response = await fetchApp("/api/partners?cursor=0&limit=2", {
    headers: { "x-request-id": requestId },
  });

  assert.equal(response.status, 200);
  assertCommonApiHeaders(response, requestId);

  const body = await response.json();
  assert.equal(body.data.length, 2);
  assert.deepEqual(
    body.data.map(({ id, name }) => ({ id, name })),
    [
      { id: "user-maya", name: "Maya" },
      { id: "user-ren", name: "Ren" },
    ],
  );
  assert.deepEqual(body.meta.pagination, {
    cursor: 0,
    limit: 2,
    nextCursor: "2",
    total: 5,
  });
  assertMeta(body.meta, requestId);
});

test("mock API creates a normalized chat message without persistence", async () => {
  const requestId = "message-contract-test";
  const response = await fetchApp("/api/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
    },
    body: JSON.stringify({
      conversationId: "conversation-maya",
      text: "  Nice to meet you!  ",
    }),
  });

  assert.equal(response.status, 201);
  assertCommonApiHeaders(response, requestId);

  const body = await response.json();
  assert.equal(body.data.conversationId, "conversation-maya");
  assert.match(body.data.message.id, /^msg-[0-9a-f-]{36}$/i);
  assert.deepEqual(
    {
      senderId: body.data.message.senderId,
      type: body.data.message.type,
      text: body.data.message.text,
      status: body.data.message.status,
    },
    {
      senderId: "user-me",
      type: "text",
      text: "Nice to meet you!",
      status: "sent",
    },
  );
  assert.ok(Number.isFinite(Date.parse(body.data.message.sentAt)));
  assertMeta(body.meta, requestId);
});

test("mock API accepts a safety report with the documented receipt", async () => {
  const requestId = "report-contract-test";
  const response = await fetchApp("/api/reports", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
    },
    body: JSON.stringify({
      targetType: "user",
      targetId: "user-example",
      reason: "spam",
      details: "  반복 홍보 메시지  ",
    }),
  });

  assert.equal(response.status, 201);
  assertCommonApiHeaders(response, requestId);

  const body = await response.json();
  assert.match(body.data.id, /^report-[0-9a-f-]{36}$/i);
  assert.equal(body.data.targetType, "user");
  assert.equal(body.data.targetId, "user-example");
  assert.equal(body.data.reason, "spam");
  assert.equal(body.data.details, "반복 홍보 메시지");
  assert.equal(body.data.status, "received");
  assert.match(body.data.safetyMessage, /신고가 접수되었습니다/);
  assertMeta(body.meta, requestId);
});

test("mock API returns structured errors for invalid routes, methods, and payloads", async (t) => {
  await t.test("unknown route", async () => {
    const requestId = "not-found-contract-test";
    const response = await fetchApp("/api/not-a-route", {
      headers: { "x-request-id": requestId },
    });
    assert.equal(response.status, 404);
    assertCommonApiHeaders(response, requestId);
    const body = await response.json();
    assert.equal(body.error.code, "NOT_FOUND");
    assert.match(body.error.message, /API 경로를 찾을 수 없습니다/);
    assertMeta(body.meta, requestId);
  });

  await t.test("unsupported method", async () => {
    const requestId = "method-contract-test";
    const response = await fetchApp("/api/partners", {
      method: "POST",
      headers: { "x-request-id": requestId },
    });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET");
    assertCommonApiHeaders(response, requestId);
    const body = await response.json();
    assert.equal(body.error.code, "METHOD_NOT_ALLOWED");
    assert.deepEqual(body.error.details, { allowed: ["GET"] });
    assertMeta(body.meta, requestId);
  });

  await t.test("invalid message payload", async () => {
    const requestId = "validation-contract-test";
    const response = await fetchApp("/api/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({ conversationId: "conversation-maya", text: "" }),
    });
    assert.equal(response.status, 422);
    assertCommonApiHeaders(response, requestId);
    const body = await response.json();
    assert.equal(body.error.code, "VALIDATION_ERROR");
    assert.deepEqual(body.error.details, { field: "text" });
    assertMeta(body.meta, requestId);
  });
});

test("mock API answers CORS preflight requests without a response body", async () => {
  const requestId = "cors-contract-test";
  const response = await fetchApp("/api/messages", {
    method: "OPTIONS",
    headers: {
      origin: "https://mobile.lingoloop.example",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type,x-request-id",
      "x-request-id": requestId,
    },
  });

  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal(
    response.headers.get("access-control-allow-methods"),
    "GET, POST, OPTIONS",
  );
  assert.equal(
    response.headers.get("access-control-allow-headers"),
    "Content-Type, Authorization, X-Request-ID",
  );
  assert.equal(
    response.headers.get("access-control-expose-headers"),
    "X-Request-ID",
  );
  assert.equal(response.headers.get("access-control-max-age"), "86400");
  assert.equal(response.headers.get("x-request-id"), requestId);
});
