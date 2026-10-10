/**
 * 프로필 편집. 저장하면 서버에 남고 웹에서도 바로 보입니다.
 *
 * 웹의 프로필 편집과 같은 칸(이름·자기소개·나이·성별·사는 곳·가르칠 수 있는 말·
 * 배우는 말·단계·목표)을 고칠 수 있습니다. 칸 모양과 검사는 처음 설정과 같이 씁니다.
 */
import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ApiError, api } from "../lib/api";
import { t } from "../lib/i18n";
import {
  draftFromMe,
  fieldFromServer,
  profileErrors,
  profilePatch,
  type ProfileDraft,
  type ProfileField,
} from "../lib/profile";
import { useSession, type Me } from "../lib/session";
import { useTheme } from "../lib/useTheme";
import { radius, space } from "../lib/theme";
import { Avatar, Loading, PrimaryButton } from "../ui";
import { ProfileFields } from "../ui/ProfileFields";

const FIELDS: readonly ProfileField[] = [
  "name", "bio", "age", "gender", "country", "native", "learning", "level", "goal",
];

export function EditProfileScreen({
  onDone,
  onEditAvatar,
}: {
  onDone: () => void;
  onEditAvatar: () => void;
}) {
  const { me, applyMe } = useSession();
  const c = useTheme();
  const [draft, setDraft] = useState<ProfileDraft | null>(() => (me ? draftFromMe(me) : null));
  const [serverErrors, setServerErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const change = (next: ProfileDraft) => {
    setDraft(next);
    setServerErrors({});
    setError("");
  };

  const save = useCallback(async () => {
    if (busy || !me || !draft) return;
    // 서버 규칙(이름 2자 이상, 나이 18~100, 목표는 비우거나 2자 이상)을 먼저 확인합니다.
    const problems = profileErrors(draft, false);
    const first = Object.values(problems)[0];
    if (first) {
      setError(first);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await api<Me>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ ...profilePatch(draft, me), bio: draft.bio.trim() }),
      });
      applyMe(saved);
      onDone();
    } catch (caught) {
      const field = caught instanceof ApiError ? fieldFromServer(caught.field) : null;
      const message = caught instanceof ApiError ? caught.message : t("요청을 처리하지 못했어요.");
      if (field) setServerErrors({ [field]: message });
      setError(message);
    } finally {
      setBusy(false);
    }
  }, [busy, me, draft, applyMe, onDone]);

  if (!me || !draft) return <Loading />;

  // 고치는 동안 칸마다 이유를 바로 보여줍니다. 편집은 이미 채워진 값에서 시작하기 때문입니다.
  const errors = { ...profileErrors(draft, false), ...serverErrors };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={onEditAvatar}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t("캐릭터 꾸미기")}
          style={({ pressed }) => [
            styles.avatarRow,
            { backgroundColor: c.surfaceSoft, borderColor: c.line, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Avatar
            name={me.name}
            photo={me.avatarUrl}
            avatarMode={me.avatarMode}
            avatarConfig={me.avatarConfig}
            size={56}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.avatarTitle, { color: c.ink }]}>
              {t("캐릭터 꾸미기")}
            </Text>
            <Text style={[styles.avatarHint, { color: c.subtle }]}>
              {t("나만의 프로필 캐릭터를 만들어보세요")}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.subtle} />
        </Pressable>

        <ProfileFields draft={draft} onChange={change} errors={errors} disabled={busy} fields={FIELDS} />

        {error ? <Text accessibilityRole="alert" style={[styles.error, { color: c.danger }]}>{error}</Text> : null}

        <View style={{ marginTop: space.lg }}>
          <PrimaryButton
            label={t("저장")}
            onPress={() => void save()}
            disabled={!draft.name.trim()}
            busy={busy}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.xs },
  avatarRow: {
    minHeight: 80,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  avatarTitle: { fontSize: 15, fontWeight: "700" },
  avatarHint: { fontSize: 12, lineHeight: 17 },
  error: { fontSize: 13, marginTop: space.md },
});
