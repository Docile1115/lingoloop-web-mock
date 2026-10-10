/**
 * 처음 설정.
 *
 * 새 계정은 서버 기본값(한국어 원어민·영어 학습·18세·대한민국)으로 만들어지고,
 * 설정을 마치기 전(onboardedAt === null)에는 다른 사람의 탐색에 보이지 않습니다.
 * 기본값을 그대로 두면 엉뚱한 사람과 이어지므로 탭에 들어가기 전에 꼭 고르게 합니다.
 *
 * 기기 설정의 나라·언어는 미리 골라 둡니다(바꿀 수 있습니다). 나이·성별·배우는 말·
 * 단계·목표는 본인이 직접 고르게 비워 둡니다.
 */
import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getLocales } from "expo-localization";
import { ApiError, api } from "../lib/api";
import { t } from "../lib/i18n";
import {
  COUNTRIES,
  LANGUAGE_CODES,
  draftFromMe,
  fieldFromServer,
  profileErrors,
  profilePatch,
  type ProfileDraft,
  type ProfileField,
} from "../lib/profile";
import { useSession, type Me } from "../lib/session";
import { space, tapSize } from "../lib/theme";
import { useKeyboardOffset } from "../lib/useKeyboardOffset";
import { useTheme } from "../lib/useTheme";
import { Loading, PrimaryButton } from "../ui";
import { ProfileFields } from "../ui/ProfileFields";

const FIELDS: readonly ProfileField[] = [
  "name", "age", "gender", "country", "native", "learning", "level", "goal", "interests", "availability",
];

function firstDraft(me: Me): ProfileDraft {
  const device = getLocales()[0];
  const country = COUNTRIES.find((row) => row.code === device?.regionCode?.toUpperCase())?.code ?? "";
  const native = LANGUAGE_CODES.find((code) => code === device?.languageCode?.slice(0, 2)) ?? "";
  return {
    ...draftFromMe(me),
    age: "",
    gender: "",
    country,
    native,
    learning: "",
    level: "",
    goal: "",
    interests: [],
    availability: [],
  };
}

export function OnboardingScreen() {
  const c = useTheme();
  // 헤더가 없고 위쪽 안전 영역부터 시작하는 화면입니다.
  const keyboardOffset = useKeyboardOffset("none");
  const { me, applyMe, signOut } = useSession();
  const [draft, setDraft] = useState<ProfileDraft | null>(() => (me ? firstDraft(me) : null));
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const local = draft ? profileErrors(draft, true) : {};
  // 저장을 한 번 누른 뒤부터 칸마다 이유를 보여줍니다. 처음부터 빨간 글씨로 채우지 않습니다.
  const errors = { ...(submitted ? local : {}), ...serverErrors };

  const change = (next: ProfileDraft) => {
    setDraft(next);
    setServerErrors({});
    setError("");
  };

  const save = useCallback(async () => {
    if (!draft || !me || busy) return;
    setSubmitted(true);
    if (Object.keys(profileErrors(draft, true)).length) {
      setError(t("빠진 칸을 채워 주세요."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await api<Me>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          ...profilePatch(draft, me),
          interests: draft.interests,
          availability: draft.availability,
          completeOnboarding: true,
        }),
      });
      // 저장은 됐는데 응답에 완료 시각이 빠졌더라도 이번 실행에서는 다시 묻지 않습니다.
      // 서버 값이 기준이라 다음 실행 때 /api/auth/me 가 다시 판단합니다.
      applyMe(saved.onboardedAt === null ? { ...saved, onboardedAt: undefined } : saved);
    } catch (caught) {
      const field = caught instanceof ApiError ? fieldFromServer(caught.field) : null;
      const message = caught instanceof Error && caught.message ? caught.message : t("프로필을 저장하지 못했어요.");
      if (field) setServerErrors({ [field]: message });
      setError(message);
    } finally {
      setBusy(false);
    }
  }, [draft, me, busy, applyMe]);

  if (!me || !draft) return <Loading />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: c.ink }]}>{t("시작하기 전에 나를 알려 주세요")}</Text>
          <Text style={[styles.lede, { color: c.muted }]}>
            {t("설정을 마치면 다른 사람에게 내 프로필이 보여요. 나중에 프로필에서 언제든 바꿀 수 있어요.")}
          </Text>

          <ProfileFields draft={draft} onChange={change} errors={errors} disabled={busy} fields={FIELDS} />

          {error ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: c.danger }]}>{error}</Text>
          ) : null}

          <View style={{ marginTop: space.lg }}>
            <PrimaryButton label={t("시작하기")} onPress={() => void save()} busy={busy} />
          </View>
          <Pressable
            onPress={() => void signOut()}
            disabled={busy}
            accessibilityRole="button"
            style={styles.signOut}
          >
            <Text style={{ color: c.muted, fontSize: 14, fontWeight: "600" }}>{t("로그아웃")}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, paddingBottom: space.xl * 2, gap: space.xs },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.6, marginTop: space.lg },
  lede: { fontSize: 14, lineHeight: 21, marginTop: space.xs },
  error: { fontSize: 13, marginTop: space.md },
  signOut: { minHeight: tapSize, alignItems: "center", justifyContent: "center", marginTop: space.sm },
});
