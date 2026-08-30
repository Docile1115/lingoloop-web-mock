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
 * 2. 세션 쿠키. httpOnly 라 JS 가 읽을 수 없지만 *들고 다닐* 수는 있습니다.
 *    iOS 는 NSHTTPCookieStorage, 안드로이드는 CookieManager 라는 네이티브
 *    쿠키 항아리가 알아서 저장하고 다시 붙입니다. 우리가 할 일이 없습니다.
 */

/** 운영 웹 주소. 로컬 서버를 보려면 app.config 대신 여기를 바꿉니다. */
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ??
  "https://lingoloop-web-254296987362.asia-northeast1.run.app";

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

type Envelope<T> = {
  data?: T;
  error?: { code?: string; message?: string; field?: string };
};

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(API_BASE + path, {
      ...init,
      headers: {
        "content-type": "application/json",
        // 브라우저가 아니라 자동으로 붙지 않습니다. 위 주석 참고.
        origin: API_BASE,
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, "NETWORK", "서버에 연결할 수 없어요. 연결을 확인해 주세요.");
  }

  const body = (await response.json().catch(() => null)) as Envelope<T> | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.error?.code ?? "UNKNOWN",
      body?.error?.message ?? "요청을 처리하지 못했어요.",
      body?.error?.field,
    );
  }
  return body?.data as T;
}

export const get = <T,>(path: string) => api<T>(path);

export const post = <T,>(path: string, payload: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(payload ?? {}) });
