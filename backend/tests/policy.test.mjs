import assert from "node:assert/strict";
import test from "node:test";
import { decideDmRoute, dmRelationships, DM_REQUEST_COOLDOWN_MS, requestCooldownUntil } from "../policy.mjs";

test("everyone/all scopes accept any authenticated sender", () => {
  assert.deepEqual(decideDmRoute({ whoCanMessage: "everyone", routeOthersToRequests: false }, {}), {
    status: "accepted",
    scope: "everyone",
  });
  assert.deepEqual(decideDmRoute({ whoCanMessage: "all", routeOthersToRequests: false }, {}), {
    status: "accepted",
    scope: "everyone",
  });
});

test("relationship scopes require the corresponding server-side relationship", () => {
  assert.equal(decideDmRoute({ whoCanMessage: "matches" }, { matched: true }).status, "accepted");
  assert.equal(decideDmRoute({ whoCanMessage: "matches" }, { follower: true }).status, "denied");
  assert.equal(decideDmRoute({ whoCanMessage: "followers" }, { follower: true }).status, "accepted");
  assert.equal(decideDmRoute({ whoCanMessage: "mutual-follows" }, { mutualFollow: true }).status, "accepted");
});

test("disallowed senders are routed to requests only when explicitly enabled", () => {
  assert.equal(
    decideDmRoute({ whoCanMessage: "matches", routeOthersToRequests: true }, { matched: false }).status,
    "pending",
  );
  assert.equal(
    decideDmRoute({ whoCanMessage: "matches", routeOthersToRequests: false }, { matched: false }).status,
    "denied",
  );
});

test("unknown or missing scopes fail closed", () => {
  assert.equal(decideDmRoute({ whoCanMessage: "unsupported", routeOthersToRequests: false }, {}).status, "denied");
  assert.equal(decideDmRoute({ whoCanMessage: "unsupported", routeOthersToRequests: true }, {}).status, "denied");
  assert.equal(decideDmRoute({}, {}).status, "denied");
});

const matchesOnly = { whoCanMessage: "matches", routeOthersToRequests: false };
const matchesOrRequest = { whoCanMessage: "matches", routeOthersToRequests: true };

test("regression: a sender's own regenerated daily list never counts as a match", () => {
  // 예전 서버는 보내는 사람의 오늘의 추천(조건을 바꿀 때마다 다시 뽑힘)에 받는 사람이 있으면
  // 매칭으로 보았습니다. 그 목록에는 받는 사람의 id 가 들어 있습니다 — 이것은 근거가 아닙니다.
  const senderOwnList = [{ partnerId: "recipient" }, { partnerId: "someone-else" }];
  const relationships = dmRelationships({ senderId: "sender", recipientRecommendations: senderOwnList });
  assert.equal(relationships.matched, false);
  assert.equal(decideDmRoute(matchesOnly, relationships).status, "denied");
  assert.equal(decideDmRoute(matchesOrRequest, relationships).status, "pending");
});

test("matches-only accepts a mutual like or being recommended to the recipient", () => {
  const recommended = dmRelationships({ senderId: "sender", recipientRecommendations: [{ partnerId: "sender" }] });
  assert.equal(recommended.matched, true);
  assert.equal(decideDmRoute(matchesOnly, recommended).status, "accepted");

  const mutualLike = dmRelationships({ senderId: "sender", senderLiked: true, recipientLiked: true });
  assert.equal(decideDmRoute(matchesOnly, mutualLike).status, "accepted");

  // 한쪽만 보낸 마음은 보내는 사람이 혼자 만들 수 있습니다.
  for (const oneSided of [{ senderLiked: true }, { recipientLiked: true }]) {
    assert.equal(decideDmRoute(matchesOnly, dmRelationships({ senderId: "sender", ...oneSided })).status, "denied");
  }
  for (const malformed of [undefined, null, "sender", [{ partnerId: undefined }], [null]]) {
    assert.equal(dmRelationships({ senderId: "sender", recipientRecommendations: malformed }).matched, false);
  }
  assert.equal(dmRelationships({ recipientRecommendations: [{ partnerId: undefined }] }).matched, false);
});

test("follower scopes keep their meaning", () => {
  const follower = dmRelationships({ senderId: "sender", senderFollows: true });
  assert.deepEqual(follower, { matched: false, follower: true, mutualFollow: false });
  assert.equal(decideDmRoute({ whoCanMessage: "followers" }, follower).status, "accepted");
  assert.equal(decideDmRoute({ whoCanMessage: "mutual-follows" }, follower).status, "denied");
  const mutual = dmRelationships({ senderId: "sender", senderFollows: true, recipientFollows: true });
  assert.equal(decideDmRoute({ whoCanMessage: "mutual-follows" }, mutual).status, "accepted");
  // 받는 사람이 나를 팔로우하는 것만으로는 "팔로워" 가 아닙니다.
  assert.equal(dmRelationships({ senderId: "sender", recipientFollows: true }).follower, false);
});

test("a declined request blocks new requests from the same sender for 7 days", () => {
  const now = Date.parse("2026-10-10T00:00:00.000Z");
  const declinedAt = "2026-10-05T00:00:00.000Z";
  assert.equal(requestCooldownUntil({ declinedAt }, now), Date.parse(declinedAt) + DM_REQUEST_COOLDOWN_MS);
  assert.equal(requestCooldownUntil({ declinedAt: "2026-10-02T23:59:59.999Z" }, now), null);
  assert.equal(requestCooldownUntil({ declinedAt: "2026-10-03T00:00:00.001Z" }, now), now + 1);
  for (const record of [null, undefined, {}, { declinedAt: "not a date" }, { declinedAt: 12345 }]) {
    assert.equal(requestCooldownUntil(record, now), null);
  }
});
