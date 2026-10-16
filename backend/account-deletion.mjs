/**
 * 계정 삭제(탈퇴). 앱스토어 심사는 앱 안에서 계정을 지울 수 있어야 통과합니다.
 *
 * 순서가 보증의 핵심입니다. 어디서 실패해도 "반쯤 지워졌는데 아직 쓸 수 있는 계정"이 남지 않습니다.
 *  1. profiles/{uid}.accountStatus 를 "deleting" 으로 바꿉니다. requireUser 가 active 가 아닌 계정을
 *     403 으로 막으므로 이 순간부터 계정이 멈춥니다. 다른 사람의 추천·검색(isDiscoverable)과 프로필·집
 *     (accountStatus 확인)에서도 바로 빠집니다.
 *  2. 로그인 수단(Identity Platform 사용자)을 지웁니다. 실패하면 데이터는 건드리지 않고 active 로 되돌립니다.
 *  3. Firestore 데이터를 지웁니다(deleteAccountData). 프로필은 맨 마지막입니다. 중간에 실패하면 uid 를 담은
 *     구조화 로그를 남기고 오류로 답합니다 — 로그인 수단이 이미 없어 계정은 쓸 수 없고, 같은 함수를 다시
 *     돌리면 남은 것만 마저 지웁니다(모든 단계가 "있는 것만 지우기"라 몇 번을 돌려도 결과가 같습니다).
 *
 * 신고(reports)는 지우지 않습니다. 다른 사람을 지키는 운영 기록입니다.
 *
 * server.mjs 는 불러오는 순간 Firebase 에 붙고 포트를 열어서, 경로와 정리 함수를 이 파일에 두고
 * 필요한 것을 넘겨받습니다(homes.mjs 의 registerHomeRoutes 와 같은 방식).
 */

/** 본문 { confirm: "DELETE" } 가 있어야 지웁니다. 잘못 보낸 요청 하나로 계정이 사라지지 않게 합니다. */
export const ACCOUNT_DELETE_CONFIRMATION = "DELETE";

/** 한 번에 읽는 문서 수. 한 쪽을 일괄 삭제 한 번(최대 500건)에 담을 수 있게 둡니다. */
const PAGE_SIZE = 200;
/** 사람·글을 동시에 몇 개까지 처리하는가. 탈퇴 한 번이 다른 요청을 밀어내지 않을 만큼만 둡니다. */
const CONCURRENCY = 8;
const BATCH_LIMIT = 500;

/**
 * 문서 id 가 uid 인 그 사람만의 문서. 하위 컬렉션(days·items·entries·hearts·photos·stamps)까지 통째로 지웁니다.
 * 프로필은 여기 없습니다 — 다른 정리가 모두 끝난 뒤 맨 마지막에 지웁니다.
 */
const OWNED_DOCUMENTS = [
  "matchingPreferences",
  "dailyMatches",
  "savedPhrases",
  // 대화에서 받은 교정(corrections/{uid}/items). 부모 문서 없이 items 만 있어도 recursiveDelete 가 지웁니다.
  "corrections",
  "dmPolicies",
  "aiUsage",
  "writeQuotas",
  "notifications",
  "homes",
  "homeFavorites",
  "homeQuotas",
];

/** 두 사람 사이의 관계 문서(id 가 a_b). 양쪽 필드로 찾아 내가 보낸 것과 받은 것을 모두 지웁니다. */
const RELATIONSHIPS = [
  ["likes", "fromUserId"],
  ["likes", "toUserId"],
  ["follows", "fromUserId"],
  ["follows", "toUserId"],
  ["blocks", "blockerId"],
  ["blocks", "blockedId"],
  ["dmRequestCooldowns", "senderId"],
  ["dmRequestCooldowns", "recipientId"],
];

/** 어느 단계에서 멈췄는지 로그에 남기려고 단계 이름을 붙여 다시 던집니다. */
export class AccountDeletionError extends Error {
  constructor(stage, cause) {
    super(`account data deletion stopped at ${stage}: ${cause?.message || String(cause)}`, { cause });
    this.name = "AccountDeletionError";
    this.stage = stage;
  }
}

/**
 * uid 의 Firestore 데이터를 지웁니다. 몇 번을 다시 돌려도 결과가 같습니다.
 *
 * 다른 사람에게 보이는 것부터 지웁니다(대화 → 글 → 남의 글의 댓글·좋아요 → 관계 → 남의 알림함·교정함·집).
 * 그래서 중간에 멈춰도 남는 것은 대부분 나만 보는 데이터이고, 프로필은 "deleting" 으로 남아 계속 숨겨집니다.
 *
 * 세 번째 인자는 조회 크기와 동시 처리 수입니다. 테스트가 작은 값으로 페이지 넘김을 확인합니다.
 */
export async function deleteAccountData(db, uid, { pageSize = PAGE_SIZE, concurrency = CONCURRENCY } = {}) {
  // 운영자가 다시 돌릴 때 빈 값이나 경로("a/b")를 넘기면 엉뚱한 문서를 지웁니다. 규칙은 Firestore 문서 id
  // 규칙만 봅니다 — 더 좁히면 로그인 수단을 지운 뒤에야 거절해 계정이 "deleting" 에 묶일 수 있습니다.
  if (typeof uid !== "string" || !uid || uid.length > 128 || uid.includes("/") || uid === "." || uid === ".." || /^__.*__$/.test(uid)) {
    throw new Error("deleteAccountData: invalid uid");
  }
  const options = { pageSize, concurrency };
  await step("conversations", () => deleteConversations(db, uid, options));
  await step("posts", () => deleteOwnPosts(db, uid, options));
  await step("postActivity", () => deletePostActivity(db, uid, options));
  await step("relationships", () => deleteRelationships(db, uid, options));
  await step("otherUsers", () => deleteTracesInOtherUsers(db, uid, options));
  await step("ownedDocuments", () => deleteOwnedDocuments(db, uid));
  await step("profile", () => db.recursiveDelete(db.collection("profiles").doc(uid)));
}

/**
 * DELETE /api/account — 본문 { confirm: "DELETE" }. 응답은 { deleted: true } 이고,
 * 로그아웃(POST /api/auth/logout)과 같은 이름·옵션으로 세션 쿠키를 지웁니다.
 */
export function registerAccountRoutes(app, { db, auth, requireUser, success, ApiError, clearSessionCookie, nowIso }) {
  app.delete("/api/account", requireUser, async (req, res) => {
    if (req.body?.confirm !== ACCOUNT_DELETE_CONFIRMATION) {
      throw new ApiError(422, "VALIDATION_ERROR", "계정을 지우려면 삭제를 한 번 더 확인해 주세요.", { field: "confirm" });
    }
    const uid = req.auth.uid;
    const profileReference = db.collection("profiles").doc(uid);
    const logFailure = (code, error, extra = {}) =>
      console.error(
        JSON.stringify({
          requestId: req.requestId,
          code,
          uid,
          ...extra,
          cause: error?.code ?? error?.cause?.code ?? "unknown",
          message: error?.message,
        }),
      );

    // 1. 계정을 먼저 멈춥니다. 같은 계정의 삭제 요청이 겹치면 하나만 지나갑니다.
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(profileReference);
      if (!snapshot.exists || snapshot.data().accountStatus !== "active") {
        throw new ApiError(409, "ACCOUNT_DELETE_IN_PROGRESS", "계정을 지우는 중이에요. 잠시 후 다시 확인해 주세요.");
      }
      transaction.update(profileReference, { accountStatus: "deleting", updatedAt: nowIso() });
    });

    // 2. 로그인 수단을 지웁니다. 이미 없으면 지운 것으로 봅니다. 그 밖의 실패(권한·장애)면 데이터를
    //    하나도 건드리지 않은 채 계정을 되살립니다 — 사용자는 그대로 쓰다가 나중에 다시 시도하면 됩니다.
    try {
      await auth.deleteUser(uid);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") {
        logFailure("ACCOUNT_DELETE_FAILED", error);
        await db
          .runTransaction(async (transaction) => {
            const snapshot = await transaction.get(profileReference);
            if (snapshot.exists && snapshot.data().accountStatus === "deleting") {
              transaction.update(profileReference, { accountStatus: "active", updatedAt: nowIso() });
            }
          })
          // 되돌리지도 못하면 계정이 "deleting" 에 묶입니다. 운영자가 찾을 수 있게 남깁니다.
          .catch((restoreError) => logFailure("ACCOUNT_DELETE_RESTORE_FAILED", restoreError));
        throw new ApiError(503, "ACCOUNT_DELETE_FAILED", "계정을 지우지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    }

    // 3. 데이터를 지웁니다. 로그인 수단은 이미 없으므로 실패해도 쿠키를 지우고, 남은 데이터는
    //    로그의 uid 로 deleteAccountData 를 다시 돌려 마저 지웁니다.
    try {
      await deleteAccountData(db, uid);
    } catch (error) {
      logFailure("ACCOUNT_DATA_DELETE_FAILED", error, { stage: error?.stage ?? "unknown" });
      clearSessionCookie(res);
      throw new ApiError(
        500,
        "ACCOUNT_DELETE_INCOMPLETE",
        "계정은 지웠지만 남은 기록을 모두 지우지 못했어요. 남은 기록은 운영팀이 확인해 지울게요.",
      );
    }
    clearSessionCookie(res);
    return success(res, req, { deleted: true });
  });
}

async function step(stage, run) {
  try {
    await run();
  } catch (error) {
    throw new AccountDeletionError(stage, error);
  }
}

/**
 * 내가 들어 있는 대화. 대화 문서와 메시지를 통째로 지웁니다 — 상대 화면에서도 대화가 사라집니다
 * (제품 결정: 탈퇴한 사람의 메시지를 상대 쪽에도 남기지 않습니다).
 */
async function deleteConversations(db, uid, { pageSize, concurrency }) {
  const query = db.collection("conversations").where("memberIds", "array-contains", uid).limit(pageSize);
  await drain(query, (documents) => eachLimited(documents, concurrency, (document) => db.recursiveDelete(document.ref)));
}

/** 내가 쓴 글. 달린 댓글·교정(replies)과 좋아요(reactions)까지 함께 지웁니다. */
async function deleteOwnPosts(db, uid, { pageSize, concurrency }) {
  // 글에는 사진·음성 data URI 가 들어 있어 이름만 읽습니다(select).
  const query = db.collection("posts").where("authorId", "==", uid).select().limit(pageSize);
  await drain(query, (documents) => eachLimited(documents, concurrency, (document) => db.recursiveDelete(document.ref)));
}

/**
 * 남의 글에 남긴 댓글·교정과 좋아요. 지우면서 그 글의 숫자(comments·corrections·likes)를 같은
 * transaction 에서 줄입니다.
 *
 * 댓글은 posts/{postId}/replies, 좋아요는 posts/{postId}/reactions/{uid} 에 있어서 한 번에 찾으려면
 * collection group 색인이 필요한데 운영 Firestore 에는 없습니다. 그래서 글을 이름 순서로 훑습니다.
 * 지금 규모에서는 충분합니다 — 서비스가 커지면 replies.authorId·reactions.userId collection group
 * 색인을 만들고 그 조회로 바꿉니다.
 *
 * 내 댓글에 다른 사람이 단 답글은 남깁니다(그 사람의 글입니다). 화면은 부모가 없는 답글을 맨 위
 * 댓글로 보여 줍니다 — 차단한 사람의 댓글이 목록에서 빠질 때와 같습니다.
 */
async function deletePostActivity(db, uid, { pageSize, concurrency }) {
  await forEachPage(db.collection("posts").select(), pageSize, async (posts) => {
    const reactions = await db.getAll(...posts.map((post) => post.ref.collection("reactions").doc(uid)));
    const liked = reactions.filter((reaction) => reaction.exists);
    await eachLimited(liked, concurrency, (reaction) => removeReaction(db, reaction.ref.parent.parent, reaction.ref));
    await eachLimited(posts, concurrency, (post) =>
      drain(post.ref.collection("replies").where("authorId", "==", uid).select().limit(pageSize), async (replies) => {
        for (const reply of replies) await removeReply(db, post.ref, reply.ref);
      }),
    );
  });
}

/** 댓글 하나를 지우고 글의 숫자를 줄입니다. 이미 지워졌으면 아무것도 하지 않습니다(다시 돌려도 두 번 빼지 않음). */
function removeReply(db, postReference, replyReference) {
  return db.runTransaction(async (transaction) => {
    const [post, reply] = await transaction.getAll(postReference, replyReference);
    if (!reply.exists) return;
    transaction.delete(replyReference);
    if (!post.exists) return;
    // 교정은 corrections, 그 밖의 댓글은 comments 로 셉니다(POST /api/posts/:postId/replies 와 같은 규칙).
    const counter = reply.data().kind === "correction" ? "corrections" : "comments";
    transaction.update(postReference, { [counter]: decremented(post.data()[counter]) });
  });
}

function removeReaction(db, postReference, reactionReference) {
  return db.runTransaction(async (transaction) => {
    const [post, reaction] = await transaction.getAll(postReference, reactionReference);
    if (!reaction.exists) return;
    transaction.delete(reactionReference);
    if (post.exists) transaction.update(postReference, { likes: decremented(post.data().likes) });
  });
}

async function deleteRelationships(db, uid, { pageSize }) {
  for (const [collection, field] of RELATIONSHIPS) {
    const query = db.collection(collection).where(field, "==", uid).limit(pageSize);
    await drain(query, (documents) => deleteDocuments(db, documents.map((document) => document.ref)));
  }
}

/**
 * 다른 사람의 공간에 남은 흔적: 알림함에 남긴 알림, 받은 교정함에 남긴 대화 교정, 집 방명록에 쓴 글,
 * 누른 하트, 남긴 방문 도장, 내 집을 즐겨찾기한 기록.
 *
 * 알림 문서 id 는 결정적이지만(notificationDocumentId) 방문 알림은 그날 날짜가 sourceId 라 지난 날의
 * 알림을 다시 계산할 수 없고, 알림에는 내가 쓴 글의 미리보기(excerpt)도 들어 있습니다. 그래서 알림함마다
 * actorId 로 찾아 모두 지웁니다(차단 정리 cleanupBlockedPair 와 같은 조회). 내 집에서 다른 사람끼리 생긴
 * 알림(homeOwnerId 가 나)도 지웁니다 — 집이 사라지면 눌러도 갈 곳이 없습니다.
 * 대화 교정(corrections/{owner}/items)에는 내가 고쳐 쓴 문장(fixed)이 들어 있어 fromUserId 로 찾아 지웁니다.
 * 대화는 이미 지웠으므로 교정도 남기지 않습니다.
 *
 * homes/{owner}·notifications/{uid}·corrections/{uid}·homeFavorites/{uid} 는 부모 문서 없이 하위 컬렉션만
 * 있는 경우가 많아 컬렉션을 조회해서는 찾을 수 없습니다. 모두 사람 uid 가 id 이므로 프로필을 훑어 사람마다 봅니다.
 * 이것도 collection group 색인이 없어서 고른 방법입니다 — 서비스가 커지면 items.actorId·items.fromUserId·
 * entries.authorId collection group 색인을 만들고 그 조회로 바꿉니다.
 */
async function deleteTracesInOtherUsers(db, uid, { pageSize, concurrency }) {
  // 프로필에는 사진 data URI 가 들어 있어 이름만 읽습니다.
  await forEachPage(db.collection("profiles").select(), pageSize, async (profiles) => {
    const others = profiles.map((profile) => profile.id).filter((id) => id !== uid);
    if (!others.length) return;
    await eachLimited(others, concurrency, async (ownerId) => {
      const inbox = db.collection("notifications").doc(ownerId).collection("items");
      for (const field of ["actorId", "homeOwnerId"]) {
        await drain(inbox.where(field, "==", uid).limit(pageSize), (documents) =>
          deleteDocuments(db, documents.map((document) => document.ref)),
        );
      }
      const corrections = db.collection("corrections").doc(ownerId).collection("items");
      await drain(corrections.where("fromUserId", "==", uid).limit(pageSize), (documents) =>
        deleteDocuments(db, documents.map((document) => document.ref)),
      );
      await removeHomeEntriesAndHearts(db, db.collection("homes").doc(ownerId), uid, pageSize);
    });
    await removeStampsAndFavorites(db, others, uid);
  });
}

/**
 * 한 집의 방명록에서 내가 쓴 글은 지우고(글에 달린 하트까지), 남의 글에 누른 하트는 지우며 heartCount 를
 * 줄입니다. 하트 문서에는 누른 사람 필드가 없고 id 가 uid 라서, 글마다 hearts/{uid} 를 확인합니다.
 */
async function removeHomeEntriesAndHearts(db, home, uid, pageSize) {
  await forEachPage(home.collection("entries").select("authorId"), pageSize, async (entries) => {
    const others = [];
    for (const entry of entries) {
      if (entry.data().authorId === uid) await removeHomeEntry(db, home, entry.ref);
      else others.push(entry);
    }
    if (!others.length) return;
    const hearts = await db.getAll(...others.map((entry) => entry.ref.collection("hearts").doc(uid)));
    for (const heart of hearts.filter((snapshot) => snapshot.exists)) {
      await removeHeart(db, heart.ref.parent.parent, heart.ref);
    }
  });
}

/**
 * 내가 쓴 방명록 글. 집주인이 고정해 둔 글이면 고정을 먼저 풉니다(DELETE 방명록과 같은 규칙).
 * 고정을 먼저 풀어야 중간에 멈췄다 다시 돌릴 때도 없는 글을 가리키는 고정이 남지 않습니다.
 * 집주인의 답글은 글 안에 있어 함께 사라집니다 — 대화와 같은 결정입니다.
 */
async function removeHomeEntry(db, home, entryReference) {
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(home);
    if (snapshot.exists && snapshot.data().pinnedId === entryReference.id) transaction.update(home, { pinnedId: "" });
  });
  await db.recursiveDelete(entryReference);
}

function removeHeart(db, entryReference, heartReference) {
  return db.runTransaction(async (transaction) => {
    const [entry, heart] = await transaction.getAll(entryReference, heartReference);
    if (!heart.exists) return;
    transaction.delete(heartReference);
    if (entry.exists) transaction.update(entryReference, { heartCount: decremented(entry.data().heartCount) });
  });
}

/**
 * 내가 남긴 방문 도장(homes/{owner}/stamps/{uid})과, 다른 사람이 내 집을 즐겨찾기한 기록
 * (homeFavorites/{owner}/items/{uid}). 둘 다 id 가 uid 라 한 번에 읽어 있는 것만 지웁니다.
 * 집주인이 내 선물을 전시해 두었으면(displayedGiftId 는 도장 id = uid) 전시도 내립니다.
 */
async function removeStampsAndFavorites(db, ownerIds, uid) {
  const stamps = ownerIds.map((ownerId) => db.collection("homes").doc(ownerId).collection("stamps").doc(uid));
  const favorites = ownerIds.map((ownerId) => db.collection("homeFavorites").doc(ownerId).collection("items").doc(uid));
  const snapshots = await db.getAll(...stamps, ...favorites);
  for (const stamp of snapshots.slice(0, ownerIds.length).filter((snapshot) => snapshot.exists)) {
    const home = stamp.ref.parent.parent;
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(home);
      if (snapshot.exists && snapshot.data().displayedGiftId === uid) transaction.update(home, { displayedGiftId: "" });
      transaction.delete(stamp.ref);
    });
  }
  const favorited = snapshots.slice(ownerIds.length).filter((snapshot) => snapshot.exists);
  await deleteDocuments(db, favorited.map((snapshot) => snapshot.ref));
}

async function deleteOwnedDocuments(db, uid) {
  for (const collection of OWNED_DOCUMENTS) await db.recursiveDelete(db.collection(collection).doc(uid));
}

/**
 * 조회에 걸린 문서를 모두 처리할 때까지 같은 조회를 되풀이합니다. 처리한 문서는 지워져 다음 조회에
 * 나오지 않으므로 커서가 필요 없습니다. 이미 처리한 문서만 다시 나오면(지워지지 않으면) 끝없이 돌지 않고 멈춥니다.
 */
async function drain(query, handle) {
  const handled = new Set();
  for (;;) {
    const page = await query.get();
    if (page.empty) return;
    if (page.docs.every((document) => handled.has(document.ref.path))) {
      throw new Error("documents were not deleted: " + page.docs[0].ref.path);
    }
    page.docs.forEach((document) => handled.add(document.ref.path));
    await handle(page.docs);
  }
}

/**
 * 지우지 않고 훑을 컬렉션을 이름 순서로 한 쪽씩 넘깁니다. 커서는 이름이라 훑는 도중에 그 쪽의
 * 문서를 지워도(내 방명록 글) 다음 쪽이 이어집니다.
 */
async function forEachPage(query, pageSize, handle) {
  let cursor = null;
  for (;;) {
    let pageQuery = query.orderBy("__name__").limit(pageSize);
    if (cursor) pageQuery = pageQuery.startAfter(cursor);
    const page = await pageQuery.get();
    if (!page.empty) await handle(page.docs);
    if (page.size < pageSize) return;
    cursor = page.docs[page.docs.length - 1];
  }
}

/** items 마다 task 를 부르되 동시에 limit 개까지만 돌립니다. 실패하면 새 일을 시작하지 않고, 돌던 일이 끝난 뒤 첫 실패를 던집니다. */
async function eachLimited(items, limit, task) {
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const item = items[next];
      next += 1;
      try {
        await task(item);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  const results = await Promise.allSettled(Array.from({ length: Math.min(limit, items.length) }, worker));
  const failure = results.find((result) => result.status === "rejected");
  if (failure) throw failure.reason;
}

async function deleteDocuments(db, references) {
  for (let start = 0; start < references.length; start += BATCH_LIMIT) {
    const batch = db.batch();
    references.slice(start, start + BATCH_LIMIT).forEach((reference) => batch.delete(reference));
    await batch.commit();
  }
}

/** 숫자를 하나 줄이되 0 아래로 내려가지 않습니다. 깨진 값은 0 으로 봅니다. */
function decremented(value) {
  const current = Number(value);
  return Number.isFinite(current) ? Math.max(0, current - 1) : 0;
}
