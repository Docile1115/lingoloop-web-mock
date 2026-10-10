import assert from "node:assert/strict";
import test from "node:test";
import { nextWriteQuota, WRITE_LIMITS, writeQuotaMessage } from "../write-quota.mjs";

const day = "2026-10-10";

test("daily write quotas count per action and reset when the Seoul day changes", () => {
  const first = nextWriteQuota(null, "messageRequests", day);
  assert.deepEqual(first, { allowed: true, limit: 20, used: 1, next: { day, counts: { messageRequests: 1 } } });

  const other = { day, counts: { messageRequests: 3, somethingElse: 7 } };
  assert.deepEqual(nextWriteQuota(other, "messageRequests", day).next, {
    day,
    counts: { messageRequests: 4, somethingElse: 7 },
  });

  const full = { day, counts: { messageRequests: WRITE_LIMITS.messageRequests.limit } };
  assert.deepEqual(nextWriteQuota(full, "messageRequests", day), { allowed: false, limit: 20, used: 20 });
  assert.equal(nextWriteQuota(full, "messageRequests", "2026-10-11").used, 1, "a new day starts from zero");
});

test("corrupt stored counts are treated as zero and unknown actions fail loudly", () => {
  for (const counts of [{ messageRequests: -5 }, { messageRequests: "x" }, { messageRequests: 1.5 }, [], null]) {
    assert.equal(nextWriteQuota({ day, counts }, "messageRequests", day).used, 1);
  }
  assert.throws(() => nextWriteQuota(null, "unknown", day), /Unknown write quota action/);
});

test("quota messages name the action and the limit in Korean", () => {
  assert.equal(
    writeQuotaMessage("messageRequests"),
    "오늘 새 메시지 요청 한도(20회)를 모두 사용했습니다. 내일 다시 시도해 주세요.",
  );
  assert.equal(writeQuotaMessage("posts"), "오늘 게시물 작성 한도(30회)를 모두 사용했습니다. 내일 다시 시도해 주세요.");
});

test("write actions have generous daily caps that stop scripted floods", () => {
  const limits = Object.fromEntries(Object.entries(WRITE_LIMITS).map(([action, rule]) => [action, rule.limit]));
  assert.deepEqual(limits, { posts: 30, replies: 200, reactions: 500, follows: 200, reports: 30, messageRequests: 20 });
  for (const [action, { limit }] of Object.entries(WRITE_LIMITS)) {
    let current = null;
    for (let count = 1; count <= limit; count += 1) {
      const result = nextWriteQuota(current, action, day);
      assert.equal(result.allowed, true);
      assert.equal(result.used, count);
      current = result.next;
    }
    assert.equal(nextWriteQuota(current, action, day).allowed, false, action);
    // 한 행동이 한도에 닿아도 다른 행동은 그대로입니다.
    const otherAction = action === "posts" ? "reports" : "posts";
    assert.equal(nextWriteQuota(current, otherAction, day).allowed, true);
  }
});
