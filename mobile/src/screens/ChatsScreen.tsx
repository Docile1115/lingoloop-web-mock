/** 대화 목록. */
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { toConversation, type ApiConversation } from "@shared/live-data";
import type { Conversation } from "@shared/demo-data";
import { t, tx } from "../lib/i18n";
import { useApi } from "../lib/useApi";
import { useTheme } from "../lib/useTheme";
import { radius, space, type } from "../lib/theme";
import { Avatar, Divider, EmptyState, Loading } from "../ui";

export function ChatsScreen({ onOpen }: { onOpen: (row: Conversation) => void }) {
  const c = useTheme();
  const chats = useApi<Conversation[]>(
    "/api/conversations",
    [],
    // .map(toConversation) 로 쓰면 map 이 넘기는 index 가 두 번째 인자(messages)로
    // 들어갑니다. 인자를 명시해서 막습니다.
    (raw: ApiConversation[]) => raw.map((row) => toConversation(row)),
  );

  if (chats.loading) return <Loading />;

  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      data={chats.data}
      keyExtractor={(row) => row.id}
      contentContainerStyle={chats.data.length ? undefined : { flexGrow: 1 }}
      ItemSeparatorComponent={Divider}
      refreshControl={
        <RefreshControl refreshing={chats.refreshing} onRefresh={chats.refresh} tintColor={c.primary} />
      }
      ListEmptyComponent={
        chats.error ? (
          <EmptyState title={chats.error} onRetry={chats.refresh} />
        ) : (
          <EmptyState
            emoji="💬"
            title={t("아직 대화가 없어요")}
            body={t("파트너 프로필에서 메시지를 보내면 여기에 모여요.")}
          />
        )
      }
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.surfaceSoft }]}
          onPress={() => onOpen(item)}
          accessibilityRole="button"
        >
          <Avatar name={item.name} photo={item.photo} size={54} online={item.online} />
          <View style={{ flex: 1, gap: 3 }}>
            <View style={styles.head}>
              <Text
                style={[type.name, { color: c.ink, flex: 1 }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text style={[type.caption, { color: c.subtle }]}>{tx(item.time)}</Text>
            </View>
            <Text
              style={[type.meta, { color: item.unread ? c.ink : c.subtle }]}
              numberOfLines={1}
            >
              {item.preview}
            </Text>
          </View>
          {/* 안읽음은 노랑. 초록은 "누르세요" 자리에 쓰고, 이건 알림입니다. */}
          {item.unread ? (
            <View style={[styles.unread, { backgroundColor: c.secondary }]}>
              <Text style={{ color: c.onSecondary, fontSize: 12, fontWeight: "800" }}>
                {item.unread > 99 ? "99+" : item.unread}
              </Text>
            </View>
          ) : null}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  head: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  unread: { minWidth: 24, height: 24, paddingHorizontal: 7, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
});
