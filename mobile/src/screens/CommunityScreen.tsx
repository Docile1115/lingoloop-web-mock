/**
 * 커뮤니티.
 *
 * 탭 순서와 "추천"의 뜻은 웹과 같습니다 — 최신이 기본이고, 추천은 나와 언어가
 * 맞는 사람(내 글을 고쳐줄 수 있는 사람 → 내가 도울 수 있는 사람) 순입니다.
 * 이 규칙이 두 화면에서 달라지면 같은 계정으로 보는 목록이 서로 달라집니다.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { toFeedPost, type ApiPost } from "@shared/live-data";
import type { FeedPost } from "@shared/demo-data";
import { post as apiPost } from "../lib/api";
import { t, tx } from "../lib/i18n";
import { useApi } from "../lib/useApi";
import { useSession } from "../lib/session";
import { useTheme } from "../lib/useTheme";
import { space, type } from "../lib/theme";
import { Avatar, Badge, Divider, EmptyState, Loading, SegmentedTabs } from "../ui";

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

  /* 캐릭터 저장 뒤 탭이 그대로 마운트돼 있어도 내 기존 글의 아바타를 즉시 맞춥니다. */
  useEffect(() => {
    if (!me) return;
    posts.set((rows) => rows.map((row) => row.authorId === me.id ? {
      ...row,
      photo: me.avatarUrl,
      avatarMode: me.avatarMode,
      avatarConfig: me.avatarConfig ?? undefined,
    } : row));
  }, [me?.avatarConfig, me?.avatarMode, me?.avatarUrl, me?.id, posts.set]);

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
        contentContainerStyle={visible.length ? undefined : { flexGrow: 1 }}
        ItemSeparatorComponent={Divider}
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
              emoji="🫥"
              title={t("팔로우한 사람의 글이 없어요")}
              body={t("프로필에서 팔로우하면 그 사람의 글이 여기 모여요.")}
            />
          ) : (
            <EmptyState
              emoji="✏️"
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.surfaceSoft }]}>
      {/* 왼쪽 세로줄에 아바타, 오른쪽에 내용 — 글이 길어져도 이름 자리가 흔들리지 않습니다. */}
      <Pressable onPress={onAuthor} accessibilityRole="button" hitSlop={6}>
        <Avatar
          name={post.author}
          photo={post.photo}
          avatarMode={post.avatarMode}
          avatarConfig={post.avatarConfig}
          size={42}
        />
      </Pressable>

      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.head}>
          <Text style={[type.name, { color: c.ink }]} numberOfLines={1}>
            {post.author}
          </Text>
          {post.age ? (
            <Text style={[type.caption, { color: c.subtle }]}>{post.age}</Text>
          ) : null}
          <View style={{ flex: 1 }} />
          <Text style={[type.caption, { color: c.subtle }]}>{tx(post.time)}</Text>
        </View>

        <View style={styles.langRow}>
          {post.nativeCode ? (
            <Text style={[styles.lang, { color: c.muted }]}>
              {post.nativeCode.toUpperCase()}
              <Text style={{ color: c.subtle }}> ⇄ </Text>
              {post.learningCode ? post.learningCode.toUpperCase() : ""}
            </Text>
          ) : null}
          {post.requestCorrection ? <Badge label={t("교정 부탁해요")} tone="accent" /> : null}
        </View>

        <Text style={[type.body, { color: c.ink }]}>{post.text}</Text>

        {post.tags.length ? (
          <View style={styles.tags}>
            {post.tags.map((tag) => (
              <Text key={tag} style={[styles.tag, { color: c.secondaryInk }]}>{tag}</Text>
            ))}
          </View>
        ) : null}

        {/* 숫자는 아이콘 옆이 아니라 아래에 모읍니다 — 누르는 곳과 읽는 곳을 나눕니다. */}
        <View style={styles.actions}>
          <Pressable
            onPress={onLike}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("좋아요")}
            accessibilityState={{ selected: post.liked }}
            style={styles.action}
          >
            <Ionicons
              name={post.liked ? "heart" : "heart-outline"}
              size={21}
              color={post.liked ? c.danger : c.muted}
            />
          </Pressable>
          <View style={styles.action}>
            <Ionicons name="chatbubble-outline" size={19} color={c.muted} />
          </View>
          <View style={styles.action}>
            <Ionicons name="pencil-outline" size={19} color={c.muted} />
          </View>
        </View>

        {post.likes || post.comments || post.corrections ? (
          <Text style={[type.caption, { color: c.subtle }]}>
            {[
              post.likes ? t("좋아요 {n}", { n: post.likes }) : "",
              post.comments ? t("댓글 {n}", { n: post.comments }) : "",
              post.corrections ? t("교정 {n}", { n: post.corrections }) : "",
            ].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toolbar: { paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.md },
  row: { flexDirection: "row", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  head: { flexDirection: "row", alignItems: "center", gap: space.xs },
  langRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  lang: { fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tag: { fontSize: 13, fontWeight: "700" },
  actions: { flexDirection: "row", gap: space.lg, marginTop: 2 },
  action: { minWidth: 28, minHeight: 28, alignItems: "flex-start", justifyContent: "center" },
});
