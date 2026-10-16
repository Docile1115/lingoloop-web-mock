import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import test from "node:test";
import express from "express";
import { ACCOUNT_DELETE_CONFIRMATION, deleteAccountData, registerAccountRoutes } from "../account-deletion.mjs";
import { isDiscoverable } from "../discovery.mjs";
import { buildNotification, notificationDocumentId } from "../notifications.mjs";

/**
 * 메모리 Firestore. homes.test.mjs 의 대역과 같은 생각이지만 계정 삭제가 기대는 동작을 더 흉내 냅니다.
 * - 부모 문서 없이 하위 컬렉션만 있을 수 있고, 컬렉션 조회는 바로 아래 문서만 돌려줍니다.
 * - where(==, array-contains)·select·limit, 이름 순 orderBy·startAfter(커서 문서를 지운 뒤에도 이름으로 이어감)
 * - getAll·batch·recursiveDelete, transaction 의 "쓰기 뒤 읽기 금지"와 한꺼번에 반영되는 커밋
 * - fail(조건) 은 조건에 맞는 다음 쓰기 하나를 실패시킵니다(중간 실패 재현).
 */
function memoryFirestore() {
  const rows = new Map();
  let injected = null;
  const guard = (operation, path) => {
    if (injected?.(operation, path)) {
      injected = null;
      throw Object.assign(new Error(`injected ${operation} failure at ${path}`), { code: 14 });
    }
  };
  const segments = (path) => path.split("/");
  const snapshot = (ref, fields = null) => {
    const exists = rows.has(ref.path);
    const data = () => {
      if (!exists) return undefined;
      const row = structuredClone(rows.get(ref.path));
      return fields ? Object.fromEntries(fields.filter((field) => field in row).map((field) => [field, row[field]])) : row;
    };
    return { ref, id: ref.id, exists, data };
  };

  class DocumentReference {
    constructor(path) {
      assert.equal(segments(path).length % 2, 0, "document path: " + path);
      this.path = path;
      this.id = segments(path).at(-1);
    }
    get parent() {
      return new CollectionReference(segments(this.path).slice(0, -1).join("/"));
    }
    collection(name) {
      return new CollectionReference(this.path + "/" + name);
    }
    async get() {
      return snapshot(this);
    }
  }

  class Query {
    constructor(path, { filters = [], fields = null, max = Infinity, after = null, ordered = false } = {}) {
      Object.assign(this, { path, filters, fields, max, after, ordered });
    }
    next(change) {
      const { filters, fields, max, after, ordered } = this;
      return new Query(this.path, { filters, fields, max, after, ordered, ...change });
    }
    where(field, operator, value) {
      assert.ok(["==", "array-contains"].includes(operator), operator);
      assert.notEqual(value, undefined);
      return this.next({ filters: [...this.filters, [field, operator, value]] });
    }
    orderBy(field) {
      assert.equal(field, "__name__");
      return this.next({ ordered: true });
    }
    limit(max) {
      return this.next({ max });
    }
    startAfter(cursor) {
      assert.ok(this.ordered, "cursor needs an order");
      return this.next({ after: cursor.ref.path });
    }
    select(...fields) {
      return this.next({ fields });
    }
    async get() {
      const depth = segments(this.path).length + 1;
      const docs = [...rows.keys()]
        .filter((path) => path.startsWith(this.path + "/") && segments(path).length === depth)
        .filter((path) =>
          this.filters.every(([field, operator, value]) => {
            const actual = rows.get(path)[field];
            return operator === "==" ? actual === value : Array.isArray(actual) && actual.includes(value);
          }),
        )
        .filter((path) => this.after === null || path > this.after)
        .sort()
        .slice(0, this.max)
        .map((path) => snapshot(new DocumentReference(path), this.fields));
      return { docs, size: docs.length, empty: docs.length === 0 };
    }
  }

  class CollectionReference extends Query {
    constructor(path) {
      assert.equal(segments(path).length % 2, 1, "collection path: " + path);
      super(path);
      this.id = segments(path).at(-1);
    }
    get parent() {
      const parts = segments(this.path);
      return parts.length > 1 ? new DocumentReference(parts.slice(0, -1).join("/")) : null;
    }
    doc(id) {
      assert.ok(typeof id === "string" && id && !id.includes("/"), "document id: " + id);
      return new DocumentReference(this.path + "/" + id);
    }
  }

  let queue = Promise.resolve();
  return {
    rows,
    fail(predicate) {
      injected = predicate;
    },
    dump: () => Object.fromEntries([...rows].map(([path, row]) => [path, structuredClone(row)])),
    collection: (name) => new CollectionReference(name),
    async getAll(...refs) {
      assert.ok(refs.length > 0, "getAll needs at least one reference");
      return refs.map((ref) => snapshot(ref));
    },
    batch() {
      const deletes = [];
      return {
        delete(ref) {
          deletes.push(ref);
          return this;
        },
        async commit() {
          deletes.forEach((ref) => guard("delete", ref.path));
          deletes.forEach((ref) => rows.delete(ref.path));
        },
      };
    },
    async recursiveDelete(ref) {
      guard("recursiveDelete", ref.path);
      for (const path of [...rows.keys()]) if (path === ref.path || path.startsWith(ref.path + "/")) rows.delete(path);
    },
    // Firestore 처럼 transaction 은 하나씩 실행되고, 쓰기는 끝에 한꺼번에 반영됩니다.
    runTransaction(task) {
      const execute = async () => {
        const writes = [];
        const read = async (target) => {
          assert.equal(writes.length, 0, "Firestore transactions must read before they write");
          return target instanceof DocumentReference ? snapshot(target) : target.get();
        };
        const transaction = {
          get: read,
          getAll: (...refs) => {
            assert.ok(refs.length > 0);
            return Promise.all(refs.map(read));
          },
          set: (ref, value) => writes.push({ operation: "set", ref, apply: () => rows.set(ref.path, structuredClone(value)) }),
          update: (ref, patch) =>
            writes.push({ operation: "update", ref, apply: () => rows.set(ref.path, { ...rows.get(ref.path), ...structuredClone(patch) }) }),
          delete: (ref) => writes.push({ operation: "delete", ref, apply: () => rows.delete(ref.path) }),
        };
        const result = await task(transaction);
        for (const { operation, ref } of writes) {
          guard(operation, ref.path);
          if (operation === "update") assert.ok(rows.has(ref.path), "update needs an existing document: " + ref.path);
        }
        writes.forEach(({ apply }) => apply());
        return result;
      };
      const result = queue.then(execute);
      queue = result.catch(() => {});
      return result;
    },
  };
}

const UID = "leaver";
const DAY = "2026-10-16";
const AT = "2026-10-16T01:00:00.000Z";

/** 지울 사람(leaver)과 그 주변. 남의 집에 쓴 글·하트·도장, 양방향 관계, 대화, 남의 글의 댓글·좋아요를 모두 담습니다. */
function seedWorld(db) {
  const put = (path, value) => db.rows.set(path, structuredClone(value));
  let events = 0;
  const notify = (event) => {
    events += 1;
    const row = buildNotification({ eventId: "event-" + events, createdAt: AT, ...event });
    put(`notifications/${row.recipientId}/items/${row.id}`, row);
  };

  for (const id of [UID, "amy", "ben", "cat"]) {
    put(`profiles/${id}`, { id, name: id, accountStatus: "active", onboardedAt: AT, avatarUrl: "data:image/png;base64,AAAA", createdAt: AT, updatedAt: AT });
  }

  // 나만의 문서와 하위 컬렉션. 내 집에는 다른 사람의 방명록·하트·도장도 있습니다.
  put(`matchingPreferences/${UID}`, { targetLanguages: ["en"], updatedAt: AT });
  put(`dailyMatches/${UID}/days/2026-10-15`, { recommendations: [{ partnerId: "amy" }] });
  put(`dailyMatches/${UID}/days/${DAY}`, { recommendations: [{ partnerId: "ben" }] });
  put(`savedPhrases/${UID}/items/saved-1`, { id: "saved-1", phrase: "hello" });
  put(`savedPhrases/${UID}/items/saved-2`, { id: "saved-2", phrase: "bye" });
  put(`dmPolicies/${UID}`, { whoCanMessage: "matches" });
  put(`aiUsage/${UID}/days/${DAY}`, { userId: UID, date: DAY, counts: { translation: 3 } });
  put(`writeQuotas/${UID}`, { day: DAY, counts: { posts: 1 } });
  put(`homeQuotas/${UID}`, { day: DAY, count: 2 });
  put(`homes/${UID}`, { visibility: "everyone", pinnedId: "e1-amy" });
  put(`homes/${UID}/entries/e1-amy`, { id: "e1-amy", authorId: "amy", text: "hi leaver", heartCount: 1, reply: { authorId: UID, text: "thanks" }, deletedAt: null });
  put(`homes/${UID}/entries/e1-amy/hearts/ben`, { createdAt: AT });
  put(`homes/${UID}/photos/frame`, { image: "data:image/jpeg;base64,AAAA", caption: "me" });
  put(`homes/${UID}/stamps/amy`, { authorId: "amy", gift: "flower", note: "hello", day: DAY });
  put(`homeFavorites/${UID}/items/amy`, { ownerId: "amy", createdAt: AT });
  notify({ type: "home_entry", recipientId: UID, actorId: "amy", sourceId: "e1-amy", homeOwnerId: UID, excerpt: "hi leaver" });
  notify({ type: "home_reply", recipientId: "amy", actorId: UID, sourceId: "e1-amy", homeOwnerId: UID, excerpt: "thanks" });
  // 내 집에서 다른 사람끼리 생긴 알림(벤이 에이미의 글에 하트). 집이 사라지면 갈 곳이 없습니다.
  notify({ type: "home_heart", recipientId: "amy", actorId: "ben", sourceId: "e1-amy", homeOwnerId: UID });

  // 관계: 내가 보낸 것과 받은 것, 그리고 상관없는 두 사람의 관계.
  put(`likes/${UID}_amy`, { fromUserId: UID, toUserId: "amy", createdAt: AT });
  put(`likes/ben_${UID}`, { fromUserId: "ben", toUserId: UID, createdAt: AT });
  put("likes/amy_ben", { fromUserId: "amy", toUserId: "ben", createdAt: AT });
  put(`follows/${UID}_ben`, { fromUserId: UID, toUserId: "ben", createdAt: AT });
  put(`follows/amy_${UID}`, { fromUserId: "amy", toUserId: UID, createdAt: AT });
  put("follows/ben_amy", { fromUserId: "ben", toUserId: "amy", createdAt: AT });
  put(`blocks/${UID}_cat`, { id: `${UID}_cat`, blockerId: UID, blockedId: "cat", cleanupComplete: true });
  put(`blocks/cat_${UID}`, { id: `cat_${UID}`, blockerId: "cat", blockedId: UID, cleanupComplete: true });
  put("blocks/amy_cat", { id: "amy_cat", blockerId: "amy", blockedId: "cat", cleanupComplete: true });
  put(`dmRequestCooldowns/${UID}_amy`, { senderId: UID, recipientId: "amy", declinedAt: AT });
  put(`dmRequestCooldowns/ben_${UID}`, { senderId: "ben", recipientId: UID, declinedAt: AT });
  put("dmRequestCooldowns/amy_ben", { senderId: "amy", recipientId: "ben", declinedAt: AT });
  notify({ type: "partner_like", recipientId: "amy", actorId: UID, sourceId: "amy" });
  notify({ type: "follow", recipientId: "ben", actorId: UID, sourceId: "ben" });
  notify({ type: "partner_like", recipientId: UID, actorId: "ben", sourceId: UID });
  notify({ type: "follow", recipientId: UID, actorId: "amy", sourceId: UID });
  notify({ type: "follow", recipientId: "amy", actorId: "ben", sourceId: "amy" });

  // 대화: 내가 들어 있는 대화는 상대 쪽에서도 사라지고, 남의 대화는 남습니다.
  put("conversations/conv-a", { id: "conv-a", memberIds: [UID, "amy"], requestStatus: "accepted", lastMessage: "see you", lastSenderId: UID, unread: { amy: 1 } });
  put("conversations/conv-a/messages/m1", { id: "m1", senderId: UID, text: "see you" });
  put("conversations/conv-a/messages/m2", { id: "m2", senderId: "amy", text: "bye" });
  put("conversations/conv-b", { id: "conv-b", memberIds: ["ben", UID], requestStatus: "pending", requestSenderId: "ben", requestRecipientId: UID });
  put("conversations/conv-b/messages/m1", { id: "m1", senderId: "ben", text: "hi?" });
  put("conversations/conv-c", { id: "conv-c", memberIds: [UID, "cat"], requestStatus: "accepted" });
  put("conversations/conv-c/messages/m1", { id: "m1", senderId: "cat", text: "yo" });
  put("conversations/conv-d", { id: "conv-d", memberIds: ["amy", "ben"], requestStatus: "accepted" });
  put("conversations/conv-d/messages/m1", { id: "m1", senderId: "amy", text: "hello ben" });
  notify({ type: "message", recipientId: "amy", actorId: UID, sourceId: "conv-a", conversationId: "conv-a", excerpt: "see you" });
  notify({ type: "message_request", recipientId: UID, actorId: "ben", sourceId: "conv-b", conversationId: "conv-b", excerpt: "hi?" });
  notify({ type: "message", recipientId: "ben", actorId: "amy", sourceId: "conv-d", conversationId: "conv-d", excerpt: "hello ben" });

  // 내가 쓴 글 세 개와 거기 달린 남의 댓글·좋아요.
  put(`posts/post-${UID}-1`, { id: `post-${UID}-1`, authorId: UID, author: { id: UID, name: UID }, text: "my post", likes: 1, comments: 1, corrections: 0 });
  put(`posts/post-${UID}-1/reactions/amy`, { userId: "amy", createdAt: AT });
  put(`posts/post-${UID}-1/replies/reply-amy-1`, { id: "reply-amy-1", authorId: "amy", kind: "reply", text: "nice", parentId: "" });
  put(`posts/post-${UID}-2`, { id: `post-${UID}-2`, authorId: UID, author: { id: UID, name: UID }, text: "second", likes: 0, comments: 0, corrections: 0 });
  put(`posts/post-${UID}-3`, { id: `post-${UID}-3`, authorId: UID, author: { id: UID, name: UID }, text: "third", likes: 0, comments: 0, corrections: 1 });
  put(`posts/post-${UID}-3/replies/reply-ben-1`, { id: "reply-ben-1", authorId: "ben", kind: "correction", original: "a", text: "b", parentId: "" });
  notify({ type: "post_like", recipientId: UID, actorId: "amy", sourceId: `post-${UID}-1`, postId: `post-${UID}-1` });

  // 남의 글에 남긴 좋아요·댓글·교정. 지우면 글의 숫자도 줄어야 합니다.
  put("posts/post-amy", { id: "post-amy", authorId: "amy", text: "amy's post", likes: 2, comments: 3, corrections: 1 });
  put(`posts/post-amy/reactions/${UID}`, { userId: UID, createdAt: AT });
  put("posts/post-amy/reactions/ben", { userId: "ben", createdAt: AT });
  put(`posts/post-amy/replies/reply-${UID}-1`, { id: `reply-${UID}-1`, postId: "post-amy", authorId: UID, kind: "reply", text: "good", parentId: "" });
  put(`posts/post-amy/replies/reply-${UID}-fix`, { id: `reply-${UID}-fix`, postId: "post-amy", authorId: UID, kind: "correction", original: "i has", text: "i have", parentId: "" });
  // 내 댓글에 벤이 단 답글은 벤의 글이라 남습니다(화면은 부모 없는 답글을 맨 위로 올립니다).
  put("posts/post-amy/replies/reply-ben-answer", { id: "reply-ben-answer", postId: "post-amy", authorId: "ben", kind: "reply", text: "agree", parentId: `reply-${UID}-1` });
  put("posts/post-amy/replies/reply-amy-2", { id: "reply-amy-2", postId: "post-amy", authorId: "amy", kind: "reply", text: "thanks all", parentId: "" });
  put("posts/post-ben", { id: "post-ben", authorId: "ben", text: "ben's post", likes: 1, comments: 3, corrections: 0 });
  put(`posts/post-ben/reactions/${UID}`, { userId: UID, createdAt: AT });
  for (const n of [2, 3, 4]) {
    put(`posts/post-ben/replies/reply-${UID}-${n}`, { id: `reply-${UID}-${n}`, postId: "post-ben", authorId: UID, kind: "reply", text: "reply " + n, parentId: "" });
    notify({ type: "post_reply", recipientId: "ben", actorId: UID, sourceId: `reply-${UID}-${n}`, postId: "post-ben", excerpt: "reply " + n });
  }
  put("posts/post-cat-1", { id: "post-cat-1", authorId: "cat", text: "cat 1", likes: 0, comments: 0, corrections: 0 });
  put("posts/post-cat-2", { id: "post-cat-2", authorId: "cat", text: "cat 2", likes: 0, comments: 0, corrections: 0 });
  notify({ type: "post_like", recipientId: "amy", actorId: UID, sourceId: "post-amy", postId: "post-amy", excerpt: "amy's post" });
  notify({ type: "post_reply", recipientId: "amy", actorId: UID, sourceId: `reply-${UID}-1`, postId: "post-amy", excerpt: "good" });
  notify({ type: "post_correction", recipientId: "amy", actorId: UID, sourceId: `reply-${UID}-fix`, postId: "post-amy", excerpt: "i have" });
  notify({ type: "comment_reply", recipientId: UID, actorId: "ben", sourceId: "reply-ben-answer", postId: "post-amy", excerpt: "agree" });
  notify({ type: "post_like", recipientId: "amy", actorId: "ben", sourceId: "post-amy", postId: "post-amy" });

  // 에이미의 집: 고정된 내 방명록 글, 남의 글에 누른 하트, 전시된 내 선물(도장).
  put("homes/amy", { visibility: "everyone", pinnedId: `e2-${UID}`, displayedGiftId: UID, question: "" });
  put("homes/amy/entries/e1-ben", { id: "e1-ben", authorId: "ben", text: "yo", heartCount: 2, reply: null, deletedAt: null });
  put(`homes/amy/entries/e1-ben/hearts/${UID}`, { createdAt: AT });
  put("homes/amy/entries/e1-ben/hearts/amy", { createdAt: AT });
  put(`homes/amy/entries/e2-${UID}`, { id: `e2-${UID}`, authorId: UID, text: "hello amy", heartCount: 1, reply: { authorId: "amy", text: "hey" }, deletedAt: null });
  put(`homes/amy/entries/e2-${UID}/hearts/ben`, { createdAt: AT });
  put("homes/amy/entries/e3-cat", { id: "e3-cat", authorId: "cat", text: "meow", heartCount: 1, reply: null, deletedAt: null });
  put(`homes/amy/entries/e3-cat/hearts/${UID}`, { createdAt: AT });
  put(`homes/amy/stamps/${UID}`, { authorId: UID, gift: "flower", note: "hi amy", day: DAY, createdAt: AT });
  put("homes/amy/stamps/ben", { authorId: "ben", gift: "cookie", note: "", day: DAY, createdAt: AT });
  put("homes/amy/photos/frame", { image: "data:image/jpeg;base64,AAAA", caption: "amy", visibility: "everyone" });
  // 캣의 집에는 집 문서가 없습니다 — 설정을 바꾼 적이 없으면 하위 컬렉션만 있습니다.
  put(`homes/cat/entries/e1-${UID}`, { id: `e1-${UID}`, authorId: UID, text: "hi cat", heartCount: 0, reply: null, deletedAt: null });
  put("homes/cat/entries/e2-cat", { id: "e2-cat", authorId: "cat", text: "my note", heartCount: 1, reply: null, deletedAt: null });
  put(`homes/cat/entries/e2-cat/hearts/${UID}`, { createdAt: AT });
  put(`homes/cat/stamps/${UID}`, { authorId: UID, gift: "wave", note: "", day: DAY, createdAt: AT });
  // 다른 사람이 내 집을 즐겨찾기한 기록(부모 문서 없음).
  put(`homeFavorites/amy/items/${UID}`, { ownerId: UID, createdAt: AT });
  put("homeFavorites/amy/items/ben", { ownerId: "ben", createdAt: AT });
  put(`homeFavorites/ben/items/${UID}`, { ownerId: UID, createdAt: AT });
  notify({ type: "home_entry", recipientId: "amy", actorId: UID, sourceId: `e2-${UID}`, homeOwnerId: "amy", excerpt: "hello amy" });
  notify({ type: "home_heart", recipientId: "ben", actorId: UID, sourceId: "e1-ben", homeOwnerId: "amy" });
  notify({ type: "home_heart", recipientId: "cat", actorId: UID, sourceId: "e2-cat", homeOwnerId: "cat" });
  // 방문 알림은 그날 날짜가 sourceId 입니다. 도장 문서에는 마지막 날만 남아 지난 날의 알림은 다시 계산할 수 없습니다.
  notify({ type: "home_visit", recipientId: "amy", actorId: UID, sourceId: "2026-10-14", homeOwnerId: "amy", excerpt: "old visit" });
  notify({ type: "home_visit", recipientId: "amy", actorId: UID, sourceId: DAY, homeOwnerId: "amy", excerpt: "hi amy" });
  notify({ type: "home_reply", recipientId: UID, actorId: "amy", sourceId: `e2-${UID}`, homeOwnerId: "amy", excerpt: "hey" });
  notify({ type: "home_visit", recipientId: "amy", actorId: "ben", sourceId: DAY, homeOwnerId: "amy" });

  // 신고는 운영 기록이라 남습니다.
  const reports = {
    "reports/report-1": { id: "report-1", reporterId: UID, targetType: "user", targetId: "amy", reason: "spam", status: "received" },
    "reports/report-2": { id: "report-2", reporterId: "amy", targetType: "user", targetId: UID, reason: "harassment", status: "received" },
    "reports/report-home": { id: "report-home", reporterId: "amy", targetType: "home_entry", targetId: UID, homeOwnerId: "amy", sourceId: `e2-${UID}`, evidence: { text: "hello amy", reply: null }, status: "received" },
  };
  Object.entries(reports).forEach(([path, row]) => put(path, row));
  // 다른 사람의 오늘 추천 스냅샷. 지우지 않고 읽을 때 거릅니다(GET /api/matching/daily 의 isDiscoverable).
  const othersDailyMatch = { date: DAY, recommendations: [{ partnerId: UID, icebreaker: "Hi leaver!" }, { partnerId: "ben" }] };
  put(`dailyMatches/amy/days/${DAY}`, othersDailyMatch);
  return { reports, othersDailyMatch };
}

/** 값 어디에든 uid 가 그대로 들어 있는가(문자열 값, 배열 항목, 객체 키). */
function mentions(value, uid) {
  if (value === uid) return true;
  if (Array.isArray(value)) return value.some((item) => mentions(item, uid));
  if (value && typeof value === "object") return Object.entries(value).some(([key, item]) => key === uid || mentions(item, uid));
  return false;
}

const hasTree = (db, path) => [...db.rows.keys()].some((key) => key === path || key.startsWith(path + "/"));
const counters = (row, ...fields) => Object.fromEntries(fields.map((field) => [field, row[field]]));

function assertCleanWorld(db, { reports, othersDailyMatch }) {
  // 나를 가리키는 문서가 하나도 남지 않습니다. 신고와 다른 사람의 지난 추천 스냅샷만 예외입니다.
  const leftovers = [...db.rows]
    .filter(([path]) => !path.startsWith("reports/") && !path.startsWith("dailyMatches/amy/"))
    .filter(([path, row]) => path.split("/").includes(UID) || mentions(row, UID))
    .map(([path]) => path);
  assert.deepEqual(leftovers, []);

  for (const collection of ["profiles", "matchingPreferences", "dailyMatches", "savedPhrases", "dmPolicies", "aiUsage", "writeQuotas", "notifications", "homes", "homeFavorites", "homeQuotas"]) {
    assert.equal(hasTree(db, `${collection}/${UID}`), false, collection);
  }
  for (const path of [`likes/${UID}_amy`, `likes/ben_${UID}`, `follows/${UID}_ben`, `follows/amy_${UID}`, `blocks/${UID}_cat`, `blocks/cat_${UID}`, `dmRequestCooldowns/${UID}_amy`, `dmRequestCooldowns/ben_${UID}`]) {
    assert.equal(db.rows.has(path), false, path);
  }
  for (const id of ["conv-a", "conv-b", "conv-c"]) assert.equal(hasTree(db, `conversations/${id}`), false, id);
  // 내 글은 남의 댓글·좋아요까지 함께 사라집니다(그 문서들에는 내 uid 가 없어 위 검사로는 잡히지 않습니다).
  for (const n of [1, 2, 3]) assert.equal(hasTree(db, `posts/post-${UID}-${n}`), false);
  assert.equal(hasTree(db, `homes/amy/entries/e2-${UID}`), false);
  assert.equal(hasTree(db, `homes/cat/entries/e1-${UID}`), false);

  // 다른 사람의 것은 남습니다.
  const keptNotifications = [
    { type: "follow", recipientId: "amy", actorId: "ben", sourceId: "amy" },
    { type: "message", recipientId: "ben", actorId: "amy", sourceId: "conv-d" },
    { type: "post_like", recipientId: "amy", actorId: "ben", sourceId: "post-amy" },
    { type: "home_visit", recipientId: "amy", actorId: "ben", sourceId: DAY },
  ].map((event) => `notifications/${event.recipientId}/items/${notificationDocumentId(event)}`);
  for (const path of [
    "profiles/amy", "profiles/ben", "profiles/cat",
    "likes/amy_ben", "follows/ben_amy", "blocks/amy_cat", "dmRequestCooldowns/amy_ben",
    "conversations/conv-d", "conversations/conv-d/messages/m1",
    "posts/post-amy", "posts/post-amy/reactions/ben", "posts/post-amy/replies/reply-ben-answer", "posts/post-amy/replies/reply-amy-2",
    "posts/post-ben", "posts/post-cat-1", "posts/post-cat-2",
    "homes/amy", "homes/amy/entries/e1-ben", "homes/amy/entries/e1-ben/hearts/amy", "homes/amy/entries/e3-cat",
    "homes/amy/stamps/ben", "homes/amy/photos/frame", "homes/cat/entries/e2-cat", "homeFavorites/amy/items/ben",
    ...keptNotifications,
  ]) {
    assert.ok(db.rows.has(path), "kept: " + path);
  }
  for (const [path, row] of Object.entries(reports)) assert.deepEqual(db.rows.get(path), row, path);
  assert.deepEqual(db.rows.get(`dailyMatches/amy/days/${DAY}`), othersDailyMatch);

  // 숫자는 남은 문서와 맞습니다.
  assert.deepEqual(counters(db.rows.get("posts/post-amy"), "likes", "comments", "corrections"), { likes: 1, comments: 2, corrections: 0 });
  assert.deepEqual(counters(db.rows.get("posts/post-ben"), "likes", "comments", "corrections"), { likes: 0, comments: 0, corrections: 0 });
  assert.deepEqual(counters(db.rows.get("posts/post-cat-1"), "likes", "comments", "corrections"), { likes: 0, comments: 0, corrections: 0 });
  assert.equal(db.rows.get("homes/amy/entries/e1-ben").heartCount, 1);
  assert.equal(db.rows.get("homes/amy/entries/e3-cat").heartCount, 0);
  assert.equal(db.rows.get("homes/cat/entries/e2-cat").heartCount, 0);
  // 고정해 둔 내 글과 전시해 둔 내 선물이 내려갑니다. 그 밖의 집 설정은 그대로입니다.
  assert.deepEqual(db.rows.get("homes/amy"), { visibility: "everyone", pinnedId: "", displayedGiftId: "", question: "" });
}

/** 실제 Express 경로에 가짜 requireUser·auth 를 붙입니다. requireUser 는 서버처럼 active 가 아닌 계정을 403 으로 막습니다. */
async function startApp(t, db, { deleteUser, requireUser } = {}) {
  class ApiError extends Error {
    constructor(status, code, message, details) {
      super(message);
      Object.assign(this, { status, code, details });
    }
  }
  const deletedUsers = [];
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = "test-request";
    next();
  });
  registerAccountRoutes(app, {
    db,
    auth: {
      deleteUser:
        deleteUser ??
        (async (uid) => {
          deletedUsers.push(uid);
        }),
    },
    requireUser:
      requireUser ??
      (async (req, _res, next) => {
        const uid = req.get("test-user");
        if (!uid) return next(new ApiError(401, "AUTH_REQUIRED", "로그인이 필요합니다."));
        const snapshot = await db.collection("profiles").doc(uid).get();
        if (!snapshot.exists || snapshot.data().accountStatus !== "active") {
          return next(new ApiError(403, "ACCOUNT_RESTRICTED", "사용이 제한된 계정입니다."));
        }
        req.auth = { uid, profile: snapshot.data() };
        return next();
      }),
    success: (res, _req, data) => res.json({ data }),
    ApiError,
    clearSessionCookie: (res) => res.clearCookie("lingoloop_session", { httpOnly: true, secure: false, sameSite: "lax", path: "/" }),
    nowIso: () => new Date().toISOString(),
  });
  app.use((error, _req, res, _next) => {
    void _next;
    res.status(error.status || 500).json({
      error: { code: error.code || "INTERNAL_ERROR", message: error.message, ...(error.details === undefined ? {} : { details: error.details }) },
    });
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const call = async (user, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/account`, {
      method: "DELETE",
      headers: { "content-type": "application/json", ...(user ? { "test-user": user } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, cookie: response.headers.get("set-cookie"), body: await response.json() };
  };
  return { call, deletedUsers };
}

const loggedErrors = (mock) => mock.mock.calls.map((call) => JSON.parse(call.arguments[0]));

test("확인 문구가 정확히 DELETE 가 아니면 422 이고 아무것도 건드리지 않는다", async (t) => {
  const db = memoryFirestore();
  seedWorld(db);
  const before = db.dump();
  const { call, deletedUsers } = await startApp(t, db);
  for (const body of [undefined, {}, { confirm: "delete" }, { confirm: "DELETE " }, { confirm: true }, ["DELETE"]]) {
    const response = await call(UID, body);
    assert.equal(response.status, 422, JSON.stringify(body));
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
    assert.deepEqual(response.body.error.details, { field: "confirm" });
    assert.equal(response.cookie, null);
  }
  assert.equal(ACCOUNT_DELETE_CONFIRMATION, "DELETE");
  assert.deepEqual(deletedUsers, []);
  assert.deepEqual(db.dump(), before);
});

test("계정을 지우면 로그인 수단, 내 데이터, 양방향 관계, 대화가 사라지고 남의 글 숫자가 맞춰지며 쿠키가 지워진다", async (t) => {
  const db = memoryFirestore();
  const world = seedWorld(db);
  const { call, deletedUsers } = await startApp(t, db);
  const response = await call(UID, { confirm: "DELETE" });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, { deleted: true });
  assert.match(response.cookie, /^lingoloop_session=;/);
  assert.match(response.cookie, /Expires=Thu, 01 Jan 1970/);
  assert.deepEqual(deletedUsers, [UID]);
  assertCleanWorld(db, world);
});

test("다시 돌려도 결과가 같고(숫자를 두 번 빼지 않음), 한 쪽을 작게 나눠 읽어도 결과가 같다", async () => {
  const reference = memoryFirestore();
  const world = seedWorld(reference);
  await deleteAccountData(reference, UID);
  assertCleanWorld(reference, world);
  const cleaned = reference.dump();
  await deleteAccountData(reference, UID);
  assert.deepEqual(reference.dump(), cleaned);

  // 한 쪽 크기 1·2 는 페이지 넘김, 커서 문서를 지운 뒤 이어 읽기, 같은 조회 되풀이를 모두 지나갑니다.
  for (const options of [{ pageSize: 2, concurrency: 2 }, { pageSize: 1, concurrency: 1 }]) {
    const paged = memoryFirestore();
    seedWorld(paged);
    await deleteAccountData(paged, UID, options);
    assert.deepEqual(paged.dump(), cleaned, JSON.stringify(options));
  }
});

test("로그인 수단을 지우지 못하면 데이터는 그대로이고 계정은 active 로 돌아와 다시 시도할 수 있다", async (t) => {
  const db = memoryFirestore();
  const world = seedWorld(db);
  const before = db.dump();
  const errors = t.mock.method(console, "error", () => {});
  const failing = await startApp(t, db, {
    deleteUser: async () => {
      throw Object.assign(new Error("Caller does not have permission"), { code: "auth/insufficient-permission" });
    },
  });
  const response = await failing.call(UID, { confirm: "DELETE" });
  assert.equal(response.status, 503);
  assert.equal(response.body.error.code, "ACCOUNT_DELETE_FAILED");
  assert.equal(response.body.error.message, "계정을 지우지 못했어요. 잠시 후 다시 시도해 주세요.");
  assert.equal(response.cookie, null);

  const after = db.dump();
  // 되살릴 때 updatedAt 만 바뀝니다.
  const restored = { ...after[`profiles/${UID}`] };
  const seeded = { ...before[`profiles/${UID}`] };
  delete restored.updatedAt;
  delete seeded.updatedAt;
  assert.deepEqual(restored, seeded);
  assert.equal(restored.accountStatus, "active");
  delete after[`profiles/${UID}`];
  delete before[`profiles/${UID}`];
  assert.deepEqual(after, before);
  assert.deepEqual(
    loggedErrors(errors).map(({ code, uid, cause, requestId }) => ({ code, uid, cause, requestId })),
    [{ code: "ACCOUNT_DELETE_FAILED", uid: UID, cause: "auth/insufficient-permission", requestId: "test-request" }],
  );

  const working = await startApp(t, db);
  assert.equal((await working.call(UID, { confirm: "DELETE" })).status, 200);
  assertCleanWorld(db, world);
});

test("로그인 수단이 이미 없으면(auth/user-not-found) 지운 것으로 보고 데이터를 지운다", async (t) => {
  const db = memoryFirestore();
  const world = seedWorld(db);
  const { call } = await startApp(t, db, {
    deleteUser: async () => {
      throw Object.assign(new Error("There is no user record"), { code: "auth/user-not-found" });
    },
  });
  const response = await call(UID, { confirm: "DELETE" });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, { deleted: true });
  assertCleanWorld(db, world);
});

test("데이터 정리가 중간에 멈추면 uid 를 로그에 남기고 오류로 답하며, 계정은 멈춘 채 남고 다시 돌리면 마저 지운다", async (t) => {
  const db = memoryFirestore();
  const world = seedWorld(db);
  const errors = t.mock.method(console, "error", () => {});
  const { call, deletedUsers } = await startApp(t, db);
  db.fail((operation, path) => operation === "recursiveDelete" && path === `homes/${UID}`);

  const response = await call(UID, { confirm: "DELETE" });
  assert.equal(response.status, 500);
  assert.equal(response.body.error.code, "ACCOUNT_DELETE_INCOMPLETE");
  // 로그인 수단은 이미 지웠으므로 쿠키도 지웁니다.
  assert.match(response.cookie, /^lingoloop_session=;/);
  assert.deepEqual(deletedUsers, [UID]);
  const [logged, ...rest] = loggedErrors(errors);
  assert.deepEqual(rest, []);
  assert.equal(logged.code, "ACCOUNT_DATA_DELETE_FAILED");
  assert.equal(logged.uid, UID);
  assert.equal(logged.stage, "ownedDocuments");
  assert.equal(logged.requestId, "test-request");
  assert.equal(logged.cause, 14);

  // 프로필은 "deleting" 으로 남아 계정이 계속 막히고, 앞 단계는 이미 끝나 있습니다.
  assert.equal(db.rows.get(`profiles/${UID}`).accountStatus, "deleting");
  assert.equal(hasTree(db, "conversations/conv-a"), false);
  assert.equal(hasTree(db, `homes/${UID}`), true);
  assert.equal((await call(UID, { confirm: "DELETE" })).status, 403);

  await deleteAccountData(db, UID);
  assertCleanWorld(db, world);
});

test("겹친 삭제 요청은 하나만 지나가고 나머지는 409 로 로그인 수단을 건드리지 않는다", async (t) => {
  const db = memoryFirestore();
  seedWorld(db);
  db.rows.get(`profiles/${UID}`).accountStatus = "deleting";
  // requireUser 를 지난 뒤 다른 요청이 먼저 상태를 바꾼 경우입니다.
  const { call, deletedUsers } = await startApp(t, db, {
    requireUser: (req, _res, next) => {
      req.auth = { uid: req.get("test-user") };
      next();
    },
  });
  const response = await call(UID, { confirm: "DELETE" });
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, "ACCOUNT_DELETE_IN_PROGRESS");
  assert.deepEqual(deletedUsers, []);
  assert.equal(db.rows.get(`profiles/${UID}`).accountStatus, "deleting");
});

test("다시 돌릴 때 빈 값이나 경로 같은 uid 는 거절한다", async () => {
  const db = memoryFirestore();
  seedWorld(db);
  const before = db.dump();
  for (const uid of [undefined, "", "a/b", ".", "..", "__name__"]) {
    await assert.rejects(deleteAccountData(db, uid), /invalid uid/, String(uid));
  }
  assert.deepEqual(db.dump(), before);
});

test("서버는 삭제 경로를 로그인 확인 뒤에 두고, 쿠키를 로그아웃과 같은 옵션으로 지우며, 지운 프로필을 되살리지 않는다", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  assert.match(source, /import \{ registerAccountRoutes \} from "\.\/account-deletion\.mjs";/);
  assert.match(source, /registerAccountRoutes\(app, \{ db, auth, requireUser, success, ApiError, clearSessionCookie, nowIso \}\);/);

  const issue = source.slice(source.indexOf("async function issueSession"), source.indexOf("function clearSessionCookie"));
  const clear = source.slice(source.indexOf("function clearSessionCookie"), source.indexOf("const sessionVerifications"));
  assert.match(clear, /res\.clearCookie\(COOKIE_NAME, \{/);
  for (const option of ["httpOnly: true", "secure: COOKIE_SECURE", 'sameSite: "lax"', 'path: "/"']) {
    assert.ok(issue.includes(option) && clear.includes(option), option);
  }
  const logout = source.slice(source.indexOf('app.post("/api/auth/logout"'), source.indexOf('app.get("/api/languages"'));
  assert.match(logout, /clearSessionCookie\(res\);/);

  // 세션 확인은 60초 동안 캐시됩니다. 그 사이 온 요청이 지운 프로필을 기본값으로 다시 만들면 안 됩니다.
  const ensure = source.slice(source.indexOf("async function ensureProfile"), source.indexOf("function assertEnabledSignInProvider"));
  assert.match(ensure, /auth\.getUser\(uid\)[\s\S]*"auth\/user-not-found"[\s\S]*401, "INVALID_SESSION"[\s\S]*reference\.create\(profile\)/);
  // 이미 있는 프로필을 읽는 길(매 요청)에서는 Identity Platform 을 부르지 않습니다.
  assert.ok(ensure.indexOf("auth.getUser(uid)") > ensure.indexOf("return { ...stored, ...normalizedAvatar, ...presencePatch };"));
});

test("지운 사람(또는 지우는 중인 사람)은 다른 사람의 저장된 오늘의 추천에서 읽을 때 빠진다", async () => {
  assert.equal(isDiscoverable(undefined), false);
  assert.equal(isDiscoverable({ accountStatus: "deleting", onboardedAt: AT }), false);
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const daily = source.slice(source.indexOf('app.get("/api/matching/daily"'), source.indexOf('app.get("/api/blocks"'));
  assert.match(daily, /profilesByIds\(\(stored\.recommendations \|\| \[\]\)\.map\(\(item\) => item\.partnerId\)\)/);
  assert.match(daily, /\.filter\(\(item\) => isDiscoverable\(profileMap\.get\(item\.partnerId\)\)\)/);
});
