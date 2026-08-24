const DEFAULT_GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiProviderError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "GeminiProviderError";
    this.status = status;
    this.code = code;
  }
}

export function extractGeminiText(body) {
  const blockReason = body?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new GeminiProviderError(422, "AI_SAFETY_BLOCKED", "안전 정책상 이 요청의 AI 응답을 제공할 수 없습니다.");
  }

  const candidate = body?.candidates?.[0];
  if (!candidate) {
    throw new GeminiProviderError(502, "AI_EMPTY_RESPONSE", "AI 응답을 읽지 못했습니다.");
  }

  const finishReason = candidate.finishReason;
  if (finishReason && finishReason !== "STOP") {
    if (["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY"].includes(finishReason)) {
      throw new GeminiProviderError(422, "AI_SAFETY_BLOCKED", "안전 정책상 이 요청의 AI 응답을 제공할 수 없습니다.");
    }
    throw new GeminiProviderError(502, "AI_INCOMPLETE_RESPONSE", "AI 응답이 완성되지 않았습니다. 내용을 줄여 다시 시도해 주세요.");
  }

  const text = (candidate.content?.parts || [])
    .filter((part) => typeof part?.text === "string")
    .map((part) => part.text)
    .join("")
    .trim();
  if (!text) {
    throw new GeminiProviderError(502, "AI_EMPTY_RESPONSE", "AI 응답을 읽지 못했습니다.");
  }
  return text;
}

export async function generateGeminiContent({
  apiKey,
  model,
  baseUrl = DEFAULT_GEMINI_API_BASE_URL,
  instructions,
  input,
  generationConfig = {},
  fetchImpl = fetch,
  timeoutMs = 45_000,
}) {
  let response;
  try {
    response = await fetchImpl(
      `${baseUrl.replace(/\/+$/, "")}/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instructions }] },
          contents: [{ role: "user", parts: [{ text: input }] }],
          generationConfig: {
            maxOutputTokens: 800,
            temperature: 0.2,
            thinkingConfig: { thinkingBudget: 0 },
            ...generationConfig,
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
  } catch {
    throw new GeminiProviderError(503, "AI_PROVIDER_UNAVAILABLE", "AI 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  }

  const body = await response.json().catch(() => ({}));
  if (response.status === 429) {
    throw new GeminiProviderError(429, "AI_PROVIDER_RATE_LIMITED", "AI 요청이 많습니다. 잠시 후 다시 시도해 주세요.");
  }
  if (!response.ok) {
    throw new GeminiProviderError(502, "AI_PROVIDER_ERROR", "AI 요청을 처리하지 못했습니다.");
  }
  return body;
}
