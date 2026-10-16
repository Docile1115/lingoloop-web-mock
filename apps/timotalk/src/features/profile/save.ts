/**
 * 프로필 저장. 첫 설정과 프로필 편집이 같이 씁니다.
 *
 * 오늘의 파트너는 "배우는 말의 원어민"을 찾습니다(매칭 조건 targetLanguages). 서버 기본값은 영어라,
 * 첫 설정이나 배우는 말을 바꿀 때 조건도 맞추지 않으면 일본어를 배우는 사람에게 영어 원어민이 추천됩니다.
 * 조건 저장(POST /api/matching/preferences)은 빠진 칸을 기본값으로 덮으므로, 지금 조건을 읽어 언어만 바꿉니다.
 * 조건 저장이 실패해도 프로필 저장은 끝난 것으로 둡니다 — 조건은 나중에 다시 고를 수 있습니다.
 */
import { api } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { profilePatch, type ProfileDraft } from "./draft";

type Preferences = Record<string, unknown> & { targetLanguages?: string[] };

async function pointMatchingAt(learningCodes: string[], availability: string[], firstRun: boolean) {
  const current = firstRun ? null : await api<{ preferences: Preferences }>("/api/matching/preferences").then((data) => data.preferences);
  await api("/api/matching/preferences", {
    body: {
      ...(current ?? {}),
      targetLanguages: learningCodes,
      // 첫 설정에서 고른 대화 시간이 있으면 조건에도 넣습니다(서버 기본값은 평일 저녁 하나).
      ...(firstRun && availability.length ? { availability } : {}),
    },
  });
}

export async function saveProfile(draft: ProfileDraft, me: Profile, firstRun: boolean): Promise<Profile> {
  const saved = await api<Profile>("/api/profile", {
    method: "PATCH",
    body: { ...profilePatch(draft, me), ...(firstRun ? { completeOnboarding: true } : {}) },
  });
  const before = me.learningLanguages.map((item) => item.code).join(",");
  const after = saved.learningLanguages.map((item) => item.code);
  if (firstRun || before !== after.join(",")) {
    await pointMatchingAt(after.slice(0, 3), draft.availability, firstRun).catch(() => undefined);
  }
  // 저장은 됐는데 응답에 완료 시각이 빠졌더라도 이번 실행에서는 첫 설정을 다시 묻지 않습니다.
  // 서버 값이 기준이라 다음 실행 때 /api/auth/me 가 다시 판단합니다.
  return firstRun && saved.onboardedAt === null ? { ...saved, onboardedAt: undefined } : saved;
}
