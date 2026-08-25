import crypto from "node:crypto";
import express from "express";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { extractGeminiText, GeminiProviderError, generateGeminiContent } from "./gemini.mjs";
import { decideDmRoute } from "./policy.mjs";

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID;
const IDENTITY_API_KEY = process.env.IDENTITY_API_KEY;
// 기본값은 실제 Identity Platform 입니다. 로컬에서 Auth 에뮬레이터를 붙일 때만
// 이 값을 바꿔 씁니다 — GEMINI_API_BASE_URL 과 같은 방식입니다.
const IDENTITY_API_BASE_URL =
  process.env.IDENTITY_API_BASE_URL || "https://identitytoolkit.googleapis.com";
const PROXY_SHARED_SECRET = process.env.PROXY_SHARED_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const GEMINI_LOCATION = process.env.GEMINI_LOCATION || "global";
const GEMINI_API_BASE_URL =
  process.env.GEMINI_API_BASE_URL ||
  `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/locations/${encodeURIComponent(GEMINI_LOCATION)}/publishers/google/models`;
const GEMINI_PROVIDER = "google-vertex-ai";
const AI_TRANSLATION_DAILY_LIMIT = Number(process.env.AI_TRANSLATION_DAILY_LIMIT || 100);
const AI_SUPPORT_DAILY_LIMIT = Number(process.env.AI_SUPPORT_DAILY_LIMIT || 30);
const PORT = Number(process.env.PORT || 8080);
const COOKIE_SECURE = process.env.COOKIE_SECURE !== "false";
const COOKIE_NAME = COOKIE_SECURE ? "__Host-lingoloop_session" : "lingoloop_session";
const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const APP_ORIGINS = new Set(
  (process.env.APP_ORIGIN || "http://localhost:5174")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

if (!PROJECT_ID) throw new Error("GOOGLE_CLOUD_PROJECT is required");
if (!IDENTITY_API_KEY) throw new Error("IDENTITY_API_KEY is required");
if (!PROXY_SHARED_SECRET) throw new Error("PROXY_SHARED_SECRET is required");
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error("PORT must be a valid TCP port");
if (!Number.isInteger(AI_TRANSLATION_DAILY_LIMIT) || AI_TRANSLATION_DAILY_LIMIT < 1) {
  throw new Error("AI_TRANSLATION_DAILY_LIMIT must be a positive integer");
}
if (!Number.isInteger(AI_SUPPORT_DAILY_LIMIT) || AI_SUPPORT_DAILY_LIMIT < 1) {
  throw new Error("AI_SUPPORT_DAILY_LIMIT must be a positive integer");
}

const firebaseApp = initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
});
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
db.settings({ ignoreUndefinedProperties: true });

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);

const LANGUAGES = [
  { code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷" },
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  { code: "zh", name: "Chinese", nativeName: "中文", flag: "🇨🇳" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
];

const DEFAULT_MATCHING_PREFERENCES = {
  targetLanguages: ["en"],
  preferredCountries: [],
  interests: [],
  availability: ["weekday-evening"],
  partnerLevel: "any",
  partnerGender: "any",
  ageMin: 18,
  ageMax: 100,
  verifiedOnly: false,
  intents: ["language-exchange", "friendship"],
  onlineOnly: false,
};

const DEFAULT_DM_PRIVACY = {
  whoCanMessage: "matches",
  routeOthersToRequests: true,
  filterSuspectedSpam: true,
  allowVoiceMessagesInRequests: false,
  readReceipts: true,
};

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function requestId(req) {
  const incoming = req.get("x-request-id");
  return incoming && incoming.length <= 128 ? incoming : crypto.randomUUID();
}

function success(res, req, data, status = 200, meta = {}) {
  return res.status(status).json({
    data,
    meta: {
      requestId: req.requestId,
      timestamp: nowIso(),
      mock: false,
      persistent: true,
      ...meta,
    },
  });
}

function safeString(value, field, options = {}) {
  const min = options.min ?? 1;
  const max = options.max ?? 2000;
  if (typeof value !== "string") {
    throw new ApiError(422, "VALIDATION_ERROR", field + " 필드는 문자열이어야 합니다.", { field });
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      field + " 필드는 " + min + "자 이상 " + max + "자 이하여야 합니다.",
      { field, min, max },
    );
  }
  return normalized;
}

function safeSecret(value, field, { min, max }) {
  if (typeof value !== "string" || value.length < min || value.length > max) {
    throw new ApiError(422, "VALIDATION_ERROR", field + " 필드는 " + min + "자 이상 " + max + "자 이하여야 합니다.", {
      field,
      min,
      max,
    });
  }
  return value;
}

function optionalString(value, field, max = 2000) {
  if (value === undefined || value === null || value === "") return undefined;
  return safeString(value, field, { min: 0, max });
}

function optionalBoolean(value, field, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    throw new ApiError(422, "VALIDATION_ERROR", field + " 필드는 true 또는 false여야 합니다.", { field });
  }
  return value;
}

function integerInRange(value, field, { min, max, fallback }) {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new ApiError(422, "VALIDATION_ERROR", field + " 필드는 " + min + " 이상 " + max + " 이하의 정수여야 합니다.", {
      field,
      min,
      max,
    });
  }
  return value;
}

function stringArray(value, field, fallback = [], maxItems = 12, maxLength = 40) {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new ApiError(422, "VALIDATION_ERROR", field + " 필드는 최대 " + maxItems + "개의 문자열 배열이어야 합니다.", {
      field,
    });
  }
  return [
    ...new Set(
      value.map((item) => {
        if (typeof item !== "string" || !item.trim() || item.trim().length > maxLength) {
          throw new ApiError(422, "VALIDATION_ERROR", field + " 항목 형식이 올바르지 않습니다.", { field });
        }
        return item.trim();
      }),
    ),
  ];
}

function secureEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseCookies(header = "") {
  const result = {};
  for (const segment of header.split(";")) {
    const index = segment.indexOf("=");
    if (index < 0) continue;
    const key = segment.slice(0, index).trim();
    const value = segment.slice(index + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      // Ignore malformed cookie values instead of turning an unauthenticated request into a 500.
    }
  }
  return result;
}

function publicProfile(profile) {
  if (!profile) return null;
  const privateFields = new Set(["email", "accountStatus", "createdAt", "updatedAt"]);
  return Object.fromEntries(Object.entries(profile).filter(([key]) => !privateFields.has(key)));
}

function defaultProfile(uid, email, name) {
  const normalizedName = (name || email.split("@")[0] || "LingoLoop 사용자").trim().slice(0, 40);
  const handleBase = normalizedName
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLocaleLowerCase()
    .slice(0, 18) || "learner";
  const timestamp = nowIso();
  return {
    id: uid,
    email,
    name: normalizedName,
    handle: "@" + handleBase + uid.slice(0, 5).toLocaleLowerCase(),
    country: { code: "KR", name: "대한민국", flag: "🇰🇷" },
    city: "",
    nativeLanguages: ["ko"],
    learningLanguages: [{ code: "en", level: "beginner", goal: "부담 없는 일상 대화" }],
    bio: "함께 꾸준히 연습할 언어 파트너를 찾고 있어요.",
    interests: ["travel", "movies", "coffee"],
    availability: ["weekday-evening"],
    intents: ["language-exchange", "friendship"],
    age: 18,
    gender: "unspecified",
    status: "online",
    verified: false,
    responseRate: 100,
    exchangeScore: 50,
    accountStatus: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
    lastActiveAt: timestamp,
  };
}

async function ensureProfile(uid, email, name) {
  const reference = db.collection("profiles").doc(uid);
  const snapshot = await reference.get();
  if (snapshot.exists) return snapshot.data();
  const profile = defaultProfile(uid, email || "unknown@example.invalid", name);
  await reference.create(profile);
  await db.collection("matchingPreferences").doc(uid).set({
    ...DEFAULT_MATCHING_PREFERENCES,
    version: preferenceVersion(DEFAULT_MATCHING_PREFERENCES),
    updatedAt: nowIso(),
  });
  await db.collection("dmPolicies").doc(uid).set({ ...DEFAULT_DM_PRIVACY, updatedAt: nowIso() });
  return profile;
}

function mapIdentityError(payload, fallbackCode) {
  const remote = payload?.error?.message || fallbackCode;
  const code = String(remote).split(" : ")[0];
  if (code === "EMAIL_EXISTS") return new ApiError(409, "EMAIL_EXISTS", "이미 가입된 이메일입니다.");
  if (code === "INVALID_LOGIN_CREDENTIALS" || code === "EMAIL_NOT_FOUND" || code === "INVALID_PASSWORD") {
    return new ApiError(401, "INVALID_LOGIN_CREDENTIALS", "이메일 또는 비밀번호를 확인해 주세요.");
  }
  if (code.startsWith("WEAK_PASSWORD")) {
    return new ApiError(422, "WEAK_PASSWORD", "비밀번호는 10자 이상으로 설정해 주세요.");
  }
  if (code === "TOO_MANY_ATTEMPTS_TRY_LATER") {
    return new ApiError(429, "TOO_MANY_ATTEMPTS", "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
  }
  if (code === "USER_DISABLED") return new ApiError(403, "ACCOUNT_DISABLED", "비활성화된 계정입니다.");
  return new ApiError(502, "IDENTITY_PROVIDER_ERROR", "인증 서비스 요청을 처리하지 못했습니다.");
}

async function identityPost(method, payload) {
  let response;
  try {
    response = await fetch(
      IDENTITY_API_BASE_URL + "/v1/accounts:" + method + "?key=" + encodeURIComponent(IDENTITY_API_KEY),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch {
    throw new ApiError(503, "IDENTITY_PROVIDER_UNAVAILABLE", "인증 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw mapIdentityError(body, method);
  return body;
}

async function issueSession(res, idToken) {
  const decoded = await auth.verifyIdToken(idToken);
  const currentSeconds = Math.floor(Date.now() / 1000);
  if (!decoded.auth_time || currentSeconds - decoded.auth_time > 5 * 60) {
    throw new ApiError(401, "RECENT_LOGIN_REQUIRED", "다시 로그인해 주세요.");
  }
  const cookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
  res.cookie(COOKIE_NAME, cookie, {
    maxAge: SESSION_MAX_AGE_MS,
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
  });
  return decoded;
}

async function sessionUser(req) {
  const cookie = parseCookies(req.headers.cookie || "")[COOKIE_NAME];
  if (!cookie) throw new ApiError(401, "AUTH_REQUIRED", "로그인이 필요합니다.");
  let decoded;
  try {
    decoded = await auth.verifySessionCookie(cookie, true);
  } catch {
    throw new ApiError(401, "INVALID_SESSION", "세션이 만료되었습니다. 다시 로그인해 주세요.");
  }
  const userRecord = await auth.getUser(decoded.uid);
  if (userRecord.disabled) throw new ApiError(403, "ACCOUNT_DISABLED", "비활성화된 계정입니다.");
  const profile = await ensureProfile(decoded.uid, userRecord.email, userRecord.displayName);
  if (profile.accountStatus !== "active") throw new ApiError(403, "ACCOUNT_RESTRICTED", "사용이 제한된 계정입니다.");
  return { uid: decoded.uid, email: userRecord.email || "", emailVerified: userRecord.emailVerified, profile };
}

async function requireUser(req, _res, next) {
  try {
    req.auth = await sessionUser(req);
    next();
  } catch (error) {
    next(error);
  }
}

function normalizedPreferences(body = {}) {
  const targetLanguages = stringArray(body.targetLanguages, "targetLanguages", DEFAULT_MATCHING_PREFERENCES.targetLanguages, 3, 10);
  if (targetLanguages.length === 0) {
    throw new ApiError(422, "VALIDATION_ERROR", "배울 언어를 한 개 이상 선택해 주세요.", { field: "targetLanguages" });
  }
  const ageMin = Number(body.ageMin ?? DEFAULT_MATCHING_PREFERENCES.ageMin);
  const ageMax = Number(body.ageMax ?? DEFAULT_MATCHING_PREFERENCES.ageMax);
  if (!Number.isInteger(ageMin) || !Number.isInteger(ageMax) || ageMin < 18 || ageMax > 100 || ageMin > ageMax) {
    throw new ApiError(422, "VALIDATION_ERROR", "연령 범위를 확인해 주세요.", { field: "ageMin" });
  }
  const partnerLevels = ["any", "beginner", "intermediate", "advanced"];
  const genders = ["any", "same", "women", "men"];
  const partnerLevel = body.partnerLevel ?? "any";
  const partnerGender = body.partnerGender ?? "any";
  if (!partnerLevels.includes(partnerLevel) || !genders.includes(partnerGender)) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 매칭 조건입니다.");
  }
  return {
    targetLanguages,
    preferredCountries: stringArray(body.preferredCountries, "preferredCountries", [], 8, 10),
    interests: stringArray(body.interests, "interests", [], 12, 40).map((value) => value.toLocaleLowerCase()),
    availability: stringArray(body.availability, "availability", ["weekday-evening"], 4, 32),
    partnerLevel,
    partnerGender,
    ageMin,
    ageMax,
    verifiedOnly: optionalBoolean(body.verifiedOnly, "verifiedOnly", false),
    intents: stringArray(body.intents, "intents", ["language-exchange", "friendship"], 4, 32),
    onlineOnly: optionalBoolean(body.onlineOnly, "onlineOnly", false),
  };
}

function preferenceVersion(preferences) {
  return crypto.createHash("sha256").update(JSON.stringify(preferences)).digest("hex").slice(0, 16);
}

function todayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function nextRefreshAt(date) {
  return new Date(Date.parse(date + "T15:00:00.000Z")).toISOString();
}

function stableHash(value) {
  const digest = crypto.createHash("sha256").update(value).digest();
  return digest.readUInt32BE(0);
}

function matchCandidate(candidate, me, preferences, date) {
  const matchedLanguages = (candidate.nativeLanguages || []).filter((code) => preferences.targetLanguages.includes(code));
  const matchedInterests = (candidate.interests || []).filter((item) => preferences.interests.includes(String(item).toLocaleLowerCase()));
  const matchedAvailability = (candidate.availability || []).filter((item) => preferences.availability.includes(item));
  const matchedIntents = (candidate.intents || []).filter((item) => preferences.intents.includes(item));
  const exact =
    matchedLanguages.length > 0 &&
    (preferences.preferredCountries.length === 0 || preferences.preferredCountries.includes(candidate.country?.code)) &&
    (preferences.interests.length === 0 || matchedInterests.length > 0) &&
    (preferences.availability.length === 0 || matchedAvailability.length > 0) &&
    candidate.age >= preferences.ageMin &&
    candidate.age <= preferences.ageMax &&
    (!preferences.verifiedOnly || candidate.verified) &&
    (!preferences.onlineOnly || candidate.status === "online") &&
    (preferences.intents.length === 0 || matchedIntents.length > 0) &&
    (preferences.partnerGender === "any" ||
      (preferences.partnerGender === "same" && candidate.gender === me.gender) ||
      (preferences.partnerGender === "women" && candidate.gender === "woman") ||
      (preferences.partnerGender === "men" && candidate.gender === "man"));
  let score = 35;
  const reasons = [];
  if (matchedLanguages.length) {
    score += 25;
    reasons.push(matchedLanguages.map((code) => LANGUAGES.find((item) => item.code === code)?.nativeName || code).join(" · ") + " 원어민 파트너예요");
  }
  if (preferences.preferredCountries.includes(candidate.country?.code)) {
    score += 10;
    reasons.push("희망 지역인 " + (candidate.country?.flag || "") + " " + (candidate.country?.name || "") + "에 있어요");
  }
  if (matchedInterests.length) {
    score += Math.min(12, matchedInterests.length * 4);
    reasons.push(matchedInterests.slice(0, 2).join(" · ") + " 관심사가 같아요");
  }
  if (matchedAvailability.length) {
    score += 8;
    reasons.push("선호하는 학습 시간대가 겹쳐요");
  }
  if (matchedIntents.length) score += 6;
  if (candidate.verified) score += 4;
  if (candidate.status === "online") score += 4;
  score += stableHash(date + ":" + candidate.id) % 5;
  if (!exact) reasons.unshift("일부 조건을 넓혀 찾은 가까운 파트너예요");
  if (reasons.length < 2) reasons.push("새로운 실제 회원과 첫 언어 교환을 시작해 보세요");
  return {
    partner: publicProfile(candidate),
    score: Math.min(99, score),
    matchReasons: reasons.slice(0, 4),
    icebreaker: "Hi " + candidate.name + "! What would you like to practice today?",
    meetsAllPreferences: exact,
  };
}

function conversationIdFor(first, second) {
  return "conversation-" + crypto.createHash("sha256").update([first, second].sort().join(":")).digest("hex").slice(0, 24);
}

function conversationStatus(conversation) {
  return conversation.requestStatus || "accepted";
}

async function acceptedPartnerIds(uid) {
  const snapshot = await db.collection("conversations").where("memberIds", "array-contains", uid).limit(200).get();
  const ids = snapshot.docs
    .map((document) => document.data())
    .filter((conversation) => conversationStatus(conversation) === "accepted")
    .map((conversation) => conversation.memberIds?.find((id) => id !== uid))
    .filter(Boolean);
  return new Set(ids);
}

async function directMessageDecision(senderId, recipientId) {
  const date = todayInSeoul();
  const references = [
    db.collection("dmPolicies").doc(recipientId),
    db.collection("likes").doc(senderId + "_" + recipientId),
    db.collection("likes").doc(recipientId + "_" + senderId),
    db.collection("follows").doc(senderId + "_" + recipientId),
    db.collection("follows").doc(recipientId + "_" + senderId),
    db.collection("dailyMatches").doc(senderId).collection("days").doc(date),
  ];
  const [policySnapshot, senderLike, recipientLike, senderFollow, recipientFollow, dailyMatch] = await db.getAll(...references);
  const policy = policySnapshot.exists ? { ...DEFAULT_DM_PRIVACY, ...policySnapshot.data() } : DEFAULT_DM_PRIVACY;
  const systemMatched = Boolean(
    dailyMatch.exists && dailyMatch.data()?.recommendations?.some((item) => item.partnerId === recipientId),
  );
  const relationships = {
    matched: (senderLike.exists && recipientLike.exists) || systemMatched,
    follower: senderFollow.exists,
    mutualFollow: senderFollow.exists && recipientFollow.exists,
  };
  const route = decideDmRoute(policy, relationships);
  if (route.status !== "denied") {
    return { status: route.status, policy: route.scope, relationships };
  }
  throw new ApiError(403, "DM_NOT_ALLOWED", "상대방의 메시지 수신 설정에 따라 대화를 시작할 수 없습니다.");
}

async function profilesByIds(ids) {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return new Map();
  const snapshots = await db.getAll(...unique.map((id) => db.collection("profiles").doc(id)));
  return new Map(snapshots.filter((snapshot) => snapshot.exists).map((snapshot) => [snapshot.id, snapshot.data()]));
}

async function conversationView(conversation, uid, includeMessages = false) {
  const partnerId = conversation.memberIds.find((id) => id !== uid);
  const partnerSnapshot = partnerId ? await db.collection("profiles").doc(partnerId).get() : null;
  const partner = partnerSnapshot?.exists ? publicProfile(partnerSnapshot.data()) : null;
  let messages;
  if (includeMessages) {
    const snapshot = await db
      .collection("conversations")
      .doc(conversation.id)
      .collection("messages")
      .orderBy("sentAt", "desc")
      .limit(200)
      .get();
    messages = snapshot.docs.map((document) => document.data()).reverse();
  }
  return {
    id: conversation.id,
    partner,
    preview: conversation.lastMessage || "새 대화를 시작해 보세요.",
    updatedAt: conversation.updatedAt,
    unreadCount: 0,
    requestStatus: conversationStatus(conversation),
    isIncomingRequest: conversationStatus(conversation) === "pending" && conversation.requestRecipientId === uid,
    ...(messages ? { messages } : {}),
  };
}

async function consumeDailyQuota(uid, feature, limit) {
  const date = todayInSeoul();
  const reference = db.collection("aiUsage").doc(uid).collection("days").doc(date);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const currentCounts = snapshot.exists && snapshot.data()?.counts ? snapshot.data().counts : {};
    const used = Number(currentCounts[feature] || 0);
    if (!Number.isSafeInteger(used) || used < 0) {
      throw new ApiError(500, "INVALID_USAGE_STATE", "AI 사용량 상태를 확인하지 못했습니다.");
    }
    if (used >= limit) {
      throw new ApiError(429, "AI_DAILY_LIMIT_REACHED", "오늘의 무료 AI 사용량을 모두 사용했습니다.", {
        feature,
        limit,
        resetsAt: nextRefreshAt(date),
      });
    }
    const nextCounts = { ...currentCounts, [feature]: used + 1 };
    transaction.set(
      reference,
      {
        userId: uid,
        date,
        counts: nextCounts,
        createdAt: snapshot.exists ? snapshot.data().createdAt : nowIso(),
        updatedAt: nowIso(),
      },
      { merge: true },
    );
    return { feature, used: used + 1, limit, remaining: limit - used - 1, resetsAt: nextRefreshAt(date) };
  });
}

async function geminiResponse(payload, uid, { feature, dailyLimit }) {
  if (!GEMINI_API_KEY) {
    throw new ApiError(503, "AI_NOT_CONFIGURED", "AI 기능에 필요한 Gemini API 키가 아직 연결되지 않았습니다.");
  }
  const quota = await consumeDailyQuota(uid, feature, dailyLimit);
  try {
    const body = await generateGeminiContent({
      apiKey: GEMINI_API_KEY,
      model: GEMINI_MODEL,
      baseUrl: GEMINI_API_BASE_URL,
      ...payload,
    });
    return { body, quota };
  } catch (error) {
    if (error instanceof GeminiProviderError) {
      throw new ApiError(error.status, error.code, error.message);
    }
    throw error;
  }
}

function geminiText(body) {
  try {
    return extractGeminiText(body);
  } catch (error) {
    if (error instanceof GeminiProviderError) {
      throw new ApiError(error.status, error.code, error.message);
    }
    throw error;
  }
}

const authAttempts = new Map();
let nextAuthAttemptSweepAt = 0;
function authRateLimit(req, _res, next) {
  const timestamp = Date.now();
  if (timestamp >= nextAuthAttemptSweepAt) {
    for (const [key, value] of authAttempts) {
      if (value.resetAt <= timestamp) authAttempts.delete(key);
    }
    nextAuthAttemptSweepAt = timestamp + 60_000;
  }
  const forwardedIp = String(req.get("cf-connecting-ip") || req.ip || "unknown").slice(0, 128);
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLocaleLowerCase() : "unknown";
  const key = crypto.createHash("sha256").update(forwardedIp + ":" + email).digest("hex");
  if (!authAttempts.has(key) && authAttempts.size >= 10_000) {
    next(new ApiError(429, "RATE_LIMITED", "로그인 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."));
    return;
  }
  const current = authAttempts.get(key);
  if (!current || current.resetAt <= timestamp) {
    authAttempts.set(key, { count: 1, resetAt: timestamp + 15 * 60 * 1000 });
    next();
    return;
  }
  current.count += 1;
  if (current.count > 30) {
    next(new ApiError(429, "RATE_LIMITED", "로그인 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."));
    return;
  }
  next();
}

app.use((req, res, next) => {
  req.requestId = requestId(req);
  res.setHeader("x-request-id", req.requestId);
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "same-origin");
  res.setHeader("cache-control", "no-store");
  next();
});

app.get("/healthz", async (_req, res) => {
  try {
    await db.collection("_system").doc("health").get();
    res.status(200).json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});

app.use("/api", (req, _res, next) => {
  if (!secureEqual(req.get("x-lingoloop-proxy"), PROXY_SHARED_SECRET)) {
    next(new ApiError(403, "INVALID_PROXY", "허용되지 않은 API 경로입니다."));
    return;
  }
  next();
});

app.use(express.json({ limit: "64kb", type: "application/json" }));

app.use("/api", (req, _res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.get("origin");
    if (!origin || !APP_ORIGINS.has(origin)) {
      next(new ApiError(403, "INVALID_ORIGIN", "허용되지 않은 요청 출처입니다."));
      return;
    }
  }
  next();
});

app.get("/api/health", async (req, res) => {
  await db.collection("_system").doc("health").get();
  return success(res, req, {
    service: "lingoloop-api",
    version: "1.0.0",
    status: "ok",
    environment: "production",
    storage: "firestore",
    authentication: "identity-platform",
    ai: {
      configured: Boolean(GEMINI_API_KEY),
      provider: GEMINI_PROVIDER,
      model: GEMINI_MODEL,
    },
  });
});

app.post("/api/auth/register", authRateLimit, async (req, res) => {
  const email = safeString(req.body?.email, "email", { min: 5, max: 254 }).toLocaleLowerCase();
  const password = safeSecret(req.body?.password, "password", { min: 10, max: 128 });
  const name = safeString(req.body?.name, "name", { min: 2, max: 40 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(422, "INVALID_EMAIL", "이메일 형식을 확인해 주세요.", { field: "email" });
  }
  const identity = await identityPost("signUp", { email, password, returnSecureToken: true });
  let activeIdToken = identity.idToken;
  try {
    const updatedIdentity = await identityPost("update", {
      idToken: activeIdToken,
      displayName: name,
      returnSecureToken: true,
    });
    activeIdToken = updatedIdentity.idToken || activeIdToken;
    const profile = defaultProfile(identity.localId, email, name);
    const batch = db.batch();
    batch.create(db.collection("profiles").doc(identity.localId), profile);
    batch.set(db.collection("matchingPreferences").doc(identity.localId), {
      ...DEFAULT_MATCHING_PREFERENCES,
      version: preferenceVersion(DEFAULT_MATCHING_PREFERENCES),
      updatedAt: nowIso(),
    });
    batch.set(db.collection("dmPolicies").doc(identity.localId), { ...DEFAULT_DM_PRIVACY, updatedAt: nowIso() });
    await batch.commit();
    await issueSession(res, activeIdToken);
    let emailVerificationSent = false;
    try {
      await identityPost("sendOobCode", { requestType: "VERIFY_EMAIL", idToken: activeIdToken });
      emailVerificationSent = true;
    } catch {
      emailVerificationSent = false;
    }
    return success(
      res,
      req,
      {
        user: { ...publicProfile(profile), email, emailVerified: false },
        emailVerificationSent,
      },
      201,
    );
  } catch (error) {
    await Promise.allSettled([
      identityPost("delete", { idToken: activeIdToken }),
      db.collection("profiles").doc(identity.localId).delete(),
      db.collection("matchingPreferences").doc(identity.localId).delete(),
      db.collection("dmPolicies").doc(identity.localId).delete(),
    ]);
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: "lax",
      path: "/",
    });
    throw error;
  }
});

app.post("/api/auth/login", authRateLimit, async (req, res) => {
  const email = safeString(req.body?.email, "email", { min: 5, max: 254 }).toLocaleLowerCase();
  const password = safeSecret(req.body?.password, "password", { min: 1, max: 128 });
  const identity = await identityPost("signInWithPassword", { email, password, returnSecureToken: true });
  const userRecord = await auth.getUser(identity.localId);
  const profile = await ensureProfile(identity.localId, userRecord.email, userRecord.displayName);
  await issueSession(res, identity.idToken);
  return success(res, req, {
    user: {
      ...publicProfile(profile),
      email: userRecord.email || email,
      emailVerified: userRecord.emailVerified,
    },
  });
});

app.get("/api/auth/me", requireUser, async (req, res) => {
  return success(res, req, {
    user: {
      ...publicProfile(req.auth.profile),
      email: req.auth.email,
      emailVerified: req.auth.emailVerified,
    },
  });
});

app.post("/api/auth/logout", async (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
  });
  return success(res, req, { signedOut: true });
});

app.get("/api/languages", async (req, res) => success(res, req, LANGUAGES));

app.get("/api/bootstrap", requireUser, async (req, res) => {
  await db.collection("profiles").doc(req.auth.uid).update({
    status: "online",
    lastActiveAt: nowIso(),
    updatedAt: nowIso(),
  });
  const profile = { ...req.auth.profile, status: "online", lastActiveAt: nowIso() };
  return success(res, req, {
    currentUser: publicProfile(profile),
    languages: LANGUAGES,
    unread: { conversations: 0, notifications: 0, requests: 0 },
    featureFlags: {
      persistentProfiles: true,
      persistentCommunity: true,
      persistentMessages: true,
      identityPlatform: true,
      aiConfigured: Boolean(GEMINI_API_KEY),
      realtimeVoice: false,
    },
  });
});

app.get("/api/profile", requireUser, async (req, res) => {
  return success(res, req, {
    ...publicProfile(req.auth.profile),
    email: req.auth.email,
    emailVerified: req.auth.emailVerified,
  });
});

app.patch("/api/profile", requireUser, async (req, res) => {
  const current = req.auth.profile;
  const allowedGenders = ["unspecified", "woman", "man", "nonbinary"];
  if (req.body?.gender !== undefined && !allowedGenders.includes(req.body.gender)) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 성별 값입니다.", { field: "gender" });
  }
  const patch = {
    name: req.body?.name === undefined ? current.name : safeString(req.body.name, "name", { min: 2, max: 40 }),
    bio: req.body?.bio === undefined ? current.bio : safeString(req.body.bio, "bio", { min: 0, max: 500 }),
    city: req.body?.city === undefined ? current.city : safeString(req.body.city, "city", { min: 0, max: 80 }),
    nativeLanguages: stringArray(req.body?.nativeLanguages, "nativeLanguages", current.nativeLanguages, 3, 10),
    learningLanguages: Array.isArray(req.body?.learningLanguages)
      ? req.body.learningLanguages.slice(0, 3).map((item) => ({
          code: safeString(item?.code, "learningLanguages.code", { min: 2, max: 10 }),
          level: safeString(item?.level || "beginner", "learningLanguages.level", { min: 2, max: 20 }),
          goal: safeString(item?.goal || "일상 대화", "learningLanguages.goal", { min: 2, max: 120 }),
        }))
      : current.learningLanguages,
    interests: stringArray(req.body?.interests, "interests", current.interests, 12, 40),
    availability: stringArray(req.body?.availability, "availability", current.availability, 4, 32),
    intents: stringArray(req.body?.intents, "intents", current.intents, 4, 32),
    age: integerInRange(req.body?.age, "age", { min: 18, max: 100, fallback: current.age }),
    gender: req.body?.gender === undefined ? current.gender : req.body.gender,
    updatedAt: nowIso(),
  };
  if (!patch.nativeLanguages.length || !patch.learningLanguages.length) {
    throw new ApiError(422, "VALIDATION_ERROR", "모국어와 학습 언어를 한 개 이상 선택해 주세요.");
  }
  await db.collection("profiles").doc(req.auth.uid).update(patch);
  return success(res, req, { ...publicProfile({ ...current, ...patch }), email: req.auth.email, emailVerified: req.auth.emailVerified });
});

app.get("/api/partners", requireUser, async (req, res) => {
  const snapshot = await db.collection("profiles").limit(100).get();
  const query = String(req.query.q || "").trim().toLocaleLowerCase();
  const partners = snapshot.docs
    .map((document) => document.data())
    .filter((profile) => profile.id !== req.auth.uid && profile.accountStatus === "active")
    .filter((profile) => {
      if (!query) return true;
      return [profile.name, profile.handle, profile.bio, ...(profile.interests || [])]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query);
    })
    .map(publicProfile);
  return success(res, req, partners, 200, {
    pagination: { total: partners.length, nextCursor: null },
  });
});

app.get("/api/matching/preferences", requireUser, async (req, res) => {
  const snapshot = await db.collection("matchingPreferences").doc(req.auth.uid).get();
  const preferences = snapshot.exists ? normalizedPreferences(snapshot.data()) : DEFAULT_MATCHING_PREFERENCES;
  return success(res, req, { preferences, persisted: true, nextRefreshAt: nextRefreshAt(todayInSeoul()) });
});

app.post("/api/matching/preferences", requireUser, async (req, res) => {
  const preferences = normalizedPreferences(req.body);
  const version = preferenceVersion(preferences);
  await db.collection("matchingPreferences").doc(req.auth.uid).set({ ...preferences, version, updatedAt: nowIso() });
  return success(res, req, { preferences, persisted: true, nextRefreshAt: nextRefreshAt(todayInSeoul()) });
});

app.get("/api/matching/daily", requireUser, async (req, res) => {
  const date = todayInSeoul();
  if (req.query.date !== undefined && String(req.query.date) !== date) {
    throw new ApiError(422, "INVALID_MATCH_DATE", "오늘의 매칭만 조회할 수 있습니다.", { date });
  }
  const preferencesSnapshot = await db.collection("matchingPreferences").doc(req.auth.uid).get();
  const preferences = preferencesSnapshot.exists ? normalizedPreferences(preferencesSnapshot.data()) : DEFAULT_MATCHING_PREFERENCES;
  const version = preferenceVersion(preferences);
  const dailyReference = db.collection("dailyMatches").doc(req.auth.uid).collection("days").doc(date);
  const dailySnapshot = await dailyReference.get();
  // 하루치 추천은 캐시해 매일 같은 얼굴을 보여줍니다. 다만 "추천 0명"까지 캐시하면
  // 가입 첫날 아직 아무도 없던 사람은 그날 내내 빈 화면을 봅니다 — 한 시간 뒤 딱 맞는
  // 파트너가 가입해도요. 빈 결과일 때만 다시 계산합니다.
  const storedRecommendations = dailySnapshot.exists ? dailySnapshot.data().recommendations || [] : [];
  if (dailySnapshot.exists && dailySnapshot.data().preferenceVersion === version && storedRecommendations.length > 0) {
    const stored = dailySnapshot.data();
    const profileMap = await profilesByIds((stored.recommendations || []).map((item) => item.partnerId));
    const recommendations = (stored.recommendations || [])
      .filter((item) => profileMap.get(item.partnerId)?.accountStatus === "active")
      .map((item) => ({ ...item, partner: publicProfile(profileMap.get(item.partnerId)) }));
    return success(res, req, {
      date,
      recommendations,
      preferencesApplied: preferences,
      nextRefreshAt: nextRefreshAt(date),
      discovery: { includedToday: recommendations.length, exactMatchCount: recommendations.filter((item) => item.meetsAllPreferences).length },
    });
  }

  const snapshot = await db.collection("profiles").limit(200).get();
  const candidates = snapshot.docs
    .map((document) => document.data())
    .filter((profile) => profile.id !== req.auth.uid && profile.accountStatus === "active")
    .map((profile) => matchCandidate(profile, req.auth.profile, preferences, date))
    .filter((item) => item.partner.nativeLanguages.some((code) => preferences.targetLanguages.includes(code)))
    .sort((left, right) => Number(right.meetsAllPreferences) - Number(left.meetsAllPreferences) || right.score - left.score || stableHash(date + left.partner.id) - stableHash(date + right.partner.id))
    .slice(0, 12);

  await dailyReference.set({
    date,
    preferenceVersion: version,
    recommendations: candidates.map(({ partner, ...item }) => ({ ...item, partnerId: partner.id })),
    createdAt: nowIso(),
  });
  return success(res, req, {
    date,
    recommendations: candidates,
    preferencesApplied: preferences,
    nextRefreshAt: nextRefreshAt(date),
    discovery: { includedToday: candidates.length, exactMatchCount: candidates.filter((item) => item.meetsAllPreferences).length },
  });
});

app.post("/api/partners/:partnerId/like", requireUser, async (req, res) => {
  const partnerId = safeString(req.params.partnerId, "partnerId", { min: 4, max: 128 });
  if (partnerId === req.auth.uid) throw new ApiError(422, "INVALID_PARTNER", "본인에게 마음을 보낼 수 없습니다.");
  const partnerSnapshot = await db.collection("profiles").doc(partnerId).get();
  if (!partnerSnapshot.exists || partnerSnapshot.data()?.accountStatus !== "active") {
    throw new ApiError(404, "PARTNER_NOT_FOUND", "파트너를 찾을 수 없습니다.");
  }
  const timestamp = nowIso();
  await db.collection("likes").doc(req.auth.uid + "_" + partnerId).set({
    fromUserId: req.auth.uid,
    toUserId: partnerId,
    createdAt: timestamp,
  });
  const reverse = await db.collection("likes").doc(partnerId + "_" + req.auth.uid).get();
  return success(res, req, { liked: true, mutual: reverse.exists, partner: publicProfile(partnerSnapshot.data()) }, 201);
});

app.post("/api/partners/:partnerId/follow", requireUser, async (req, res) => {
  const partnerId = safeString(req.params.partnerId, "partnerId", { min: 4, max: 128 });
  if (partnerId === req.auth.uid) throw new ApiError(422, "INVALID_PARTNER", "본인을 팔로우할 수 없습니다.");
  const partnerSnapshot = await db.collection("profiles").doc(partnerId).get();
  if (!partnerSnapshot.exists || partnerSnapshot.data()?.accountStatus !== "active") {
    throw new ApiError(404, "PARTNER_NOT_FOUND", "파트너를 찾을 수 없습니다.");
  }
  const reference = db.collection("follows").doc(req.auth.uid + "_" + partnerId);
  const following = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (snapshot.exists) transaction.delete(reference);
    else transaction.create(reference, { fromUserId: req.auth.uid, toUserId: partnerId, createdAt: nowIso() });
    return !snapshot.exists;
  });
  const reverse = await db.collection("follows").doc(partnerId + "_" + req.auth.uid).get();
  return success(res, req, { following, mutual: following && reverse.exists, partner: publicProfile(partnerSnapshot.data()) });
});

app.get("/api/posts", requireUser, async (req, res) => {
  const [snapshot, partnerIds] = await Promise.all([
    db.collection("posts").orderBy("createdAt", "desc").limit(100).get(),
    acceptedPartnerIds(req.auth.uid),
  ]);
  const posts = snapshot.docs
    .map((document) => document.data())
    .filter(
      (post) =>
        post.visibility === "public" ||
        post.authorId === req.auth.uid ||
        (post.visibility === "partners" && partnerIds.has(post.authorId)),
    )
    .slice(0, 50);
  return success(res, req, posts, 200, { pagination: { total: posts.length, nextCursor: null } });
});

app.post("/api/posts", requireUser, async (req, res) => {
  const text = safeString(req.body?.text, "text", { min: 1, max: 3000 });
  const tags = stringArray(req.body?.tags, "tags", [], 8, 40).map((tag) => (tag.startsWith("#") ? tag : "#" + tag));
  const visibility = req.body?.visibility ?? "public";
  if (!["public", "partners"].includes(visibility)) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 게시물 공개 범위입니다.", { field: "visibility" });
  }
  const timestamp = nowIso();
  const post = {
    id: "post-" + crypto.randomUUID(),
    authorId: req.auth.uid,
    author: {
      id: req.auth.uid,
      name: req.auth.profile.name,
      handle: req.auth.profile.handle,
      flag: req.auth.profile.country?.flag || "🌐",
    },
    text,
    language: optionalString(req.body?.language, "language", 10) || req.auth.profile.learningLanguages?.[0]?.code || "en",
    targetLanguage: optionalString(req.body?.targetLanguage, "targetLanguage", 10) || req.auth.profile.nativeLanguages?.[0] || "ko",
    tags,
    visibility,
    requestCorrection: optionalBoolean(req.body?.requestCorrection, "requestCorrection", false),
    likes: 0,
    comments: 0,
    corrections: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.collection("posts").doc(post.id).create(post);
  return success(res, req, post, 201);
});

/**
 * 내 글 삭제. 남의 글은 지울 수 없으므로 작성자를 서버에서 확인합니다
 * (화면이 메뉴를 숨기는 것만으로는 권한이 되지 않습니다).
 * 좋아요 하위 컬렉션도 함께 지워 고아 문서를 남기지 않습니다.
 */
app.delete("/api/posts/:postId", requireUser, async (req, res) => {
  const postId = safeString(req.params.postId, "postId", { min: 4, max: 128 });
  const postReference = db.collection("posts").doc(postId);
  const snapshot = await postReference.get();
  if (!snapshot.exists) throw new ApiError(404, "POST_NOT_FOUND", "게시물을 찾을 수 없습니다.");
  if (snapshot.data().authorId !== req.auth.uid) {
    throw new ApiError(403, "POST_FORBIDDEN", "내가 쓴 글만 삭제할 수 있습니다.");
  }
  const reactions = await postReference.collection("reactions").get();
  const batch = db.batch();
  reactions.docs.forEach((document) => batch.delete(document.ref));
  batch.delete(postReference);
  await batch.commit();
  return success(res, req, { id: postId, deleted: true });
});

app.post("/api/posts/:postId/like", requireUser, async (req, res) => {
  const postId = safeString(req.params.postId, "postId", { min: 4, max: 128 });
  const postReference = db.collection("posts").doc(postId);
  const reactionReference = postReference.collection("reactions").doc(req.auth.uid);
  const partnerIds = await acceptedPartnerIds(req.auth.uid);
  const result = await db.runTransaction(async (transaction) => {
    const [postSnapshot, reactionSnapshot] = await Promise.all([
      transaction.get(postReference),
      transaction.get(reactionReference),
    ]);
    if (!postSnapshot.exists) throw new ApiError(404, "POST_NOT_FOUND", "게시물을 찾을 수 없습니다.");
    const post = postSnapshot.data();
    const readable =
      post.visibility === "public" ||
      post.authorId === req.auth.uid ||
      (post.visibility === "partners" && partnerIds.has(post.authorId));
    if (!readable) throw new ApiError(404, "POST_NOT_FOUND", "게시물을 찾을 수 없습니다.");
    const liked = !reactionSnapshot.exists;
    if (liked) transaction.create(reactionReference, { userId: req.auth.uid, createdAt: nowIso() });
    else transaction.delete(reactionReference);
    transaction.update(postReference, { likes: FieldValue.increment(liked ? 1 : -1), updatedAt: nowIso() });
    return { liked, likes: Math.max(0, Number(postSnapshot.data().likes || 0) + (liked ? 1 : -1)) };
  });
  return success(res, req, result);
});

app.post("/api/conversations", requireUser, async (req, res) => {
  const partnerId = safeString(req.body?.partnerId, "partnerId", { min: 4, max: 128 });
  if (partnerId === req.auth.uid) throw new ApiError(422, "INVALID_PARTNER", "본인과 대화할 수 없습니다.");
  const partnerSnapshot = await db.collection("profiles").doc(partnerId).get();
  if (!partnerSnapshot.exists || partnerSnapshot.data()?.accountStatus !== "active") {
    throw new ApiError(404, "PARTNER_NOT_FOUND", "대화 상대를 찾을 수 없습니다.");
  }
  const id = conversationIdFor(req.auth.uid, partnerId);
  const reference = db.collection("conversations").doc(id);
  const timestamp = nowIso();
  const existingConversation = await reference.get();
  if (
    existingConversation.exists &&
    (!existingConversation.data()?.memberIds?.includes(req.auth.uid) || !existingConversation.data()?.memberIds?.includes(partnerId))
  ) {
    throw new ApiError(409, "CONVERSATION_CONFLICT", "대화 식별자 충돌을 확인했습니다.");
  }
  const decision =
    existingConversation.exists && conversationStatus(existingConversation.data()) === "accepted"
      ? { status: "accepted" }
      : await directMessageDecision(req.auth.uid, partnerId);
  const created = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) {
      transaction.create(reference, {
        id,
        memberIds: [req.auth.uid, partnerId],
        createdAt: timestamp,
        updatedAt: timestamp,
        lastMessage: "",
        lastSenderId: null,
        requestStatus: decision.status,
        requestSenderId: decision.status === "pending" ? req.auth.uid : null,
        requestRecipientId: decision.status === "pending" ? partnerId : null,
        requestMessageSent: false,
      });
      return true;
    }
    if (conversationStatus(snapshot.data()) === "pending" && decision.status === "accepted") {
      transaction.update(reference, {
        requestStatus: "accepted",
        requestSenderId: null,
        requestRecipientId: null,
        updatedAt: timestamp,
      });
    }
    return false;
  });
  const conversation = (await reference.get()).data();
  return success(res, req, await conversationView(conversation, req.auth.uid, true), created ? 201 : 200);
});

app.get("/api/conversations", requireUser, async (req, res) => {
  const box = req.query.box === undefined ? "inbox" : safeString(req.query.box, "box", { min: 5, max: 16 });
  if (!["inbox", "requests"].includes(box)) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 대화함입니다.", { field: "box" });
  }
  const snapshot = await db.collection("conversations").where("memberIds", "array-contains", req.auth.uid).limit(100).get();
  const conversations = snapshot.docs
    .map((document) => document.data())
    .filter((conversation) => {
      const status = conversationStatus(conversation);
      if (box === "requests") return status === "pending" && conversation.requestRecipientId === req.auth.uid;
      return status === "accepted" || (status === "pending" && conversation.requestSenderId === req.auth.uid);
    })
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  const views = await Promise.all(conversations.map((conversation) => conversationView(conversation, req.auth.uid, false)));
  return success(res, req, views, 200, { pagination: { total: views.length, nextCursor: null } });
});

app.post("/api/conversations/:conversationId/accept", requireUser, async (req, res) => {
  const id = safeString(req.params.conversationId, "conversationId", { min: 4, max: 128 });
  const reference = db.collection("conversations").doc(id);
  const conversation = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new ApiError(404, "CONVERSATION_NOT_FOUND", "대화를 찾을 수 없습니다.");
    const data = snapshot.data();
    if (conversationStatus(data) !== "pending" || data.requestRecipientId !== req.auth.uid) {
      throw new ApiError(403, "REQUEST_ACCEPT_FORBIDDEN", "이 메시지 요청을 수락할 수 없습니다.");
    }
    const patch = {
      requestStatus: "accepted",
      requestSenderId: null,
      requestRecipientId: null,
      updatedAt: nowIso(),
    };
    transaction.update(reference, patch);
    return { ...data, ...patch };
  });
  return success(res, req, await conversationView(conversation, req.auth.uid, true));
});

app.get("/api/conversations/:conversationId/messages", requireUser, async (req, res) => {
  const id = safeString(req.params.conversationId, "conversationId", { min: 4, max: 128 });
  const conversationSnapshot = await db.collection("conversations").doc(id).get();
  if (!conversationSnapshot.exists) throw new ApiError(404, "CONVERSATION_NOT_FOUND", "대화를 찾을 수 없습니다.");
  if (!conversationSnapshot.data().memberIds.includes(req.auth.uid)) {
    throw new ApiError(403, "CONVERSATION_FORBIDDEN", "이 대화에 접근할 수 없습니다.");
  }
  const snapshot = await db.collection("conversations").doc(id).collection("messages").orderBy("sentAt", "desc").limit(200).get();
  const messages = snapshot.docs.map((document) => document.data()).reverse();
  return success(res, req, messages, 200, { pagination: { total: messages.length, nextCursor: null } });
});

async function createMessage(req, res, conversationId) {
  const id = safeString(conversationId, "conversationId", { min: 4, max: 128 });
  const text = safeString(req.body?.text, "text", { min: 1, max: 4000 });
  const type = req.body?.type ?? "text";
  if (!["text", "voice"].includes(type)) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 메시지 형식입니다.", { field: "type" });
  }
  if (type === "voice") {
    throw new ApiError(501, "VOICE_MESSAGE_NOT_CONFIGURED", "보이스 메시지 전송은 아직 연결되지 않았습니다.");
  }
  const clientMessageId =
    typeof req.body?.clientMessageId === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(req.body.clientMessageId)
      ? req.body.clientMessageId
      : "message-" + crypto.randomUUID();
  const conversationReference = db.collection("conversations").doc(id);
  const messageReference = conversationReference.collection("messages").doc(clientMessageId);
  const timestamp = nowIso();
  const message = {
    id: clientMessageId,
    conversationId: id,
    senderId: req.auth.uid,
    type,
    text,
    sentAt: timestamp,
    status: "sent",
  };
  const result = await db.runTransaction(async (transaction) => {
    const [conversationSnapshot, messageSnapshot] = await Promise.all([
      transaction.get(conversationReference),
      transaction.get(messageReference),
    ]);
    if (!conversationSnapshot.exists) throw new ApiError(404, "CONVERSATION_NOT_FOUND", "대화를 찾을 수 없습니다.");
    if (!conversationSnapshot.data().memberIds.includes(req.auth.uid)) {
      throw new ApiError(403, "CONVERSATION_FORBIDDEN", "이 대화에 메시지를 보낼 수 없습니다.");
    }
    if (messageSnapshot.exists) {
      const existing = messageSnapshot.data();
      if (existing.senderId !== req.auth.uid || existing.text !== text || existing.type !== type) {
        throw new ApiError(409, "MESSAGE_ID_CONFLICT", "이미 사용된 메시지 ID입니다.");
      }
      return { message: existing, created: false };
    }
    const conversation = conversationSnapshot.data();
    if (conversationStatus(conversation) === "pending") {
      if (conversation.requestSenderId !== req.auth.uid) {
        throw new ApiError(403, "MESSAGE_REQUEST_PENDING", "메시지 요청을 수락한 뒤 답장할 수 있습니다.");
      }
      if (conversation.requestMessageSent) {
        throw new ApiError(403, "MESSAGE_REQUEST_LIMIT", "상대방이 요청을 수락하기 전에는 메시지를 한 개만 보낼 수 있습니다.");
      }
    } else if (conversationStatus(conversation) !== "accepted") {
      throw new ApiError(403, "CONVERSATION_CLOSED", "이 대화에는 메시지를 보낼 수 없습니다.");
    }
    transaction.create(messageReference, message);
    transaction.update(conversationReference, {
      lastMessage: text,
      lastSenderId: req.auth.uid,
      updatedAt: timestamp,
      ...(conversationStatus(conversation) === "pending" ? { requestMessageSent: true } : {}),
    });
    return { message, created: true };
  });
  return success(res, req, { conversationId: id, message: result.message }, result.created ? 201 : 200);
}

app.post("/api/conversations/:conversationId/messages", requireUser, async (req, res) =>
  createMessage(req, res, req.params.conversationId),
);
app.post("/api/messages", requireUser, async (req, res) =>
  createMessage(req, res, req.body?.conversationId),
);

app.get("/api/rooms", requireUser, async (req, res) => {
  const snapshot = await db.collection("voiceRooms").where("active", "==", true).limit(50).get();
  const rooms = snapshot.docs.map((document) => document.data()).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return success(res, req, rooms, 200, { pagination: { total: rooms.length, nextCursor: null } });
});

app.post("/api/rooms", requireUser, async (req, res) => {
  const timestamp = nowIso();
  const room = {
    id: "room-" + crypto.randomUUID(),
    title: safeString(req.body?.title, "title", { min: 2, max: 80 }),
    topic: safeString(req.body?.topic, "topic", { min: 2, max: 160 }),
    language: safeString(req.body?.language || "en", "language", { min: 2, max: 10 }),
    level: safeString(req.body?.level || "all", "level", { min: 2, max: 20 }),
    hostId: req.auth.uid,
    host: req.auth.profile.name,
    hostFlag: req.auth.profile.country?.flag || "🌐",
    listeners: 0,
    speakers: [],
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    audioTransport: "not-configured",
  };
  await db.collection("voiceRooms").doc(room.id).create(room);
  return success(res, req, room, 201);
});

app.post("/api/rooms/:roomId/close", requireUser, async (req, res) => {
  const roomId = safeString(req.params.roomId, "roomId", { min: 4, max: 128 });
  const reference = db.collection("voiceRooms").doc(roomId);
  const room = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new ApiError(404, "ROOM_NOT_FOUND", "보이스 룸을 찾을 수 없습니다.");
    const current = snapshot.data();
    if (current.hostId !== req.auth.uid) throw new ApiError(403, "ROOM_CLOSE_FORBIDDEN", "호스트만 룸을 종료할 수 있습니다.");
    const patch = { active: false, listeners: 0, speakers: [], updatedAt: nowIso(), closedAt: nowIso() };
    transaction.update(reference, patch);
    return { ...current, ...patch };
  });
  return success(res, req, room);
});

app.get("/api/dm/privacy", requireUser, async (req, res) => {
  const snapshot = await db.collection("dmPolicies").doc(req.auth.uid).get();
  return success(res, req, { settings: snapshot.exists ? snapshot.data() : DEFAULT_DM_PRIVACY, persisted: true });
});

app.post("/api/dm/privacy", requireUser, async (req, res) => {
  const currentSnapshot = await db.collection("dmPolicies").doc(req.auth.uid).get();
  const current = currentSnapshot.exists ? currentSnapshot.data() : DEFAULT_DM_PRIVACY;
  const allowed = ["matches", "mutual-follows", "followers", "everyone", "all"];
  const requestedScope = req.body?.whoCanMessage ?? current.whoCanMessage;
  const whoCanMessage = requestedScope === "all" ? "everyone" : requestedScope;
  if (!allowed.includes(whoCanMessage)) throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 DM 허용 범위입니다.");
  const settings = {
    whoCanMessage,
    routeOthersToRequests: optionalBoolean(
      req.body?.routeOthersToRequests,
      "routeOthersToRequests",
      Boolean(current.routeOthersToRequests),
    ),
    filterSuspectedSpam: optionalBoolean(
      req.body?.filterSuspectedSpam,
      "filterSuspectedSpam",
      Boolean(current.filterSuspectedSpam),
    ),
    allowVoiceMessagesInRequests: optionalBoolean(
      req.body?.allowVoiceMessagesInRequests,
      "allowVoiceMessagesInRequests",
      Boolean(current.allowVoiceMessagesInRequests),
    ),
    readReceipts: optionalBoolean(req.body?.readReceipts, "readReceipts", Boolean(current.readReceipts)),
    updatedAt: nowIso(),
  };
  await db.collection("dmPolicies").doc(req.auth.uid).set(settings);
  return success(res, req, { settings, persisted: true });
});

app.get("/api/dm/sync", requireUser, async (req, res) => {
  return success(res, req, {
    storage: "firestore",
    automaticSync: true,
    reinstallRecovery: true,
    retention: { mode: "service-managed", userDeleteAvailable: false },
    encryption: { inTransit: true, atRest: true, endToEnd: false },
    lastSyncedAt: nowIso(),
  });
});

app.get("/api/reports", requireUser, async (req, res) => {
  const snapshot = await db.collection("reports").where("reporterId", "==", req.auth.uid).limit(50).get();
  const reports = snapshot.docs.map((document) => document.data()).sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  return success(res, req, reports, 200, { pagination: { total: reports.length, nextCursor: null } });
});

app.post("/api/reports", requireUser, async (req, res) => {
  const targetTypes = ["user", "post", "message", "room"];
  const reasons = ["spam", "scam", "harassment", "dating", "sexual_content", "hate", "impersonation", "other"];
  const targetType = safeString(req.body?.targetType, "targetType", { min: 2, max: 32 });
  const targetId = safeString(req.body?.targetId, "targetId", { min: 2, max: 128 });
  const reason = safeString(req.body?.reason, "reason", { min: 2, max: 64 });
  if (!targetTypes.includes(targetType) || !reasons.includes(reason)) {
    throw new ApiError(422, "VALIDATION_ERROR", "신고 대상 또는 사유를 확인해 주세요.");
  }
  const timestamp = nowIso();
  const report = {
    id: "report-" + crypto.randomUUID(),
    reporterId: req.auth.uid,
    targetType,
    targetId,
    reason,
    details: optionalString(req.body?.details, "details", 2000) || "",
    status: "received",
    submittedAt: timestamp,
    updatedAt: timestamp,
    nextUpdateBy: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    reporterAccountStatus: "active",
  };
  await db.collection("reports").doc(report.id).create(report);
  return success(res, req, {
    ...report,
    safetyMessage: "신고가 접수되었습니다. 신고자 계정은 신고만으로 제한되지 않습니다.",
  }, 201);
});

app.get("/api/account/verification", requireUser, async (req, res) => {
  return success(res, req, {
    accountStatus: "active",
    assuranceLevel: req.auth.emailVerified ? "email" : "none",
    requiredForActivation: [],
    steps: [
      { type: "email", status: req.auth.emailVerified ? "verified" : "pending" },
      { type: "phone", status: "not-started" },
      { type: "identity", status: "not-started" },
    ],
    updatedAt: nowIso(),
  });
});

app.get("/api/search", requireUser, async (req, res) => {
  const query = safeString(req.query.q, "q", { min: 2, max: 80 }).toLocaleLowerCase();
  const [profilesSnapshot, postsSnapshot, partnerIds] = await Promise.all([
    db.collection("profiles").limit(100).get(),
    db.collection("posts").orderBy("createdAt", "desc").limit(100).get(),
    acceptedPartnerIds(req.auth.uid),
  ]);
  const partners = profilesSnapshot.docs
    .map((document) => document.data())
    .filter((profile) => profile.id !== req.auth.uid && profile.accountStatus === "active")
    .filter((profile) => [profile.name, profile.handle, profile.bio, ...(profile.interests || [])].join(" ").toLocaleLowerCase().includes(query))
    .map(publicProfile);
  const posts = postsSnapshot.docs
    .map((document) => document.data())
    .filter(
      (post) =>
        post.visibility === "public" ||
        post.authorId === req.auth.uid ||
        (post.visibility === "partners" && partnerIds.has(post.authorId)),
    )
    .filter((post) => [post.text, ...(post.tags || [])].join(" ").toLocaleLowerCase().includes(query));
  return success(res, req, { partners, posts }, 200, { total: partners.length + posts.length });
});

app.post("/api/translate", requireUser, async (req, res) => {
  const text = safeString(req.body?.text, "text", { min: 1, max: 2000 });
  const targetLanguage = safeString(req.body?.targetLanguage, "targetLanguage", { min: 2, max: 10 });
  const sourceLanguage = optionalString(req.body?.sourceLanguage, "sourceLanguage", 10) || "auto";
  const { body: aiBody, quota } = await geminiResponse(
    {
      instructions: "Translate the user's text faithfully. Return only the translated text, without notes or quotation marks.",
      input: "Source language: " + sourceLanguage + "\nTarget language: " + targetLanguage + "\nText:\n" + text,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.1,
        responseMimeType: "text/plain",
      },
    },
    req.auth.uid,
    { feature: "translation", dailyLimit: AI_TRANSLATION_DAILY_LIMIT },
  );
  const translatedText = geminiText(aiBody);
  return success(res, req, {
    sourceText: text,
    sourceLanguage,
    targetLanguage,
    translatedText,
    alternatives: [],
    confidence: null,
    provider: GEMINI_PROVIDER,
    model: GEMINI_MODEL,
    entitlement: { tier: "free-beta", charged: false, metered: true, paywall: false, usage: quota },
  });
});

app.post("/api/conversation-support", requireUser, async (req, res) => {
  const partnerId = safeString(req.body?.partnerId, "partnerId", { min: 4, max: 128 });
  const partnerSnapshot = await db.collection("profiles").doc(partnerId).get();
  if (!partnerSnapshot.exists) throw new ApiError(404, "PARTNER_NOT_FOUND", "대화 상대를 찾을 수 없습니다.");
  const stage = optionalString(req.body?.stage, "stage", 32) || "first-message";
  const draft = optionalString(req.body?.draft, "draft", 1000) || "";
  const partner = publicProfile(partnerSnapshot.data());
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      topics: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
      suggestedOpeners: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
      followUpQuestions: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
      improvedDraft: { type: "string" },
      tip: { type: "string" },
    },
    required: ["topics", "suggestedOpeners", "followUpQuestions", "improvedDraft", "tip"],
  };
  const { body: aiBody, quota } = await geminiResponse(
    {
      instructions: "You support a safe language exchange conversation. Keep suggestions friendly, non-romantic, concise, and appropriate for the learner's level.",
      input: JSON.stringify({
        stage,
        draft,
        partner: {
          nativeLanguages: partner.nativeLanguages,
          learningLanguages: partner.learningLanguages,
          interests: partner.interests,
        },
      }),
      generationConfig: {
        maxOutputTokens: 1200,
        temperature: 0.4,
        responseMimeType: "application/json",
        responseJsonSchema: schema,
      },
    },
    req.auth.uid,
    { feature: "conversationSupport", dailyLimit: AI_SUPPORT_DAILY_LIMIT },
  );
  const supportText = geminiText(aiBody);
  let support;
  try {
    support = JSON.parse(supportText);
  } catch {
    throw new ApiError(502, "AI_INVALID_RESPONSE", "AI 응답 형식을 확인하지 못했습니다.");
  }
  const listFields = [support.topics, support.suggestedOpeners, support.followUpQuestions];
  if (
    !listFields.every(
      (items) => Array.isArray(items) && items.length === 3 && items.every((item) => typeof item === "string" && item.trim().length > 0),
    ) ||
    typeof support.improvedDraft !== "string" ||
    typeof support.tip !== "string"
  ) {
    throw new ApiError(502, "AI_INVALID_RESPONSE", "AI 응답 형식을 확인하지 못했습니다.");
  }
  return success(res, req, {
    partner,
    stage,
    ...support,
    provider: GEMINI_PROVIDER,
    model: GEMINI_MODEL,
    entitlement: { tier: "free-beta", charged: false, metered: true, paywall: false, usage: quota },
  });
});

app.use((req, _res, next) => {
  next(new ApiError(404, "NOT_FOUND", "API 경로를 찾을 수 없습니다: " + req.path));
});

app.use((error, req, res, _next) => {
  void _next;
  const apiError =
    error instanceof ApiError
      ? error
      : error?.type === "entity.too.large"
        ? new ApiError(413, "PAYLOAD_TOO_LARGE", "요청 본문은 64KB 이하여야 합니다.")
        : error?.type === "entity.parse.failed"
          ? new ApiError(400, "INVALID_JSON", "JSON 요청 본문 형식을 확인해 주세요.")
        : new ApiError(500, "INTERNAL_ERROR", "요청 처리 중 오류가 발생했습니다.");
  if (apiError.status >= 500) {
    console.error(JSON.stringify({ requestId: req.requestId, code: apiError.code, message: error?.message || apiError.message }));
  }
  res.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details === undefined ? {} : { details: apiError.details }),
    },
    meta: {
      requestId: req.requestId,
      timestamp: nowIso(),
      mock: false,
      persistent: true,
    },
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(JSON.stringify({ service: "lingoloop-api", status: "listening", port: PORT }));
});
