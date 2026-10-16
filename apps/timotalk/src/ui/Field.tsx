/**
 * 입력칸과 고르는 칩. 첫 설정·프로필 편집·설정 화면이 같은 모양을 씁니다.
 *
 * 이름표 · 칸 · 도움말을 한 묶음으로 그리고, 잘못된 값이면 도움말 자리에 이유를 적습니다
 * (칸 바로 아래에서 읽히게). 고르는 값은 드롭다운 대신 칩으로 둡니다 — 폰에서 한 번에 보이고 누르기 쉽습니다.
 */
import { Pressable, TextInput, View, type KeyboardTypeOptions } from "react-native";
import { useLocale } from "@/lib/i18n";
import { useTheme } from "@/theme/theme";
import { radius, space, tapSize, type as typeScale } from "@/theme/tokens";
import { Icon } from "./Icon";
import { Text, textFont } from "./Text";

/** 칸 아래 한 줄: 오류가 있으면 오류, 없으면 도움말 */
function Note({ error, hint }: { error?: string; hint?: string }) {
  if (error) {
    return (
      <Text variant="meta" tone="danger" aria-live="polite">
        {error}
      </Text>
    );
  }
  return hint ? (
    <Text variant="meta" tone="muted">
      {hint}
    </Text>
  ) : null;
}

export function TextField({
  label,
  value,
  onChangeText,
  hint,
  error,
  placeholder,
  multiline,
  maxLength,
  keyboardType,
  disabled,
  width,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  hint?: string;
  error?: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  keyboardType?: KeyboardTypeOptions;
  disabled?: boolean;
  /** 짧은 값(나이 등)은 칸을 좁게 */
  width?: number;
}) {
  const { c } = useTheme();
  const { locale } = useLocale();
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="label" tone="inkSoft">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        placeholder={placeholder}
        placeholderTextColor={c.faint}
        multiline={multiline}
        maxLength={maxLength}
        keyboardType={keyboardType}
        accessibilityLabel={label}
        style={{
          width,
          minHeight: multiline ? 104 : tapSize + 4,
          paddingHorizontal: space.md,
          paddingVertical: multiline ? space.md : 0,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: error ? c.danger : c.line,
          backgroundColor: c.surface,
          color: c.ink,
          fontFamily: textFont(value, locale),
          fontSize: typeScale.body.fontSize,
          lineHeight: multiline ? typeScale.body.lineHeight : undefined,
          textAlignVertical: multiline ? "top" : "center",
          opacity: disabled ? 0.6 : 1,
        }}
      />
      <Note error={error} hint={hint} />
    </View>
  );
}

/** 칩 묶음: 이름표 + 칩들 + 도움말/오류. 하나만 고르면 radio, 여럿이면 checkbox 입니다. */
export function ChoiceGroup({
  label,
  hint,
  error,
  multiple,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  multiple?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="label" tone="inkSoft">
        {label}
      </Text>
      <View
        accessibilityRole={multiple ? undefined : "radiogroup"}
        aria-label={label}
        style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}
      >
        {children}
      </View>
      <Note error={error} hint={hint} />
    </View>
  );
}

export function ChoiceChip({
  label,
  selected,
  onPress,
  multiple,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** 여럿 고르는 칩(관심사 등)은 고른 칩에 체크 표시를 답니다. */
  multiple?: boolean;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={multiple ? "checkbox" : "radio"}
      aria-checked={selected}
      aria-disabled={disabled}
      style={({ pressed }) => ({
        minHeight: tapSize,
        paddingHorizontal: space.lg,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? c.primaryStrong : c.line,
        backgroundColor: selected ? c.primarySoft : c.surface,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      {selected && multiple ? <Icon name="check" size={15} color={c.primaryStrong} strokeWidth={2.4} /> : null}
      <Text variant="callout" style={{ color: selected ? c.primaryStrong : c.ink, fontWeight: selected ? "700" : "500" }}>
        {label}
      </Text>
    </Pressable>
  );
}
