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
});
