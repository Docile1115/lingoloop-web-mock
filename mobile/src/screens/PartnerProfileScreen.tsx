/**
 * 상대 프로필.
 *
 * 웹과 같이 프로필·글 두 탭으로 나누고, 프로필 탭 맨 아래에 비슷한 사람을 둡니다.
 * "비슷한" 판정은 언어가 겹치는지로 먼저 거릅니다 — 관심사만 보면 스페인어를
 * 가르치는 사람 밑에 베트남어를 가르치는 사람이 올라옵니다.
 */
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { toFeedPost, toPartner, type ApiPost, type ApiProfile } from "@shared/live-data";
import type { FeedPost, Partner } from "@shared/demo-data";
import { post as apiPost } from "../lib/api";
import { t, tx } from "../lib/i18n";
import { useApi } from "../lib/useApi";
import { useTheme } from "../lib/useTheme";
import { radius, space, tapSize } from "../lib/theme";
import { Avatar, EmptyState, Loading, PrimaryButton, SegmentedTabs } from "../ui";
import { RoomCard } from "../ui/RoomCard";

/** 이 사람과 비슷한 사람 몇 명. 웹의 similarPartners 와 같은 규칙입니다. */
function similarPartners(partner: Partner, directory: Partner[], limit = 6): Partner[] {
  const interests = new Set(partner.interests);
  return directory
    .filter((row) => row.id !== partner.id)
    .filter(
      (row) =>
        (row.nativeCode && row.nativeCode === partner.nativeCode) ||
        (row.learningCode && row.learningCode === partner.learningCode),
    )
    .map((row) => ({
      row,
      score:
        (row.nativeCode === partner.nativeCode ? 4 : 0) +
        (row.learningCode === partner.learningCode ? 3 : 0) +
        Math.min(3, row.interests.filter((one) => interests.has(one)).length) +
        (row.countryCode && row.countryCode === partner.countryCode ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.row);
}

export function PartnerProfileScreen({
  partnerId,
  onOpenProfile,
  onOpenPost,
  onStartChat,
}: {
  partnerId: string;
  onOpenProfile: (id: string) => void;
  onOpenPost: (row: FeedPost) => void;
  onStartChat: (partner: Partner) => void;
}) {
  const c = useTheme();
  const [tab, setTab] = useState<"profile" | "posts">("profile");
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  const directory = useApi<Partner[]>("/api/partners", [], (raw: ApiProfile[]) =>
    raw.map((row) => toPartner(row)),
  );
  const posts = useApi<FeedPost[]>("/api/posts", [], (raw: ApiPost[]) => raw.map(toFeedPost));
  const counts = useApi<{ following: number; followers: number; posts: number } | null>(
    `/api/partners/${partnerId}/follow-counts`,
    null,
    (raw: { following: number; followers: number; posts: number }) => raw,
  );

  const partner = directory.data.find((row) => row.id === partnerId);
  const theirPosts = useMemo(
    () => posts.data.filter((row) => row.authorId === partnerId),
    [posts.data, partnerId],
  );
  const similar = useMemo(
    () => (partner ? similarPartners(partner, directory.data) : []),
    [partner, directory.data],
  );

  const toggleFollow = useCallback(async () => {
    if (!partner || busy) return;
    const next = !following;
    setBusy(true);
    setFollowing(next);
    try {
      await apiPost(`/api/partners/${partner.id}/follow`, { following: next });
    } catch {
      setFollowing(!next); // 서버가 거절하면 되돌립니다.
    } finally {
      setBusy(false);
    }
  }, [partner, following, busy]);

  if (directory.loading) return <Loading />;
  if (!partner) {
    return (
      <EmptyState
        title={directory.error || t("프로필을 찾을 수 없어요")}
        onRetry={directory.refresh}
      />
    );
  }

  const facts: Array<[string, string]> = [
    partner.country ? [t("사는 곳"), [tx(partner.country), partner.city].filter(Boolean).join(" · ")] : null,
    partner.activeTime ? [t("주로 대화하는 시간"), tx(partner.activeTime)] : null,
    partner.goal ? [t("학습 목표"), tx(partner.goal)] : null,
  ].filter(Boolean) as Array<[string, string]>;

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.page}>
      <View style={styles.head}>
        <Avatar
          name={partner.name}
          photo={partner.photo}
          avatarMode={partner.avatarMode}
          avatarConfig={partner.avatarConfig}
          size={72}
          online={partner.online}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.name, { color: c.ink }]}>
            {partner.name}
            {partner.age ? <Text style={{ color: c.subtle, fontSize: 15 }}>  {partner.age}</Text> : null}
          </Text>
          <Text style={[styles.handle, { color: c.subtle }]}>{partner.handle}</Text>
          <Text style={[styles.exchange, { color: c.muted }]}>
            {tx(partner.native)} ⇄ {tx(partner.learning)}
          </Text>
        </View>
      </View>

      {partner.bio ? <Text style={[styles.bio, { color: c.muted }]}>{partner.bio}</Text> : null}
      <RoomCard name={partner.name} value={partner.roomConfig} avatar={partner.avatarConfig} />

      {counts.data ? (
        <View style={styles.stats}>
          <Text style={[styles.stat, { color: c.muted }]}>
            <Text style={{ color: c.ink, fontWeight: "700" }}>{counts.data.posts}</Text> {t("게시물")}
          </Text>
          <Text style={[styles.stat, { color: c.muted }]}>
            <Text style={{ color: c.ink, fontWeight: "700" }}>{counts.data.followers}</Text> {t("팔로워")}
          </Text>
          <Text style={[styles.stat, { color: c.muted }]}>
            <Text style={{ color: c.ink, fontWeight: "700" }}>{counts.data.following}</Text> {t("팔로잉")}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <PrimaryButton
            label={following ? t("팔로잉") : t("팔로우")}
            onPress={() => void toggleFollow()}
            busy={busy}
          />
        </View>
        <Pressable
          onPress={() => onStartChat(partner)}
          accessibilityRole="button"
          style={[styles.secondary, { borderColor: c.line }]}
        >
          <Ionicons name="chatbubble-outline" size={17} color={c.ink} />
          <Text style={{ color: c.ink, fontSize: 15, fontWeight: "600" }}>{t("메시지")}</Text>
        </Pressable>
      </View>

      <SegmentedTabs
        value={tab}
        onChange={setTab}
        options={[
          { id: "profile", label: t("프로필") },
          { id: "posts", label: `${t("글")} ${theirPosts.length}` },
        ]}
      />

      {tab === "profile" ? (
        <View style={{ gap: space.md }}>
          {partner.interests.length ? (
            <View>
              <Text style={[styles.sectionLabel, { color: c.subtle }]}>{t("관심사")}</Text>
              <View style={styles.tags}>
                {partner.interests.map((one) => (
                  <Text key={one} style={[styles.tag, { color: c.muted, backgroundColor: c.sunken }]}>
                    {one}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}

          {facts.length ? (
            <View>
              <Text style={[styles.sectionLabel, { color: c.subtle }]}>{t("등록한 정보")}</Text>
              {facts.map(([label, value]) => (
                <View key={label} style={[styles.fact, { borderTopColor: c.line }]}>
                  <Text style={[styles.factLabel, { color: c.subtle }]}>{label}</Text>
                  <Text style={[styles.factValue, { color: c.ink }]}>{value}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {similar.length ? (
            <View>
              <Text style={[styles.sectionLabel, { color: c.subtle }]}>{t("비슷한 사람")}</Text>
              <FlatList
                horizontal
                data={similar}
                keyExtractor={(row) => row.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.sm, paddingVertical: space.xs }}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => onOpenProfile(item.id)}
                    accessibilityRole="button"
                    style={[styles.similar, { backgroundColor: c.surfaceSoft, borderColor: c.line }]}
                  >
                    <Avatar
                      name={item.name}
                      photo={item.photo}
                      avatarMode={item.avatarMode}
                      avatarConfig={item.avatarConfig}
                      size={48}
                      online={item.online}
                    />
                    <Text style={[styles.similarName, { color: c.ink }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.similarMeta, { color: c.subtle }]} numberOfLines={1}>
                      {tx(item.native)} ⇄ {tx(item.learning)}
                    </Text>
                  </Pressable>
                )}
              />
            </View>
          ) : null}
        </View>
      ) : theirPosts.length ? (
        <View style={{ gap: space.sm }}>
          {theirPosts.map((row) => (
            <Pressable
              key={row.id}
              onPress={() => onOpenPost(row)}
              style={[styles.post, { backgroundColor: c.surfaceSoft, borderColor: c.line }]}
            >
              <Text style={[styles.postText, { color: c.ink }]} numberOfLines={3}>{row.text}</Text>
              <Text style={{ color: c.subtle, fontSize: 12 }}>{tx(row.time)}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={[styles.none, { color: c.subtle }]}>{t("아직 올린 글이 없어요.")}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.md },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  name: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  handle: { fontSize: 13 },
  exchange: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  bio: { fontSize: 14, lineHeight: 20 },
  stats: { flexDirection: "row", gap: space.lg },
  stat: { fontSize: 13 },
  actions: { flexDirection: "row", gap: space.sm },
  secondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    height: tapSize + 4,
    paddingHorizontal: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.button,
  },
  sectionLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: space.sm },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  tag: { fontSize: 13, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill },
  fact: { paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth, gap: 2 },
  factLabel: { fontSize: 12 },
  factValue: { fontSize: 15 },
  similar: { width: 132, alignItems: "center", gap: space.sm, padding: space.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md },
  similarName: { fontSize: 14, fontWeight: "700" },
  similarMeta: { fontSize: 11 },
  post: { padding: space.md, gap: space.xs, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md },
  postText: { fontSize: 15, lineHeight: 21 },
  none: { fontSize: 13, paddingVertical: space.lg, textAlign: "center" },
});
