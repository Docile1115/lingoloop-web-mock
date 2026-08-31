import crypto from "node:crypto";

export const NOTIFICATION_TYPES = new Set([
  "post_like",
  "post_reply",
  "post_correction",
  "comment_reply",
  "partner_like",
  "follow",
  "message_request",
  "request_accepted",
]);

const EXCERPT_LIMIT = 160;

export function notificationExcerpt(value) {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > EXCERPT_LIMIT ? `${normalized.slice(0, EXCERPT_LIMIT - 1)}…` : normalized;
}

export function notificationDocumentId({ type, recipientId, actorId, sourceId }) {
  if (!NOTIFICATION_TYPES.has(type)) throw new Error(`Unsupported notification type: ${type}`);
  const source = [type, recipientId, actorId, sourceId].join("\u0000");
  return crypto.createHash("sha256").update(source).digest("hex").slice(0, 40);
}

/**
 * 알림 문구는 저장하지 않습니다. 화면이 type을 현재 언어로 옮기고, 서버에는
 * 이동에 필요한 식별자와 사용자가 실제로 쓴 짧은 미리보기만 남깁니다.
 */
export function buildNotification({
  type,
  recipientId,
  actorId,
  sourceId,
  postId = "",
  replyId = "",
  conversationId = "",
  excerpt = "",
  createdAt,
}) {
  if (!recipientId || !actorId || recipientId === actorId) return null;
  const id = notificationDocumentId({ type, recipientId, actorId, sourceId });
  return {
    id,
    type,
    recipientId,
    actorId,
    sourceId,
    postId,
    replyId,
    conversationId,
    excerpt: notificationExcerpt(excerpt),
    createdAt,
    readAt: null,
  };
}
