import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AVATAR_CONFIG_KEYS,
  AVATAR_ITEM_IDS,
  AvatarValidationError,
  avatarFields,
  normalizeAvatarConfig,
  normalizeAvatarPatch,
  sameAvatarConfig,
} from "../avatar.mjs";

const validConfig = Object.freeze({
  version: 1,
  skinTone: "skin-04",
  face: "face-02",
  hair: "hair-12",
  hairColor: "hair-color-03",
  eyes: "eyes-06",
  mouth: "mouth-02",
  outfit: "outfit-10",
  outfitColor: "outfit-color-08",
  accessory: "accessory-none",
  background: "background-07",
});

test("캐릭터 설정은 curated ID와 완전한 version 1 계약만 정규화한다", () => {
  assert.deepEqual(normalizeAvatarConfig(validConfig), validConfig);
  assert.deepEqual(Object.keys(normalizeAvatarConfig(validConfig)), AVATAR_CONFIG_KEYS);
  assert.ok(Object.values(AVATAR_ITEM_IDS).every((items) => Object.isFrozen(items)));
});

test("캐릭터 설정은 부분 값, 추가 키, 미지원 ID와 실행 가능한 입력을 거부한다", () => {
  const invalid = [
    null,
    [],
    { ...validConfig, version: 2 },
    { ...validConfig, mouth: undefined },
    { ...validConfig, hair: "https://evil.example/hair.svg" },
    { ...validConfig, accessory: "<svg onload=alert(1)>" },
    { ...validConfig, rawSvg: "<svg />" },
  ];
  for (const value of invalid) {
    assert.throws(() => normalizeAvatarConfig(value), AvatarValidationError);
  }
  const partial = { ...validConfig };
  delete partial.mouth;
  assert.throws(() => normalizeAvatarConfig(partial), /config\.mouth/);
  assert.throws(
    () => normalizeAvatarPatch({ mode: "photo", extra: "x".repeat(2_100) }, {}),
    AvatarValidationError,
  );
});

test("avatar patch는 character 완전 설정을 요구하고 photo 전환 때 설정을 보존하거나 지운다", () => {
  assert.deepEqual(normalizeAvatarPatch({ mode: "character", config: validConfig }), {
    avatarMode: "character",
    avatarConfig: validConfig,
  });
  assert.throws(() => normalizeAvatarPatch({ mode: "character" }, { avatarConfig: validConfig }), /완전한 config/);
  assert.deepEqual(
    normalizeAvatarPatch({ mode: "photo" }, { avatarMode: "character", avatarConfig: validConfig }),
    { avatarMode: "photo", avatarConfig: validConfig },
  );
  assert.deepEqual(normalizeAvatarPatch({ mode: "photo", config: null }, { avatarConfig: validConfig }), {
    avatarMode: "photo",
    avatarConfig: null,
  });
});

test("기존 프로필과 손상된 저장값은 photo/null로 안전하게 기본화한다", () => {
  assert.deepEqual(avatarFields({}), { avatarMode: "photo", avatarConfig: null });
  assert.deepEqual(avatarFields(null), { avatarMode: "photo", avatarConfig: null });
  assert.deepEqual(avatarFields("missing-profile"), { avatarMode: "photo", avatarConfig: null });
  assert.deepEqual(avatarFields({ avatarMode: "character", avatarConfig: { ...validConfig, eyes: "unknown" } }), {
    avatarMode: "photo",
    avatarConfig: null,
  });
  assert.deepEqual(avatarFields({ avatarMode: "character", avatarConfig: validConfig }), {
    avatarMode: "character",
    avatarConfig: validConfig,
  });
});

test("동일한 캐릭터 설정은 Firestore map 키 순서와 무관하게 같다", () => {
  const reversed = Object.fromEntries(Object.entries(validConfig).reverse());
  assert.equal(sameAvatarConfig(validConfig, reversed), true);
  assert.equal(sameAvatarConfig(validConfig, { ...validConfig, eyes: "eyes-05" }), false);
  assert.equal(sameAvatarConfig({ ...validConfig, rawSvg: "<svg />" }, validConfig), false);
  assert.equal(sameAvatarConfig(null, null), true);
});

test("avatar API는 인증이 필요하고 본인 프로필의 검증된 필드만 영속화한다", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const route = source.slice(
    source.indexOf('app.patch("/api/profile/avatar"'),
    source.indexOf('app.patch("/api/profile"'),
  );
  assert.match(route, /app\.patch\("\/api\/profile\/avatar", requireUser/);
  assert.match(route, /normalizeAvatarPatch\(req\.body, current\)/);
  assert.match(route, /db\.collection\("profiles"\)\.doc\(req\.auth\.uid\)\.update\(patch\)/);
  assert.match(route, /avatarMode:[\s\S]*avatarConfig:[\s\S]*updatedAt:/);
  assert.doesNotMatch(route, /avatarUrl|svg|html|url/i);
});

test("Cloud Run API 이미지에 avatar 검증 모듈을 포함한다", async () => {
  const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");
  assert.match(dockerfile, /COPY[^\r\n]*\bavatar\.mjs\b/);
});

test("프로필, 글, 댓글, 대화, 검색과 알림 응답은 공통 avatar 계약을 사용한다", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  assert.match(source, /function publicProfile\([\s\S]*avatarFields\(profile\)/);
  assert.match(source, /function avatarPresentation\([\s\S]*avatarUrl:[\s\S]*avatarFields\(profile/);
  assert.match(source, /async function conversationView\([\s\S]*profileForOthers\(partnerSnapshot\.data\(\)\)/);
  assert.match(source, /app\.get\("\/api\/notifications"[\s\S]*profileForOthers\(actors\.get/);

  const posts = source.slice(source.indexOf('app.get("/api/posts"'), source.indexOf('app.get("/api/corrections/received"'));
  assert.ok((posts.match(/avatarPresentation\(/g) || []).length >= 5, "post list/detail/create and reply responses propagate avatars");

  const search = source.slice(source.indexOf('app.get("/api/search"'), source.indexOf('app.post("/api/translate"'));
  assert.match(search, /profilesByIds\(posts\.map/);
  assert.match(search, /avatarPresentation\(postAuthors\.get\(post\.authorId\)\)/);

  const corrections = source.slice(
    source.indexOf('app.get("/api/corrections/received"'),
    source.indexOf('app.get("/api/likes/sent"'),
  );
  assert.match(corrections, /avatarPresentation\(author\)/);
  assert.match(corrections, /fromAvatarMode:[\s\S]*fromAvatarConfig:/);
});
