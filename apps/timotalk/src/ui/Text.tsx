import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@/theme/theme";
import { fontFamily, type, type TypeVariant } from "@/theme/tokens";
import type { Palette } from "@/theme/tokens";

export type Tone = keyof Pick<
  Palette,
  "ink" | "inkSoft" | "muted" | "faint" | "primaryStrong" | "danger" | "onPrimary" | "onInverse" | "onInverseMuted" | "onAttentionSoft"
>;

/** 글자. 크기·굵기는 variant, 색은 tone 으로만 고릅니다. */
export function Text({
  variant = "body",
  tone = "ink",
  style,
  ...rest
}: TextProps & { variant?: TypeVariant; tone?: Tone }) {
  const { c } = useTheme();
  return <RNText {...rest} style={[{ fontFamily, color: c[tone] }, type[variant] as TextStyle, style]} />;
}
