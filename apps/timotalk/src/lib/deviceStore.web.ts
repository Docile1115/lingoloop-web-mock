/**
 * 웹: localStorage. 사생활 보호 창처럼 저장이 막힌 브라우저에서는 기본값을 쓰고 조용히 넘어갑니다
 * (이번 화면에서는 동작하고, 다음에 열면 처음부터입니다).
 */
const PREFIX = "timotalk.";

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // 저장이 막혀도 화면은 계속 씁니다.
  }
}
