/**
 * Metro 설정.
 *
 * 1. 공용 코드: 번역 사전·아바타 그리기 같은 공용 파일은 아직 웹 쪽 app/lib 에 있습니다.
 *    Metro 는 프로젝트 폴더 밖을 보지 않으므로 그 폴더를 감시 목록에 넣고 `@shared` 로 가립니다.
 *    (mobile/metro.config.js 와 같은 방식입니다.)
 * 2. 개발용 /api 전달: 웹으로 띄우면 브라우저가 같은 주소의 /api 를 부릅니다. 운영에서는
 *    웹 서버가 비밀 헤더를 붙여 API 로 넘기는데, 개발 서버에는 그 일을 하는 곳이 없어서
 *    여기서 대신합니다. 개발 서버에서만 쓰입니다 — 내보낸(export) 웹에는 들어가지 않습니다.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- Metro 는 이 설정 파일을 CommonJS 로 읽습니다. */
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "../..");
const SHARED = path.resolve(repoRoot, "app/lib");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [SHARED];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "@shared": SHARED,
};
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];

/* 루트(웹)와 옛 앱(mobile)의 node_modules 는 막습니다 — 다른 버전의 react 를 집어오면 안 됩니다.
   disableHierarchicalLookup 은 켜지 않습니다. 그러면 node_modules 안쪽에 중첩된 의존성까지
   못 찾습니다(mobile/metro.config.js 주석 참고). */
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\\/g, "[\\\\/]");
config.resolver.blockList = [
  new RegExp(`^${escape(repoRoot)}[\\\\/]node_modules[\\\\/]`),
  new RegExp(`^${escape(path.resolve(repoRoot, "mobile"))}[\\\\/]node_modules[\\\\/]`),
];

/* 개발용 API 전달. 값은 로컬 에뮬레이터 기준이고 환경 변수로 바꿀 수 있습니다.
   - TIMOTALK_DEV_API: API 주소
   - TIMOTALK_DEV_PROXY_SECRET: API 가 기다리는 x-lingoloop-proxy 값
   - TIMOTALK_DEV_API_ORIGIN: API 의 APP_ORIGIN. API 는 이 출처만 받으므로 바꿔서 넘깁니다. */
const devApi = new URL(process.env.TIMOTALK_DEV_API || "http://127.0.0.1:8080");
const devSecret = process.env.TIMOTALK_DEV_PROXY_SECRET || "local-emulator-only";
const devOrigin = process.env.TIMOTALK_DEV_API_ORIGIN || "http://localhost:5174";

function proxyApi(req, res) {
  const headers = { ...req.headers, host: devApi.host, origin: devOrigin, "x-lingoloop-proxy": devSecret };
  delete headers.referer;
  const client = devApi.protocol === "https:" ? https : http;
  const upstream = client.request(
    { protocol: devApi.protocol, hostname: devApi.hostname, port: devApi.port, method: req.method, path: req.url, headers },
    (answer) => {
      res.writeHead(answer.statusCode || 502, answer.headers);
      answer.pipe(res);
    },
  );
  upstream.on("error", (error) => {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { code: "DEV_PROXY_ERROR", message: String(error.message || error) } }));
  });
  req.pipe(upstream);
}

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    if (req.url && (req.url === "/api" || req.url.startsWith("/api/"))) return proxyApi(req, res);
    return middleware(req, res, next);
  },
};

module.exports = config;
