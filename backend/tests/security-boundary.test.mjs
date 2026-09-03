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
