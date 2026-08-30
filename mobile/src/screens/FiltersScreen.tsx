/**
 * 오늘의 파트너 조건.
 *
 * 웹과 같은 값을 같은 이름으로 보냅니다 — 한쪽에서 바꾸면 다른 쪽에도 반영됩니다.
 * 나이와 학습 단계는 범위입니다. 폰에서는 슬라이더 두 개를 겹쳐 끄는 것보다
 * 양 끝을 눌러 옮기는 편이 정확해서, 단계는 칩으로 두고 나이는 큼직한
 * 더하기·빼기로 둡니다.
 */
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ApiError, get, post } from "../lib/api";
import { t } from "../lib/i18n";
import { useTheme } from "../lib/useTheme";
import { radius, space, type } from "../lib/theme";
import { Chip, Loading, PrimaryButton } from "../ui";

const LEVELS = ["beginner", "elementary", "intermediate", "upper", "advanced"] as const;
const LEVEL_LABELS: Record<string, string> = {
  beginner: "이제 시작했어요",
  elementary: "짧은 문장은 말해요",
  intermediate: "일상 대화는 해요",
  upper: "어려운 얘기도 해요",
  advanced: "거의 불편함이 없어요",
};
const AVAILABILITY: Array<[string, string]> = [
  ["weekday-morning", "평일 아침"],
  ["weekday-evening", "평일 저녁"],
  ["weekend-morning", "주말 오전"],
  ["weekend-evening", "주말 저녁"],
];
const INTENTS: Array<[string, string]> = [
  ["language-exchange", "언어 교환"],
  ["friendship", "친구 만들기"],
  ["voice-practice", "음성 연습"],
  ["culture-exchange", "문화 교류"],
];
const INTERESTS: Array<[string, string]> = [
  ["movies", "영화"], ["travel", "여행"], ["coffee", "카페"], ["music", "음악"],
  ["technology", "기술"], ["cooking", "요리"], ["books", "독서"], ["running", "운동"],
];
const LANGUAGES: Array<[string, string]> = [
  ["ko", "한국어"], ["en", "영어"], ["ja", "일본어"],
  ["es", "스페인어"], ["fr", "프랑스어"], ["de", "독일어"],
];

type Preferences = {
  targetLanguages: string[];
  availability: string[];
  intents: string[];
  interests: string[];
  levelMin: string;
  levelMax: string;
  ageMin: number;
  ageMax: number;
  onlineOnly: boolean;
  verifiedOnly: boolean;
  preferredCountries: string[];
};

export function FiltersScreen({ onDone }: { onDone: () => void }) {
  const c = useTheme();
  const [draft, setDraft] = useState<Preferences | null>(null);
  const [myNative, setMyNative] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([
      get<{ preferences: Preferences }>("/api/matching/preferences"),
      get<{ user: { nativeLanguages?: string[] } }>("/api/auth/me"),
    ])
      .then(([prefs, me]) => {
        if (!alive) return;
        setDraft(prefs.preferences);
        setMyNative(me.user.nativeLanguages ?? []);
      })
      .catch((caught) => {
        if (alive) setError(caught instanceof ApiError ? caught.message : t("불러오지 못했어요."));
      });
    return () => { alive = false; };
  }, []);

  const save = useCallback(async () => {
    if (!draft || busy) return;
    setBusy(true);
    setError("");
    try {
      await post("/api/matching/preferences", draft);
      onDone();
    } catch (caught) {
      // 서버가 거절하면 화면을 닫지 않습니다 — 저장된 척하면 조건이 조용히 되돌아갑니다.
      setError(caught instanceof ApiError ? caught.message : t("요청을 처리하지 못했어요."));
    } finally {
      setBusy(false);
    }
  }, [draft, busy, onDone]);

  if (!draft) return error ? <ErrorNote text={error} /> : <Loading />;

  const toggle = (key: "availability" | "intents" | "interests", value: string) =>
    setDraft((d) => d && ({
      ...d,
      [key]: d[key].includes(value) ? d[key].filter((one) => one !== value) : [...d[key], value],
    }));

  // 이미 할 줄 아는 말을 배울 상대로 고를 이유가 없습니다.
  const targets = LANGUAGES.filter(([code]) => !myNative.includes(code));

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.page}>
      <Section label={t("꼭 맞아야 해요")}>
        <Field label={t("배우고 싶은 언어")}>
          <View style={styles.chips}>
            {targets.map(([code, label]) => (
              <Chip
                key={code}
                label={t(label as never)}
                active={draft.targetLanguages.includes(code)}
                onPress={() => setDraft({ ...draft, targetLanguages: [code] })}
              />
            ))}
          </View>
        </Field>

        <Field label={t("주로 대화 가능한 시간")}>
          <View style={styles.chips}>
            {AVAILABILITY.map(([code, label]) => (
              <Chip key={code} label={t(label as never)}
                active={draft.availability.includes(code)}
                onPress={() => toggle("availability", code)} />
            ))}
          </View>
        </Field>

        <Field label={t("만남 목적")}>
          <View style={styles.chips}>
            {INTENTS.map(([code, label]) => (
              <Chip key={code} label={t(label as never)}
                active={draft.intents.includes(code)}
                onPress={() => toggle("intents", code)} />
            ))}
          </View>
        </Field>
      </Section>

      <Section label={t("가까우면 좋아요")}>
        <Field label={t("선호 나이")} value={t("{min}–{max}세", { min: draft.ageMin, max: draft.ageMax })}>
          <View style={styles.steppers}>
            <Stepper
              label={t("최소")}
              value={draft.ageMin}
              onChange={(next) => setDraft({ ...draft, ageMin: Math.min(Math.max(18, next), draft.ageMax) })}
            />
            <Stepper
              label={t("최대")}
              value={draft.ageMax}
              onChange={(next) => setDraft({ ...draft, ageMax: Math.max(Math.min(80, next), draft.ageMin) })}
            />
          </View>
        </Field>

        <Field label={t("파트너의 학습 단계")}>
          <View style={styles.chips}>
            {LEVELS.map((level) => {
              const from = LEVELS.indexOf(draft.levelMin as never);
              const to = LEVELS.indexOf(draft.levelMax as never);
              const index = LEVELS.indexOf(level);
              const inRange = index >= from && index <= to;
              return (
                <Chip
                  key={level}
                  label={t(LEVEL_LABELS[level] as never)}
                  active={inRange}
                  // 누른 단계를 범위의 한쪽 끝으로 만듭니다 — 가까운 끝을 옮깁니다.
                  onPress={() => {
                    const nearFrom = Math.abs(index - from) <= Math.abs(index - to);
                    setDraft({
                      ...draft,
                      levelMin: nearFrom ? level : draft.levelMin,
                      levelMax: nearFrom ? draft.levelMax : level,
                    });
                  }}
                />
              );
            })}
          </View>
        </Field>

        <Field label={t("공통 관심사")}>
          <View style={styles.chips}>
            {INTERESTS.map(([code, label]) => (
              <Chip key={code} label={t(label as never)}
                active={draft.interests.includes(code)}
                onPress={() => toggle("interests", code)} />
            ))}
          </View>
        </Field>

        <Toggle
          label={t("현재 온라인인 사람만")}
          body={t("바로 답장할 가능성이 높아요")}
          value={draft.onlineOnly}
          onChange={(v) => setDraft({ ...draft, onlineOnly: v })}
        />
        <Toggle
          label={t("인증된 프로필 우선")}
          body={t("전화번호 또는 신원 확인이 끝난 계정을 먼저 추천해요")}
          value={draft.verifiedOnly}
          onChange={(v) => setDraft({ ...draft, verifiedOnly: v })}
        />
      </Section>

      {error ? <ErrorNote text={error} inline /> : null}

      <View style={{ marginTop: space.lg }}>
        <PrimaryButton
          label={t("저장")}
          onPress={() => void save()}
          busy={busy}
          disabled={!draft.targetLanguages.length || !draft.availability.length || !draft.intents.length}
        />
      </View>
    </ScrollView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const c = useTheme();
  return (
    <View style={{ gap: space.lg }}>
      <Text style={[styles.sectionLabel, { color: c.subtle, borderBottomColor: c.line }]}>{label}</Text>
      {children}
    </View>
  );
}

function Field({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  const c = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.fieldHead}>
        <Text style={[styles.fieldLabel, { color: c.ink }]}>{label}</Text>
        {value ? <Text style={{ color: c.secondaryInk, fontSize: 13, fontWeight: "700" }}>{value}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const c = useTheme();
  return (
    <View style={[styles.stepper, { backgroundColor: c.sunken }]}>
      <Text style={[type.caption, { color: c.subtle }]}>{label}</Text>
      <Pressable onPress={() => onChange(value - 1)} hitSlop={8} accessibilityRole="button"
        accessibilityLabel={`${label} -1`} style={styles.stepButton}>
        <Ionicons name="remove" size={20} color={c.ink} />
      </Pressable>
      <Text style={[styles.stepValue, { color: c.ink }]}>{value}</Text>
      <Pressable onPress={() => onChange(value + 1)} hitSlop={8} accessibilityRole="button"
        accessibilityLabel={`${label} +1`} style={styles.stepButton}>
        <Ionicons name="add" size={20} color={c.ink} />
      </Pressable>
    </View>
  );
}

function Toggle({ label, body, value, onChange }: { label: string; body: string; value: boolean; onChange: (v: boolean) => void }) {
  const c = useTheme();
  return (
    <View style={[styles.toggle, { backgroundColor: c.surfaceSoft }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.fieldLabel, { color: c.ink }]}>{label}</Text>
        <Text style={[type.caption, { color: c.subtle }]}>{body}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.primary, false: c.lineStrong }} />
    </View>
  );
}

function ErrorNote({ text, inline }: { text: string; inline?: boolean }) {
  const c = useTheme();
  return (
    <Text style={[type.meta, { color: c.danger, padding: inline ? 0 : space.xl, marginTop: space.md }]}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.xl, paddingBottom: space.xl * 2 },
  sectionLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", paddingBottom: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  fieldHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  fieldLabel: { fontSize: 15, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  steppers: { flexDirection: "row", gap: space.sm },
  stepper: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.button },
  stepButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  stepValue: { flex: 1, fontSize: 17, fontWeight: "800", textAlign: "center" },
  toggle: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.button },
});
