/**
 * 교정 한 건: 원래 문장(지운 부분은 줄을 긋고) → 고친 문장(더한 부분은 형광). 대화방·노트·복습이 같이 씁니다.
 * 화면 읽기 프로그램에는 "고치기 전 … / 고친 문장 …" 으로 한 번에 읽어 줍니다.
 */
import { useMemo } from "react";
import { View } from "react-native";
import { diffSentences } from "@/lib/diff";
import { t } from "@/lib/i18n";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";
import { Text } from "@/ui/Text";

export function CorrectionView({ original, fixed, note, hideOriginal }: { original: string; fixed: string; note?: string; hideOriginal?: boolean }) {
  const { c } = useTheme();
  const { before, after } = useMemo(() => diffSentences(original, fixed), [original, fixed]);
  return (
    <View accessible accessibilityLabel={t("고치기 전: {before} / 고친 문장: {after}", { before: original, after: fixed })} style={{ gap: space.xs }}>
      {hideOriginal ? null : (
        <Text variant="callout" style={{ color: c.muted }}>
          {before.map((segment, index) => (
            <Text key={index} variant="callout" style={segment.kind === "removed" ? { color: c.danger, textDecorationLine: "line-through" } : { color: c.muted }}>
              {segment.text}
            </Text>
          ))}
        </Text>
      )}
      <Text variant="body" style={{ fontWeight: "600" }}>
        {after.map((segment, index) => (
          <Text key={index} variant="body" style={segment.kind === "added" ? { fontWeight: "700", backgroundColor: c.highlight, color: c.ink } : { fontWeight: "600" }}>
            {segment.text}
          </Text>
        ))}
      </Text>
      {note ? (
        <Text variant="meta" tone="muted">
          {note}
        </Text>
      ) : null}
    </View>
  );
}
