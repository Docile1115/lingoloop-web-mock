import { Platform, Text as RNText, type TextProps, type TextStyle } from "react-native";
import { useLocale } from "@/lib/i18n";
import { guessLanguage } from "@/lib/script";
import { useTheme } from "@/theme/theme";
import { cjkFontFamily, fontFamily, type, type TypeVariant } from "@/theme/tokens";
import type { Palette } from "@/theme/tokens";

export type Tone = keyof Pick<
  Palette,
  "ink" | "inkSoft" | "muted" | "faint" | "primaryStrong" | "danger" | "onPrimary" | "onInverse" | "onInverseMuted" | "onAttentionSoft"
>;

/**
 * 글꼴 고르기(웹만, 앱은 기기 기본). 문장 하나(문자열)가 일본어·중국어 글자로 되어 있으면 그 나라 글꼴로 씁니다
 * (tokens.ts cjkFontFamily). 한자만 있는 짧은 말(設定·会話 같은 메뉴 이름)은 화면 언어가 일본어면 일본어로,
 * 아니면 중국어로 봅니다. 입력칸처럼 Text 가 아닌 곳도 이 함수로 고릅니다.
 */
export function textFont(content: React.ReactNode, locale: string): string | undefined {
  if (Platform.OS !== "web" || typeof content !== "string") return fontFamily;
  const script = guessLanguage(content);
  if (script === "ja") return cjkFontFamily.ja;
  if (script === "zh") return locale === "ja" ? cjkFontFamily.ja : cjkFontFamily.zh;
  return fontFamily;
}

/** 글자. 크기·굵기는 variant, 색은 tone 으로만 고릅니다. */
export function Text({
  variant = "body",
  tone = "ink",
  style,
  ...rest
}: TextProps & { variant?: TypeVariant; tone?: Tone }) {
  const { c } = useTheme();
  const { locale } = useLocale();
  return <RNText {...rest} style={[{ fontFamily: textFont(rest.children, locale), color: c[tone] }, type[variant] as TextStyle, style]} />;
}
