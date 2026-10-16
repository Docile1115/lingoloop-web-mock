import { guessLanguage } from "@/lib/script";
import type { Profile } from "@/lib/types";

type Speaker = Pick<Profile, "nativeLanguages" | "learningLanguages">;

/**
 * 이 상대와 쓰는 두 말. 서버의 AI 대화 도움(backend/ai-support.mjs supportLanguages)과 같은 순서로 고릅니다.
 *  - practice(내가 연습하는 말): 내가 배우는 말 중 상대의 모국어 → 상대의 모국어 → 내가 처음 배우는 말.
 *    겹치는 말이 없으면 상대가 반드시 읽을 수 있는 상대의 모국어를 씁니다(오늘의 파트너도 이 말로 골랐습니다).
 *  - teach(상대가 연습하는 말): 상대가 배우는 말 중 내 모국어 → 내 첫 모국어.
 */
export function exchangeLanguages(me: Speaker, partner: Speaker | null): { practice: string; teach: string } {
  const myLearning = me.learningLanguages.map((item) => item.code);
  const partnerNative = partner?.nativeLanguages ?? [];
  const partnerLearning = (partner?.learningLanguages ?? []).map((item) => item.code);
  return {
    practice: myLearning.find((code) => partnerNative.includes(code)) ?? partnerNative[0] ?? myLearning[0] ?? "",
    teach: me.nativeLanguages.find((code) => partnerLearning.includes(code)) ?? me.nativeLanguages[0] ?? "",
  };
}

/**
 * 번역 방향 정하기. 글자 모양으로 대략 어떤 말인지 보고(lib/script.ts),
 * 상대 말이 내 화면 언어와 다르면 화면 언어로, 같으면(상대가 내 말을 연습하는 중) 내가 연습하는 말로 옮깁니다.
 */
export function translationTarget(text: string, screenLanguage: string, practiceLanguage?: string): string {
  const source = guessLanguage(text);
  if (source && source === screenLanguage) return practiceLanguage || (screenLanguage === "en" ? "ko" : "en");
  return screenLanguage;
}
