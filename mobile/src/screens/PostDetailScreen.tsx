/** 글 상세와 댓글. 댓글은 서버에 남고 새로고침해도 그대로입니다. */
import { useCallback, useState } from "react";
import {
  FlatList,
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
import { Avatar, EmptyState, Loading } from "../ui";
import { PostCard } from "./CommunityScreen";

export function PostDetailScreen({
  post,
  onOpenProfile,
}: {
  post: FeedPost;
  onOpenProfile: (authorId: string) => void;
}) {
  const c = useTheme();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const replies = useApi<PostReply[]>(
    `/api/posts/${post.id}/replies`,
    [],
    (raw: ApiReply[]) => raw.map(toPostReply),
  );

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    try {
      const created = await apiPost<ApiReply>(`/api/posts/${post.id}/replies`, { text });
      replies.set((rows) => [...rows, toPostReply(created)]);
      setDraft("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("요청을 처리하지 못했어요."));
    } finally {
      setSending(false);
    }
  }, [draft, sending, post.id, replies]);

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
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <PostCard post={post} onAuthor={() => onOpenProfile(post.authorId)} />
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
            <Avatar name={item.author} photo={item.photo} size={32} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.replyAuthor, { color: c.ink }]}>
                {item.author}
                <Text style={{ color: c.subtle, fontWeight: "400" }}>  {tx(item.time)}</Text>
              </Text>
              <Text style={[styles.replyText, { color: c.muted }]}>{item.text}</Text>
            </View>
          </View>
        )}
      />

      {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}

      <View style={[styles.composer, { borderTopColor: c.line, backgroundColor: c.surface }]}>
        <TextInput
          style={[styles.input, { backgroundColor: c.sunken, color: c.ink }]}
          value={draft}
          onChangeText={setDraft}
          placeholder={t("댓글을 남겨보세요")}
          placeholderTextColor={c.subtle}
          multiline
          maxLength={1000}
          editable={!sending}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.md },
  sectionLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  none: { fontSize: 13, paddingVertical: space.lg, textAlign: "center" },
  reply: { flexDirection: "row", gap: space.sm },
  replyAuthor: { fontSize: 14, fontWeight: "600" },
  replyText: { fontSize: 14, lineHeight: 20 },
  error: { fontSize: 13, paddingHorizontal: space.lg, paddingBottom: space.xs },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    padding: space.sm,
    paddingHorizontal: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
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
