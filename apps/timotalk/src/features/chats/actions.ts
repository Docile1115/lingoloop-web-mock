/**
 * 대화에 하는 일들. 서버 경로는 backend/server.mjs 와 같습니다.
 *  - 요청 수락: POST /api/conversations/:id/accept → 수락된 대화
 *  - 요청 거절: DELETE /api/conversations/:id/request (같은 사람은 7일 동안 다시 요청 못 함)
 *  - 나가기: DELETE /api/conversations/:id (내 목록에서만 숨김. 상대가 다시 말을 걸면 돌아옴)
 *  - 알림 끄기: PATCH /api/conversations/:id/mute
 *  - 차단: POST /api/partners/:id/block (서로 보이지 않음. 대화는 지우지 않고 가림)
 *  - 신고: POST /api/reports (운영자 화면으로 갑니다)
 */
import { api } from "@/lib/api";
import { msg, tx, type MessageKey } from "@/lib/i18n";
import type { Conversation } from "@/lib/types";

const path = (id: string) => `/api/conversations/${encodeURIComponent(id)}`;

export const acceptRequest = (id: string) => api<Conversation>(`${path(id)}/accept`, { body: {} });
export const declineRequest = (id: string) => api(`${path(id)}/request`, { method: "DELETE" });
export const leaveConversation = (id: string) => api(path(id), { method: "DELETE" });
export const setMuted = (id: string, muted: boolean) => api(`${path(id)}/mute`, { method: "PATCH", body: { muted } });
export const blockUser = (partnerId: string) => api(`/api/partners/${encodeURIComponent(partnerId)}/block`, { body: {} });

/** 신고 사유. 웹·옛 앱의 신고 창과 같은 목록입니다. 서버가 모르는 사유(개인정보 요구)는 기타로 접수하고 내용에 적습니다. */
export const REPORT_REASONS: Array<{ code: string; label: MessageKey }> = [
  { code: "spam", label: msg("스팸 또는 광고") },
  { code: "scam", label: msg("사기 · 금전 요구") },
  { code: "dating", label: msg("데이트·연애 목적") },
  { code: "harassment", label: msg("괴롭힘 또는 혐오 표현") },
  { code: "privacy", label: msg("개인정보 요구") },
  { code: "other", label: msg("기타") },
];
const SERVER_REASONS = new Set(["spam", "scam", "harassment", "dating", "other"]);

export async function reportUser(partnerId: string, reason: string, details: string): Promise<{ id: string }> {
  const known = SERVER_REASONS.has(reason);
  const label = REPORT_REASONS.find((item) => item.code === reason)?.label;
  return api<{ id: string }>("/api/reports", {
    body: {
      targetType: "user",
      targetId: partnerId,
      reason: known ? reason : "other",
      details: [known || !label ? "" : `[${tx(label)}]`, details.trim()].filter(Boolean).join(" "),
    },
  });
}

/** 접수번호. 웹과 같은 모양으로 보여 줍니다(LL-1A2B3C4D). */
export const shortReportId = (id: string) => `LL-${id.replace(/^report-/, "").slice(0, 8).toUpperCase()}`;

/** 요청함 첫 메시지의 스팸 신호(backend/policy.mjs SPAM_PATTERNS) */
const SPAM_SIGNALS: Record<string, MessageKey> = {
  "off-platform": msg("다른 앱으로 옮기자는 말"),
  money: msg("돈 이야기"),
  link: msg("링크"),
  contact: msg("연락처"),
};

export function spamSignalNames(signals: string[] | undefined): string[] {
  return (signals ?? []).map((code) => (SPAM_SIGNALS[code] ? tx(SPAM_SIGNALS[code]) : "")).filter(Boolean);
}
