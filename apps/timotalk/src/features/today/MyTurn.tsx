/**
 * 내 차례: 상대가 마지막으로 말해서 내 답을 기다리는 대화.
 */
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { isMyTurn, previewText, useConversations } from "@/features/chats/store";
import { t } from "@/lib/i18n";
import { relativeTime } from "@/lib/time";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";
import { Avatar } from "@/ui/Avatar";
import { Card, CountBadge, SectionHeader } from "@/ui/Bits";
import { ErrorState, LoadingState } from "@/ui/States";
import { Text } from "@/ui/Text";

const LIMIT = 3;

export function MyTurn() {
  const { c } = useTheme();
  const router = useRouter();
  const { conversations, loading, error, reload } = useConversations();
  const waiting = conversations.filter(isMyTurn);

  return (
    <View style={{ gap: space.md }}>
      <SectionHeader
        title={t("내 차례")}
        detail={waiting.length ? t("답장을 기다리는 대화 {n}", { n: waiting.length }) : undefined}
      />
      {loading && !conversations.length ? (
        <LoadingState />
      ) : error && !conversations.length ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : waiting.length === 0 ? (
        <Text variant="callout" tone="muted">
          {t("답장을 기다리는 대화가 없어요.")}
        </Text>
      ) : (
        <Card padded={false}>
          {waiting.slice(0, LIMIT).map((conversation, index) => {
            const partner = conversation.partner;
            if (!partner) return null;
            return (
              <Pressable
                key={conversation.id}
                onPress={() => router.push({ pathname: "/chat/[id]", params: { id: conversation.id } })}
                accessibilityRole="link"
                accessibilityLabel={t("{name}님과의 대화", { name: partner.name })}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                  paddingVertical: space.sm + 2,
                  paddingHorizontal: space.md + 2,
                  backgroundColor: pressed ? c.surfaceSoft : "transparent",
                  borderTopWidth: index ? 1 : 0,
                  borderTopColor: c.lineSoft,
                })}
              >
                <Avatar name={partner.name} photo={partner.avatarUrl} avatarMode={partner.avatarMode} avatarConfig={partner.avatarConfig} size={40} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
                    <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {partner.name}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {relativeTime(conversation.updatedAt)}
                    </Text>
                  </View>
                  <Text variant="callout" tone="muted" numberOfLines={1}>
                    {previewText(conversation)}
                  </Text>
                </View>
                <CountBadge count={conversation.unreadCount} />
              </Pressable>
            );
          })}
        </Card>
      )}
    </View>
  );
}
