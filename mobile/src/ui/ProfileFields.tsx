/**
 * 프로필 입력칸 묶음. 처음 설정과 프로필 편집이 같은 칸을 같은 모양으로 씁니다.
 *
 * 값을 고르는 칸은 칩으로 둡니다 — 폰에서 드롭다운보다 한 번에 보이고 누르기 쉽습니다.
 * 잘못된 칸에는 바로 아래에 이유를 적습니다(서버가 알려준 칸도 같은 자리).
 */
import { StyleSheet, Text, TextInput, View } from "react-native";
import { interestName } from "@shared/live-data";
import { GOAL_PRESETS } from "@shared/profile-options";
import { t } from "../lib/i18n";
import {
  AVAILABILITY,
  COUNTRIES,
  GENDERS,
  INTERESTS,
  LANGUAGE_CODES,
  LEVEL_LABELS,
  LEVELS,
  languageLabel,
  type ProfileDraft,
  type ProfileField,
} from "../lib/profile";
import { radius, space, tapSize } from "../lib/theme";
import { useTheme } from "../lib/useTheme";
import { Chip } from "./index";

export function ProfileFields({
  draft,
  onChange,
  errors,
  disabled,
  fields,
}: {
  draft: ProfileDraft;
  onChange: (next: ProfileDraft) => void;
  errors: Partial<Record<ProfileField, string>>;
  disabled?: boolean;
  /** 보여줄 칸. 처음 설정은 자기소개를 뺍니다. */
  fields: readonly ProfileField[];
}) {
  const c = useTheme();
  const show = (field: ProfileField) => fields.includes(field);
  const set = (patch: Partial<ProfileDraft>) => onChange({ ...draft, ...patch });
  const toggle = (key: "interests" | "availability", value: string) =>
    set({ [key]: draft[key].includes(value) ? draft[key].filter((one) => one !== value) : [...draft[key], value] });
  const error = (field: ProfileField) =>
    errors[field] ? (
      <Text accessibilityLiveRegion="polite" style={[styles.error, { color: c.danger }]}>{errors[field]}</Text>
    ) : null;
  const input = [styles.input, { backgroundColor: c.surfaceSoft, borderColor: c.line, color: c.ink }];

  return (
    <View style={{ gap: space.xs }}>
      {show("name") ? (
        <>
          <Text style={[styles.label, { color: c.ink }]}>{t("이름")}</Text>
          <TextInput
            style={input}
            value={draft.name}
            onChangeText={(name) => set({ name })}
            maxLength={40}
            editable={!disabled}
            accessibilityLabel={t("이름")}
          />
          {error("name")}
        </>
      ) : null}

      {show("bio") ? (
        <>
          <Text style={[styles.label, { color: c.ink }]}>{t("자기소개")}</Text>
          <TextInput
            style={[styles.area, { backgroundColor: c.surfaceSoft, borderColor: c.line, color: c.ink }]}
            value={draft.bio}
            onChangeText={(bio) => set({ bio })}
            multiline
            maxLength={500}
            editable={!disabled}
            placeholder={t("어떤 사람인지 짧게 알려주세요.")}
            placeholderTextColor={c.subtle}
            accessibilityLabel={t("자기소개")}
          />
          {error("bio")}
        </>
      ) : null}

      {show("age") ? (
        <>
          <Text style={[styles.label, { color: c.ink }]}>{t("나이")}</Text>
          <TextInput
            style={[input, { width: 120 }]}
            value={draft.age}
            onChangeText={(age) => set({ age: age.replace(/[^0-9]/g, "") })}
            keyboardType="number-pad"
            maxLength={3}
            editable={!disabled}
            placeholder={t("숫자만")}
            placeholderTextColor={c.subtle}
            accessibilityLabel={t("나이")}
          />
          {errors.age ? error("age") : <Text style={[styles.hint, { color: c.subtle }]}>{t("만 18세부터 쓸 수 있어요.")}</Text>}
        </>
      ) : null}

      {show("gender") ? (
        <>
          <Text style={[styles.label, { color: c.ink }]}>{t("성별")}</Text>
          <View style={styles.chips}>
            {GENDERS.map(([value, label]) => (
              <Chip key={value} label={t(label)} active={draft.gender === value} onPress={() => !disabled && set({ gender: value })} />
            ))}
          </View>
          {error("gender")}
        </>
      ) : null}

      {show("country") ? (
        <>
          <Text style={[styles.label, { color: c.ink }]}>{t("사는 곳")}</Text>
          <View style={styles.chips}>
            {COUNTRIES.map((country) => (
              <Chip
                key={country.code}
                label={`${country.flag} ${t(country.label)}`}
                active={draft.country === country.code}
                onPress={() => !disabled && set({ country: country.code })}
              />
            ))}
          </View>
          {error("country")}
        </>
      ) : null}

      {show("native") ? (
        <>
          <Text style={[styles.label, { color: c.ink }]}>{t("가르칠 수 있는 말")}</Text>
          <View style={styles.chips}>
            {LANGUAGE_CODES.map((code) => (
              <Chip
                key={code}
                label={languageLabel(code)}
                active={draft.native === code}
                // 배우는 말과 같은 말을 고르면 둘을 맞바꿉니다(웹과 같은 규칙).
                onPress={() => !disabled && set({ native: code, learning: draft.learning === code ? draft.native : draft.learning })}
              />
            ))}
          </View>
          {error("native")}
        </>
      ) : null}

      {show("learning") ? (
        <>
          <Text style={[styles.label, { color: c.ink }]}>{t("배우는 말")}</Text>
          <View style={styles.chips}>
            {LANGUAGE_CODES.filter((code) => code !== draft.native).map((code) => (
              <Chip
                key={code}
                label={languageLabel(code)}
                active={draft.learning === code}
                onPress={() => !disabled && set({ learning: code })}
              />
            ))}
          </View>
          {error("learning")}
        </>
      ) : null}

      {show("level") ? (
        <>
          <Text style={[styles.label, { color: c.ink }]}>{t("지금 어느 정도인가요")}</Text>
          <View style={styles.chips}>
            {LEVELS.map((level) => (
              <Chip key={level} label={t(LEVEL_LABELS[level])} active={draft.level === level} onPress={() => !disabled && set({ level })} />
            ))}
          </View>
          {error("level")}
        </>
      ) : null}

      {show("goal") ? (
        <>
          <Text style={[styles.label, { color: c.ink }]}>{t("학습 목표")}</Text>
          {/* 웹의 처음 설정과 같은 예시. 누르면 그 문구가 목표가 되고, 아래 칸에서 직접 고쳐 써도 됩니다. */}
          <View style={styles.chips}>
            {GOAL_PRESETS.map((preset) => {
              const title = t(preset.title);
              return (
                <Chip key={preset.id} label={title} active={draft.goal.trim() === title} onPress={() => !disabled && set({ goal: title })} />
              );
            })}
          </View>
          <TextInput
            style={input}
            value={draft.goal}
            onChangeText={(goal) => set({ goal })}
            maxLength={100}
            editable={!disabled}
            placeholder={t("예: 면접에서 막힘 없이 말하기")}
            placeholderTextColor={c.subtle}
            accessibilityLabel={t("학습 목표")}
          />
          {error("goal")}
        </>
      ) : null}

      {show("interests") ? (
        <>
          <Text style={[styles.label, { color: c.ink }]}>{t("관심사")}</Text>
          <Text style={[styles.hint, { color: c.subtle }]}>{t("고르지 않아도 돼요.")}</Text>
          <View style={styles.chips}>
            {INTERESTS.map(([code]) => (
              <Chip key={code} label={interestName(code)} active={draft.interests.includes(code)} onPress={() => !disabled && toggle("interests", code)} />
            ))}
          </View>
          {error("interests")}
        </>
      ) : null}

      {show("availability") ? (
        <>
          <Text style={[styles.label, { color: c.ink }]}>{t("주로 대화 가능한 시간")}</Text>
          <Text style={[styles.hint, { color: c.subtle }]}>{t("고르지 않아도 돼요.")}</Text>
          <View style={styles.chips}>
            {AVAILABILITY.map(([code, label]) => (
              <Chip key={code} label={t(label)} active={draft.availability.includes(code)} onPress={() => !disabled && toggle("availability", code)} />
            ))}
          </View>
          {error("availability")}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", marginTop: space.md },
  hint: { fontSize: 12, lineHeight: 17 },
  error: { fontSize: 13, lineHeight: 18 },
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
});
