/** 내 프로필. 등록한 정보와 내가 쓴 글, 그리고 로그아웃. */
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { toFeedPost, type ApiPost } from "@shared/live-data";
import type { FeedPost } from "@shared/demo-data";
import { t } from "../lib/i18n";
import { useApi } from "../lib/useApi";
import { useSession } from "../lib/session";
import { useTheme } from "../lib/useTheme";
import { radius, space, tapSize } from "../lib/theme";
import { Avatar, EmptyState, Loading } from "../ui";

export function MeScreen({
  onEdit,
  onOpenPost,
}: {
  onEdit: () => void;
  onOpenPost: (row: FeedPost) => void;
}) {
  const c = useTheme();
  const { me, signOut } = useSession();

  const posts = useApi<FeedPost[]>("/api/posts", [], (raw: ApiPost[]) =>
    raw.map(toFeedPost),
  );
  const mine = posts.data.filter((row) => row.authorId === me?.id);

  if (!me) return <Loading />;

  const learning = me.learningLanguages?.[0];
  const facts: Array<[string, string]> = [
    me.country ? [t("사는 곳"), [me.country.name, me.city].filter(Boolean).join(" · ")] : null,
    me.nativeLanguages?.length ? [t("가르칠 수 있어요"), me.nativeLanguages.join(", ").toUpperCase()] : null,
    learning ? [t("배우고 있어요"), learning.code.toUpperCase()] : null,
    learning?.goal ? [t("학습 목표"), learning.goal] : null,
    [t("이메일"), me.email],
  ].filter(Boolean) as Array<[string, string]>;

  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      data={mine}
      keyExtractor={(row) => row.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={posts.refreshing} onRefresh={posts.refresh} tintColor={c.primary} />
      }
      ListHeaderComponent={
        <View style={{ gap: space.md }}>
          <View style={styles.head}>
            <Avatar name={me.name} photo={me.avatarUrl} size={68} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.name, { color: c.ink }]}>{me.name}</Text>
              <Text style={[styles.handle, { color: c.subtle }]}>{me.handle}</Text>
            </View>
          </View>

          {me.bio ? <Text style={[styles.bio, { color: c.muted }]}>{me.bio}</Text> : null}

          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            style={[styles.edit, { borderColor: c.line }]}
          >
            <Ionicons name="pencil-outline" size={16} color={c.ink} />
            <Text style={{ color: c.ink, fontSize: 14, fontWeight: "600" }}>{t("프로필 편집")}</Text>
          </Pressable>

          <View style={{ marginTop: space.sm }}>
            {facts.map(([label, value]) => (
              <View key={label} style={[styles.fact, { borderTopColor: c.line }]}>
                <Text style={[styles.factLabel, { color: c.subtle }]}>{label}</Text>
                <Text style={[styles.factValue, { color: c.ink }]} numberOfLines={2}>{value}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: c.subtle }]}>
            {t("내 글")} {mine.length}
          </Text>
        </View>
      }
      ListEmptyComponent={
        posts.loading ? null : (
          <EmptyState
            title={t("아직 쓴 글이 없어요")}
            body={t("첫 글을 올려보세요. 원어민이 고쳐줄 수 있어요.")}
          />
        )
      }
      ListFooterComponent={
        <Pressable
          onPress={() => void signOut()}
          accessibilityRole="button"
          style={[styles.signOut, { borderColor: c.line }]}
        >
          <Text style={{ color: c.danger, fontSize: 14, fontWeight: "600" }}>{t("로그아웃")}</Text>
        </Pressable>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onOpenPost(item)}
          style={[styles.post, { backgroundColor: c.surfaceSoft, borderColor: c.line }]}
        >
          <Text style={[styles.postText, { color: c.ink }]} numberOfLines={3}>{item.text}</Text>
          <View style={styles.postMeta}>
            <Ionicons name="heart-outline" size={14} color={c.subtle} />
            <Text style={{ color: c.subtle, fontSize: 12 }}>{item.likes}</Text>
            <Ionicons name="chatbubble-outline" size={13} color={c.subtle} />
            <Text style={{ color: c.subtle, fontSize: 12 }}>{item.comments}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.sm },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  name: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  handle: { fontSize: 13 },
  bio: { fontSize: 14, lineHeight: 20 },
  edit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    height: tapSize,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.button,
  },
  fact: { paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth, gap: 2 },
  factLabel: { fontSize: 12 },
  factValue: { fontSize: 15 },
  sectionLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginTop: space.md },
  post: { padding: space.md, gap: space.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md },
  postText: { fontSize: 15, lineHeight: 21 },
  postMeta: { flexDirection: "row", alignItems: "center", gap: space.xs },
  signOut: {
    height: tapSize,
    marginTop: space.xl,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.button,
  },
});
