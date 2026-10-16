/**
 * 커뮤니티 글 한 장: 글쓴이 · 교정 요청 표시 · 쓴 말 · 글 · 사진/음성 · 태그 · 좋아요/댓글/교정 수.
 * 목록에서는 글을 여섯 줄까지만 보여 주고 누르면 글 화면으로 갑니다. 글 화면에서는 전부 보여 줍니다.
 */
import { Pressable, View } from "react-native";
import { t } from "@/lib/i18n";
import { relativeTime } from "@/lib/time";
import type { Post } from "@/lib/types";
import { languageName, levelName } from "@/lib/words";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Avatar } from "@/ui/Avatar";
import { Chip, Pill } from "@/ui/Bits";
import { Icon, type IconName } from "@/ui/Icon";
import { Text } from "@/ui/Text";
import { PhotoMessage } from "@/features/chat/PhotoMessage";
import { VoiceMessage } from "@/features/chat/VoiceMessage";

/** "일본어 원어민 · 한국어 초급" */
export function authorLine(author: Post["author"]): string {
  const native = author.native ? t("{language} 원어민", { language: languageName(author.native) }) : "";
  const learning = author.learning
    ? t("{language} {level}", { language: languageName(author.learning.code), level: levelName(author.learning.level) })
    : "";
  return [native, learning].filter(Boolean).join(" · ");
}

export function PostCard({
  post,
  compact,
  onOpen,
  onToggleLike,
}: {
  post: Post;
  /** 목록: 글을 줄이고 누르면 연다 */
  compact?: boolean;
  onOpen?: () => void;
  onToggleLike: () => void;
}) {
  const { c } = useTheme();
  const name = post.author.name ?? t("알 수 없는 상대");

  const body = (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <Avatar name={name} photo={post.author.avatarUrl} avatarMode={post.author.avatarMode} avatarConfig={post.author.avatarConfig} size={40} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="meta" tone="muted" numberOfLines={1}>
            {[authorLine(post.author), relativeTime(post.createdAt)].filter(Boolean).join(" · ")}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs + 2 }}>
        {post.requestCorrection ? <Pill label={t("교정 요청")} tone="primary" /> : null}
        <Pill label={t("{language}로 썼어요", { language: languageName(post.language) })} />
        {post.visibility === "partners" ? <Pill label={t("대화 상대만")} /> : null}
      </View>

      <Text variant="body" numberOfLines={compact ? 6 : undefined} selectable={!compact}>
        {post.text}
      </Text>

      {post.imageUrl ? <PhotoMessage media={post.imageUrl} /> : null}
      {post.audioUrl ? (
        <View style={{ alignSelf: "flex-start", paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: c.surfaceSoft }}>
          <VoiceMessage conversationId="post" messageId={post.id} media={post.audioUrl} mine={false} />
        </View>
      ) : null}

      {post.tags?.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
          {post.tags.map((tag) => (
            <Chip key={tag} label={tag} />
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
      {onOpen ? (
        <Pressable onPress={onOpen} accessibilityRole="link" accessibilityLabel={t("{name}님의 글 보기", { name })}>
          {body}
        </Pressable>
      ) : (
        body
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, borderTopWidth: 1, borderTopColor: c.lineSoft, paddingTop: space.sm }}>
        <Stat
          icon={post.liked ? "heartFilled" : "heart"}
          label={t("좋아요 {n}", { n: post.likes })}
          active={Boolean(post.liked)}
          onPress={onToggleLike}
          pressed={Boolean(post.liked)}
        />
        <Stat icon="chat" label={t("댓글 {n}", { n: post.comments })} onPress={onOpen} />
        <Stat icon="pencil" label={t("교정 {n}", { n: post.corrections })} onPress={onOpen} />
      </View>
    </View>
  );
}

function Stat({ icon, label, onPress, active, pressed }: { icon: IconName; label: string; onPress?: () => void; active?: boolean; pressed?: boolean }) {
  const { c } = useTheme();
  const color = active ? c.danger : c.muted;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      aria-pressed={pressed}
      style={({ pressed: down }) => ({ minHeight: 40, paddingHorizontal: space.sm, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radius.pill, backgroundColor: down ? c.surfaceSoft : "transparent" })}
    >
      <Icon name={icon} size={18} color={color} />
      <Text variant="meta" style={{ color: active ? c.danger : c.inkSoft, fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  );
}
