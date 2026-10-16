/**
 * 설정 목록. 한 카드 안에 줄을 쌓고 줄 사이에 얇은 선을 긋습니다.
 *  - ListRow: 누르면 다음 화면으로 가거나 일을 하는 줄
 *  - SwitchRow: 켜고 끄는 줄
 */
import { Children, Fragment, isValidElement } from "react";
import { Pressable, Switch, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

export function ListGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  const { c } = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={{ gap: space.sm }}>
      {title ? (
        <Text variant="label" tone="muted" accessibilityRole="header" style={{ paddingHorizontal: space.xs }}>
          {title}
        </Text>
      ) : null}
      <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.lg, overflow: "hidden" }}>
        {rows.map((row, index) => (
          <Fragment key={row.key ?? index}>
            {index > 0 ? <View style={{ height: 1, backgroundColor: c.lineSoft, marginLeft: space.lg }} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

export function ListRow({
  icon,
  title,
  detail,
  onPress,
  danger,
  trailing,
  disabled,
}: {
  icon?: IconName;
  title: string;
  detail?: string;
  onPress?: () => void;
  /** 되돌릴 수 없는 일(계정 삭제)은 빨간 글자 */
  danger?: boolean;
  /** 오른쪽 끝. 안 주면 누를 수 있는 줄에 > 표시, null 이면 아무것도 없음 */
  trailing?: React.ReactNode | null;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  const color = danger ? c.danger : c.ink;
  const content = (
    <>
      {icon ? <Icon name={icon} size={20} color={danger ? c.danger : c.inkSoft} /> : null}
      <View style={{ flex: 1, minWidth: 0, gap: space.xxs }}>
        <Text variant="body" style={{ color, fontWeight: "600" }}>
          {title}
        </Text>
        {detail ? (
          <Text variant="meta" tone="muted" numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {/* null 을 주면 > 표시 없이(그 자리에서 일을 하는 줄) */}
      {trailing !== undefined ? trailing : onPress ? <Icon name="chevronRight" size={18} color={c.faint} /> : null}
    </>
  );
  const rowStyle = { minHeight: 56, paddingHorizontal: space.lg, paddingVertical: space.md, flexDirection: "row" as const, alignItems: "center" as const, gap: space.md };
  if (!onPress) return <View style={rowStyle}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      aria-disabled={disabled}
      style={({ pressed }) => [rowStyle, { backgroundColor: pressed ? c.surfaceSoft : "transparent", opacity: disabled ? 0.5 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

/** 하나만 고르는 줄(받는 메시지 범위 등). 묶음에는 accessibilityRole="radiogroup" 를 줍니다. */
export function RadioRow({
  title,
  detail,
  selected,
  onPress,
  disabled,
}: {
  title: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      style={({ pressed }) => ({
        minHeight: 56,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        backgroundColor: pressed ? c.surfaceSoft : "transparent",
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: selected ? c.primaryStrong : c.faint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primaryStrong }} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: space.xxs }}>
        <Text variant="body" style={{ fontWeight: "600" }}>
          {title}
        </Text>
        {detail ? (
          <Text variant="meta" tone="muted">
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function SwitchRow({
  title,
  detail,
  value,
  onValueChange,
  disabled,
}: {
  title: string;
  detail?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View style={{ minHeight: 56, paddingHorizontal: space.lg, paddingVertical: space.md, flexDirection: "row", alignItems: "center", gap: space.md, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flex: 1, minWidth: 0, gap: space.xxs }}>
        <Text variant="body" style={{ fontWeight: "600" }}>
          {title}
        </Text>
        {detail ? (
          <Text variant="meta" tone="muted">
            {detail}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={title}
        trackColor={{ false: c.sunken, true: c.primary }}
        thumbColor={c.surface}
        // 웹: 켠 상태의 손잡이 색(react-native-web)
        {...({ activeThumbColor: c.surface } as object)}
      />
    </View>
  );
}
