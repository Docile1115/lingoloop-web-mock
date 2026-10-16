import { Tabs } from "expo-router";
import { useWindowDimensions } from "react-native";
import { t } from "@/lib/i18n";
import { useTheme } from "@/theme/theme";
import { WIDE_BREAKPOINT } from "@/theme/tokens";
import { AppNav } from "@/ui/AppNav";

/**
 * 다섯 탭: 오늘 · 대화 · 커뮤니티 · 노트 · 나.
 * 대화방(chat/[id])도 이 묶음 안에 숨은 경로로 둡니다. 넓은 화면에서는 왼쪽 메뉴가 그대로 남고,
 * 휴대폰에서는 아래 탭을 감춰 대화방이 화면을 다 씁니다(AppNav).
 */
export default function TabsLayout() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  return (
    <Tabs
      tabBar={(props) => <AppNav {...props} variant={wide ? "side" : "bottom"} />}
      screenOptions={{ headerShown: false, tabBarPosition: wide ? "left" : "bottom", sceneStyle: { backgroundColor: c.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: t("오늘") }} />
      <Tabs.Screen name="chats" options={{ title: t("대화") }} />
      <Tabs.Screen name="community" options={{ title: t("커뮤니티") }} />
      <Tabs.Screen name="notes" options={{ title: t("노트") }} />
      <Tabs.Screen name="me" options={{ title: t("나") }} />
      <Tabs.Screen name="chat/[id]" options={{ title: t("대화"), href: null }} />
    </Tabs>
  );
}
