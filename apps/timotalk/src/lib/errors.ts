/**
 * 화면에 띄울 오류 문장.
 *
 * 서버 문장은 한국어입니다. 한국어 화면에서는 더 자세한 서버 문장을 그대로 쓰고,
 * 다른 언어에서는 아래 사전 문장을 씁니다. 내부 사정(설정·키)이 담기는 코드는
 * 한국어 화면에서도 서버 문장을 보여주지 않습니다. (옛 웹 live-data.ts 와 같은 규칙)
 */
import { currentLocaleSnapshot } from "@shared/i18n/core";
import { msg, t, tx } from "./i18n";

const AI_UNAVAILABLE = msg("AI가 지금 답하지 못했어요. 잠시 후 다시 시도해 주세요.");

const MESSAGES: Record<string, string> = {
  NETWORK_ERROR: msg("인터넷 연결을 확인해 주세요."),
  TIMEOUT: msg("응답이 늦어요. 연결을 확인하고 다시 시도해 주세요."),
  AUTH_REQUIRED: msg("다시 로그인해 주세요."),
  INVALID_SESSION: msg("다시 로그인해 주세요."),
  RATE_LIMITED: msg("요청이 너무 많아요. 잠시 후 다시 시도해 주세요."),
  VALIDATION_ERROR: msg("입력한 내용을 확인해 주세요."),
  PAYLOAD_TOO_LARGE: msg("파일이 너무 커요."),
  ACCOUNT_RESTRICTED: msg("사용이 제한된 계정이에요."),
  PARTNER_NOT_FOUND: msg("상대를 찾을 수 없어요."),
  PARTNER_BLOCKED: msg("차단된 상대와는 이 기능을 쓸 수 없어요."),
  CONVERSATION_BLOCKED: msg("차단된 상대와는 이 기능을 쓸 수 없어요."),
  CONVERSATION_NOT_FOUND: msg("대화를 찾을 수 없어요."),
  POST_NOT_FOUND: msg("글을 찾을 수 없어요."),
  DM_NOT_ALLOWED: msg("이 사람은 지금 메시지를 받지 않아요."),
  MESSAGE_REQUEST_PENDING: msg("상대가 메시지 요청을 수락하면 이어서 보낼 수 있어요."),
  MESSAGE_REQUEST_LIMIT: msg("상대가 메시지 요청을 수락하면 이어서 보낼 수 있어요."),
  AI_DAILY_LIMIT_REACHED: msg("오늘의 무료 AI 사용량을 모두 썼어요."),
  AI_SAFETY_BLOCKED: msg("이 내용은 AI가 처리할 수 없어요."),
  AI_NOT_CONFIGURED: msg("지금은 AI 기능을 쓸 수 없어요."),
  AI_PROVIDER_UNAVAILABLE: AI_UNAVAILABLE,
  AI_PROVIDER_RATE_LIMITED: AI_UNAVAILABLE,
  AI_PROVIDER_ERROR: AI_UNAVAILABLE,
  AI_MODEL_UNAVAILABLE: AI_UNAVAILABLE,
  AI_INVALID_RESPONSE: AI_UNAVAILABLE,
  AI_EMPTY_RESPONSE: AI_UNAVAILABLE,
  AI_INCOMPLETE_RESPONSE: msg("AI 응답이 완성되지 않았어요. 내용을 줄여 다시 시도해 주세요."),
  MESSAGE_REQUEST_COOLDOWN: msg("상대가 요청을 지워서 7일 동안 다시 요청할 수 없어요."),
  BLOCK_CLEANUP_PENDING: msg("차단 정보를 정리하고 있어요. 잠시 후 다시 시도해 주세요."),
  ACCOUNT_DELETE_FAILED: msg("계정을 지우지 못했어요. 잠시 후 다시 시도해 주세요."),
  ACCOUNT_DELETE_IN_PROGRESS: msg("계정을 지우는 중이에요. 잠시 후 다시 확인해 주세요."),
};

const INTERNAL_CODES = new Set(["AI_NOT_CONFIGURED", "INTERNAL_ERROR", "INVALID_USAGE_STATE", "INVALID_PROXY", "INVALID_ORIGIN", "AI_PROVIDER_ERROR"]);

export function errorMessage(status: number, code: string, serverMessage?: string): string {
  if (currentLocaleSnapshot() === "ko" && serverMessage && !INTERNAL_CODES.has(code)) return serverMessage;
  const mapped = MESSAGES[code] ?? (status === 429 ? MESSAGES.RATE_LIMITED : undefined);
  return mapped ? tx(mapped) : t("요청을 처리하지 못했어요.");
}
