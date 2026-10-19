/**
 * 알림을 누르면 갈 곳. 앱 안 알림 목록과 폰 알림(눌러서 열기)이 같은 규칙을 씁니다.
 *  - 메시지 요청 → 요청함, 요청 수락·새 메시지 → 그 대화방
 *  - 마음·팔로우(예전 웹의 기능) → 그 사람의 프로필
 *  - 글·댓글·교정 → 그 글(글 id 가 없는 옛 알림은 커뮤니티)
 *  - 마이룸 알림 → 갈 곳 없음(마이룸을 열 때 이어 붙입니다)
 */
import type { Href } from "expo-router";

export type NotificationPlace = { type: string; conversationId?: string; postId?: string; actorId?: string };

export function notificationHref({ type, conversationId, postId, actorId }: NotificationPlace): Href | null {
  switch (type) {
    case "message_request":
      return "/chats?box=requests";
    case "request_accepted":
    case "message":
      return conversationId ? { pathname: "/chat/[id]", params: { id: conversationId } } : null;
    case "partner_like":
    case "follow":
      return actorId ? { pathname: "/people/[id]", params: { id: actorId } } : null;
    case "post_like":
    case "post_reply":
    case "post_correction":
    case "comment_reply":
      return postId ? { pathname: "/community/[postId]", params: { postId } } : "/community";
    default:
      return null;
  }
}
