/**
 * 로그인. 지원하는 방법(Google·Apple)만 보여줍니다 — 서버 설정과 기기를 보고 정합니다.
 */
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { availableProviders, loadAuthConfig, SignInError, signInWith, type AuthConfig, type Provider } from "@/lib/auth/social";
import { failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";
import { Brand } from "@/ui/Brand";
import { Button } from "@/ui/Button";
import { ErrorState, LoadingState } from "@/ui/States";
import { Text } from "@/ui/Text";

export default function SignIn() {
  const { c } = useTheme();
  const { signIn, problem } = useSession();
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    loadAuthConfig()
      .then(async (loaded) => {
        const usable = await availableProviders(loaded);
        if (!alive) return;
        setConfig(loaded);
        setProviders(usable);
      })
      .catch((caught) => {
        if (alive) setLoadError(failureText(caught, t("로그인 설정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.")));
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const start = async (provider: Provider) => {
    if (!config || busy) return;
    setBusy(provider);
    setError("");
    try {
      const idToken = await signInWith(provider, config);
      await signIn(idToken);
    } catch (caught) {
      if (caught instanceof SignInError) {
        if (caught.kind !== "cancelled") setError(caught.message);
      } else {
        setError(failureText(caught, t("로그인하지 못했어요. 다시 시도해 주세요.")));
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: space.xl }}>
        <View style={{ width: "100%", maxWidth: 400, gap: space.xxl }}>
          <View style={{ gap: space.md }}>
            <Brand size="lg" />
            <Text variant="display">{t("진짜 사람과, 매일 조금씩")}</Text>
            <Text variant="body" tone="muted">
              {t("매일 나와 맞는 언어 교환 상대를 만나고, 대화하며 배운 것이 쌓여요.")}
            </Text>
          </View>

          {problem ? (
            <Text variant="callout" tone="danger" accessibilityRole="alert">
              {problem}
            </Text>
          ) : null}

          {loadError ? (
            <ErrorState
              message={loadError}
              onRetry={() => {
                setLoadError("");
                setAttempt((n) => n + 1);
              }}
            />
          ) : !config ? (
            <LoadingState />
          ) : providers.length === 0 ? (
            <Text variant="callout" tone="muted">
              {t("현재 이 로그인 방법을 사용할 수 없어요.")}
            </Text>
          ) : (
            <View style={{ gap: space.sm }}>
              {providers.includes("google") ? (
                <Button label={t("Google로 계속하기")} variant="secondary" busy={busy === "google"} disabled={Boolean(busy)} onPress={() => void start("google")} />
              ) : null}
              {providers.includes("apple") ? (
                <Button label={t("Apple로 계속하기")} variant="dark" busy={busy === "apple"} disabled={Boolean(busy)} onPress={() => void start("apple")} />
              ) : null}
              {error ? (
                <Text variant="callout" tone="danger" accessibilityRole="alert">
                  {error}
                </Text>
              ) : null}
            </View>
          )}

          <Text variant="caption" tone="muted">
            {t("로그인하면 서비스 이용약관과 개인정보처리방침에 동의하게 됩니다.")}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
