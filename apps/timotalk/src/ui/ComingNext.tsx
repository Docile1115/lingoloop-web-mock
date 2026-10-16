/**
 * 아직 만들지 않은 탭. 무엇이 들어올지 그대로 알려줍니다 — 눌러도 아무 일 없는 단추는 두지 않습니다.
 */
import { View } from "react-native";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Icon, type IconName } from "./Icon";
import { Page } from "./Page";
import { Text } from "./Text";

export function ComingNext({ title, icon, lead, points }: { title: string; icon: IconName; lead: string; points: string[] }) {
  const { c } = useTheme();
  return (
    <Page>
      <Text variant="display" accessibilityRole="header">
        {title}
      </Text>
      <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.lg, padding: space.xl, gap: space.lg, maxWidth: 560 }}>
        <View style={{ width: 48, height: 48, borderRadius: radius.sm, backgroundColor: c.primarySoft, alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={24} color={c.primaryStrong} />
        </View>
        <Text variant="headline">{lead}</Text>
        <View style={{ gap: space.sm }}>
          {points.map((point) => (
            <View key={point} style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
              <Icon name="check" size={16} color={c.primaryStrong} strokeWidth={2.4} />
              <Text variant="callout" tone="inkSoft" style={{ flex: 1 }}>
                {point}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}
