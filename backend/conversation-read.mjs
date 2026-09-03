function safeUnreadCount(value) {
  const count = Number(value || 0);
  return Number.isSafeInteger(count) && count > 0 ? count : 0;
}

/**
 * 화면에 실제로 반환할 메시지 스냅샷까지만 읽음 상태를 전진시킵니다.
 *
 * snapshot 이후 새 메시지가 도착했으면 현재 unread에서 이번 화면에 포함된 받은
 * 메시지만 빼 새 메시지 수를 보존합니다. 현재 마지막 메시지가 snapshot과 같으면
 * 더 새로운 메시지가 없으므로 unread를 0으로 정리할 수 있습니다.
 */
export function buildConversationReadPatch(conversation = {}, messages = [], readerId) {
  const currentReadAt = conversation.readAt && typeof conversation.readAt === "object"
    ? conversation.readAt
    : {};
  const currentUnread = conversation.unread && typeof conversation.unread === "object"
    ? conversation.unread
    : {};
  const latest = messages.length ? messages[messages.length - 1] : null;
  const latestAt = typeof latest?.sentAt === "string" ? latest.sentAt : "";
  const previousReadAt = typeof currentReadAt[readerId] === "string" ? currentReadAt[readerId] : "";

  if (!latestAt || (previousReadAt && previousReadAt >= latestAt)) return null;

  const visibleIncoming = messages.filter((message) => {
    const sentAt = typeof message?.sentAt === "string" ? message.sentAt : "";
    return message?.senderId !== readerId && sentAt > previousReadAt && sentAt <= latestAt;
  }).length;
  const hasNewerMessage =
    typeof conversation.lastMessageAt === "string" && conversation.lastMessageAt > latestAt;
  const unreadBefore = safeUnreadCount(currentUnread[readerId]);
  const unreadAfter = hasNewerMessage ? Math.max(0, unreadBefore - visibleIncoming) : 0;

  return {
    readAt: { ...currentReadAt, [readerId]: latestAt },
    unread: { ...currentUnread, [readerId]: unreadAfter },
  };
}

/**
 * 대화 삭제는 실제 메시지를 지우지 않고 사용자별 목록 노출만 숨깁니다.
 * 예전 문서에는 hiddenBy가 없으므로 배열이 아닌 값은 안전하게 미숨김으로 봅니다.
 */
export function isConversationHidden(conversation = {}, uid) {
  return Array.isArray(conversation.hiddenBy) && conversation.hiddenBy.includes(uid);
}
