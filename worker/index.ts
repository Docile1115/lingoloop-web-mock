/** LingoLoop entry point with a same-origin proxy to the persistent Cloud Run API. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  LINGOLOOP_API_URL?: string;
  /** Sites처럼 API 비밀을 직접 보관하지 않는 호스트는 기존 Cloud Run 웹 프록시를 경유합니다. */
  LINGOLOOP_EDGE_PROXY_URL?: string;
  PROXY_SHARED_SECRET?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type RuntimeSetting = "LINGOLOOP_API_URL" | "LINGOLOOP_EDGE_PROXY_URL" | "PROXY_SHARED_SECRET";

function runtimeSetting(env: Env, key: RuntimeSetting): string | undefined {
  // Vinext's Node production adapter does not pass a Worker bindings object.
  // Keep Worker bindings support, but fall back to Cloud Run process env safely.
  const binding = env?.[key];
  if (binding) return binding;
  return process.env[key];
}

function validClientAddress(value: string | null | undefined): string | null {
  const candidate = String(value || "").trim().replace(/^\[|\]$/g, "");
  if (!candidate || candidate.length > 64 || /[\s,]/.test(candidate)) return null;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(candidate)) {
    return candidate.split(".").every((part) => Number(part) <= 255) ? candidate : null;
  }
  return /^[0-9a-f:]+$/i.test(candidate) && candidate.includes(":") ? candidate.toLowerCase() : null;
}

/** 공개 요청이 넣은 첫 X-Forwarded-For 값이 아니라, 플랫폼이 덧붙인 주소를 씁니다. */
export function trustedClientAddress(request: Request): string {
  const cloudflareRequest = request as Request & { cf?: unknown };
  if (cloudflareRequest.cf && typeof cloudflareRequest.cf === "object") {
    const cloudflareAddress = validClientAddress(request.headers.get("cf-connecting-ip"));
    if (cloudflareAddress) return cloudflareAddress;
  }

  const forwarded = String(request.headers.get("x-forwarded-for") || "")
    .split(",")
    .map((part) => validClientAddress(part))
    .filter((part): part is string => Boolean(part));
  if (!forwarded.length) return "unknown";
  return forwarded.length >= 2 ? forwarded[forwarded.length - 2] : forwarded[0];
}

async function proxyApi(request: Request, env: Env): Promise<Response> {
  const edgeProxyUrl = runtimeSetting(env, "LINGOLOOP_EDGE_PROXY_URL");
  const apiUrl = edgeProxyUrl || runtimeSetting(env, "LINGOLOOP_API_URL");
  const proxySecret = runtimeSetting(env, "PROXY_SHARED_SECRET");
  const directApi = !edgeProxyUrl;
  if (!apiUrl || (directApi && !proxySecret)) {
    return Response.json(
      {
        error: {
          code: "API_NOT_CONFIGURED",
          message: "운영 API 연결이 구성되지 않았습니다.",
        },
        meta: {
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          mock: false,
          persistent: false,
        },
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const sourceUrl = new URL(request.url);
  const upstreamUrl = new URL(sourceUrl.pathname + sourceUrl.search, apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`);
  const headers = new Headers(request.headers);
  const clientAddress = trustedClientAddress(request);
  for (const name of ["cf-connecting-ip", "x-forwarded-for", "x-real-ip", "forwarded", "x-lingoloop-client-ip"]) {
    headers.delete(name);
  }
  if (directApi && proxySecret) {
    headers.set("x-lingoloop-proxy", proxySecret);
    headers.set("x-lingoloop-client-ip", clientAddress);
  }
  headers.set("x-forwarded-host", sourceUrl.host);
  headers.set("x-forwarded-proto", sourceUrl.protocol.replace(":", ""));
  headers.delete("host");
  headers.delete("content-length");

  const method = request.method.toUpperCase();
  // Node's fetch requires `duplex` for a streamed Request body. The API accepts
  // small JSON payloads only, so buffering here keeps the adapter portable.
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();
  return fetch(upstreamUrl, {
    method,
    headers,
    body,
    redirect: "manual",
  });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return proxyApi(request, env);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
