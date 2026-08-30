/**
 * Metro 설정 — 웹과 코드를 나눠 쓰기 위한 것입니다.
 *
 * 공유하는 파일(타입·번역 사전·서버 응답 어댑터)은 아직 웹 쪽 app/lib 에 있습니다.
 * Metro 는 기본적으로 프로젝트 폴더 밖을 보지 않으므로 저장소 루트를 감시 목록에
 * 넣고, 그 자리를 `@shared` 라는 이름 하나로 가립니다.
 *
 * 나중에 packages/core 로 옮길 때 고칠 곳은 아래 SHARED 한 줄뿐입니다 —
 * 앱 코드는 계속 `@shared/...` 만 import 합니다.
 */
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");
const SHARED = path.resolve(repoRoot, "app/lib");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [SHARED];

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "@shared": SHARED,
};

config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];

/*
   루트(웹)의 node_modules 는 막습니다 — react-dom 이나 다른 버전의 react 를
   앱이 집어오면 안 됩니다.

   여기서 disableHierarchicalLookup 을 켜면 안 됩니다. 그건 위로 올라가며 찾는
   동작 자체를 끄는 것이라, mobile/node_modules/expo/node_modules/… 처럼 **안쪽에
   중첩된** 의존성까지 못 찾습니다(실제로 @expo/log-box 를 못 찾아 개발 번들이
   500 으로 실패했습니다 — 운영 번들은 그 모듈을 안 써서 통과했습니다).

   대신 막고 싶은 곳만 정확히 막습니다. mobile/node_modules 는 경로가 더 길어
   이 정규식에 걸리지 않습니다.
*/
const escaped = repoRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
config.resolver.blockList = [new RegExp(`^${escaped}/node_modules/`)];

module.exports = config;
