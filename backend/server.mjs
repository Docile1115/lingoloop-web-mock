import crypto from "node:crypto";
import express from "express";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { buildConversationReadPatch, isConversationHidden } from "./conversation-read.mjs";
import { extractGeminiText, GeminiProviderError, generateGeminiContent, MODEL_SUCCESSORS } from "./gemini.mjs";
import {
  buildNotification,
  matchesNotificationEvent,
  notificationDocumentId,
  notificationEventIdentity,
  NOTIFICATION_TYPES,
} from "./notifications.mjs";
import {
  decideDmRoute,
  dmRelationships,
  DM_REQUEST_COOLDOWN_MS,
  requestCooldownUntil,
  spamSignals,
} from "./policy.mjs";
import { nextWriteQuota, writeQuotaMessage } from "./write-quota.mjs";
import { createFixedWindowLimiter, nextFixedWindowBucket } from "./auth-rate-limit.mjs";
import { createSessionVerificationCache, isSessionRejection } from "./session-cache.mjs";
import { RoomValidationError, roomFields, validateRoomConfig } from "./room.mjs";
import { registerHomeRoutes } from "./homes.mjs";
import { registerAccountRoutes } from "./account-deletion.mjs";
import { EXPO_PUSH_URL, createPushDelivery, registerPushRoutes } from "./push.mjs";
import {
  CHAT_CORRECTIONS_LIMIT,
  correctionInboxEntry,
  createCorrectionRules,
  receivedCorrections,
  sameCorrection,
} from "./corrections.mjs";
import { isDiscoverable, presenceIsStale, presenceOf } from "./discovery.mjs";
import { SUPPORT_SCHEMA, normalizeSupport, supportInstructions, supportLanguages } from "./ai-support.mjs";
import { createValidators, isDocumentId } from "./validate.mjs";
import {
  AvatarValidationError,
  avatarFields,
  normalizeAvatarPatch,
  sameAvatarConfig,
} from "./avatar.mjs";

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID;
const IDENTITY_API_KEY = process.env.IDENTITY_API_KEY;
// 브라우저의 소셜 로그인 팝업에 전달하는 공개 Firebase 웹 API 키입니다.
const IDENTITY_WEB_API_KEY = process.env.IDENTITY_WEB_API_KEY || IDENTITY_API_KEY;
const FIREBASE_AUTH_DOMAIN = process.env.FIREBASE_AUTH_DOMAIN || `${PROJECT_ID}.firebaseapp.com`;
const GOOGLE_AUTH_ENABLED = process.env.GOOGLE_AUTH_ENABLED === "true";
const APPLE_AUTH_ENABLED = process.env.APPLE_AUTH_ENABLED === "true";
// OAuth client ID는 공개 식별자입니다. Android 네이티브 Google SDK가 같은
// Identity Platform 프로젝트의 ID token을 받도록 앱 구성 응답에 포함합니다.
const GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID || "";
/* 로컬 에뮬레이터로 붙어 있는가. 이 값이 있으면 브라우저도 에뮬레이터를 봐야
   같은 계정으로 로그인됩니다 — 없으면 브라우저만 진짜 구글로 가서 어긋납니다.
   운영에는 이 변수가 없으므로 아래 값은 비어 나갑니다. */
const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "";
const PROXY_SHARED_SECRET = process.env.PROXY_SHARED_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const GEMINI_LOCATION = process.env.GEMINI_LOCATION || "global";
const GEMINI_API_BASE_URL =
  process.env.GEMINI_API_BASE_URL ||
  `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/locations/${encodeURIComponent(GEMINI_LOCATION)}/publishers/google/models`;
const GEMINI_PROVIDER = "google-vertex-ai";
const AI_TRANSLATION_DAILY_LIMIT = Number(process.env.AI_TRANSLATION_DAILY_LIMIT || 100);
const AI_SUPPORT_DAILY_LIMIT = Number(process.env.AI_SUPPORT_DAILY_LIMIT || 30);
const PORT = Number(process.env.PORT || 8080);
/* 폰 알림(push.mjs). 로컬에서는 EXPO_PUSH_URL 을 가짜 서버로 돌릴 수 있습니다.
   EXPO_ACCESS_TOKEN 은 Expo 프로젝트에서 "보내기에 토큰 필요"를 켰을 때만 둡니다. */
const EXPO_PUSH_ENDPOINT = process.env.EXPO_PUSH_URL || EXPO_PUSH_URL;
const EXPO_ACCESS_TOKEN = process.env.EXPO_ACCESS_TOKEN || "";
/**
 * 신고를 볼 수 있는 사람. 쉼표로 구분한 uid 목록입니다.
 * 역할 데이터를 따로 두지 않은 것은, 운영자가 몇 명뿐이고 배포 설정에 드러나 있는
 * 편이 "누가 신고를 볼 수 있나"를 확인하기 쉽기 때문입니다. 사람이 늘면 그때 옮깁니다.
 */
const ADMIN_UIDS = new Set(
  String(process.env.ADMIN_UIDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
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

const COUNTRIES = [
  { code: "KR", name: "대한민국", flag: "🇰🇷" },
  { code: "US", name: "미국", flag: "🇺🇸" },
  { code: "JP", name: "일본", flag: "🇯🇵" },
  { code: "CN", name: "중국", flag: "🇨🇳" },
  { code: "GB", name: "영국", flag: "🇬🇧" },
  { code: "CA", name: "캐나다", flag: "🇨🇦" },
  { code: "AU", name: "호주", flag: "🇦🇺" },
  { code: "FR", name: "프랑스", flag: "🇫🇷" },
  { code: "DE", name: "독일", flag: "🇩🇪" },
  { code: "ES", name: "스페인", flag: "🇪🇸" },
  { code: "BR", name: "브라질", flag: "🇧🇷" },
  { code: "VN", name: "베트남", flag: "🇻🇳" },
];

/**
 * 배우는 단계 다섯.
 *
 * 예전에는 아무 글자나 받았습니다(safeString). 그러면 화면이 점을 몇 개 칠할지
 * 정할 수 없고, 사람마다 다른 말이 들어옵니다.
 * 예전 값(beginner·intermediate·advanced)은 이 목록 안에 그대로 있어서
 * 이미 저장된 프로필도 그대로 읽힙니다.
 */
const LEARNING_LEVELS = ["beginner", "elementary", "intermediate", "upper", "advanced"];

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
  levelMin: LEARNING_LEVELS[0],
  levelMax: LEARNING_LEVELS[LEARNING_LEVELS.length - 1],
  ageMin: 18,
  ageMax: 100,
  verifiedOnly: false,
  intents: ["language-exchange", "friendship"],
  onlineOnly: false,
};

const DEFAULT_DM_PRIVACY = {
  whoCanMessage: "matches",
  routeOthersToRequests: true,
  /** 요청함에 들어온 첫 메시지에서 스팸 신호를 찾아 표시합니다. 막지는 않습니다. */
  flagSuspectedSpam: true,
};

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/* .doc() 에 들어가는 경로 값·본문 값은 모두 docId 로 확인합니다(validate.mjs). */
const { docId, optionalDocId, mediaDataUri, isoTimestamp } = createValidators(ApiError);
/* 대화 교정(type: "correction")의 본문 확인과 transaction 안의 대상 확인(corrections.mjs). */
const { correctionInput, readCorrection } = createCorrectionRules(ApiError);

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
  const normalized = { ...profile, ...avatarFields(profile), ...roomFields(profile), status: presenceOf(profile) };
  return Object.fromEntries(Object.entries(normalized).filter(([key]) => !privateFields.has(key)));
}

/** 작은 작성자 카드에서도 전체 프로필과 같은 캐릭터 계약을 반환합니다. */
function avatarPresentation(profile) {
  return {
    avatarUrl: profile?.avatarUrl || "",
    ...avatarFields(profile),
  };
}

/**
 * 남에게 보여줄 프로필.
 *
 * "정밀 위치 숨기기" 를 켠 사람의 도시는 지웁니다. 개인정보 스위치는 실제로
 * 무언가를 가려야 스위치입니다 — 예전에는 켜도 남들에게 도시가 그대로 보였습니다.
 * 본인에게는 publicProfile 로 그대로 보여줍니다(자기 도시는 자기가 봐야 고칩니다).
 */
function profileForOthers(profile) {
  const shown = publicProfile(profile);
  if (!shown) return shown;
  // 설정값 자체도 남에게 알릴 이유가 없습니다.
  const { hideLocation, ...rest } = shown;
  delete rest.roomConfig; // A house is readable only through its privacy-checked API.
  delete rest.lastActiveAt; // 마지막 접속 시각은 본인만 봅니다.
  delete rest.onboardedAt;
  // 이 설정이 생기기 전 프로필에는 값이 없습니다. 화면·PATCH처럼 "없음"도 숨김으로 봅니다.
  return hideLocation === false ? rest : { ...rest, city: "" };
}

function defaultProfile(uid, email, name) {
  // 표시 이름이 없으면 이메일 앞부분을 쓰지 않습니다 — 이름과 핸들은 모두에게 보여서
  // 이메일 일부가 드러납니다. PATCH가 2자 이상을 요구하므로 1자 이름도 기본 이름으로 둡니다.
  const providedName = (name || "").trim().slice(0, 40);
  const hasName = providedName.length >= 2;
  const normalizedName = hasName ? providedName : "TimoTalk 사용자";
  const handleBase = (hasName ? providedName : "")
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
    hideLocation: true,
    // 프로필 사진. 지금은 데이터 URI 를 그대로 담습니다 — 저장소 버킷이 생기면
    // 그 주소로 바뀌기만 하면 됩니다(화면은 문자열만 봅니다).
    avatarUrl: "",
    avatarMode: "photo",
    avatarConfig: null,
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
    // 첫 설정을 마치면 시각이 들어갑니다. 그 전에는 다른 사람의 추천·검색에 나오지 않습니다.
    onboardedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastActiveAt: timestamp,
  };
}

async function ensureProfile(uid, email, name) {
  const reference = db.collection("profiles").doc(uid);
  const snapshot = await reference.get();
  if (snapshot.exists) {
    const stored = snapshot.data();
    const normalizedAvatar = avatarFields(stored);
    const storedConfig = stored.avatarConfig ?? null;
    const needsAvatarBackfill =
      !Object.hasOwn(stored, "avatarMode") ||
      !Object.hasOwn(stored, "avatarConfig") ||
      stored.avatarMode !== normalizedAvatar.avatarMode ||
      !sameAvatarConfig(storedConfig, normalizedAvatar.avatarConfig);
    // 마지막 활동 시각. 몇 분에 한 번만 써서 접속 표시는 살리고 쓰기는 줄입니다.
    const presencePatch = presenceIsStale(stored) ? { lastActiveAt: nowIso() } : {};
    if (needsAvatarBackfill) {
      await reference.update({ ...normalizedAvatar, ...presencePatch, updatedAt: nowIso() });
    } else if (presencePatch.lastActiveAt) {
      await reference.update(presencePatch).catch((error) => console.warn("presence update failed", error?.message));
    }
    return { ...stored, ...normalizedAvatar, ...presencePatch };
  }
  // 프로필이 없을 때만 지나는 길입니다(계정마다 처음 한 번). 그 사이 계정을 지웠으면 다시 만들지 않습니다 —
  // 세션 확인은 60초 동안 캐시되므로(session-cache.mjs) 탈퇴 직후 같은 쿠키로 온 요청이 지운 프로필을
  // 기본값으로 되살릴 수 있습니다(DELETE /api/account).
  try {
    await auth.getUser(uid);
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      throw new ApiError(401, "INVALID_SESSION", "세션이 만료되었습니다. 다시 로그인해 주세요.");
    }
    throw error;
  }
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

function assertEnabledSignInProvider(decoded) {
  const provider = decoded?.firebase?.sign_in_provider;
  const enabled =
    (provider === "google.com" && GOOGLE_AUTH_ENABLED) ||
    (provider === "apple.com" && APPLE_AUTH_ENABLED);
  if (!enabled) {
    throw new ApiError(403, "AUTH_PROVIDER_NOT_ALLOWED", "지원하는 소셜 로그인으로 다시 로그인해 주세요.");
  }
}

async function verifyRecentIdToken(idToken) {
  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch {
    throw new ApiError(401, "INVALID_ID_TOKEN", "로그인 정보가 유효하지 않습니다. 다시 시도해 주세요.");
  }
  const currentSeconds = Math.floor(Date.now() / 1000);
  if (!decoded.auth_time || currentSeconds - decoded.auth_time > 5 * 60) {
    throw new ApiError(401, "RECENT_LOGIN_REQUIRED", "다시 로그인해 주세요.");
  }
  assertEnabledSignInProvider(decoded);
  return decoded;
}

async function issueSession(res, idToken, decoded = undefined) {
  const verifiedToken = decoded || await verifyRecentIdToken(idToken);
  const cookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
  res.cookie(COOKIE_NAME, cookie, {
    maxAge: SESSION_MAX_AGE_MS,
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
  });
  return verifiedToken;
}

/** 세션 쿠키를 지웁니다. 로그아웃과 계정 삭제가 발급 때와 같은 이름·옵션을 써야 브라우저가 실제로 지웁니다. */
function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
  });
}

/* 같은 쿠키는 60초 동안 Identity Platform 에 다시 묻지 않습니다(session-cache.mjs). */
const sessionVerifications = createSessionVerificationCache({ ttlMs: 60_000, maxEntries: 5_000 });

async function sessionUser(req) {
  const cookie = parseCookies(req.headers.cookie || "")[COOKIE_NAME];
  if (!cookie) throw new ApiError(401, "AUTH_REQUIRED", "로그인이 필요합니다.");
  let decoded;
  try {
    // checkRevoked=true 가 사용자 기록을 읽어 폐기된 세션과 비활성화된 계정을 거절합니다.
    // 예전에는 그 뒤에 auth.getUser 로 같은 기록을 한 번 더 읽었습니다.
    decoded = await sessionVerifications.verify(cookie, (value) => auth.verifySessionCookie(value, true));
  } catch (error) {
    if (isSessionRejection(error)) {
      throw new ApiError(401, "INVALID_SESSION", "세션이 만료되었습니다. 다시 로그인해 주세요.");
    }
    // 쿠키가 아니라 확인하는 쪽(네트워크·Identity Platform)의 장애입니다. 401 로 답하면 앱이 로그아웃시킵니다.
    console.error(JSON.stringify({ requestId: req.requestId, code: "AUTH_UNAVAILABLE", cause: error?.code || "unknown", message: error?.message }));
    throw new ApiError(503, "AUTH_UNAVAILABLE", "로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  assertEnabledSignInProvider(decoded);
  // 이메일·이름은 세션 쿠키에 담긴 값(로그인 때의 ID 토큰)을 씁니다.
  const profile = await ensureProfile(decoded.uid, decoded.email, decoded.name);
  if (profile.accountStatus !== "active") throw new ApiError(403, "ACCOUNT_RESTRICTED", "사용이 제한된 계정입니다.");
  return { uid: decoded.uid, email: decoded.email || "", emailVerified: decoded.email_verified === true, profile };
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
  // 학습 단계는 하나가 아니라 범위입니다 — "초급만" 보다 "초급~중급" 이 실제로 찾는 방식입니다.
  // partnerLevel 하나만 보내던 옛 앱도 받아줍니다: 그 값 하나짜리 범위로 읽습니다.
  const legacyLevel = body.partnerLevel;
  const fallbackMin = legacyLevel && legacyLevel !== "any" ? legacyLevel : LEARNING_LEVELS[0];
  const fallbackMax = legacyLevel && legacyLevel !== "any" ? legacyLevel : LEARNING_LEVELS[LEARNING_LEVELS.length - 1];
  const levelMin = body.levelMin ?? fallbackMin;
  const levelMax = body.levelMax ?? fallbackMax;
  if (!LEARNING_LEVELS.includes(levelMin) || !LEARNING_LEVELS.includes(levelMax)) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 학습 단계입니다.", { field: "levelMin" });
  }
  if (LEARNING_LEVELS.indexOf(levelMin) > LEARNING_LEVELS.indexOf(levelMax)) {
    throw new ApiError(422, "VALIDATION_ERROR", "학습 단계 범위를 확인해 주세요.", { field: "levelMin" });
  }
  return {
    targetLanguages,
    preferredCountries: stringArray(body.preferredCountries, "preferredCountries", [], 8, 10),
    interests: stringArray(body.interests, "interests", [], 12, 40).map((value) => value.toLocaleLowerCase()),
    availability: stringArray(body.availability, "availability", ["weekday-evening"], 4, 32),
    levelMin,
    levelMax,
    ageMin,
    ageMax,
    verifiedOnly: optionalBoolean(body.verifiedOnly, "verifiedOnly", false),
    intents: stringArray(body.intents, "intents", ["language-exchange", "friendship"], 4, 32),
    onlineOnly: optionalBoolean(body.onlineOnly, "onlineOnly", false),
  };
}

function countryFromCode(code, fallback) {
  if (code === undefined) return fallback;
  const found = COUNTRIES.find((item) => item.code === String(code).toLocaleUpperCase());
  if (!found) throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 국가입니다.", { field: "countryCode" });
  return found;
}

const LANGUAGE_CODES = new Set(LANGUAGES.map((language) => language.code));

/** 프로필 언어는 서버 목록(LANGUAGES)에 있는 코드만 받습니다. */
function supportedLanguageCode(code, field) {
  if (!LANGUAGE_CODES.has(code)) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 언어입니다.", { field });
  }
  return code;
}

/**
 * 프로필 사진은 비우거나 기기에서 올린 이미지 데이터 URI만 받습니다.
 * 외부 주소를 받으면 이 사진을 보는 모든 사람의 IP가 그 서버에 남습니다.
 */
const AVATAR_DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

function avatarUrlFrom(value) {
  const avatarUrl = safeString(value, "avatarUrl", { min: 0, max: 520000 });
  if (avatarUrl && !AVATAR_DATA_URL.test(avatarUrl)) {
    throw new ApiError(422, "VALIDATION_ERROR", "프로필 사진 형식을 확인해 주세요.", { field: "avatarUrl" });
  }
  return avatarUrl;
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
    (!preferences.onlineOnly || presenceOf(candidate) === "online") &&
    (preferences.intents.length === 0 || matchedIntents.length > 0);
  let score = 35;
  // 매칭 이유는 화면에 그대로 나오는 문구입니다. 서버가 한국어 문장으로 만들어 보내면
  // 클라이언트가 번역할 수 없으므로, 사람이 읽는 문장(matchReasons)과 함께
  // 코드+값(matchReasonCodes)을 보냅니다. 화면은 코드가 있으면 자기 언어로 그립니다.
  const reasons = [];
  const reasonCodes = [];
  if (matchedLanguages.length) {
    score += 25;
    const names = matchedLanguages.map((code) => LANGUAGES.find((item) => item.code === code)?.nativeName || code).join(" · ");
    reasons.push(names + " 원어민 파트너예요");
    // 이름은 그 언어로 적힌 것입니다(English·日本語). 한국어 화면에서는 "영어"가
    // 맞으므로 코드도 함께 보냅니다 — 화면이 자기 언어로 다시 그립니다.
    reasonCodes.push({ code: "native-speaker", languages: names, languageCodes: matchedLanguages });
  }
  if (preferences.preferredCountries.includes(candidate.country?.code)) {
    score += 10;
    reasons.push("희망 지역인 " + (candidate.country?.flag || "") + " " + (candidate.country?.name || "") + "에 있어요");
    reasonCodes.push({
      code: "preferred-country",
      flag: candidate.country?.flag || "",
      country: candidate.country?.name || "",
      countryCode: candidate.country?.code || "",
    });
  }
  if (matchedInterests.length) {
    score += Math.min(12, matchedInterests.length * 4);
    const interests = matchedInterests.slice(0, 2).join(" · ");
    reasons.push(interests + " 관심사가 같아요");
    reasonCodes.push({ code: "shared-interests", interests, interestCodes: matchedInterests.slice(0, 2) });
  }
  // 예전에는 이 값을 저장만 하고 어디에도 쓰지 않았습니다 — 골라도 추천이 그대로였습니다.
  const wholeLevelRange =
    preferences.levelMin === LEARNING_LEVELS[0] && preferences.levelMax === LEARNING_LEVELS[LEARNING_LEVELS.length - 1];
  const candidateLevel = LEARNING_LEVELS.indexOf(candidate.learningLanguages?.[0]?.level);
  if (
    !wholeLevelRange &&
    candidateLevel >= LEARNING_LEVELS.indexOf(preferences.levelMin) &&
    candidateLevel <= LEARNING_LEVELS.indexOf(preferences.levelMax)
  ) {
    score += 8;
    reasons.push("찾으시는 학습 단계예요");
    reasonCodes.push({ code: "level-in-range" });
  }
  if (matchedAvailability.length) {
    score += 8;
    reasons.push("선호하는 학습 시간대가 겹쳐요");
    reasonCodes.push({ code: "time-overlap" });
  }
  if (matchedIntents.length) score += 6;
  if (candidate.verified) score += 4;
  if (presenceOf(candidate) === "online") score += 4;
  score += stableHash(date + ":" + candidate.id) % 5;
  if (!exact) {
    reasons.unshift("일부 조건을 넓혀 찾은 가까운 파트너예요");
    reasonCodes.unshift({ code: "broadened" });
  }
  if (reasons.length < 2) {
    reasons.push("새로운 실제 회원과 첫 언어 교환을 시작해 보세요");
    reasonCodes.push({ code: "first-exchange" });
  }
  return {
    partner: profileForOthers(candidate),
    score: Math.min(99, score),
    matchReasons: reasons.slice(0, 4),
    matchReasonCodes: reasonCodes.slice(0, 4),
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

/**
 * 차단. blocks/{blockerId}_{blockedId} 한 문서가 "내가 저 사람을 차단했다"를 뜻합니다.
 *
 * 차단은 한 방향으로 만들지만 효과는 양쪽에 걸립니다 — 내가 차단하면 상대도 나를
 * 볼 수 없어야 합니다. 그렇지 않으면 차단당한 쪽이 계속 말을 걸 수 있고, 차단한
 * 사람은 그 사실을 모른 채 노출됩니다. 그래서 조회는 항상 양방향으로 봅니다.
 */
function blockId(blockerId, blockedId) {
  return blockerId + "_" + blockedId;
}

/**
 * 상호작용을 기록하는 transaction 안에서 양방향 차단 문서를 함께 읽습니다.
 * 차단 생성과 경합하면 Firestore가 이 transaction을 재시도하므로, 차단 이후의
 * 좋아요·팔로우·댓글·대화·알림이 뒤늦게 생기지 않습니다.
 */
async function assertNotBlockedInTransaction(
  transaction,
  actorId,
  counterpartIds,
  {
    status = 403,
    code = "PARTNER_BLOCKED",
    message = "차단된 상대와는 상호작용할 수 없습니다.",
  } = {},
) {
  const counterparts = [...new Set(counterpartIds)].filter((id) => id && id !== actorId);
  if (!counterparts.length) return;
  const references = counterparts.flatMap((counterpartId) => [
    db.collection("blocks").doc(blockId(actorId, counterpartId)),
    db.collection("blocks").doc(blockId(counterpartId, actorId)),
  ]);
  const snapshots = await transaction.getAll(...references);
  if (snapshots.some((snapshot) => snapshot.exists)) {
    throw new ApiError(status, code, message);
  }
}

/** 나와 어느 쪽으로든 차단 관계인 사람들의 id. 목록·검색·피드에서 서로 지웁니다. */
async function blockedBothWays(uid) {
  const [mine, theirs] = await Promise.all([
    db.collection("blocks").where("blockerId", "==", uid).limit(500).get(),
    db.collection("blocks").where("blockedId", "==", uid).limit(500).get(),
  ]);
  const ids = new Set();
  mine.docs.forEach((document) => ids.add(document.data().blockedId));
  theirs.docs.forEach((document) => ids.add(document.data().blockerId));
  return ids;
}

/** 두 사람 사이에 차단이 있는지. 대화·메시지처럼 상대가 정해진 자리에 씁니다. */
async function isBlockedBetween(a, b) {
  const [ab, ba] = await Promise.all([
    db.collection("blocks").doc(blockId(a, b)).get(),
    db.collection("blocks").doc(blockId(b, a)).get(),
  ]);
  return ab.exists || ba.exists;
}

const BLOCK_NOTIFICATION_CLEANUP_PAGE = 200;

/**
 * block 문서가 먼저 커밋된 뒤 실행합니다. 각 transaction은 block 문서를 읽고
 * 알림을 방향별 200개씩만 지워 Firestore의 500 write 한도 안에 머뭅니다.
 * cleanupComplete=false인 동안에는 차단 해제를 막아 새 관계가 정리 중간에
 * 만들어졌다가 함께 지워지는 경쟁도 피합니다.
 */
async function cleanupBlockedPair(blockReference, firstId, secondId) {
  let includeRelationships = true;
  while (true) {
    const result = await db.runTransaction(async (transaction) => {
      const blockSnapshot = await transaction.get(blockReference);
      if (!blockSnapshot.exists) return { active: false, notificationCount: 0 };

      const mineFromPartnerQuery = notificationItems(firstId)
        .where("actorId", "==", secondId)
        .limit(BLOCK_NOTIFICATION_CLEANUP_PAGE);
      const partnerFromMineQuery = notificationItems(secondId)
        .where("actorId", "==", firstId)
        .limit(BLOCK_NOTIFICATION_CLEANUP_PAGE);
      const [mineFromPartner, partnerFromMine] = await Promise.all([
        transaction.get(mineFromPartnerQuery),
        transaction.get(partnerFromMineQuery),
      ]);

      if (includeRelationships) {
        transaction.delete(db.collection("likes").doc(firstId + "_" + secondId));
        transaction.delete(db.collection("likes").doc(secondId + "_" + firstId));
        transaction.delete(db.collection("follows").doc(firstId + "_" + secondId));
        transaction.delete(db.collection("follows").doc(secondId + "_" + firstId));
      }
      mineFromPartner.docs.forEach((document) => transaction.delete(document.ref));
      partnerFromMine.docs.forEach((document) => transaction.delete(document.ref));
      return {
        active: true,
        notificationCount: mineFromPartner.size + partnerFromMine.size,
      };
    });

    includeRelationships = false;
    if (!result.active) return;
    if (result.notificationCount === 0) break;
  }

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(blockReference);
    if (snapshot.exists) {
      transaction.update(blockReference, { cleanupComplete: true, cleanupCompletedAt: nowIso() });
    }
  });
}

/**
 * 새 대화를 만드는 transaction 안에서만 호출합니다. 수신 정책과 매칭·팔로우
 * 관계를 대화 문서 생성과 같은 스냅샷으로 읽어, 정책 변경과 생성이 경합해도
 * Firestore가 transaction을 재시도해 최신 결정만 커밋하게 합니다.
 */
async function directMessageDecisionInTransaction(transaction, senderId, recipientId) {
  const date = todayInSeoul();
  const references = [
    db.collection("dmPolicies").doc(recipientId),
    db.collection("likes").doc(senderId + "_" + recipientId),
    db.collection("likes").doc(recipientId + "_" + senderId),
    db.collection("follows").doc(senderId + "_" + recipientId),
    db.collection("follows").doc(recipientId + "_" + senderId),
    // 받는 사람의 오늘의 추천입니다. 보내는 사람 자신의 추천은 조건을 바꿔 몇 번이고 다시
    // 뽑을 수 있어 매칭의 근거가 되지 못합니다(policy.mjs dmRelationships).
    db.collection("dailyMatches").doc(recipientId).collection("days").doc(date),
  ];
  const [policySnapshot, senderLike, recipientLike, senderFollow, recipientFollow, recipientDailyMatch] =
    await transaction.getAll(...references);
  const policy = policySnapshot.exists ? { ...DEFAULT_DM_PRIVACY, ...policySnapshot.data() } : DEFAULT_DM_PRIVACY;
  const relationships = dmRelationships({
    senderId,
    senderLiked: senderLike.exists,
    recipientLiked: recipientLike.exists,
    senderFollows: senderFollow.exists,
    recipientFollows: recipientFollow.exists,
    recipientRecommendations: recipientDailyMatch.exists ? recipientDailyMatch.data()?.recommendations : [],
  });
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

/**
 * 사용자별 하루 쓰기 한도(write-quota.mjs).
 *
 * 행동을 기록하는 transaction 안에서 같은 문서를 읽고 고칩니다 — 실제로 쓴 것만 세고,
 * 동시에 보낸 요청도 한도를 넘지 못합니다. Firestore transaction 은 읽기를 쓰기보다 먼저
 * 끝내야 하므로, 읽기 단계에서 writeQuotaReference 를 읽어 두고 쓰기 직전에 takeWriteQuota 를 부릅니다.
 */
function writeQuotaReference(uid) {
  return db.collection("writeQuotas").doc(uid);
}

function takeWriteQuota(transaction, quotaSnapshot, action) {
  const day = todayInSeoul();
  const quota = nextWriteQuota(quotaSnapshot.exists ? quotaSnapshot.data() : null, action, day);
  if (!quota.allowed) {
    throw new ApiError(429, "RATE_LIMITED", writeQuotaMessage(action), {
      action,
      limit: quota.limit,
      resetsAt: nextRefreshAt(day),
    });
  }
  transaction.set(quotaSnapshot.ref, { ...quota.next, updatedAt: nowIso() });
}

function notificationItems(recipientId) {
  return db.collection("notifications").doc(recipientId).collection("items");
}

/** 대화에서 고침을 받은 사람의 받은 교정함. 문서 id 는 교정 메시지 id 입니다(corrections.mjs). */
function correctionItems(uid) {
  return db.collection("corrections").doc(uid).collection("items");
}

function notificationRef({ type, recipientId, actorId, sourceId }) {
  const id = notificationDocumentId({ type, recipientId, actorId, sourceId });
  return notificationItems(recipientId).doc(id);
}

/** 원본 행동과 같은 transaction 안에서만 호출합니다. */
function putNotification(transaction, event) {
  const notification = buildNotification(event);
  if (!notification) return null;
  transaction.set(notificationItems(notification.recipientId).doc(notification.id), notification);
  return notification;
}

function removeNotification(transaction, event) {
  if (!event.recipientId || !event.actorId || event.recipientId === event.actorId) return;
  transaction.delete(notificationRef(event));
}

async function unreadNotificationCount(uid) {
  const [snapshot, blocked] = await Promise.all([
    notificationItems(uid).where("readAt", "==", null).limit(500).get(),
    blockedBothWays(uid),
  ]);
  return snapshot.docs.filter((document) => !blocked.has(document.data().actorId)).length;
}

async function conversationView(conversation, uid, includeMessages = false, prefetchedProfiles = null) {
  const partnerId = conversation.memberIds.find((id) => id !== uid);
  // 목록은 상대 프로필을 한 번에 읽어(profilesByIds) 넘깁니다. 대화 하나를 볼 때만 여기서 읽습니다.
  const partnerProfile = prefetchedProfiles
    ? prefetchedProfiles.get(partnerId)
    : partnerId
      ? (await db.collection("profiles").doc(partnerId).get()).data()
      : undefined;
  const partner = partnerProfile ? profileForOthers(partnerProfile) : null;
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
    /** 마지막 메시지를 보낸 사람. 상대가 마지막이면 "내 차례"입니다. */
    lastSenderId: conversation.lastSenderId || null,
    /** 상대가 어디까지 읽었는지. 새 메시지만 받아 와도 내 말풍선의 "읽음"을 고칠 수 있습니다. */
    partnerReadAt: (partnerId && conversation.readAt?.[partnerId]) || null,
    /** 내가 아직 안 읽은 메시지 수. 보낼 때 올리고 읽을 때 0 으로 돌립니다. */
    unreadCount: conversation.unread?.[uid] || 0,
    /* 요청함에서 받는 사람이 먼저 알아보라고 붙이는 표시입니다. 막지는 않습니다. */
    spamSignals: conversation.requestSpamSignals || [],
    requestStatus: conversationStatus(conversation),
    isIncomingRequest: conversationStatus(conversation) === "pending" && conversation.requestRecipientId === uid,
    muted: Array.isArray(conversation.mutedBy) && conversation.mutedBy.includes(uid),
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

/** 사용량을 되돌립니다. 공급자 쪽 실패(장애·한도·모델 종료)로 답을 못 준 요청은 세지 않습니다. */
async function refundDailyQuota(uid, feature) {
  const reference = db.collection("aiUsage").doc(uid).collection("days").doc(todayInSeoul());
  await db
    .runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const used = Number(snapshot.data()?.counts?.[feature] || 0);
      if (!snapshot.exists || !Number.isSafeInteger(used) || used < 1) return;
      transaction.set(reference, { counts: { [feature]: used - 1 }, updatedAt: nowIso() }, { merge: true });
    })
    .catch((error) => console.warn("AI quota refund failed", feature, error?.message));
}

/**
 * 지금 쓰는 모델. 설정한 모델이 종료되면(404) 후속 모델로 한 번 바꿔 다시 묻고, 이후 요청도
 * 그 모델을 씁니다 — 배포 설정을 바꾸기 전까지 모든 AI 요청이 실패하는 일을 막습니다.
 */
let activeGeminiModel = GEMINI_MODEL;

async function geminiResponse(payload, uid, { feature, dailyLimit }) {
  if (!GEMINI_API_KEY) {
    throw new ApiError(503, "AI_NOT_CONFIGURED", "AI 기능에 필요한 Gemini API 키가 아직 연결되지 않았습니다.");
  }
  const quota = await consumeDailyQuota(uid, feature, dailyLimit);
  const ask = (model) =>
    generateGeminiContent({
      apiKey: GEMINI_API_KEY,
      model,
      baseUrl: GEMINI_API_BASE_URL,
      ...payload,
    });
  try {
    try {
      return { body: await ask(activeGeminiModel), quota };
    } catch (error) {
      const successor = MODEL_SUCCESSORS[activeGeminiModel];
      if (!(error instanceof GeminiProviderError) || !error.modelUnavailable || !successor) throw error;
      console.warn(`Gemini model ${activeGeminiModel} is unavailable; switching to ${successor}. Update GEMINI_MODEL.`);
      activeGeminiModel = successor;
      return { body: await ask(activeGeminiModel), quota };
    }
  } catch (error) {
    if (error instanceof GeminiProviderError) {
      if (error.status === 429 || error.status >= 500) await refundDailyQuota(uid, feature);
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

const authTokenLimiter = createFixedWindowLimiter();
const authUidLimiter = createFixedWindowLimiter();
const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;
const AUTH_TOKEN_LOCAL_LIMIT = 5;

function authRateKey(scope, value) {
  /* token/uid 원문을 메모리나 Firestore key로 남기지 않도록 서버 비밀을 키로 한
     HMAC을 씁니다. 저장되는 값은 이 64자 fingerprint뿐입니다. */
  return crypto.createHmac("sha256", PROXY_SHARED_SECRET).update(`${scope}:${value}`).digest("hex");
}

function rateLimitError(expireAtMillis) {
  return new ApiError(429, "RATE_LIMITED", "로그인 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", {
    retryAt: Number.isFinite(expireAtMillis) ? new Date(expireAtMillis).toISOString() : undefined,
  });
}

/** Cloud Run 인스턴스 전체가 공유하는 Firestore 고정 구간 카운터입니다. */
async function enforceDistributedAuthLimit(keyHash, limit) {
  const reference = db.collection("_authRateLimits").doc(keyHash);
  const timestamp = Date.now();
  const outcome = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const next = nextFixedWindowBucket(snapshot.exists ? snapshot.data() : null, {
      timestamp,
      windowMs: AUTH_RATE_WINDOW_MS,
      limit,
    });
    if (next.allowed) {
      transaction.set(reference, {
        keyHash,
        count: next.count,
        /* Firestore TTL 정책이 바로 사용할 수 있는 Timestamp 형식으로 저장됩니다. */
        expireAt: new Date(next.expireAtMillis),
        updatedAt: new Date(timestamp),
      });
    }
    return next;
  });
  if (!outcome.allowed) throw rateLimitError(outcome.expireAtMillis);
}

function authRateLimit(req, _res, next) {
  /* Sites -> Cloud Run relay에서는 많은 사용자가 같은 egress IP를 공유합니다.
     검증 전에는 raw token 자체를 보관하지 않고 HMAC fingerprint별로만 작게
     제한합니다. 임의의 invalid token으로 Firestore 문서를 만들지는 않습니다. */
  const rawToken = typeof req.body?.idToken === "string" ? req.body.idToken : "";
  const key = authRateKey("token", rawToken);
  if (!authTokenLimiter.take(key, AUTH_TOKEN_LOCAL_LIMIT)) {
    next(rateLimitError());
    return;
  }
  next();
}

async function enforceVerifiedAuthLimit(uid) {
  const key = authRateKey("uid", uid);
  if (!authUidLimiter.take(key, 30)) {
    throw rateLimitError();
  }
  await enforceDistributedAuthLimit(key, 30);
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

/**
 * 본문 크기 제한.
 *
 * 글·메시지는 몇 KB 면 충분해서 64KB 로 좁게 잡습니다. 사진·음성을 붙일 수 있는
 * 길만 넓힙니다 — 전부 넓히면 아무 데나 큰 본문을 밀어넣을 수 있습니다.
 * (저장소 버킷이 생겨 파일을 따로 올리게 되면 이 예외는 없어집니다.)
 */
const ATTACHMENT_ROUTES = [
  "/api/posts",
  "/api/messages",
  "/api/profile",
  /^\/api\/conversations\/[^/]+\/messages$/,
  /^\/api\/homes\/[^/]+\/photos\/[^/]+$/,
];
app.use((req, res, next) => {
  const carriesFile = ATTACHMENT_ROUTES.some((route) =>
    typeof route === "string" ? req.path === route : route.test(req.path),
  );
  return carriesFile
    ? express.json({ limit: "1mb", type: "application/json" })(req, res, next)
    : express.json({ limit: "64kb", type: "application/json" })(req, res, next);
});

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
      model: activeGeminiModel,
    },
  });
});

app.get("/api/auth/config", async (req, res) => {
  res.set("cache-control", "no-store");
  return success(res, req, {
    firebase: {
      apiKey: IDENTITY_WEB_API_KEY,
      authDomain: FIREBASE_AUTH_DOMAIN,
      projectId: PROJECT_ID,
    },
    providers: {
      google: GOOGLE_AUTH_ENABLED,
      apple: APPLE_AUTH_ENABLED,
    },
    googleWebClientId: GOOGLE_AUTH_ENABLED ? GOOGLE_WEB_CLIENT_ID : "",
    authEmulatorHost: AUTH_EMULATOR_HOST,
  });
});

app.post("/api/auth/session", authRateLimit, async (req, res) => {
  const idToken = safeSecret(req.body?.idToken, "idToken", { min: 20, max: 8192 });
  const decoded = await verifyRecentIdToken(idToken);
  await enforceVerifiedAuthLimit(decoded.uid);
  const userRecord = await auth.getUser(decoded.uid);
  if (userRecord.disabled) {
    throw new ApiError(403, "ACCOUNT_DISABLED", "비활성화된 계정입니다.");
  }
  const profile = await ensureProfile(decoded.uid, userRecord.email, userRecord.displayName);
  if (profile.accountStatus !== "active") {
    throw new ApiError(403, "ACCOUNT_RESTRICTED", "사용이 제한된 계정입니다.");
  }
  await issueSession(res, idToken, decoded);
  return success(res, req, {
    user: {
      ...publicProfile(profile),
      email: userRecord.email || "",
      emailVerified: userRecord.emailVerified,
    },
    isAdmin: ADMIN_UIDS.has(decoded.uid),
  });
});

app.get("/api/auth/me", requireUser, async (req, res) => {
  return success(res, req, {
    user: {
      ...publicProfile(req.auth.profile),
      email: req.auth.email,
      emailVerified: req.auth.emailVerified,
    },
    // 새 앱이 "나" 화면에 신고 검토를 보일지 정합니다(옛 웹·앱은 /api/bootstrap 의 같은 값을 씁니다).
    isAdmin: ADMIN_UIDS.has(req.auth.uid),
  });
});

app.post("/api/auth/logout", async (req, res) => {
  clearSessionCookie(res);
  return success(res, req, { signedOut: true });
});

app.get("/api/languages", async (req, res) => success(res, req, LANGUAGES));

app.get("/api/countries", async (req, res) => success(res, req, COUNTRIES));

app.get("/api/bootstrap", requireUser, async (req, res) => {
  await db.collection("profiles").doc(req.auth.uid).update({ lastActiveAt: nowIso() });
  const profile = { ...req.auth.profile, lastActiveAt: nowIso() };
  const notifications = await unreadNotificationCount(req.auth.uid);
  return success(res, req, {
    currentUser: publicProfile(profile),
    languages: LANGUAGES,
    countries: COUNTRIES,
    unread: { conversations: 0, notifications, requests: 0 },
    isAdmin: ADMIN_UIDS.has(req.auth.uid),
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

app.get("/api/notifications", requireUser, async (req, res) => {
  const [snapshot, blocked] = await Promise.all([
    notificationItems(req.auth.uid).orderBy("createdAt", "desc").limit(100).get(),
    blockedBothWays(req.auth.uid),
  ]);
  const rows = snapshot.docs
    .map((document) => {
      const notification = document.data();
      return { ...notification, eventId: notificationEventIdentity(notification) };
    })
    .filter((notification) => NOTIFICATION_TYPES.has(notification.type) && !blocked.has(notification.actorId));
  const actors = await profilesByIds(rows.map((notification) => notification.actorId));
  const items = rows.map((notification) => ({
    ...notification,
    actor: actors.get(notification.actorId) ? profileForOthers(actors.get(notification.actorId)) : null,
  }));
  return success(
    res,
    req,
    {
      items,
      unreadCount: items.filter((notification) => !notification.readAt).length,
    },
    200,
    { pagination: { total: items.length, nextCursor: null } },
  );
});

app.patch("/api/notifications/:notificationId/read", requireUser, async (req, res) => {
  const notificationId = docId(req.params.notificationId, "notificationId", { min: 40, max: 40 });
  const expectedEventId = safeString(req.body?.eventId, "eventId", { min: 1, max: 128 });
  const reference = notificationItems(req.auth.uid).doc(notificationId);
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new ApiError(404, "NOTIFICATION_NOT_FOUND", "알림을 찾을 수 없습니다.");
    const notification = snapshot.data();
    /* 대화 알림은 같은 문서를 최신 메시지로 갱신합니다. 화면이 본 이벤트와 지금
       문서의 이벤트가 다르면, 새 메시지까지 읽었다고 표시하지 않습니다. */
    if (!matchesNotificationEvent(notification, expectedEventId)) {
      return { id: notificationId, readAt: notification.readAt || null, stale: true };
    }
    const readAt = notification.readAt || nowIso();
    if (!notification.readAt) transaction.update(reference, { readAt });
    return { id: notificationId, readAt, stale: false };
  });
  return success(res, req, result);
});

app.post("/api/notifications/read-all", requireUser, async (req, res) => {
  const readAt = nowIso();
  /* 요청이 시작할 때 보였던 최대 2,000개 이벤트만 고정합니다. 이후 같은
     deterministic 문서 id에 새 이벤트가 덮여도 eventId가 다르면 건너뜁니다. */
  const snapshot = await notificationItems(req.auth.uid).where("readAt", "==", null).limit(2000).get();
  const candidates = snapshot.docs.map((document) => ({
    reference: document.ref,
    eventId: notificationEventIdentity(document.data()),
  }));
  let updated = 0;
  for (let start = 0; start < candidates.length; start += 100) {
    const page = candidates.slice(start, start + 100);
    updated += await db.runTransaction(async (transaction) => {
      const currentSnapshots = await transaction.getAll(...page.map((candidate) => candidate.reference));
      let pageUpdated = 0;
      currentSnapshots.forEach((current, index) => {
        if (!current.exists) return;
        const notification = current.data();
        if (notification.readAt || !matchesNotificationEvent(notification, page[index].eventId)) return;
        transaction.update(current.ref, { readAt });
        pageUpdated += 1;
      });
      return pageUpdated;
    });
  }
  const remaining = await notificationItems(req.auth.uid).where("readAt", "==", null).limit(1).get();
  const hasMore = !remaining.empty;
  return success(res, req, { updated, readAt, hasMore });
});

registerHomeRoutes(app, { db, requireUser, success, ApiError, assertNotBlockedInTransaction, profileForOthers, putNotification, removeNotification, nowIso, todayInSeoul });
// DELETE /api/account — 계정 삭제(탈퇴). 순서와 보증은 account-deletion.mjs 에 적어 두었습니다.
registerAccountRoutes(app, { db, auth, requireUser, success, ApiError, clearSessionCookie, nowIso });
// POST·DELETE /api/push/devices — 이 기기에서 폰 알림 받기·끄기(push.mjs)
registerPushRoutes(app, { db, requireUser, success, ApiError, nowIso });
const deliverPush = createPushDelivery({ db, url: EXPO_PUSH_ENDPOINT, accessToken: EXPO_ACCESS_TOKEN });

app.patch("/api/profile/room", requireUser, async (req, res) => {
  if (!req.body || Object.keys(req.body).length !== 1 || !Object.hasOwn(req.body, "config")) {
    throw new ApiError(422, "VALIDATION_ERROR", "방 설정 형식을 확인해 주세요.");
  }
  let roomConfig;
  try { roomConfig = validateRoomConfig(req.body.config); }
  catch (error) {
    if (error instanceof RoomValidationError) throw new ApiError(422, "VALIDATION_ERROR", error.message);
    throw error;
  }
  const patch = { roomConfig, updatedAt: nowIso() };
  await db.collection("profiles").doc(req.auth.uid).update(patch);
  return success(res, req, {
    ...publicProfile({ ...req.auth.profile, ...patch }),
    email: req.auth.email,
    emailVerified: req.auth.emailVerified,
  });
});

app.patch("/api/profile/avatar", requireUser, async (req, res) => {
  const current = req.auth.profile;
  let normalized;
  try {
    normalized = normalizeAvatarPatch(req.body, current);
  } catch (error) {
    if (error instanceof AvatarValidationError) {
      throw new ApiError(422, "VALIDATION_ERROR", error.message, { field: error.field });
    }
    throw error;
  }
  const patch = {
    avatarMode: normalized.avatarMode,
    avatarConfig: normalized.avatarConfig,
    updatedAt: nowIso(),
  };
  await db.collection("profiles").doc(req.auth.uid).update(patch);
  return success(res, req, {
    ...publicProfile({ ...current, ...patch }),
    email: req.auth.email,
    emailVerified: req.auth.emailVerified,
  });
});

app.patch("/api/profile", requireUser, async (req, res) => {
  const current = req.auth.profile;
  const body = req.body || {};
  const allowedGenders = ["unspecified", "woman", "man", "nonbinary"];
  if (body.gender !== undefined && !allowedGenders.includes(body.gender)) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 성별 값입니다.", { field: "gender" });
  }
  /* 요청에 들어온 필드만 씁니다. 예전에는 읽어 둔 프로필 전체를 다시 써서, 겹친 두 PATCH
     (위치 숨기기 토글과 프로필 저장)가 서로의 변경을 되돌릴 수 있었습니다. */
  const patch = {};
  if (body.name !== undefined) patch.name = safeString(body.name, "name", { min: 2, max: 40 });
  if (body.bio !== undefined) patch.bio = safeString(body.bio, "bio", { min: 0, max: 500 });
  if (body.city !== undefined) patch.city = safeString(body.city, "city", { min: 0, max: 80 });
  // 국가는 목록에 있는 코드만 받습니다 — 이름·국기를 사용자가 정하게 두면
  // 매칭의 preferredCountries 와 어긋나고 아무 문자열이나 들어옵니다.
  if (body.countryCode !== undefined) patch.country = countryFromCode(body.countryCode, current.country);
  if (body.nativeLanguages !== undefined) {
    patch.nativeLanguages = stringArray(body.nativeLanguages, "nativeLanguages", [], 3, 10).map((code) =>
      supportedLanguageCode(code, "nativeLanguages"),
    );
  }
  const requestedLearning = Array.isArray(body.learningLanguages)
    ? body.learningLanguages.slice(0, 3).map((item) => {
        // 공백뿐인 목표는 비운 것으로 보고 기본값을 씁니다.
        const goal = typeof item?.goal === "string" ? item.goal.trim() : item?.goal;
        return {
          code: supportedLanguageCode(
            safeString(item?.code, "learningLanguages.code", { min: 2, max: 10 }),
            "learningLanguages.code",
          ),
          level: LEARNING_LEVELS.includes(item?.level) ? item.level : "beginner",
          goal: safeString(goal || "일상 대화", "learningLanguages.goal", { min: 2, max: 120 }),
        };
      })
    : undefined;
  if (patch.nativeLanguages || requestedLearning) {
    // 모국어와 겹치거나 같은 코드가 두 번 나온 학습 언어는 뺍니다(먼저 나온 것을 남깁니다).
    const currentLearning = current.learningLanguages || [];
    const seen = new Set(patch.nativeLanguages ?? current.nativeLanguages ?? []);
    const learningLanguages = (requestedLearning ?? currentLearning).filter((item) => {
      if (!item?.code || seen.has(item.code)) return false;
      seen.add(item.code);
      return true;
    });
    if (requestedLearning || learningLanguages.length !== currentLearning.length) {
      patch.learningLanguages = learningLanguages;
    }
  }
  if (body.interests !== undefined) patch.interests = stringArray(body.interests, "interests", [], 12, 40);
  if (body.availability !== undefined) patch.availability = stringArray(body.availability, "availability", [], 4, 32);
  if (body.intents !== undefined) patch.intents = stringArray(body.intents, "intents", [], 4, 32);
  if (body.age !== undefined) patch.age = integerInRange(body.age, "age", { min: 18, max: 100, fallback: current.age });
  if (body.gender !== undefined) patch.gender = body.gender;
  if (body.avatarUrl !== undefined) patch.avatarUrl = avatarUrlFrom(body.avatarUrl);
  if (body.hideLocation !== undefined) patch.hideLocation = optionalBoolean(body.hideLocation, "hideLocation", true);
  const merged = { ...current, ...patch };
  if (!merged.nativeLanguages?.length || !merged.learningLanguages?.length) {
    throw new ApiError(422, "VALIDATION_ERROR", "모국어와 학습 언어를 한 개 이상 선택해 주세요.");
  }
  // 첫 설정 완료. 새 계정에는 나이·국가·언어 기본값이 들어 있어서, 사용자가 직접 고른 값이
  // 이 요청에 함께 와야 마친 것으로 봅니다(기본값 그대로 추천에 나가지 않게).
  if (body.completeOnboarding !== undefined) {
    if (body.completeOnboarding !== true) {
      throw new ApiError(422, "VALIDATION_ERROR", "첫 설정 완료 값을 확인해 주세요.", { field: "completeOnboarding" });
    }
    const missing = ["age", "countryCode", "nativeLanguages", "learningLanguages"].filter((field) => body[field] === undefined);
    if (missing.length) {
      throw new ApiError(422, "VALIDATION_ERROR", "나이, 국가, 모국어와 배울 언어를 골라 주세요.", { field: missing[0] });
    }
    if (current.onboardedAt === null) patch.onboardedAt = nowIso();
  }
  patch.updatedAt = nowIso();
  await db.collection("profiles").doc(req.auth.uid).update(patch);
  return success(res, req, { ...publicProfile({ ...current, ...patch }), email: req.auth.email, emailVerified: req.auth.emailVerified });
});

app.get("/api/partners", requireUser, async (req, res) => {
  const [snapshot, blocked] = await Promise.all([
    db.collection("profiles").limit(100).get(),
    blockedBothWays(req.auth.uid),
  ]);
  const query = String(req.query.q || "").trim().toLocaleLowerCase();
  const partners = snapshot.docs
    .map((document) => document.data())
    .filter((profile) => profile.id !== req.auth.uid && isDiscoverable(profile))
    .filter((profile) => !blocked.has(profile.id))
    .filter((profile) => {
      if (!query) return true;
      return [profile.name, profile.handle, profile.bio, ...(profile.interests || [])]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query);
    })
    .map(profileForOthers);
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
    const [profileMap, blockedNow] = await Promise.all([
      profilesByIds((stored.recommendations || []).map((item) => item.partnerId)),
      blockedBothWays(req.auth.uid),
    ]);
    const recommendations = (stored.recommendations || [])
      .filter((item) => isDiscoverable(profileMap.get(item.partnerId)))
      .filter((item) => !blockedNow.has(item.partnerId))
      .map((item) => ({ ...item, partner: profileForOthers(profileMap.get(item.partnerId)) }));
    return success(res, req, {
      date,
      recommendations,
      preferencesApplied: preferences,
      nextRefreshAt: nextRefreshAt(date),
      discovery: { includedToday: recommendations.length, exactMatchCount: recommendations.filter((item) => item.meetsAllPreferences).length },
    });
  }

  const [snapshot, blocked] = await Promise.all([
    db.collection("profiles").limit(200).get(),
    blockedBothWays(req.auth.uid),
  ]);
  const candidates = snapshot.docs
    .map((document) => document.data())
    .filter((profile) => profile.id !== req.auth.uid && isDiscoverable(profile))
    .filter((profile) => !blocked.has(profile.id))
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

app.get("/api/blocks", requireUser, async (req, res) => {
  const snapshot = await db.collection("blocks").where("blockerId", "==", req.auth.uid).limit(200).get();
  const rows = snapshot.docs.map((document) => document.data());
  const profiles = await profilesByIds(rows.map((row) => row.blockedId));
  const blocked = rows
    .map((row) => ({ ...row, partner: profiles.get(row.blockedId) ? profileForOthers(profiles.get(row.blockedId)) : null }))
    .filter((row) => row.partner)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  return success(res, req, blocked, 200, { pagination: { total: blocked.length, nextCursor: null } });
});

app.post("/api/partners/:partnerId/block", requireUser, async (req, res) => {
  const partnerId = docId(req.params.partnerId, "partnerId");
  if (partnerId === req.auth.uid) throw new ApiError(422, "INVALID_PARTNER", "본인을 차단할 수 없습니다.");
  const partnerSnapshot = await db.collection("profiles").doc(partnerId).get();
  if (!partnerSnapshot.exists) throw new ApiError(404, "PARTNER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
  const id = blockId(req.auth.uid, partnerId);
  const reference = db.collection("blocks").doc(id);
  const created = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (snapshot.exists) {
      /* 이전 cleanup이 실패했어도 같은 요청을 다시 보내면 끝까지 복구합니다. */
      transaction.update(reference, { cleanupComplete: false });
      return false;
    }
    transaction.create(reference, {
      id,
      blockerId: req.auth.uid,
      blockedId: partnerId,
      createdAt: nowIso(),
      cleanupComplete: false,
    });
    return true;
  });
  // block을 먼저 확정해야 그 뒤 시작되는 모든 producer transaction이 거절됩니다.
  await cleanupBlockedPair(reference, req.auth.uid, partnerId);
  return success(res, req, { blockedId: partnerId, blocked: true }, created ? 201 : 200);
});

app.delete("/api/partners/:partnerId/block", requireUser, async (req, res) => {
  const partnerId = docId(req.params.partnerId, "partnerId");
  const reference = db.collection("blocks").doc(blockId(req.auth.uid, partnerId));
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new ApiError(404, "BLOCK_NOT_FOUND", "차단하지 않은 사용자입니다.");
    if (snapshot.data()?.cleanupComplete === false) {
      throw new ApiError(409, "BLOCK_CLEANUP_PENDING", "차단 정보를 정리하고 있습니다. 잠시 후 다시 시도해 주세요.");
    }
    transaction.delete(reference);
  });
  return success(res, req, { blockedId: partnerId, blocked: false });
});

app.post("/api/partners/:partnerId/like", requireUser, async (req, res) => {
  const partnerId = docId(req.params.partnerId, "partnerId");
  if (partnerId === req.auth.uid) throw new ApiError(422, "INVALID_PARTNER", "본인에게 마음을 보낼 수 없습니다.");
  const partnerSnapshot = await db.collection("profiles").doc(partnerId).get();
  if (!partnerSnapshot.exists || partnerSnapshot.data()?.accountStatus !== "active") {
    throw new ApiError(404, "PARTNER_NOT_FOUND", "파트너를 찾을 수 없습니다.");
  }
  if (await isBlockedBetween(req.auth.uid, partnerId)) {
    throw new ApiError(403, "PARTNER_BLOCKED", "차단된 상대에게는 마음을 보낼 수 없습니다.");
  }
  const timestamp = nowIso();
  const notificationEventId = crypto.randomUUID();
  const reference = db.collection("likes").doc(req.auth.uid + "_" + partnerId);
  const reverseReference = db.collection("likes").doc(partnerId + "_" + req.auth.uid);
  const result = await db.runTransaction(async (transaction) => {
    const [existing, reverse, quotaSnapshot] = await Promise.all([
      transaction.get(reference),
      transaction.get(reverseReference),
      transaction.get(writeQuotaReference(req.auth.uid)),
    ]);
    await assertNotBlockedInTransaction(transaction, req.auth.uid, [partnerId], {
      message: "차단된 상대에게는 마음을 보낼 수 없습니다.",
    });
    if (!existing.exists) {
      takeWriteQuota(transaction, quotaSnapshot, "reactions");
      transaction.create(reference, {
        fromUserId: req.auth.uid,
        toUserId: partnerId,
        createdAt: timestamp,
      });
      putNotification(transaction, {
        type: "partner_like",
        recipientId: partnerId,
        actorId: req.auth.uid,
        sourceId: partnerId,
        eventId: notificationEventId,
        createdAt: timestamp,
      });
    }
    return { created: !existing.exists, mutual: reverse.exists };
  });
  return success(
    res,
    req,
    { liked: true, mutual: result.mutual, partner: profileForOthers(partnerSnapshot.data()) },
    result.created ? 201 : 200,
  );
});

app.post("/api/partners/:partnerId/follow", requireUser, async (req, res) => {
  const partnerId = docId(req.params.partnerId, "partnerId");
  if (partnerId === req.auth.uid) throw new ApiError(422, "INVALID_PARTNER", "본인을 팔로우할 수 없습니다.");
  const partnerSnapshot = await db.collection("profiles").doc(partnerId).get();
  if (!partnerSnapshot.exists || partnerSnapshot.data()?.accountStatus !== "active") {
    throw new ApiError(404, "PARTNER_NOT_FOUND", "파트너를 찾을 수 없습니다.");
  }
  if (await isBlockedBetween(req.auth.uid, partnerId)) {
    throw new ApiError(403, "PARTNER_BLOCKED", "차단된 상대를 팔로우할 수 없습니다.");
  }
  const reference = db.collection("follows").doc(req.auth.uid + "_" + partnerId);
  const timestamp = nowIso();
  const notificationEventId = crypto.randomUUID();
  const requestedFollowing = req.body?.following === undefined
    ? null
    : optionalBoolean(req.body.following, "following", false);
  const following = await db.runTransaction(async (transaction) => {
    const [snapshot, quotaSnapshot] = await Promise.all([
      transaction.get(reference),
      transaction.get(writeQuotaReference(req.auth.uid)),
    ]);
    await assertNotBlockedInTransaction(transaction, req.auth.uid, [partnerId], {
      message: "차단된 상대를 팔로우할 수 없습니다.",
    });
    const next = requestedFollowing ?? !snapshot.exists;
    if (next === snapshot.exists) return next;
    takeWriteQuota(transaction, quotaSnapshot, "follows");
    if (next) {
      transaction.create(reference, { fromUserId: req.auth.uid, toUserId: partnerId, createdAt: timestamp });
      putNotification(transaction, {
        type: "follow",
        recipientId: partnerId,
        actorId: req.auth.uid,
        sourceId: partnerId,
        eventId: notificationEventId,
        createdAt: timestamp,
      });
    } else {
      transaction.delete(reference);
      removeNotification(transaction, {
        type: "follow",
        recipientId: partnerId,
        actorId: req.auth.uid,
        sourceId: partnerId,
      });
    }
    return next;
  });
  const reverse = await db.collection("follows").doc(partnerId + "_" + req.auth.uid).get();
  return success(res, req, { following, mutual: following && reverse.exists, partner: profileForOthers(partnerSnapshot.data()) });
});

/**
 * 팔로우 수. 내 프로필과 상대 프로필 양쪽에서 씁니다.
 * 차단한 사이는 서로 세지 않습니다 — 화면에서 지워진 사람이 숫자로 남으면 어색합니다.
 */
app.get("/api/partners/:partnerId/follow-counts", requireUser, async (req, res) => {
  const partnerId = docId(req.params.partnerId, "partnerId");
  const follows = db.collection("follows");
  const partnerPosts = db.collection("posts").where("authorId", "==", partnerId);
  /* 문서를 최대 500개씩 읽어 세던 것을 count() 집계로 바꿨습니다. 색인 1,000건당 읽기 1회로
     과금되고, 500에서 잘리지도 않습니다. */
  const [followingCount, followerCount, blocked, partnerIds] = await Promise.all([
    follows.where("fromUserId", "==", partnerId).count().get(),
    follows.where("toUserId", "==", partnerId).count().get(),
    blockedBothWays(req.auth.uid),
    acceptedPartnerIds(req.auth.uid),
  ]);
  // 나와 차단 관계인 사람과의 팔로우는 빼고 셉니다. 팔로우 문서 id 가 "보낸사람_받는사람" 이라
  // 그 사람들 몫만 직접 읽어 빼면 됩니다(보통 0~몇 건).
  const blockedIds = [...blocked].filter((id) => id !== partnerId && isDocumentId(id, { min: 1 }));
  // 글 수는 "내가 볼 수 있는 글"만 셉니다. 파트너 공개 글까지 세면 열 수 없는
  // 글이 숫자에만 남아 목록과 어긋납니다.
  const seesEveryPost = partnerId === req.auth.uid || partnerIds.has(partnerId);
  const [postCount, blockedEdges] = await Promise.all([
    (seesEveryPost ? partnerPosts : partnerPosts.where("visibility", "==", "public")).count().get(),
    blockedIds.length
      ? db.getAll(...blockedIds.flatMap((id) => [follows.doc(partnerId + "_" + id), follows.doc(id + "_" + partnerId)]))
      : Promise.resolve([]),
  ]);
  const hiddenFollowing = blockedEdges.filter((snapshot, index) => index % 2 === 0 && snapshot.exists).length;
  const hiddenFollowers = blockedEdges.filter((snapshot, index) => index % 2 === 1 && snapshot.exists).length;
  return success(res, req, {
    following: Math.max(0, followingCount.data().count - hiddenFollowing),
    followers: Math.max(0, followerCount.data().count - hiddenFollowers),
    posts: postCount.data().count,
  });
});

/**
 * 한 사람의 프로필. 앱이 한 사람을 보여주려고 명부(/api/partners) 100명을 받아 뒤지지 않게 합니다.
 * 없는 사람, 활동 중이 아닌 사람, 어느 쪽으로든 차단한 사이는 모두 같은 404 입니다 — 차단 여부를
 * 드러내지 않습니다. 경로 조각이 하나라서 /api/partners/:partnerId/... 경로와 겹치지 않습니다.
 */
app.get("/api/partners/:partnerId", requireUser, async (req, res) => {
  const partnerId = docId(req.params.partnerId, "partnerId");
  const [snapshot, blocked] = await Promise.all([
    db.collection("profiles").doc(partnerId).get(),
    isBlockedBetween(req.auth.uid, partnerId),
  ]);
  if (!snapshot.exists || snapshot.data()?.accountStatus !== "active" || blocked) {
    throw new ApiError(404, "PARTNER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
  }
  return success(res, req, profileForOthers(snapshot.data()));
});

/**
 * 글에 굳혀 둔 작성자 정보 위에 지금 프로필을 덮습니다 — 이름·국가·언어를 바꾸면
 * 옛 글에도 반영됩니다. 프로필이 없으면 글에 남은 이름을 그대로 씁니다.
 */
function postAuthorView(post, author) {
  return {
    ...post.author,
    ...(author ? { name: author.name, handle: author.handle, flag: author.country?.flag || "🌐" } : {}),
    ...avatarPresentation(author),
    countryCode: author?.country?.code || "",
    age: author?.age || 0,
    gender: author?.gender || "unspecified",
    native: author?.nativeLanguages?.[0] || "",
    learning: author?.learningLanguages?.[0]
      ? { code: author.learningLanguages[0].code, level: author.learningLanguages[0].level }
      : null,
  };
}

app.get("/api/posts", requireUser, async (req, res) => {
  const [snapshot, partnerIds, blocked] = await Promise.all([
    db.collection("posts").orderBy("createdAt", "desc").limit(100).get(),
    acceptedPartnerIds(req.auth.uid),
    blockedBothWays(req.auth.uid),
  ]);
  const posts = snapshot.docs
    .map((document) => document.data())
    .filter((post) => !blocked.has(post.authorId))
    .filter(
      (post) =>
        post.visibility === "public" ||
        post.authorId === req.auth.uid ||
        (post.visibility === "partners" && partnerIds.has(post.authorId)),
    )
    .slice(0, 50);
  // 내가 이 글에 좋아요를 눌렀는지. 이 값이 없으면 새로고침할 때마다 하트가 풀립니다.
  const reactions = await Promise.all(
    posts.map((post) => db.collection("posts").doc(post.id).collection("reactions").doc(req.auth.uid).get()),
  );
  const authors = await profilesByIds(posts.map((post) => post.authorId));
  const withReactions = posts.map((post, index) => ({
    ...post,
    liked: reactions[index].exists,
    // 글마다 굳히지 않고 지금 프로필을 씁니다 — 언어를 바꾸면 옛 글에도 반영됩니다.
    author: postAuthorView(post, authors.get(post.authorId)),
  }));
  return success(res, req, withReactions, 200, { pagination: { total: posts.length, nextCursor: null } });
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
      ...avatarPresentation(req.auth.profile),
      countryCode: req.auth.profile.country?.code || "",
      age: req.auth.profile.age || 0,
      gender: req.auth.profile.gender || "unspecified",
      native: req.auth.profile.nativeLanguages?.[0] || "",
      learning: req.auth.profile.learningLanguages?.[0]
        ? { code: req.auth.profile.learningLanguages[0].code, level: req.auth.profile.learningLanguages[0].level }
        : null,
    },
    text,
    language: optionalString(req.body?.language, "language", 10) || req.auth.profile.learningLanguages?.[0]?.code || "en",
    targetLanguage: optionalString(req.body?.targetLanguage, "targetLanguage", 10) || req.auth.profile.nativeLanguages?.[0] || "ko",
    tags,
    visibility,
    requestCorrection: optionalBoolean(req.body?.requestCorrection, "requestCorrection", false),
    // 기기에서 만든 데이터 URI 만 받습니다 — 외부 주소는 글을 본 사람의 IP 를 그 서버에 남깁니다.
    imageUrl: mediaDataUri(req.body?.imageUrl, "imageUrl", "image"),
    audioUrl: mediaDataUri(req.body?.audioUrl, "audioUrl", "audio"),
    likes: 0,
    comments: 0,
    corrections: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.runTransaction(async (transaction) => {
    const quotaSnapshot = await transaction.get(writeQuotaReference(req.auth.uid));
    takeWriteQuota(transaction, quotaSnapshot, "posts");
    transaction.create(db.collection("posts").doc(post.id), post);
  });
  return success(res, req, post, 201);
});

/**
 * 내 글 삭제. 남의 글은 지울 수 없으므로 작성자를 서버에서 확인합니다
 * (화면이 메뉴를 숨기는 것만으로는 권한이 되지 않습니다).
 * 좋아요(reactions)와 댓글·교정(replies) 하위 컬렉션도 함께 지워 고아 문서를 남기지 않습니다.
 * 예전에는 좋아요만 지워서, 지운 글의 댓글이 주인 없이 남았습니다.
 */
app.delete("/api/posts/:postId", requireUser, async (req, res) => {
  const postId = docId(req.params.postId, "postId");
  const postReference = db.collection("posts").doc(postId);
  const snapshot = await postReference.get();
  if (!snapshot.exists) throw new ApiError(404, "POST_NOT_FOUND", "게시물을 찾을 수 없습니다.");
  if (snapshot.data().authorId !== req.auth.uid) {
    throw new ApiError(403, "POST_FORBIDDEN", "내가 쓴 글만 삭제할 수 있습니다.");
  }
  await db.recursiveDelete(postReference);
  return success(res, req, { id: postId, deleted: true });
});

/** 글을 읽을 수 있는 사람인지. 댓글·교정도 같은 기준을 씁니다. */
async function readablePost(postId, uid) {
  const snapshot = await db.collection("posts").doc(postId).get();
  if (!snapshot.exists) throw new ApiError(404, "POST_NOT_FOUND", "게시물을 찾을 수 없습니다.");
  const post = snapshot.data();
  const [partnerIds, blocked] = await Promise.all([acceptedPartnerIds(uid), blockedBothWays(uid)]);
  const readable =
    !blocked.has(post.authorId) &&
    (post.visibility === "public" || post.authorId === uid || (post.visibility === "partners" && partnerIds.has(post.authorId)));
  if (!readable) throw new ApiError(404, "POST_NOT_FOUND", "게시물을 찾을 수 없습니다.");
  return post;
}

app.get("/api/posts/:postId", requireUser, async (req, res) => {
  const postId = docId(req.params.postId, "postId");
  const post = await readablePost(postId, req.auth.uid);
  const [reaction, authorSnapshot] = await Promise.all([
    db.collection("posts").doc(postId).collection("reactions").doc(req.auth.uid).get(),
    db.collection("profiles").doc(post.authorId).get(),
  ]);
  const author = authorSnapshot.exists ? authorSnapshot.data() : null;
  return success(res, req, {
    ...post,
    liked: reaction.exists,
    author: postAuthorView(post, author),
  });
});

/**
 * 댓글과 교정.
 *
 * 한 컬렉션에 kind 로 구분해 담습니다 — 화면에서 둘은 같은 자리에 시간순으로
 * 섞여 나오고, 교정은 "원문을 함께 든 댓글"이기 때문입니다. 따로 두면 합쳐서
 * 정렬하는 일을 매번 해야 합니다.
 */
app.get("/api/posts/:postId/replies", requireUser, async (req, res) => {
  const postId = docId(req.params.postId, "postId");
  await readablePost(postId, req.auth.uid);
  const [snapshot, blocked] = await Promise.all([
    db.collection("posts").doc(postId).collection("replies").orderBy("createdAt", "asc").limit(200).get(),
    blockedBothWays(req.auth.uid),
  ]);
  const rows = snapshot.docs.map((document) => document.data()).filter((row) => !blocked.has(row.authorId));
  const profiles = await profilesByIds(rows.map((row) => row.authorId));
  return success(
    res,
    req,
    rows.map((row) => ({
      ...row,
      author: profiles.get(row.authorId)
        ? {
            id: row.authorId,
            name: profiles.get(row.authorId).name,
            handle: profiles.get(row.authorId).handle,
            flag: profiles.get(row.authorId).country?.flag || "🌐",
            ...avatarPresentation(profiles.get(row.authorId)),
            countryCode: profiles.get(row.authorId).country?.code || "",
          }
        : { id: row.authorId, name: null, handle: null, flag: "🌐", ...avatarPresentation(null) },
    })),
    200,
    { pagination: { total: rows.length, nextCursor: null } },
  );
});

app.post("/api/posts/:postId/replies", requireUser, async (req, res) => {
  const postId = docId(req.params.postId, "postId");
  await readablePost(postId, req.auth.uid);
  const text = safeString(req.body?.text, "text", { min: 1, max: 1000 });
  const kind = req.body?.kind === "correction" ? "correction" : "reply";
  // 교정은 어느 문장을 고쳤는지 있어야 의미가 있습니다.
  const original = kind === "correction" ? safeString(req.body?.original, "original", { min: 1, max: 1000 }) : "";
  const parentId = optionalDocId(req.body?.parentId, "parentId");
  const timestamp = nowIso();
  const postNotificationEventId = crypto.randomUUID();
  const parentNotificationEventId = crypto.randomUUID();
  const reply = {
    id: "reply-" + crypto.randomUUID(),
    postId,
    authorId: req.auth.uid,
    text,
    kind,
    original,
    parentId,
    likes: 0,
    createdAt: timestamp,
  };
  const postReference = db.collection("posts").doc(postId);
  const parentReference = parentId ? postReference.collection("replies").doc(parentId) : null;
  // 폰 알림으로도 보낼 알림. transaction 이 다시 돌면 처음부터 다시 모읍니다.
  let pushes = [];
  await db.runTransaction(async (transaction) => {
    pushes = [];
    const [snapshot, parentSnapshot, quotaSnapshot] = await Promise.all([
      transaction.get(postReference),
      parentReference ? transaction.get(parentReference) : Promise.resolve(null),
      transaction.get(writeQuotaReference(req.auth.uid)),
    ]);
    if (!snapshot.exists) throw new ApiError(404, "POST_NOT_FOUND", "게시물을 찾을 수 없습니다.");
    if (parentReference && !parentSnapshot?.exists) {
      throw new ApiError(404, "REPLY_NOT_FOUND", "답글을 남길 댓글을 찾을 수 없습니다.");
    }
    const current = snapshot.data();
    const parentAuthorId = parentSnapshot?.data()?.authorId;
    await assertNotBlockedInTransaction(transaction, req.auth.uid, [current.authorId, parentAuthorId], {
      status: 404,
      code: "POST_NOT_FOUND",
      message: "게시물을 찾을 수 없습니다.",
    });
    takeWriteQuota(transaction, quotaSnapshot, "replies");
    transaction.create(postReference.collection("replies").doc(reply.id), reply);
    transaction.update(postReference, {
      comments: kind === "reply" ? (current.comments || 0) + 1 : current.comments || 0,
      corrections: kind === "correction" ? (current.corrections || 0) + 1 : current.corrections || 0,
      updatedAt: timestamp,
    });
    const postNotification = putNotification(transaction, {
      type: kind === "correction" ? "post_correction" : "post_reply",
      recipientId: current.authorId,
      actorId: req.auth.uid,
      sourceId: reply.id,
      postId,
      replyId: reply.id,
      eventId: postNotificationEventId,
      excerpt: text,
      createdAt: timestamp,
    });
    if (postNotification) pushes.push({ notification: postNotification });
    if (parentAuthorId && parentAuthorId !== current.authorId) {
      const parentNotification = putNotification(transaction, {
        type: "comment_reply",
        recipientId: parentAuthorId,
        actorId: req.auth.uid,
        sourceId: reply.id,
        postId,
        replyId: reply.id,
        eventId: parentNotificationEventId,
        excerpt: text,
        createdAt: timestamp,
      });
      if (parentNotification) pushes.push({ notification: parentNotification });
    }
  });
  await deliverPush(pushes, { actorName: req.auth.profile.name, requestId: req.requestId });
  return success(
    res,
    req,
    {
      ...reply,
      author: {
        id: req.auth.uid,
        name: req.auth.profile.name,
        handle: req.auth.profile.handle,
        flag: req.auth.profile.country?.flag || "🌐",
        ...avatarPresentation(req.auth.profile),
      },
    },
    201,
  );
});

/**
 * 받은 교정. 학습 화면이 "받은 교정" 으로 보여줍니다.
 * 내 글에 달린 교정(source: "community")과 대화에서 상대가 고쳐 준 내 메시지(source: "chat",
 * 받은 교정함 최신 200개)를 합쳐 최신순으로 돌려줍니다. 어느 쪽이든 차단 관계인 사람의 교정은 뺍니다.
 * 새 앱은 ?include=chat 을 붙여 보내지만 따로 거르지 않습니다 — 옛 웹도 대화 교정을 같은 모양
 * (고치기 전 → 고친 뒤, 보낸 사람)으로 그리고, 비어 있는 postText 는 쓰지 않습니다.
 */
app.get("/api/corrections/received", requireUser, async (req, res) => {
  const [postsSnapshot, chatSnapshot, blocked] = await Promise.all([
    db.collection("posts").where("authorId", "==", req.auth.uid).limit(100).get(),
    correctionItems(req.auth.uid).orderBy("createdAt", "desc").limit(CHAT_CORRECTIONS_LIMIT).get(),
    blockedBothWays(req.auth.uid),
  ]);
  const myPosts = postsSnapshot.docs.map((document) => document.data());
  const groups = await Promise.all(
    myPosts.map(async (post) => {
      const snapshot = await db.collection("posts").doc(post.id).collection("replies").where("kind", "==", "correction").limit(50).get();
      return snapshot.docs.map((document) => ({ ...document.data(), postText: post.text }));
    }),
  );
  const replies = groups.flat();
  const chatEntries = chatSnapshot.docs.map((document) => document.data());
  const profiles = await profilesByIds(
    [...replies.map((row) => row.authorId), ...chatEntries.map((row) => row.fromUserId)].filter((id) => !blocked.has(id)),
  );
  // 두 목록이 같은 작성자 카드를 씁니다.
  const authorCard = (author) => {
    const avatar = avatarPresentation(author);
    return {
      from: author?.name ?? null,
      fromFlag: author?.country?.flag ?? "🌐",
      fromAvatarUrl: avatar.avatarUrl,
      fromAvatarMode: avatar.avatarMode,
      fromAvatarConfig: avatar.avatarConfig,
      fromCountryCode: author?.country?.code ?? "",
    };
  };
  const corrections = receivedCorrections({
    replies,
    chatEntries,
    blocked,
    authorOf: (uid) => authorCard(profiles.get(uid)),
  });
  return success(res, req, corrections, 200, { pagination: { total: corrections.length, nextCursor: null } });
});

/** 내가 마음을 보낸 사람. 새로고침해도 "보낸 마음"이 남아야 해서 필요합니다. */
app.get("/api/likes/sent", requireUser, async (req, res) => {
  const [snapshot, blocked] = await Promise.all([
    db.collection("likes").where("fromUserId", "==", req.auth.uid).limit(200).get(),
    blockedBothWays(req.auth.uid),
  ]);
  const rows = snapshot.docs.map((document) => document.data()).filter((row) => !blocked.has(row.toUserId));
  const profiles = await profilesByIds(rows.map((row) => row.toUserId));
  const reverse = await db.collection("likes").where("toUserId", "==", req.auth.uid).limit(200).get();
  const likedMe = new Set(reverse.docs.map((document) => document.data().fromUserId));
  const sent = rows
    .filter((row) => profiles.get(row.toUserId))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .map((row) => ({
      partner: profileForOthers(profiles.get(row.toUserId)),
      createdAt: row.createdAt,
      mutual: likedMe.has(row.toUserId),
    }));
  return success(res, req, sent, 200, { pagination: { total: sent.length, nextCursor: null } });
});

/** 나에게 마음을 보낸 사람. 화면의 "받은 마음" 목록입니다. */
app.get("/api/likes/received", requireUser, async (req, res) => {
  const [snapshot, blocked] = await Promise.all([
    db.collection("likes").where("toUserId", "==", req.auth.uid).limit(200).get(),
    blockedBothWays(req.auth.uid),
  ]);
  const rows = snapshot.docs.map((document) => document.data()).filter((row) => !blocked.has(row.fromUserId));
  const profiles = await profilesByIds(rows.map((row) => row.fromUserId));
  // 내가 마음을 돌려보냈으면 서로 맞은 것입니다.
  const mine = await db.collection("likes").where("fromUserId", "==", req.auth.uid).limit(200).get();
  const sentTo = new Set(mine.docs.map((document) => document.data().toUserId));
  const received = rows
    .filter((row) => profiles.get(row.fromUserId))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .map((row) => ({
      partner: profileForOthers(profiles.get(row.fromUserId)),
      createdAt: row.createdAt,
      mutual: sentTo.has(row.fromUserId),
    }));
  return success(res, req, received, 200, { pagination: { total: received.length, nextCursor: null } });
});

/** 내가 팔로우하는 사람. 피드의 "팔로잉" 탭이 씁니다. */
app.get("/api/follows", requireUser, async (req, res) => {
  const [snapshot, blocked] = await Promise.all([
    db.collection("follows").where("fromUserId", "==", req.auth.uid).limit(200).get(),
    blockedBothWays(req.auth.uid),
  ]);
  const ids = snapshot.docs.map((document) => document.data().toUserId).filter((id) => !blocked.has(id));
  return success(res, req, ids, 200, { pagination: { total: ids.length, nextCursor: null } });
});

/**
 * 저장한 표현. 사람마다 자기 것만 봅니다.
 * 복습 화면이 여기서 읽고, 글·메시지에서 "복습에 저장" 을 누르면 여기에 쌓입니다.
 */
app.get("/api/saved-phrases", requireUser, async (req, res) => {
  const snapshot = await db.collection("savedPhrases").doc(req.auth.uid).collection("items").limit(300).get();
  const rows = snapshot.docs
    .map((document) => document.data())
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  return success(res, req, rows, 200, { pagination: { total: rows.length, nextCursor: null } });
});

app.post("/api/saved-phrases", requireUser, async (req, res) => {
  const phrase = safeString(req.body?.phrase, "phrase", { min: 1, max: 500 });
  // 예전처럼 짧은 ID 도 받습니다(아래 DELETE 와 같은 규칙).
  const id = optionalDocId(req.body?.id, "id", { min: 1 }) || "saved-" + crypto.randomUUID();
  const item = {
    id,
    phrase,
    meaning: optionalString(req.body?.meaning, "meaning", 500) || "",
    source: optionalString(req.body?.source, "source", 200) || "",
    due: optionalString(req.body?.due, "due", 100) || "",
    createdAt: nowIso(),
  };
  await db.collection("savedPhrases").doc(req.auth.uid).collection("items").doc(id).set(item);
  return success(res, req, item, 201);
});

app.delete("/api/saved-phrases/:itemId", requireUser, async (req, res) => {
  const itemId = docId(req.params.itemId, "itemId", { min: 1 });
  const reference = db.collection("savedPhrases").doc(req.auth.uid).collection("items").doc(itemId);
  const snapshot = await reference.get();
  if (!snapshot.exists) throw new ApiError(404, "SAVED_PHRASE_NOT_FOUND", "저장한 표현을 찾을 수 없습니다.");
  await reference.delete();
  return success(res, req, { id: itemId, deleted: true });
});

app.post("/api/posts/:postId/like", requireUser, async (req, res) => {
  const postId = docId(req.params.postId, "postId");
  await readablePost(postId, req.auth.uid);
  const postReference = db.collection("posts").doc(postId);
  const reactionReference = postReference.collection("reactions").doc(req.auth.uid);
  const requestedLiked = req.body?.liked === undefined ? null : optionalBoolean(req.body.liked, "liked", false);
  const notificationEventId = crypto.randomUUID();
  const result = await db.runTransaction(async (transaction) => {
    const [postSnapshot, reactionSnapshot, quotaSnapshot] = await Promise.all([
      transaction.get(postReference),
      transaction.get(reactionReference),
      transaction.get(writeQuotaReference(req.auth.uid)),
    ]);
    if (!postSnapshot.exists) throw new ApiError(404, "POST_NOT_FOUND", "게시물을 찾을 수 없습니다.");
    const post = postSnapshot.data();
    await assertNotBlockedInTransaction(transaction, req.auth.uid, [post.authorId], {
      status: 404,
      code: "POST_NOT_FOUND",
      message: "게시물을 찾을 수 없습니다.",
    });
    const liked = requestedLiked ?? !reactionSnapshot.exists;
    if (liked === reactionSnapshot.exists) {
      return { liked, likes: Math.max(0, Number(post.likes || 0)) };
    }
    takeWriteQuota(transaction, quotaSnapshot, "reactions");
    const timestamp = nowIso();
    if (liked) {
      transaction.create(reactionReference, { userId: req.auth.uid, createdAt: timestamp });
      putNotification(transaction, {
        type: "post_like",
        recipientId: post.authorId,
        actorId: req.auth.uid,
        sourceId: postId,
        postId,
        eventId: notificationEventId,
        excerpt: post.text,
        createdAt: timestamp,
      });
    } else {
      transaction.delete(reactionReference);
      removeNotification(transaction, {
        type: "post_like",
        recipientId: post.authorId,
        actorId: req.auth.uid,
        sourceId: postId,
      });
    }
    transaction.update(postReference, { likes: FieldValue.increment(liked ? 1 : -1), updatedAt: timestamp });
    return { liked, likes: Math.max(0, Number(postSnapshot.data().likes || 0) + (liked ? 1 : -1)) };
  });
  return success(res, req, result);
});

app.post("/api/conversations", requireUser, async (req, res) => {
  const partnerId = docId(req.body?.partnerId, "partnerId");
  if (partnerId === req.auth.uid) throw new ApiError(422, "INVALID_PARTNER", "본인과 대화할 수 없습니다.");
  const partnerSnapshot = await db.collection("profiles").doc(partnerId).get();
  if (!partnerSnapshot.exists || partnerSnapshot.data()?.accountStatus !== "active") {
    throw new ApiError(404, "PARTNER_NOT_FOUND", "대화 상대를 찾을 수 없습니다.");
  }
  // 차단한 쪽도, 차단당한 쪽도 새 대화를 열 수 없습니다.
  if (await isBlockedBetween(req.auth.uid, partnerId)) {
    throw new ApiError(403, "PARTNER_BLOCKED", "차단된 상대와는 대화할 수 없습니다.");
  }
  const id = conversationIdFor(req.auth.uid, partnerId);
  const reference = db.collection("conversations").doc(id);
  const timestamp = nowIso();
  const created = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (
      snapshot.exists &&
      (!(snapshot.data()?.memberIds || []).includes(req.auth.uid) || !(snapshot.data()?.memberIds || []).includes(partnerId))
    ) {
      throw new ApiError(409, "CONVERSATION_CONFLICT", "대화 식별자 충돌을 확인했습니다.");
    }
    await assertNotBlockedInTransaction(transaction, req.auth.uid, [partnerId], {
      message: "차단된 상대와는 대화할 수 없습니다.",
    });
    if (snapshot.exists && conversationStatus(snapshot.data()) === "accepted") {
      // 사용자가 목록에서 나갔던 기존 대화를 명시적으로 다시 열면 본인에게만
      // 재노출합니다. 메시지나 상대방의 숨김 상태는 건드리지 않습니다.
      if (isConversationHidden(snapshot.data(), req.auth.uid)) {
        transaction.update(reference, { hiddenBy: FieldValue.arrayRemove(req.auth.uid) });
      }
      return false;
    }

    // 정책·관계 판정도 이 transaction의 읽기 단계에 둡니다. 아래 create/update보다
    // 먼저 끝나므로 Firestore의 read-before-write 규칙도 지킵니다.
    const decision = await directMessageDecisionInTransaction(transaction, req.auth.uid, partnerId);
    if (!snapshot.exists && decision.status === "pending") {
      // 새 요청만 제한합니다: 거절당한 뒤 7일, 하루 20개. 바로 열리는 대화는 세지 않습니다.
      const [cooldownSnapshot, quotaSnapshot] = await transaction.getAll(
        db.collection("dmRequestCooldowns").doc(req.auth.uid + "_" + partnerId),
        writeQuotaReference(req.auth.uid),
      );
      const cooldownUntil = requestCooldownUntil(cooldownSnapshot.exists ? cooldownSnapshot.data() : null);
      if (cooldownUntil) {
        throw new ApiError(
          429,
          "MESSAGE_REQUEST_COOLDOWN",
          "상대방이 메시지 요청을 거절해 7일 동안 다시 요청할 수 없습니다.",
          { retryAt: new Date(cooldownUntil).toISOString() },
        );
      }
      takeWriteQuota(transaction, quotaSnapshot, "messageRequests");
    }
    if (!snapshot.exists) {
      transaction.create(reference, {
        id,
        memberIds: [req.auth.uid, partnerId],
        createdAt: timestamp,
        updatedAt: timestamp,
        lastMessage: "",
        lastMessageAt: "",
        lastMessageId: null,
        lastSenderId: null,
        mutedBy: [],
        hiddenBy: [],
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
  const [snapshot, blocked] = await Promise.all([
    db.collection("conversations").where("memberIds", "array-contains", req.auth.uid).limit(100).get(),
    blockedBothWays(req.auth.uid),
  ]);
  const conversations = snapshot.docs
    .map((document) => document.data())
    .filter((conversation) => !(conversation.memberIds || []).some((memberId) => blocked.has(memberId)))
    .filter((conversation) => !isConversationHidden(conversation, req.auth.uid))
    .filter((conversation) => {
      const status = conversationStatus(conversation);
      if (box === "requests") return status === "pending" && conversation.requestRecipientId === req.auth.uid;
      return status === "accepted" || (status === "pending" && conversation.requestSenderId === req.auth.uid);
    })
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  // 상대 프로필은 대화마다 따로 읽지 않고 한 번에(db.getAll) 읽습니다.
  const partnerProfiles = await profilesByIds(
    conversations.map((conversation) => (conversation.memberIds || []).find((memberId) => memberId !== req.auth.uid)),
  );
  const views = await Promise.all(
    conversations.map((conversation) => conversationView(conversation, req.auth.uid, false, partnerProfiles)),
  );
  return success(res, req, views, 200, { pagination: { total: views.length, nextCursor: null } });
});

app.post("/api/conversations/:conversationId/accept", requireUser, async (req, res) => {
  const id = docId(req.params.conversationId, "conversationId");
  const reference = db.collection("conversations").doc(id);
  const notificationEventId = crypto.randomUUID();
  let pushes = [];
  const conversation = await db.runTransaction(async (transaction) => {
    pushes = [];
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new ApiError(404, "CONVERSATION_NOT_FOUND", "대화를 찾을 수 없습니다.");
    const data = snapshot.data();
    if (conversationStatus(data) !== "pending" || data.requestRecipientId !== req.auth.uid) {
      throw new ApiError(403, "REQUEST_ACCEPT_FORBIDDEN", "이 메시지 요청을 수락할 수 없습니다.");
    }
    await assertNotBlockedInTransaction(transaction, req.auth.uid, [data.requestSenderId], {
      message: "차단된 상대의 메시지 요청은 수락할 수 없습니다.",
    });
    const timestamp = nowIso();
    const patch = {
      requestStatus: "accepted",
      requestSenderId: null,
      requestRecipientId: null,
      updatedAt: timestamp,
    };
    transaction.update(reference, patch);
    removeNotification(transaction, {
      type: "message_request",
      recipientId: req.auth.uid,
      actorId: data.requestSenderId,
      sourceId: id,
    });
    if (!(data.mutedBy || []).includes(data.requestSenderId)) {
      const accepted = putNotification(transaction, {
        type: "request_accepted",
        recipientId: data.requestSenderId,
        actorId: req.auth.uid,
        sourceId: id,
        conversationId: id,
        eventId: notificationEventId,
        createdAt: timestamp,
      });
      if (accepted) pushes.push({ notification: accepted });
    }
    return { ...data, ...patch };
  });
  await deliverPush(pushes, { actorName: req.auth.profile.name, requestId: req.requestId });
  return success(res, req, await conversationView(conversation, req.auth.uid, true));
});

app.delete("/api/conversations/:conversationId/request", requireUser, async (req, res) => {
  const id = docId(req.params.conversationId, "conversationId");
  const reference = db.collection("conversations").doc(id);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    // 같은 DELETE 재시도는 성공으로 취급하고 존재 여부도 노출하지 않습니다.
    if (!snapshot.exists) return;
    const conversation = snapshot.data();
    if (conversationStatus(conversation) !== "pending") {
      throw new ApiError(409, "REQUEST_NOT_PENDING", "대기 중인 메시지 요청만 삭제할 수 있습니다.");
    }
    if (conversation.requestRecipientId !== req.auth.uid) {
      throw new ApiError(403, "REQUEST_DECLINE_FORBIDDEN", "받은 메시지 요청만 삭제할 수 있습니다.");
    }
    const senderId = conversation.requestSenderId;
    if (!senderId) throw new ApiError(409, "REQUEST_STATE_CONFLICT", "메시지 요청 상태를 확인하지 못했습니다.");
    await assertNotBlockedInTransaction(transaction, req.auth.uid, [senderId], {
      code: "CONVERSATION_BLOCKED",
      message: "차단된 상대의 메시지 요청 상태를 변경할 수 없습니다.",
    });

    // pending 상태에서는 첫 메시지를 하나만 허용합니다. 두 개 이상이면 일부만
    // 지워 고아 데이터를 만들지 말고 상태 충돌로 중단합니다.
    const messagesSnapshot = await transaction.get(reference.collection("messages").limit(2));
    if (messagesSnapshot.size > 1) {
      throw new ApiError(409, "REQUEST_STATE_CONFLICT", "메시지 요청의 저장 상태를 확인하지 못했습니다.");
    }
    if (messagesSnapshot.size === 1 && messagesSnapshot.docs[0].data().senderId !== senderId) {
      throw new ApiError(409, "REQUEST_STATE_CONFLICT", "메시지 요청의 발신자를 확인하지 못했습니다.");
    }

    messagesSnapshot.docs.forEach((document) => transaction.delete(document.ref));
    removeNotification(transaction, {
      type: "message_request",
      recipientId: req.auth.uid,
      actorId: senderId,
      sourceId: id,
    });
    transaction.delete(reference);
    // 거절한 뒤 같은 사람이 곧바로 새 요청을 보내지 못하게 7일 동안 기억합니다(policy.mjs).
    const declinedAt = nowIso();
    transaction.set(db.collection("dmRequestCooldowns").doc(senderId + "_" + req.auth.uid), {
      senderId,
      recipientId: req.auth.uid,
      declinedAt,
      // Firestore TTL 정책이 지울 수 있는 Timestamp 입니다. 판정은 declinedAt 으로 합니다.
      expireAt: new Date(Date.parse(declinedAt) + DM_REQUEST_COOLDOWN_MS),
    });
  });
  return success(res, req, { id, dismissed: true });
});

app.delete("/api/conversations/:conversationId", requireUser, async (req, res) => {
  const id = docId(req.params.conversationId, "conversationId");
  const reference = db.collection("conversations").doc(id);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new ApiError(404, "CONVERSATION_NOT_FOUND", "대화를 찾을 수 없습니다.");
    const conversation = snapshot.data();
    if (!(conversation.memberIds || []).includes(req.auth.uid)) {
      throw new ApiError(403, "CONVERSATION_FORBIDDEN", "이 대화에서 나갈 수 없습니다.");
    }
    if (conversationStatus(conversation) !== "accepted") {
      throw new ApiError(409, "CONVERSATION_NOT_ACTIVE", "일반 대화만 목록에서 나갈 수 있습니다.");
    }
    const partnerId = (conversation.memberIds || []).find((memberId) => memberId !== req.auth.uid);
    if (!partnerId) throw new ApiError(409, "CONVERSATION_CONFLICT", "대화 상대를 확인하지 못했습니다.");
    await assertNotBlockedInTransaction(transaction, req.auth.uid, [partnerId], {
      code: "CONVERSATION_BLOCKED",
      message: "차단된 상대와의 대화 상태를 변경할 수 없습니다.",
    });
    // 이미 숨긴 DELETE 재시도도 같은 성공으로 끝냅니다. 대화와 메시지는 보존합니다.
    if (!isConversationHidden(conversation, req.auth.uid)) {
      transaction.update(reference, { hiddenBy: FieldValue.arrayUnion(req.auth.uid) });
    }
  });
  return success(res, req, { id, hidden: true });
});

app.patch("/api/conversations/:conversationId/mute", requireUser, async (req, res) => {
  const id = docId(req.params.conversationId, "conversationId");
  if (typeof req.body?.muted !== "boolean") {
    throw new ApiError(422, "VALIDATION_ERROR", "알림 설정 값을 확인해 주세요.", { field: "muted" });
  }
  const reference = db.collection("conversations").doc(id);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new ApiError(404, "CONVERSATION_NOT_FOUND", "대화를 찾을 수 없습니다.");
    if (!(snapshot.data().memberIds || []).includes(req.auth.uid)) {
      throw new ApiError(403, "CONVERSATION_FORBIDDEN", "이 대화의 알림을 바꿀 수 없습니다.");
    }
    transaction.update(reference, {
      mutedBy: req.body.muted ? FieldValue.arrayUnion(req.auth.uid) : FieldValue.arrayRemove(req.auth.uid),
    });
  });
  return success(res, req, { id, muted: req.body.muted, persisted: true });
});

app.get("/api/conversations/:conversationId/messages", requireUser, async (req, res) => {
  const id = docId(req.params.conversationId, "conversationId");
  /* 폴링은 ?after=<마지막으로 받은 sentAt> 을 붙여 그 뒤의 메시지만 받습니다(오래된 것부터 200개).
     없으면 예전처럼 최근 200개입니다. 권한 확인과 읽음 처리, 응답 모양은 같습니다. */
  const after = req.query.after === undefined ? null : isoTimestamp(req.query.after, "after");
  const conversationReference = db.collection("conversations").doc(id);
  /* 큰 media payload를 transaction에 넣지 않습니다. 먼저 권한을 빠르게 확인한 뒤
     메시지와 당시의 알림 event identity를 일반 조회로 고정합니다. */
  const preflightSnapshot = await conversationReference.get();
  if (!preflightSnapshot.exists) throw new ApiError(404, "CONVERSATION_NOT_FOUND", "대화를 찾을 수 없습니다.");
  const preflightConversation = preflightSnapshot.data();
  if (!(preflightConversation.memberIds || []).includes(req.auth.uid)) {
    throw new ApiError(403, "CONVERSATION_FORBIDDEN", "이 대화에 접근할 수 없습니다.");
  }
  const preflightPartnerId = (preflightConversation.memberIds || []).find((memberId) => memberId !== req.auth.uid);
  if (!preflightPartnerId) throw new ApiError(409, "CONVERSATION_CONFLICT", "대화 상대를 확인하지 못했습니다.");
  if (await isBlockedBetween(req.auth.uid, preflightPartnerId)) {
    throw new ApiError(403, "CONVERSATION_BLOCKED", "차단된 상대와는 대화할 수 없습니다.");
  }

  const messagesCollection = conversationReference.collection("messages");
  const messagesQuery = after
    ? messagesCollection.where("sentAt", ">", after).orderBy("sentAt", "asc").limit(200)
    : messagesCollection.orderBy("sentAt", "desc").limit(200);
  const notificationsQuery = notificationItems(req.auth.uid)
    .where("conversationId", "==", id)
    .where("readAt", "==", null)
    .limit(50);
  const [messageSnapshot, notificationSnapshot] = await Promise.all([
    messagesQuery.get(),
    notificationsQuery.get(),
  ]);
  const rows = messageSnapshot.docs.map((document) => document.data());
  const messages = after ? rows : rows.reverse();
  const latestMessageAt = messages.length ? String(messages[messages.length - 1].sentAt || "") : "";
  const visibleMessageIds = new Set(messages.map((message) => message.id).filter(Boolean));
  const notificationCandidates = notificationSnapshot.docs
    .map((document) => ({
      reference: document.ref,
      notification: document.data(),
      eventId: notificationEventIdentity(document.data()),
    }))
    .filter(({ notification, eventId }) => {
      if (!["message", "message_request"].includes(notification.type)) return true;
      if (notification.eventId) return visibleMessageIds.has(eventId);
      return Boolean(latestMessageAt && String(notification.createdAt || "") <= latestMessageAt);
    });
  const notificationReadAt = nowIso();

  /* 이 작은 transaction은 conversation, block, 최대 50개 알림만 다시 읽습니다.
     조회 뒤 새 메시지가 왔으면 unread를 보존하고, 알림 문서가 새 event로 덮였으면
     identity 불일치로 건너뜁니다. */
  const conversation = await db.runTransaction(async (transaction) => {
    const conversationSnapshot = await transaction.get(conversationReference);
    if (!conversationSnapshot.exists) throw new ApiError(404, "CONVERSATION_NOT_FOUND", "대화를 찾을 수 없습니다.");
    const current = conversationSnapshot.data();
    if (!(current.memberIds || []).includes(req.auth.uid)) {
      throw new ApiError(403, "CONVERSATION_FORBIDDEN", "이 대화에 접근할 수 없습니다.");
    }
    const partnerId = (current.memberIds || []).find((memberId) => memberId !== req.auth.uid);
    if (!partnerId) throw new ApiError(409, "CONVERSATION_CONFLICT", "대화 상대를 확인하지 못했습니다.");
    await assertNotBlockedInTransaction(transaction, req.auth.uid, [partnerId], {
      code: "CONVERSATION_BLOCKED",
      message: "차단된 상대와는 대화할 수 없습니다.",
    });
    const currentNotifications = notificationCandidates.length
      ? await transaction.getAll(...notificationCandidates.map((candidate) => candidate.reference))
      : [];
    const readPatch = buildConversationReadPatch(current, messages, req.auth.uid);

    if (readPatch) transaction.update(conversationReference, readPatch);
    currentNotifications.forEach((document, index) => {
      if (!document.exists || document.data().readAt) return;
      if (!matchesNotificationEvent(document.data(), notificationCandidates[index].eventId)) return;
      transaction.update(document.ref, { readAt: notificationReadAt });
    });
    return current;
  });

  // 내가 보낸 메시지에만 읽음 여부를 붙입니다 — 남이 내 걸 언제 읽었는지가 궁금한 것이지,
  // 내가 남의 걸 읽었는지는 화면에 필요 없습니다. 수락 전 요청은 읽음을 보여주지 않습니다.
  const partnerId = (conversation.memberIds || []).find((memberId) => memberId !== req.auth.uid);
  const partnerReadAt =
    partnerId && conversationStatus(conversation) === "accepted" ? conversation.readAt?.[partnerId] : null;
  const withRead = messages.map((message) =>
    message.senderId === req.auth.uid
      ? { ...message, readByPartner: Boolean(partnerReadAt && String(partnerReadAt) >= String(message.sentAt)) }
      : message,
  );
  return success(res, req, withRead, 200, { pagination: { total: withRead.length, nextCursor: null } });
});

async function createMessage(req, res, conversationId) {
  const id = docId(conversationId, "conversationId");
  const type = req.body?.type ?? "text";
  if (!["text", "voice", "image", "correction"].includes(type)) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 메시지 형식입니다.", { field: "type" });
  }
  /**
   * 사진·음성은 지금 데이터 URI 로 문서에 함께 담습니다.
   *
   * 파일 저장소(버킷)가 아직 없어서입니다. 화면이 보내기 전에 사진을 줄이고
   * 압축하므로 보통 100~200KB 이고, Firestore 문서 한도(1MB)를 넘지 않게
   * 여기서도 한 번 더 막습니다. 버킷이 생기면 이 자리에 그 주소가 들어오면 됩니다.
   * 외부 주소는 받지 않습니다 — 받는 사람의 IP 와 읽은 시각이 그 서버에 남습니다.
   * 글과 교정에는 첨부가 없습니다.
   */
  const attached = type === "image" || type === "voice";
  const media = attached ? mediaDataUri(req.body?.media, "media", type === "image" ? "image" : "audio") : "";
  if (attached && !media) {
    throw new ApiError(422, "VALIDATION_ERROR", "보낼 파일이 없습니다.", { field: "media" });
  }
  // 교정은 고친 문장(text)과 고칠 메시지(targetMessageId)·한 줄 설명(note)을 받습니다(corrections.mjs).
  const correction = type === "correction" ? correctionInput(req.body) : null;
  // 사진·음성 메시지의 text 는 목록에 보일 한 줄입니다(빈 값이면 화면이 형식으로 채웁니다).
  const text = correction
    ? correction.text
    : type === "text"
      ? safeString(req.body?.text, "text", { min: 1, max: 4000 })
      : optionalString(req.body?.text, "text", 200) || (type === "image" ? "사진" : "음성 메시지");
  const clientMessageId = isDocumentId(req.body?.clientMessageId, { min: 8 })
    ? req.body.clientMessageId
    : "message-" + crypto.randomUUID();
  const conversationReference = db.collection("conversations").doc(id);
  const messageReference = conversationReference.collection("messages").doc(clientMessageId);
  let pushes = [];
  const result = await db.runTransaction(async (transaction) => {
    pushes = [];
    const conversationSnapshot = await transaction.get(conversationReference);
    if (!conversationSnapshot.exists) throw new ApiError(404, "CONVERSATION_NOT_FOUND", "대화를 찾을 수 없습니다.");
    const conversation = conversationSnapshot.data();
    if (!(conversation.memberIds || []).includes(req.auth.uid)) {
      throw new ApiError(403, "CONVERSATION_FORBIDDEN", "이 대화에 메시지를 보낼 수 없습니다.");
    }

    const messageSnapshot = await transaction.get(messageReference);
    if (messageSnapshot.exists) {
      const existing = messageSnapshot.data();
      // 교정은 고친 메시지와 설명까지 같아야 같은 요청의 재시도입니다.
      if (
        existing.senderId !== req.auth.uid ||
        existing.text !== text ||
        existing.type !== type ||
        (existing.media || "") !== media ||
        (correction && !sameCorrection(existing, correction))
      ) {
        throw new ApiError(409, "MESSAGE_ID_CONFLICT", "이미 사용된 메시지 ID입니다.");
      }
      return { message: existing, created: false };
    }

    const recipientId = (conversation.memberIds || []).find((memberId) => memberId !== req.auth.uid);
    if (!recipientId) throw new ApiError(409, "CONVERSATION_CONFLICT", "대화 상대를 확인하지 못했습니다.");
    await assertNotBlockedInTransaction(transaction, req.auth.uid, [recipientId], {
      code: "CONVERSATION_BLOCKED",
      message: "차단된 상대에게는 메시지를 보낼 수 없습니다.",
    });

    /* 교정은 수락된 대화에서 상대가 보낸 글 메시지에만 보냅니다. 고칠 메시지는 이 대화 안에서 찾고,
       받는 사람의 교정함 칸과 함께 아래 쓰기보다 먼저 읽습니다(corrections.mjs). */
    const correctionFields = correction
      ? await readCorrection(transaction, {
          status: conversationStatus(conversation),
          targetReference: conversationReference.collection("messages").doc(correction.targetMessageId),
          inboxReference: correctionItems(recipientId).doc(clientMessageId),
          recipientId,
          input: correction,
        })
      : null;

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

    /* 같은 대화의 두 전송이 같은 ms에 들어와도 정렬 키가 겹치지 않게, 현재
       대화의 마지막 시각보다 최소 1ms 뒤를 배정합니다. 대화 문서 갱신이 경합하면
       Firestore가 트랜잭션을 재시도해 최신 순서를 다시 계산합니다. */
    const previousMillis = Date.parse(conversation.lastMessageAt || conversation.updatedAt || "");
    const currentMillis = Date.now();
    const timestamp = new Date(Math.max(currentMillis, Number.isFinite(previousMillis) ? previousMillis + 1 : currentMillis)).toISOString();
    const message = {
      id: clientMessageId,
      conversationId: id,
      senderId: req.auth.uid,
      type,
      text,
      media,
      sentAt: timestamp,
      status: "sent",
      // 교정: 원문(대상 메시지에서 복사)·고친 메시지 id·설명
      ...correctionFields,
    };
    transaction.create(messageReference, message);
    if (correctionFields) {
      // 고침을 받은 사람의 받은 교정함(GET /api/corrections/received)에도 같은 transaction 으로 남깁니다.
      transaction.create(correctionItems(recipientId).doc(clientMessageId), correctionInboxEntry(message));
    }
    /* 받는 사람의 안읽음을 올립니다.
       예전에는 목록이 늘 unreadCount: 0 을 내려 보내 안읽음 표시가 아예 뜨지
       않았습니다. 목록마다 메시지를 세면 대화 수만큼 질의가 늘어나므로
       대화 문서에 사람별로 세어 둡니다 — 읽으면 그 자리에서 0 으로 돌립니다. */
    const unread = { ...(conversation.unread || {}) };
    unread[recipientId] = (unread[recipientId] || 0) + 1;

    if (!(conversation.mutedBy || []).includes(recipientId)) {
      /* 처음 말을 걸 때는 "요청", 이미 열린 대화면 "새 메시지".
         sourceId 를 대화 id 로 둡니다 — 문서 id 가 type+수신자+보낸이+sourceId 라
         같은 대화의 메시지가 한 줄로 모입니다. 20통을 보내도 알림은 하나이고
         가장 최근 내용으로 갱신됩니다. 폰 알림은 메시지마다 갑니다(대화 알림을 끈 사람에게는 둘 다 가지 않음). */
      const notification = putNotification(transaction, {
        type: conversationStatus(conversation) === "pending" ? "message_request" : "message",
        recipientId,
        actorId: req.auth.uid,
        sourceId: id,
        conversationId: id,
        eventId: clientMessageId,
        excerpt: text,
        createdAt: timestamp,
      });
      if (notification) pushes.push({ notification, messageType: type });
    }

    transaction.update(conversationReference, {
      lastMessage: text,
      lastSenderId: req.auth.uid,
      lastMessageId: clientMessageId,
      lastMessageAt: timestamp,
      unread,
      // 새 메시지를 받은 사람에게는 이전에 나갔던 방을 자동으로 다시 보입니다.
      // arrayRemove transform도 메시지 생성과 같은 transaction에서 커밋됩니다.
      hiddenBy: FieldValue.arrayRemove(recipientId),
      updatedAt: timestamp,
      ...(conversationStatus(conversation) === "pending"
        ? { requestMessageSent: true, requestSpamSignals: spamSignals(text) }
        : {}),
    });
    return { message, created: true };
  });
  // 같은 요청의 재시도(created: false)에는 다시 보내지 않습니다.
  if (result.created) await deliverPush(pushes, { actorName: req.auth.profile.name, requestId: req.requestId });
  return success(res, req, { conversationId: id, message: result.message }, result.created ? 201 : 200);
}

app.post("/api/conversations/:conversationId/messages", requireUser, async (req, res) =>
  createMessage(req, res, req.params.conversationId),
);
app.post("/api/messages", requireUser, async (req, res) =>
  createMessage(req, res, req.body?.conversationId),
);

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
    flagSuspectedSpam: optionalBoolean(
      req.body?.flagSuspectedSpam,
      "flagSuspectedSpam",
      current.flagSuspectedSpam === undefined ? true : Boolean(current.flagSuspectedSpam),
    ),
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

function requireAdmin(req, _res, next) {
  if (!ADMIN_UIDS.has(req.auth.uid)) {
    // 있는지 없는지도 알려주지 않습니다 — 운영 화면의 존재를 광고할 이유가 없습니다.
    next(new ApiError(404, "NOT_FOUND", "API 경로를 찾을 수 없습니다: " + req.path));
    return;
  }
  next();
}

/** 운영자용 — 접수된 신고 전체. 신고자 신원은 필요할 때만 보이도록 따로 담습니다. */
app.get("/api/admin/reports", requireUser, requireAdmin, async (req, res) => {
  const status = req.query.status === undefined ? "open" : safeString(req.query.status, "status", { min: 2, max: 16 });
  if (!["open", "closed", "all"].includes(status)) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 상태입니다.", { field: "status" });
  }
  const snapshot = await db.collection("reports").limit(200).get();
  const rows = snapshot.docs
    .map((document) => document.data())
    .filter((row) => (status === "all" ? true : status === "open" ? row.status === "received" : row.status !== "received"))
    .sort((left, right) => String(right.submittedAt).localeCompare(String(left.submittedAt)));
  // 예전 신고의 targetId 는 검증 없이 저장됐습니다. "a/b" 하나로 목록 전체가 500 이 되지 않게 거릅니다.
  const validId = (id) => isDocumentId(id, { min: 1 });
  // 글 신고는 무엇을 신고했는지 보이게 글 내용과 글쓴이를 함께 냅니다(사진·음성은 크기가 커서 읽지 않습니다).
  const postIds = [...new Set(rows.filter((row) => row.targetType === "post" && validId(row.targetId)).map((row) => row.targetId))];
  const postSnapshots = postIds.length
    ? await db.getAll(...postIds.map((postId) => db.collection("posts").doc(postId)), { fieldMask: ["authorId", "text", "createdAt"] })
    : [];
  const posts = new Map(postSnapshots.filter((snapshot) => snapshot.exists).map((snapshot) => [snapshot.id, snapshot.data()]));
  const profiles = await profilesByIds(
    [...rows.map((r) => r.reporterId), ...rows.map((r) => r.targetId), ...[...posts.values()].map((post) => post.authorId)].filter(validId),
  );
  const named = (id) => (profiles.get(id) ? { id, name: profiles.get(id).name, handle: profiles.get(id).handle } : { id, name: null, handle: null });
  // 지워진 글은 null 입니다(글쓴이가 지웠거나 탈퇴).
  const postView = (postId) => {
    const post = posts.get(postId);
    return post ? { id: postId, text: String(post.text || "").slice(0, 1000), createdAt: post.createdAt, author: named(post.authorId) } : null;
  };
  return success(
    res,
    req,
    rows.map((row) => ({
      id: row.id,
      targetType: row.targetType,
      reason: row.reason,
      details: row.details || "",
      status: row.status,
      submittedAt: row.submittedAt,
      resolution: row.resolution || "",
      reporter: named(row.reporterId),
      target: named(row.targetId),
      ...(row.targetType === "post" ? { post: postView(row.targetId) } : {}),
    })),
    200,
    { pagination: { total: rows.length, nextCursor: null } },
  );
});

/** 신고를 닫습니다. 어떻게 판단했는지 한 줄 남겨야 나중에 이유를 알 수 있습니다. */
app.patch("/api/admin/reports/:reportId", requireUser, requireAdmin, async (req, res) => {
  const reportId = docId(req.params.reportId, "reportId");
  const outcome = safeString(req.body?.outcome, "outcome", { min: 2, max: 24 });
  if (!["actioned", "dismissed", "received"].includes(outcome)) {
    throw new ApiError(422, "VALIDATION_ERROR", "지원하지 않는 처리 결과입니다.", { field: "outcome" });
  }
  const reference = db.collection("reports").doc(reportId);
  const snapshot = await reference.get();
  if (!snapshot.exists) throw new ApiError(404, "REPORT_NOT_FOUND", "신고를 찾을 수 없습니다.");
  const patch = {
    status: outcome,
    resolution: optionalString(req.body?.resolution, "resolution", 500) || "",
    reviewedBy: req.auth.uid,
    updatedAt: nowIso(),
  };
  await reference.update(patch);
  return success(res, req, { id: reportId, ...patch });
});

app.get("/api/reports", requireUser, async (req, res) => {
  const snapshot = await db.collection("reports").where("reporterId", "==", req.auth.uid).limit(50).get();
  const reports = snapshot.docs.map((document) => document.data()).sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  return success(res, req, reports, 200, { pagination: { total: reports.length, nextCursor: null } });
});

app.post("/api/reports", requireUser, async (req, res) => {
  const targetTypes = ["user", "post", "message"];
  const reasons = ["spam", "scam", "harassment", "dating", "sexual_content", "hate", "impersonation", "other"];
  const targetType = safeString(req.body?.targetType, "targetType", { min: 2, max: 32 });
  // 운영자 목록이 이 값으로 프로필을 읽습니다(profilesByIds → .doc()).
  const targetId = docId(req.body?.targetId, "targetId", { min: 2 });
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
  await db.runTransaction(async (transaction) => {
    const quotaSnapshot = await transaction.get(writeQuotaReference(req.auth.uid));
    takeWriteQuota(transaction, quotaSnapshot, "reports");
    transaction.create(db.collection("reports").doc(report.id), report);
  });
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
  const [profilesSnapshot, postsSnapshot, partnerIds, blocked] = await Promise.all([
    db.collection("profiles").limit(100).get(),
    db.collection("posts").orderBy("createdAt", "desc").limit(100).get(),
    acceptedPartnerIds(req.auth.uid),
    blockedBothWays(req.auth.uid),
  ]);
  const partners = profilesSnapshot.docs
    .map((document) => document.data())
    .filter((profile) => profile.id !== req.auth.uid && isDiscoverable(profile))
    .filter((profile) => !blocked.has(profile.id))
    .filter((profile) => [profile.name, profile.handle, profile.bio, ...(profile.interests || [])].join(" ").toLocaleLowerCase().includes(query))
    .map(profileForOthers);
  const posts = postsSnapshot.docs
    .map((document) => document.data())
    .filter(
      (post) =>
        post.visibility === "public" ||
        post.authorId === req.auth.uid ||
        (post.visibility === "partners" && partnerIds.has(post.authorId)),
    )
    .filter((post) => !blocked.has(post.authorId))
    .filter((post) => [post.text, ...(post.tags || [])].join(" ").toLocaleLowerCase().includes(query));
  const postAuthors = await profilesByIds(posts.map((post) => post.authorId));
  const postsWithAvatars = posts.map((post) => ({
    ...post,
    author: postAuthorView(post, postAuthors.get(post.authorId)),
  }));
  return success(res, req, { partners, posts: postsWithAvatars }, 200, {
    total: partners.length + postsWithAvatars.length,
  });
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
    model: activeGeminiModel,
    entitlement: { tier: "free-beta", charged: false, metered: true, paywall: false, usage: quota },
  });
});

app.post("/api/conversation-support", requireUser, async (req, res) => {
  const partnerId = docId(req.body?.partnerId, "partnerId");
  const partnerSnapshot = await db.collection("profiles").doc(partnerId).get();
  if (!partnerSnapshot.exists || partnerSnapshot.data()?.accountStatus !== "active") {
    throw new ApiError(404, "PARTNER_NOT_FOUND", "대화 상대를 찾을 수 없습니다.");
  }
  // 차단한 사이면 프로필도 AI 사용량도 쓰지 않습니다. 차단 여부가 드러나지 않게 404로 답합니다.
  if (await isBlockedBetween(req.auth.uid, partnerId)) {
    throw new ApiError(404, "PARTNER_NOT_FOUND", "대화 상대를 찾을 수 없습니다.");
  }
  const stage = optionalString(req.body?.stage, "stage", 32) || "first-message";
  const draft = optionalString(req.body?.draft, "draft", 1000) || "";
  const partner = profileForOthers(partnerSnapshot.data());
  // 첫 인사·이어 묻기는 내가 연습하는 말로, 번역·주제·팁은 화면 언어로 씁니다(ai-support.mjs).
  const { practice, helper } = supportLanguages(req.auth.profile, partner, req.body?.locale);
  const languageLabel = (code) => LANGUAGES.find((item) => item.code === code)?.name || code;
  const { body: aiBody, quota } = await geminiResponse(
    {
      instructions: supportInstructions(languageLabel(practice), languageLabel(helper)),
      input: JSON.stringify({
        stage,
        draft,
        learner: {
          nativeLanguages: req.auth.profile?.nativeLanguages || [],
          learningLanguages: req.auth.profile?.learningLanguages || [],
        },
        partner: {
          nativeLanguages: partner.nativeLanguages,
          learningLanguages: partner.learningLanguages,
          interests: partner.interests,
        },
      }),
      generationConfig: {
        maxOutputTokens: 1600,
        temperature: 0.4,
        responseMimeType: "application/json",
        responseJsonSchema: SUPPORT_SCHEMA,
      },
    },
    req.auth.uid,
    { feature: "conversationSupport", dailyLimit: AI_SUPPORT_DAILY_LIMIT },
  );
  let parsed;
  try {
    parsed = JSON.parse(geminiText(aiBody));
  } catch {
    throw new ApiError(502, "AI_INVALID_RESPONSE", "AI 응답 형식을 확인하지 못했습니다.");
  }
  const support = normalizeSupport(parsed);
  if (!support) {
    throw new ApiError(502, "AI_INVALID_RESPONSE", "AI 응답 형식을 확인하지 못했습니다.");
  }
  return success(res, req, {
    partner,
    stage,
    practiceLanguage: practice,
    helperLanguage: helper,
    ...support,
    provider: GEMINI_PROVIDER,
    model: activeGeminiModel,
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
        ? new ApiError(413, "PAYLOAD_TOO_LARGE", "보낸 내용이 너무 커요. 사진이나 음성을 붙였다면 더 작은 것으로 다시 시도해 주세요.")
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
