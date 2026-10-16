import { View } from "react-native";
import { useTheme } from "@/theme/theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

/** 로고: 초록 말풍선 + 이름 */
export function Brand({ size = "md" }: { size?: "md" | "lg" }) {
  const { c } = useTheme();
  const box = size === "lg" ? 44 : 32;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }} accessibilityRole="header" accessibilityLabel="TimoTalk">
      <View style={{ width: box, height: box, borderRadius: box * 0.3, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>
        <Icon name="chat" size={box * 0.56} color={c.onPrimary} strokeWidth={2.2} />
      </View>
      <Text variant={size === "lg" ? "display" : "title"} style={{ letterSpacing: -0.3 }}>
        TimoTalk
      </Text>
    </View>
  );
}
