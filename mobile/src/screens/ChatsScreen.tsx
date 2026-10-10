/**
 * 대화 목록.
 *
 * 웹과 같이 받은 대화함과 메시지 요청함을 나눠 보여줍니다. 요청은 수락하기 전까지
 * 답장할 수 없으므로 목록에서 바로 수락하거나 삭제할 수 있게 합니다.
 */
import { useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Conversation } from "@shared/demo-data";
import { api } from "../lib/api";
import { useChats } from "../lib/chats";
import { t, tx } from "../lib/i18n";
import { useReloadOnFocus } from "../lib/useApi";
import { useTheme } from "../lib/useTheme";
import { radius, space, tapSize, type } from "../lib/theme";
import { Avatar, Badge, Divider, EmptyState, Loading, SegmentedTabs } from "../ui";
import { showToast } from "../ui/Toast";

/** 받은 요청 수락·삭제. 대화방의 요청 안내에서도 같은 것을 씁니다. */
export async function acceptRequest(id: string, name: string): Promise<boolean> {
  try {
    await api(`/api/conversations/${encodeURIComponent(id)}/accept`, { method: "POST", body: "{}" });
    showToast(t("{name}님의 요청을 수락했어요", { name }));
    return true;
  } catch (caught) {
    showToast(caught instanceof Error ? caught.message : t("요청을 수락하지 못했어요."));
    return false;
  }
}

/** 삭제하면 요청과 첫 메시지가 서버에서 지워집니다. 상대에게는 알리지 않습니다. */
export function confirmDeclineRequest(id: string, name: string, onDone: () => void) {
  Alert.alert(t("삭제하면 되돌릴 수 없어요. 삭제할까요?"), undefined, [
    { text: t("취소"), style: "cancel" },
    {
      text: t("삭제"),
      style: "destructive",
      onPress: () => {
        api(`/api/conversations/${encodeURIComponent(id)}/request`, { method: "DELETE" })
          .then(() => {
            showToast(t("{name}님의 요청을 삭제했어요 · 상대에게 알리지 않아요", { name }));
            onDone();
          })
          .catch((caught) => {
            showToast(caught instanceof Error ? caught.message : t("요청을 삭제하지 못했어요."));
          });
      },
    },
  ]);
}

export function ChatsScreen({ onOpen }: { onOpen: (row: Conversation, request: boolean) => void }) {
  const c = useTheme();
  const chats = useChats();
  const [box, setBox] = useState<"all" | "requests">("all");
  const [busyId, setBusyId] = useState("");
  /* 대화방에서 돌아오면 미리보기·안읽음 수를 다시 받습니다. */
  useReloadOnFocus(() => void chats.reload());

  if (chats.loading) return <Loading />;

  const rows = box === "requests" ? chats.requests : chats.conversations;

  const accept = async (row: Conversation) => {
    if (busyId) return;
    setBusyId(row.id);
    const accepted = await acceptRequest(row.id, row.name);
    setBusyId("");
    if (!accepted) return;
    setBox("all");
    await chats.reload();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.toolbar}>
        <SegmentedTabs
          value={box}
          onChange={setBox}
          options={[
            { id: "all", label: t("전체") },
            {
              id: "requests",
              label: chats.requests.length ? `${t("요청함")} ${chats.requests.length}` : t("요청함"),
            },
          ]}
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={rows.length ? undefined : { flexGrow: 1 }}
        ItemSeparatorComponent={Divider}
        refreshControl={
          <RefreshControl refreshing={chats.refreshing} onRefresh={chats.refresh} tintColor={c.primary} />
        }
        ListEmptyComponent={
          chats.error ? (
            <EmptyState title={chats.error} onRetry={chats.refresh} />
          ) : box === "requests" ? (
            <EmptyState emoji="📭" title={t("여기에 표시할 대화가 없어요")} />
          ) : (
            <EmptyState
              emoji="💬"
              title={t("아직 대화가 없어요")}
              body={t("파트너 프로필에서 메시지를 보내면 여기에 모여요.")}
            />
          )
        }
        renderItem={({ item }) => {
          const request = box === "requests";
          return (
            <View>
              <Pressable
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.surfaceSoft }]}
                onPress={() => onOpen(item, request)}
                accessibilityRole="button"
              >
                <Avatar
                  name={item.name}
                  photo={item.photo}
                  avatarMode={item.avatarMode}
                  avatarConfig={item.avatarConfig}
                  size={54}
                  online={item.online}
                />
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.head}>
                    <Text style={[type.name, { color: c.ink, flexShrink: 1 }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.muted ? (
                      <Ionicons
                        name="notifications-off-outline"
                        size={13}
                        color={c.subtle}
                        accessibilityLabel={t("알림 끔")}
                      />
                    ) : null}
                    <View style={{ flex: 1 }} />
                    <Text style={[type.caption, { color: c.subtle }]}>{tx(item.time)}</Text>
                  </View>
                  <Text
                    style={[type.meta, { color: item.unread ? c.ink : c.subtle }]}
                    numberOfLines={1}
                  >
                    {item.preview}
                  </Text>
                  {request ? <View style={{ flexDirection: "row" }}><Badge label={t("새 메시지 요청")} /></View> : null}
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
              {request ? (
                <View style={styles.requestActions}>
                  <Pressable
                    onPress={() => confirmDeclineRequest(item.id, item.name, () => chats.remove(item.id))}
                    disabled={busyId === item.id}
                    accessibilityRole="button"
                    style={[styles.requestButton, { backgroundColor: c.sunken }]}
                  >
                    <Text style={{ color: c.ink, fontSize: 14, fontWeight: "700" }}>{t("삭제")}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void accept(item)}
                    disabled={busyId === item.id}
                    accessibilityRole="button"
                    style={[styles.requestButton, { backgroundColor: c.primary, opacity: busyId === item.id ? 0.5 : 1 }]}
                  >
                    <Text style={{ color: c.onPrimary, fontSize: 14, fontWeight: "800" }}>{t("수락")}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  head: { flexDirection: "row", alignItems: "center", gap: space.xs },
  unread: { minWidth: 24, height: 24, paddingHorizontal: 7, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  requestActions: { flexDirection: "row", justifyContent: "flex-end", gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md },
  requestButton: { minHeight: tapSize, minWidth: 76, paddingHorizontal: space.lg, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
});
