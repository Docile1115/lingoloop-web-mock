/**
 * 대화방 아래 입력줄: [AI 코치] [사진] [입력칸] [보내기 · 글이 없으면 녹음].
 * 녹음 중에는 줄 전체가 녹음 막대로 바뀝니다: [버리기] ● 0:07 / 0:30 [보내기]. 30초가 되면 저절로 보냅니다.
 * 사진은 고르면 바로 줄여서 보냅니다(features/chat/media.ts). 잠긴 대화(요청 대기)에서는 보낼 수단을 모두 숨깁니다.
 */
import { useEffect, useState } from "react";
import { Pressable, TextInput, View, type NativeSyntheticEvent, type TextInputKeyPressEventData } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t, useLocale } from "@/lib/i18n";
import { useTheme } from "@/theme/theme";
import { space, tapSize } from "@/theme/tokens";
import { IconButton } from "@/ui/Button";
import { Icon, type IconName } from "@/ui/Icon";
import { Text, textFont } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { VOICE_MAX_MS, formatSeconds, pickPhoto } from "./media";
import type { Outgoing } from "./useMessages";
import { useVoiceRecorder } from "./voice/recorder";

export function Composer({
  value,
  onChangeText,
  onKeyPress,
  onSubmit,
  onSendMedia,
  placeholder,
  locked,
  sending,
  coach,
  maxWidth,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onKeyPress: (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => void;
  onSubmit: () => void;
  onSendMedia: (payload: Outgoing) => Promise<boolean>;
  placeholder: string;
  /** 요청 대기 등으로 보낼 수 없는 대화 */
  locked: boolean;
  sending: boolean;
  /** AI 코치 단추(상대가 있을 때만) */
  coach: { open: boolean; onToggle: () => void } | null;
  maxWidth: number;
}) {
  const { c } = useTheme();
  const { locale } = useLocale();
  const insets = useSafeAreaInsets();
  const recorder = useVoiceRecorder();
  const [mediaBusy, setMediaBusy] = useState(false);
  const hasText = Boolean(value.trim());
  const row = { width: "100%" as const, maxWidth, alignSelf: "center" as const, paddingHorizontal: space.md, paddingTop: space.sm + 2, paddingBottom: Math.max(insets.bottom, space.md) };

  const sendPhoto = async () => {
    if (mediaBusy || locked) return;
    setMediaBusy(true);
    try {
      const result = await pickPhoto();
      if (result.status === "too-large") showToast(t("사진을 줄여도 너무 커요. 다른 사진을 골라주세요."), "error");
      if (result.status === "picked" && !(await onSendMedia({ type: "image", text: "", media: result.media }))) {
        showToast(t("보내지 못했어요."), "error");
      }
    } catch {
      showToast(t("사진을 열지 못했어요."), "error");
    } finally {
      setMediaBusy(false);
    }
  };

  const startVoice = async () => {
    if (mediaBusy || locked) return;
    const started = await recorder.start();
    if (started === "denied") showToast(t("마이크를 쓸 수 없어요. 설정에서 마이크 권한을 허용해 주세요."), "error");
    if (started === "unavailable") showToast(t("이 기기에서는 녹음할 수 없어요."), "error");
  };

  const finishVoice = async () => {
    if (recorder.state !== "recording") return;
    setMediaBusy(true);
    try {
      const take = await recorder.finish();
      if (take === "too-short") showToast(t("너무 짧아요. 조금 더 길게 말해 주세요."), "error");
      else if (take === "too-long") showToast(t("녹음이 너무 길어요. 30초 안쪽으로 다시 녹음해 주세요."), "error");
      else if (!(await onSendMedia({ type: "voice", text: "", media: take.media }))) showToast(t("보내지 못했어요."), "error");
    } catch {
      showToast(t("녹음을 보내지 못했어요."), "error");
    } finally {
      setMediaBusy(false);
    }
  };

  // 30초가 되면 저절로 멈추고 보냅니다(효과 안에서 바로 상태를 바꾸지 않게 다음 틱에).
  const limitReached = recorder.state === "recording" && recorder.durationMs >= VOICE_MAX_MS;
  useEffect(() => {
    if (!limitReached) return;
    const timer = setTimeout(() => void finishVoice(), 0);
    return () => clearTimeout(timer);
    // finishVoice 는 그릴 때마다 새로 만들어지므로 넣지 않습니다(한계에 닿은 순간 한 번만).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limitReached]);

  if (recorder.state !== "idle") {
    return (
      <View style={[row, { flexDirection: "row", alignItems: "center", gap: space.sm }]}>
        <IconButton icon="trash" label={t("녹음 버리기")} disabled={recorder.state === "finishing"} onPress={recorder.cancel} />
        <View
          aria-live="polite"
          style={{ flex: 1, minHeight: tapSize, borderRadius: 22, backgroundColor: c.surfaceSoft, flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg }}
        >
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.danger }} />
          <Text variant="bodyStrong" style={{ fontVariant: ["tabular-nums"] }}>
            {formatSeconds(recorder.durationMs)}
          </Text>
          <Text variant="meta" tone="muted">
            {t("녹음 중 · 최대 {seconds}초", { seconds: VOICE_MAX_MS / 1000 })}
          </Text>
        </View>
        <RoundButton icon="send" label={t("녹음 보내기")} active disabled={recorder.state === "finishing"} onPress={() => void finishVoice()} />
      </View>
    );
  }

  return (
    <View style={[row, { flexDirection: "row", alignItems: "flex-end", gap: space.sm }]}>
      {coach && !locked ? <IconButton icon="spark" label={coach.open ? t("AI 코치 닫기") : t("AI 코치")} onPress={coach.onToggle} /> : null}
      {!locked ? <IconButton icon="image" label={t("사진 보내기")} disabled={mediaBusy} onPress={() => void sendPhoto()} /> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onKeyPress={onKeyPress}
        editable={!locked}
        multiline
        maxLength={4000}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        accessibilityLabel={t("메시지")}
        style={{
          flex: 1,
          minHeight: tapSize,
          maxHeight: 140,
          paddingHorizontal: space.lg,
          paddingTop: 11,
          paddingBottom: 11,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: c.line,
          backgroundColor: c.surface,
          color: c.ink,
          fontFamily: textFont(value, locale),
          fontSize: 15,
          lineHeight: 21,
        }}
      />
      {hasText || locked ? (
        <RoundButton icon="send" label={t("보내기")} active={hasText && !locked} disabled={!hasText || sending || locked} onPress={onSubmit} />
      ) : (
        <RoundButton icon="mic" label={t("음성 메시지 녹음")} active={false} disabled={mediaBusy} onPress={() => void startVoice()} />
      )}
    </View>
  );
}

function RoundButton({ icon, label, active, disabled, onPress }: { icon: IconName; label: string; active: boolean; disabled?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={disabled}
      style={({ pressed }) => ({
        width: tapSize,
        height: tapSize,
        borderRadius: tapSize / 2,
        backgroundColor: active ? c.primary : c.sunken,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon name={icon} size={19} color={active ? c.onPrimary : c.inkSoft} strokeWidth={2} />
    </Pressable>
  );
}
