import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("login throttling fingerprints raw tokens locally and persists only verified uids", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const authSection = source.slice(source.indexOf("const authTokenLimiter"), source.indexOf("app.use((req, res, next)"));
  const sessionSection = source.slice(source.indexOf('app.post("/api/auth/session"'), source.indexOf('app.get("/api/auth/me"'));

  assert.match(authSection, /authRateKey\("token", rawToken\)/);
  assert.match(authSection, /authTokenLimiter\.take\(key, AUTH_TOKEN_LOCAL_LIMIT\)/);
  assert.doesNotMatch(authSection, /req\.body\?\.email|Buffer\.from\(payload/);
  assert.doesNotMatch(authSection, /cf-connecting-ip|x-lingoloop-client-ip|req\.ip/);
  assert.match(authSection, /createHmac\("sha256", PROXY_SHARED_SECRET\)/);
  assert.match(authSection, /db\.collection\("_authRateLimits"\)/);
  assert.match(authSection, /db\.runTransaction/);
  assert.match(authSection, /expireAt: new Date\(next\.expireAtMillis\)/);
  assert.match(sessionSection, /safeSecret\([\s\S]*verifyRecentIdToken\(idToken\)[\s\S]*enforceVerifiedAuthLimit\(decoded\.uid\)/);
  assert.doesNotMatch(sessionSection, /enforceDistributedAuthLimit\([^)]*, 300\)|authRateIpKey/);

  const proxyValidation = source.indexOf('app.use("/api", (req, _res, next)');
  const authRoute = source.indexOf('app.post("/api/auth/session"');
  assert.ok(proxyValidation >= 0 && proxyValidation < authRoute, "proxy secret must be validated before auth throttling");
});

test("session checks verify once (cached), skip the duplicate user lookup and never log users out on outages", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const helper = source.slice(source.indexOf("async function sessionUser"), source.indexOf("async function requireUser"));

  assert.match(helper, /sessionVerifications\.verify\(cookie, \(value\) => auth\.verifySessionCookie\(value, true\)\)/);
  assert.doesNotMatch(helper, /auth\.getUser\(/);
  assert.match(helper, /isSessionRejection\(error\)[\s\S]*401, "INVALID_SESSION"[\s\S]*503, "AUTH_UNAVAILABLE"/);
  assert.match(source, /createSessionVerificationCache\(\{ ttlMs: 60_000, maxEntries: 5_000 \}\)/);
});

test("message writes and conversation reads keep safety state transactional", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const messages = source.slice(source.indexOf('app.patch("/api/conversations/:conversationId/mute"'), source.indexOf('app.get("/api/dm/privacy"'));

  assert.match(messages, /app\.patch\("\/api\/conversations\/:conversationId\/mute"/);
  assert.match(messages, /messagesQuery\.get\(\)/);
  assert.match(messages, /notificationsQuery\.get\(\)/);
  assert.match(messages, /transaction\.getAll\(\.\.\.notificationCandidates\.map/);
  assert.match(messages, /buildConversationReadPatch\(current, messages, req\.auth\.uid\)/);
  assert.match(messages, /matchesNotificationEvent\(document\.data\(\), notificationCandidates\[index\]\.eventId\)/);
  assert.doesNotMatch(messages, /transaction\.get\(messagesQuery\)|transaction\.get\(notificationsQuery\)/);
  assert.match(messages, /assertNotBlockedInTransaction\(transaction, req\.auth\.uid, \[recipientId\]/);
  assert.match(messages, /eventId: clientMessageId/);
  assert.match(messages, /lastMessageAt: timestamp/);
  assert.doesNotMatch(messages, /unread\[req\.auth\.uid\]\s*=\s*0/);
  assert.doesNotMatch(messages, /markConversationNotificationsRead/);
});

test("declining a message request transactionally removes its only child message and notification", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const route = source.slice(
    source.indexOf('app.delete("/api/conversations/:conversationId/request"'),
    source.indexOf('app.patch("/api/conversations/:conversationId/mute"'),
  );

  assert.match(route, /db\.runTransaction/);
  assert.match(route, /conversationStatus\(conversation\) !== "pending"/);
  assert.match(route, /conversation\.requestRecipientId !== req\.auth\.uid/);
  assert.match(route, /assertNotBlockedInTransaction\(transaction, req\.auth\.uid, \[senderId\]/);
  assert.match(route, /transaction\.get\(reference\.collection\("messages"\)\.limit\(2\)\)/);
  assert.match(route, /messagesSnapshot\.docs\.forEach\(\(document\) => transaction\.delete\(document\.ref\)\)/);
  assert.match(route, /removeNotification\(transaction,[\s\S]*type: "message_request"/);
  assert.match(route, /transaction\.delete\(reference\)/);
  assert.match(route, /dismissed: true/);
});

test("leaving a conversation hides it per member and new activity reopens it without deleting messages", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const createRoute = source.slice(source.indexOf('app.post("/api/conversations"'), source.indexOf('app.get("/api/conversations"'));
  const listRoute = source.slice(source.indexOf('app.get("/api/conversations"'), source.indexOf('app.post("/api/conversations/:conversationId/accept"'));
  const leaveRoute = source.slice(
    source.indexOf('app.delete("/api/conversations/:conversationId",'),
    source.indexOf('app.patch("/api/conversations/:conversationId/mute"'),
  );
  const messageRoute = source.slice(source.indexOf("async function createMessage"), source.indexOf('app.post("/api/conversations/:conversationId/messages"'));

  assert.match(createRoute, /hiddenBy: \[\]/);
  assert.match(createRoute, /isConversationHidden\(snapshot\.data\(\), req\.auth\.uid\)[\s\S]*FieldValue\.arrayRemove\(req\.auth\.uid\)/);
  assert.match(listRoute, /!isConversationHidden\(conversation, req\.auth\.uid\)/);
  assert.match(leaveRoute, /db\.runTransaction/);
  assert.match(leaveRoute, /conversationStatus\(conversation\) !== "accepted"/);
  assert.match(leaveRoute, /assertNotBlockedInTransaction\(transaction, req\.auth\.uid, \[partnerId\]/);
  assert.match(leaveRoute, /FieldValue\.arrayUnion\(req\.auth\.uid\)/);
  assert.match(leaveRoute, /\{ id, hidden: true \}/);
  assert.doesNotMatch(leaveRoute, /transaction\.delete/);
  assert.match(messageRoute, /hiddenBy: FieldValue\.arrayRemove\(recipientId\)/);
});

test("conversation creation decides DM policy and relationships in its create transaction", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const helper = source.slice(
    source.indexOf("async function directMessageDecisionInTransaction"),
    source.indexOf("async function profilesByIds"),
  );
  const route = source.slice(source.indexOf('app.post("/api/conversations"'), source.indexOf('app.get("/api/conversations"'));

  assert.match(helper, /transaction\.getAll\(\.\.\.references\)/);
  assert.match(helper, /decideDmRoute\(policy, relationships\)/);
  assert.doesNotMatch(helper, /\bdb\.getAll\(/);
  assert.match(
    route,
    /db\.runTransaction[\s\S]*transaction\.get\(reference\)[\s\S]*directMessageDecisionInTransaction\(transaction, req\.auth\.uid, partnerId\)[\s\S]*transaction\.create\(reference/,
  );
  assert.doesNotMatch(route, /await directMessageDecisionInTransaction\((?!transaction)/);
});

test("matches-only DMs use evidence the sender cannot regenerate, and declined senders cool down", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const helper = source.slice(
    source.indexOf("async function directMessageDecisionInTransaction"),
    source.indexOf("async function profilesByIds"),
  );
  const createRoute = source.slice(source.indexOf('app.post("/api/conversations"'), source.indexOf('app.get("/api/conversations"'));
  const declineRoute = source.slice(
    source.indexOf('app.delete("/api/conversations/:conversationId/request"'),
    source.indexOf('app.delete("/api/conversations/:conversationId",'),
  );

  assert.match(helper, /collection\("dailyMatches"\)\.doc\(recipientId\)/);
  assert.doesNotMatch(helper, /collection\("dailyMatches"\)\.doc\(senderId\)/);
  assert.match(helper, /dmRelationships\(\{/);
  // 새 요청(pending)을 만들 때만 거절 기록과 하루 한도를 봅니다. 모두 같은 transaction 안입니다.
  assert.match(
    createRoute,
    /if \(!snapshot\.exists && decision\.status === "pending"\) \{[\s\S]*transaction\.getAll\([\s\S]*dmRequestCooldowns[\s\S]*requestCooldownUntil[\s\S]*takeWriteQuota\(transaction, quotaSnapshot, "messageRequests"\)[\s\S]*transaction\.create\(reference/,
  );
  assert.match(declineRoute, /transaction\.set\(db\.collection\("dmRequestCooldowns"\)\.doc\(senderId \+ "_" \+ req\.auth\.uid\)/);
});

test("per-user daily write limits are taken inside each write transaction and never on reads", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
  const routes = [
    ["posts", section('app.post("/api/posts"', 'app.delete("/api/posts/:postId"')],
    ["replies", section('app.post("/api/posts/:postId/replies"', 'app.get("/api/corrections/received"')],
    ["reactions", section('app.post("/api/posts/:postId/like"', 'app.post("/api/conversations"')],
    ["reactions", section('app.post("/api/partners/:partnerId/like"', 'app.post("/api/partners/:partnerId/follow"')],
    ["follows", section('app.post("/api/partners/:partnerId/follow"', 'app.get("/api/partners/:partnerId/follow-counts"')],
    ["reports", section('app.post("/api/reports"', 'app.get("/api/account/verification"')],
    ["messageRequests", section('app.post("/api/conversations"', 'app.get("/api/conversations"')],
  ];
  for (const [action, route] of routes) {
    assert.match(
      route,
      new RegExp('db\\.runTransaction[\\s\\S]*writeQuotaReference\\(req\\.auth\\.uid\\)[\\s\\S]*takeWriteQuota\\(transaction, quotaSnapshot, "' + action + '"\\)'),
      action,
    );
  }
  // 위 경로 말고는 쓰지 않습니다(읽기에는 한도를 걸지 않습니다).
  assert.equal(source.match(/takeWriteQuota\(transaction, quotaSnapshot, "/g).length, routes.length);
});

test("notification reads compare event identity and read-all uses transaction snapshots", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const routes = source.slice(
    source.indexOf('app.get("/api/notifications"'),
    source.indexOf('app.patch("/api/profile"'),
  );

  assert.match(routes, /eventId: notificationEventIdentity\(notification\)/);
  assert.match(routes, /safeString\(req\.body\?\.eventId/);
  assert.match(routes, /matchesNotificationEvent\(notification, expectedEventId\)/);
  assert.match(routes, /const candidates = snapshot\.docs\.map/);
  assert.match(routes, /transaction\.getAll\(\.\.\.page\.map/);
  assert.match(routes, /matchesNotificationEvent\(notification, page\[index\]\.eventId\)/);
  assert.doesNotMatch(routes, /const batch = db\.batch\(\)/);
});

test("every notification producer supplies a stable event identity", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const producers = [...source.matchAll(/putNotification\(transaction,\s*\{([\s\S]*?)\n\s*\}\);/g)].map((match) => match[1]);
  assert.ok(producers.length >= 7, "expected every current notification producer to be audited");
  for (const producer of producers) assert.match(producer, /\beventId:/);
});

test("single-post permalinks reuse server visibility and block checks", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const route = source.slice(
    source.indexOf('app.get("/api/posts/:postId"'),
    source.indexOf('app.get("/api/posts/:postId/replies"'),
  );

  assert.match(route, /await readablePost\(postId, req\.auth\.uid\)/);
  assert.match(route, /collection\("reactions"\)\.doc\(req\.auth\.uid\)\.get\(\)/);
  assert.match(route, /liked: reaction\.exists/);
});

test("every relationship and content producer rechecks bidirectional blocks transactionally", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const helper = source.slice(source.indexOf("async function assertNotBlockedInTransaction"), source.indexOf("async function blockedBothWays"));
  assert.match(helper, /transaction\.getAll\(\.\.\.references\)/);
  assert.match(helper, /blockId\(actorId, counterpartId\)/);
  assert.match(helper, /blockId\(counterpartId, actorId\)/);

  const routeSections = [
    source.slice(source.indexOf('app.post("/api/partners/:partnerId/like"'), source.indexOf('app.post("/api/partners/:partnerId/follow"')),
    source.slice(source.indexOf('app.post("/api/partners/:partnerId/follow"'), source.indexOf('app.get("/api/partners/:partnerId/follow-counts"')),
    source.slice(source.indexOf('app.post("/api/posts/:postId/replies"'), source.indexOf('app.get("/api/corrections/received"')),
    source.slice(source.indexOf('app.post("/api/posts/:postId/like"'), source.indexOf('app.post("/api/conversations"')),
    source.slice(source.indexOf('app.post("/api/conversations"'), source.indexOf('app.get("/api/conversations"')),
    source.slice(source.indexOf('app.post("/api/conversations/:conversationId/accept"'), source.indexOf('app.patch("/api/conversations/:conversationId/mute"')),
  ];
  for (const section of routeSections) {
    assert.match(section, /db\.runTransaction[\s\S]*assertNotBlockedInTransaction\(transaction/);
  }
});

test("blocking commits first and drains notifications in bounded pages", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const cleanup = source.slice(source.indexOf("const BLOCK_NOTIFICATION_CLEANUP_PAGE"), source.indexOf("async function directMessageDecision"));
  const blockRoute = source.slice(source.indexOf('app.post("/api/partners/:partnerId/block"'), source.indexOf('app.delete("/api/partners/:partnerId/block"'));

  assert.match(cleanup, /BLOCK_NOTIFICATION_CLEANUP_PAGE = 200/);
  assert.match(cleanup, /while \(true\)/);
  assert.match(cleanup, /transaction\.get\(mineFromPartnerQuery\)/);
  assert.match(cleanup, /transaction\.get\(partnerFromMineQuery\)/);
  assert.match(blockRoute, /created = await db\.runTransaction[\s\S]*await cleanupBlockedPair/);
  assert.match(source, /BLOCK_CLEANUP_PENDING/);
});

test("conversation support checks partner status and blocks before spending AI quota", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const route = source.slice(source.indexOf('app.post("/api/conversation-support"'), source.indexOf("app.use((req, _res, next)"));

  const activeCheck = route.search(/partnerSnapshot\.data\(\)\?\.accountStatus !== "active"/);
  const blockCheck = route.search(/isBlockedBetween\(req\.auth\.uid, partnerId\)[\s\S]*?PARTNER_NOT_FOUND/);
  const aiCall = route.indexOf("geminiResponse(");
  assert.ok(activeCheck >= 0 && blockCheck >= 0 && aiCall >= 0);
  assert.ok(activeCheck < aiCall && blockCheck < aiCall, "partner checks must run before the Gemini call and quota use");
});

test("profiles shown to others hide legacy cities and last activity", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const helper = source.slice(source.indexOf("function profileForOthers"), source.indexOf("function defaultProfile"));

  assert.match(helper, /delete rest\.lastActiveAt/);
  assert.match(helper, /hideLocation === false \? rest : \{ \.\.\.rest, city: "" \}/);
});

test("new profiles never derive their public name or handle from the email address", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const helper = source.slice(source.indexOf("function defaultProfile"), source.indexOf("async function ensureProfile"));

  assert.doesNotMatch(helper, /email\.split|email\)?\s*\.\s*(slice|replace|split)/);
  assert.match(helper, /providedName\.length >= 2/);
  assert.match(helper, /hasName \? providedName : "TimoTalk 사용자"/);
  assert.match(helper, /\(hasName \? providedName : ""\)[\s\S]*\|\| "learner"/);
});

test("profile PATCH writes only requested fields and validates languages and photos", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const route = source.slice(source.indexOf('app.patch("/api/profile",'), source.indexOf('app.get("/api/partners"'));
  const avatarRule = source.slice(source.indexOf("const AVATAR_DATA_URL"), source.indexOf("function preferenceVersion"));

  // 읽어 둔 스냅샷 값으로 빠진 필드를 채워 쓰지 않습니다.
  assert.match(route, /const patch = \{\};/);
  assert.doesNotMatch(route, /=== undefined \? current\./);
  assert.match(route, /const merged = \{ \.\.\.current, \.\.\.patch \}/);
  assert.match(route, /!merged\.nativeLanguages\?\.length \|\| !merged\.learningLanguages\?\.length/);
  assert.match(route, /supportedLanguageCode\(code, "nativeLanguages"\)/);
  assert.match(route, /"learningLanguages\.code",\s*\)/);
  assert.match(route, /seen\.has\(item\.code\)/);
  assert.match(route, /item\.goal\.trim\(\)[\s\S]*goal \|\| "일상 대화"/);
  assert.match(route, /patch\.avatarUrl = avatarUrlFrom\(body\.avatarUrl\)/);
  assert.ok(avatarRule.includes("^data:image\\/(?:jpeg|png|webp);base64,"), "only raster image data URIs are accepted");
  assert.doesNotMatch(avatarRule, /https?|svg/);
  assert.match(source, /const LANGUAGE_CODES = new Set\(LANGUAGES\.map/);
});

test("post author cards overlay the author's current identity everywhere posts are read", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const helper = source.slice(source.indexOf("function postAuthorView"), source.indexOf('app.get("/api/posts"'));
  assert.match(helper, /name: author\.name, handle: author\.handle, flag: author\.country\?\.flag/);

  const routes = [
    source.slice(source.indexOf('app.get("/api/posts"'), source.indexOf('app.post("/api/posts"')),
    source.slice(source.indexOf('app.get("/api/posts/:postId"'), source.indexOf('app.get("/api/posts/:postId/replies"')),
    source.slice(source.indexOf('app.get("/api/search"'), source.indexOf('app.post("/api/translate"')),
  ];
  for (const route of routes) assert.match(route, /author: postAuthorView\(post, /);
});

test("route params and id body fields go through the shared document-id validator", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");

  assert.doesNotMatch(source, /safeString\(req\.params\./);
  const paramUses = [...source.matchAll(/(.{0,32})req\.params\.(\w+)/g)];
  assert.ok(paramUses.length >= 15, "expected the current id routes to be audited");
  for (const [use, before] of paramUses) {
    // createMessage 는 받은 값을 docId 로 확인합니다(아래).
    assert.match(before, /(?:docId\(|createMessage\(req, res, )$/, use);
  }
  const messageRoute = source.slice(source.indexOf("async function createMessage"), source.indexOf('app.post("/api/conversations/:conversationId/messages"'));
  assert.match(messageRoute, /const id = docId\(conversationId, "conversationId"\)/);
  assert.match(messageRoute, /isDocumentId\(req\.body\?\.clientMessageId, \{ min: 8 \}\)/);

  for (const field of ["partnerId", "targetId"]) {
    assert.match(source, new RegExp("docId\\(req\\.body\\?\\." + field + ", \"" + field + "\""));
  }
  assert.match(source, /optionalDocId\(req\.body\?\.parentId, "parentId"\)/);
  assert.match(source, /optionalDocId\(req\.body\?\.id, "id", \{ min: 1 \}\)/);
});

test("post and message attachments accept only device-made data URIs", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const postRoute = source.slice(source.indexOf('app.post("/api/posts"'), source.indexOf('app.delete("/api/posts/:postId"'));
  const messageRoute = source.slice(source.indexOf("async function createMessage"), source.indexOf('app.post("/api/conversations/:conversationId/messages"'));

  assert.match(postRoute, /imageUrl: mediaDataUri\(req\.body\?\.imageUrl, "imageUrl", "image"\)/);
  assert.match(postRoute, /audioUrl: mediaDataUri\(req\.body\?\.audioUrl, "audioUrl", "audio"\)/);
  assert.match(messageRoute, /mediaDataUri\(req\.body\?\.media, "media", type === "image" \? "image" : "audio"\)/);
  assert.doesNotMatch(source, /optionalString\(req\.body\?\.(?:imageUrl|audioUrl|media)\b/);
});

test("message polling can ask only for newer messages and the conversation list batches profile reads", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const messagesRoute = source.slice(
    source.indexOf('app.get("/api/conversations/:conversationId/messages"'),
    source.indexOf("async function createMessage"),
  );
  const listRoute = source.slice(source.indexOf('app.get("/api/conversations"'), source.indexOf('app.post("/api/conversations/:conversationId/accept"'));
  const view = source.slice(source.indexOf("async function conversationView"), source.indexOf("async function consumeDailyQuota"));

  // 잘못된 커서는 읽기 전에 거절하고, 같은 권한 확인을 거칩니다.
  assert.match(messagesRoute, /isoTimestamp\(req\.query\.after, "after"\)[\s\S]*conversationReference\.get\(\)[\s\S]*isBlockedBetween/);
  assert.match(messagesRoute, /where\("sentAt", ">", after\)\.orderBy\("sentAt", "asc"\)\.limit\(200\)/);
  assert.match(messagesRoute, /orderBy\("sentAt", "desc"\)\.limit\(200\)/);
  assert.match(listRoute, /profilesByIds\([\s\S]*conversationView\(conversation, req\.auth\.uid, false, partnerProfiles\)/);
  assert.match(view, /prefetchedProfiles\s*\?\s*prefetchedProfiles\.get\(partnerId\)/);
});

test("pending message requests never expose the recipient's read receipt", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const route = source.slice(
    source.indexOf('app.get("/api/conversations/:conversationId/messages"'),
    source.indexOf("async function createMessage"),
  );
  assert.match(route, /partnerId && conversationStatus\(conversation\) === "accepted" \? conversation\.readAt\?\.\[partnerId\]/);
});
