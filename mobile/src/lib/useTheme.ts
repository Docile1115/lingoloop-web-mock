import { useColorScheme } from "react-native";
import { dark, light, type Palette } from "./theme";

/** 기기 설정을 따릅니다. 웹도 같은 방식(prefers-color-scheme)입니다. */
export function useTheme(): Palette {
  return useColorScheme() === "dark" ? dark : light;
}
