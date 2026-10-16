/**
 * 알림. 누르면 읽음으로 바꾸고 그 일이 있었던 곳으로 갑니다.
 *  - 메시지 요청 → 요청함, 요청 수락·새 메시지 → 그 대화방
 *  - 마음·팔로우(예전 웹의 기능) → 그 사람의 프로필
 *  - 글·댓글·교정 → 커뮤니티(글 화면은 커뮤니티를 열 때 붙입니다), 마이룸 알림 → 마이룸을 열 때 붙입니다
 * 문구는 웹과 같은 사전 키를 씁니다.
 */
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useNotifications, type AppNotification } from "@/features/notifications/store";
import { t } from "@/lib/i18n";
import { relativeTime } from "@/lib/time";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";
import { Avatar } from "@/ui/Avatar";
import { Card } from "@/ui/Bits";
import { Button } from "@/ui/Button";
import { Page } from "@/ui/Page";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { EmptyState, ErrorState, LoadingState } from "@/ui/States";
import { Text } from "@/ui/Text";

function title(notification: AppNotification): string {
  const name = notification.actor?.name || t("알 수 없는 상대");
  switch (notification.type) {
    case "home_entry":
      return t("{name}님이 방명록을 남겼어요", { name });
    case "home_reply":
      return t("{name}님이 방명록에 답했어요", { name });
    case "home_visit":
      return t("{name}님이 집에 인사를 남겼어요", { name });
    case "home_heart":
      return t("{name}님이 방명록을 좋아해요", { name });
    case "post_like":
      return t("{name}님이 내 글을 좋아해요", { name });
    case "post_reply":
      return t("{name}님이 내 글에 댓글을 남겼어요", { name });
    case "post_correction":
      return t("{name}님이 내 문장을 교정했어요", { name });
    case "comment_reply":
      return t("{name}님이 내 댓글에 답글을 남겼어요", { name });
    case "partner_like":
      return t("{name}님이 마음을 보냈어요", { name });
    case "follow":
      return t("{name}님이 나를 팔로우했어요", { name });
    case "message_request":
      return t("{name}님이 메시지 요청을 보냈어요", { name });
    case "request_accepted":
      return t("{name}님이 메시지 요청을 수락했어요", { name });
    case "message":
      return t("{name}님이 메시지를 보냈어요", { name });
  }
}

export default function Notifications() {
  const { c } = useTheme();
  const router = useRouter();
  const { items, unreadCount, loading, error, reload, markRead, markAllRead } = useNotifications();

  const open = (notification: AppNotification) => {
    void markRead(notification);
    switch (notification.type) {
      case "message_request":
        router.push("/chats?box=requests");
        return;
      case "request_accepted":
      case "message":
        if (notification.conversationId) router.push({ pathname: "/chat/[id]", params: { id: notification.conversationId } });
        return;
      case "partner_like":
      case "follow":
        if (notification.actor) router.push({ pathname: "/people/[id]", params: { id: notification.actor.id } });
        return;
      case "post_like":
      case "post_reply":
      case "post_correction":
      case "comment_reply":
        router.push("/community");
        return;
      default:
        // 마이룸 알림은 마이룸을 열 때 이어 붙입니다. 지금은 읽음으로만 바꿉니다.
        return;
    }
  };

  return (
    <Page onRefresh={() => void reload()} refreshing={false}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.md }}>
        <View style={{ flex: 1 }}>
          <ScreenHeader title={t("알림")} fallback="/" />
        </View>
        {unreadCount ? <Button label={t("모두 읽음")} variant="ghost" onPress={() => void markAllRead()} /> : null}
      </View>
      <View style={{ width: "100%", maxWidth: 640 }}>
        {loading && !items.length ? (
          <LoadingState />
        ) : error && !items.length ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : items.length === 0 ? (
          <EmptyState title={t("새 알림이 없어요")} body={t("인사·요청·교정이 오면 여기에 모여요.")} />
        ) : (
          <Card padded={false}>
            {items.map((notification, index) => {
              const unread = !notification.readAt;
              return (
                <Pressable
                  key={notification.id}
                  onPress={() => open(notification)}
                  accessibilityRole="button"
                  accessibilityLabel={[title(notification), unread ? t("안 읽음") : ""].filter(Boolean).join(", ")}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    gap: space.md,
                    paddingVertical: space.md,
                    paddingHorizontal: space.lg,
                    backgroundColor: pressed ? c.surfaceSoft : unread ? c.primarySoft : "transparent",
                    borderTopWidth: index ? 1 : 0,
                    borderTopColor: c.lineSoft,
                  })}
                >
                  <Avatar
                    name={notification.actor?.name ?? "?"}
                    photo={notification.actor?.avatarUrl}
                    avatarMode={notification.actor?.avatarMode}
                    avatarConfig={notification.actor?.avatarConfig}
                    size={40}
                  />
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text variant="body" style={{ fontWeight: unread ? "700" : "500" }}>
                      {title(notification)}
                    </Text>
                    {notification.excerpt ? (
                      <Text variant="callout" tone="muted" numberOfLines={2}>
                        {notification.excerpt}
                      </Text>
                    ) : null}
                    <Text variant="caption" tone="muted">
                      {relativeTime(notification.createdAt)}
                    </Text>
                  </View>
                  {unread ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.primaryStrong, marginTop: 6 }} /> : null}
                </Pressable>
              );
            })}
          </Card>
        )}
      </View>
    </Page>
  );
}
