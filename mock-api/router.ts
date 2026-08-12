import {
  accountVerification,
  bootstrap,
  conversationGuides,
  conversations,
  corrections,
  currentUser,
  defaultDmPrivacySettings,
  defaultMatchingPreferences,
  dmRequests,
  languages,
  notifications,
  partnerMatchingSignals,
  partners,
  posts,
  seededSafetyReports,
  voiceRooms,
  type AccountVerification,
  type AvailabilitySlot,
  type ChatMessage,
  type Correction,
  type DmPermission,
  type DmPrivacySettings,
  type DmRequest,
  type ConnectionGoal,
  type MatchingPreferences,
  type PartnerGenderPreference,
  type PreferredPartnerLevel,
  type SafetyReport,
  type UserProfile,
} from "./data";

const API_VERSION = "0.1.0";
const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const DAILY_MATCH_COUNT = 12;

let mockDmPrivacySettings: DmPrivacySettings = structuredClone(defaultDmPrivacySettings);
const mockDmRequests: DmRequest[] = structuredClone(dmRequests);
const mockSafetyReports: SafetyReport[] = structuredClone(seededSafetyReports);
const mockAccountVerification: AccountVerification = structuredClone(accountVerification);

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

const availabilitySlots: AvailabilitySlot[] = [
  "weekday-morning",
  "weekday-evening",
  "weekend-morning",
  "weekend-evening",
];
const partnerLevels: PreferredPartnerLevel[] = ["any", "beginner", "intermediate", "advanced"];
const partnerGenderPreferences: PartnerGenderPreference[] = ["any", "same", "women", "men"];
const connectionGoals: ConnectionGoal[] = ["language-exchange", "friendship", "voice-practice", "culture"];

function normalizedStringArray(
  body: JsonObject,
  key: string,
  options: {
    fallback: string[];
    required?: boolean;
    maxItems: number;
    maxItemLength?: number;
    allowSingleString?: boolean;
    transform?: (value: string) => string;
  },
): string[] {
  const rawValue = body[key];
  if (rawValue === undefined) {
    if (options.required) {
      throw new ApiError(422, "VALIDATION_ERROR", `\`${key}\` 필드는 필수입니다.`, { field: key });
    }
    return [...options.fallback];
  }

  const rawItems = options.allowSingleString && typeof rawValue === "string" ? [rawValue] : rawValue;
  if (!Array.isArray(rawItems)) {
    throw new ApiError(422, "VALIDATION_ERROR", `\`${key}\` 필드는 문자열 배열이어야 합니다.`, { field: key });
  }
  if (rawItems.length === 0 && options.required) {
    throw new ApiError(422, "VALIDATION_ERROR", `\`${key}\` 필드는 한 개 이상의 값을 포함해야 합니다.`, { field: key });
  }
  if (rawItems.length > options.maxItems) {
    throw new ApiError(422, "VALIDATION_ERROR", `\`${key}\` 필드는 최대 ${options.maxItems}개까지 선택할 수 있습니다.`, {
      field: key,
      maxItems: options.maxItems,
    });
  }

  const maxItemLength = options.maxItemLength ?? 40;
  const normalized = rawItems.map((item) => {
    if (typeof item !== "string" || !item.trim() || item.trim().length > maxItemLength) {
      throw new ApiError(422, "VALIDATION_ERROR", `\`${key}\`의 각 값은 1~${maxItemLength}자의 문자열이어야 합니다.`, {
        field: key,
      });
    }
    const value = item.trim();
    return options.transform ? options.transform(value) : value;
  });
  return [...new Set(normalized)];
}

function normalizeMatchingPreferences(body: JsonObject, requireTargetLanguages: boolean): MatchingPreferences {
  const targetLanguages = normalizedStringArray(body, "targetLanguages", {
    fallback: defaultMatchingPreferences.targetLanguages,
    required: requireTargetLanguages,
    maxItems: 3,
    maxItemLength: 10,
    transform: (value) => value.toLocaleLowerCase(),
  });
  const unsupportedLanguages = targetLanguages.filter((code) => !languageExists(code));
  if (unsupportedLanguages.length > 0) {
    throw new ApiError(422, "UNSUPPORTED_LANGUAGE", "지원하지 않는 매칭 언어가 포함되어 있습니다.", {
      field: "targetLanguages",
      unsupported: unsupportedLanguages,
    });
  }

  const preferredCountries = normalizedStringArray(body, "preferredCountries", {
    fallback: defaultMatchingPreferences.preferredCountries,
    maxItems: 5,
    maxItemLength: 2,
    transform: (value) => value.toLocaleUpperCase(),
  });
  if (preferredCountries.some((code) => !/^[A-Z]{2}$/.test(code))) {
    throw new ApiError(422, "VALIDATION_ERROR", "preferredCountries에는 ISO 2자리 국가 코드를 입력해 주세요.", {
      field: "preferredCountries",
    });
  }

  const interests = normalizedStringArray(body, "interests", {
    fallback: defaultMatchingPreferences.interests,
    maxItems: 8,
    maxItemLength: 30,
    transform: (value) => value.toLocaleLowerCase().replace(/\s+/g, " "),
  });
  const availability = normalizedStringArray(body, "availability", {
    fallback: defaultMatchingPreferences.availability,
    maxItems: availabilitySlots.length,
    maxItemLength: 24,
    allowSingleString: true,
    transform: (value) => value.toLocaleLowerCase(),
  });
  if (availability.some((slot) => !availabilitySlots.includes(slot as AvailabilitySlot))) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 availability 값입니다.", {
      field: "availability",
      allowed: availabilitySlots,
    });
  }

  const rawPartnerLevel = body.partnerLevel ?? defaultMatchingPreferences.partnerLevel;
  if (typeof rawPartnerLevel !== "string" || !partnerLevels.includes(rawPartnerLevel as PreferredPartnerLevel)) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 partnerLevel 값입니다.", {
      field: "partnerLevel",
      allowed: partnerLevels,
    });
  }
  const rawOnlineOnly = body.onlineOnly ?? defaultMatchingPreferences.onlineOnly;
  if (typeof rawOnlineOnly !== "boolean") {
    throw new ApiError(422, "VALIDATION_ERROR", "onlineOnly은 boolean 값이어야 합니다.", { field: "onlineOnly" });
  }
  const rawPartnerGender = body.partnerGender ?? defaultMatchingPreferences.partnerGender;
  if (
    typeof rawPartnerGender !== "string" ||
    !partnerGenderPreferences.includes(rawPartnerGender as PartnerGenderPreference)
  ) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 partnerGender 값입니다.", {
      field: "partnerGender",
      allowed: partnerGenderPreferences,
    });
  }
  const ageMin = body.ageMin ?? defaultMatchingPreferences.ageMin;
  const ageMax = body.ageMax ?? defaultMatchingPreferences.ageMax;
  if (!Number.isInteger(ageMin) || !Number.isInteger(ageMax) || (ageMin as number) < 18 || (ageMax as number) > 100 || (ageMin as number) > (ageMax as number)) {
    throw new ApiError(422, "VALIDATION_ERROR", "ageMin과 ageMax는 18~100 사이의 올바른 범위여야 합니다.", {
      field: "ageRange",
      min: 18,
      max: 100,
    });
  }
  const rawVerifiedOnly = body.verifiedOnly ?? defaultMatchingPreferences.verifiedOnly;
  if (typeof rawVerifiedOnly !== "boolean") {
    throw new ApiError(422, "VALIDATION_ERROR", "verifiedOnly는 boolean 값이어야 합니다.", { field: "verifiedOnly" });
  }
  const intents = normalizedStringArray(body, "intents", {
    fallback: defaultMatchingPreferences.intents,
    maxItems: connectionGoals.length,
    maxItemLength: 32,
    allowSingleString: true,
    transform: (value) => value.toLocaleLowerCase(),
  });
  if (intents.some((intent) => !connectionGoals.includes(intent as ConnectionGoal))) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 intents 값입니다.", {
      field: "intents",
      allowed: connectionGoals,
    });
  }

  return {
    targetLanguages,
    preferredCountries,
    interests,
    availability: availability as AvailabilitySlot[],
    partnerLevel: rawPartnerLevel as PreferredPartnerLevel,
    onlineOnly: rawOnlineOnly,
    partnerGender: rawPartnerGender as PartnerGenderPreference,
    ageMin: ageMin as number,
    ageMax: ageMax as number,
    verifiedOnly: rawVerifiedOnly,
    intents: intents as ConnectionGoal[],
  };
}

function todayInSeoul(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1_000).toISOString().slice(0, 10);
}

function nextRefreshAt(date: string): string {
  const startOfDayInSeoul = Date.parse(`${date}T00:00:00+09:00`);
  return new Date(startOfDayInSeoul + 24 * 60 * 60 * 1_000).toISOString();
}

function validatedDate(value: string | null): string {
  if (value === null || value === "") return todayInSeoul();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, "INVALID_DATE", "date는 YYYY-MM-DD 형식이어야 합니다.", { field: "date" });
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, "INVALID_DATE", "실제 달력에 존재하는 날짜를 입력해 주세요.", { field: "date" });
  }
  return value;
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
    entitlement: {
      tier: "free",
      charged: false,
      metered: false,
      remaining: null,
      paywall: false,
      policy: "번역은 언어 장벽을 낮추기 위한 무료 기본 기능입니다.",
    },
  });
}

async function handleDmPrivacy(context: ApiContext): Promise<Response> {
  if (context.request.method === "GET") {
    return jsonResponse(context, { settings: mockDmPrivacySettings, persisted: false });
  }

  assertMethod(context.request, ["GET", "POST"]);
  const body = await readJsonBody(context.request);
  const allowedPermissions: DmPermission[] = ["matches", "mutual-follows", "followers", "everyone"];
  const whoCanMessage = body.whoCanMessage ?? mockDmPrivacySettings.whoCanMessage;
  if (typeof whoCanMessage !== "string" || !allowedPermissions.includes(whoCanMessage as DmPermission)) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 DM 허용 범위입니다.", {
      field: "whoCanMessage",
      allowed: allowedPermissions,
    });
  }

  const booleanSetting = (key: keyof DmPrivacySettings): boolean => {
    const value = body[key] ?? mockDmPrivacySettings[key];
    if (typeof value !== "boolean") {
      throw new ApiError(422, "VALIDATION_ERROR", `\`${key}\`는 boolean 값이어야 합니다.`, { field: key });
    }
    return value;
  };

  mockDmPrivacySettings = {
    whoCanMessage: whoCanMessage as DmPermission,
    routeOthersToRequests: booleanSetting("routeOthersToRequests"),
    filterSuspectedSpam: booleanSetting("filterSuspectedSpam"),
    allowVoiceMessagesInRequests: booleanSetting("allowVoiceMessagesInRequests"),
    readReceipts: booleanSetting("readReceipts"),
  };
  return jsonResponse(context, { settings: mockDmPrivacySettings, persisted: false });
}

async function handleDmRequests(context: ApiContext): Promise<Response> {
  if (context.request.method === "GET") {
    const status = context.url.searchParams.get("status") ?? "pending";
    const allowedStatuses: DmRequest["status"][] = ["pending", "accepted", "declined", "blocked"];
    if (status !== "all" && !allowedStatuses.includes(status as DmRequest["status"])) {
      throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 요청함 상태입니다.", {
        field: "status",
        allowed: ["all", ...allowedStatuses],
      });
    }
    const filtered = status === "all" ? mockDmRequests : mockDmRequests.filter((request) => request.status === status);
    return page(context, filtered);
  }

  assertMethod(context.request, ["GET", "POST"]);
  const body = await readJsonBody(context.request);
  const requestId = requiredString(body, "requestId", 128);
  const action = requiredString(body, "action", 16);
  const request = mockDmRequests.find((item) => item.id === requestId);
  if (!request) throw new ApiError(404, "DM_REQUEST_NOT_FOUND", "DM 요청을 찾을 수 없습니다.");
  const statusByAction: Record<string, DmRequest["status"]> = {
    accept: "accepted",
    decline: "declined",
    block: "blocked",
  };
  const nextStatus = statusByAction[action];
  if (!nextStatus) {
    throw new ApiError(422, "VALIDATION_ERROR", "action은 accept, decline 또는 block이어야 합니다.", {
      field: "action",
      allowed: Object.keys(statusByAction),
    });
  }
  request.status = nextStatus;
  return jsonResponse(context, {
    request,
    conversationCreated: nextStatus === "accepted",
    senderBlocked: nextStatus === "blocked",
    persisted: false,
  });
}

function handleDmSync(context: ApiContext): Response {
  assertMethod(context.request, ["GET"]);
  return jsonResponse(context, {
    storage: "server",
    automaticSync: true,
    reinstallRecovery: true,
    retention: { mode: "until-user-deletes", userDeleteAvailable: true },
    encryption: { inTransit: true, atRest: true, endToEnd: false },
    lastSyncedAt: "2026-08-11T13:22:00.000Z",
    mockNotice: "목업 계약이며 실제 저장소에는 연결되지 않았습니다.",
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

async function handleReports(context: ApiContext, reportId?: string): Promise<Response> {
  if (context.request.method === "GET") {
    if (reportId) {
      const report = mockSafetyReports.find((item) => item.id === reportId);
      if (!report) throw new ApiError(404, "REPORT_NOT_FOUND", "신고 접수 내역을 찾을 수 없습니다.");
      return jsonResponse(context, report);
    }
    return page(context, mockSafetyReports);
  }

  if (reportId) {
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "신고 상태는 조회만 지원합니다.", { allowed: ["GET"] }, { allow: "GET" });
  }
  assertMethod(context.request, ["GET", "POST"]);
  const body = await readJsonBody(context.request);
  const targetType = requiredString(body, "targetType", 32);
  const targetId = requiredString(body, "targetId", 128);
  const reason = requiredString(body, "reason", 64);
  const allowedTargetTypes = ["user", "post", "message", "room"];
  const allowedReasons = ["spam", "scam", "harassment", "dating", "sexual_content", "hate", "impersonation", "other"];
  if (!allowedTargetTypes.includes(targetType)) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 신고 대상 유형입니다.", { field: "targetType", allowed: allowedTargetTypes });
  }
  if (!allowedReasons.includes(reason)) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 신고 사유입니다.", { field: "reason", allowed: allowedReasons });
  }

  const submittedAt = new Date().toISOString();
  const report: SafetyReport = {
    id: `report-${crypto.randomUUID()}`,
    reporterId: currentUser.id,
    targetType: targetType as SafetyReport["targetType"],
    targetId,
    reason: reason as SafetyReport["reason"],
    details: optionalString(body, "details", 2_000) ?? "",
    status: "received",
    submittedAt,
    updatedAt: submittedAt,
    nextUpdateBy: new Date(Date.parse(submittedAt) + 24 * 60 * 60 * 1_000).toISOString(),
    reporterAccountStatus: "active",
    statusHistory: [
      {
        status: "received",
        at: submittedAt,
        note: "신고자 계정에 불이익 없이 신고와 관련 증거를 접수했어요.",
      },
    ],
  };
  mockSafetyReports.unshift(report);
  return jsonResponse(context, {
    ...report,
    safetyMessage: "신고가 접수되었습니다. 신고자 계정은 활성 상태로 유지되며, 긴급한 위험이 있다면 현지 긴급기관에 연락해 주세요.",
  }, { status: 201 });
}

async function handleAccountVerification(context: ApiContext): Promise<Response> {
  if (context.request.method === "GET") return jsonResponse(context, mockAccountVerification);

  assertMethod(context.request, ["GET", "POST"]);
  const body = await readJsonBody(context.request);
  const type = requiredString(body, "type", 16);
  const action = requiredString(body, "action", 16);
  if (!(["email", "phone", "identity"] as string[]).includes(type)) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 인증 유형입니다.", { field: "type" });
  }
  if (action !== "start" && action !== "verify") {
    throw new ApiError(422, "VALIDATION_ERROR", "action은 start 또는 verify여야 합니다.", { field: "action" });
  }
  const step = mockAccountVerification.steps.find((item) => item.type === type);
  if (!step) throw new ApiError(404, "VERIFICATION_STEP_NOT_FOUND", "인증 단계를 찾을 수 없습니다.");
  step.status = action === "verify" ? "verified" : "pending";
  if (action === "verify") step.verifiedAt = new Date().toISOString();
  mockAccountVerification.updatedAt = new Date().toISOString();
  const verifiedTypes = new Set(
    mockAccountVerification.steps.filter((item) => item.status === "verified").map((item) => item.type),
  );
  mockAccountVerification.activationEligible = mockAccountVerification.requiredForActivation.every((item) => verifiedTypes.has(item));
  mockAccountVerification.accountStatus = mockAccountVerification.activationEligible ? "active" : "pending-verification";
  mockAccountVerification.assuranceLevel = verifiedTypes.has("identity")
    ? "identity"
    : verifiedTypes.has("phone")
      ? "phone"
      : verifiedTypes.has("email")
        ? "email"
        : "none";
  return jsonResponse(context, { verification: mockAccountVerification, persisted: false });
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

async function handleMatchingPreferences(context: ApiContext): Promise<Response> {
  if (context.request.method === "GET") {
    return jsonResponse(context, {
      preferences: normalizeMatchingPreferences({}, false),
      persisted: false,
      nextRefreshAt: nextRefreshAt(todayInSeoul()),
    });
  }

  assertMethod(context.request, ["GET", "POST"]);
  const body = await readJsonBody(context.request);
  const preferences = normalizeMatchingPreferences(body, true);
  return jsonResponse(context, {
    preferences,
    persisted: false,
    nextRefreshAt: nextRefreshAt(todayInSeoul()),
  });
}

function matchingPreferencesFromQuery(url: URL): MatchingPreferences {
  const body: JsonObject = {};
  for (const key of ["targetLanguages", "preferredCountries", "interests", "availability", "intents"] as const) {
    const value = url.searchParams.get(key);
    if (value !== null) body[key] = value.split(",");
  }

  const partnerLevel = url.searchParams.get("partnerLevel");
  if (partnerLevel !== null) body.partnerLevel = partnerLevel;
  const onlineOnly = url.searchParams.get("onlineOnly");
  if (onlineOnly !== null) {
    if (onlineOnly !== "true" && onlineOnly !== "false") {
      throw new ApiError(422, "VALIDATION_ERROR", "onlineOnly query는 true 또는 false여야 합니다.", { field: "onlineOnly" });
    }
    body.onlineOnly = onlineOnly === "true";
  }
  const verifiedOnly = url.searchParams.get("verifiedOnly");
  if (verifiedOnly !== null) {
    if (verifiedOnly !== "true" && verifiedOnly !== "false") {
      throw new ApiError(422, "VALIDATION_ERROR", "verifiedOnly query는 true 또는 false여야 합니다.", { field: "verifiedOnly" });
    }
    body.verifiedOnly = verifiedOnly === "true";
  }
  const partnerGender = url.searchParams.get("partnerGender");
  if (partnerGender !== null) body.partnerGender = partnerGender;
  for (const key of ["ageMin", "ageMax"] as const) {
    const value = url.searchParams.get(key);
    if (value !== null) body[key] = Number(value);
  }
  return normalizeMatchingPreferences(body, false);
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function partnerLevelMatches(partner: UserProfile, preferredLevel: PreferredPartnerLevel): boolean {
  if (preferredLevel === "any") return true;
  const koreanLevel = partner.learningLanguages.find((item) => item.code === "ko")?.level;
  if (preferredLevel === "beginner") return koreanLevel === "beginner" || koreanLevel === "elementary";
  return koreanLevel === preferredLevel;
}

function scorePartner(partner: UserProfile, preferences: MatchingPreferences, date: string) {
  const signal = partnerMatchingSignals.find((item) => item.partnerId === partner.id);
  const matchedLanguages = partner.nativeLanguages.filter((code) => preferences.targetLanguages.includes(code));
  const matchedInterests = partner.interests.filter((interest) => preferences.interests.includes(interest.toLocaleLowerCase()));
  const matchedAvailability = signal?.availability.filter((slot) => preferences.availability.includes(slot)) ?? [];
  const reasons: string[] = [];
  let score = 30;

  if (matchedLanguages.length > 0) {
    score += 22;
    const names = matchedLanguages.map((code) => languages.find((language) => language.code === code)?.nativeName ?? code);
    reasons.push(`${names.join(" · ")} 원어민 파트너예요`);
  }
  if (preferences.preferredCountries.includes(partner.country.code)) {
    score += 12;
    reasons.push(`희망 지역인 ${partner.country.flag} ${partner.country.name}에 있어요`);
  }
  if (matchedInterests.length > 0) {
    score += Math.min(10, matchedInterests.length * 5);
    reasons.push(`${matchedInterests.slice(0, 2).join(" · ")} 관심사가 같아요`);
  }
  if (matchedAvailability.length > 0) {
    score += 8;
    reasons.push("선호하는 학습 시간대가 겹쳐요");
  }
  if (partnerLevelMatches(partner, preferences.partnerLevel)) {
    score += preferences.partnerLevel === "any" ? 2 : 7;
    if (preferences.partnerLevel !== "any") reasons.push("원하는 대화 난이도와 잘 맞아요");
  }
  if (partner.status === "online") {
    score += 5;
    reasons.push("지금 바로 대화를 시작할 수 있어요");
  } else if (partner.status === "recently") {
    score += 2;
  }
  if (partner.verified) score += 3;
  const matchedIntents = partner.intents.filter((intent) => preferences.intents.includes(intent));
  if (matchedIntents.length > 0) {
    score += Math.min(8, matchedIntents.length * 4);
    reasons.push("원하는 교류 목적이 같아요");
  }
  score += Math.round(partner.exchangeScore / 14);
  score += stableHash(`${date}:${partner.id}`) % 5;

  if (reasons.length < 2) reasons.push(`언어교환 신뢰 점수 ${partner.exchangeScore}점이에요`);
  if (reasons.length < 2) reasons.push(`응답률이 ${partner.responseRate}%로 꾸준해요`);

  const icebreakers = signal?.icebreakers ?? [`${partner.name}에게 ${partner.interests[0]}에 관해 물어보세요.`];
  return {
    partner,
    score: Math.min(99, score),
    matchReasons: reasons.slice(0, 4),
    icebreaker: icebreakers[stableHash(`${partner.id}:${date}:icebreaker`) % icebreakers.length],
  };
}

function satisfiesMatchingPreferences(partner: UserProfile, preferences: MatchingPreferences): boolean {
  const signal = partnerMatchingSignals.find((item) => item.partnerId === partner.id);
  const matchesTargetLanguage = partner.nativeLanguages.some((code) => preferences.targetLanguages.includes(code));
  const matchesCountry =
    preferences.preferredCountries.length === 0 || preferences.preferredCountries.includes(partner.country.code);
  const matchesInterest =
    preferences.interests.length === 0 ||
    partner.interests.some((interest) => preferences.interests.includes(interest.toLocaleLowerCase()));
  const matchesAvailability =
    preferences.availability.length === 0 ||
    Boolean(signal?.availability.some((slot) => preferences.availability.includes(slot)));
  const matchesGender =
    preferences.partnerGender === "any" ||
    (preferences.partnerGender === "same" && partner.gender === currentUser.gender) ||
    (preferences.partnerGender === "women" && partner.gender === "woman") ||
    (preferences.partnerGender === "men" && partner.gender === "man");
  const matchesIntent =
    preferences.intents.length === 0 || partner.intents.some((intent) => preferences.intents.includes(intent));

  return (
    matchesTargetLanguage &&
    matchesCountry &&
    matchesInterest &&
    matchesAvailability &&
    matchesGender &&
    matchesIntent &&
    partner.age >= preferences.ageMin &&
    partner.age <= preferences.ageMax &&
    (!preferences.verifiedOnly || partner.verified) &&
    partnerLevelMatches(partner, preferences.partnerLevel) &&
    (!preferences.onlineOnly || partner.status === "online")
  );
}

function matchingSelectionSeed(date: string, preferences: MatchingPreferences): string {
  return JSON.stringify({
    date,
    targetLanguages: [...preferences.targetLanguages].sort(),
    preferredCountries: [...preferences.preferredCountries].sort(),
    interests: [...preferences.interests].sort(),
    availability: [...preferences.availability].sort(),
    partnerLevel: preferences.partnerLevel,
    onlineOnly: preferences.onlineOnly,
    partnerGender: preferences.partnerGender,
    ageMin: preferences.ageMin,
    ageMax: preferences.ageMax,
    verifiedOnly: preferences.verifiedOnly,
    intents: [...preferences.intents].sort(),
  });
}

function handleDailyMatching(context: ApiContext): Response {
  assertMethod(context.request, ["GET"]);
  const date = validatedDate(context.url.searchParams.get("date"));
  const preferences = matchingPreferencesFromQuery(context.url);
  const matchingPartnerIds = new Set(
    partners.filter((partner) => satisfiesMatchingPreferences(partner, preferences)).map((partner) => partner.id),
  );
  const languageEligiblePartners = partners.filter((partner) =>
    partner.nativeLanguages.some((code) => preferences.targetLanguages.includes(code)),
  );
  const seed = matchingSelectionSeed(date, preferences);
  const ranked = languageEligiblePartners
    .map((partner) => ({
      ...scorePartner(partner, preferences, date),
      meetsAllPreferences: matchingPartnerIds.has(partner.id),
    }))
    .sort(
      (left, right) =>
        Number(right.meetsAllPreferences) - Number(left.meetsAllPreferences) ||
        stableHash(`${seed}:${left.partner.id}`) - stableHash(`${seed}:${right.partner.id}`) ||
        right.score - left.score ||
        left.partner.id.localeCompare(right.partner.id),
    )
    .slice(0, DAILY_MATCH_COUNT)
    .map((recommendation) =>
      recommendation.meetsAllPreferences
        ? recommendation
        : {
            ...recommendation,
            matchReasons: ["일부 조건을 넓혀 찾은 가까운 파트너예요", ...recommendation.matchReasons].slice(0, 4),
          },
    );

  return jsonResponse(context, {
    date,
    recommendations: ranked,
    preferencesApplied: preferences,
    nextRefreshAt: nextRefreshAt(date),
    discovery: {
      includedToday: ranked.length,
      exactMatchCount: ranked.filter((recommendation) => recommendation.meetsAllPreferences).length,
      additionalViewsAvailable: false,
      hardConstraints: ["targetLanguages"],
      expandedSoftPreferences: ranked.some((recommendation) => !recommendation.meetsAllPreferences),
      mockPolicy: "출시 초기에는 오늘의 추천 12명을 무료로 제공합니다.",
    },
  });
}

const conversationStages = ["first-message", "getting-to-know", "ongoing", "reconnect"] as const;
type ConversationStage = (typeof conversationStages)[number];

function polishDraft(draft: string, partner: UserProfile, stage: ConversationStage): string {
  const compact = draft.replace(/\s+/g, " ").trim();
  const language = detectLanguage(compact);
  const punctuation = /[.!?。！？]$/.test(compact) ? compact : `${compact}.`;

  if (stage === "first-message" && !compact.toLocaleLowerCase().includes(partner.name.toLocaleLowerCase())) {
    if (language === "ko") return `${partner.name}님, 안녕하세요! ${punctuation}`;
    if (language === "ja") return `${partner.name}さん、こんにちは！${punctuation}`;
    return `Hi ${partner.name}! ${punctuation.charAt(0).toLocaleUpperCase()}${punctuation.slice(1)}`;
  }
  if (stage === "reconnect" && language === "ko" && !compact.includes("오랜만")) {
    return `${partner.name}님, 오랜만이에요! ${punctuation}`;
  }
  if (stage === "reconnect" && language === "en" && !/long time|been a while/i.test(compact)) {
    return `Hi ${partner.name}, it's been a while! ${punctuation.charAt(0).toLocaleUpperCase()}${punctuation.slice(1)}`;
  }
  return punctuation;
}

async function handleConversationSupport(context: ApiContext): Promise<Response> {
  assertMethod(context.request, ["POST"]);
  const body = await readJsonBody(context.request);
  const partnerId = requiredString(body, "partnerId", 128);
  const partner = partners.find((item) => item.id === partnerId);
  if (!partner) throw new ApiError(404, "PARTNER_NOT_FOUND", "대화 상대를 찾을 수 없습니다.", { field: "partnerId" });

  const rawStage = optionalString(body, "stage", 32) ?? "first-message";
  if (!conversationStages.includes(rawStage as ConversationStage)) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 대화 단계입니다.", {
      field: "stage",
      allowed: conversationStages,
    });
  }
  const stage = rawStage as ConversationStage;
  const draft = optionalString(body, "draft", 1_000);
  const guide = conversationGuides.find((item) => item.partnerId === partnerId);
  if (!guide) throw new ApiError(500, "GUIDE_NOT_CONFIGURED", "대화 지원 데이터를 불러올 수 없습니다.");

  const improvedDraft = draft ? polishDraft(draft, partner, stage) : undefined;
  const sourceLanguage = improvedDraft ? detectLanguage(improvedDraft) : undefined;
  const partnerLanguage = partner.nativeLanguages[0];
  const translationLanguage = sourceLanguage === partnerLanguage ? currentUser.nativeLanguages[0] : partnerLanguage;
  const translation = improvedDraft
    ? { language: translationLanguage, text: translateSample(improvedDraft, translationLanguage).translatedText }
    : undefined;

  return jsonResponse(context, {
    partner: {
      id: partner.id,
      name: partner.name,
      avatar: partner.avatar,
      avatarColor: partner.avatarColor,
      status: partner.status,
      nativeLanguages: partner.nativeLanguages,
      learningLanguages: partner.learningLanguages,
      interests: partner.interests,
    },
    stage,
    topics: guide.topics.slice(0, 3),
    suggestedOpeners: guide.suggestedOpeners.slice(0, 3),
    followUpQuestions: guide.followUpQuestions.slice(0, 3),
    ...(improvedDraft ? { improvedDraft, translation } : {}),
    tip: guide.tip,
  });
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
  if (resource === "reports" && (segments.length === 1 || segments.length === 2)) {
    return handleReports(context, segments[1]);
  }
  if (resource === "dm" && segments[1] === "privacy" && segments.length === 2) {
    return handleDmPrivacy(context);
  }
  if (resource === "dm" && segments[1] === "requests" && segments.length === 2) {
    return handleDmRequests(context);
  }
  if (resource === "dm" && segments[1] === "sync" && segments.length === 2) {
    return handleDmSync(context);
  }
  if (resource === "account" && segments[1] === "verification" && segments.length === 2) {
    return handleAccountVerification(context);
  }
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
  if (resource === "matching" && segments[1] === "preferences" && segments.length === 2) {
    return handleMatchingPreferences(context);
  }
  if (resource === "matching" && segments[1] === "daily" && segments.length === 2) {
    return handleDailyMatching(context);
  }
  if (resource === "conversation-support" && segments.length === 1) {
    return handleConversationSupport(context);
  }

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
