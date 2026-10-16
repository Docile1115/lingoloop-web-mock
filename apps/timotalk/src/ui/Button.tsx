import { ActivityIndicator, Pressable, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { radius, tapSize } from "@/theme/tokens";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

type Variant = "primary" | "secondary" | "dark" | "ghost" | "danger";

/**
 * 버튼. 높이는 손가락으로 누르기 좋은 44px 이상입니다.
 * primary 는 화면마다 하나 — 그 화면에서 가장 중요한 일에만 씁니다.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  busy,
  grow,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  /** 남는 너비를 채웁니다(버튼 두 개가 나란히 있을 때 주 버튼). */
  grow?: boolean;
  accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  const look = {
    primary: { bg: c.primary, fg: c.onPrimary, border: c.primary },
    secondary: { bg: c.surface, fg: c.ink, border: c.line },
    dark: { bg: c.inverse, fg: c.onInverse, border: c.inverse },
    ghost: { bg: "transparent", fg: c.primaryStrong, border: "transparent" },
    // 되돌릴 수 없는 일(계정 삭제)에만 씁니다.
    danger: { bg: c.danger, fg: c.onDanger, border: c.danger },
  }[variant];
  const inactive = Boolean(disabled || busy);
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      aria-disabled={inactive}
      aria-busy={Boolean(busy)}
      style={({ pressed }) => [
        {
          minHeight: 46,
          paddingHorizontal: variant === "ghost" ? 6 : 16,
          borderRadius: radius.pill,
          backgroundColor: look.bg,
          borderWidth: 1,
          borderColor: look.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        grow ? { flexGrow: 1, flexShrink: 1, flexBasis: 0 } : null,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={look.fg} /> : icon ? <Icon name={icon} size={17} color={look.fg} strokeWidth={2} /> : null}
      <Text variant="bodyStrong" style={{ color: look.fg, fontWeight: variant === "primary" || variant === "danger" ? "700" : "600" }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** 아이콘만 있는 둥근 버튼. 화면 읽기 프로그램을 위해 label 이 꼭 필요합니다. */
export function IconButton({
  icon,
  label,
  onPress,
  dot,
  plain,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** 오른쪽 위 작은 점(새 소식) */
  dot?: boolean;
  /** 테두리 없이(헤더 안) */
  plain?: boolean;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={plain ? 4 : 0}
      style={({ pressed }) => ({
        width: tapSize,
        height: tapSize,
        borderRadius: tapSize / 2,
        borderWidth: plain ? 0 : 1,
        borderColor: c.line,
        backgroundColor: plain ? "transparent" : c.surface,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={20} color={c.ink} />
      {dot ? (
        <View
          style={{
            position: "absolute",
            top: 9,
            right: 10,
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: c.attention,
            borderWidth: 2,
            borderColor: c.surface,
          }}
        />
      ) : null}
    </Pressable>
  );
}
