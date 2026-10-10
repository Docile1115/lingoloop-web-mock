import assert from "node:assert/strict";
import test from "node:test";
import { ONLINE_WINDOW_MS, PRESENCE_WRITE_INTERVAL_MS, isDiscoverable, presenceIsStale, presenceOf } from "../discovery.mjs";

const now = Date.parse("2026-10-10T12:00:00.000Z");
const ago = (ms) => new Date(now - ms).toISOString();

test("접속 상태는 저장된 status 가 아니라 마지막 활동 시각으로 정한다", () => {
  assert.equal(presenceOf({ status: "online", lastActiveAt: ago(60_000) }, now), "online");
  // 가입 때 써 둔 "online" 이 남아 있어도 오래 활동이 없으면 접속 중이 아닙니다.
  assert.equal(presenceOf({ status: "online", lastActiveAt: ago(ONLINE_WINDOW_MS + 1) }, now), "offline");
  assert.equal(presenceOf({ status: "online" }, now), "offline");
  assert.equal(presenceOf(null, now), "offline");
});

test("마지막 활동 시각은 몇 분에 한 번만 다시 쓴다", () => {
  assert.equal(presenceIsStale({ lastActiveAt: ago(60_000) }, now), false);
  assert.equal(presenceIsStale({ lastActiveAt: ago(PRESENCE_WRITE_INTERVAL_MS + 1) }, now), true);
  assert.equal(presenceIsStale({}, now), true);
});

test("첫 설정을 마치지 않은 새 계정은 추천·검색에 나오지 않는다", () => {
  assert.equal(isDiscoverable({ accountStatus: "active", onboardedAt: null }), false);
  assert.equal(isDiscoverable({ accountStatus: "active", onboardedAt: "2026-10-10T11:00:00.000Z" }), true);
  // 이 기능 전에 만든 계정에는 onboardedAt 이 없습니다 — 마친 것으로 봅니다.
  assert.equal(isDiscoverable({ accountStatus: "active" }), true);
  assert.equal(isDiscoverable({ accountStatus: "restricted", onboardedAt: "2026-10-10T11:00:00.000Z" }), false);
  assert.equal(isDiscoverable(undefined), false);
});
