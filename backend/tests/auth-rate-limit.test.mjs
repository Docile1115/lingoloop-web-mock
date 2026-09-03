import assert from "node:assert/strict";
import test from "node:test";
import { createFixedWindowLimiter, nextFixedWindowBucket } from "../auth-rate-limit.mjs";

test("fixed-window limiter rejects requests over the key limit and resets", () => {
  let timestamp = 1_000;
  const limiter = createFixedWindowLimiter({ windowMs: 500, now: () => timestamp });

  assert.equal(limiter.take("ip:127.0.0.1", 2), true);
  assert.equal(limiter.take("ip:127.0.0.1", 2), true);
  assert.equal(limiter.take("ip:127.0.0.1", 2), false);

  timestamp += 501;
  assert.equal(limiter.take("ip:127.0.0.1", 2), true);
});

test("fixed-window limiter evicts the oldest live key without globally rejecting newcomers", () => {
  let timestamp = 10_000;
  const limiter = createFixedWindowLimiter({ windowMs: 1_000, maxEntries: 2, now: () => timestamp });

  assert.equal(limiter.take("one", 1), true);
  timestamp += 1;
  assert.equal(limiter.take("two", 1), true);
  timestamp += 1;
  assert.equal(limiter.take("three", 1), true);
  assert.equal(limiter.size(), 2);
  // 가장 오래된 one은 로컬에서 새 bucket으로 받아 줍니다. 실제 누적 한도는
  // 호출 뒤의 Firestore transaction이 계속 판정합니다.
  assert.equal(limiter.take("one", 1), true);
  assert.equal(limiter.size(), 2);

  timestamp += 1_001;
  assert.equal(limiter.take("three", 1), true);
  assert.equal(limiter.size(), 1);
});

test("distributed fixed-window state increments and preserves the original expiry", () => {
  const active = nextFixedWindowBucket(
    { count: 2, expireAt: { toMillis: () => 2_000 } },
    { timestamp: 1_500, windowMs: 500, limit: 3 },
  );
  assert.deepEqual(active, { allowed: true, count: 3, expireAtMillis: 2_000 });

  const blocked = nextFixedWindowBucket(
    { count: 3, expireAt: new Date(2_000) },
    { timestamp: 1_501, windowMs: 500, limit: 3 },
  );
  assert.deepEqual(blocked, { allowed: false, count: 3, expireAtMillis: 2_000 });
});

test("distributed fixed-window state resets expired buckets and rejects corrupt counts", () => {
  const reset = nextFixedWindowBucket(
    { count: 50, expireAt: 999 },
    { timestamp: 1_000, windowMs: 500, limit: 3 },
  );
  assert.deepEqual(reset, { allowed: true, count: 1, expireAtMillis: 1_500 });

  assert.throws(
    () => nextFixedWindowBucket(
      { count: -1, expireAt: 2_000 },
      { timestamp: 1_000, windowMs: 500, limit: 3 },
    ),
    /stored rate-limit count is invalid/,
  );
});
