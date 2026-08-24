import assert from "node:assert/strict";
import test from "node:test";
import { extractGeminiText, GeminiProviderError, generateGeminiContent } from "../gemini.mjs";

test("Gemini 후보의 텍스트 파트를 결합한다", () => {
  assert.equal(
    extractGeminiText({
      candidates: [{ finishReason: "STOP", content: { parts: [{ text: "안녕" }, { text: "하세요" }] } }],
    }),
    "안녕하세요",
  );
});

test("Gemini 안전 차단 응답을 사용자용 오류로 변환한다", () => {
  assert.throws(
    () => extractGeminiText({ promptFeedback: { blockReason: "SAFETY" } }),
    (error) => error instanceof GeminiProviderError && error.status === 422 && error.code === "AI_SAFETY_BLOCKED",
  );
});

test("Gemini 요청은 인증 키 헤더와 비용 절감 설정을 사용한다", async () => {
  let request;
  const body = await generateGeminiContent({
    apiKey: "test-secret",
    model: "gemini-2.5-flash-lite",
    baseUrl: "https://aiplatform.googleapis.com/v1/projects/test-project/locations/global/publishers/google/models",
    instructions: "Translate faithfully.",
    input: "안녕하세요",
    generationConfig: { responseMimeType: "text/plain", maxOutputTokens: 200 },
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Hello" }] } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.equal(extractGeminiText(body), "Hello");
  assert.match(request.url, /^https:\/\/aiplatform\.googleapis\.com\/v1\/projects\/test-project\/locations\/global\/publishers\/google\/models\/gemini-2\.5-flash-lite:generateContent$/);
  assert.equal(request.init.headers["x-goog-api-key"], "test-secret");
  const payload = JSON.parse(request.init.body);
  assert.deepEqual(payload.generationConfig.thinkingConfig, { thinkingBudget: 0 });
  assert.equal(payload.generationConfig.maxOutputTokens, 200);
  assert.equal(payload.contents[0].parts[0].text, "안녕하세요");
});

test("Gemini 429와 공급자 오류에 비밀 응답을 노출하지 않는다", async () => {
  await assert.rejects(
    generateGeminiContent({
      apiKey: "test-secret",
      model: "gemini-2.5-flash-lite",
      instructions: "test",
      input: "test",
      fetchImpl: async () => new Response(JSON.stringify({ error: { message: "provider secret detail" } }), { status: 429 }),
    }),
    (error) => error instanceof GeminiProviderError && error.status === 429 && !error.message.includes("provider secret detail"),
  );
  await assert.rejects(
    generateGeminiContent({
      apiKey: "test-secret",
      model: "gemini-2.5-flash-lite",
      instructions: "test",
      input: "test",
      fetchImpl: async () => new Response("not-json", { status: 500 }),
    }),
    (error) => error instanceof GeminiProviderError && error.status === 502 && error.code === "AI_PROVIDER_ERROR",
  );
});
