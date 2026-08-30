/**
 * 오늘의 파트너.
 *
 * 서버 응답을 화면 모양으로 옮기는 일은 웹과 같은 어댑터(@shared/live-data)가
 * 합니다. 시차·언어 이름·단계 이름 규칙을 앱에서 다시 짜면 두 화면이 서로 다른
 * 말을 하게 됩니다.
 */
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { toPartner, type ApiProfile } from "@shared/live-data";
import type { Partner } from "@shared/demo-data";
import { post as apiPost } from "../lib/api";
import { t, tx } from "../lib/i18n";
import { useApi } from "../lib/useApi";
import { useTheme } from "../lib/useTheme";
import { radius, space, tapSize } from "../lib/theme";
import { Avatar, EmptyState, Loading } from "../ui";

/** 서버가 주는 모양. backend/server.mjs 의 /api/matching/daily 와 같습니다. */
type Recommendation = { partner: ApiProfile; score: number; matchReasons?: string[] };

export function PartnersScreen({
  onOpenProfile,
  onStartChat,
}: {
  onOpenProfile: (id: string) => void;
  onStartChat: (partner: Partner) => void;
}) {
  const c = useTheme();
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState("");

  const daily = useApi<Array<{ partner: Partner; reasons: string[] }>>(
    "/api/matching/daily",
    [],
    (raw: { recommendations?: Recommendation[] }) =>
      (raw.recommendations ?? []).map((row) => ({
        partner: toPartner(row.partner, row.score),
        reasons: row.matchReasons ?? [],
      })),
  );

  /* 마음 보내기. 예전 웹에서는 화면 상태만 바꾸고 상대에게는 아무 일도
     일어나지 않았습니다 — 서버에 남겨야 상대가 받은 마음에서 볼 수 있습니다. */
  const sendLike = useCallback(async (partner: Partner) => {
    if (busy) return;
    setBusy(partner.id);
    setLiked((rows) => ({ ...rows, [partner.id]: true }));
    try {
      await apiPost(`/api/partners/${partner.id}/like`, { liked: true });
    } catch {
      setLiked((rows) => ({ ...rows, [partner.id]: false }));
    } finally {
      setBusy("");
    }
  }, [busy]);

  if (daily.loading) return <Loading />;

  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      data={daily.data}
      keyExtractor={(row) => row.partner.id}
      contentContainerStyle={daily.data.length ? styles.list : { flexGrow: 1 }}
      refreshControl={
        <RefreshControl refreshing={daily.refreshing} onRefresh={daily.refresh} tintColor={c.primary} />
      }
      ListEmptyComponent={
        daily.error ? (
          <EmptyState title={daily.error} onRetry={daily.refresh} />
        ) : (
          <EmptyState
            title={t("오늘 볼 파트너를 모두 확인했어요")}
            body={t("내일 오전 9시에 새로운 파트너를 추천해드릴게요.")}
          />
        )
      }
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: c.surfaceSoft, borderColor: c.line }]}>
          <Pressable
            style={styles.head}
            onPress={() => onOpenProfile(item.partner.id)}
            accessibilityRole="button"
          >
            <Avatar
              name={item.partner.name}
              photo={item.partner.photo}
              size={56}
              online={item.partner.online}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>
                {item.partner.name}
                {item.partner.age ? (
                  <Text style={{ color: c.subtle, fontSize: 14, fontWeight: "500" }}>
                    {"  "}{item.partner.age}
                  </Text>
                ) : null}
              </Text>
              <Text style={[styles.exchange, { color: c.muted }]} numberOfLines={1}>
                {tx(item.partner.native)} ⇄ {tx(item.partner.learning)}
              </Text>
              {item.partner.country ? (
                <Text style={[styles.place, { color: c.subtle }]} numberOfLines={1}>
                  {[tx(item.partner.country), item.partner.city].filter(Boolean).join(" · ")}
                </Text>
              ) : null}
            </View>
          </Pressable>

          {item.partner.bio ? (
            <Text style={[styles.bio, { color: c.muted }]} numberOfLines={3}>
              {item.partner.bio}
            </Text>
          ) : null}

          {item.reasons.length ? (
            <View style={styles.reasons}>
              {item.reasons.slice(0, 2).map((reason) => (
                <Text
                  key={reason}
                  style={[styles.reason, { color: c.primaryStrong, backgroundColor: c.sunken }]}
                >
                  {tx(reason)}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={() => void sendLike(item.partner)}
              disabled={liked[item.partner.id] || busy === item.partner.id}
              accessibilityRole="button"
              style={[
                styles.action,
                {
                  backgroundColor: liked[item.partner.id] ? c.sunken : c.primary,
                },
              ]}
            >
              <Ionicons
                name={liked[item.partner.id] ? "heart" : "heart-outline"}
                size={17}
                color={liked[item.partner.id] ? c.subtle : c.onPrimary}
              />
              <Text
                style={{
                  color: liked[item.partner.id] ? c.subtle : c.onPrimary,
                  fontSize: 14,
                  fontWeight: "700",
                }}
              >
                {liked[item.partner.id] ? t("마음을 보냈어요") : t("마음 보내기")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onStartChat(item.partner)}
              accessibilityRole="button"
              style={[styles.action, { borderWidth: StyleSheet.hairlineWidth, borderColor: c.line }]}
            >
              <Ionicons name="chatbubble-outline" size={16} color={c.ink} />
              <Text style={{ color: c.ink, fontSize: 14, fontWeight: "600" }}>{t("메시지")}</Text>
            </Pressable>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.md },
  card: { padding: space.md, gap: space.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  name: { fontSize: 17, fontWeight: "700" },
  exchange: { fontSize: 13, fontWeight: "600" },
  place: { fontSize: 12 },
  bio: { fontSize: 14, lineHeight: 20 },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  reason: { fontSize: 12, paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.xs },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: tapSize,
    borderRadius: radius.button,
  },
});
