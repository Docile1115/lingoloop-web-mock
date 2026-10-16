/**
 * 말풍선. 상대 말을 누르면 도구(번역·저장)가 열립니다. 번역은 말풍선 안에 이어서 보여줍니다.
 * 사진은 눌러서 크게 보고, 음성은 말풍선 안에서 바로 틉니다.
 */
import { Pressable, View } from "react-native";
import { t } from "@/lib/i18n";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Icon, type IconName } from "@/ui/Icon";
import { Text } from "@/ui/Text";
import { PhotoMessage } from "./PhotoMessage";
import type { ChatMessage } from "./useMessages";
import { VoiceMessage } from "./VoiceMessage";

export type Translation = { status: "loading" } | { status: "ready"; text: string } | { status: "error"; text: string };

export function MessageBubble({
  message,
  mine,
  open,
  translation,
  saved,
  onToggle,
  onTranslate,
  onSave,
  onResend,
}: {
  message: ChatMessage;
  mine: boolean;
  open: boolean;
  translation?: Translation;
  saved: boolean;
  onToggle: () => void;
  onTranslate: () => void;
  onSave: () => void;
  onResend: () => void;
}) {
  const { c } = useTheme();
  const tools = !mine && message.type === "text";

  const photo = message.type === "image" && Boolean(message.media);
  const body =
    photo ? (
      <PhotoMessage media={message.media!} />
    ) : message.type === "voice" && message.media ? (
      <VoiceMessage conversationId={message.conversationId} messageId={message.id} media={message.media} mine={mine} />
    ) : (
      <Text variant="body" style={{ color: mine ? c.onPrimary : c.ink }} selectable>
        {message.text}
      </Text>
    );

  return (
    <View style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%", gap: space.xs + 2, alignItems: mine ? "flex-end" : "flex-start" }}>
      <Pressable
        onPress={tools ? onToggle : message.state === "failed" ? onResend : undefined}
        disabled={!tools && message.state !== "failed"}
        accessibilityRole={tools || message.state === "failed" ? "button" : undefined}
        accessibilityHint={tools ? t("번역·저장 도구를 열어요") : message.state === "failed" ? t("다시 보내요") : undefined}
        aria-expanded={tools ? open : undefined}
        style={{
          backgroundColor: mine ? c.primary : c.surface,
          borderWidth: mine ? 0 : open ? 2 : 1,
          borderColor: open ? c.primaryStrong : c.line,
          borderRadius: radius.lg,
          borderTopLeftRadius: mine ? radius.lg : 6,
          borderTopRightRadius: mine ? 6 : radius.lg,
          // 사진은 말풍선 테두리만 남기고 거의 꽉 채웁니다.
          paddingVertical: photo ? 4 : open ? space.sm + 1 : space.sm + 2,
          paddingHorizontal: photo ? 4 : open ? space.md + 1 : space.md + 2,
          opacity: message.state === "sending" ? 0.7 : 1,
          gap: space.xs + 2,
        }}
      >
        {body}
        {translation ? (
          <View style={{ flexDirection: "row", gap: space.xs + 2, alignItems: "center", paddingTop: space.xs + 2, borderTopWidth: 1, borderTopColor: c.lineSoft }}>
            <Icon name="translate" size={14} color={c.muted} />
            <Text variant="meta" tone="muted" style={{ flexShrink: 1 }} selectable aria-live="polite">
              {translation.status === "loading" ? t("번역하고 있어요") : translation.text}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {message.state === "failed" ? (
        <Text variant="caption" tone="danger">
          {t("보내지 못했어요 · 눌러서 다시 보내기")}
        </Text>
      ) : null}

      {open && tools ? (
        <View accessibilityRole="toolbar" accessibilityLabel={t("메시지 도구")} style={{ flexDirection: "row", gap: space.xs + 2 }}>
          <Tool icon="translate" label={translation?.status === "ready" ? t("번역 다시") : t("번역")} onPress={onTranslate} />
          <Tool icon={saved ? "bookmarkFilled" : "bookmark"} label={saved ? t("저장했어요") : t("저장")} onPress={onSave} disabled={saved} />
        </View>
      ) : null}
    </View>
  );
}

function Tool({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: c.line,
        backgroundColor: pressed ? c.surfaceSoft : c.surface,
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        opacity: disabled ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={15} color={c.ink} />
      <Text variant="callout" style={{ fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  );
}
