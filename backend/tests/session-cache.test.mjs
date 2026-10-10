import assert from "node:assert/strict";
import test from "node:test";
import { createSessionVerificationCache, isSessionRejection } from "../session-cache.mjs";

function clock(start = Date.parse("2026-10-10T00:00:00.000Z")) {
  let current = start;
  return { now: () => current, advance: (ms) => { current += ms; } };
}

function countingVerifier(result = (cookie) => ({ uid: "u-" + cookie, exp: Infinity })) {
  const calls = [];
  const verifier = async (cookie) => {
    calls.push(cookie);
    return result(cookie);
  };
  return { verifier, calls };
}

test("successful verifications are reused for the TTL, then checked again", async () => {
  const time = clock();
  const cache = createSessionVerificationCache({ ttlMs: 60_000, now: time.now });
  const { verifier, calls } = countingVerifier();
  assert.deepEqual(await cache.verify("cookie-a", verifier), { uid: "u-cookie-a", exp: Infinity });
  time.advance(59_999);
  await cache.verify("cookie-a", verifier);
  assert.equal(calls.length, 1);
  time.advance(1);
  await cache.verify("cookie-a", verifier);
  assert.equal(calls.length, 2, "expired entries are verified again");
  await cache.verify("cookie-b", verifier);
  assert.equal(calls.length, 3, "a different cookie is verified separately");
});

test("failures are never cached and nothing outlives the cookie's own expiry", async () => {
  const time = clock();
  const cache = createSessionVerificationCache({ ttlMs: 60_000, now: time.now });
  let attempts = 0;
  const failing = async () => {
    attempts += 1;
    throw Object.assign(new Error("revoked"), { code: "auth/session-cookie-revoked" });
  };
  await assert.rejects(cache.verify("bad", failing), { code: "auth/session-cookie-revoked" });
  await assert.rejects(cache.verify("bad", failing), { code: "auth/session-cookie-revoked" });
  assert.equal(attempts, 2);
  assert.equal(cache.size(), 0);

  const expSeconds = Math.floor(time.now() / 1000) + 10;
  const { verifier, calls } = countingVerifier(() => ({ uid: "u", exp: expSeconds }));
  await cache.verify("short", verifier);
  time.advance(9_000);
  await cache.verify("short", verifier);
  assert.equal(calls.length, 1);
  time.advance(1_000);
  await cache.verify("short", verifier);
  assert.equal(calls.length, 2, "the cookie expired before the TTL");

  const { verifier: expiredVerifier, calls: expiredCalls } = countingVerifier(() => ({ uid: "u", exp: 1 }));
  await cache.verify("expired", expiredVerifier);
  await cache.verify("expired", expiredVerifier);
  assert.equal(expiredCalls.length, 2);
});

test("concurrent requests with the same cookie share one verification", async () => {
  const cache = createSessionVerificationCache();
  let release;
  let calls = 0;
  const gate = new Promise((resolve) => { release = resolve; });
  const slow = async () => {
    calls += 1;
    await gate;
    return { uid: "u", exp: Infinity };
  };
  const results = Promise.all(Array.from({ length: 8 }, () => cache.verify("same", slow)));
  release();
  assert.equal((await results).length, 8);
  assert.equal(calls, 1);

  let failures = 0;
  const rejected = Promise.all(Array.from({ length: 3 }, () => cache.verify("broken", async () => {
    failures += 1;
    throw new Error("boom");
  }).catch((error) => error.message)));
  assert.deepEqual(await rejected, ["boom", "boom", "boom"]);
  assert.equal(failures, 1);
  await assert.rejects(cache.verify("broken", async () => { throw new Error("again"); }), /again/);
});

test("the cache is bounded and evicts the oldest entries first", async () => {
  const time = clock();
  const cache = createSessionVerificationCache({ ttlMs: 60_000, maxEntries: 3, now: time.now });
  const { verifier, calls } = countingVerifier();
  for (const cookie of ["1", "2", "3", "4", "5"]) await cache.verify(cookie, verifier);
  assert.equal(cache.size(), 3);
  await cache.verify("5", verifier);
  assert.equal(calls.length, 5, "recent entries stay cached");
  await cache.verify("1", verifier);
  assert.equal(calls.length, 6, "the oldest entry was evicted");
  time.advance(60_000);
  await cache.verify("6", verifier);
  assert.equal(cache.size(), 1, "expired entries are swept before evicting live ones");
});

test("only cookie problems are session rejections; outages are not", () => {
  const error = (code, message = "") => Object.assign(new Error(message), { code });
  for (const rejected of [
    error("auth/argument-error", "Decoding Firebase session cookie failed. Make sure you passed the entire string JWT"),
    error("auth/argument-error", "Firebase session cookie has invalid signature."),
    error("auth/argument-error", 'Firebase session cookie has incorrect "aud" (audience) claim.'),
    error("auth/session-cookie-expired"),
    error("auth/session-cookie-revoked"),
    error("auth/user-disabled"),
    error("auth/user-not-found"),
  ]) {
    assert.equal(isSessionRejection(rejected), true, rejected.code + " " + rejected.message);
  }
  for (const transient of [
    // firebase-admin 14 이 Google 공개 키를 받지 못했을 때 실제로 내는 오류입니다.
    error("auth/argument-error", "Error while making request: connect ECONNREFUSED 127.0.0.1:443. Error code: ECONNREFUSED"),
    error("auth/argument-error", "Error while making request: timeout of 10000ms exceeded."),
    error("auth/argument-error", "Error fetching public keys for Google certs: Service Unavailable"),
    error("app/network-error", "Error while making request: socket hang up. Error code: ECONNRESET"),
    error("app/network-timeout"),
    error("app/invalid-credential"),
    error("auth/internal-error"),
    error("auth/quota-exceeded"),
    new Error("no code"),
    undefined,
    null,
  ]) {
    assert.equal(isSessionRejection(transient), false, String(transient?.code) + " " + String(transient?.message));
  }
});
