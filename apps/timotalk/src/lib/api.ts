/**
 * 서버 호출.
 *
 * - 웹: 같은 주소의 /api 를 부릅니다. 웹 서버(개발 중에는 Metro)가 비밀 헤더를 붙여 API 로 넘깁니다.
 * - 앱: EXPO_PUBLIC_API_BASE(기본은 운영 웹 주소)의 /api 를 부릅니다. 브라우저가 아니라
 *   Origin 이 자동으로 붙지 않으므로 직접 붙입니다. 세션은 httpOnly 쿠키라 JS 가 읽지 않고,
 *   기기 쿠키 저장소가 매 요청에 붙입니다.
 *
 * 401 만 "세션이 끝났다"는 뜻입니다. 끊김·시간 초과·5xx·503(인증 서버 일시 장애)은
 * 잠깐의 문제라 로그인 상태를 지우지 않습니다.
 */
import { Platform } from "react-native";
import { errorMessage } from "./errors";

export const API_BASE =
  Platform.OS === "web" ? "" : process.env.EXPO_PUBLIC_API_BASE ?? "https://lingoloop-web-254296987362.asia-northeast1.run.app";

/** 응답을 기다리는 시간. 넘으면 끊고 "다시 시도"를 보여줍니다 — 끝없이 도는 화면을 만들지 않습니다. */
const TIMEOUT_MS = 15_000;
/** AI 는 생각하는 데 시간이 더 걸립니다. */
const SLOW_TIMEOUT_MS = 45_000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const unauthorizedListeners = new Set<() => void>();

/** 사용 중에 세션이 끝났을 때(401) 부를 함수. 세션 관리가 등록합니다. */
export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

type Envelope<T> = { data?: T; error?: { code?: string; message?: string; details?: { field?: string } } };

export async function api<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown; slow?: boolean; signal?: AbortSignal } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.slow ? SLOW_TIMEOUT_MS : TIMEOUT_MS);
  const outer = options.signal;
  if (outer?.aborted) controller.abort();
  else outer?.addEventListener("abort", () => controller.abort(), { once: true });

  try {
    let response: Response;
    try {
      response = await fetch(API_BASE + path, {
        method: options.method ?? (options.body === undefined ? "GET" : "POST"),
        signal: controller.signal,
        credentials: Platform.OS === "web" ? "same-origin" : "include",
        headers: {
          ...(options.body === undefined ? {} : { "content-type": "application/json" }),
          ...(Platform.OS === "web" ? {} : { origin: API_BASE }),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch {
      if (outer?.aborted) throw new ApiError(0, "ABORTED", "");
      if (controller.signal.aborted) throw new ApiError(0, "TIMEOUT", errorMessage(0, "TIMEOUT"));
      throw new ApiError(0, "NETWORK_ERROR", errorMessage(0, "NETWORK_ERROR"));
    }

    let body: Envelope<T> | null = null;
    try {
      body = (await response.json()) as Envelope<T>;
    } catch {
      if (controller.signal.aborted && !outer?.aborted) throw new ApiError(0, "TIMEOUT", errorMessage(0, "TIMEOUT"));
    }

    if (!response.ok) {
      const code = body?.error?.code || "REQUEST_FAILED";
      if (response.status === 401 && !path.startsWith("/api/auth/")) unauthorizedListeners.forEach((listener) => listener());
      throw new ApiError(response.status, code, errorMessage(response.status, code, body?.error?.message), body?.error?.details?.field);
    }
    return body?.data as T;
  } finally {
    clearTimeout(timer);
  }
}

/** 잠깐의 문제인가 — 다시 시도하면 될 수 있는 실패. */
export function isTransient(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
}

/** 사람이 읽을 실패 이유 */
export function failureText(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.message ? error.message : fallback;
}
