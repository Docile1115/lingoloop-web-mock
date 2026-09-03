/**
 * 메모리 기반 고정 구간 제한기.
 *
 * 로그인 앞단을 지키는 보조 장치라 Cloud Run 인스턴스마다 따로 동작합니다.
 * 키 개수에는 상한을 두고 만료된 항목부터 정리해, 임의의 식별자를 계속 보내도
 * 프로세스 메모리가 끝없이 늘지 않게 합니다.
 */
export function createFixedWindowLimiter({
  windowMs = 15 * 60 * 1000,
  maxEntries = 10_000,
  now = () => Date.now(),
} = {}) {
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new Error("windowMs must be positive");
  if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error("maxEntries must be a positive integer");

  const buckets = new Map();
  let nextSweepAt = 0;

  const sweep = (timestamp) => {
    if (timestamp < nextSweepAt && buckets.size < maxEntries) return;
    for (const [key, value] of buckets) {
      if (value.resetAt <= timestamp) buckets.delete(key);
    }
    nextSweepAt = timestamp + Math.min(windowMs, 60_000);
  };

  const evictOldest = () => {
    let oldestKey;
    let oldestResetAt = Number.POSITIVE_INFINITY;
    for (const [key, value] of buckets) {
      if (value.resetAt < oldestResetAt) {
        oldestKey = key;
        oldestResetAt = value.resetAt;
      }
    }
    if (oldestKey !== undefined) buckets.delete(oldestKey);
  };

  return {
    /**
     * 같은 키가 한도를 넘으면 false입니다. 키 저장 공간만 찬 경우에는 가장 오래된
     * 로컬 bucket을 버리고 true를 반환합니다. 이 제한기는 보조 계층이고 실제
     * 전역 판정은 뒤의 Firestore transaction이 하므로, 메모리 보호가 새 사용자를
     * 일괄 차단해서는 안 됩니다.
     */
    take(key, limit) {
      if (typeof key !== "string" || !key || !Number.isInteger(limit) || limit < 1) return false;
      const timestamp = now();
      sweep(timestamp);

      const current = buckets.get(key);
      if (!current || current.resetAt <= timestamp) {
        if (!current && buckets.size >= maxEntries) evictOldest();
        buckets.set(key, { count: 1, resetAt: timestamp + windowMs });
        return true;
      }

      if (current.count >= limit) return false;
      current.count += 1;
      return true;
    },

    size() {
      sweep(now());
      return buckets.size;
    },
  };
}

/**
 * Firestore 문서에 저장할 고정 구간의 다음 상태를 계산합니다.
 *
 * Firestore Timestamp, Date, 밀리초를 모두 읽을 수 있게 해 두면 에뮬레이터와
 * 운영 SDK가 같은 순수 함수를 사용합니다. 실제 저장은 호출자가 transaction
 * 안에서 해야 여러 Cloud Run 인스턴스가 하나의 카운터를 공유합니다.
 */
function expireAtMillis(value) {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value);
  return Number.NaN;
}

export function nextFixedWindowBucket(
  current,
  {
    timestamp = Date.now(),
    windowMs = 15 * 60 * 1000,
    limit,
  } = {},
) {
  if (!Number.isFinite(timestamp)) throw new Error("timestamp must be finite");
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new Error("windowMs must be positive");
  if (!Number.isInteger(limit) || limit < 1) throw new Error("limit must be a positive integer");

  const currentExpireAt = expireAtMillis(current?.expireAt);
  if (!current || !Number.isFinite(currentExpireAt) || currentExpireAt <= timestamp) {
    return { allowed: true, count: 1, expireAtMillis: timestamp + windowMs };
  }

  const currentCount = Number(current.count);
  if (!Number.isSafeInteger(currentCount) || currentCount < 0) {
    throw new Error("stored rate-limit count is invalid");
  }
  if (currentCount >= limit) {
    return { allowed: false, count: currentCount, expireAtMillis: currentExpireAt };
  }
  return { allowed: true, count: currentCount + 1, expireAtMillis: currentExpireAt };
}
