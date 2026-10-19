/**
 * 신고 검토(운영자). 서버 경로는 backend/server.mjs 의 /api/admin/reports 입니다.
 * ADMIN_UIDS 에 있는 사람만 쓰고, 그 밖의 사람에게는 서버가 404 로 답합니다(화면이 있다는 것도 드러내지 않음).
 *  - 목록: status=open(처리 전) · closed(처리함) · all, 최신순 200건까지. 글 신고는 글 내용과 글쓴이(post)를 함께 받습니다.
 *  - 처리: outcome(actioned 조치함 · dismissed 문제없음 · received 처리 전으로 되돌리기)과 한 줄 메모(resolution)
 */
import { api } from "@/lib/api";
import { msg, tx, type MessageKey } from "@/lib/i18n";

export type ReportFilter = "open" | "closed" | "all";
export type ReportOutcome = "received" | "actioned" | "dismissed";

type Person = { id: string; name: string | null; handle: string | null };

export type AdminReport = {
  id: string;
  targetType: string;
  reason: string;
  details: string;
  status: string;
  submittedAt: string;
  resolution: string;
  reporter: Person;
  /** 사람 신고면 그 사람. 글·메시지 신고면 id 만 있고 이름은 비어 있습니다. */
  target: Person;
  /** 글 신고에만 있습니다. 지워진 글이면 null */
  post?: { id: string; text: string; createdAt: string; author: Person } | null;
};

export const listReports = (filter: ReportFilter) => api<AdminReport[]>(`/api/admin/reports?status=${filter}`);

export const reviewReport = (id: string, outcome: ReportOutcome, resolution: string) =>
  api<{ id: string; status: string; resolution: string }>(`/api/admin/reports/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { outcome, resolution },
  });

/** 서버가 받는 사유 전부. 새 앱이 보내지 않는 사유(성적인 내용 등)는 예전 웹·앱에서 온 신고입니다. */
const REASONS: Record<string, MessageKey> = {
  spam: msg("스팸 또는 광고"),
  scam: msg("사기 · 금전 요구"),
  dating: msg("데이트·연애 목적"),
  harassment: msg("괴롭힘 또는 혐오 표현"),
  sexual_content: msg("성적인 내용"),
  hate: msg("혐오 표현"),
  impersonation: msg("다른 사람 사칭"),
  other: msg("기타"),
};

export const reasonLabel = (code: string) => (REASONS[code] ? tx(REASONS[code]) : code);
