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

const LATIN_SCRIPT = new Set(["en", "es", "fr", "de"]);

/**
 * 소리 내어 읽을 말. 글자 모양으로 알 수 있으면 그 말(가나·한글·한자)이고, 로마자면 상대가 쓰는 로마자 말
 * (모국어 먼저, 그다음 배우는 말) 중 첫 번째입니다. 스페인어 문장을 영어 목소리로 읽지 않게 합니다.
 */
export function speechLanguage(text: string, partner: Speaker | null): string {
  const script = guessLanguage(text);
  if (script && script !== "en") return script;
  const candidates = [...(partner?.nativeLanguages ?? []), ...(partner?.learningLanguages ?? []).map((item) => item.code)];
  return candidates.find((code) => LATIN_SCRIPT.has(code)) ?? script;
}
