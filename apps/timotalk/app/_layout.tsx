/**
 * 앱 맨 바깥. 언어·색·로그인 상태를 깔고, 로그인 여부로 들어갈 수 있는 화면을 나눕니다.
 *  - 로그인 전: sign-in 만
 *  - 로그인 후 첫 설정 전(onboardedAt === null): setup 만
 *  - 그 뒤: 탭(오늘·대화·커뮤니티·노트·나). 대화방도 탭 묶음 안에 있습니다 — 넓은 화면에서 메뉴가 남습니다.
 * 서버 확인 중에는 첫 화면을, 서버에 닿지 않으면 "다시 시도"를 보여줍니다(로그아웃시키지 않음).
 */
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConversationsProvider } from "@/features/chats/store";
import { NotificationsProvider } from "@/features/notifications/store";
import { I18nProvider, t, useLocale } from "@/lib/i18n";
import { SessionProvider, useSession } from "@/lib/session";
import { ThemeProvider, useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";
import { Brand } from "@/ui/Brand";
import { Button } from "@/ui/Button";
import { LoadingState } from "@/ui/States";
import { Text } from "@/ui/Text";
import { ToastHost } from "@/ui/Toast";
import { useWebShell } from "@/ui/webShell";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <ThemeProvider>
          <SessionProvider>
            <Root />
            <ToastHost />
          </SessionProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const { c, scheme } = useTheme();
  const { locale } = useLocale();
  const { status, problem, retry, me } = useSession();
  useWebShell(c.bg);

  if (status === "checking" || status === "unavailable") {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.lg }}>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <Brand />
        {status === "checking" ? (
          <LoadingState />
        ) : (
          <View style={{ alignItems: "center", gap: space.md, maxWidth: 360 }}>
            <Text variant="callout" tone="muted" style={{ textAlign: "center" }} accessibilityRole="alert">
              {problem}
            </Text>
            <Button label={t("다시 시도")} icon="refresh" variant="secondary" onPress={retry} />
          </View>
        )}
      </View>
    );
  }

  const signedIn = status === "in";
  const needsSetup = signedIn && me?.onboardedAt === null;
  return (
    <ConversationsProvider key={signedIn ? "in" : "out"} enabled={signedIn && !needsSetup}>
      <NotificationsProvider key={signedIn ? "in" : "out"} enabled={signedIn && !needsSetup}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {/* 언어를 바꾸면 화면을 새로 그립니다. 화면들은 그릴 때 t() 를 부르기 때문입니다. */}
      <Stack key={locale} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Protected guard={signedIn && !needsSetup}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={needsSetup}>
          <Stack.Screen name="setup" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
      </NotificationsProvider>
    </ConversationsProvider>
  );
}
