/**
 * 프로필 입력값 — 첫 설정과 프로필 편집이 같이 씁니다.
 *
 * 고를 수 있는 값은 서버(backend/server.mjs PATCH /api/profile)가 받는 목록과 같아야 합니다.
 * 목록은 웹·옛 앱과 같은 공용 모듈(@shared/profile-options)에서 가져옵니다.
 * 규칙은 옛 앱(mobile/src/lib/profile.ts)과 같습니다 — 서버가 거절할 값을 저장 전에 미리 알려 줍니다.
 */
import { t } from "@/lib/i18n";
import type { Profile } from "@/lib/types";

/** 입력 중인 프로필. 아직 고르지 않은 값은 빈 문자열입니다. */
export type ProfileDraft = {
  name: string;
  bio: string;
  /** 입력칸 그대로(숫자만). 저장할 때 숫자로 바꿉니다. */
  age: string;
  gender: string;
  country: string;
  native: string;
  learning: string;
  level: string;
  goal: string;
  interests: string[];
  availability: string[];
};

export type ProfileField = keyof ProfileDraft;
export type ProfileErrors = Partial<Record<ProfileField, string>>;

export function draftFromProfile(me: Profile): ProfileDraft {
  const learning = me.learningLanguages[0];
  return {
    name: me.name ?? "",
    bio: me.bio ?? "",
    age: me.age ? String(me.age) : "",
    gender: me.gender ?? "",
    country: me.country?.code ?? "",
    native: me.nativeLanguages[0] ?? "",
    learning: learning?.code ?? "",
    level: learning?.level ?? "",
    goal: learning?.goal ?? "",
    interests: me.interests ?? [],
    availability: me.availability ?? [],
  };
}

/**
 * 저장 전에 서버가 거절할 값을 미리 알려 줍니다.
 * 첫 설정에서는 목표까지 꼭 고르게 하고, 편집에서는 목표를 비우면 서버 기본값을 씁니다.
 * fields 로 검사할 칸을 좁힐 수 있습니다(첫 설정의 단계마다).
 */
export function profileErrors(draft: ProfileDraft, firstRun: boolean, fields?: readonly ProfileField[]): ProfileErrors {
  const errors: ProfileErrors = {};
  if (draft.name.trim().length < 2) errors.name = t("이름은 2자 이상 적어 주세요.");
  const age = Number(draft.age);
  if (!/^\d+$/.test(draft.age.trim()) || age < 18 || age > 100) errors.age = t("나이는 18세에서 100세 사이로 적어 주세요.");
  if (!draft.gender) errors.gender = t("성별을 골라 주세요.");
  if (!draft.country) errors.country = t("사는 나라를 골라 주세요.");
  if (!draft.native) errors.native = t("가르칠 수 있는 말을 골라 주세요.");
  if (!draft.learning || draft.learning === draft.native) errors.learning = t("배우는 말을 골라 주세요.");
  if (!draft.level) errors.level = t("지금 어느 정도인지 골라 주세요.");
  const goal = draft.goal.trim().length;
  if ((firstRun && goal < 2) || goal === 1) errors.goal = t("학습 목표는 2자 이상 적어 주세요.");
  if (!fields) return errors;
  return Object.fromEntries(Object.entries(errors).filter(([field]) => fields.includes(field as ProfileField))) as ProfileErrors;
}

/** 서버가 알려 준 잘못된 칸(error.details.field)을 화면의 칸으로 옮깁니다. */
export function fieldFromServer(field?: string): ProfileField | null {
  switch (field) {
    case "name":
    case "bio":
    case "age":
    case "gender":
    case "interests":
    case "availability":
      return field;
    case "countryCode":
      return "country";
    case "nativeLanguages":
      return "native";
    case "learningLanguages":
    case "learningLanguages.code":
      return "learning";
    case "learningLanguages.goal":
      return "goal";
    default:
      return null;
  }
}

/**
 * 서버에 보낼 값(PATCH /api/profile).
 * 두 번째 이후 언어는 이 화면에서 고치지 않으므로 그대로 보냅니다(웹·옛 앱과 같음).
 */
export function profilePatch(draft: ProfileDraft, me: Profile) {
  const chosen = new Set([draft.native, draft.learning]);
  return {
    name: draft.name.trim(),
    bio: draft.bio.trim(),
    age: Number(draft.age),
    gender: draft.gender,
    countryCode: draft.country,
    nativeLanguages: [draft.native, ...me.nativeLanguages.slice(1).filter((code) => !chosen.has(code))],
    learningLanguages: [
      { code: draft.learning, level: draft.level, goal: draft.goal.trim() },
      ...me.learningLanguages.slice(1).filter((item) => !chosen.has(item.code)),
    ],
    interests: draft.interests,
    availability: draft.availability,
  };
}
