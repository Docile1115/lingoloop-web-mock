/**
 * 오늘의 파트너.
 *
 * 서버 응답을 화면 모양으로 옮기는 일은 웹과 **같은 어댑터**(@shared/live-data)가
 * 합니다. 시차 계산, 언어 이름, 단계 이름 같은 규칙을 앱에서 다시 짜면 두 화면이
 * 서로 다른 말을 하게 됩니다.
 */
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { toPartner, type ApiProfile } from "@shared/live-data";
import type { Partner } from "@shared/demo-data";
import { get } from "../lib/api";
import { t, tx } from "../lib/i18n";
import { useSession } from "../lib/session";
import { useTheme } from "../lib/useTheme";
import { radius, space, tapSize } from "../lib/theme";

/** 서버가 주는 모양. 필드 이름은 backend/server.mjs 의 /api/matching/daily 와 같습니다. */
type Recommendation = { partner: ApiProfile; score: number; matchReasons?: string[] };

export function PartnersScreen() {
  const c = useTheme();
  const { me, signOut } = useSession();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await get<{ recommendations?: Recommendation[] }>("/api/matching/daily");
      setPartners((data.recommendations ?? []).map((item) => toPartner(item.partner, item.score)));
    } catch {
      // 추천을 못 받아오면 빈 화면 + 안내입니다. 가짜 사람을 채우지 않습니다.
      setError(t("추천을 불러오지 못했어요"));
    }
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[s.header, { borderBottomColor: c.line }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: c.ink }]}>{t("오늘의 파트너")}</Text>
          {me ? <Text style={[s.meta, { color: c.subtle }]}>{me.name}</Text> : null}
        </View>
        <Pressable onPress={() => void signOut()} hitSlop={12} accessibilityRole="button">
          <Text style={[s.signOut, { color: c.muted }]}>{t("로그아웃")}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={c.primary} /></View>
      ) : (
        <FlatList
          data={partners}
          keyExtractor={(item) => item.id}
          contentContainerStyle={partners.length ? s.list : s.listEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
          }
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={[s.emptyTitle, { color: c.ink }]}>
                {error || t("오늘 볼 파트너를 모두 확인했어요")}
              </Text>
              <Text style={[s.emptyBody, { color: c.subtle }]}>
                {t("내일 오전 9시에 새로운 파트너를 추천해드릴게요.")}
              </Text>
            </View>
          }
          renderItem={({ item }) => <PartnerCard partner={item} />}
        />
      )}
    </View>
  );
}

function PartnerCard({ partner }: { partner: Partner }) {
  const c = useTheme();
  return (
    <View style={[s.card, { backgroundColor: c.surfaceSoft, borderColor: c.line }]}>
      {partner.photo ? (
        <Image source={{ uri: partner.photo }} style={s.avatar} />
      ) : (
        <View style={[s.avatar, { backgroundColor: c.sunken }]} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.name, { color: c.ink }]} numberOfLines={1}>
          {partner.name}
          {partner.age ? <Text style={[s.age, { color: c.subtle }]}>  {partner.age}</Text> : null}
        </Text>
        <Text style={[s.exchange, { color: c.muted }]} numberOfLines={1}>
          {tx(partner.native)} ⇄ {tx(partner.learning)}
        </Text>
        {partner.city || partner.country ? (
          <Text style={[s.place, { color: c.subtle }]} numberOfLines={1}>
            {partner.flag} {[tx(partner.country), partner.city].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
        {partner.bio ? (
          <Text style={[s.bio, { color: c.muted }]} numberOfLines={2}>{partner.bio}</Text>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  meta: { fontSize: 12, marginTop: 2 },
  signOut: { fontSize: 13, fontWeight: "600", minHeight: tapSize, lineHeight: tapSize },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.sm },
  list: { padding: space.lg, gap: space.md },
  listEmpty: { flexGrow: 1 },
  emptyTitle: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  emptyBody: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  card: {
    flexDirection: "row",
    gap: space.md,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  avatar: { width: 52, height: 52, borderRadius: radius.pill },
  name: { fontSize: 16, fontWeight: "700" },
  age: { fontSize: 13, fontWeight: "500" },
  exchange: { fontSize: 13, fontWeight: "600" },
  place: { fontSize: 12 },
  bio: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
