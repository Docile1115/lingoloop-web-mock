/**
 * 이 기기의 폰 알림 상태.
 *  - unsupported: 웹(알림은 앱 안 알림 목록으로 봅니다)
 *  - unconfigured: 이 앱 빌드에 푸시 설정(EAS 프로젝트 id)이 없음
 *  - denied: 기기 설정에서 알림을 막아 둠(앱이 다시 물을 수 없음)
 */
export type PushStatus = "unsupported" | "unconfigured" | "denied" | "off" | "on";

/** 폰 알림을 눌렀을 때 서버가 실어 보낸 값(backend/push.mjs buildPushMessages) */
export type PushOpen = { notificationId: string; eventId: string; type: string; conversationId: string; postId: string };
