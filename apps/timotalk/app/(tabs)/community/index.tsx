/**
 * 커뮤니티: 배우는 말로 글을 쓰고 원어민에게 교정을 받는 곳.
 * 기획대로 교정 요청 글을 앞에 둡니다 — 그중에서도 내 모국어로 쓴 글(내가 고쳐 줄 수 있는 글)을 맨 위에 모읍니다.
 * 화면에 돌아올 때마다 다시 받습니다(글쓰기·삭제·좋아요가 다른 화면에서 일어납니다).
 */
import { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { listPosts, setLiked } from "@/features/community/api";
import { PostCard } from "@/features/community/PostCard";
import { failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useMe } from "@/lib/session";
import type { Post } from "@/lib/types";
import { space } from "@/theme/tokens";
import { SectionHeader } from "@/ui/Bits";
import { Button } from "@/ui/Button";
import { Page } from "@/ui/Page";
import { EmptyState, ErrorState, LoadingState } from "@/ui/States";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

const COLUMN = 680;

export default function Community() {
  const router = useRouter();
  const me = useMe();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    listPosts()
      .then((rows) => {
        setPosts(rows ?? []);
        setError("");
      })
      .catch((caught) => setError(failureText(caught, t("불러오지 못했어요."))));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggleLike = async (post: Post) => {
    const liked = !post.liked;
    const patch = (rows: Post[] | null) => rows?.map((row) => (row.id === post.id ? { ...row, liked, likes: Math.max(0, row.likes + (liked ? 1 : -1)) } : row)) ?? rows;
    setPosts(patch);
    try {
      const result = await setLiked(post.id, liked);
      setPosts((rows) => rows?.map((row) => (row.id === post.id ? { ...row, liked: result.liked, likes: result.likes } : row)) ?? rows);
    } catch (caught) {
      load();
      showToast(failureText(caught, t("좋아요를 바꾸지 못했어요.")), "error");
    }
  };

  // 내가 고쳐 줄 수 있는 글: 교정을 바라고, 내 모국어로 썼고, 내가 쓴 글이 아닌 것
  const canHelp = (post: Post) => post.requestCorrection && post.authorId !== me.id && me.nativeLanguages.includes(post.language);
  const helpable = posts?.filter(canHelp) ?? [];
  const others = posts?.filter((post) => !canHelp(post)) ?? [];
  // 나머지 중에서도 교정 요청 글을 앞에 둡니다(서버 순서인 최신순은 각 묶음 안에서 지킵니다).
  const rest = [...others.filter((post) => post.requestCorrection), ...others.filter((post) => !post.requestCorrection)];

  const card = (post: Post) => (
    <PostCard
      key={post.id}
      post={post}
      compact
      onOpen={() => router.push({ pathname: "/community/[postId]", params: { postId: post.id } })}
      onToggleLike={() => void toggleLike(post)}
    />
  );

  return (
    <Page onRefresh={load} refreshing={false}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md }}>
        <Text variant="display" accessibilityRole="header">
          {t("커뮤니티")}
        </Text>
        <Button label={t("글쓰기")} icon="pencil" onPress={() => router.push("/community/compose")} />
      </View>

      <View style={{ width: "100%", maxWidth: COLUMN, gap: space.xxl }}>
        {error && !posts ? (
          <ErrorState message={error} onRetry={load} />
        ) : !posts ? (
          <LoadingState />
        ) : posts.length === 0 ? (
          <EmptyState
            title={t("아직 글이 없어요")}
            body={t("배우는 말로 오늘 있었던 일을 짧게 써 보세요. 원어민이 고쳐 줄 거예요.")}
            action={<Button label={t("글쓰기")} icon="pencil" onPress={() => router.push("/community/compose")} />}
          />
        ) : (
          <>
            {helpable.length ? (
              <View style={{ gap: space.md }}>
                <SectionHeader title={t("내가 고쳐 줄 수 있는 글")} detail={t("내 모국어로 쓴 글이에요. 한 문장만 고쳐 줘도 큰 도움이 돼요.")} />
                {helpable.map(card)}
              </View>
            ) : null}
            {rest.length ? (
              <View style={{ gap: space.md }}>
                <SectionHeader title={helpable.length ? t("다른 글") : t("모든 글")} />
                {rest.map(card)}
              </View>
            ) : null}
          </>
        )}
      </View>
    </Page>
  );
}
