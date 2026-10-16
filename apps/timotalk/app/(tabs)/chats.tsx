/**
 * 대화 목록. 메시지 요청함(받은 요청 수락·삭제)은 2단계에서 붙입니다.
 */
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { isMyTurn, useConversations } from "@/features/chats/store";
import { t } from "@/lib/i18n";
import { relativeTime } from "@/lib/time";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";
import { Avatar } from "@/ui/Avatar";
import { Card, CountBadge, Pill } from "@/ui/Bits";
import { Page } from "@/ui/Page";
import { EmptyState, ErrorState, LoadingState } from "@/ui/States";
import { Text } from "@/ui/Text";

export default function Chats() {
  const { c } = useTheme();
  const router = useRouter();
  const { conversations, loading, error, reload } = useConversations();

  return (
    <Page onRefresh={() => void reload()} refreshing={false}>
      <Text variant="display" accessibilityRole="header">
        {t("대화")}
      </Text>
      {loading && !conversations.length ? (
        <LoadingState />
      ) : error && !conversations.length ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : conversations.length === 0 ? (
        <EmptyState title={t("아직 대화가 없어요")} body={t("오늘 화면에서 파트너에게 인사해 보세요.")} />
      ) : (
        <Card padded={false}>
          {conversations.map((conversation, index) => {
            const partner = conversation.partner;
            const name = partner?.name ?? t("알 수 없는 사용자");
            const myTurn = isMyTurn(conversation);
            return (
              <Pressable
                key={conversation.id}
                onPress={() => router.push({ pathname: "/chat/[id]", params: { id: conversation.id } })}
                accessibilityRole="link"
                accessibilityLabel={t("{name}님과의 대화", { name })}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                  paddingVertical: space.md,
                  paddingHorizontal: space.lg,
                  backgroundColor: pressed ? c.surfaceSoft : "transparent",
                  borderTopWidth: index ? 1 : 0,
                  borderTopColor: c.lineSoft,
                })}
              >
                <Avatar name={name} photo={partner?.avatarUrl} avatarMode={partner?.avatarMode} avatarConfig={partner?.avatarConfig} size={48} online={partner?.status === "online"} />
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                    <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {name}
                    </Text>
                    {myTurn ? <Pill label={t("내 차례")} tone="primary" /> : null}
                    {conversation.requestStatus === "pending" ? <Pill label={t("수락 대기")} /> : null}
                    <Text variant="caption" tone="muted" style={{ marginLeft: "auto" }}>
                      {relativeTime(conversation.updatedAt)}
                    </Text>
                  </View>
                  <Text variant="callout" tone={conversation.unreadCount ? "ink" : "muted"} numberOfLines={1}>
                    {conversation.preview}
                  </Text>
                </View>
                <CountBadge count={conversation.unreadCount} />
              </Pressable>
            );
          })}
        </Card>
      )}
    </Page>
  );
}
