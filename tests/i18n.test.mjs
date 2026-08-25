import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const I18N = join(ROOT, "app/lib/i18n");
async function read(path) {
  return readFile(path, "utf8");
}

const relativePath = (path) => relative(ROOT, path).replaceAll("\\", "/");

/** keys.ts / en.ts / ja.ts 는 모두 리터럴이라 정규식으로 읽어도 안전합니다. */
async function readKeys() {
  const src = await read(join(I18N, "keys.ts"));
  return [...src.matchAll(/^\s*("(?:\\.|[^"\\])*"),$/gm)].map((m) => JSON.parse(m[1]));
}

async function readDict(name) {
  const src = await read(join(I18N, `${name}.ts`));
  const entries = new Map();
  for (const m of src.matchAll(
    /^\s*("(?:\\.|[^"\\])*")\s*:\s*("(?:\\.|[^"\\])*")\s*,\s*$/gm,
  )) {
    entries.set(JSON.parse(m[1]), JSON.parse(m[2]));
  }
  return entries;
}

async function walk(dir, out = []) {
  for (const name of await readdir(dir)) {
    if (["node_modules", "dist", ".next", ".vinext"].includes(name)) continue;
    const full = join(dir, name);
    if ((await stat(full)).isDirectory()) await walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** 복수형("one|other")은 같은 자리표시자를 두 번 쓰므로 종류만 비교합니다. */
const placeholders = (value) =>
  [...new Set([...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort().join(",");

test("번역 키와 사전에 중복 리터럴이 없다", async () => {
  const keys = await readKeys();
  assert.equal(new Set(keys).size, keys.length, "keys.ts 에 중복 키가 있습니다");

  for (const locale of ["en", "ja"]) {
    const src = await read(join(I18N, `${locale}.ts`));
    const literalKeys = [...src.matchAll(/^\s*("(?:\\.|[^"\\])*")\s*:/gm)].map((m) =>
      JSON.parse(m[1]),
    );
    assert.equal(
      new Set(literalKeys).size,
      literalKeys.length,
      `${locale} 사전에 중복 키가 있습니다`,
    );
  }
});

test("지원 언어와 서버 기본값·브라우저 저장 계약이 유지된다", async () => {
  const [runtime, locales, app, production] = await Promise.all([
    read(join(I18N, "index.tsx")),
    // 서버 컴포넌트(layout.tsx 의 generateMetadata)도 써야 해서 "use client" 밖에 둡니다.
    read(join(I18N, "keys-locale.ts")),
    read(join(ROOT, "app/components/LingoLoopApp.tsx")),
    read(join(ROOT, "app/components/ProductionLingoLoopApp.tsx")),
  ]);

  assert.match(locales, /export const LOCALES = \["ko", "en", "ja"\] as const;/);
  assert.match(runtime, /const serverLocale = \(\): Locale => "ko";/);
  assert.match(runtime, /const raw = DICTIONARIES\[locale\]\[key\] \?\? key;/);
  assert.match(runtime, /const STORAGE_KEY = "lingoloop\.locale";/);
  assert.match(runtime, /document\.documentElement\.lang = locale;/);
  assert.match(runtime, /window\.localStorage\.setItem\(STORAGE_KEY, next\);/);
  assert.match(runtime, /document\.title = SITE_METADATA\[locale\]\.title;/);
  assert.match(app, /<I18nProvider>[\s\S]*<LingoLoopScreens \/>[\s\S]*<\/I18nProvider>/);
  assert.match(production, /<I18nProvider>[\s\S]*<ProductionLingoLoopScreens \/>[\s\S]*<\/I18nProvider>/);
});

test("서버 렌더 메타데이터는 문서 언어와 한 벌로 유지된다", async () => {
  // 탭 제목·검색 결과 문구는 서버에서 만들어져 t() 를 쓸 수 없습니다.
  // 요청마다 언어를 바꾸면 처음 흘려보낸 HTML 과 스트리밍 메타데이터가 어긋나므로
  // 서버는 한 언어로 그리고, 사용자가 고른 언어는 브라우저에서 제목만 다시 맞춥니다.
  const [layout, metadata] = await Promise.all([
    read(join(ROOT, "app/layout.tsx")),
    read(join(I18N, "metadata.ts")),
  ]);
  assert.match(layout, /const copy = SITE_METADATA\.ko;/);
  assert.match(layout, /<html lang="ko">/);
  // 주석은 설명이라 남겨둡니다 — 화면에 나가는 문자열만 봅니다.
  const layoutStrings = layout
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  assert.doesNotMatch(layoutStrings, /[가-힣]/, "탭 제목·설명은 SITE_METADATA 에서 가져와야 합니다");
  for (const locale of ["ko", "en", "ja"]) {
    assert.ok(metadata.includes(`${locale}: {`), `${locale} 메타데이터가 필요합니다`);
  }
});

for (const locale of ["en", "ja"]) {
  test(`${locale} 사전에 빠진 키가 없다`, async () => {
    const keys = await readKeys();
    const dict = await readDict(locale);
    const missing = keys.filter((k) => !dict.has(k));
    assert.deepEqual(missing, [], `번역 키 누락 ${missing.length}개`);
  });

  test(`${locale} 사전에 안 쓰는 키가 없다`, async () => {
    const keys = new Set(await readKeys());
    const dict = await readDict(locale);
    const stale = [...dict.keys()].filter((k) => !keys.has(k));
    assert.deepEqual(stale, [], `안 쓰는 키 ${stale.length}개 — npm run i18n 으로 정리하세요`);
  });

  test(`${locale} 번역이 비어 있지 않다`, async () => {
    const dict = await readDict(locale);
    const blank = [...dict].filter(([, v]) => v.trim() === "").map(([k]) => k);
    assert.deepEqual(blank, [], `번역 안 된 문구 ${blank.length}개`);
  });

  test(`${locale} 번역의 {자리표시자}가 원문과 같다`, async () => {
    const dict = await readDict(locale);
    const mismatched = [...dict]
      .filter(([key, value]) => value.trim() !== "" && placeholders(key) !== placeholders(value))
      .map(([key, value]) => `${key} → ${value}`);
    assert.deepEqual(mismatched, [], "자리표시자가 어긋나면 값이 화면에 안 채워집니다");
  });
}

test("데모 데이터 어휘가 모두 사전에 있다", async () => {
  const keys = new Set(await readKeys());
  const src = await read(join(ROOT, "app/lib/data-vocab.ts"));
  const vocab = [...src.matchAll(/msg\("((?:\\.|[^"\\])*)"\)/g)].map((m) => m[1]);
  assert.ok(vocab.length > 0, "data-vocab.ts 에서 어휘를 못 읽었습니다");
  const missing = vocab.filter((v) => !keys.has(v));
  assert.deepEqual(missing, [], "npm run i18n 을 돌려 키를 갱신하세요");
});

test("브라우저 기본 select 를 쓰지 않는다", async () => {
  // OS마다 생김새가 달라 앱 안에서 혼자 튑니다 — SelectField 로 통일합니다.
  const files = (await walk(join(ROOT, "app"))).filter((f) => f.endsWith(".tsx"));
  const offenders = [];
  for (const file of files) {
    const src = await read(file);
    if (/<select[\s>]/.test(src)) offenders.push(relativePath(file));
  }
  assert.deepEqual(offenders, [], "SelectField 를 쓰세요");
});

test("화면 코드에 한국어가 그대로 남아 있지 않다", async () => {
  // 화면 문구가 아닌 곳은 제외합니다. 각각 왜 제외인지 분명히 해 둡니다.
  const EXCLUDED = [
    // 사용자가 쓴 글·메시지·방 제목. 언어 교환 앱에서는 쓴 사람의 언어 그대로 보여야 합니다.
    "app/lib/demo-data.ts",
    // 개발용 컴포넌트 미리보기(/ui). 제품 화면이 아닙니다.
    "app/ui/page.tsx",
    // SEO 메타데이터. 서버에서 만들어지므로 클라이언트 t() 를 쓸 수 없습니다.
    // 서버에서 언어를 정하게 되면 그때 함께 옮겨야 합니다.
    "app/layout.tsx",
    "app/page.tsx",
    // 코드·React Native 공유용 숫자/색 토큰. 한국어는 렌더 문구가 아닌 측정 근거 주석입니다.
    "app/lib/tokens.ts",
  ];
  const files = (await walk(join(ROOT, "app")))
    .filter((f) => !f.startsWith(I18N))
    .filter((f) => !EXCLUDED.includes(relativePath(f)));
  const offenders = [];

  for (const file of files) {
    // 블록 주석은 줄 단위로 못 알아봅니다(두 번째 줄이 * 로 시작하지 않을 수 있음).
    // 줄 수를 유지하려고 내용만 지우고 줄바꿈은 남깁니다.
    const src = (await read(file)).replace(/\/\*[\s\S]*?\*\//g, (m) =>
      m.replace(/[^\n]/g, " "),
    );
    src.split("\n").forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
      if (/^\{\s*\/\*.*\*\/\s*\}$/.test(trimmed)) return; // JSX 주석
      // 이미 사전을 거치는 호출은 지운 뒤 남은 한글만 본다
      const rest = line
        .replace(/\b(?:t|msg|tx)\(\s*"(?:\\.|[^"\\])*"/g, "")
        .replace(/\/\/.*$/, "");
      // 화면에 안 나오는 것들: 정규화용 별칭 표(한국어 → 코드), 언어 선택 라벨
      if (/Aliases: Record/.test(line) || /LOCALE_LABEL/.test(line)) return;
      // 언어 이름은 그 언어로 적어야 자기 언어를 찾을 수 있습니다(한국어/English/日本語).
      // 화면 언어를 따라 번역하면 오히려 못 찾습니다.
      if (/LANGUAGE_LABELS/.test(src) && /^\s*[a-z]{2}: "/.test(line)) return;
      if (/[가-힣]/.test(rest)) {
        offenders.push(`${relativePath(file)}:${index + 1}  ${trimmed.slice(0, 70)}`);
      }
    });
  }

  assert.deepEqual(
    offenders,
    [],
    `t(...) 를 거치지 않은 한국어 ${offenders.length}곳 — 새 문구는 t("...") 로 감싸고 npm run i18n 을 돌리세요`,
  );
});
