/**
 * 음성 메시지 말풍선 속: 재생·멈춤, 들은 만큼 칠해지는 막대, 길이.
 * 재생은 expo-audio(웹은 <audio>)가 하고, 소리 파일은 플랫폼마다 voice/source 가 준비합니다.
 * 웹에서 녹음한 webm 은 끝까지 듣기 전에는 길이를 모를 수 있어서, 모르면 "음성"이라고만 적습니다.
 */
import { Pressable, View } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { t } from "@/lib/i18n";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";
import { formatSeconds } from "./media";
import { useVoiceSource } from "./voice/source";

const BARS = [6, 10, 14, 9, 16, 12, 7, 13, 17, 10, 8, 14, 11, 6];

export function VoiceMessage({ conversationId, messageId, media, mine }: { conversationId: string; messageId: string; media: string; mine: boolean }) {
  const { c } = useTheme();
  const { source, unsupported } = useVoiceSource(conversationId, messageId, media);
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  // 내 말풍선(초록) 위에는 흰색 대신 짙은 글자를 씁니다(대비 4.5:1 이상).
  const strong = mine ? c.onPrimary : c.ink;
  const soft = mine ? c.onPrimary : c.faint;

  if (unsupported) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, maxWidth: 240 }}>
        <Icon name="speaker" size={16} color={soft} />
        <Text variant="meta" style={{ color: strong, flexShrink: 1 }}>
          {t("이 기기에서는 재생할 수 없는 음성이에요.")}
        </Text>
      </View>
    );
  }

  const known = Number.isFinite(status.duration) && status.duration > 0;
  const progress = known ? Math.min(1, status.currentTime / status.duration) : 0;
  const toggle = async () => {
    if (!source) return;
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish || (known && status.currentTime >= status.duration - 0.05)) await player.seekTo(0);
    player.play();
  };

  return (
    <Pressable
      onPress={() => void toggle()}
      disabled={!source}
      accessibilityRole="button"
      accessibilityLabel={status.playing ? t("음성 메시지 멈추기") : t("음성 메시지 듣기")}
      style={{ flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 28, opacity: source ? 1 : 0.6 }}
    >
      <Icon name={status.playing ? "pause" : "play"} size={18} color={strong} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
        {BARS.map((height, index) => (
          <View
            key={index}
            style={{
              width: 3,
              height,
              borderRadius: 2,
              backgroundColor: index / BARS.length < progress ? strong : soft,
              opacity: index / BARS.length < progress ? 1 : 0.55,
            }}
          />
        ))}
      </View>
      <Text variant="meta" style={{ color: strong, minWidth: 30 }}>
        {known ? formatSeconds((status.playing || progress > 0 ? status.currentTime : status.duration) * 1000) : t("음성")}
      </Text>
    </Pressable>
  );
}
