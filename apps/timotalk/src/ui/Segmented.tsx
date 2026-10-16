/**
 * 같은 화면 안에서 목록을 바꾸는 단추 묶음(대화 · 요청 등). 숫자가 있으면 옆에 노란 배지를 답니다.
 */
import { Pressable, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { CountBadge } from "./Bits";
import { Text } from "./Text";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string; count?: number }>;
  onChange: (value: T) => void;
  /** 화면 읽기 프로그램이 읽을 묶음 이름 */
  label: string;
}) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      aria-label={label}
      style={{ flexDirection: "row", alignSelf: "flex-start", padding: 3, gap: 3, borderRadius: radius.pill, backgroundColor: c.sunken }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            aria-selected={selected}
            style={{
              minHeight: 38,
              paddingHorizontal: space.lg,
              borderRadius: radius.pill,
              backgroundColor: selected ? c.surface : "transparent",
              flexDirection: "row",
              alignItems: "center",
              gap: space.xs + 2,
            }}
          >
            <Text variant="callout" style={{ fontWeight: selected ? "700" : "500", color: selected ? c.ink : c.muted }}>
              {option.label}
            </Text>
            {option.count ? <CountBadge count={option.count} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
