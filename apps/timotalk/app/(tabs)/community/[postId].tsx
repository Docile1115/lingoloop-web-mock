/**
 * 커뮤니티 글 한 편: 글 · 고쳐 주기 · 댓글과 교정 · 댓글 쓰기.
 * 교정은 글에서 문장 하나를 골라 고친 것이고(원래 문장과 함께 저장), 글쓴이의 노트("받은 교정")에도 모입니다.
 * 답글은 댓글 아래에 한 단계로만 모아 보여 줍니다(답글의 답글도 맨 위 댓글 아래로).
 * 알림·노트에서 주소(/community/글id)로 바로 들어오기도 하므로 글과 댓글을 이 화면이 직접 받습니다.
 */
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CorrectionDialog } from "@/features/chat/CorrectionDialog";
import { ReportDialog } from "@/features/chats/ReportDialog";
import { addReply, deletePost, getPost, listReplies, setLiked, splitSentences } from "@/features/community/api";
import { PostCard } from "@/features/community/PostCard";
import { CorrectionView } from "@/features/notes/CorrectionView";
import { failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useMe } from "@/lib/session";
import { relativeTime } from "@/lib/time";
import type { Post, PostReply } from "@/lib/types";
import { languageName } from "@/lib/words";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Avatar } from "@/ui/Avatar";
import { Pill, SectionHeader } from "@/ui/Bits";
import { Button, IconButton } from "@/ui/Button";
import { ConfirmDialog, Dialog } from "@/ui/Dialog";
import { TextField } from "@/ui/Field";
import { ListGroup, ListRow } from "@/ui/List";
import { Page } from "@/ui/Page";
import { EmptyState, ErrorState, LoadingState } from "@/ui/States";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

const COLUMN = 680;
/** 서버가 받는 댓글 길이 */
const REPLY_MAX = 1000;

type Mode = "menu" | "delete" | "report" | "correct" | null;

export default function PostScreen() {
  const router = useRouter();
  const me = useMe();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<PostReply[]>([]);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!postId) return;
    let alive = true;
    Promise.all([getPost(postId), listReplies(postId)])
      .then(([row, rows]) => {
        if (!alive) return;
        setPost(row);
        setReplies(rows ?? []);
      })
      .catch((caught) => {
        if (alive) setLoadError(failureText(caught, t("불러오지 못했어요.")));
      });
    return () => {
      alive = false;
    };
  }, [postId, attempt]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/community"));
  // 글을 지웠거나 글쓴이를 차단해 더는 볼 수 없을 때: 뒤로가 아니라 글 목록으로(알림·노트에서 왔으면 뒤가 다른 탭입니다).
  const leave = () => router.dismissTo("/community");
  const mine = post?.authorId === me.id;
  const authorName = post?.author.name ?? t("알 수 없는 상대");
  const sentences = useMemo(() => (post ? splitSentences(post.text) : []), [post]);

  const toggleLike = async () => {
    if (!post) return;
    const liked = !post.liked;
    setPost({ ...post, liked, likes: Math.max(0, post.likes + (liked ? 1 : -1)) });
    try {
      const result = await setLiked(post.id, liked);
      setPost((current) => (current ? { ...current, liked: result.liked, likes: result.likes } : current));
    } catch (caught) {
      setPost((current) => (current ? { ...current, liked: !liked, likes: post.likes } : current));
      showToast(failureText(caught, t("좋아요를 바꾸지 못했어요.")), "error");
    }
  };

  const remove = async () => {
    if (!post || busy) return;
    setBusy(true);
    try {
      await deletePost(post.id);
      showToast(t("글을 지웠어요"));
      setMode(null);
      leave();
    } catch (caught) {
      showToast(failureText(caught, t("글을 지우지 못했어요.")), "error");
    } finally {
      setBusy(false);
    }
  };

  /** 서버가 돌려준 새 댓글·교정을 목록 끝에 붙이고 글의 숫자를 올립니다. */
  const added = (reply: PostReply) => {
    setReplies((rows) => [...rows, reply]);
    setPost((current) =>
      current
        ? reply.kind === "correction"
          ? { ...current, corrections: current.corrections + 1 }
          : { ...current, comments: current.comments + 1 }
        : current,
    );
  };

  const sendReply = async () => {
    const text = draft.trim();
    if (!post || !text || sending) return;
    setSending(true);
    try {
      added(await addReply(post.id, { text, parentId: replyTo?.id }));
      setDraft("");
      setReplyTo(null);
    } catch (caught) {
      showToast(failureText(caught, t("댓글을 남기지 못했어요.")), "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <Page>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: -space.sm }}>
        <IconButton icon="back" label={t("뒤로")} plain onPress={back} />
        {post ? <IconButton icon="more" label={t("글 메뉴")} plain onPress={() => setMode("menu")} /> : null}
      </View>

      <View style={{ width: "100%", maxWidth: COLUMN, gap: space.xl }}>
        {loadError ? (
          <ErrorState
            message={loadError}
            onRetry={() => {
              setLoadError("");
              setAttempt((n) => n + 1);
            }}
          />
        ) : !post ? (
          <LoadingState />
        ) : (
          <>
            <PostCard post={post} onToggleLike={() => void toggleLike()} />

            {!mine && sentences.length ? (
              <CorrectInvite post={post} name={authorName} onPress={() => setMode("correct")} />
            ) : null}

            <View style={{ gap: space.md }}>
              <SectionHeader title={t("댓글과 교정")} detail={replies.length ? t("{n}개", { n: replies.length }) : undefined} />
              {replies.length ? (
                <Thread replies={replies} onReply={(reply) => setReplyTo({ id: reply.id, name: reply.author.name ?? t("알 수 없는 상대") })} />
              ) : (
                <EmptyState
                  title={t("아직 댓글이 없어요")}
                  body={mine ? t("원어민이 고쳐 주면 여기에 모이고 노트에도 쌓여요.") : t("첫 댓글을 남겨 보세요.")}
                />
              )}
            </View>

            <View style={{ gap: space.sm }}>
              {replyTo ? (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm }}>
                  <Text variant="meta" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {t("{name}님에게 답글", { name: replyTo.name })}
                  </Text>
                  <Button label={t("답글 취소")} variant="ghost" onPress={() => setReplyTo(null)} />
                </View>
              ) : null}
              <TextField
                label={replyTo ? t("답글 쓰기") : t("댓글 쓰기")}
                value={draft}
                onChangeText={setDraft}
                multiline
                maxLength={REPLY_MAX}
                placeholder={mine ? t("고쳐 준 사람에게 고맙다고 말해 보세요.") : t("응원이나 질문을 남겨 보세요.")}
                disabled={sending}
              />
              <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                <Button label={t("남기기")} icon="send" busy={sending} disabled={!draft.trim()} onPress={() => void sendReply()} />
              </View>
            </View>
          </>
        )}
      </View>

      {post ? (
        <>
          <Dialog visible={mode === "menu"} title={t("글 메뉴")} onClose={() => setMode(null)}>
            <ListGroup>
              {mine ? (
                <ListRow icon="trash" title={t("글 지우기")} danger onPress={() => setMode("delete")} trailing={null} />
              ) : (
                <>
                  <ListRow
                    icon="me"
                    title={t("{name}님 프로필 보기", { name: authorName })}
                    onPress={() => {
                      setMode(null);
                      router.push({ pathname: "/people/[id]", params: { id: post.authorId } });
                    }}
                  />
                  <ListRow icon="flag" title={t("글 신고하기")} danger onPress={() => setMode("report")} trailing={null} />
                </>
              )}
            </ListGroup>
          </Dialog>
          <ConfirmDialog
            visible={mode === "delete"}
            title={t("이 글을 지울까요?")}
            body={t("달린 댓글과 교정도 함께 지워져요. 되돌릴 수 없어요.")}
            confirmLabel={t("지우기")}
            danger
            busy={busy}
            onClose={() => setMode("menu")}
            onConfirm={() => void remove()}
          />
          <ReportDialog
            target={{ type: "post", id: post.id }}
            person={{ id: post.authorId, name: authorName }}
            visible={mode === "report"}
            onClose={() => setMode("menu")}
            onReported={(blocked) => {
              setMode(null);
              // 차단하면 이 글도 더는 보이지 않습니다.
              if (blocked) leave();
            }}
          />
          {mode === "correct" ? (
            <CorrectionDialog
              original={sentences[0] ?? ""}
              sentences={sentences}
              withNote={false}
              maxLength={REPLY_MAX}
              body={t("어색한 문장을 하나 골라 자연스럽게 고쳐 주세요. 고친 문장은 {name}님의 노트에 모여요.", { name: authorName })}
              visible
              onClose={() => setMode(null)}
              onSend={async (fixed, _note, original) => {
                try {
                  added(await addReply(post.id, { text: fixed, kind: "correction", original }));
                  showToast(t("고친 문장을 보냈어요. {name}님의 노트에 모여요.", { name: authorName }));
                  return true;
                } catch (caught) {
                  showToast(failureText(caught, t("보내지 못했어요.")), "error");
                  return false;
                }
              }}
            />
          ) : null}
        </>
      ) : null}
    </Page>
  );
}

/** 남의 글에 "고쳐 주기"를 권하는 띠. 교정을 바라는 글이면 더 눈에 띄게. */
function CorrectInvite({ post, name, onPress }: { post: Post; name: string; onPress: () => void }) {
  const { c } = useTheme();
  const asked = post.requestCorrection;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: space.md,
        padding: space.lg,
        borderRadius: radius.lg,
        backgroundColor: asked ? c.primarySoft : c.surfaceSoft,
      }}
    >
      <View style={{ flex: 1, minWidth: 200, gap: space.xxs }}>
        <Text variant="bodyStrong">{asked ? t("{name}님이 교정을 기다려요", { name }) : t("어색한 문장이 보이나요?")}</Text>
        <Text variant="meta" tone="muted">
          {t("{language}로 쓴 글이에요. 한 문장만 고쳐 줘도 큰 도움이 돼요.", { language: languageName(post.language) })}
        </Text>
      </View>
      <Button label={t("고쳐 주기")} icon="pencil" variant={asked ? "primary" : "secondary"} onPress={onPress} />
    </View>
  );
}

/** 댓글 목록: 맨 위 댓글 시간순, 그 아래에 답글들(답글의 답글도 같은 맨 위 댓글 아래로). */
function Thread({ replies, onReply }: { replies: PostReply[]; onReply: (reply: PostReply) => void }) {
  const groups = useMemo(() => {
    const byId = new Map(replies.map((reply) => [reply.id, reply]));
    const rootOf = (reply: PostReply) => {
      let current = reply;
      // 지워졌거나 차단해서 안 보이는 댓글을 가리키면 그 자리를 맨 위로 봅니다. 고리가 생겨도 멈추게 횟수를 둡니다.
      for (let step = 0; step < 20 && current.parentId && byId.has(current.parentId); step += 1) current = byId.get(current.parentId)!;
      return current.id;
    };
    const children = new Map<string, PostReply[]>();
    const roots: PostReply[] = [];
    for (const reply of replies) {
      const root = rootOf(reply);
      if (root === reply.id) roots.push(reply);
      else children.set(root, [...(children.get(root) ?? []), reply]);
    }
    return roots.map((root) => ({ root, children: children.get(root.id) ?? [] }));
  }, [replies]);

  return (
    <View style={{ gap: space.md }}>
      {groups.map(({ root, children }) => (
        <View key={root.id} style={{ gap: space.sm }}>
          <ReplyRow reply={root} onReply={() => onReply(root)} />
          {children.length ? (
            <View style={{ marginLeft: space.xl, gap: space.sm }}>
              {children.map((child) => (
                <ReplyRow key={child.id} reply={child} onReply={() => onReply(child)} />
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function ReplyRow({ reply, onReply }: { reply: PostReply; onReply: () => void }) {
  const { c } = useTheme();
  const name = reply.author.name ?? t("알 수 없는 상대");
  const correction = reply.kind === "correction";
  return (
    <View
      style={{
        flexDirection: "row",
        gap: space.md,
        padding: space.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: correction ? c.primary : c.lineSoft,
        backgroundColor: c.surface,
      }}
    >
      <Avatar name={name} photo={reply.author.avatarUrl} avatarMode={reply.author.avatarMode} avatarConfig={reply.author.avatarConfig} size={32} />
      <View style={{ flex: 1, minWidth: 0, gap: space.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm }}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
            {name}
          </Text>
          {correction ? <Pill label={t("고친 문장")} tone="primary" /> : null}
          <Text variant="meta" tone="muted">
            {relativeTime(reply.createdAt)}
          </Text>
        </View>
        {correction && reply.original ? (
          <CorrectionView original={reply.original} fixed={reply.text} />
        ) : (
          <Text variant="body" selectable>
            {reply.text}
          </Text>
        )}
        <Pressable onPress={onReply} accessibilityRole="button" accessibilityLabel={t("{name}님에게 답글", { name })} hitSlop={8} style={{ alignSelf: "flex-start", paddingVertical: 2 }}>
          <Text variant="meta" style={{ color: c.primaryStrong, fontWeight: "600" }}>
            {t("답글")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
