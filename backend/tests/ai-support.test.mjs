import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSupport, supportInstructions, supportLanguages } from "../ai-support.mjs";

const learner = { nativeLanguages: ["ko"], learningLanguages: [{ code: "ja", level: "intermediate" }, { code: "en", level: "beginner" }] };

test("연습하는 말은 내가 배우는 말 중 상대의 모국어다", () => {
  assert.deepEqual(supportLanguages(learner, { nativeLanguages: ["ja"] }, "ko"), { practice: "ja", helper: "ko" });
  // 상대가 영어 원어민이면 두 번째로 배우는 영어로 씁니다.
  assert.deepEqual(supportLanguages(learner, { nativeLanguages: ["en"] }, "ko"), { practice: "en", helper: "ko" });
  // 겹치는 말이 없으면 상대의 모국어입니다(상대가 반드시 읽을 수 있는 말).
  assert.deepEqual(supportLanguages(learner, { nativeLanguages: ["fr"] }, "ko"), { practice: "fr", helper: "ko" });
  // 상대의 모국어를 모르면 내가 처음 배우는 말입니다.
  assert.deepEqual(supportLanguages(learner, { nativeLanguages: [] }, "ko"), { practice: "ja", helper: "ko" });
});

test("설명하는 말은 화면 언어이고, 모르는 값이면 내 모국어다", () => {
  assert.equal(supportLanguages(learner, { nativeLanguages: ["ja"] }, "en").helper, "en");
  assert.equal(supportLanguages(learner, { nativeLanguages: ["ja"] }, "fr").helper, "ko");
  assert.equal(supportLanguages(learner, { nativeLanguages: ["ja"] }, undefined).helper, "ko");
  // 프로필이 비어 있어도 던지지 않습니다.
  assert.deepEqual(supportLanguages(undefined, { nativeLanguages: ["ja"] }, undefined), { practice: "ja", helper: "ko" });
});

test("지시문에 두 언어 이름이 들어간다", () => {
  const text = supportInstructions("Japanese", "Korean");
  assert.match(text, /in Japanese/);
  assert.match(text, /translation of it in Korean/);
});

test("응답을 확인하고 예전 화면이 읽는 문자열 목록도 채운다", () => {
  const support = normalizeSupport({
    topics: ["영화", "여행", "음식"],
    openers: [
      { text: "はじめまして！", translation: "처음 뵙겠습니다!" },
      { text: " ", translation: "빈 문장은 버립니다" },
      { text: "映画が好きですか？", translation: "영화 좋아해요?" },
    ],
    followUps: [{ text: "どんな映画ですか？", translation: "어떤 영화예요?" }],
    improvedDraft: "",
    tip: "짧게 물어보세요",
  });
  assert.deepEqual(support.suggestedOpeners, ["はじめまして！", "映画が好きですか？"]);
  assert.deepEqual(support.followUpQuestions, ["どんな映画ですか？"]);
  assert.equal(support.openers[0].translation, "처음 뵙겠습니다!");
});

test("형식이 틀린 응답은 받지 않는다", () => {
  assert.equal(normalizeSupport(null), null);
  assert.equal(normalizeSupport({ topics: ["a"], openers: [], followUps: [{ text: "x", translation: "" }], improvedDraft: "", tip: "" }), null);
  assert.equal(normalizeSupport({ topics: ["a"], openers: [{ text: "x" }], followUps: [{ text: "y" }], improvedDraft: 1, tip: "" }), null);
});
