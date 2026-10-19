import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, get } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { createWebServer, trustedClientAddress } from "../apps/timotalk/web-server/serve.mjs";

const SECRET = "test-proxy-secret";
const SCRIPT = "console.log('timotalk');\n".repeat(200);

/** expo export 결과를 흉내 낸 dist 폴더 */
async function makeDist(t) {
  const root = await mkdtemp(join(tmpdir(), "timotalk-web-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "_expo/static/js/web"), { recursive: true });
  await mkdir(join(root, "assets/node_modules/expo-router/assets"), { recursive: true });
  await writeFile(join(root, "index.html"), '<!DOCTYPE html><html><body><div id="root"></div><script src="/_expo/static/js/web/entry-abc.js"></script></body></html>');
  await writeFile(join(root, "_expo/static/js/web/entry-abc.js"), SCRIPT);
  await writeFile(join(root, "assets/node_modules/expo-router/assets/arrow.0123abcd.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  await writeFile(join(root, "favicon.ico"), Buffer.from([0, 0, 1, 0]));
  return root;
}

async function listen(t, server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

/** 운영 API 대역: 받은 요청을 모아 두고, 쿠키 두 개와 함께 답합니다. */
async function fakeApi(t) {
  const received = [];
  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      received.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() });
      res.setHeader("set-cookie", ["lingoloop_session=abc; HttpOnly; Path=/", "lingoloop_hint=1; Path=/"]);
      res.setHeader("content-type", "application/json");
      res.writeHead(req.url.startsWith("/api/missing") ? 404 : 201);
      res.end(JSON.stringify({ data: { ok: true } }));
    });
  });
  return { url: await listen(t, server), received };
}

test("화면 주소는 모두 index.html 이고 캐시하지 않으며, 해시가 든 파일은 1년 캐시하고 줄여 보낸다", async (t) => {
  const base = await listen(t, createWebServer({ root: await makeDist(t) }));

  for (const path of ["/", "/chat/conversation-1", "/community/post-1?postId=post-1", "/me/reports"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.equal(response.headers.get("cache-control"), "no-cache");
    assert.match(await response.text(), /<div id="root">/);
  }

  const script = await fetch(base + "/_expo/static/js/web/entry-abc.js", { headers: { "accept-encoding": "br" } });
  assert.equal(script.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.match(script.headers.get("content-type"), /javascript/);
  assert.equal(script.headers.get("x-content-type-options"), "nosniff");
  // fetch 는 br 을 풀어 주므로 원래 내용과 같은지, 줄여 보냈다는 표시가 있는지 봅니다.
  assert.equal(script.headers.get("content-encoding"), "br");
  assert.equal(await script.text(), SCRIPT);

  // 줄인 내용을 직접 받아 확인합니다(fetch 를 거치지 않는 요청).
  const raw = (encoding) =>
    new Promise((resolve, reject) => {
      get(base + "/_expo/static/js/web/entry-abc.js", { headers: { "accept-encoding": encoding } }, (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve({ headers: res.headers, body: Buffer.concat(chunks) }));
      }).on("error", reject);
    });
  const brotli = await raw("br, gzip");
  assert.equal(brotliDecompressSync(brotli.body).toString(), SCRIPT);
  assert.ok(brotli.body.length < SCRIPT.length / 5);
  const gzip = await raw("gzip");
  assert.equal(gzip.headers["content-encoding"], "gzip");
  assert.equal(gunzipSync(gzip.body).toString(), SCRIPT);
  const plain = await raw("identity");
  assert.equal(plain.headers["content-encoding"], undefined);
  assert.equal(plain.body.toString(), SCRIPT);

  const asset = await fetch(base + "/assets/node_modules/expo-router/assets/arrow.0123abcd.png");
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get("content-type"), "image/png");
  assert.equal(asset.headers.get("cache-control"), "public, max-age=31536000, immutable");

  const icon = await fetch(base + "/favicon.ico");
  assert.equal(icon.headers.get("cache-control"), "public, max-age=3600");

  const etag = script.headers.get("etag");
  assert.ok(etag);
  assert.equal((await fetch(base + "/_expo/static/js/web/entry-abc.js", { headers: { "if-none-match": etag } })).status, 304);
});

test("없는 파일과 dist 밖의 파일은 404 이고, 읽기 말고는 받지 않는다", async (t) => {
  const base = await listen(t, createWebServer({ root: await makeDist(t) }));
  assert.equal((await fetch(base + "/_expo/static/js/web/entry-old.js")).status, 404);
  assert.equal((await fetch(base + "/missing.png")).status, 404);
  assert.equal((await fetch(base + "/%2e%2e/serve.mjs")).status, 404);
  assert.equal((await fetch(base + "/%2e%2e%2f%2e%2e%2fpackage.json")).status, 404);
  assert.equal((await fetch(base + "/", { method: "POST" })).status, 405);
  // 베타가 아니면 검색엔진 차단 머리글이 없고 robots.txt 도 없습니다.
  const page = await fetch(base + "/");
  assert.equal(page.headers.get("x-robots-tag"), null);
  assert.equal((await fetch(base + "/robots.txt")).status, 404);
});

test("베타(noindex)는 모든 응답에 검색엔진 차단 머리글을 달고 robots.txt 로 막는다", async (t) => {
  const base = await listen(t, createWebServer({ root: await makeDist(t), noindex: true }));
  assert.equal((await fetch(base + "/chat/1")).headers.get("x-robots-tag"), "noindex, nofollow");
  const robots = await fetch(base + "/robots.txt");
  assert.equal(robots.status, 200);
  assert.equal(await robots.text(), "User-agent: *\nDisallow: /\n");
  assert.equal((await fetch(base + "/api/health")).headers.get("x-robots-tag"), "noindex, nofollow");
});

test("/api 는 비밀 머리글과 Cloud Run 이 덧붙인 접속 IP 를 붙여 넘기고, 요청이 보낸 같은 머리글은 버리며, 쿠키 여러 개를 그대로 돌려준다", async (t) => {
  const api = await fakeApi(t);
  const base = await listen(t, createWebServer({ root: await makeDist(t), apiUrl: api.url, proxySecret: SECRET }));

  const response = await fetch(base + "/api/conversations/c1/messages?after=2026-10-19", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://timotalk-beta.example",
      cookie: "lingoloop_session=old",
      "x-lingoloop-proxy": "forged",
      "x-lingoloop-client-ip": "6.6.6.6",
      "x-forwarded-for": "6.6.6.6, 203.0.113.7, 169.254.1.1",
      "x-forwarded-proto": "https",
    },
    body: JSON.stringify({ text: "안녕하세요" }),
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { data: { ok: true } });
  assert.deepEqual(response.headers.getSetCookie(), ["lingoloop_session=abc; HttpOnly; Path=/", "lingoloop_hint=1; Path=/"]);

  const [forwarded] = api.received;
  assert.equal(forwarded.method, "POST");
  assert.equal(forwarded.url, "/api/conversations/c1/messages?after=2026-10-19");
  assert.equal(forwarded.body, JSON.stringify({ text: "안녕하세요" }));
  assert.equal(forwarded.headers["x-lingoloop-proxy"], SECRET);
  assert.equal(forwarded.headers["x-lingoloop-client-ip"], "203.0.113.7");
  assert.equal(forwarded.headers["x-forwarded-for"], undefined);
  assert.equal(forwarded.headers.origin, "https://timotalk-beta.example");
  assert.equal(forwarded.headers.cookie, "lingoloop_session=old");
  assert.equal(forwarded.headers["x-forwarded-proto"], "https");
  assert.match(forwarded.headers["x-forwarded-host"], /^127\.0\.0\.1:\d+$/);

  // API 의 오류 상태도 그대로 전합니다.
  assert.equal((await fetch(base + "/api/missing")).status, 404);
});

test("API 가 설정되지 않았거나 닿지 않으면 JSON 오류로 답하고, 너무 큰 본문은 넘기지 않는다", async (t) => {
  const root = await makeDist(t);
  const unconfigured = await listen(t, createWebServer({ root }));
  const missing = await fetch(unconfigured + "/api/health");
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).error.code, "API_NOT_CONFIGURED");

  const closed = createServer();
  const closedUrl = await listen(t, closed);
  await new Promise((resolve) => closed.close(resolve));
  const unreachable = await listen(t, createWebServer({ root, apiUrl: closedUrl, proxySecret: SECRET }));
  const down = await fetch(unreachable + "/api/health");
  assert.equal(down.status, 502);
  assert.equal((await down.json()).error.code, "API_UNREACHABLE");

  const api = await fakeApi(t);
  const base = await listen(t, createWebServer({ root, apiUrl: api.url, proxySecret: SECRET }));
  const tooLarge = await fetch(base + "/api/posts", { method: "POST", headers: { "content-type": "application/json" }, body: "x".repeat(2 * 1024 * 1024 + 1) });
  assert.equal(tooLarge.status, 413);
  assert.equal(api.received.length, 0);
});

test("접속 IP 는 요청이 넣은 첫 값이 아니라 Cloud Run 이 덧붙인 값을 쓴다(옛 웹 프록시와 같은 규칙)", () => {
  assert.equal(trustedClientAddress("203.0.113.7, 169.254.1.1"), "203.0.113.7");
  assert.equal(trustedClientAddress("6.6.6.6, 203.0.113.7, 169.254.1.1"), "203.0.113.7");
  assert.equal(trustedClientAddress("203.0.113.7"), "203.0.113.7");
  assert.equal(trustedClientAddress("2001:DB8::1, 169.254.1.1"), "2001:db8::1");
  assert.equal(trustedClientAddress("not-an-ip, 999.1.1.1"), "unknown");
  assert.equal(trustedClientAddress(undefined), "unknown");
});
