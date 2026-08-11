import {
  bootstrap,
  conversations,
  corrections,
  currentUser,
  languages,
  notifications,
  partners,
  posts,
  voiceRooms,
  type ChatMessage,
  type Correction,
} from "./data";

const API_VERSION = "0.1.0";
const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

type JsonObject = Record<string, unknown>;
type Meta = Record<string, unknown>;

interface ApiContext {
  request: Request;
  url: URL;
  requestId: string;
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly headers?: HeadersInit,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function requestIdFor(request: Request): string {
  return request.headers.get("x-request-id")?.slice(0, 128) || crypto.randomUUID();
}

function corsHeaders(): HeadersInit {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization, X-Request-ID",
    "access-control-expose-headers": "X-Request-ID",
    "access-control-max-age": "86400",
  };
}

function jsonResponse(
  context: ApiContext,
  data: unknown,
  options: { status?: number; meta?: Meta; headers?: HeadersInit } = {},
): Response {
  const headers = new Headers(corsHeaders());
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-request-id", context.requestId);
  if (options.headers) {
    new Headers(options.headers).forEach((value, key) => headers.set(key, value));
  }

  return new Response(
    JSON.stringify({
      data,
      meta: {
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
        mock: true,
        ...options.meta,
      },
    }),
    { status: options.status ?? 200, headers },
  );
}

function errorResponse(context: ApiContext, error: ApiError): Response {
  const headers = new Headers(corsHeaders());
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-request-id", context.requestId);
  if (error.headers) {
    new Headers(error.headers).forEach((value, key) => headers.set(key, value));
  }

  return new Response(
    JSON.stringify({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
      meta: {
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
        mock: true,
      },
    }),
    { status: error.status, headers },
  );
}

function assertMethod(request: Request, allowed: string[]): void {
  if (!allowed.includes(request.method.toUpperCase())) {
    throw new ApiError(
      405,
      "METHOD_NOT_ALLOWED",
      `${request.method.toUpperCase()} 메서드는 이 엔드포인트에서 지원하지 않습니다.`,
      { allowed },
      { allow: allowed.join(", ") },
    );
  }
}

async function readJsonBody(request: Request): Promise<JsonObject> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "요청 본문은 64KB 이하여야 합니다.");
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type을 application/json으로 보내주세요.");
  }

  const raw = await request.text();
  if (!raw.trim()) {
    throw new ApiError(400, "EMPTY_BODY", "JSON 요청 본문이 필요합니다.");
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "요청 본문은 64KB 이하여야 합니다.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError(400, "INVALID_JSON", "올바른 JSON 형식이 아닙니다.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ApiError(400, "INVALID_BODY", "JSON 객체를 요청 본문으로 보내주세요.");
  }
  return parsed as JsonObject;
}

function requiredString(body: JsonObject, key: string, maxLength = 2_000): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(422, "VALIDATION_ERROR", `\`${key}\` 필드는 비어 있지 않은 문자열이어야 합니다.`, { field: key });
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ApiError(422, "VALIDATION_ERROR", `\`${key}\` 필드는 ${maxLength}자를 넘을 수 없습니다.`, { field: key, maxLength });
  }
  return normalized;
}

function optionalString(body: JsonObject, key: string, maxLength = 2_000): string | undefined {
  const value = body[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new ApiError(422, "VALIDATION_ERROR", `\`${key}\` 필드는 문자열이어야 합니다.`, { field: key });
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ApiError(422, "VALIDATION_ERROR", `\`${key}\` 필드는 ${maxLength}자를 넘을 수 없습니다.`, { field: key, maxLength });
  }
  return normalized;
}

function parsePagination(url: URL, total: number): { cursor: number; limit: number; nextCursor: string | null; total: number } {
  const cursorParam = url.searchParams.get("cursor");
  const limitParam = url.searchParams.get("limit");
  const cursor = cursorParam === null ? 0 : Number(cursorParam);
  const requestedLimit = limitParam === null ? DEFAULT_PAGE_SIZE : Number(limitParam);

  if (!Number.isInteger(cursor) || cursor < 0) {
    throw new ApiError(400, "INVALID_CURSOR", "cursor는 0 이상의 정수여야 합니다.");
  }
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
    throw new ApiError(400, "INVALID_LIMIT", "limit은 1 이상의 정수여야 합니다.");
  }

  const limit = Math.min(requestedLimit, MAX_PAGE_SIZE);
  return {
    cursor,
    limit,
    nextCursor: cursor + limit < total ? String(cursor + limit) : null,
    total,
  };
}

function page<T>(context: ApiContext, items: T[]): Response {
  const pagination = parsePagination(context.url, items.length);
  const data = items.slice(pagination.cursor, pagination.cursor + pagination.limit);
  return jsonResponse(context, data, { meta: { pagination } });
}

function languageExists(code: string): boolean {
  return languages.some((language) => language.code === code);
}

function detectLanguage(text: string): string {
  if (/[가-힣]/u.test(text)) return "ko";
  if (/[ぁ-んァ-ン]/u.test(text)) return "ja";
  if (/[\u4E00-\u9FFF]/u.test(text)) return "zh";
  return "en";
}

const translationSamples: Record<string, Record<string, string>> = {
  "안녕하세요": { en: "Hello", ja: "こんにちは", es: "Hola" },
  "오늘도 좋은 하루 보내세요.": { en: "Have a great day today, too.", ja: "今日も良い一日を過ごしてください。" },
  "How did your presentation go?": { ko: "발표는 어땠어요?", ja: "プレゼンはどうでしたか？" },
  "Nice to meet you": { ko: "만나서 반가워요", ja: "はじめまして", es: "Encantado de conocerte" },
};

function translateSample(text: string, targetLanguage: string): { translatedText: string; alternatives: string[] } {
  const exact = translationSamples[text]?.[targetLanguage];
  if (exact) return { translatedText: exact, alternatives: [] };

  const target = languages.find((language) => language.code === targetLanguage)?.nativeName ?? targetLanguage;
  return {
    translatedText: `[${target} 목업 번역] ${text}`,
    alternatives: [],
  };
}

function handlePartners(context: ApiContext): Response {
  assertMethod(context.request, ["GET"]);
  const query = context.url.searchParams.get("q")?.trim().toLocaleLowerCase();
  const nativeLanguage = context.url.searchParams.get("nativeLanguage");
  const learningLanguage = context.url.searchParams.get("learningLanguage");
  const status = context.url.searchParams.get("status");

  const filtered = partners.filter((partner) => {
    if (nativeLanguage && !partner.nativeLanguages.includes(nativeLanguage)) return false;
    if (learningLanguage && !partner.learningLanguages.some((item) => item.code === learningLanguage)) return false;
    if (status && partner.status !== status) return false;
    if (!query) return true;
    const haystack = [partner.name, partner.handle, partner.bio, ...partner.interests].join(" ").toLocaleLowerCase();
    return haystack.includes(query);
  });

  return page(context, filtered);
}

function handlePosts(context: ApiContext): Response {
  assertMethod(context.request, ["GET"]);
  const language = context.url.searchParams.get("language");
  const authorId = context.url.searchParams.get("authorId");
  const tag = context.url.searchParams.get("tag")?.replace(/^#/, "").toLocaleLowerCase();
  const filtered = posts.filter((post) => {
    if (language && post.language !== language && post.targetLanguage !== language) return false;
    if (authorId && post.author.id !== authorId) return false;
    if (tag && !post.tags.some((item) => item.replace(/^#/, "").toLocaleLowerCase() === tag)) return false;
    return true;
  });
  return page(context, filtered);
}

function handleConversations(context: ApiContext): Response {
  assertMethod(context.request, ["GET"]);
  const unreadOnly = context.url.searchParams.get("unread") === "true";
  const data = unreadOnly ? conversations.filter((conversation) => conversation.unreadCount > 0) : conversations;
  return page(context, data);
}

function handleConversationRoute(context: ApiContext, segments: string[]): Response | null {
  if (segments[0] !== "conversations" || !segments[1]) return null;
  const conversation = conversations.find((item) => item.id === segments[1]);
  if (!conversation) throw new ApiError(404, "CONVERSATION_NOT_FOUND", "대화를 찾을 수 없습니다.");

  if (segments.length === 2) {
    assertMethod(context.request, ["GET"]);
    return jsonResponse(context, conversation);
  }
  if (segments.length === 3 && segments[2] === "messages") {
    assertMethod(context.request, ["GET"]);
    return page(context, conversation.messages);
  }
  return null;
}

async function createMessage(context: ApiContext): Promise<Response> {
  assertMethod(context.request, ["POST"]);
  const body = await readJsonBody(context.request);
  const conversationId = requiredString(body, "conversationId", 128);
  const text = requiredString(body, "text", 4_000);
  const conversation = conversations.find((item) => item.id === conversationId);
  if (!conversation) throw new ApiError(404, "CONVERSATION_NOT_FOUND", "대화를 찾을 수 없습니다.");

  const type = body.type ?? "text";
  if (type !== "text" && type !== "voice") {
    throw new ApiError(422, "VALIDATION_ERROR", "type은 text 또는 voice여야 합니다.", { field: "type" });
  }

  const message: ChatMessage = {
    id: `msg-${crypto.randomUUID()}`,
    senderId: currentUser.id,
    type,
    text,
    sentAt: new Date().toISOString(),
    status: "sent",
    ...(type === "voice" && typeof body.durationSeconds === "number" ? { durationSeconds: Math.max(1, Math.round(body.durationSeconds)) } : {}),
  };

  return jsonResponse(context, { conversationId, message }, { status: 201 });
}

async function translate(context: ApiContext): Promise<Response> {
  assertMethod(context.request, ["POST"]);
  const body = await readJsonBody(context.request);
  const text = requiredString(body, "text", 2_000);
  const sourceLanguage = optionalString(body, "sourceLanguage", 10) ?? detectLanguage(text);
  const targetLanguage = requiredString(body, "targetLanguage", 10);
  if (!languageExists(targetLanguage)) {
    throw new ApiError(422, "UNSUPPORTED_LANGUAGE", "지원하지 않는 대상 언어입니다.", { targetLanguage });
  }
  if (sourceLanguage === targetLanguage) {
    throw new ApiError(422, "SAME_LANGUAGE", "원문 언어와 대상 언어가 같습니다.");
  }

  const translated = translateSample(text, targetLanguage);
  return jsonResponse(context, {
    sourceText: text,
    sourceLanguage,
    targetLanguage,
    ...translated,
    confidence: translationSamples[text]?.[targetLanguage] ? 0.98 : 0.71,
    provider: "local-mock",
  });
}

async function handleCorrections(context: ApiContext): Promise<Response> {
  if (context.request.method === "GET") {
    const sourceId = context.url.searchParams.get("sourceId");
    const sourceType = context.url.searchParams.get("sourceType");
    const filtered = corrections.filter((correction) => {
      if (sourceId && correction.sourceId !== sourceId) return false;
      if (sourceType && correction.sourceType !== sourceType) return false;
      return true;
    });
    return page(context, filtered);
  }

  assertMethod(context.request, ["GET", "POST"]);
  const body = await readJsonBody(context.request);
  const sourceId = requiredString(body, "sourceId", 128);
  const sourceType = requiredString(body, "sourceType", 16);
  if (sourceType !== "post" && sourceType !== "message") {
    throw new ApiError(422, "VALIDATION_ERROR", "sourceType은 post 또는 message여야 합니다.", { field: "sourceType" });
  }

  const correction: Correction = {
    id: `correction-${crypto.randomUUID()}`,
    sourceId,
    sourceType,
    original: requiredString(body, "original", 4_000),
    corrected: requiredString(body, "corrected", 4_000),
    explanation: optionalString(body, "explanation", 2_000) ?? "더 자연스러운 표현으로 다듬었어요.",
    author: { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar, avatarColor: currentUser.avatarColor },
    createdAt: new Date().toISOString(),
    helpfulCount: 0,
    markedHelpful: false,
  };
  return jsonResponse(context, correction, { status: 201 });
}

async function createReport(context: ApiContext): Promise<Response> {
  assertMethod(context.request, ["POST"]);
  const body = await readJsonBody(context.request);
  const targetType = requiredString(body, "targetType", 32);
  const targetId = requiredString(body, "targetId", 128);
  const reason = requiredString(body, "reason", 64);
  const allowedTargetTypes = ["user", "post", "message", "room"];
  const allowedReasons = ["spam", "harassment", "dating", "sexual_content", "hate", "impersonation", "other"];
  if (!allowedTargetTypes.includes(targetType)) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 신고 대상 유형입니다.", { field: "targetType", allowed: allowedTargetTypes });
  }
  if (!allowedReasons.includes(reason)) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 신고 사유입니다.", { field: "reason", allowed: allowedReasons });
  }

  return jsonResponse(
    context,
    {
      id: `report-${crypto.randomUUID()}`,
      targetType,
      targetId,
      reason,
      details: optionalString(body, "details", 2_000) ?? "",
      status: "received",
      submittedAt: new Date().toISOString(),
      safetyMessage: "신고가 접수되었습니다. 긴급한 위험이 있다면 현지 긴급기관에 연락해 주세요.",
    },
    { status: 201 },
  );
}

function search(context: ApiContext): Response {
  assertMethod(context.request, ["GET"]);
  const query = context.url.searchParams.get("q")?.trim().toLocaleLowerCase();
  if (!query || query.length < 2) {
    throw new ApiError(400, "INVALID_QUERY", "검색어 q는 2자 이상이어야 합니다.");
  }
  const partnerResults = partners.filter((partner) =>
    [partner.name, partner.handle, partner.bio, ...partner.interests].join(" ").toLocaleLowerCase().includes(query),
  );
  const postResults = posts.filter((post) => [post.text, ...post.tags].join(" ").toLocaleLowerCase().includes(query));
  return jsonResponse(context, { partners: partnerResults, posts: postResults }, { meta: { total: partnerResults.length + postResults.length } });
}

async function route(context: ApiContext): Promise<Response> {
  const normalizedPath = context.url.pathname.replace(/\/+$/, "") || "/";
  const segments = normalizedPath.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const resource = segments[0] ?? "";

  if (resource === "health" && segments.length === 1) {
    assertMethod(context.request, ["GET"]);
    return jsonResponse(context, {
      service: "language-exchange-mock-api",
      version: API_VERSION,
      status: "ok",
      environment: "mock",
      uptime: "stateless-worker",
    });
  }
  if (resource === "bootstrap" && segments.length === 1) {
    assertMethod(context.request, ["GET"]);
    return jsonResponse(context, bootstrap);
  }
  if (resource === "partners" && segments.length === 1) return handlePartners(context);
  if (resource === "posts" && segments.length === 1) return handlePosts(context);
  if (resource === "conversations" && segments.length === 1) return handleConversations(context);

  const conversationResponse = handleConversationRoute(context, segments);
  if (conversationResponse) return conversationResponse;

  if (resource === "messages" && segments.length === 1) return createMessage(context);
  if (resource === "translate" && segments.length === 1) return translate(context);
  if (resource === "corrections" && segments.length === 1) return handleCorrections(context);
  if (resource === "reports" && segments.length === 1) return createReport(context);
  if (resource === "rooms" && segments.length === 1) {
    assertMethod(context.request, ["GET"]);
    return page(context, voiceRooms);
  }
  if (resource === "notifications" && segments.length === 1) {
    assertMethod(context.request, ["GET"]);
    return page(context, [...notifications]);
  }
  if (resource === "profile" && segments.length === 1) {
    assertMethod(context.request, ["GET"]);
    return jsonResponse(context, currentUser);
  }
  if (resource === "languages" && segments.length === 1) {
    assertMethod(context.request, ["GET"]);
    return jsonResponse(context, languages);
  }
  if (resource === "search" && segments.length === 1) return search(context);

  throw new ApiError(404, "NOT_FOUND", `API 경로를 찾을 수 없습니다: ${context.url.pathname}`);
}

/**
 * Cloudflare Worker-compatible mock API handler.
 * Returns null for non-API requests so the application router can handle them.
 */
export async function handleMockApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api" && !url.pathname.startsWith("/api/")) return null;

  const context: ApiContext = { request, url, requestId: requestIdFor(request) };
  if (request.method.toUpperCase() === "OPTIONS") {
    const headers = new Headers(corsHeaders());
    headers.set("x-request-id", context.requestId);
    return new Response(null, { status: 204, headers });
  }

  try {
    return await route(context);
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(context, error);
    console.error("Unhandled mock API error", error);
    return errorResponse(context, new ApiError(500, "INTERNAL_ERROR", "목업 API 처리 중 오류가 발생했습니다."));
  }
}
