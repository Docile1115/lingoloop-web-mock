/**
 * LingoLoop 앱 진입점.
 *
 * 웹은 데스크톱 전용이 됐고(설치 안내 화면), 폰은 이 앱이 맡습니다.
 * 서버는 웹과 같은 것을 그대로 씁니다 — 백엔드는 한 줄도 고치지 않았습니다.
 */
import { ActivityIndicator, StatusBar, View, useColorScheme } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { I18nProvider, useLocaleRerender } from "./src/lib/i18n";
import { SessionProvider, useSession } from "./src/lib/session";
import { PartnersScreen } from "./src/screens/PartnersScreen";
import { SignInScreen } from "./src/screens/SignInScreen";
import { useTheme } from "./src/lib/useTheme";

function Gate() {
  // 언어가 바뀌면 이 아래가 전부 다시 그려집니다. 화면들은 훅이 아니라 t() 를 씁니다.
  useLocaleRerender();
  const { me, checking } = useSession();
  const c = useTheme();

  if (checking) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }
  return me ? <PartnersScreen /> : <SignInScreen />;
}

export default function App() {
  const scheme = useColorScheme();
  const c = useTheme();
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <SessionProvider>
          <StatusBar barStyle={scheme === "dark" ? "light-content" : "dark-content"} />
          <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "bottom"]}>
            <Gate />
          </SafeAreaView>
        </SessionProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
