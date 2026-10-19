import { Tabs } from "expo-router";
import { useWindowDimensions } from "react-native";
import { usePushSetup } from "@/features/notifications/usePushSetup";
import { t } from "@/lib/i18n";
import { useTheme } from "@/theme/theme";
import { WIDE_BREAKPOINT } from "@/theme/tokens";
import { AppNav } from "@/ui/AppNav";

/**
 * 다섯 탭: 오늘 · 대화 · 커뮤니티 · 노트 · 나.
 * 대화방(chat/[id])·프로필(people/[id])·더 찾아보기(discover)도 이 묶음 안에 숨은 경로로 둡니다.
 * 넓은 화면에서는 왼쪽 메뉴가 그대로 남고, 휴대폰에서는 대화방에서만 아래 탭을 감춥니다(AppNav).
 * 폰 알림(등록 새로 하기·눌러서 열기)도 여기서 붙입니다 — 로그인하고 첫 설정을 마친 뒤에만 그려지는 곳입니다.
 */
export default function TabsLayout() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  usePushSetup();
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
      <Tabs.Screen name="people/[id]" options={{ title: t("프로필"), href: null }} />
      <Tabs.Screen name="discover/index" options={{ title: t("더 찾아보기"), href: null }} />
      <Tabs.Screen name="discover/filters" options={{ title: t("조건"), href: null }} />
      <Tabs.Screen name="notifications" options={{ title: t("알림"), href: null }} />
    </Tabs>
  );
}
