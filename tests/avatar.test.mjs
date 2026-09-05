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
    eyebrows: 4, nose: 3, bottom: 6, bottomColor: 6, socks: 3, shoes: 5, shoeColor: 6, headwear: 4, bag: 4,
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

  assert.equal(value.version, 2);
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

test("full-body catalogue options produce distinct safe drawings and valid API payloads", () => {
  for (const category of avatar.AVATAR_CATEGORIES) {
    const drawings = category.options.map(({id}) => {
      const config = {...avatar.DEFAULT_AVATAR_CONFIG, [category.key]: id};
      assert.deepEqual(backendAvatar.normalizeAvatarConfig(config), config);
      const svg = avatar.renderFullBodyAvatarSvg(config);
      assert.match(svg, /viewBox="0 0 192 288"/);
      assert.doesNotMatch(svg, /undefined|NaN|<image|<script/);
      return svg;
    });
    assert.equal(new Set(drawings).size, category.options.length, category.key);
  }
  for (let seed = 0; seed < 100; seed++) {
    const config = avatar.randomAvatarConfig(seed);
    assert.deepEqual(backendAvatar.normalizeAvatarConfig(config), config);
    assert.equal(avatar.renderFullBodyAvatarSvg(config), avatar.renderFullBodyAvatarSvg(config));
  }
});

test("legacy faces get the same body defaults on client and server", () => {
  const legacy = Object.fromEntries(backendAvatar.AVATAR_LEGACY_KEYS.map(key => [key, key === "version" ? 1 : avatar.DEFAULT_AVATAR_CONFIG[key]]));
  assert.deepEqual(avatar.normalizeAvatarConfig(legacy), backendAvatar.normalizeAvatarConfig(legacy));
  assert.deepEqual(avatar.normalizeAvatarConfig(legacy), avatar.DEFAULT_AVATAR_CONFIG);
});

test("preview crops are allowlisted and room mode has no backdrop", () => {
  for (const category of avatar.AVATAR_CATEGORY_KEYS) {
    const svg = avatar.renderAvatarPreviewSvg(avatar.DEFAULT_AVATAR_CONFIG, avatar.avatarPreviewForCategory(category));
    assert.doesNotMatch(svg, /undefined|NaN/);
  }
  const attack = '"><script>alert(1)</script>';
  assert.doesNotMatch(avatar.renderAvatarPreviewSvg({bag:attack, nose:attack}, attack), /<script/);
  assert.doesNotMatch(avatar.renderFullBodyAvatarSvg(null, true), /<rect width="192"/);
  assert.match(avatar.renderAvatarSvg(null), /viewBox="0 0 128 128"/);
});

test("studio groups cover each category once", () => {
  const categories = avatar.AVATAR_GROUPS.flatMap(group => group.categories);
  assert.deepEqual([...categories].sort(), [...avatar.AVATAR_CATEGORY_KEYS].sort());
});
