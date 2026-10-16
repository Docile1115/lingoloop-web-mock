/**
 * 오늘의 파트너 조건(GET·POST /api/matching/preferences). 웹·옛 앱과 같은 값을 같은 이름으로 보냅니다.
 *
 * 서버가 쓰는 방식 그대로 알립니다(backend/server.mjs matchCandidate):
 *  - 알려 줄 말(targetLanguages)만 꼭 맞춥니다 — 그 말의 원어민만 추천합니다.
 *  - 나머지(단계·나이·나라·시간·관심사·접속 중)는 모두 맞는 사람을 먼저 보여 주는 데 씁니다.
 * 저장은 빠진 칸을 기본값으로 덮으므로, 이 화면이 다루지 않는 값(verifiedOnly·intents)도 읽은 그대로 돌려보냅니다.
 */
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { LEARNING_LEVELS, LEVEL_LABELS, PROFILE_LANGUAGES, availabilityLabels, countryLabels, interestLabels } from "@shared/profile-options";
import { notifyMatchingChanged } from "@/features/today/data";
import { api, failureText } from "@/lib/api";
import { t, tx } from "@/lib/i18n";
import { useMe } from "@/lib/session";
import { space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { ChoiceChip, ChoiceGroup, TextField } from "@/ui/Field";
import { ListGroup, SwitchRow } from "@/ui/List";
import { Page } from "@/ui/Page";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { ErrorState, LoadingState } from "@/ui/States";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

type Preferences = {
  targetLanguages: string[];
  preferredCountries: string[];
  interests: string[];
  availability: string[];
  levelMin: string;
  levelMax: string;
  ageMin: number;
  ageMax: number;
  onlineOnly: boolean;
  [other: string]: unknown;
};

const MAX_TARGETS = 3;
const MAX_COUNTRIES = 8;

export default function Filters() {
  const router = useRouter();
  const me = useMe();
  const [draft, setDraft] = useState<Preferences | null>(null);
  const [ages, setAges] = useState({ min: "", max: "" });
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ preferences: Preferences }>("/api/matching/preferences")
      .then((data) => {
        if (!alive) return;
        setDraft(data.preferences);
        setAges({ min: String(data.preferences.ageMin), max: String(data.preferences.ageMax) });
      })
      .catch((caught) => {
        if (alive) setLoadError(failureText(caught, t("불러오지 못했어요.")));
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const set = (patch: Partial<Preferences>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setError("");
  };
  const toggle = (key: "targetLanguages" | "preferredCountries" | "interests" | "availability", value: string, limit = 12) => {
    if (!draft) return;
    const list = draft[key];
    if (list.includes(value)) set({ [key]: list.filter((item) => item !== value) });
    else if (list.length < limit) set({ [key]: [...list, value] });
  };
  // 단계 범위: 시작을 끝보다 뒤로 고르면 끝을 따라 옮깁니다(반대도 같음).
  const setLevel = (edge: "levelMin" | "levelMax", level: string) => {
    if (!draft) return;
    const index = LEARNING_LEVELS.indexOf(level as (typeof LEARNING_LEVELS)[number]);
    const min = LEARNING_LEVELS.indexOf(draft.levelMin as (typeof LEARNING_LEVELS)[number]);
    const max = LEARNING_LEVELS.indexOf(draft.levelMax as (typeof LEARNING_LEVELS)[number]);
    if (edge === "levelMin") set({ levelMin: level, ...(index > max ? { levelMax: level } : {}) });
    else set({ levelMax: level, ...(index < min ? { levelMin: level } : {}) });
  };

  const save = async () => {
    if (!draft || busy) return;
    const ageMin = Number(ages.min);
    const ageMax = Number(ages.max);
    if (!draft.targetLanguages.length) {
      setError(t("알려 줄 말을 하나 이상 골라 주세요."));
      return;
    }
    if (!Number.isInteger(ageMin) || !Number.isInteger(ageMax) || ageMin < 18 || ageMax > 100 || ageMin > ageMax) {
      setError(t("나이는 18세에서 100세 사이로, 앞이 뒤보다 크지 않게 적어 주세요."));
      return;
    }
    setBusy(true);
    try {
      await api("/api/matching/preferences", { body: { ...draft, ageMin, ageMax } });
      notifyMatchingChanged();
      showToast(t("조건을 저장했어요. 오늘의 추천을 다시 골랐어요."));
      if (router.canGoBack()) router.back();
      else router.replace("/discover");
    } catch (caught) {
      setError(failureText(caught, t("저장하지 못했어요. 다시 시도해 주세요.")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <ScreenHeader title={t("조건")} detail={t("알려 줄 말은 꼭 맞추고, 나머지는 맞는 사람을 먼저 보여 줘요.")} fallback="/discover" />
      <View style={{ width: "100%", maxWidth: 560, gap: space.xxl }}>
        {loadError ? (
          <ErrorState
            message={loadError}
            onRetry={() => {
              setLoadError("");
              setAttempt((n) => n + 1);
            }}
          />
        ) : !draft ? (
          <LoadingState />
        ) : (
          <>
            <ChoiceGroup label={t("알려 줄 사람의 말")} hint={t("이 말의 원어민을 찾아요. 세 개까지 고를 수 있어요.")} multiple>
              {PROFILE_LANGUAGES.filter(({ code }) => !me.nativeLanguages.includes(code)).map(({ code, label }) => (
                <ChoiceChip
                  key={code}
                  label={tx(label)}
                  selected={draft.targetLanguages.includes(code)}
                  multiple
                  disabled={busy || (!draft.targetLanguages.includes(code) && draft.targetLanguages.length >= MAX_TARGETS)}
                  onPress={() => toggle("targetLanguages", code, MAX_TARGETS)}
                />
              ))}
            </ChoiceGroup>

            <View style={{ gap: space.lg }}>
              <ChoiceGroup label={t("상대의 학습 단계 · 이 단계부터")}>
                {LEARNING_LEVELS.map((level) => (
                  <ChoiceChip key={level} label={tx(LEVEL_LABELS[level])} selected={draft.levelMin === level} disabled={busy} onPress={() => setLevel("levelMin", level)} />
                ))}
              </ChoiceGroup>
              <ChoiceGroup label={t("이 단계까지")}>
                {LEARNING_LEVELS.map((level) => (
                  <ChoiceChip key={level} label={tx(LEVEL_LABELS[level])} selected={draft.levelMax === level} disabled={busy} onPress={() => setLevel("levelMax", level)} />
                ))}
              </ChoiceGroup>
            </View>

            <View style={{ gap: space.sm }}>
              <Text variant="label" tone="inkSoft">
                {t("나이")}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <TextField label={t("부터")} value={ages.min} onChangeText={(min) => setAges((current) => ({ ...current, min: min.replace(/[^0-9]/g, "") }))} keyboardType="number-pad" maxLength={3} width={96} disabled={busy} />
                <TextField label={t("까지")} value={ages.max} onChangeText={(max) => setAges((current) => ({ ...current, max: max.replace(/[^0-9]/g, "") }))} keyboardType="number-pad" maxLength={3} width={96} disabled={busy} />
              </View>
            </View>

            <ChoiceGroup label={t("사는 곳")} hint={t("고르지 않으면 어디든 좋아요.")} multiple>
              {Object.entries(countryLabels).map(([code, label]) => (
                <ChoiceChip
                  key={code}
                  label={tx(label)}
                  selected={draft.preferredCountries.includes(code)}
                  multiple
                  disabled={busy || (!draft.preferredCountries.includes(code) && draft.preferredCountries.length >= MAX_COUNTRIES)}
                  onPress={() => toggle("preferredCountries", code, MAX_COUNTRIES)}
                />
              ))}
            </ChoiceGroup>

            <ChoiceGroup label={t("주로 대화 가능한 시간")} hint={t("고르지 않으면 언제든 좋아요.")} multiple>
              {Object.entries(availabilityLabels).map(([code, label]) => (
                <ChoiceChip key={code} label={tx(label)} selected={draft.availability.includes(code)} multiple disabled={busy} onPress={() => toggle("availability", code)} />
              ))}
            </ChoiceGroup>

            <ChoiceGroup label={t("관심사")} hint={t("고르지 않으면 관심사는 보지 않아요.")} multiple>
              {Object.entries(interestLabels).map(([code, label]) => (
                <ChoiceChip key={code} label={tx(label)} selected={draft.interests.includes(code)} multiple disabled={busy} onPress={() => toggle("interests", code)} />
              ))}
            </ChoiceGroup>

            <ListGroup>
              <SwitchRow
                title={t("지금 접속 중인 사람 먼저")}
                detail={t("켜면 지금 앱을 쓰고 있는 사람을 먼저 보여 줘요.")}
                value={draft.onlineOnly}
                disabled={busy}
                onValueChange={(onlineOnly) => set({ onlineOnly })}
              />
            </ListGroup>

            <View style={{ gap: space.md }}>
              {error ? (
                <Text variant="callout" tone="danger" accessibilityRole="alert">
                  {error}
                </Text>
              ) : null}
              <Button label={t("조건 저장")} icon="check" busy={busy} onPress={() => void save()} />
            </View>
          </>
        )}
      </View>
    </Page>
  );
}
