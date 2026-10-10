"use client";

import { useState } from "react";
import { CheckCircle2, ChevronRight, Languages } from "lucide-react";
import { t, tx, currentLocaleSnapshot } from "../lib/i18n";
import { api, type ApiProfile } from "../lib/live-data";
import { LIMITS } from "../lib/validation";
import {
  GENDER_OPTIONS,
  GOAL_PRESETS,
  LEARNING_LEVELS,
  LEVEL_LABELS,
  PROFILE_LANGUAGES,
  availabilityLabels,
  countryLabels,
  interestLabels,
  type LearningLevel,
} from "../lib/profile-options";

type SetupDraft = {
  name: string;
  age: number;
  gender: string;
  countryCode: string;
  nativeCode: string;
  learningCode: string;
  level: LearningLevel;
  goal: string;
  availability: string[];
  interests: string[];
};

/** 브라우저 언어로 짐작한 첫 값. 화면에 그대로 보이므로 사용자가 확인하고 바꿀 수 있습니다. */
function guessFromBrowser(): { nativeCode: string; countryCode: string } {
  const tag = typeof navigator === "undefined" ? "" : navigator.language || "";
  const [language = "", region = ""] = tag.split("-");
  const nativeCode = PROFILE_LANGUAGES.some((item) => item.code === language) ? language : currentLocaleSnapshot();
  const countryCode = countryLabels[region.toUpperCase()] ? region.toUpperCase() : "";
  return { nativeCode, countryCode };
}

/**
 * 처음 로그인한 사람의 첫 설정.
 *
 * 새 계정은 서버 기본값(한국어 원어민·영어 학습·18세·대한민국)으로 만들어집니다. 예전에는
 * 그 값이 그대로 다른 사람의 추천에 나갔습니다 — 일본어 원어민이 "한국어 원어민"으로
 * 소개되는 식이었습니다. 이 화면을 마쳐야 추천·검색에 나오고 앱 안으로 들어갑니다.
 */
export function FirstRunSetup({
  me,
  onDone,
  onSignOut,
}: {
  me: ApiProfile;
  onDone: (profile: ApiProfile) => void;
  onSignOut: () => void;
}) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<SetupDraft>(() => {
    const guess = guessFromBrowser();
    const learningCode = guess.nativeCode === "en" ? "ko" : "en";
    return {
      // 소셜 계정의 표시 이름. 화면에 그대로 보이므로 여기서 고칠 수 있습니다.
      name: me.name,
      age: 0,
      gender: me.gender && me.gender !== "unspecified" ? me.gender : "unspecified",
      countryCode: guess.countryCode,
      nativeCode: guess.nativeCode,
      learningCode,
      level: "beginner",
      goal: t(GOAL_PRESETS[0].title),
      availability: [],
      interests: [],
    };
  });
  const update = (patch: Partial<SetupDraft>) => setDraft((current) => ({ ...current, ...patch }));
  /** 여러 개 고르는 칸. 지금 값에서 바꿔야 빠르게 연달아 눌러도 앞의 선택이 사라지지 않습니다. */
  const toggle = (field: "availability" | "interests", value: string) =>
    setDraft((current) => ({
      ...current,
      [field]: current[field].includes(value) ? current[field].filter((item) => item !== value) : [...current[field], value],
    }));

  const nameError = draft.name.trim().length < 2 ? t("이름은 2자 이상 적어 주세요.") : "";
  const ageError = !Number.isInteger(draft.age) || draft.age < 18 || draft.age > 100 ? t("나이는 18세에서 100세 사이로 적어 주세요.") : "";
  const stepValid =
    step === 1
      ? !nameError && !ageError && Boolean(draft.countryCode)
      : step === 2
        ? Boolean(draft.nativeCode) && Boolean(draft.learningCode) && draft.learningCode !== draft.nativeCode
        : draft.goal.trim().length >= 2;

  async function finish() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const updated = await api<ApiProfile>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name.trim(),
          age: draft.age,
          gender: draft.gender,
          countryCode: draft.countryCode,
          nativeLanguages: [draft.nativeCode],
          learningLanguages: [{ code: draft.learningCode, level: draft.level, goal: draft.goal.trim() }],
          availability: draft.availability,
          interests: draft.interests,
          completeOnboarding: true,
        }),
      });
      // 오늘의 파트너는 배울 언어의 원어민을 찾습니다. 기본값(영어)에 두면 일본어를 배우는
      // 사람에게도 영어 원어민만 추천됩니다.
      await api("/api/matching/preferences", {
        method: "POST",
        body: JSON.stringify({
          targetLanguages: [draft.learningCode],
          ...(draft.availability.length ? { availability: draft.availability } : {}),
        }),
      }).catch(() => undefined);
      onDone({ ...me, ...updated });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("프로필을 저장하지 못했어요."));
      setSaving(false);
    }
  }

  return (
    <main className="signin-page first-run">
      <section className="onboarding-content first-run-card" aria-labelledby="first-run-title">
        <header>
          <strong>
            <Languages size={18} aria-hidden="true" /> TimoTalk
          </strong>
          <span>{t("STEP {step} / 3", { step })}</span>
        </header>
        <div className="onboarding-progress">
          <i style={{ width: `${step * 33.333}%` }} />
        </div>

        <fieldset disabled={saving}>
          {step === 1 ? (
            <section>
              <h2 id="first-run-title">{t("반가워요! 몇 가지만 알려 주세요")}</h2>
              <p>{t("추천과 대화가 이 정보에 맞춰져요. 나중에 프로필에서 바꿀 수 있어요.")}</p>
              <div className="form-section">
                <label className="field-label" htmlFor="first-run-name">{t("이름")}</label>
                <input
                  id="first-run-name"
                  className="text-input"
                  value={draft.name}
                  maxLength={LIMITS.profileName}
                  autoComplete="nickname"
                  aria-invalid={Boolean(draft.name) && Boolean(nameError)}
                  onChange={(event) => update({ name: event.target.value })}
                />
                {draft.name && nameError ? <small className="field-error">{nameError}</small> : null}
              </div>
              <div className="form-section">
                <label className="field-label" htmlFor="first-run-age">{t("나이")}</label>
                <input
                  id="first-run-age"
                  className="text-input"
                  type="number"
                  inputMode="numeric"
                  min={18}
                  max={100}
                  value={draft.age || ""}
                  placeholder={t("숫자만")}
                  aria-invalid={Boolean(draft.age) && Boolean(ageError)}
                  onChange={(event) => update({ age: Number(event.target.value) || 0 })}
                />
                {draft.age && ageError ? <small className="field-error">{ageError}</small> : <small className="field-hint">{t("만 18세부터 쓸 수 있어요.")}</small>}
              </div>
              <div className="form-section">
                <span className="field-label">{t("성별")}</span>
                <div className="chip-row" role="group" aria-label={t("성별")}>
                  {GENDER_OPTIONS.map(([value, label]) => (
                    <button type="button" key={value} className={draft.gender === value ? "chip active" : "chip"} aria-pressed={draft.gender === value} onClick={() => update({ gender: value })}>
                      {tx(label)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-section">
                <span className="field-label">{t("사는 나라")}</span>
                <div className="chip-row" role="group" aria-label={t("사는 나라")}>
                  {Object.entries(countryLabels).map(([code, label]) => (
                    <button type="button" key={code} className={draft.countryCode === code ? "chip active" : "chip"} aria-pressed={draft.countryCode === code} onClick={() => update({ countryCode: code })}>
                      {tx(label)}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section>
              <h2 id="first-run-title">{t("어떤 언어를 함께 나누고 싶나요?")}</h2>
              <p>{t("나중에 프로필에서 언제든 바꿀 수 있어요.")}</p>
              <div className="form-section">
                <span className="field-label">{t("내 모국어")}</span>
                <div className="chip-row" role="group" aria-label={t("내 모국어")}>
                  {PROFILE_LANGUAGES.map((option) => (
                    <button
                      type="button"
                      key={option.code}
                      className={draft.nativeCode === option.code ? "chip active" : "chip"}
                      aria-pressed={draft.nativeCode === option.code}
                      onClick={() =>
                        update({
                          nativeCode: option.code,
                          // 배울 언어와 같은 말을 고르면 둘을 맞바꿉니다.
                          learningCode: draft.learningCode === option.code ? draft.nativeCode : draft.learningCode,
                        })
                      }
                    >
                      <span aria-hidden="true">{option.flag}</span> {tx(option.label)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-section">
                <span className="field-label">{t("배울 언어")}</span>
                <div className="chip-row" role="group" aria-label={t("배울 언어")}>
                  {PROFILE_LANGUAGES.filter((option) => option.code !== draft.nativeCode).map((option) => (
                    <button type="button" key={option.code} className={draft.learningCode === option.code ? "chip active" : "chip"} aria-pressed={draft.learningCode === option.code} onClick={() => update({ learningCode: option.code })}>
                      <span aria-hidden="true">{option.flag}</span> {tx(option.label)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-section">
                <span className="field-label">{t("지금 어느 정도인가요?")}</span>
                <div className="level-picker" role="group" aria-label={t("배우는 단계")}>
                  {LEARNING_LEVELS.map((level, index) => (
                    <button type="button" key={level} className={draft.level === level ? "level-option active" : "level-option"} aria-pressed={draft.level === level} onClick={() => update({ level })}>
                      <span className="level-dots">
                        {[1, 2, 3, 4, 5].map((dot) => <b key={dot} className={dot <= index + 1 ? "on" : ""} />)}
                      </span>
                      <small>{t(LEVEL_LABELS[level])}</small>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section>
              <h2 id="first-run-title">{t("지금 가장 중요한 학습 목표는?")}</h2>
              <p>{t("추천 파트너와 연습 콘텐츠가 이 목표에 맞춰져요.")}</p>
              <div className="goal-picker">
                {GOAL_PRESETS.map((goal) => {
                  const title = t(goal.title);
                  const selected = draft.goal === title;
                  return (
                    <button type="button" key={goal.id} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => update({ goal: title })}>
                      <span><strong>{title}</strong><small>{t(goal.description)}</small></span>
                      {selected ? <CheckCircle2 size={18} aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
              <div className="form-section">
                <span className="field-label">{t("주 활동 시간")}</span>
                <div className="chip-row" role="group" aria-label={t("주 활동 시간")}>
                  {Object.entries(availabilityLabels).map(([value, label]) => (
                    <button type="button" key={value} className={draft.availability.includes(value) ? "chip active" : "chip"} aria-pressed={draft.availability.includes(value)} onClick={() => toggle("availability", value)}>
                      {t(label)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-section">
                <span className="field-label">{t("관심사")}</span>
                <div className="chip-row" role="group" aria-label={t("관심사")}>
                  {Object.entries(interestLabels).map(([value, label]) => (
                    <button type="button" key={value} className={draft.interests.includes(value) ? "chip active" : "chip"} aria-pressed={draft.interests.includes(value)} onClick={() => toggle("interests", value)}>
                      {t(label)}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </fieldset>

        {error ? <p className="field-error first-run-error" role="alert">{error}</p> : null}

        <footer>
          <button className="secondary-button" type="button" disabled={saving} onClick={() => (step === 1 ? onSignOut() : setStep(step - 1))}>
            {step === 1 ? t("로그아웃") : t("이전")}
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!stepValid || saving}
            onClick={() => (step < 3 ? setStep(step + 1) : void finish())}
          >
            {saving ? t("저장 중…") : step < 3 ? t("다음") : t("추천 시작")}
            <ChevronRight size={16} />
          </button>
        </footer>
      </section>
    </main>
  );
}
