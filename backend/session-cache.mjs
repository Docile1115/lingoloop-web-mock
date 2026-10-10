import crypto from "node:crypto";

/**
 * 세션 쿠키 확인 결과를 잠깐 기억합니다.
 *
 * verifySessionCookie(cookie, true) 는 매번 Identity Platform 에서 사용자 기록을 읽어 폐기된
 * 세션과 비활성화된 계정을 거릅니다. 화면은 15초마다 대화를 다시 읽고 첫 화면에서 API 를
 * 열 개 가까이 한꺼번에 부르므로, 같은 쿠키는 60초 동안 다시 확인하지 않습니다.
 * 그 대가로 계정을 막거나 세션을 폐기해도 이 인스턴스에는 최대 60초 늦게 반영됩니다.
 *
 * - 쿠키 원문 대신 sha256 해시를 키로 둡니다.
 * - 성공만 기억합니다. 실패는 매번 다시 확인합니다.
 * - 쿠키 만료(exp)보다 오래 기억하지 않습니다.
 * - 같은 쿠키로 동시에 들어온 요청은 확인 한 번을 같이 기다립니다.
 * - 항목 수에 상한을 두어, 세션이 많아도 메모리가 끝없이 늘지 않습니다.
 */
export function createSessionVerificationCache({ ttlMs = 60_000, maxEntries = 5_000, now = () => Date.now() } = {}) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error("ttlMs must be positive");
  if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error("maxEntries must be a positive integer");

  const entries = new Map();
  const pending = new Map();
  const keyOf = (cookie) => crypto.createHash("sha256").update(String(cookie)).digest("hex");

  function remember(key, claims) {
    const timestamp = now();
    const expiresAtMillis = Number(claims?.exp) * 1000;
    const expiresAt = Number.isFinite(expiresAtMillis) ? Math.min(timestamp + ttlMs, expiresAtMillis) : timestamp + ttlMs;
    if (expiresAt <= timestamp) return;
    entries.delete(key);
    if (entries.size >= maxEntries) {
      for (const [entryKey, entry] of entries) {
        if (entry.expiresAt <= timestamp) entries.delete(entryKey);
      }
      // 그래도 꽉 찼으면 가장 먼저 넣은 것부터 버립니다(Map 은 넣은 순서를 지킵니다).
      while (entries.size >= maxEntries) entries.delete(entries.keys().next().value);
    }
    entries.set(key, { claims, expiresAt });
  }

  return {
    /** verifier(cookie) 는 확인된 claims 를 돌려주거나 실패를 던집니다. */
    verify(cookie, verifier) {
      const key = keyOf(cookie);
      const cached = entries.get(key);
      if (cached && cached.expiresAt > now()) return Promise.resolve(cached.claims);
      if (cached) entries.delete(key);

      const inFlight = pending.get(key);
      if (inFlight) return inFlight;
      const promise = Promise.resolve().then(() => verifier(cookie));
      pending.set(key, promise);
      const settle = () => {
        if (pending.get(key) === promise) pending.delete(key);
      };
      promise.then((claims) => {
        settle();
        remember(key, claims);
      }, settle);
      return promise;
    },

    size() {
      return entries.size;
    },
  };
}

/**
 * 쿠키 자체가 받아들일 수 없는 실패인지(401: 형식·서명 오류, 만료, 폐기, 비활성화·삭제된 계정).
 *
 * 그 밖의 실패(네트워크, Identity Platform 5xx·할당량, 자격 증명)는 잠깐의 장애입니다. 401 로
 * 답하면 앱이 사용자를 로그아웃시키므로 호출하는 쪽이 503 으로 답합니다.
 * firebase-admin 은 Google 공개 키를 받아오지 못한 실패도 auth/argument-error 로 감싸 보내므로,
 * 그 경우는 메시지로 가려 장애로 봅니다.
 */
const SESSION_REJECTION_CODES = new Set([
  "auth/argument-error",
  "auth/session-cookie-expired",
  "auth/session-cookie-revoked",
  "auth/user-disabled",
  "auth/user-not-found",
]);
const KEY_FETCH_FAILURE = /^(?:Error fetching public keys|Error while making requests?\b|error in secret or public key callback)/;

export function isSessionRejection(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  if (!SESSION_REJECTION_CODES.has(code)) return false;
  return !(code === "auth/argument-error" && KEY_FETCH_FAILURE.test(String(error?.message || "")));
}
