/**
 * 커뮤니티.
 *
 * 탭 순서와 "추천"의 뜻은 웹과 같습니다 — 최신이 기본이고, 추천은 나와 언어가
 * 맞는 사람(내 글을 고쳐줄 수 있는 사람 → 내가 도울 수 있는 사람) 순입니다.
 * 이 규칙이 두 화면에서 달라지면 같은 계정으로 보는 목록이 서로 달라집니다.
 */
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { toFeedPost, type ApiPost } from "@shared/live-data";
import type { FeedPost } from "@shared/demo-data";
import { post as apiPost } from "../lib/api";
import { t, tx } from "../lib/i18n";
import { useApi } from "../lib/useApi";
import { useSession } from "../lib/session";
import { useTheme } from "../lib/useTheme";
import { radius, space } from "../lib/theme";
import { Avatar, EmptyState, Loading, SegmentedTabs } from "../ui";

export type FeedTab = "latest" | "recommended" | "following";

export function CommunityScreen({
  onOpenPost,
  onOpenProfile,
}: {
  onOpenPost: (post: FeedPost) => void;
  onOpenProfile: (authorId: string) => void;
}) {
  const c = useTheme();
  const { me } = useSession();
  const [tab, setTab] = useState<FeedTab>("latest");

  const posts = useApi<FeedPost[]>("/api/posts", [], (raw: ApiPost[]) => raw.map(toFeedPost));
  const follows = useApi<string[]>("/api/follows", [], (raw: { following?: Array<{ id: string }> }) =>
    (raw.following ?? []).map((row) => row.id),
  );

  const myLearning = me?.learningLanguages?.[0]?.code ?? "";
  const myNative = me?.nativeLanguages?.[0] ?? "";

  const visible = useMemo(() => {
    const rows = posts.data.filter((row) =>
      tab === "following" ? follows.data.includes(row.authorId) : true,
    );
    if (tab !== "recommended") return rows;
    // 서버가 최신순으로 주므로 그 순서가 곧 "최신" 입니다.
    const fit = (row: FeedPost) =>
      (myLearning && row.nativeCode === myLearning ? 2 : 0) +
      (myNative && row.learningCode === myNative ? 1 : 0);
    return [...rows].sort(
      (a, b) => fit(b) - fit(a) || b.likes + b.comments - (a.likes + a.comments),
    );
  }, [posts.data, follows.data, tab, myLearning, myNative]);

  /* 좋아요는 눌린 즉시 반영하고 서버에 보냅니다. 서버가 거절하면 되돌립니다 —
     아무 일도 안 일어난 것처럼 두면 눌렸는지 아닌지 알 수 없습니다. */
  const toggleLike = useCallback(
    (row: FeedPost) => {
      const next = !row.liked;
      posts.set((rows) =>
        rows.map((one) =>
          one.id === row.id
            ? { ...one, liked: next, likes: Math.max(0, one.likes + (next ? 1 : -1)) }
            : one,
        ),
      );
      apiPost(`/api/posts/${row.id}/like`, { liked: next }).catch(() => {
        posts.set((rows) =>
          rows.map((one) =>
            one.id === row.id
              ? { ...one, liked: row.liked, likes: row.likes }
              : one,
          ),
        );
      });
    },
    [posts],
  );

  if (posts.loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.toolbar}>
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "latest", label: t("최신") },
            { id: "recommended", label: t("추천") },
            { id: "following", label: t("팔로잉") },
          ]}
        />
      </View>

      <FlatList
        data={visible}
        keyExtractor={(row) => row.id}
        contentContainerStyle={visible.length ? styles.list : { flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={posts.refreshing}
            onRefresh={() => { posts.refresh(); follows.refresh(); }}
            tintColor={c.primary}
          />
        }
        ListEmptyComponent={
          posts.error ? (
            <EmptyState title={posts.error} onRetry={posts.refresh} />
          ) : tab === "following" ? (
            <EmptyState
              title={t("팔로우한 사람의 글이 없어요")}
              body={t("프로필에서 팔로우하면 그 사람의 글이 여기 모여요.")}
            />
          ) : (
            <EmptyState
              title={t("아직 글이 없어요")}
              body={t("첫 글을 올려보세요. 원어민이 고쳐줄 수 있어요.")}
            />
          )
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPress={() => onOpenPost(item)}
            onAuthor={() => onOpenProfile(item.authorId)}
            onLike={() => toggleLike(item)}
          />
        )}
      />
    </View>
  );
}

export function PostCard({
  post,
  onPress,
  onAuthor,
  onLike,
}: {
  post: FeedPost;
  onPress?: () => void;
  onAuthor?: () => void;
  onLike?: () => void;
}) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: c.surfaceSoft, borderColor: c.line }]}
    >
      <Pressable style={styles.author} onPress={onAuthor} accessibilityRole="button">
        <Avatar name={post.author} photo={post.photo} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.authorName, { color: c.ink }]} numberOfLines={1}>
            {post.author}
            {post.age ? <Text style={{ color: c.subtle, fontWeight: "500" }}>  {post.age}</Text> : null}
          </Text>
          <Text style={[styles.authorMeta, { color: c.subtle }]} numberOfLines={1}>
            {post.nativeCode ? `${post.nativeCode.toUpperCase()} ⇄ ` : ""}
            {post.learningCode ? post.learningCode.toUpperCase() : ""}
            {post.time ? ` · ${tx(post.time)}` : ""}
          </Text>
        </View>
        {post.requestCorrection ? (
          <View style={[styles.badge, { backgroundColor: c.sunken }]}>
            <Text style={{ color: c.muted, fontSize: 11, fontWeight: "600" }}>{t("교정 부탁해요")}</Text>
          </View>
        ) : null}
      </Pressable>

      <Text style={[styles.body, { color: c.ink }]}>{post.text}</Text>

      {post.tags.length ? (
        <View style={styles.tags}>
          {post.tags.map((tag) => (
            <Text key={tag} style={[styles.tag, { color: c.muted, backgroundColor: c.sunken }]}>
              {tag}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={onLike}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("좋아요")}
          style={styles.action}
        >
          <Ionicons
            name={post.liked ? "heart" : "heart-outline"}
            size={18}
            color={post.liked ? c.danger : c.muted}
          />
          <Text style={{ color: post.liked ? c.danger : c.muted, fontSize: 13 }}>{post.likes}</Text>
        </Pressable>
        <View style={styles.action}>
          <Ionicons name="chatbubble-outline" size={17} color={c.muted} />
          <Text style={{ color: c.muted, fontSize: 13 }}>{post.comments}</Text>
        </View>
        <View style={styles.action}>
          <Ionicons name="pencil-outline" size={17} color={c.muted} />
          <Text style={{ color: c.muted, fontSize: 13 }}>{post.corrections}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toolbar: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
  list: { padding: space.lg, gap: space.md },
  card: { padding: space.md, gap: space.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md },
  author: { flexDirection: "row", alignItems: "center", gap: space.sm },
  authorName: { fontSize: 15, fontWeight: "700" },
  authorMeta: { fontSize: 12, marginTop: 1 },
  badge: { paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill },
  body: { fontSize: 15, lineHeight: 21 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  tag: { fontSize: 12, paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill },
  actions: { flexDirection: "row", gap: space.lg, marginTop: space.xs },
  action: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 28 },
});
