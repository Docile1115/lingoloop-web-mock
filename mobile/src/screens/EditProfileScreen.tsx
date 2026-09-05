/** 프로필 편집. 저장하면 서버에 남고 웹에서도 바로 보입니다. */
import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ApiError, api } from "../lib/api";
import { t } from "../lib/i18n";
import { useSession, type Me } from "../lib/session";
import { useTheme } from "../lib/useTheme";
import { radius, space, tapSize } from "../lib/theme";
import { Avatar, Chip, Loading, PrimaryButton } from "../ui";

/** 서버가 받는 단계. backend/server.mjs 의 LEARNING_LEVELS 와 같은 순서입니다. */
const LEVELS = ["beginner", "elementary", "intermediate", "upper", "advanced"] as const;
const LEVEL_LABELS: Record<(typeof LEVELS)[number], string> = {
  beginner: "이제 시작했어요",
  elementary: "짧은 문장은 말해요",
  intermediate: "일상 대화는 해요",
  upper: "어려운 얘기도 해요",
  advanced: "거의 불편함이 없어요",
};

export function EditProfileScreen({
  onDone,
  onEditAvatar,
}: {
  onDone: () => void;
  onEditAvatar: () => void;
}) {
  const { me, refresh } = useSession();
  const c = useTheme();
  const [name, setName] = useState(me?.name ?? "");
  const [bio, setBio] = useState(me?.bio ?? "");
  const [goal, setGoal] = useState(me?.learningLanguages?.[0]?.goal ?? "");
  const [level, setLevel] = useState(me?.learningLanguages?.[0]?.level ?? "beginner");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = useCallback(async () => {
    if (busy || !me) return;
    setBusy(true);
    setError("");
    try {
      const learning = me.learningLanguages?.[0];
      await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          bio: bio.trim(),
          learningLanguages: learning
            ? [{ code: learning.code, level, goal: goal.trim() }]
            : undefined,
        }),
      });
      await refresh();
      onDone();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("요청을 처리하지 못했어요."));
    } finally {
      setBusy(false);
    }
  }, [busy, me, name, bio, goal, level, refresh, onDone]);

  if (!me) return <Loading />;

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

        <Text style={[styles.label, { color: c.ink }]}>{t("이름")}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: c.surfaceSoft, borderColor: c.line, color: c.ink }]}
          value={name}
          onChangeText={setName}
          maxLength={40}
          editable={!busy}
        />

        <Text style={[styles.label, { color: c.ink }]}>{t("자기소개")}</Text>
        <TextInput
          style={[styles.area, { backgroundColor: c.surfaceSoft, borderColor: c.line, color: c.ink }]}
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={500}
          editable={!busy}
          placeholder={t("어떤 사람인지 짧게 알려주세요.")}
          placeholderTextColor={c.subtle}
        />

        <Text style={[styles.label, { color: c.ink }]}>{t("학습 목표")}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: c.surfaceSoft, borderColor: c.line, color: c.ink }]}
          value={goal}
          onChangeText={setGoal}
          maxLength={100}
          editable={!busy}
          placeholder={t("예: 면접에서 막힘 없이 말하기")}
          placeholderTextColor={c.subtle}
        />

        <Text style={[styles.label, { color: c.ink }]}>{t("지금 어느 정도인가요")}</Text>
        <View style={styles.chips}>
          {LEVELS.map((one) => (
            <Chip
              key={one}
              label={t(LEVEL_LABELS[one] as never)}
              active={level === one}
              onPress={() => setLevel(one)}
            />
          ))}
        </View>

        {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}

        <View style={{ marginTop: space.lg }}>
          <PrimaryButton
            label={t("저장")}
            onPress={() => void save()}
            disabled={!name.trim()}
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
  label: { fontSize: 13, fontWeight: "600", marginTop: space.md },
  input: {
    height: tapSize + 4,
    paddingHorizontal: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.button,
    fontSize: 15,
  },
  area: {
    minHeight: 96,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.button,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: "top",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  error: { fontSize: 13, marginTop: space.md },
});
