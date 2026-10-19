import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import test from "node:test";
import express from "express";
import {
  MAX_DEVICES_PER_USER,
  buildPushMessages,
  createPushDelivery,
  isExpoPushToken,
  pushLocale,
  pushText,
  pushTokenId,
  registerPushRoutes,
  sendExpoPush,
} from "../push.mjs";
import { buildNotification } from "../notifications.mjs";

const AT = "2026-10-19T03:00:00.000Z";
const token = (name) => `ExponentPushToken[${name.padEnd(10, "x")}]`;
const notify = (event) => buildNotification({ eventId: "event-1", createdAt: AT, excerpt: "", ...event });

/** pushTokens 만 흉내 내는 메모리 Firestore: doc get·set·delete 와 where(==)·limit 조회. */
function memoryFirestore(rows = new Map()) {
  const snapshot = (path) => ({ id: path.split("/").at(-1), exists: rows.has(path), data: () => structuredClone(rows.get(path)) });
  const collection = (name) => ({
    doc: (id) => ({
      async get() {
        return snapshot(`${name}/${id}`);
      },
      async set(value) {
        rows.set(`${name}/${id}`, structuredClone(value));
      },
      async delete() {
        rows.delete(`${name}/${id}`);
      },
    }),
    where(field, operator, value) {
      assert.equal(operator, "==");
      let max = Infinity;
      const query = {
        limit(count) {
          max = count;
          return query;
        },
        async get() {
          const docs = [...rows.keys()]
            .filter((path) => path.startsWith(name + "/") && rows.get(path)[field] === value)
            .slice(0, max)
            .map(snapshot);
          return { docs, empty: docs.length === 0 };
        },
      };
      return query;
    },
  });
  return { rows, collection };
}

function device(uid, name, extra = {}) {
  const value = token(name);
  return [`pushTokens/${pushTokenId(value)}`, { id: pushTokenId(value), token: value, uid, platform: "ios", locale: "ko", updatedAt: AT, ...extra }];
}

/** Expo 대역: 받은 요청을 모으고, tickets 로 답할 내용을 고릅니다. */
function fakeExpo(answer = (messages) => messages.map(() => ({ status: "ok", id: "ticket" }))) {
  const requests = [];
  const fetchImpl = async (url, options) => {
    const messages = JSON.parse(options.body);
    requests.push({ url, headers: options.headers, messages });
    const tickets = answer(messages);
    return { ok: true, status: 200, json: async () => ({ data: tickets }) };
  };
  return { requests, fetchImpl };
}

test("Expo 푸시 토큰만 받고, 문서 id 는 토큰 해시이며, 모르는 화면 언어는 한국어로 본다", () => {
  assert.ok(isExpoPushToken("ExponentPushToken[abcdEFGH1234_-]"));
  assert.ok(isExpoPushToken("ExpoPushToken[abcdEFGH1234]"));
  for (const value of ["", "abc", "ExponentPushToken[]", "ExponentPushToken[a/b/c/d/e]", "fcm:abcdefgh", 42, null]) {
    assert.equal(isExpoPushToken(value), false, String(value));
  }
  assert.match(pushTokenId(token("one")), /^[0-9a-f]{40}$/);
  assert.notEqual(pushTokenId(token("one")), pushTokenId(token("two")));
  assert.equal(pushLocale("ja-JP"), "ja");
  assert.equal(pushLocale("en_US"), "en");
  assert.equal(pushLocale("es"), "ko");
  assert.equal(pushLocale(undefined), "ko");
});

test("알림 문구: 제목은 보낸 사람, 본문은 쓴 글이고 사진·음성·교정은 기기의 화면 언어로 바꾼다", () => {
  const message = notify({ type: "message", recipientId: "amy", actorId: "ben", sourceId: "conv", conversationId: "conv", excerpt: "안녕하세요" });
  assert.deepEqual(pushText(message, { actorName: "Ben" }), { title: "Ben", body: "안녕하세요" });
  assert.deepEqual(pushText({ ...message, excerpt: "사진" }, { actorName: "Ben", messageType: "image", locale: "en" }), { title: "Ben", body: "Sent a photo" });
  assert.deepEqual(pushText({ ...message, excerpt: "음성 메시지" }, { actorName: "Ben", messageType: "voice", locale: "ja" }), { title: "Ben", body: "音声メッセージを送りました" });
  assert.deepEqual(pushText({ ...message, excerpt: "I went" }, { actorName: "Ben", messageType: "correction", locale: "en" }), {
    title: "Ben",
    body: "Corrected your sentence · I went",
  });
  assert.deepEqual(pushText({ ...message, type: "message_request" }, { actorName: "Ben", locale: "ja" }), {
    title: "Benさんからのメッセージリクエスト",
    body: "안녕하세요",
  });
  assert.deepEqual(pushText({ type: "request_accepted" }, { actorName: "", locale: "en" }), { title: "Someone", body: "Accepted your message request" });
  assert.equal(pushText({ type: "post_correction", excerpt: "I went" }, { actorName: "Amy" }).body, "내 글을 고쳐 줬어요 · I went");
  assert.equal(pushText({ type: "comment_reply", excerpt: "좋아요" }, { actorName: "Amy", locale: "en" }).body, "Replied to your comment · 좋아요");
  // 좋아요·팔로우·집 소식은 폰 알림이 없습니다.
  for (const type of ["post_like", "partner_like", "follow", "home_visit"]) assert.equal(pushText({ type }, { actorName: "Amy" }), null, type);
});

test("기기마다 그 기기의 화면 언어로 만들고, 누르면 열 곳을 data 에 담는다", () => {
  const notification = notify({ type: "message", recipientId: "amy", actorId: "ben", sourceId: "conv-1", conversationId: "conv-1", excerpt: "사진" });
  const devices = [device("amy", "phone", { locale: "en" })[1], device("amy", "tablet", { locale: "ja", platform: "android" })[1]];
  const messages = buildPushMessages({ notification, messageType: "image", actorName: "Ben" }, devices);
  assert.deepEqual(
    messages.map((message) => [message.to, message.body]),
    [
      [token("phone"), "Sent a photo"],
      [token("tablet"), "写真を送りました"],
    ],
  );
  assert.deepEqual(messages[0].data, { notificationId: notification.id, eventId: "event-1", type: "message", conversationId: "conv-1", postId: "" });
  assert.equal(messages[0].channelId, "default");
  assert.equal(messages[0].sound, "default");
  const like = notify({ type: "post_like", recipientId: "amy", actorId: "ben", sourceId: "post-1", postId: "post-1" });
  assert.deepEqual(buildPushMessages({ notification: like, actorName: "Ben" }, devices), []);
});

test("Expo 에 100개씩 나눠 보내고, 없는 기기(DeviceNotRegistered) 토큰을 돌려주며, 실패한 요청은 던진다", async () => {
  const messages = Array.from({ length: 150 }, (_, index) => ({ to: token("device-" + index), title: "t", body: "b" }));
  const expo = fakeExpo((batch) =>
    batch.map((message) =>
      message.to === token("device-120")
        ? { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } }
        : message.to === token("device-3")
          ? { status: "error", message: "too big", details: { error: "MessageTooBig" } }
          : { status: "ok", id: "ticket" },
    ),
  );
  const result = await sendExpoPush(messages, { fetchImpl: expo.fetchImpl, url: "https://push.test/send", accessToken: "secret" });
  assert.deepEqual(expo.requests.map((request) => request.messages.length), [100, 50]);
  assert.equal(expo.requests[0].url, "https://push.test/send");
  assert.equal(expo.requests[0].headers.authorization, "Bearer secret");
  assert.deepEqual(result, { sent: 148, invalidTokens: [token("device-120")] });

  const noAuth = fakeExpo();
  await sendExpoPush(messages.slice(0, 1), { fetchImpl: noAuth.fetchImpl });
  assert.equal(noAuth.requests[0].headers.authorization, undefined);

  await assert.rejects(
    sendExpoPush(messages.slice(0, 1), { fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }) }),
    /503/,
  );
});

test("받는 사람의 기기로 보내고, 없는 기기는 지우며, 기기가 없으면 Expo 를 부르지 않는다", async () => {
  const db = memoryFirestore(new Map([device("amy", "phone"), device("amy", "old-phone"), device("ben", "phone-b", { locale: "en" })]));
  const expo = fakeExpo((batch) =>
    batch.map((message) => (message.to === token("old-phone") ? { status: "error", details: { error: "DeviceNotRegistered" } } : { status: "ok" })),
  );
  const deliverPush = createPushDelivery({ db, fetchImpl: expo.fetchImpl, log: { warn: assert.fail } });
  const toAmy = notify({ type: "post_correction", recipientId: "amy", actorId: "cat", sourceId: "reply-1", postId: "post-1", excerpt: "I went" });
  const toBen = notify({ type: "comment_reply", recipientId: "ben", actorId: "cat", sourceId: "reply-1", postId: "post-1", excerpt: "I went" });
  const like = notify({ type: "post_like", recipientId: "amy", actorId: "cat", sourceId: "post-1", postId: "post-1" });

  const result = await deliverPush([{ notification: toAmy }, { notification: toBen }, { notification: like }], { actorName: "Cat" });
  assert.deepEqual(result, { sent: 2, removed: 1 });
  assert.equal(expo.requests.length, 1);
  assert.deepEqual(
    expo.requests[0].messages.map((message) => [message.to, message.body]).sort(),
    [
      [token("old-phone"), "내 글을 고쳐 줬어요 · I went"],
      [token("phone"), "내 글을 고쳐 줬어요 · I went"],
      [token("phone-b"), "Replied to your comment · I went"],
    ].sort(),
  );
  assert.equal(db.rows.has(device("amy", "old-phone")[0]), false);
  assert.equal(db.rows.has(device("amy", "phone")[0]), true);

  const quiet = fakeExpo();
  const nobody = createPushDelivery({ db, fetchImpl: quiet.fetchImpl });
  const toCat = notify({ type: "message", recipientId: "cat", actorId: "amy", sourceId: "conv", conversationId: "conv", excerpt: "hi" });
  assert.deepEqual(await nobody([{ notification: toCat }], { actorName: "Amy" }), { sent: 0, removed: 0 });
  assert.deepEqual(await nobody([], {}), { sent: 0, removed: 0 });
  assert.equal(quiet.requests.length, 0);
});

test("보내기가 실패해도 던지지 않고 요청 id 와 함께 경고만 남긴다", async () => {
  const db = memoryFirestore(new Map([device("amy", "phone")]));
  const warnings = [];
  const deliverPush = createPushDelivery({
    db,
    fetchImpl: async () => {
      throw new Error("network down");
    },
    log: { warn: (line) => warnings.push(JSON.parse(line)) },
  });
  const notification = notify({ type: "message", recipientId: "amy", actorId: "ben", sourceId: "conv", conversationId: "conv", excerpt: "hi" });
  assert.deepEqual(await deliverPush([{ notification }], { actorName: "Ben", requestId: "req-1" }), { sent: 0, removed: 0, failed: true });
  assert.deepEqual(warnings, [{ requestId: "req-1", code: "PUSH_DELIVERY_FAILED", message: "network down" }]);
  assert.equal(db.rows.size, 1);
});

/** 실제 Express 경로에 가짜 requireUser 를 붙입니다(x-test-user 머리글이 로그인한 사람). */
async function startApp(t, db) {
  class ApiError extends Error {
    constructor(status, code, message, details) {
      super(message);
      Object.assign(this, { status, code, details });
    }
  }
  const app = express();
  app.use(express.json());
  const requireUser = (req, _res, next) => {
    req.auth = { uid: req.get("x-test-user") };
    next();
  };
  const success = (res, _req, data, status = 200) => res.status(status).json({ data });
  let clock = 0;
  const nowIso = () => new Date(Date.parse(AT) + 1000 * ++clock).toISOString();
  registerPushRoutes(app, { db, requireUser, success, ApiError, nowIso });
  app.use((error, _req, res, _next) => {
    void _next;
    res.status(error.status || 500).json({ error: { code: error.code, field: error.details?.field } });
  });
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, uid, body) => {
    const response = await fetch(base + "/api/push/devices", { method, headers: { "content-type": "application/json", "x-test-user": uid }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  return { call };
}

test("기기 등록: 토큰·기기 형식을 확인하고, 같은 토큰은 마지막에 로그인한 사람에게 묶이며, 한 사람당 기기 수를 넘으면 오래된 것부터 뺀다", async (t) => {
  const db = memoryFirestore();
  const { call } = await startApp(t, db);

  assert.deepEqual((await call("POST", "amy", { token: "nope", platform: "ios" })).body.error, { code: "VALIDATION_ERROR", field: "token" });
  assert.deepEqual((await call("POST", "amy", { token: token("phone"), platform: "web" })).body.error, { code: "VALIDATION_ERROR", field: "platform" });

  const first = await call("POST", "amy", { token: token("phone"), platform: "ios", locale: "ja-JP" });
  assert.equal(first.status, 200);
  assert.deepEqual(first.body.data, { registered: true });
  const path = `pushTokens/${pushTokenId(token("phone"))}`;
  assert.deepEqual({ ...db.rows.get(path), updatedAt: "" }, { id: pushTokenId(token("phone")), token: token("phone"), uid: "amy", platform: "ios", locale: "ja", updatedAt: "" });

  // 같은 기기에서 벤이 로그인해 등록하면 벤의 기기가 됩니다.
  await call("POST", "ben", { token: token("phone"), platform: "ios", locale: "en" });
  assert.equal(db.rows.get(path).uid, "ben");
  assert.equal(db.rows.size, 1);

  for (let n = 0; n < MAX_DEVICES_PER_USER + 2; n += 1) await call("POST", "cat", { token: token("cat-" + n), platform: "android" });
  const cats = [...db.rows.values()].filter((row) => row.uid === "cat").map((row) => row.token);
  assert.equal(cats.length, MAX_DEVICES_PER_USER);
  assert.equal(cats.includes(token("cat-0")), false);
  assert.equal(cats.includes(token("cat-1")), false);
  assert.equal(cats.includes(token("cat-" + (MAX_DEVICES_PER_USER + 1))), true);
});

test("기기 해제: 내 기기만 지우고, 다른 사람에게 묶인 기기는 그대로 둔다", async (t) => {
  const db = memoryFirestore(new Map([device("amy", "phone"), device("ben", "phone-b")]));
  const { call } = await startApp(t, db);
  assert.deepEqual((await call("DELETE", "amy", { token: token("phone-b") })).body.data, { removed: false });
  assert.equal(db.rows.has(device("ben", "phone-b")[0]), true);
  assert.deepEqual((await call("DELETE", "amy", { token: token("phone") })).body.data, { removed: true });
  assert.equal(db.rows.has(device("amy", "phone")[0]), false);
  assert.deepEqual((await call("DELETE", "amy", { token: token("phone") })).body.data, { removed: false });
  assert.equal((await call("DELETE", "amy", {})).status, 422);
});

test("서버는 메시지·요청 수락·댓글 알림을 만든 뒤 폰 알림을 보내고, 재시도 메시지에는 다시 보내지 않으며, 로그인과 로그인 확인에 운영자 여부를 싣는다", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const createMessage = source.slice(source.indexOf("async function createMessage"), source.indexOf('app.post("/api/conversations/:conversationId/messages"'));
  const accept = source.slice(source.indexOf('app.post("/api/conversations/:conversationId/accept"'), source.indexOf('app.patch("/api/conversations/:conversationId/mute"'));
  const replies = source.slice(source.indexOf('app.post("/api/posts/:postId/replies"'), source.indexOf('app.get("/api/corrections/received"'));
  const me = source.slice(source.indexOf('app.get("/api/auth/me"'), source.indexOf('app.post("/api/auth/logout"'));
  const signIn = source.slice(source.indexOf('app.post("/api/auth/session"'), source.indexOf('app.get("/api/auth/me"'));

  for (const [name, section] of [["createMessage", createMessage], ["accept", accept], ["replies", replies]]) {
    // transaction 이 다시 돌면 모은 것을 비우고, 커밋된 뒤에야 보냅니다.
    assert.match(section, /let pushes = \[\];[\s\S]*db\.runTransaction\(async \(transaction\) => \{\s*pushes = \[\];/, name);
    assert.match(section, /\}\);\s*(?:\/\/[^\n]*\n\s*)?(?:if \(result\.created\) )?await deliverPush\(pushes, \{ actorName: req\.auth\.profile\.name, requestId: req\.requestId \}\);/, name);
  }
  assert.match(createMessage, /pushes\.push\(\{ notification, messageType: type \}\)/);
  assert.match(createMessage, /if \(result\.created\) await deliverPush/);
  assert.match(me, /isAdmin: ADMIN_UIDS\.has\(req\.auth\.uid\)/);
  assert.match(signIn, /isAdmin: ADMIN_UIDS\.has\(decoded\.uid\)/);
  assert.match(source, /registerPushRoutes\(app, \{ db, requireUser, success, ApiError, nowIso \}\)/);
});
