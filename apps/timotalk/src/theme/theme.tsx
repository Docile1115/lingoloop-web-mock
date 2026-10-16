/**
 * 지금 화면의 색 묶음(밝게/어둡게).
 *
 * 기기 설정을 따릅니다. 화면에서 직접 바꾸는 설정은 "나" 탭 설정이 생길 때 여기에 붙입니다.
 */
import { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { dark, light, type Palette } from "./tokens";

type ThemeValue = { scheme: "light" | "dark"; c: Palette };

const ThemeContext = createContext<ThemeValue>({ scheme: "light", c: light });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const scheme = system === "dark" ? "dark" : "light";
  const value = useMemo(() => ({ scheme, c: scheme === "dark" ? dark : light }) as ThemeValue, [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
