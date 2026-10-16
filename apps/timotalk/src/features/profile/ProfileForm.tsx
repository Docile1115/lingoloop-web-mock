/**
 * 프로필 입력칸 묶음. 첫 설정(단계마다 일부 칸)과 프로필 편집(전부)이 같은 칸을 같은 모양으로 씁니다.
 * 잘못된 칸에는 바로 아래에 이유를 적습니다(서버가 알려 준 칸도 같은 자리).
 */
import { View } from "react-native";
import {
  GENDER_OPTIONS,
  GOAL_PRESETS,
  LEARNING_LEVELS,
  LEVEL_LABELS,
  PROFILE_LANGUAGES,
  availabilityLabels,
  countryLabels,
  interestLabels,
} from "@shared/profile-options";
import { t, tx } from "@/lib/i18n";
import { space } from "@/theme/tokens";
import { ChoiceChip, ChoiceGroup, TextField } from "@/ui/Field";
import type { ProfileDraft, ProfileErrors, ProfileField } from "./draft";

export function ProfileForm({
  draft,
  onChange,
  errors,
  fields,
  disabled,
}: {
  draft: ProfileDraft;
  onChange: (next: ProfileDraft) => void;
  errors: ProfileErrors;
  /** 보여 줄 칸(순서는 이 파일의 순서를 따릅니다) */
  fields: readonly ProfileField[];
  disabled?: boolean;
}) {
  const show = (field: ProfileField) => fields.includes(field);
  const set = (patch: Partial<ProfileDraft>) => onChange({ ...draft, ...patch });
  const toggle = (key: "interests" | "availability", value: string) =>
    set({ [key]: draft[key].includes(value) ? draft[key].filter((one) => one !== value) : [...draft[key], value] });

  return (
    <View style={{ gap: space.xl }}>
      {show("name") ? (
        <TextField label={t("이름")} value={draft.name} onChangeText={(name) => set({ name })} maxLength={40} error={errors.name} disabled={disabled} />
      ) : null}

      {show("bio") ? (
        <TextField
          label={t("자기소개")}
          value={draft.bio}
          onChangeText={(bio) => set({ bio })}
          multiline
          maxLength={500}
          placeholder={t("어떤 사람인지 짧게 알려주세요.")}
          hint={t("{count}/500자", { count: draft.bio.length })}
          error={errors.bio}
          disabled={disabled}
        />
      ) : null}

      {show("age") ? (
        <TextField
          label={t("나이")}
          value={draft.age}
          onChangeText={(age) => set({ age: age.replace(/[^0-9]/g, "") })}
          keyboardType="number-pad"
          maxLength={3}
          width={120}
          placeholder={t("숫자만")}
          hint={t("만 18세부터 쓸 수 있어요.")}
          error={errors.age}
          disabled={disabled}
        />
      ) : null}

      {show("gender") ? (
        <ChoiceGroup label={t("성별")} error={errors.gender}>
          {GENDER_OPTIONS.map(([value, label]) => (
            <ChoiceChip key={value} label={tx(label)} selected={draft.gender === value} disabled={disabled} onPress={() => set({ gender: value })} />
          ))}
        </ChoiceGroup>
      ) : null}

      {show("country") ? (
        <ChoiceGroup label={t("사는 곳")} error={errors.country}>
          {Object.entries(countryLabels).map(([code, label]) => (
            <ChoiceChip key={code} label={tx(label)} selected={draft.country === code} disabled={disabled} onPress={() => set({ country: code })} />
          ))}
        </ChoiceGroup>
      ) : null}

      {show("native") ? (
        <ChoiceGroup label={t("가르칠 수 있는 말")} hint={t("모국어처럼 편한 말을 골라 주세요.")} error={errors.native}>
          {PROFILE_LANGUAGES.map(({ code, label }) => (
            <ChoiceChip
              key={code}
              label={tx(label)}
              selected={draft.native === code}
              disabled={disabled}
              // 배우는 말과 같은 말을 고르면 둘을 맞바꿉니다(웹과 같은 규칙).
              onPress={() => set({ native: code, learning: draft.learning === code ? draft.native : draft.learning })}
            />
          ))}
        </ChoiceGroup>
      ) : null}

      {show("learning") ? (
        <ChoiceGroup label={t("배우는 말")} error={errors.learning}>
          {PROFILE_LANGUAGES.filter(({ code }) => code !== draft.native).map(({ code, label }) => (
            <ChoiceChip key={code} label={tx(label)} selected={draft.learning === code} disabled={disabled} onPress={() => set({ learning: code })} />
          ))}
        </ChoiceGroup>
      ) : null}

      {show("level") ? (
        <ChoiceGroup label={t("지금 어느 정도인가요")} error={errors.level}>
          {LEARNING_LEVELS.map((level) => (
            <ChoiceChip key={level} label={tx(LEVEL_LABELS[level])} selected={draft.level === level} disabled={disabled} onPress={() => set({ level })} />
          ))}
        </ChoiceGroup>
      ) : null}

      {show("goal") ? (
        <View style={{ gap: space.sm }}>
          {/* 웹·옛 앱과 같은 예시. 누르면 그 문구가 목표가 되고, 아래 칸에서 직접 고쳐 써도 됩니다. */}
          <ChoiceGroup label={t("학습 목표")}>
            {GOAL_PRESETS.map((preset) => {
              const title = tx(preset.title);
              return <ChoiceChip key={preset.id} label={title} selected={draft.goal.trim() === title} disabled={disabled} onPress={() => set({ goal: title })} />;
            })}
          </ChoiceGroup>
          <TextField
            label={t("직접 적기")}
            value={draft.goal}
            onChangeText={(goal) => set({ goal })}
            maxLength={100}
            placeholder={t("예: 면접에서 막힘 없이 말하기")}
            error={errors.goal}
            disabled={disabled}
          />
        </View>
      ) : null}

      {show("interests") ? (
        <ChoiceGroup label={t("관심사")} hint={t("고르지 않아도 돼요.")} error={errors.interests} multiple>
          {Object.entries(interestLabels).map(([code, label]) => (
            <ChoiceChip key={code} label={tx(label)} selected={draft.interests.includes(code)} multiple disabled={disabled} onPress={() => toggle("interests", code)} />
          ))}
        </ChoiceGroup>
      ) : null}

      {show("availability") ? (
        <ChoiceGroup label={t("주로 대화 가능한 시간")} hint={t("고르지 않아도 돼요.")} error={errors.availability} multiple>
          {Object.entries(availabilityLabels).map(([code, label]) => (
            <ChoiceChip
              key={code}
              label={tx(label)}
              selected={draft.availability.includes(code)}
              multiple
              disabled={disabled}
              onPress={() => toggle("availability", code)}
            />
          ))}
        </ChoiceGroup>
      ) : null}
    </View>
  );
}
