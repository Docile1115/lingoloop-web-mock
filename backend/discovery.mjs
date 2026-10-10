/** 마지막 활동이 이보다 가까우면 "접속 중"으로 봅니다. */
export const ONLINE_WINDOW_MS = 10 * 60 * 1000;
/** 마지막 활동 시각은 이 간격마다 한 번만 씁니다(요청마다 쓰면 쓰기 비용이 늘어납니다). */
export const PRESENCE_WRITE_INTERVAL_MS = 5 * 60 * 1000;

/**
 * 접속 상태는 저장된 status 가 아니라 마지막 활동 시각으로 정합니다. 예전에는 가입 때
 * "online" 을 써 두고 다시 바꾸지 않아 모두가 늘 접속 중으로 보였습니다.
 */
export function presenceOf(profile, now = Date.now()) {
  const last = Date.parse(profile?.lastActiveAt || "");
  return Number.isFinite(last) && now - last < ONLINE_WINDOW_MS ? "online" : "offline";
}

/** 마지막 활동 시각을 새로 쓸 때인지. 처음이거나 몇 분이 지났을 때만 씁니다. */
export function presenceIsStale(profile, now = Date.now()) {
  const last = Date.parse(profile?.lastActiveAt || "");
  return !Number.isFinite(last) || now - last > PRESENCE_WRITE_INTERVAL_MS;
}

/**
 * 다른 사람에게 보여도 되는 프로필인지. 첫 설정(언어·나이 등)을 마치지 않은 새 계정은
 * 서버 기본값(한국어 원어민·영어 학습·18세)이 그대로라 추천·검색에 내보내지 않습니다.
 * onboardedAt 이 없는(이 기능 전에 만든) 프로필은 마친 것으로 봅니다.
 */
export function isDiscoverable(profile) {
  return profile?.accountStatus === "active" && profile.onboardedAt !== null;
}
