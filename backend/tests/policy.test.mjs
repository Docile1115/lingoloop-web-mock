import assert from "node:assert/strict";
import test from "node:test";
import { decideDmRoute } from "../policy.mjs";

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
