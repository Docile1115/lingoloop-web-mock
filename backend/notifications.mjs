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
  "message",
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
 * eventId가 도입되기 전에 저장된 알림도 안전하게 읽을 수 있도록, 기존 필드로
 * 한 번만 쓸 수 있는 호환 식별자를 만듭니다. 새 알림은 반드시 명시적 eventId를
 * 저장하므로 같은 알림 문서가 새 행동으로 덮여 쓰이면 식별자가 달라집니다.
 */
export function notificationEventIdentity(notification = {}) {
  const explicit = typeof notification.eventId === "string" ? notification.eventId.trim() : "";
  if (explicit) return explicit;
  const legacySource = [
    notification.id,
    notification.type,
    notification.recipientId,
    notification.actorId,
    notification.sourceId,
    notification.createdAt,
    notification.excerpt,
  ].join("\u0000");
  return "legacy-" + crypto.createHash("sha256").update(legacySource).digest("hex").slice(0, 40);
}

export function matchesNotificationEvent(notification, expectedEventId) {
  return typeof expectedEventId === "string" &&
    expectedEventId.length > 0 &&
    notificationEventIdentity(notification) === expectedEventId;
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
  eventId = "",
  excerpt = "",
  createdAt,
}) {
  if (!recipientId || !actorId || recipientId === actorId) return null;
  const normalizedEventId = typeof eventId === "string" ? eventId.trim() : "";
  if (!normalizedEventId) throw new Error("Notification eventId is required");
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
    eventId: normalizedEventId,
    excerpt: notificationExcerpt(excerpt),
    createdAt,
    readAt: null,
  };
}
