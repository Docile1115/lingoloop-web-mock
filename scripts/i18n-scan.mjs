#!/usr/bin/env node
/**
 * 화면 소스에서 t("...") 를 모두 긁어 키 목록을 다시 씁니다.
 *
 *   npm run i18n          키 목록 갱신 + 번역 누락 보고
 *   npm run i18n -- --fill  누락된 키를 en/ja 사전에 빈 칸으로 채워 넣기
 *
 * 새 화면을 붙일 때 이걸 돌리면 됩니다. 번역이 비면 타입 에러로 잡히므로
 * 커밋 전에 반드시 드러납니다.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC_DIRS = ["app"];
const I18N_DIR = join(ROOT, "app/lib/i18n");
const SKIP = new Set(["node_modules", "dist", ".next", ".vinext"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

/** t("...") 와 msg("...") 안의 문자열. 이스케이프된 따옴표까지 받습니다. */
const CALL = /\b(?:t|msg)\(\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/g;

// 사전 파일 자체는 제외하되, i18n 모듈의 코드는 훑습니다 —
// localizeClock 처럼 로케일을 다루는 함수도 t("...") 를 쓰기 때문입니다.
const DICT_FILES = ["keys.ts", "en.ts", "ja.ts"].map((f) => join(I18N_DIR, f));
const files = SRC_DIRS.flatMap((d) => walk(join(ROOT, d))).filter(
  (f) => !DICT_FILES.includes(f),
);

const keys = new Set();
const where = new Map();
/** 주석 안의 예시 코드까지 키로 걷지 않도록 먼저 지웁니다. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

for (const file of files) {
  const src = stripComments(readFileSync(file, "utf8"));
  for (const m of src.matchAll(CALL)) {
    const key = m[2].replace(/\\(["'\\])/g, "$1");
    keys.add(key);
    if (!where.has(key)) where.set(key, relative(ROOT, file));
  }
}

const sorted = [...keys].sort((a, b) => a.localeCompare(b, "ko"));
const esc = (s) => JSON.stringify(s);

writeFileSync(
  join(I18N_DIR, "keys.ts"),
  `// 자동 생성 — 직접 고치지 마세요. \`npm run i18n\` 으로 다시 만듭니다.\n` +
    `// 한국어 원문이 곧 키입니다. 자세한 배경은 ./index.tsx 주석 참고.\n\n` +
    `export const MESSAGE_KEYS = [\n${sorted.map((k) => `  ${esc(k)},`).join("\n")}\n] as const;\n\n` +
    `export type MessageKey = (typeof MESSAGE_KEYS)[number];\n`,
  "utf8",
);

/** 사전 파일에서 키만 뽑습니다(간단한 정규식 — 사전은 항상 리터럴 객체입니다). */
function readDict(name) {
  const path = join(I18N_DIR, `${name}.ts`);
  let src;
  try {
    src = readFileSync(path, "utf8");
  } catch {
    return { path, src: null, entries: new Map() };
  }
  const entries = new Map();
  for (const m of src.matchAll(/^\s*("(?:\\.|[^"\\])*")\s*:\s*("(?:\\.|[^"\\])*")\s*,\s*$/gm)) {
    entries.set(JSON.parse(m[1]), JSON.parse(m[2]));
  }
  return { path, src, entries };
}

const fill = process.argv.includes("--fill");
let missingTotal = 0;

for (const name of ["en", "ja"]) {
  const dict = readDict(name);
  const missing = sorted.filter((k) => !dict.entries.has(k));
  const stale = [...dict.entries.keys()].filter((k) => !keys.has(k));
  const blank = [...dict.entries].filter(([, v]) => v.trim() === "").map(([k]) => k);
  missingTotal += missing.length + blank.length;

  if (fill) {
    const merged = sorted.map((k) => [k, dict.entries.get(k) ?? ""]);
    writeFileSync(
      dict.path,
      `// ${name} 번역. 값이 비어 있으면 화면에 한국어 원문이 그대로 나옵니다.\n` +
        `// 키는 \`npm run i18n\` 이 관리합니다 — 값만 채우세요.\n` +
        `// 영어 복수형은 "{n} partner|{n} partners" 처럼 | 로 나눠 적습니다.\n\n` +
        `import type { MessageKey } from "./keys";\n\n` +
        `export const ${name}: Record<MessageKey, string> = {\n` +
        merged.map(([k, v]) => `  ${esc(k)}: ${esc(v)},`).join("\n") +
        `\n};\n`,
      "utf8",
    );
  }

  const flag = missing.length + blank.length === 0 ? "✅" : "⚠️";
  console.log(
    `${flag} ${name}  번역 ${dict.entries.size - blank.length}/${sorted.length}` +
      (missing.length ? ` · 키 없음 ${missing.length}` : "") +
      (blank.length ? ` · 빈 값 ${blank.length}` : "") +
      (stale.length ? ` · 안 쓰는 키 ${stale.length}` : ""),
  );
  for (const k of [...missing, ...blank].slice(0, 8)) {
    console.log(`     · ${k}   (${where.get(k) ?? "?"})`);
  }
}

console.log(`\n키 ${sorted.length}개를 app/lib/i18n/keys.ts 에 기록했습니다.`);
if (missingTotal && !fill) console.log(`번역 칸을 만들려면: npm run i18n -- --fill`);
