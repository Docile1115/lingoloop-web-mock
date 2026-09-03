import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import {
  GoogleSignin,
  GoogleSigninButton,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../lib/api";
import { t } from "../lib/i18n";
import {
  exchangeProviderCredential,
  loadSocialAuthConfig,
  MobileSocialAuthError,
  type MobileSocialAuthConfig,
} from "../lib/socialAuth";
import { useSession } from "../lib/session";
import { radius, space, tapSize } from "../lib/theme";
import { useTheme } from "../lib/useTheme";

type CompleteSignIn = (input: {
  provider: "google" | "apple";
  providerIdToken: string;
  rawNonce?: string;
  displayName?: string;
}) => Promise<void>;

export function SignInScreen() {
  const c = useTheme();
  const { signIn } = useSession();
  const [config, setConfig] = useState<MobileSocialAuthConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [configError, setConfigError] = useState("");

  const reloadConfig = useCallback(async () => {
    setLoadingConfig(true);
    setConfigError("");
    try {
      setConfig(await loadSocialAuthConfig());
    } catch (caught) {
      setConfigError(authErrorMessage(caught));
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    void reloadConfig();
  }, [reloadConfig]);

  const completeSignIn = useCallback<CompleteSignIn>(
    async (input) => {
      if (!config) throw new Error("로그인 설정이 아직 준비되지 않았어요.");
      const credential = await exchangeProviderCredential(config, input);
      await signIn(credential);
    },
    [config, signIn],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "bottom"]}>
      <View style={s.page}>
        <View style={s.intro}>
          <View style={[s.mark, { backgroundColor: c.primary }]}>
            <Text style={[s.markText, { color: c.onPrimary }]}>T</Text>
          </View>
          <Text style={[s.brand, { color: c.ink }]}>TimoTalk</Text>
          <Text style={[s.lede, { color: c.muted }]}>
            {t("진짜 사람과 이야기하며 언어를 배워요.")}
          </Text>
        </View>

        <View style={s.authArea}>
          {loadingConfig ? <ActivityIndicator color={c.primary} size="small" /> : null}

          {!loadingConfig && configError ? (
            <View style={s.errorBlock}>
              <Text style={[s.error, { color: c.danger }]}>{configError}</Text>
              <Pressable
                style={[s.retry, { borderColor: c.lineStrong }]}
                onPress={() => void reloadConfig()}
                accessibilityRole="button"
              >
                <Text style={[s.retryText, { color: c.ink }]}>{t("다시 시도")}</Text>
              </Pressable>
            </View>
          ) : null}

          {!loadingConfig && config && Platform.OS === "ios" ? (
            <AppleSignIn config={config} completeSignIn={completeSignIn} />
          ) : null}

          {!loadingConfig && config && Platform.OS !== "ios" ? (
            <GoogleSignIn config={config} completeSignIn={completeSignIn} />
          ) : null}
        </View>

        <Text style={[s.privacy, { color: c.subtle }]}>
          로그인하면 서비스 이용약관과 개인정보처리방침에 동의하게 됩니다.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function AppleSignIn({
  config,
  completeSignIn,
}: {
  config: MobileSocialAuthConfig;
  completeSignIn: CompleteSignIn;
}) {
  const c = useTheme();
  const colorScheme = useColorScheme();
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    AppleAuthentication.isAvailableAsync()
      .then((value) => { if (alive) setAvailable(value); })
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, []);

  const start = async () => {
    if (busy || !available || !config.providers.apple) return;
    setBusy(true);
    setError("");
    try {
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );
      const result = await AppleAuthentication.signInAsync({
        nonce: hashedNonce,
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!result.identityToken) {
        throw new MobileSocialAuthError(
          "MISSING_PROVIDER_TOKEN",
          "Apple 로그인 확인 정보를 받지 못했어요. 다시 시도해 주세요.",
        );
      }
      const displayName = result.fullName
        ? AppleAuthentication.formatFullName(result.fullName).trim()
        : "";
      await completeSignIn({
        provider: "apple",
        providerIdToken: result.identityToken,
        rawNonce,
        displayName: displayName || undefined,
      });
    } catch (caught) {
      if (!isAppleCancellation(caught)) setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  if (checking) return <ActivityIndicator color={c.primary} size="small" />;
  if (!config.providers.apple) {
    return <Text style={[s.error, { color: c.muted }]}>Apple 로그인이 아직 활성화되지 않았어요.</Text>;
  }
  if (!available) {
    return <Text style={[s.error, { color: c.muted }]}>이 기기에서는 Apple 로그인을 사용할 수 없어요.</Text>;
  }

  return (
    <View style={s.providerBlock}>
      <View style={{ opacity: busy ? 0.55 : 1 }} pointerEvents={busy ? "none" : "auto"}>
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            colorScheme === "dark"
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={radius.button}
          style={s.appleButton}
          onPress={() => void start()}
        />
      </View>
      {busy ? (
        <ActivityIndicator
          style={s.buttonSpinner}
          color={colorScheme === "dark" ? "#000000" : "#ffffff"}
        />
      ) : null}
      {error ? <Text style={[s.error, { color: c.danger }]}>{error}</Text> : null}
    </View>
  );
}

function GoogleSignIn({
  config,
  completeSignIn,
}: {
  config: MobileSocialAuthConfig;
  completeSignIn: CompleteSignIn;
}) {
  const c = useTheme();
  const clientId =
    config.googleWebClientId?.trim() ||
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();

  if (!config.providers.google) {
    return <Text style={[s.error, { color: c.muted }]}>Google 로그인이 아직 활성화되지 않았어요.</Text>;
  }
  if (!clientId) {
    return (
      <Text style={[s.error, { color: c.muted }]}>Google 로그인 설정이 필요해요. 앱 관리자에게 알려 주세요.</Text>
    );
  }
  return <ConfiguredGoogleSignIn clientId={clientId} completeSignIn={completeSignIn} />;
}

function ConfiguredGoogleSignIn({
  clientId,
  completeSignIn,
}: {
  clientId: string;
  completeSignIn: CompleteSignIn;
}) {
  const c = useTheme();
  const colorScheme = useColorScheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    GoogleSignin.configure({
      // 반드시 Google Cloud의 "웹 애플리케이션" OAuth client ID여야
      // Firebase가 검증할 수 있는 idToken을 돌려줍니다.
      webClientId: clientId,
      offlineAccess: false,
    });
  }, [clientId]);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      if (!isSuccessResponse(result)) return;
      if (!result.data.idToken) {
        throw new MobileSocialAuthError(
          "MISSING_PROVIDER_TOKEN",
          "Google 로그인 확인 정보를 받지 못했어요. 다시 시도해 주세요.",
        );
      }
      await completeSignIn({ provider: "google", providerIdToken: result.data.idToken });
    } catch (caught) {
      if (!(isErrorWithCode(caught) && caught.code === statusCodes.SIGN_IN_CANCELLED)) {
        setError(googleErrorMessage(caught));
      }
    } finally {
      await GoogleSignin.signOut().catch(() => undefined);
      setBusy(false);
    }
  };

  return (
    <View style={s.providerBlock}>
      <GoogleSigninButton
        style={[s.googleButton, { opacity: busy ? 0.6 : 1 }]}
        size={GoogleSigninButton.Size.Wide}
        color={
          colorScheme === "dark" ? GoogleSigninButton.Color.Light : GoogleSigninButton.Color.Dark
        }
        onPress={() => void start()}
        disabled={busy}
      />
      {error ? <Text style={[s.error, { color: c.danger }]}>{error}</Text> : null}
    </View>
  );
}

function isAppleCancellation(caught: unknown) {
  return Boolean(
    typeof caught === "object" &&
      caught &&
      "code" in caught &&
      String(caught.code) === "ERR_REQUEST_CANCELED",
  );
}

function authErrorMessage(caught: unknown) {
  if (caught instanceof ApiError || caught instanceof MobileSocialAuthError) return caught.message;
  const code =
    typeof caught === "object" && caught && "code" in caught ? String(caught.code) : "";
  if (code === "auth/account-exists-with-different-credential") {
    return "같은 이메일이 다른 로그인 방법에 연결되어 있어요.";
  }
  if (code === "auth/operation-not-allowed") return "현재 이 로그인 방법을 사용할 수 없어요.";
  if (code === "auth/network-request-failed") return "네트워크 연결을 확인하고 다시 시도해 주세요.";
  if (code === "auth/invalid-credential") return "로그인 확인 정보가 만료됐어요. 다시 시도해 주세요.";
  if (caught instanceof Error && caught.message) return caught.message;
  return t("요청을 처리하지 못했어요.");
}

function googleErrorMessage(caught: unknown) {
  if (isErrorWithCode(caught)) {
    if (caught.code === statusCodes.IN_PROGRESS) return "Google 로그인이 이미 진행 중이에요.";
    if (caught.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return "Google Play 서비스를 사용할 수 없어요. 업데이트 후 다시 시도해 주세요.";
    }
  }
  return authErrorMessage(caught);
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: space.xl,
    paddingTop: 96,
    paddingBottom: space.xl,
  },
  intro: { alignItems: "center" },
  mark: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.lg,
  },
  markText: { fontSize: 30, fontWeight: "900", letterSpacing: -1 },
  brand: { fontSize: 34, fontWeight: "800", letterSpacing: -1.2 },
  lede: { fontSize: 15, lineHeight: 22, marginTop: space.sm, textAlign: "center" },
  authArea: { minHeight: 120, justifyContent: "center" },
  providerBlock: { position: "relative", gap: space.md },
  appleButton: { width: "100%", height: tapSize + 8 },
  buttonSpinner: { position: "absolute", alignSelf: "center", top: 16 },
  googleButton: {
    width: "100%",
    height: tapSize + 8,
  },
  errorBlock: { alignItems: "center", gap: space.md },
  error: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  retry: {
    minHeight: tapSize,
    borderWidth: 1,
    borderRadius: radius.button,
    paddingHorizontal: space.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: { fontSize: 14, fontWeight: "700" },
  privacy: { fontSize: 11, lineHeight: 17, textAlign: "center", paddingHorizontal: space.md },
});
