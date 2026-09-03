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
import { matchReasonText, toPartner, type ApiProfile, type MatchReasonCode } from "@shared/live-data";
import type { Partner } from "@shared/demo-data";
import { post as apiPost } from "../lib/api";
import { t, tx } from "../lib/i18n";
import { useApi } from "../lib/useApi";
import { useTheme } from "../lib/useTheme";
import { radius, space, type } from "../lib/theme";
import { Avatar, Badge, Divider, EmptyState, Loading, PrimaryButton } from "../ui";

/** 서버가 주는 모양. backend/server.mjs 의 /api/matching/daily 와 같습니다. */
type Recommendation = {
  partner: ApiProfile;
  score: number;
  matchReasons?: string[];
  matchReasonCodes?: MatchReasonCode[];
};

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
        // 서버가 코드를 주면 지금 언어로 그립니다. 없으면 서버가 준 문장 그대로.
        reasons: row.matchReasonCodes?.length
          ? row.matchReasonCodes.map((code, index) => matchReasonText(code, row.matchReasons?.[index] ?? ""))
          : (row.matchReasons ?? []).map((reason) => tx(reason)),
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
      ItemSeparatorComponent={Divider}
      refreshControl={
        <RefreshControl refreshing={daily.refreshing} onRefresh={daily.refresh} tintColor={c.primary} />
      }
      ListEmptyComponent={
        daily.error ? (
          <EmptyState title={daily.error} onRetry={daily.refresh} />
        ) : (
          <EmptyState
            emoji="🌙"
            title={t("오늘 볼 파트너를 모두 확인했어요")}
            body={t("내일 오전 9시에 새로운 파트너를 추천해드릴게요.")}
          />
        )
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Pressable
            style={styles.head}
            onPress={() => onOpenProfile(item.partner.id)}
            accessibilityRole="button"
          >
            <Avatar
              name={item.partner.name}
              photo={item.partner.photo}
              avatarMode={item.partner.avatarMode}
              avatarConfig={item.partner.avatarConfig}
              size={54}
              online={item.partner.online}
            />
            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.nameRow}>
                <Text style={[type.title, { color: c.ink }]} numberOfLines={1}>
                  {item.partner.name}
                </Text>
                {item.partner.age ? (
                  <Text style={[type.meta, { color: c.subtle }]}>{item.partner.age}</Text>
                ) : null}
              </View>
              <Text style={[styles.exchange, { color: c.muted }]} numberOfLines={1}>
                {tx(item.partner.native)}
                <Text style={{ color: c.subtle }}> ⇄ </Text>
                {tx(item.partner.learning)}
              </Text>
              {item.partner.country ? (
                <Text style={[type.caption, { color: c.subtle }]} numberOfLines={1}>
                  {[tx(item.partner.country), item.partner.city].filter(Boolean).join(" · ")}
                </Text>
              ) : null}
            </View>
          </Pressable>

          {item.partner.bio ? (
            <Text style={[type.body, { color: c.muted }]} numberOfLines={3}>
              {item.partner.bio}
            </Text>
          ) : null}

          {/* 왜 이 사람인지. 노랑은 여기서 제 몫을 합니다 — 눈에 띄되 누르라고 조르지 않습니다. */}
          {item.reasons.length ? (
            <View style={styles.reasons}>
              {item.reasons.slice(0, 2).map((reason) => (
                <Badge key={reason} label={reason} tone="accent" />
              ))}
            </View>
          ) : null}

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label={liked[item.partner.id] ? t("마음을 보냈어요") : t("마음 보내기")}
                onPress={() => void sendLike(item.partner)}
                disabled={liked[item.partner.id]}
                busy={busy === item.partner.id}
              />
            </View>
            <Pressable
              onPress={() => onStartChat(item.partner)}
              accessibilityRole="button"
              accessibilityLabel={t("메시지")}
              style={({ pressed }) => [
                styles.iconAction,
                { backgroundColor: c.sunken, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="chatbubble-outline" size={20} color={c.ink} />
            </Pressable>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: space.sm },
  card: { gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.lg },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  nameRow: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  exchange: { fontSize: 14, fontWeight: "700" },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  actions: { flexDirection: "row", alignItems: "center", gap: space.sm },
  iconAction: { width: 50, height: 50, alignItems: "center", justifyContent: "center", borderRadius: radius.button },
});
