/**
 * 첫 설정. 새 계정은 서버 기본값(한국어 원어민·영어 학습·18세·대한민국)으로 만들어지고,
 * 설정을 마치기 전(onboardedAt === null)에는 다른 사람의 추천·검색에 나오지 않습니다.
 * 기본값을 그대로 두면 엉뚱한 사람과 이어지므로 탭에 들어가기 전에 꼭 고르게 합니다.
 *
 * 세 단계: 나 → 주고받을 말 → 관심사(골라도 안 골라도 됨). 단계마다 그 단계의 칸만 검사합니다.
 * 기기 설정의 나라·언어는 미리 골라 둡니다(바꿀 수 있습니다). 나이·성별·배우는 말·단계·목표는 비워 둡니다.
 */
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getLocales } from "expo-localization";
import { PROFILE_LANGUAGES, countryLabels } from "@shared/profile-options";
import { draftFromProfile, fieldFromServer, profileErrors, type ProfileDraft, type ProfileErrors, type ProfileField } from "@/features/profile/draft";
import { ProfileForm } from "@/features/profile/ProfileForm";
import { saveProfile } from "@/features/profile/save";
import { ApiError, failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useMe, useSession } from "@/lib/session";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Brand } from "@/ui/Brand";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

type Step = { title: string; detail: string; fields: readonly ProfileField[] };

function steps(): Step[] {
  return [
    {
      title: t("나를 알려 주세요"),
      detail: t("설정을 마치면 다른 사람에게 내 프로필이 보여요. 나중에 언제든 바꿀 수 있어요."),
      fields: ["name", "age", "gender", "country"],
    },
    {
      title: t("어떤 말을 주고받을까요"),
      detail: t("내가 가르칠 수 있는 말과 배우고 싶은 말이 서로 맞는 사람을 매일 찾아 드려요."),
      fields: ["native", "learning", "level", "goal"],
    },
    {
      title: t("무엇을 좋아하나요"),
      detail: t("이야깃거리가 맞는 사람을 찾는 데 써요. 고르지 않아도 돼요."),
      fields: ["interests", "availability"],
    },
  ];
}

function firstDraft(base: ProfileDraft): ProfileDraft {
  const device = getLocales()[0];
  const region = device?.regionCode?.toUpperCase() ?? "";
  const language = device?.languageCode?.slice(0, 2) ?? "";
  return {
    ...base,
    age: "",
    gender: "",
    country: region in countryLabels ? region : "",
    native: PROFILE_LANGUAGES.some((item) => item.code === language) ? language : "",
    learning: "",
    level: "",
    goal: "",
    interests: [],
    availability: [],
  };
}

export default function Setup() {
  const { c } = useTheme();
  const me = useMe();
  const { setMe, signOut } = useSession();
  const [draft, setDraft] = useState<ProfileDraft>(() => firstDraft(draftFromProfile(me)));
  const [index, setIndex] = useState(0);
  const [tried, setTried] = useState<Set<number>>(new Set());
  const [serverErrors, setServerErrors] = useState<ProfileErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const all = steps();
  const step = all[index]!;
  const last = index === all.length - 1;
  // 그 단계에서 "다음"을 한 번 누른 뒤부터 칸마다 이유를 보여 줍니다. 처음부터 빨간 글씨로 채우지 않습니다.
  const errors = { ...(tried.has(index) ? profileErrors(draft, true, step.fields) : {}), ...serverErrors };

  /** 단계를 바꾸면 맨 위부터 보여 줍니다. */
  const goTo = (position: number) => {
    setIndex(position);
    scroller.current?.scrollTo({ y: 0, animated: false });
  };

  const change = (next: ProfileDraft) => {
    setDraft(next);
    setServerErrors({});
    setError("");
  };

  const next = async () => {
    if (busy) return;
    setTried((current) => new Set(current).add(index));
    if (Object.keys(profileErrors(draft, true, step.fields)).length) {
      setError(t("빠진 칸을 채워 주세요."));
      return;
    }
    setError("");
    if (!last) {
      goTo(index + 1);
      return;
    }
    setBusy(true);
    try {
      const saved = await saveProfile(draft, me, true);
      showToast(t("준비됐어요! 오늘의 파트너를 만나 보세요."));
      setMe(saved);
    } catch (caught) {
      const field = caught instanceof ApiError ? fieldFromServer(caught.field) : null;
      const message = failureText(caught, t("프로필을 저장하지 못했어요."));
      if (field) {
        setServerErrors({ [field]: message });
        // 잘못된 칸이 있는 단계로 돌아갑니다.
        const owner = all.findIndex((candidate) => candidate.fields.includes(field));
        if (owner >= 0) goTo(owner);
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={scroller} contentContainerStyle={{ flexGrow: 1, padding: space.xl, alignItems: "center" }} keyboardShouldPersistTaps="handled">
          <View style={{ width: "100%", maxWidth: 560, gap: space.xxl }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Brand />
              <Button label={t("로그아웃")} variant="ghost" disabled={busy} onPress={() => void signOut()} />
            </View>

            <View style={{ gap: space.md }}>
              <View
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={all.length}
                aria-valuenow={index + 1}
                aria-label={t("{total}단계 중 {current}단계", { current: index + 1, total: all.length })}
                style={{ flexDirection: "row", gap: space.xs }}
              >
                {all.map((_, position) => (
                  <View
                    key={position}
                    style={{ flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: position <= index ? c.primary : c.sunken }}
                  />
                ))}
              </View>
              <Text variant="meta" tone="muted">
                {t("{total}단계 중 {current}단계", { current: index + 1, total: all.length })}
              </Text>
              <Text variant="display" accessibilityRole="header">
                {step.title}
              </Text>
              <Text variant="body" tone="muted">
                {step.detail}
              </Text>
            </View>

            <ProfileForm draft={draft} onChange={change} errors={errors} fields={step.fields} disabled={busy} />

            {error ? (
              <Text variant="callout" tone="danger" accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            <View style={{ flexDirection: "row", gap: space.sm }}>
              {index > 0 ? <Button label={t("이전")} variant="secondary" icon="back" disabled={busy} onPress={() => goTo(index - 1)} /> : null}
              <Button label={last ? t("시작하기") : t("다음")} busy={busy} grow onPress={() => void next()} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
