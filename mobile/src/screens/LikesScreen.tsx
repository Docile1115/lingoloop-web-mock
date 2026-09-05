/**
 * 받은 마음.
 *
 * 서로 보냈으면(mutual) 바로 대화를 열 수 있습니다 — 그게 이 화면에 오는
 * 이유이므로 눈에 띄게 표시합니다.
 */
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { toPartner, type ApiProfile } from "@shared/live-data";
import type { Partner } from "@shared/demo-data";
import { t, tx } from "../lib/i18n";
import { useApi } from "../lib/useApi";
import { useTheme } from "../lib/useTheme";
import { space, type } from "../lib/theme";
import { Avatar, Badge, Divider, EmptyState, Loading, PrimaryButton } from "../ui";

type Received = { partner: ApiProfile; createdAt: string; mutual: boolean };

export function LikesScreen({
  onOpenProfile,
  onStartChat,
}: {
  onOpenProfile: (id: string) => void;
  onStartChat: (partner: Partner) => void;
}) {
  const c = useTheme();
  const likes = useApi<Array<{ partner: Partner; mutual: boolean }>>(
    "/api/likes/received",
    [],
    (raw: Received[]) => raw.map((row) => ({ partner: toPartner(row.partner), mutual: row.mutual })),
  );

  if (likes.loading) return <Loading />;

  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      data={likes.data}
      keyExtractor={(row) => row.partner.id}
      contentContainerStyle={likes.data.length ? undefined : { flexGrow: 1 }}
      ItemSeparatorComponent={Divider}
      refreshControl={
        <RefreshControl refreshing={likes.refreshing} onRefresh={likes.refresh} tintColor={c.primary} />
      }
      ListEmptyComponent={
        likes.error ? (
          <EmptyState title={likes.error} onRetry={likes.refresh} />
        ) : (
          <EmptyState
            emoji="💛"
            title={t("아직 받은 마음이 없어요")}
            body={t("파트너에게 마음을 보내면 상대도 답할 수 있어요.")}
          />
        )
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Pressable
            style={styles.who}
            onPress={() => onOpenProfile(item.partner.id)}
            accessibilityRole="button"
          >
            <Avatar
              name={item.partner.name}
              photo={item.partner.photo}
              avatarMode={item.partner.avatarMode}
              avatarConfig={item.partner.avatarConfig}
              size={50}
              online={item.partner.online}
            />
            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.head}>
                <Text style={[type.name, { color: c.ink }]} numberOfLines={1}>{item.partner.name}</Text>
                {item.mutual ? <Badge label={t("서로 보냈어요")} tone="accent" /> : null}
              </View>
              <Text style={[type.meta, { color: c.muted }]} numberOfLines={1}>
                {tx(item.partner.native)}
                <Text style={{ color: c.subtle }}> ⇄ </Text>
                {tx(item.partner.learning)}
              </Text>
            </View>
          </Pressable>
          {item.mutual ? (
            <PrimaryButton label={t("대화 시작")} onPress={() => onStartChat(item.partner)} />
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  who: { flexDirection: "row", alignItems: "center", gap: space.md },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
