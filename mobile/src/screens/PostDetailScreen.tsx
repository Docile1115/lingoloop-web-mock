/**
 * 글 상세와 댓글. 댓글은 서버에 남고 새로고침해도 그대로입니다.
 *
 * 웹의 글 상세와 같이 좋아요·댓글·교정을 여기서 바로 할 수 있습니다.
 * 교정은 원문을 고쳐 적는 댓글입니다 — 원문을 입력칸에 채워 주고, 고친 문장과
 * 원문을 함께 보냅니다. 목록에서는 원문(지운 줄)과 고친 문장을 나란히 보여
 * 일반 댓글과 구분합니다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  InteractionManager,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { toPostReply, type ApiReply } from "@shared/live-data";
import type { FeedPost, PostReply } from "@shared/demo-data";
import { ApiError, post as apiPost } from "../lib/api";
import { t, tx } from "../lib/i18n";
import { useApi } from "../lib/useApi";
import { useTheme } from "../lib/useTheme";
import { radius, space, tapSize } from "../lib/theme";
import { Avatar, Badge, EmptyState, Loading, SegmentedTabs } from "../ui";
import { PostCard } from "./CommunityScreen";

export function PostDetailScreen({
  post: initialPost,
  compose,
  onOpenProfile,
}: {
  post: FeedPost;
  /** 피드에서 댓글·교정 단추로 들어왔으면 그 입력칸을 바로 엽니다. */
  compose?: "reply" | "correction";
  onOpenProfile: (authorId: string) => void;
}) {
  const c = useTheme();
  const [post, setPost] = useState(initialPost);
  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<"reply" | "correction">("reply");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<TextInput>(null);
  const liking = useRef(false);

  const replies = useApi<PostReply[]>(
    `/api/posts/${post.id}/replies`,
    [],
    (raw: ApiReply[]) => raw.map(toPostReply),
  );

  /** 교정 모드: 원문을 입력칸에 채워서 고치게 합니다. 이미 쓰던 글이 있으면 지우지 않습니다. */
  const startCorrection = useCallback(() => {
    setKind("correction");
    setDraft((current) => (current.trim() && current !== post.text ? current : post.text));
    inputRef.current?.focus();
  }, [post.text]);

  const startReply = useCallback(() => {
    setKind("reply");
    // 원문을 손대지 않았다면 비웁니다 — 실수로 원문이 일반 댓글로 나가지 않게 합니다.
    setDraft((current) => (current === post.text ? "" : current));
    inputRef.current?.focus();
  }, [post.text]);

  useEffect(() => {
    if (!compose) return;
    // 화면이 다 열린 뒤에 입력칸을 엽니다. 넘어가는 중에 키보드를 올리면 화면이 튑니다.
    const task = InteractionManager.runAfterInteractions(() => {
      if (compose === "correction") startCorrection();
      else startReply();
    });
    return () => task.cancel();
    // 처음 들어올 때 한 번만 엽니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 좋아요는 눌린 즉시 반영하고 서버에 보냅니다. 서버가 거절하면 되돌립니다. */
  const toggleLike = useCallback(async () => {
    if (liking.current) return;
    liking.current = true;
    const before = post;
    const next = !before.liked;
    setPost({ ...before, liked: next, likes: Math.max(0, before.likes + (next ? 1 : -1)) });
    try {
      const result = await apiPost<{ liked: boolean; likes: number }>(`/api/posts/${post.id}/like`, { liked: next });
      setPost((current) => ({ ...current, liked: result.liked, likes: result.likes }));
    } catch (caught) {
      setPost((current) => ({ ...current, liked: before.liked, likes: before.likes }));
      setError(caught instanceof ApiError ? caught.message : t("요청을 처리하지 못했어요."));
    } finally {
      liking.current = false;
    }
  }, [post]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    if (kind === "correction" && text === post.text.trim()) {
      setError(t("원문에서 고친 부분이 없어요"));
      return;
    }
    setSending(true);
    setError("");
    try {
      const created = await apiPost<ApiReply>(`/api/posts/${post.id}/replies`, {
        text,
        kind,
        ...(kind === "correction" ? { original: post.text } : {}),
      });
      replies.set((rows) => [...rows, toPostReply(created)]);
      setPost((current) =>
        kind === "correction"
          ? { ...current, corrections: current.corrections + 1 }
          : { ...current, comments: current.comments + 1 },
      );
      setDraft("");
      setKind("reply");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("요청을 처리하지 못했어요."));
    } finally {
      setSending(false);
    }
  }, [draft, sending, kind, post.id, post.text, replies]);

  if (replies.loading) return <Loading />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={replies.data}
        keyExtractor={(row) => row.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <PostCard
              post={post}
              onAuthor={() => onOpenProfile(post.authorId)}
              onLike={() => void toggleLike()}
              onComment={startReply}
              onCorrect={startCorrection}
            />
            <Text style={[styles.sectionLabel, { color: c.subtle }]}>
              {t("댓글")} {replies.data.length}
            </Text>
          </View>
        }
        ListEmptyComponent={
          replies.error ? (
            <EmptyState title={replies.error} onRetry={replies.refresh} />
          ) : (
            <Text style={[styles.none, { color: c.subtle }]}>{t("아직 답글이 없습니다")}</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.reply}>
            <Avatar
              name={item.author}
              photo={item.photo}
              avatarMode={item.avatarMode}
              avatarConfig={item.avatarConfig}
              size={32}
            />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.replyHead}>
                <Text style={[styles.replyAuthor, { color: c.ink }]}>
                  {item.author}
                  <Text style={{ color: c.subtle, fontWeight: "400" }}>  {tx(item.time)}</Text>
                </Text>
                {item.kind === "correction" ? <Badge label={t("교정")} tone="accent" /> : null}
              </View>
              {item.kind === "correction" && item.original ? (
                // 교정: 원문은 지운 줄로, 고친 문장은 진하게. 일반 댓글과 한눈에 구분됩니다.
                <View style={[styles.correction, { backgroundColor: c.surfaceSoft, borderLeftColor: c.primaryStrong }]}>
                  <Text style={[styles.was, { color: c.muted }]}>{item.original}</Text>
                  <Text style={[styles.now, { color: c.ink }]}>{item.text}</Text>
                </View>
              ) : (
                <Text style={[styles.replyText, { color: c.muted }]}>{item.text}</Text>
              )}
            </View>
          </View>
        )}
      />

      {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}

      <View style={[styles.composer, { borderTopColor: c.line, backgroundColor: c.surface }]}>
        <SegmentedTabs
          value={kind}
          onChange={(next) => (next === "correction" ? startCorrection() : startReply())}
          options={[
            { id: "reply", label: t("댓글") },
            { id: "correction", label: t("교정") },
          ]}
        />
        <View style={styles.composerRow}>
          <TextInput
            ref={inputRef}
            style={[styles.input, { backgroundColor: c.sunken, color: c.ink }]}
            value={draft}
            onChangeText={setDraft}
            placeholder={kind === "correction" ? t("교정할 문장을 고쳐서 적어주세요") : t("댓글을 남겨보세요")}
            placeholderTextColor={c.subtle}
            multiline
            maxLength={1000}
            editable={!sending}
            accessibilityLabel={kind === "correction" ? t("교정 남기기") : t("댓글")}
          />
          <Pressable
            onPress={() => void send()}
            disabled={!draft.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel={t("보내기")}
            style={[
              styles.send,
              { backgroundColor: draft.trim() && !sending ? c.primary : c.sunken },
            ]}
          >
            <Ionicons
              name="arrow-up"
              size={20}
              color={draft.trim() && !sending ? c.onPrimary : c.subtle}
            />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.md },
  sectionLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  none: { fontSize: 13, paddingVertical: space.lg, textAlign: "center" },
  reply: { flexDirection: "row", gap: space.sm },
  replyHead: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  replyAuthor: { fontSize: 14, fontWeight: "600" },
  replyText: { fontSize: 14, lineHeight: 20 },
  correction: { gap: 4, paddingVertical: space.sm, paddingHorizontal: space.md, borderLeftWidth: 3, borderRadius: radius.xs },
  was: { fontSize: 14, lineHeight: 20, textDecorationLine: "line-through" },
  now: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
  error: { fontSize: 13, paddingHorizontal: space.lg, paddingBottom: space.xs },
  composer: {
    gap: space.sm,
    padding: space.sm,
    paddingHorizontal: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  input: {
    flex: 1,
    minHeight: tapSize,
    maxHeight: 120,
    paddingHorizontal: space.md,
    paddingTop: 11,
    paddingBottom: 11,
    borderRadius: radius.lg,
    fontSize: 15,
  },
  send: { width: tapSize, height: tapSize, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
});
