import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const source = await readFile(`${ROOT}/app/lib/avatar.ts`, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const avatar = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
const backendAvatar = await import(new URL("../backend/avatar.mjs", import.meta.url));

test("avatar catalogue exactly matches the public API contract", () => {
  const expected = {
    skinTone: 6,
    face: 4,
    hair: 12,
    hairColor: 8,
    eyes: 6,
    mouth: 6,
    outfit: 10,
    outfitColor: 8,
    accessory: 9,
    background: 8,
  };

  assert.deepEqual(avatar.AVATAR_CATEGORY_KEYS, Object.keys(expected));
  for (const category of avatar.AVATAR_CATEGORIES) {
    assert.equal(category.options.length, expected[category.key], category.key);
    assert.equal(new Set(category.options.map((option) => option.id)).size, category.options.length);
  }
  assert.deepEqual(
    Object.fromEntries(avatar.AVATAR_CATEGORIES.map((category) => [
      category.key,
      category.options.map((option) => option.id),
    ])),
    backendAvatar.AVATAR_ITEM_IDS,
  );
});

test("normalization completes missing values and rejects arbitrary IDs", () => {
  const value = avatar.normalizeAvatarConfig({
    version: 99,
    skinTone: "skin-06",
    face: "<script>alert(1)</script>",
    background: "url(javascript:alert(1))",
    unknown: "kept",
  });

  assert.equal(value.version, 1);
  assert.equal(value.skinTone, "skin-06");
  assert.equal(value.face, avatar.DEFAULT_AVATAR_CONFIG.face);
  assert.equal(value.background, avatar.DEFAULT_AVATAR_CONFIG.background);
  assert.deepEqual(Object.keys(value), ["version", ...avatar.AVATAR_CATEGORY_KEYS]);
  assert.equal("unknown" in value, false);
});

test("random characters and SVG rendering are deterministic", () => {
  const first = avatar.randomAvatarConfig("same-user-and-day");
  const second = avatar.randomAvatarConfig("same-user-and-day");
  assert.deepEqual(first, second);
  assert.equal(avatar.renderAvatarSvg(first), avatar.renderAvatarSvg(second));
  assert.equal(avatar.avatarDataUri(first), avatar.avatarDataUri(second));
});

test("renderer never echoes untrusted markup or external resources", () => {
  const attack = '<script>alert("avatar")</script><image href="https://evil.example/x"/>';
  const svg = avatar.renderAvatarSvg({
    ...avatar.DEFAULT_AVATAR_CONFIG,
    hair: attack,
    background: attack,
  });

  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.doesNotMatch(svg, /script|javascript|evil\.example|<image/i);
  assert.equal(svg, avatar.renderAvatarSvg(avatar.DEFAULT_AVATAR_CONFIG));
});

test("character mode is explicit and legacy values stay in photo mode", () => {
  assert.equal(avatar.normalizeAvatarMode("character"), "character");
  for (const value of ["photo", "svg", true, null, undefined]) {
    assert.equal(avatar.normalizeAvatarMode(value), "photo");
  }
});
