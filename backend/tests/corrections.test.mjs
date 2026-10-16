import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CHAT_CORRECTIONS_LIMIT,
  CORRECTION_NOTE_MAX,
  CORRECTION_TEXT_MAX,
  chatCorrectionRow,
  communityCorrectionRow,
  correctionInboxEntry,
  createCorrectionRules,
  receivedCorrections,
  sameCorrection,
} from "../corrections.mjs";

/**
 * createMessage 와 받은 교정 목록은 server.mjs 안에 있고, server.mjs 는 불러오는 순간 Firebase 에 붙고
 * 포트를 엽니다. 그래서 규칙(corrections.mjs)은 여기서 직접 확인하고, server.mjs 가 그 규칙을
 * transaction 의 어느 자리에 붙였는지는 맨 아래 테스트가 소스로 확인합니다(security-boundary.test.mjs 와 같은 방식).
 */

class TestApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const { correctionInput, readCorrection } = createCorrectionRules(TestApiError);
const AT = "2026-10-16T01:00:00.000Z";

/** 던진 오류가 이 상태·코드·details 인지. */
function failsWith(status, code, details) {
  return (error) => {
    assert.ok(error instanceof TestApiError, String(error));
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    if (details !== undefined) assert.deepEqual(error.details, details);
    assert.ok(error.message.length > 0);
    return true;
  };
}

/** 읽기만 하는 transaction 대역. 읽은 경로를 남기고, 쓰기를 부르면 실패합니다(readCorrection 은 읽기 단계입니다). */
function readOnlyTransaction(rows) {
  const reads = [];
  const refuse = (operation) => () => {
    throw new Error(operation + " is not allowed in the read step");
  };
  return {
    reads,
    async getAll(...references) {
      reads.push(references.map((reference) => reference.path));
      return references.map((reference) => ({
        exists: rows.has(reference.path),
        data: () => structuredClone(rows.get(reference.path)),
      }));
    },
    get: refuse("get"),
    set: refuse("set"),
    create: refuse("create"),
    update: refuse("update"),
    delete: refuse("delete"),
  };
}

const reference = (path) => ({ path });
const TARGET = "conversations/conv-1/messages/app-amy-1";
const INBOX = "corrections/amy/items/app-ben-fix";
/** 벤(보내는 사람)이 에이미(받는 사람)의 글 메시지를 고칩니다. */
function world(target = { id: "app-amy-1", conversationId: "conv-1", senderId: "amy", type: "text", text: "I goed to school.", media: "" }) {
  return new Map(target ? [[TARGET, target]] : []);
}
const read = (rows, input, extra = {}) =>
  readCorrection(readOnlyTransaction(rows), {
    status: "accepted",
    targetReference: reference(TARGET),
    inboxReference: reference(INBOX),
    recipientId: "amy",
    input,
    ...extra,
  });
const input = (body = {}) => correctionInput({ text: "I went to school.", targetMessageId: "app-amy-1", note: "past tense", ...body });

test("교정 본문: 고친 문장은 글 메시지와 같은 규칙이고, 설명은 비워도 되는 한 줄이다", () => {
  assert.deepEqual(correctionInput({ text: "  I went to school.\n", targetMessageId: "app-amy-1", note: "  past\n\ttense  " }), {
    text: "I went to school.",
    targetMessageId: "app-amy-1",
    note: "past tense",
  });
  for (const note of [undefined, null, "", "   \n "]) {
    assert.equal(correctionInput({ text: "x", targetMessageId: "app-amy-1", note }).note, "", JSON.stringify(note));
  }
  // 원문은 본문에서 받지 않습니다(서버가 대상 메시지에서 복사합니다).
  assert.equal("original" in correctionInput({ text: "x", targetMessageId: "m1", original: "forged" }), false);
  // 예전 짧은 메시지 id 도 꼴로는 받습니다. 있는지는 transaction 이 확인합니다.
  assert.equal(correctionInput({ text: "x", targetMessageId: "m1" }).targetMessageId, "m1");
  assert.equal(correctionInput({ text: "a".repeat(CORRECTION_TEXT_MAX), targetMessageId: "m1" }).text.length, CORRECTION_TEXT_MAX);
  assert.equal(correctionInput({ text: "x", targetMessageId: "m1", note: "n".repeat(CORRECTION_NOTE_MAX) }).note.length, CORRECTION_NOTE_MAX);
  // 겹친 공백을 줄인 뒤 길이를 잽니다.
  assert.equal(correctionInput({ text: "x", targetMessageId: "m1", note: "n ".repeat(CORRECTION_NOTE_MAX / 2) + "\n\n\n" }).note.length, CORRECTION_NOTE_MAX - 1);
});

test("교정 본문: 잘못된 고친 문장·대상 id·설명은 422 VALIDATION_ERROR 로 필드를 알려준다", () => {
  for (const text of [undefined, null, 3, ["x"]]) {
    assert.throws(() => correctionInput({ text, targetMessageId: "m1" }), failsWith(422, "VALIDATION_ERROR", { field: "text" }));
  }
  for (const text of ["", "   \n", "a".repeat(CORRECTION_TEXT_MAX + 1)]) {
    assert.throws(
      () => correctionInput({ text, targetMessageId: "m1" }),
      failsWith(422, "VALIDATION_ERROR", { field: "text", min: 1, max: CORRECTION_TEXT_MAX }),
    );
  }
  for (const targetMessageId of [undefined, "", "a/b", "..", ".", "__name__", "with space", 12345, { id: "m1" }]) {
    assert.throws(
      () => correctionInput({ text: "x", targetMessageId }),
      failsWith(422, "VALIDATION_ERROR", { field: "targetMessageId" }),
      JSON.stringify(targetMessageId),
    );
  }
  for (const note of [3, true, ["x"], { text: "x" }]) {
    assert.throws(() => correctionInput({ text: "x", targetMessageId: "m1", note }), failsWith(422, "VALIDATION_ERROR", { field: "note" }));
  }
  assert.throws(
    () => correctionInput({ text: "x", targetMessageId: "m1", note: "n".repeat(CORRECTION_NOTE_MAX + 1) }),
    failsWith(422, "VALIDATION_ERROR", { field: "note", max: CORRECTION_NOTE_MAX }),
  );
  assert.throws(() => correctionInput(undefined), failsWith(422, "VALIDATION_ERROR", { field: "text" }));
});

test("교정 대상 확인: 같은 대화의 대상과 받는 사람의 교정함 칸을 한 번에 읽고, 원문은 저장된 메시지에서 복사한다", async () => {
  const transaction = readOnlyTransaction(world());
  const fields = await readCorrection(transaction, {
    status: "accepted",
    targetReference: reference(TARGET),
    inboxReference: reference(INBOX),
    recipientId: "amy",
    input: input(),
  });
  assert.deepEqual(fields, { original: "I goed to school.", targetMessageId: "app-amy-1", note: "past tense", media: "" });
  assert.deepEqual(transaction.reads, [[TARGET, INBOX]]);
  // 대소문자만 고쳐도 교정입니다.
  assert.equal((await read(world(), input({ text: "i goed to school." }))).original, "I goed to school.");
});

test("교정은 수락된 대화에서만 보내고, 그 전에는 아무것도 읽지 않는다", async () => {
  for (const status of ["pending", "closed", undefined]) {
    const transaction = readOnlyTransaction(world());
    await assert.rejects(
      readCorrection(transaction, { status, targetReference: reference(TARGET), inboxReference: reference(INBOX), recipientId: "amy", input: input() }),
      failsWith(403, "CORRECTION_NOT_ALLOWED"),
    );
    assert.deepEqual(transaction.reads, []);
  }
});

test("상대가 보낸 글 메시지가 아니면 422 CORRECTION_TARGET_INVALID 이다", async () => {
  const text = { id: "app-amy-1", conversationId: "conv-1", senderId: "amy", type: "text", text: "I goed to school.", media: "" };
  const targets = [
    null, // 이 대화에 없는 메시지
    { ...text, senderId: "ben" }, // 내 메시지
    { ...text, senderId: "someone-else" },
    { ...text, type: "image", text: "사진", media: "data:image/png;base64,AAAA" },
    { ...text, type: "voice", text: "음성 메시지", media: "data:audio/webm;base64,AAAA" },
    { ...text, type: "correction", original: "I go", targetMessageId: "app-ben-1", note: "" }, // 교정을 다시 고치지 않습니다
    { ...text, text: undefined },
  ];
  for (const target of targets) {
    await assert.rejects(read(world(target), input()), failsWith(422, "CORRECTION_TARGET_INVALID", { field: "targetMessageId" }), JSON.stringify(target));
  }
});

test("고친 문장이 원문과 같으면(앞뒤 공백 무시) 422 CORRECTION_UNCHANGED 이다", async () => {
  for (const text of ["I goed to school.", "  I goed to school.  "]) {
    await assert.rejects(read(world(), input({ text })), failsWith(422, "CORRECTION_UNCHANGED", { field: "text" }), text);
  }
  const padded = world({ id: "app-amy-1", senderId: "amy", type: "text", text: "  I goed to school. ", media: "" });
  await assert.rejects(read(padded, input({ text: "I goed to school." })), failsWith(422, "CORRECTION_UNCHANGED", { field: "text" }));
});

test("다른 대화의 교정이 받는 사람의 교정함 칸을 이미 쓰고 있으면 덮어쓰지 않고 409 MESSAGE_ID_CONFLICT 이다", async () => {
  const rows = world();
  rows.set(INBOX, { id: "app-ben-fix", conversationId: "conv-9", fromUserId: "cat", fixed: "other" });
  await assert.rejects(read(rows, input()), failsWith(409, "MESSAGE_ID_CONFLICT"));
});

test("같은 id 로 다시 보낸 교정은 고친 메시지와 설명이 같을 때만 같은 요청이다", () => {
  const stored = { type: "correction", text: "I went to school.", targetMessageId: "app-amy-1", note: "past tense" };
  assert.equal(sameCorrection(stored, input()), true);
  assert.equal(sameCorrection(stored, input({ targetMessageId: "app-amy-2" })), false);
  assert.equal(sameCorrection(stored, input({ note: "tense" })), false);
  assert.equal(sameCorrection(stored, input({ note: "" })), false);
  // 설명 없이 저장된 교정과 설명 없는 재시도
  assert.equal(sameCorrection({ ...stored, note: undefined }, input({ note: "" })), true);
  // 같은 id 의 글 메시지(교정 필드 없음)는 교정 재시도가 아닙니다.
  assert.equal(sameCorrection({ type: "text", text: "I went to school." }, input()), false);
});

test("저장한 교정 메시지 → 받는 사람의 교정함 항목 → 받은 교정 한 줄", async () => {
  const fields = await read(world(), input());
  // createMessage 가 저장하는 메시지와 같은 모양입니다.
  const message = {
    id: "app-ben-fix",
    conversationId: "conv-1",
    senderId: "ben",
    type: "correction",
    text: "I went to school.",
    media: "",
    sentAt: AT,
    status: "sent",
    ...fields,
  };
  const entry = correctionInboxEntry(message);
  assert.deepEqual(entry, {
    id: "app-ben-fix",
    source: "chat",
    conversationId: "conv-1",
    messageId: "app-ben-fix",
    targetMessageId: "app-amy-1",
    original: "I goed to school.",
    fixed: "I went to school.",
    note: "past tense",
    fromUserId: "ben",
    createdAt: AT,
  });

  const author = {
    from: "Ben",
    fromFlag: "🇺🇸",
    fromAvatarUrl: "",
    fromAvatarMode: "character",
    fromAvatarConfig: null,
    fromCountryCode: "US",
  };
  const row = chatCorrectionRow(entry, author);
  assert.deepEqual(row, {
    id: "app-ben-fix",
    source: "chat",
    conversationId: "conv-1",
    messageId: "app-ben-fix",
    targetMessageId: "app-amy-1",
    postId: "",
    postText: "",
    original: "I goed to school.",
    fixed: "I went to school.",
    note: "past tense",
    createdAt: AT,
    fromUserId: "ben",
    ...author,
  });
  // 키 순서까지 약속한 모양입니다.
  assert.deepEqual(Object.keys(row), [
    "id", "source", "conversationId", "messageId", "targetMessageId", "postId", "postText", "original", "fixed", "note",
    "createdAt", "fromUserId", "from", "fromFlag", "fromAvatarUrl", "fromAvatarMode", "fromAvatarConfig", "fromCountryCode",
  ]);
  assert.equal(chatCorrectionRow({ ...entry, note: undefined }, author).note, "");
});

test("내 글에 달린 교정은 예전 필드를 모두 지키고 source·fromUserId 만 더한다", () => {
  const reply = { id: "reply-1", postId: "post-1", postText: "my post", authorId: "amy", kind: "correction", original: "i has", text: "i have", parentId: "", likes: 0, createdAt: AT };
  const author = { from: "Amy", fromFlag: "🇰🇷", fromAvatarUrl: "", fromAvatarMode: "photo", fromAvatarConfig: null, fromCountryCode: "KR" };
  const row = communityCorrectionRow(reply, author);
  const before = {
    id: "reply-1",
    postId: "post-1",
    postText: "my post",
    original: "i has",
    fixed: "i have",
    createdAt: AT,
    ...author,
  };
  for (const [key, value] of Object.entries(before)) assert.deepEqual(row[key], value, key);
  assert.equal(row.source, "community");
  assert.equal(row.fromUserId, "amy");
  assert.deepEqual(Object.keys(row).sort(), [...Object.keys(before), "source", "fromUserId"].sort());
});

test("받은 교정 목록은 두 출처를 합쳐 최신순으로 두고, 어느 쪽이든 차단 관계인 사람의 교정은 뺀다", () => {
  const at = (hour) => `2026-10-16T0${hour}:00:00.000Z`;
  const reply = (id, authorId, hour) => ({ id, postId: "post-1", postText: "my post", authorId, kind: "correction", original: "a", text: "b", createdAt: at(hour) });
  const entry = (id, fromUserId, hour) => ({ id, source: "chat", conversationId: "conv-" + fromUserId, messageId: id, targetMessageId: "t-" + id, original: "c", fixed: "d", note: "", fromUserId, createdAt: at(hour) });
  const asked = [];
  const rows = receivedCorrections({
    replies: [reply("reply-amy", "amy", 1), reply("reply-blocker", "blocker", 6), reply("reply-cat", "cat", 4)],
    chatEntries: [entry("chat-ben", "ben", 5), entry("chat-blocked", "blocked", 7), entry("chat-amy", "amy", 2)],
    blocked: new Set(["blocker", "blocked"]),
    authorOf: (uid) => {
      asked.push(uid);
      return { from: uid.toUpperCase(), fromFlag: "🌐", fromAvatarUrl: "", fromAvatarMode: "character", fromAvatarConfig: null, fromCountryCode: "" };
    },
  });
  assert.deepEqual(
    rows.map((row) => [row.source, row.id, row.fromUserId, row.from]),
    [
      ["chat", "chat-ben", "ben", "BEN"],
      ["community", "reply-cat", "cat", "CAT"],
      ["chat", "chat-amy", "amy", "AMY"],
      ["community", "reply-amy", "amy", "AMY"],
    ],
  );
  // 차단 관계인 사람의 카드는 만들지도 않습니다.
  assert.equal(asked.some((uid) => uid === "blocker" || uid === "blocked"), false);
  assert.deepEqual(receivedCorrections({ authorOf: () => ({}) }), []);
});

test("server.mjs 는 교정을 메시지와 같은 transaction 에서 확인하고, 메시지와 교정함 항목을 함께 쓴다", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const route = source.slice(source.indexOf("async function createMessage"), source.indexOf('app.post("/api/conversations/:conversationId/messages"'));

  assert.match(route, /\["text", "voice", "image", "correction"\]\.includes\(type\)/);
  assert.match(route, /const correction = type === "correction" \? correctionInput\(req\.body\) : null;/);
  // 같은 id 의 재시도는 고친 메시지·설명까지 같아야 합니다.
  assert.match(route, /\(correction && !sameCorrection\(existing, correction\)\)\s*\)\s*\{\s*throw new ApiError\(409, "MESSAGE_ID_CONFLICT"/);
  // 고칠 메시지는 이 대화 안에서만 찾고, 받는 사람의 교정함 칸과 함께 읽습니다.
  assert.match(route, /targetReference: conversationReference\.collection\("messages"\)\.doc\(correction\.targetMessageId\)/);
  assert.match(route, /inboxReference: correctionItems\(recipientId\)\.doc\(clientMessageId\)/);
  // 읽기(차단 → 교정 대상) 가 모두 끝난 뒤 메시지·교정함·알림·대화를 씁니다.
  const order = [
    "assertNotBlockedInTransaction(transaction, req.auth.uid, [recipientId]",
    "await readCorrection(transaction, {",
    "transaction.create(messageReference, message);",
    "transaction.create(correctionItems(recipientId).doc(clientMessageId), correctionInboxEntry(message));",
    "putNotification(transaction, {",
    "transaction.update(conversationReference, {",
  ].map((needle) => [needle, route.indexOf(needle)]);
  order.forEach(([needle, index], position) => {
    assert.ok(index >= 0, needle);
    if (position > 0) assert.ok(index > order[position - 1][1], needle + " comes after " + order[position - 1][0]);
  });
  // 알림은 글 메시지와 같은 "message" 알림입니다(옛 화면이 모르는 새 알림 종류를 만들지 않습니다).
  assert.match(route, /type: conversationStatus\(conversation\) === "pending" \? "message_request" : "message"/);
  // 교정함 경로는 계정 삭제가 지우는 경로와 같습니다(account-deletion.test.mjs 가 corrections/{uid}/items 를 씁니다).
  assert.match(source, /function correctionItems\(uid\) \{\s*return db\.collection\("corrections"\)\.doc\(uid\)\.collection\("items"\);/);
});

test("받은 교정 목록은 교정함을 최신순 200개까지 읽고, 메시지 조회는 저장된 교정 필드를 그대로 돌려준다", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const received = source.slice(source.indexOf('app.get("/api/corrections/received"'), source.indexOf('app.get("/api/likes/sent"'));
  assert.equal(CHAT_CORRECTIONS_LIMIT, 200);
  assert.match(received, /correctionItems\(req\.auth\.uid\)\.orderBy\("createdAt", "desc"\)\.limit\(CHAT_CORRECTIONS_LIMIT\)/);
  assert.match(received, /blockedBothWays\(req\.auth\.uid\)/);
  assert.match(received, /receivedCorrections\(\{[\s\S]*blocked,[\s\S]*authorOf:/);

  // 메시지 조회는 필드를 고르지 않고 저장된 문서를 그대로 돌려줍니다 — original·targetMessageId·note 도 함께 나갑니다.
  const messages = source.slice(source.indexOf('app.get("/api/conversations/:conversationId/messages"'), source.indexOf("async function createMessage"));
  assert.match(messages, /const rows = messageSnapshot\.docs\.map\(\(document\) => document\.data\(\)\);/);

  // 운영 Firestore 에는 collection group 색인이 없습니다.
  for (const file of ["../server.mjs", "../corrections.mjs", "../account-deletion.mjs"]) {
    assert.doesNotMatch(await readFile(new URL(file, import.meta.url), "utf8"), /collectionGroup\(/, file);
  }
});
