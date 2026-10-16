/** 교환 세션 띠: 지금 어느 말 차례인지, 남은 시간, 진행 막대. */
import { Pressable, View } from "react-native";
import { t } from "@/lib/i18n";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";
import { formatRemaining } from "./useExchangeSession";

export function ExchangeStrip({
  language,
  nextLanguage,
  remaining,
  progress,
  onStop,
}: {
  language: string;
  nextLanguage: string;
  remaining: number;
  progress: number;
  onStop: () => void;
}) {
  const { c } = useTheme();
  const time = formatRemaining(remaining);
  return (
    <View
      accessibilityRole="timer"
      accessibilityLabel={t("교환 세션, 지금은 {language} 차례, {time} 남음", { language, time })}
      style={{ backgroundColor: c.primarySoft, paddingTop: space.sm + 2, paddingHorizontal: space.lg, gap: space.sm }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Icon name="timer" size={16} color={c.primaryStrong} strokeWidth={2} />
        <Text variant="meta" tone="primaryStrong" style={{ fontWeight: "600", flexShrink: 1 }}>
          {nextLanguage ? t("교환 세션 · 지금은 {language} 차례", { language }) : t("교환 세션 · 마지막 {language} 차례", { language })}
        </Text>
        <Text variant="meta" style={{ marginLeft: "auto", fontWeight: "700" }}>
          {time}
        </Text>
        <Pressable onPress={onStop} accessibilityRole="button" accessibilityLabel={t("교환 세션 끝내기")} hitSlop={8} style={{ minHeight: 32, justifyContent: "center", paddingLeft: space.xs }}>
          <Text variant="meta" tone="primaryStrong" style={{ fontWeight: "700" }}>
            {t("끝내기")}
          </Text>
        </Pressable>
      </View>
      <View style={{ height: 3, backgroundColor: c.highlight }}>
        <View style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%`, height: 3, backgroundColor: c.primaryStrong }} />
      </View>
    </View>
  );
}
