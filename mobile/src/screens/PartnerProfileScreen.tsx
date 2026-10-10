/**
 * 상대 프로필.
 *
 * 웹과 같이 프로필·글 두 탭으로 나누고, 프로필 탭 맨 아래에 비슷한 사람을 둡니다.
 * "비슷한" 판정은 언어가 겹치는지로 먼저 거릅니다 — 관심사만 보면 스페인어를
 * 가르치는 사람 밑에 베트남어를 가르치는 사람이 올라옵니다.
 *
 * 프로필은 GET /api/partners/:id 로 한 사람만 받습니다. 예전에는 사람 목록 전체를
 * 받아 그 안에서 찾았습니다. 처음에 보내는 요청도 줄였습니다 — 비슷한 사람(전체 목록)은
 * 프로필이 뜬 뒤에, 글 목록은 글 탭을 열 때 받습니다.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { toFeedPost, toPartner, type ApiPost, type ApiProfile } from "@shared/live-data";
import type { FeedPost, Partner } from "@shared/demo-data";
import { ApiError, get, post as apiPost } from "../lib/api";
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
  onVisitHome,
}: {
  partnerId: string;
  onOpenProfile: (id: string) => void;
  onOpenPost: (row: FeedPost) => void;
  onStartChat: (partner: Partner) => void;
  onVisitHome: (id:string) => void;
}) {
  const c = useTheme();
  const [tab, setTab] = useState<"profile" | "posts">("profile");
  // 직접 바꾼 값. 없으면 서버의 팔로우 목록을 따릅니다.
  const [followOverride, setFollowOverride] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  /** 비슷한 사람을 고를 명부. 예전 서버로 찾느라 이미 받았으면 다시 받지 않습니다. */
  const [directory, setDirectory] = useState<Partner[] | null>(null);

  useEffect(() => {
    let alive = true;
    setLoadError("");
    const load = async () => {
      try {
        const profile = await get<ApiProfile>(`/api/partners/${encodeURIComponent(partnerId)}`);
        if (alive) setPartner(toPartner(profile));
      } catch (caught) {
        // 새 경로가 없는 예전 서버는 "경로 없음"(404 NOT_FOUND)을 줍니다. 그때만 전체 목록에서 찾습니다.
        // 없거나 차단된 사람은 404 PARTNER_NOT_FOUND 라 여기로 오지 않습니다.
        if (caught instanceof ApiError && caught.status === 404 && caught.code === "NOT_FOUND") {
          const rows = (await get<ApiProfile[]>("/api/partners")).map((row) => toPartner(row));
          if (!alive) return;
          setDirectory(rows);
          const found = rows.find((row) => row.id === partnerId);
          if (found) setPartner(found);
          else setLoadError(t("프로필을 찾을 수 없어요"));
          return;
        }
        throw caught;
      }
    };
    load()
      .catch((caught) => {
        if (!alive) return;
        setLoadError(
          caught instanceof ApiError && caught.status === 404
            ? t("프로필을 찾을 수 없어요")
            : caught instanceof ApiError
              ? caught.message
              : t("불러오지 못했어요."),
        );
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [partnerId, attempt]);

  // 비슷한 사람은 프로필이 뜬 뒤에 받습니다. 못 받아도 그 칸만 비웁니다.
  useEffect(() => {
    if (!partner || directory) return;
    let alive = true;
    get<ApiProfile[]>("/api/partners")
      .then((rows) => { if (alive) setDirectory(rows.map((row) => toPartner(row))); })
      .catch(() => { /* 비슷한 사람은 덤입니다. 프로필은 그대로 보여줍니다. */ });
    return () => { alive = false; };
  }, [partner, directory]);

  // 글 목록은 글 탭을 열 때 받습니다. 개수는 아래 follow-counts 가 알려줍니다.
  const [postsWanted, setPostsWanted] = useState(false);
  const posts = useApi<FeedPost[]>(postsWanted ? "/api/posts" : null, [], (raw: ApiPost[]) => raw.map(toFeedPost));
  const counts = useApi<{ following: number; followers: number; posts: number } | null>(
    `/api/partners/${encodeURIComponent(partnerId)}/follow-counts`,
    null,
    (raw: { following: number; followers: number; posts: number }) => raw,
  );
  const follows = useApi<string[]>("/api/follows", [], (raw: string[]) => raw ?? []);
  const following = followOverride ?? follows.data.includes(partnerId);

  const theirPosts = useMemo(
    () => posts.data.filter((row) => row.authorId === partnerId),
    [posts.data, partnerId],
  );
  const similar = useMemo(
    () => (partner && directory ? similarPartners(partner, directory) : []),
    [partner, directory],
  );

  const toggleFollow = useCallback(async () => {
    if (!partner || busy) return;
    const next = !following;
    setBusy(true);
    setError("");
    setFollowOverride(next);
    try {
      const result = await apiPost<{ following: boolean }>(`/api/partners/${partner.id}/follow`, { following: next });
      setFollowOverride(result.following);
      counts.reload();
    } catch (caught) {
      setFollowOverride(!next); // 서버가 거절하면 되돌립니다.
      setError(caught instanceof ApiError ? caught.message : t("요청을 처리하지 못했어요."));
    } finally {
      setBusy(false);
    }
  }, [partner, following, busy, counts.reload]);

  if (loading) return <Loading />;
  if (!partner) {
    return (
      <EmptyState
        title={loadError || t("프로필을 찾을 수 없어요")}
        onRetry={() => {
          setLoading(true);
          setAttempt((n) => n + 1);
        }}
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
      <RoomCard name={partner.name} value={partner.roomConfig} avatar={partner.avatarConfig} onVisit={()=>onVisitHome(partner.id)} />

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
            busy={busy || follows.loading}
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
      {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}

      <SegmentedTabs
        value={tab}
        onChange={(next) => {
          if (next === "posts") setPostsWanted(true);
          setTab(next);
        }}
        options={[
          { id: "profile", label: t("프로필") },
          {
            id: "posts",
            label: counts.data ? `${t("글")} ${counts.data.posts}` : postsWanted && !posts.loading ? `${t("글")} ${theirPosts.length}` : t("글"),
          },
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
      ) : posts.loading ? (
        <ActivityIndicator color={c.primary} style={{ paddingVertical: space.lg }} />
      ) : posts.error && !theirPosts.length ? (
        <EmptyState title={posts.error} onRetry={posts.refresh} />
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
  error: { fontSize: 13 },
});
