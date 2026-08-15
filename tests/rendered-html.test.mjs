import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

function assertNonEmptyStringArray(value, label) {
  assert.ok(Array.isArray(value), `${label} must be an array`);
  assert.ok(value.length > 0, `${label} must not be empty`);
  assert.ok(
    value.every((item) => typeof item === "string" && item.length > 0),
    `${label} must contain non-empty strings`,
  );
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
  assert.match(html, /<nav class="mobile-nav" aria-label="모바일 주요 메뉴">/);
  assert.match(html, /조건 바꾸기/);
  assert.match(html, /오늘의 파트너/);
  assert.doesNotMatch(
    html,
    /유료|Loop Plus|\bVIP\b|안전한 메시지 요청함|오늘 배운 표현/i,
  );
  assert.match(
    html,
    /class="api-indicator api-(?:ready|checking|offline)" title="mock API 상태"/,
  );
  assert.match(html, /Mock API 연결됨|연결 확인 중|오프라인 데모/);
});

test("keeps conditional core entry points and removes paid or legacy product copy", async () => {
  const source = await readFile(
    new URL("../app/components/LingoLoopApp.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /보이스룸 만들기/);
  assert.match(source, /프로필 설정/);
  assert.doesNotMatch(
    source,
    /유료|Loop Plus|\bVIP\b|안전한 메시지 요청함|오늘 배운 표현/i,
  );
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
    total: 6,
  });
  assertMeta(body.meta, requestId);
});

test("mock API exposes and updates matching preferences as a non-persistent mock", async (t) => {
  await t.test("gets the current preferences", async () => {
    const requestId = "matching-preferences-get-test";
    const response = await fetchApp("/api/matching/preferences", {
      headers: { "x-request-id": requestId },
    });

    assert.equal(response.status, 200);
    assertCommonApiHeaders(response, requestId);

    const body = await response.json();
    assert.deepEqual(Object.keys(body.data).sort(), [
      "nextRefreshAt",
      "persisted",
      "preferences",
    ]);
    assert.deepEqual(Object.keys(body.data.preferences).sort(), [
      "availability",
      "interests",
      "onlineOnly",
      "partnerLevel",
      "preferredCountries",
      "targetLanguages",
    ]);
    assertNonEmptyStringArray(
      body.data.preferences.targetLanguages,
      "preferences.targetLanguages",
    );
    assert.ok(Array.isArray(body.data.preferences.preferredCountries));
    assert.ok(Array.isArray(body.data.preferences.interests));
    assert.ok(Array.isArray(body.data.preferences.availability));
    assert.ok(
      body.data.preferences.availability.every((item) =>
        /^(?:weekday|weekend)-(?:morning|evening)$/.test(item),
      ),
    );
    assert.match(
      body.data.preferences.partnerLevel,
      /^(?:any|beginner|intermediate|advanced)$/,
    );
    assert.equal(typeof body.data.preferences.onlineOnly, "boolean");
    assert.equal(body.data.persisted, false);
    assert.ok(Number.isFinite(Date.parse(body.data.nextRefreshAt)));
    assertMeta(body.meta, requestId);
  });

  await t.test("returns normalized preferences after an update", async () => {
    const requestId = "matching-preferences-post-test";
    const preferences = {
      targetLanguages: ["en", "ja"],
      preferredCountries: ["US", "JP"],
      interests: ["travel", "music"],
      availability: ["weekday-evening"],
      partnerLevel: "intermediate",
      onlineOnly: true,
    };
    const response = await fetchApp("/api/matching/preferences", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify(preferences),
    });

    assert.equal(response.status, 200);
    assertCommonApiHeaders(response, requestId);

    const body = await response.json();
    assert.deepEqual(body.data.preferences, preferences);
    assert.equal(body.data.persisted, false);
    assert.ok(Number.isFinite(Date.parse(body.data.nextRefreshAt)));
    assertMeta(body.meta, requestId);
  });

  await t.test("rejects an empty target language selection", async () => {
    const requestId = "matching-preferences-validation-test";
    const response = await fetchApp("/api/matching/preferences", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({ targetLanguages: [] }),
    });

    assert.equal(response.status, 422);
    assertCommonApiHeaders(response, requestId);
    const body = await response.json();
    assert.equal(body.error.code, "VALIDATION_ERROR");
    assert.equal(body.error.details.field, "targetLanguages");
    assertMeta(body.meta, requestId);
  });
});

test("mock API returns one deterministic dated match and rejects invalid dates", async (t) => {
  const conditions =
    "targetLanguages=en,ja&preferredCountries=US,JP,CA&interests=design,coffee,travel&availability=weekday-evening,weekend-morning&partnerLevel=any&onlineOnly=false";
  const dailyPath = (date) =>
    `/api/matching/daily?date=${date}&${conditions}`;

  await t.test("returns the same explained partner for the same date and conditions", async () => {
    const requestIds = ["daily-matching-first-test", "daily-matching-repeat-test"];
    const responses = await Promise.all(
      requestIds.map((requestId) =>
        fetchApp(dailyPath("2026-08-11"), {
          headers: { "x-request-id": requestId },
        }),
      ),
    );

    const bodies = [];
    for (const [index, response] of responses.entries()) {
      assert.equal(response.status, 200);
      assertCommonApiHeaders(response, requestIds[index]);
      const body = await response.json();
      assert.equal(body.data.date, "2026-08-11");
      assert.equal(body.data.recommendations.length, 1);
      const [recommendation] = body.data.recommendations;
      assert.equal(typeof recommendation.partner?.id, "string");
      assert.equal(typeof recommendation.partner?.name, "string");
      assert.equal(typeof recommendation.score, "number");
      assert.ok(recommendation.score >= 0 && recommendation.score <= 100);
      assertNonEmptyStringArray(
        recommendation.matchReasons,
        "recommendation.matchReasons",
      );
      assert.equal(typeof recommendation.icebreaker, "string");
      assert.ok(recommendation.icebreaker.length > 0);
      assert.equal(typeof body.data.preferencesApplied, "object");
      assertNonEmptyStringArray(
        body.data.preferencesApplied.targetLanguages,
        "preferencesApplied.targetLanguages",
      );
      assert.ok(Array.isArray(body.data.preferencesApplied.availability));
      assert.ok(Number.isFinite(Date.parse(body.data.nextRefreshAt)));
      assertMeta(body.meta, requestIds[index]);
      bodies.push(body);
    }

    assert.deepEqual(
      bodies[1].data.recommendations,
      bodies[0].data.recommendations,
    );
    assert.deepEqual(
      bodies[1].data.preferencesApplied,
      bodies[0].data.preferencesApplied,
    );
  });

  await t.test("rotates the deterministic partner across dates when candidates exist", async () => {
    const dates = [
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
      "2026-08-16",
      "2026-08-17",
      "2026-08-18",
    ];
    const partnerIds = [];

    for (const [index, date] of dates.entries()) {
      const requestId = `daily-matching-rotation-${index}`;
      const response = await fetchApp(dailyPath(date), {
        headers: { "x-request-id": requestId },
      });
      assert.equal(response.status, 200);
      assertCommonApiHeaders(response, requestId);
      const body = await response.json();
      assert.equal(body.data.date, date);
      assert.equal(body.data.recommendations.length, 1);
      partnerIds.push(body.data.recommendations[0].partner.id);
      assertMeta(body.meta, requestId);
    }

    assert.ok(
      new Set(partnerIds).size > 1,
      "different dates should rotate among eligible deterministic partners",
    );
  });

  await t.test("rejects a non-existent calendar date", async () => {
    const requestId = "daily-matching-validation-test";
    const response = await fetchApp("/api/matching/daily?date=2026-02-30", {
      headers: { "x-request-id": requestId },
    });

    assert.equal(response.status, 400);
    assertCommonApiHeaders(response, requestId);
    const body = await response.json();
    assert.equal(body.error.code, "INVALID_DATE");
    assertMeta(body.meta, requestId);
  });
});

test("mock API coaches a conversation and validates its stage", async (t) => {
  await t.test("returns topics, openers, and follow-up questions", async () => {
    const requestId = "conversation-support-post-test";
    const response = await fetchApp("/api/conversation-support", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({
        partnerId: "user-maya",
        stage: "first-message",
        draft: "Nice to meet you. I like design too!",
      }),
    });

    assert.equal(response.status, 200);
    assertCommonApiHeaders(response, requestId);
    const body = await response.json();
    assert.equal(body.data.partner.id, "user-maya");
    assert.equal(body.data.stage, "first-message");
    assert.equal(body.data.topics.length, 3);
    assert.equal(body.data.suggestedOpeners.length, 3);
    assert.equal(body.data.followUpQuestions.length, 3);
    assertNonEmptyStringArray(body.data.topics, "conversation-support.topics");
    assertNonEmptyStringArray(
      body.data.suggestedOpeners,
      "conversation-support.suggestedOpeners",
    );
    assertNonEmptyStringArray(
      body.data.followUpQuestions,
      "conversation-support.followUpQuestions",
    );
    assert.equal(typeof body.data.improvedDraft, "string");
    assert.ok(body.data.improvedDraft.length > 0);
    if (body.data.translation !== undefined) {
      assert.equal(typeof body.data.translation.language, "string");
      assert.equal(typeof body.data.translation.text, "string");
    }
    assert.equal(typeof body.data.tip, "string");
    assert.ok(body.data.tip.length > 0);
    assertMeta(body.meta, requestId);
  });

  await t.test("rejects an unknown conversation stage", async () => {
    const requestId = "conversation-support-validation-test";
    const response = await fetchApp("/api/conversation-support", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({
        partnerId: "user-maya",
        stage: "awkward-silence",
      }),
    });

    assert.equal(response.status, 422);
    assertCommonApiHeaders(response, requestId);
    const body = await response.json();
    assert.equal(body.error.code, "VALIDATION_ERROR");
    assert.equal(body.error.details.field, "stage");
    assertMeta(body.meta, requestId);
  });
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
