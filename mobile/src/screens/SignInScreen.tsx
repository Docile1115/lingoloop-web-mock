import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../lib/api";
import { t } from "../lib/i18n";
import { useSession } from "../lib/session";
import { useTheme } from "../lib/useTheme";
import { radius, space, tapSize } from "../lib/theme";

export function SignInScreen() {
  const c = useTheme();
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      await signIn(email.trim(), password);
    } catch (caught) {
      // 서버가 왜 거절했는지 그대로 보여줍니다 — "실패했어요" 만 띄우면 고칠 수가 없습니다.
      setError(caught instanceof ApiError ? caught.message : t("요청을 처리하지 못했어요."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "bottom"]}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        <Text style={[s.brand, { color: c.ink }]}>TimoTalk</Text>
        <Text style={[s.lede, { color: c.muted }]}>{t("진짜 사람과 이야기하며 언어를 배워요.")}</Text>

        <Text style={[s.label, { color: c.ink }]}>{t("이메일")}</Text>
        <TextInput
          style={[s.input, { borderColor: c.line, backgroundColor: c.surfaceSoft, color: c.ink }]}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@example.com"
          placeholderTextColor={c.subtle}
          editable={!busy}
        />

        <Text style={[s.label, { color: c.ink }]}>{t("비밀번호")}</Text>
        <TextInput
          style={[s.input, { borderColor: c.line, backgroundColor: c.surfaceSoft, color: c.ink }]}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          editable={!busy}
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        {error ? <Text style={[s.error, { color: c.danger }]}>{error}</Text> : null}

        <Pressable
          style={[s.button, { backgroundColor: canSubmit ? c.primary : c.sunken }]}
          onPress={submit}
          disabled={!canSubmit}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color={c.onPrimary} />
          ) : (
            <Text style={[s.buttonText, { color: canSubmit ? c.onPrimary : c.subtle }]}>
              {t("로그인")}
            </Text>
          )}
        </Pressable>

        <View style={s.footer}>
          <Text style={[s.footerNote, { color: c.subtle }]}>
            {t("웹에서 쓰던 계정으로 그대로 로그인해요.")}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: "center", padding: space.xl, gap: space.sm },
  brand: { fontSize: 32, fontWeight: "700", letterSpacing: -1 },
  lede: { fontSize: 15, lineHeight: 21, marginBottom: space.xl },
  label: { fontSize: 13, fontWeight: "600", marginTop: space.md },
  input: {
    height: tapSize + 4,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderRadius: radius.button,
    fontSize: 15,
  },
  error: { fontSize: 13, lineHeight: 18, marginTop: space.md },
  button: {
    height: tapSize + 4,
    marginTop: space.xl,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.button,
  },
  buttonText: { fontSize: 15, fontWeight: "700" },
  footer: { marginTop: space.xl, alignItems: "center" },
  footerNote: { fontSize: 12 },
});
