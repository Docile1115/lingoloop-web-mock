/**
 * 검색.
 *
 * 서버가 사람과 글을 한 번에 돌려줍니다. 두 글자부터 찾습니다(서버 규칙) —
 * 한 글자에 요청을 보내면 매번 422 가 돌아옵니다.
 */
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { toFeedPost, toPartner, type ApiPost, type ApiProfile } from "@shared/live-data";
import type { FeedPost, Partner } from "@shared/demo-data";
import { ApiError, get } from "../lib/api";
import { t, tx } from "../lib/i18n";
import { useTheme } from "../lib/useTheme";
import { radius, space, tapSize, type } from "../lib/theme";
import { Avatar, Divider, EmptyState, SegmentedTabs } from "../ui";

export function SearchScreen({
  onOpenProfile,
  onOpenPost,
}: {
  onOpenProfile: (id: string) => void;
  onOpenPost: (row: FeedPost) => void;
}) {
  const c = useTheme();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"people" | "posts">("people");
  const [people, setPeople] = useState<Partner[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);

  // 글자를 칠 때마다 보내지 않고 잠깐 기다립니다 — 안 그러면 한 단어에 열 번 요청합니다.
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setPeople([]); setPosts([]); setError("");
      return;
    }
    let alive = true;
    setSearching(true);
    const timer = setTimeout(() => {
      get<{ partners: ApiProfile[]; posts: ApiPost[] }>(`/api/search?q=${encodeURIComponent(text)}`)
        .then((data) => {
          if (!alive) return;
          setPeople(data.partners.map((row) => toPartner(row)));
          setPosts(data.posts.map(toFeedPost));
          setError("");
        })
        .catch((caught) => {
          if (alive) setError(caught instanceof ApiError ? caught.message : t("불러오지 못했어요."));
        })
        .finally(() => { if (alive) setSearching(false); });
    }, 300);
    return () => { alive = false; clearTimeout(timer); };
  }, [query]);

  const short = query.trim().length > 0 && query.trim().length < 2;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.bar}>
        <View style={[styles.field, { backgroundColor: c.sunken }]}>
          <Ionicons name="search" size={18} color={c.subtle} />
          <TextInput
            style={[styles.input, { color: c.ink }]}
            value={query}
            onChangeText={setQuery}
            placeholder={t("이름, 소개, 글 내용으로 찾기")}
            placeholderTextColor={c.subtle}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityRole="button"
              accessibilityLabel={t("지우기")}>
              <Ionicons name="close-circle" size={18} color={c.subtle} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {query.trim().length >= 2 ? (
        <View style={styles.tabs}>
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            options={[
              { id: "people", label: `${t("사람")} ${people.length}` },
              { id: "posts", label: `${t("글")} ${posts.length}` },
            ]}
          />
        </View>
      ) : null}

      {tab === "people" ? (
        <FlatList
          data={people}
          keyExtractor={(row) => row.id}
          contentContainerStyle={people.length ? undefined : { flexGrow: 1 }}
          ItemSeparatorComponent={Divider}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Blank query={query} short={short} error={error} searching={searching} />}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => onOpenProfile(item.id)} accessibilityRole="button">
              <Avatar name={item.name} photo={item.photo} size={46} online={item.online} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.name, { color: c.ink }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[type.meta, { color: c.muted }]} numberOfLines={1}>
                  {tx(item.native)}<Text style={{ color: c.subtle }}> ⇄ </Text>{tx(item.learning)}
                </Text>
              </View>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(row) => row.id}
          contentContainerStyle={posts.length ? undefined : { flexGrow: 1 }}
          ItemSeparatorComponent={Divider}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Blank query={query} short={short} error={error} searching={searching} />}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => onOpenPost(item)} accessibilityRole="button">
              <Avatar name={item.author} photo={item.photo} size={38} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[type.name, { color: c.ink }]} numberOfLines={1}>{item.author}</Text>
                <Text style={[type.meta, { color: c.muted }]} numberOfLines={2}>{item.text}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function Blank({ query, short, error, searching }: { query: string; short: boolean; error: string; searching: boolean }) {
  if (error) return <EmptyState title={error} />;
  if (searching) return <EmptyState title={t("찾는 중…")} />;
  if (short) return <EmptyState emoji="🔎" title={t("두 글자 이상 입력해 주세요")} />;
  if (!query.trim()) return <EmptyState emoji="🔎" title={t("누구를 찾고 계세요?")} body={t("이름, 소개, 글 내용으로 찾기")} />;
  return <EmptyState emoji="🫙" title={t("찾는 결과가 없어요")} />;
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  field: { flexDirection: "row", alignItems: "center", gap: space.sm, height: tapSize, paddingHorizontal: space.md, borderRadius: radius.pill },
  input: { flex: 1, fontSize: 15 },
  tabs: { paddingHorizontal: space.lg, paddingBottom: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
});
