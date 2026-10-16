import { View, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Text } from "./Text";

/** 카드. 바탕 위에 떠 있는 한 덩어리 — 모든 칸에 두르지 말고 묶음에만 씁니다. */
export function Card({ children, style, padded = true }: { children: React.ReactNode; style?: ViewStyle; padded?: boolean }) {
  const { c } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.lg, overflow: "hidden" },
        padded ? { padding: space.lg, gap: space.md } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** 테두리만 있는 작은 이름표(맞는 이유 등) */
export function Chip({ label }: { label: string }) {
  const { c } = useTheme();
  return (
    <View style={{ maxWidth: "100%", paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: c.line }}>
      <Text variant="caption" tone="inkSoft" style={{ flexShrink: 1 }}>
        {label}
      </Text>
    </View>
  );
}

/** 옅은 바탕의 이름표(단계·상태) */
export function Pill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "primary" }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: radius.pill,
        backgroundColor: tone === "primary" ? c.primarySoft : c.surfaceSoft,
      }}
    >
      <Text variant="label" tone={tone === "primary" ? "primaryStrong" : "ink"}>
        {label}
      </Text>
    </View>
  );
}

/** 안 읽은 수. 노랑 — 초록은 "누르세요" 자리에 씁니다. */
export function CountBadge({ count, label }: { count: number; label?: string }) {
  const { c } = useTheme();
  if (count <= 0) return null;
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        minWidth: 22,
        height: 22,
        paddingHorizontal: 6,
        borderRadius: radius.pill,
        backgroundColor: c.attention,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text variant="label" style={{ color: c.onAttention, fontWeight: "700" }}>
        {count > 99 ? "99+" : String(count)}
      </Text>
    </View>
  );
}

/** 구역 제목 + 보조 설명 */
export function SectionHeader({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.md }}>
      <View style={{ flexShrink: 1, gap: space.xxs }}>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {detail ? (
          <Text variant="meta" tone="muted">
            {detail}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}
