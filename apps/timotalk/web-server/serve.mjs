/**
 * 새 앱(apps/timotalk)의 웹 서버. 운영 웹(Cloud Run lingoloop-web)에서 돕니다.
 *
 *  - 정적 파일: `expo export --platform web` 결과(dist/). 이름에 해시가 든 파일(_expo/static, assets)은 1년 캐시하고,
 *    index.html 은 캐시하지 않습니다 — 새로 배포하면 다음에 열 때 바로 새 화면이 나옵니다.
 *  - 화면 주소(/chat/…, /community/… 등 확장자 없는 주소)는 모두 index.html 을 돌려줍니다(한 페이지 앱).
 *  - /api 는 운영 API 로 넘깁니다. 옛 웹의 프록시(worker/index.ts)와 같은 규칙입니다:
 *    공유 비밀(x-lingoloop-proxy)과 접속 IP(x-lingoloop-client-ip)를 붙이고, 요청이 보낸 같은 이름의 머리글은 버립니다.
 *    세션은 API 가 주는 httpOnly 쿠키라 이 주소의 /api 로만 오가고, 여러 개의 Set-Cookie 도 그대로 넘깁니다.
 *  - TIMOTALK_NOINDEX=true 면 검색엔진에 잡히지 않게 합니다(X-Robots-Tag, robots.txt). 운영에는 두지 않습니다.
 *  - 글자 파일(js·html·json·css·svg)은 브라우저가 받을 수 있으면 br·gzip 으로 줄여 보냅니다. 처음 한 번 줄여 메모리에 둡니다
 *    (배포한 파일은 컨테이너가 사는 동안 바뀌지 않습니다).
 *
 * 패키지 없이 Node 22 만 씁니다. 테스트는 저장소 루트의 tests/timotalk-web-server.test.mjs 입니다.
 *
 * 환경 변수: PORT(기본 8080) · LINGOLOOP_API_URL · PROXY_SHARED_SECRET · TIMOTALK_NOINDEX · TIMOTALK_WEB_ROOT(기본 ./dist)
 */
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { brotliCompressSync, constants as zlib, gzipSync } from "node:zlib";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};
const COMPRESSIBLE = new Set([".html", ".js", ".json", ".css", ".map", ".txt", ".svg"]);
/** 이름에 해시가 들어 있어 내용이 바뀌면 주소도 바뀌는 곳 */
const HASHED = ["/_expo/static/", "/assets/"];
/** AI 응답(대화 도움)은 45초까지 기다립니다. 그보다 조금 길게 둡니다. */
const API_TIMEOUT_MS = 60_000;
/** API 가 받는 가장 큰 본문은 사진·음성 데이터 URI(52만 자)입니다. 넉넉히 두되 끝없이 받지는 않습니다. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;
/** 요청이 보내도 믿지 않는 머리글(옛 웹 프록시와 같은 목록)과 프록시가 넘기지 않는 연결 머리글 */
const DROP_REQUEST_HEADERS = new Set([
  "cf-connecting-ip",
  "x-forwarded-for",
  "x-real-ip",
  "forwarded",
  "x-lingoloop-client-ip",
  "x-lingoloop-proxy",
  "host",
  "content-length",
  "connection",
  "keep-alive",
  "proxy-connection",
  "transfer-encoding",
  "upgrade",
  "te",
  "trailer",
  "accept-encoding",
]);
const DROP_RESPONSE_HEADERS = new Set(["set-cookie", "content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"]);

function validClientAddress(value) {
  const candidate = String(value || "").trim().replace(/^\[|\]$/g, "");
  if (!candidate || candidate.length > 64 || /[\s,]/.test(candidate)) return null;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(candidate)) {
    return candidate.split(".").every((part) => Number(part) <= 255) ? candidate : null;
  }
  return /^[0-9a-f:]+$/i.test(candidate) && candidate.includes(":") ? candidate.toLowerCase() : null;
}

/** 공개 요청이 넣은 첫 X-Forwarded-For 값이 아니라, Cloud Run 이 덧붙인 주소를 씁니다(worker/index.ts 와 같은 규칙). */
export function trustedClientAddress(forwardedFor) {
  const forwarded = String(forwardedFor || "")
    .split(",")
    .map((part) => validClientAddress(part))
    .filter(Boolean);
  if (!forwarded.length) return "unknown";
  return forwarded.length >= 2 ? forwarded[forwarded.length - 2] : forwarded[0];
}

const firstHeader = (value) => (Array.isArray(value) ? value[0] : value) || "";

function securityHeaders(noindex) {
  return {
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    ...(noindex ? { "x-robots-tag": "noindex, nofollow" } : {}),
  };
}

function sendJson(res, status, body, extra = {}) {
  const payload = Buffer.from(JSON.stringify(body));
  res.writeHead(status, { ...extra, "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "content-length": payload.length });
  res.end(payload);
}

const apiError = (code, message) => ({
  error: { code, message },
  meta: { timestamp: new Date().toISOString(), mock: false, persistent: false },
});

class BodyTooLarge extends Error {}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new BodyTooLarge();
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function proxyApi(req, res, { apiUrl, proxySecret, noindex }) {
  const headers = securityHeaders(noindex);
  if (!apiUrl || !proxySecret) {
    sendJson(res, 503, apiError("API_NOT_CONFIGURED", "운영 API 연결이 구성되지 않았습니다."), headers);
    return;
  }
  const method = (req.method || "GET").toUpperCase();
  let body;
  try {
    body = method === "GET" || method === "HEAD" ? undefined : await readBody(req);
  } catch (error) {
    if (error instanceof BodyTooLarge) {
      sendJson(res, 413, apiError("PAYLOAD_TOO_LARGE", "보내는 내용이 너무 큽니다."), headers);
      return;
    }
    throw error;
  }

  const upstreamHeaders = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (DROP_REQUEST_HEADERS.has(name) || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) upstreamHeaders.append(name, item);
  }
  upstreamHeaders.set("x-lingoloop-proxy", proxySecret);
  upstreamHeaders.set("x-lingoloop-client-ip", trustedClientAddress(req.headers["x-forwarded-for"]));
  upstreamHeaders.set("x-forwarded-host", firstHeader(req.headers.host));
  upstreamHeaders.set("x-forwarded-proto", firstHeader(req.headers["x-forwarded-proto"]).split(",")[0].trim() || "http");
  upstreamHeaders.set("accept-encoding", "identity");

  const upstreamUrl = new URL(req.url || "/", apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`);
  let upstream;
  try {
    upstream = await fetch(upstreamUrl, { method, headers: upstreamHeaders, body, redirect: "manual", signal: AbortSignal.timeout(API_TIMEOUT_MS) });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError";
    console.error(JSON.stringify({ code: timedOut ? "API_TIMEOUT" : "API_UNREACHABLE", path: upstreamUrl.pathname, message: error?.message }));
    sendJson(res, timedOut ? 504 : 502, apiError(timedOut ? "API_TIMEOUT" : "API_UNREACHABLE", "서버에 연결하지 못했습니다."), headers);
    return;
  }

  const payload = Buffer.from(await upstream.arrayBuffer());
  for (const [name, value] of upstream.headers) {
    if (!DROP_RESPONSE_HEADERS.has(name)) res.setHeader(name, value);
  }
  const cookies = upstream.headers.getSetCookie();
  if (cookies.length) res.setHeader("set-cookie", cookies);
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.setHeader("content-length", payload.length);
  res.writeHead(upstream.status);
  res.end(method === "HEAD" ? undefined : payload);
}

/** 정적 파일을 읽어 둡니다. 줄인 결과(br·gzip)는 처음 요청할 때 만들어 함께 둡니다. */
function createFileCache() {
  const files = new Map();
  return async function load(path) {
    if (files.has(path)) return files.get(path);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) return null;
    const body = await readFile(path);
    const entry = { body, etag: `"${createHash("sha1").update(body).digest("base64url")}"`, compressed: new Map() };
    files.set(path, entry);
    return entry;
  };
}

function pickEncoding(acceptEncoding) {
  const accepted = String(acceptEncoding || "").toLowerCase();
  if (/\bbr\b/.test(accepted)) return "br";
  if (/\bgzip\b/.test(accepted)) return "gzip";
  return "";
}

function compressed(entry, encoding) {
  if (!entry.compressed.has(encoding)) {
    entry.compressed.set(
      encoding,
      encoding === "br" ? brotliCompressSync(entry.body, { params: { [zlib.BROTLI_PARAM_QUALITY]: 9 } }) : gzipSync(entry.body, { level: 9 }),
    );
  }
  return entry.compressed.get(encoding);
}

async function serveStatic(req, res, { root, load, noindex }) {
  const headers = securityHeaders(noindex);
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    res.writeHead(405, { ...headers, allow: "GET, HEAD", "content-length": 0 });
    res.end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url || "/", "http://localhost").pathname);
  } catch {
    res.writeHead(400, { ...headers, "content-length": 0 });
    res.end();
    return;
  }
  if (noindex && pathname === "/robots.txt") {
    const body = Buffer.from("User-agent: *\nDisallow: /\n");
    res.writeHead(200, { ...headers, "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache", "content-length": body.length });
    res.end(method === "HEAD" ? undefined : body);
    return;
  }

  // dist 밖의 파일은 주지 않습니다("/../server.mjs" 같은 주소).
  const requested = resolve(root, `.${pathname}`);
  const inside = requested === root || requested.startsWith(root + sep);
  let file = inside && pathname !== "/" ? requested : null;
  let entry = file ? await load(file) : null;
  if (!entry) {
    // 확장자가 없는 주소는 화면 주소입니다. 확장자가 있는데 없는 파일이면 404 입니다(없는 그림·스크립트에 화면을 주지 않음).
    if (pathname !== "/" && extname(pathname)) {
      res.writeHead(404, { ...headers, "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache", "content-length": 9 });
      res.end(method === "HEAD" ? undefined : "Not Found");
      return;
    }
    file = resolve(root, "index.html");
    entry = await load(file);
    if (!entry) {
      res.writeHead(503, { ...headers, "content-type": "text/plain; charset=utf-8", "content-length": 22 });
      res.end(method === "HEAD" ? undefined : "Web app is not built.");
      return;
    }
  }

  const extension = extname(file).toLowerCase();
  const hashed = HASHED.some((prefix) => pathname.startsWith(prefix));
  const responseHeaders = {
    ...headers,
    "content-type": TYPES[extension] || "application/octet-stream",
    "cache-control": hashed ? "public, max-age=31536000, immutable" : extension === ".html" ? "no-cache" : "public, max-age=3600",
    etag: entry.etag,
    vary: "Accept-Encoding",
  };
  if (firstHeader(req.headers["if-none-match"]) === entry.etag) {
    res.writeHead(304, responseHeaders);
    res.end();
    return;
  }
  const encoding = COMPRESSIBLE.has(extension) && entry.body.length > 1024 ? pickEncoding(req.headers["accept-encoding"]) : "";
  const body = encoding ? compressed(entry, encoding) : entry.body;
  res.writeHead(200, { ...responseHeaders, ...(encoding ? { "content-encoding": encoding } : {}), "content-length": body.length });
  res.end(method === "HEAD" ? undefined : body);
}

/** 테스트와 실행이 같이 씁니다. root 는 dist 폴더의 절대 경로입니다. */
export function createWebServer({ root, apiUrl = "", proxySecret = "", noindex = false }) {
  const absoluteRoot = resolve(root);
  const load = createFileCache();
  return createServer((req, res) => {
    const pathname = (req.url || "/").split("?")[0];
    const handle = pathname === "/api" || pathname.startsWith("/api/") ? proxyApi(req, res, { apiUrl, proxySecret, noindex }) : serveStatic(req, res, { root: absoluteRoot, load, noindex });
    handle.catch((error) => {
      console.error(JSON.stringify({ code: "WEB_SERVER_ERROR", path: pathname, message: error?.message }));
      if (!res.headersSent) sendJson(res, 500, apiError("INTERNAL_ERROR", "잠시 후 다시 시도해 주세요."));
      else res.destroy();
    });
  });
}

// node serve.mjs 로 실행했을 때만 포트를 엽니다(테스트가 불러올 때는 열지 않음).
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const server = createWebServer({
    root: process.env.TIMOTALK_WEB_ROOT || resolve(here, "dist"),
    apiUrl: process.env.LINGOLOOP_API_URL || "",
    proxySecret: process.env.PROXY_SHARED_SECRET || "",
    noindex: process.env.TIMOTALK_NOINDEX === "true",
  });
  const port = Number(process.env.PORT || 8080);
  server.listen(port, "0.0.0.0", () => console.log(JSON.stringify({ service: "timotalk-web", status: "listening", port })));
  // Cloud Run 이 새 버전으로 바꿀 때 보내는 신호. 받던 요청을 마치고 닫습니다.
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
}
