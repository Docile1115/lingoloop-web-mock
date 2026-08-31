/**
 * TimoTalk 앱 진입점.
 *
 * 웹은 데스크톱 전용이 됐고(설치 안내 화면), 폰은 이 앱이 맡습니다.
 * 서버는 웹과 같은 것을 그대로 씁니다 — 백엔드는 한 줄도 고치지 않았습니다.
 */
import "react-native-gesture-handler";
import { StatusBar, useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { I18nProvider, useLocaleRerender } from "./src/lib/i18n";
import { SessionProvider, useSession } from "./src/lib/session";
import { Navigation } from "./src/Navigation";
import { SignInScreen } from "./src/screens/SignInScreen";
import { Loading } from "./src/ui";

function Gate() {
  // 언어가 바뀌면 이 아래가 전부 다시 그려집니다. 화면들은 훅이 아니라 t() 를 씁니다.
  useLocaleRerender();
  const { me, checking } = useSession();
  if (checking) return <Loading />;
  return me ? <Navigation /> : <SignInScreen />;
}

export default function App() {
  const scheme = useColorScheme();
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <SessionProvider>
          <StatusBar barStyle={scheme === "dark" ? "light-content" : "dark-content"} />
          <Gate />
        </SessionProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
