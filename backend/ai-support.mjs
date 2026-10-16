/**
 * AI 대화 도움(첫 인사·이어 묻기·문장 다듬기)의 언어 규칙과 응답 모양.
 *
 * 예전에는 상대의 언어만 AI 에 보내서, 첫 인사가 어떤 언어로 나올지 그때그때 달랐습니다.
 * 이제 연습하는 말(practice)과 설명하는 말(helper)을 정해서 보냅니다.
 *  - practice: 내가 배우는 말 중 상대의 모국어(상대가 가르쳐 줄 말). 첫 인사·이어 묻기는 이 말로 씁니다.
 *    겹치는 말이 없으면 상대의 모국어입니다 — 상대가 반드시 읽을 수 있고, 오늘의 파트너도 이 말로 골랐습니다.
 *    (새 앱 대화방의 apps/timotalk/src/features/chat/language.ts exchangeLanguages 와 같은 순서입니다.)
 *  - helper: 화면 언어(없으면 내 모국어). 번역·주제·팁은 이 말로 씁니다.
 *
 * 응답에는 문장+번역 묶음(openers·followUps)과 함께, 예전 화면이 읽는 문자열 목록
 * (suggestedOpeners·followUpQuestions)도 그대로 채웁니다 — 지금 웹·앱이 바뀌지 않아도 됩니다.
 */

/** 화면 언어로 받는 값. 그 밖의 값은 무시하고 내 모국어를 씁니다. */
const SCREEN_LOCALES = new Set(["ko", "en", "ja"]);

export function supportLanguages(learner, partner, locale) {
  const learning = (learner?.learningLanguages || []).map((item) => item?.code).filter(Boolean);
  const partnerNative = partner?.nativeLanguages || [];
  const practice = learning.find((code) => partnerNative.includes(code)) || partnerNative[0] || learning[0] || "en";
  const helper = SCREEN_LOCALES.has(locale) ? locale : learner?.nativeLanguages?.[0] || "ko";
  return { practice, helper };
}

const LINE = {
  type: "object",
  additionalProperties: false,
  properties: { text: { type: "string" }, translation: { type: "string" } },
  required: ["text", "translation"],
};

export const SUPPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    topics: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
    openers: { type: "array", items: LINE, minItems: 3, maxItems: 3 },
    followUps: { type: "array", items: LINE, minItems: 3, maxItems: 3 },
    improvedDraft: { type: "string" },
    tip: { type: "string" },
  },
  required: ["topics", "openers", "followUps", "improvedDraft", "tip"],
};

export function supportInstructions(practiceName, helperName) {
  return [
    "You support a safe language exchange conversation. Keep suggestions friendly, non-romantic, concise, and appropriate for the learner's level.",
    `Write the text of every opener and follow-up in ${practiceName}, the language the learner is practicing with this partner, and give a natural translation of it in ${helperName}.`,
    `Write topics and tip in ${helperName}.`,
    "For improvedDraft, keep the draft's language and rewrite it naturally. If the draft is empty, return an empty string.",
  ].join(" ");
}

function cleanLines(value) {
  if (!Array.isArray(value)) return null;
  const lines = value
    .filter((item) => item && typeof item.text === "string" && item.text.trim())
    .map((item) => ({ text: item.text.trim(), translation: typeof item.translation === "string" ? item.translation.trim() : "" }));
  return lines.length ? lines : null;
}

/** AI 응답을 확인하고 화면이 읽는 모양으로 바꿉니다. 형식이 틀리면 null 입니다. */
export function normalizeSupport(raw) {
  if (!raw || typeof raw !== "object") return null;
  const openers = cleanLines(raw.openers);
  const followUps = cleanLines(raw.followUps);
  const topics = Array.isArray(raw.topics) ? raw.topics.filter((item) => typeof item === "string" && item.trim()) : [];
  if (!openers || !followUps || !topics.length || typeof raw.improvedDraft !== "string" || typeof raw.tip !== "string") return null;
  return {
    topics,
    openers,
    followUps,
    suggestedOpeners: openers.map((line) => line.text),
    followUpQuestions: followUps.map((line) => line.text),
    improvedDraft: raw.improvedDraft,
    tip: raw.tip,
  };
}
