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

// 앱은 자기 node_modules 만 씁니다. 루트(웹)의 node_modules 에는 react-dom 처럼
// 앱에서 불러오면 안 되는 것들이 있어서 탐색 경로에 넣지 않습니다.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
