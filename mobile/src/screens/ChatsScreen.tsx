/** 대화 목록. */
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { toConversation, type ApiConversation } from "@shared/live-data";
import type { Conversation } from "@shared/demo-data";
import { t, tx } from "../lib/i18n";
import { useApi } from "../lib/useApi";
import { useTheme } from "../lib/useTheme";
import { radius, space } from "../lib/theme";
import { Avatar, EmptyState, Loading } from "../ui";

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
      contentContainerStyle={chats.data.length ? styles.list : { flexGrow: 1 }}
      refreshControl={
        <RefreshControl refreshing={chats.refreshing} onRefresh={chats.refresh} tintColor={c.primary} />
      }
      ListEmptyComponent={
        chats.error ? (
          <EmptyState title={chats.error} onRetry={chats.refresh} />
        ) : (
          <EmptyState
            title={t("아직 대화가 없어요")}
            body={t("파트너 프로필에서 메시지를 보내면 여기에 모여요.")}
          />
        )
      }
      renderItem={({ item }) => (
        <Pressable
          style={[styles.row, { borderBottomColor: c.line }]}
          onPress={() => onOpen(item)}
          accessibilityRole="button"
        >
          <Avatar name={item.name} photo={item.photo} size={50} online={item.online} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={styles.head}>
              <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.time, { color: c.subtle }]}>{tx(item.time)}</Text>
            </View>
            <Text style={[styles.preview, { color: c.muted }]} numberOfLines={1}>
              {item.preview}
            </Text>
          </View>
          {item.unread ? (
            <View style={[styles.unread, { backgroundColor: c.primary }]}>
              <Text style={{ color: c.onPrimary, fontSize: 11, fontWeight: "700" }}>
                {item.unread}
              </Text>
            </View>
          ) : null}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  head: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  name: { flex: 1, fontSize: 16, fontWeight: "600" },
  time: { fontSize: 12 },
  preview: { fontSize: 14 },
  unread: { minWidth: 20, height: 20, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
});
