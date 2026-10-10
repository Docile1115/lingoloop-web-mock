/**
 * 서버 연결.
 *
 * 백엔드는 한 줄도 고치지 않았습니다. 웹과 **같은 주소**로 요청하므로 Cloudflare
 * 워커가 `x-lingoloop-proxy` 비밀을 붙여줍니다 — 앱 번들에 비밀을 심을 필요가
 * 없습니다(번들은 누구나 뜯어볼 수 있습니다).
 *
 * 두 가지만 브라우저와 다르게 챙깁니다:
 *
 * 1. Origin. 서버는 쓰기 요청에 Origin 헤더가 화이트리스트에 있어야 통과시킵니다
 *    (backend/server.mjs 의 INVALID_ORIGIN). 브라우저는 자동으로 붙이지만 앱은
 *    붙지 않으므로 직접 넣습니다. CSRF 방어가 약해지지는 않습니다 — 그 방어는
 *    브라우저가 남의 사이트에서 쿠키를 자동으로 붙이는 상황을 막는 것이고,
 *    1인칭 네이티브 앱이 자기 출처를 밝히는 것은 정상입니다.
 *
 * 2. 세션 쿠키. httpOnly 라 JS 가 읽지 않고, credentials: include로 네이티브
 *    쿠키 저장소가 매 요청에 붙이게 합니다. 인증이 만료되어 401이 오면 세션
 *    Provider가 즉시 로그인 화면으로 되돌립니다.
 *
 * 401 만 "세션이 끝났다"는 뜻입니다. 연결 끊김·시간 초과·5xx·503(AUTH_UNAVAILABLE,
 * 인증 서버 일시 장애)은 잠깐의 문제라 로그인 상태를 지우지 않습니다.
 */
import { t } from "./i18n";

/** 운영 웹 주소. 로컬 서버를 보려면 app.config 대신 여기를 바꿉니다. */
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ??
  "https://lingoloop-web-254296987362.asia-northeast1.run.app";

/** 응답을 기다리는 시간. 넘으면 끊고 "다시 시도"를 보여줍니다 — 끝없이 도는 화면을 만들지 않습니다. */
const TIMEOUT_MS = 15_000;
/** 사진·음성처럼 본문이 큰 요청은 느린 망에서 올리는 데만 오래 걸려 더 기다립니다. */
const UPLOAD_TIMEOUT_MS = 60_000;
const LARGE_BODY = 100_000;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field?: string;

  constructor(status: number, code: string, message: string, field?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

/**
 * 잠깐의 문제인가 — 연결 끊김(0)·시간 초과·요청 과다·서버 오류(5xx, 503 AUTH_UNAVAILABLE 포함).
 * 이런 실패에서는 로그인 상태를 지우지 않고, 받아 둔 값이나 "다시 시도"를 보여줍니다.
 */
export function isTransient(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
}

/** 서버 응답 모양. 입력값 오류는 error.details.field 에 어느 칸인지 담아 옵니다. */
type Envelope<T> = {
  data?: T;
  error?: { code?: string; message?: string; details?: { field?: string } };
};

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

const timeoutError = () =>
  new ApiError(0, "TIMEOUT", t("응답이 늦어요. 연결을 확인하고 다시 시도해 주세요."));

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const large = typeof init.body === "string" && init.body.length > LARGE_BODY;
  const timer = setTimeout(() => controller.abort(), large ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS);
  // 부른 쪽이 넘긴 signal 로 취소해도 같이 끊습니다.
  const outer = init.signal;
  if (outer?.aborted) controller.abort();
  else outer?.addEventListener("abort", () => controller.abort());
  const timedOut = () => controller.signal.aborted && !outer?.aborted;

  try {
    let response: Response;
    try {
      response = await fetch(API_BASE + path, {
        ...init,
        signal: controller.signal,
        credentials: "include",
        headers: {
          "content-type": "application/json",
          // 브라우저가 아니라 자동으로 붙지 않습니다. 위 주석 참고.
          origin: API_BASE,
          ...init.headers,
        },
      });
    } catch {
      if (timedOut()) throw timeoutError();
      throw new ApiError(0, "NETWORK", t("서버에 연결할 수 없어요. 연결을 확인해 주세요."));
    }

    let body: Envelope<T> | null = null;
    try {
      body = (await response.json()) as Envelope<T>;
    } catch {
      // 본문을 받는 도중에 시간이 다 되면 빈 성공으로 넘기지 않습니다.
      if (timedOut()) throw timeoutError();
    }

    if (!response.ok) {
      if (response.status === 401) onUnauthorized?.();
      throw new ApiError(
        response.status,
        body?.error?.code ?? "UNKNOWN",
        body?.error?.message ?? t("요청을 처리하지 못했어요."),
        body?.error?.details?.field,
      );
    }
    return body?.data as T;
  } finally {
    clearTimeout(timer);
  }
}

export const get = <T,>(path: string) => api<T>(path);

export const post = <T,>(path: string, payload: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(payload ?? {}) });
