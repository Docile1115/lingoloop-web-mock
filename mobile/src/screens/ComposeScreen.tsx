/** 글쓰기. 사진·음성은 아직 없습니다 — 넣는 자리를 만들어두고 안 되는 버튼은 두지 않습니다. */
import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError, post as apiPost } from "../lib/api";
import { t } from "../lib/i18n";
import { useTheme } from "../lib/useTheme";
import { radius, space } from "../lib/theme";
import { Chip, PrimaryButton } from "../ui";

const TAG_SUGGESTIONS = ["#오늘의연습", "#질문", "#교정부탁", "#일상"];

export function ComposeScreen({ onDone }: { onDone: () => void }) {
  const c = useTheme();
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [requestCorrection, setRequestCorrection] = useState(false);
  const [partnersOnly, setPartnersOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const publish = useCallback(async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError("");
    try {
      await apiPost("/api/posts", {
        text: body,
        tags,
        requestCorrection,
        visibility: partnersOnly ? "partners" : "public",
      });
      onDone();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("요청을 처리하지 못했어요."));
    } finally {
      setBusy(false);
    }
  }, [text, tags, requestCorrection, partnersOnly, busy, onDone]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <TextInput
          style={[styles.input, { backgroundColor: c.surfaceSoft, color: c.ink, borderColor: c.line }]}
          value={text}
          onChangeText={setText}
          placeholder={t("배우는 말로 짧게 써보세요. 틀려도 괜찮아요.")}
          placeholderTextColor={c.subtle}
          multiline
          maxLength={3000}
          autoFocus
        />
        <Text style={[styles.count, { color: c.subtle }]}>{text.length} / 3000</Text>

        <Text style={[styles.label, { color: c.ink }]}>{t("주제")}</Text>
        <View style={styles.chips}>
          {TAG_SUGGESTIONS.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              active={tags.includes(tag)}
              onPress={() =>
                setTags((rows) =>
                  rows.includes(tag) ? rows.filter((one) => one !== tag) : [...rows, tag],
                )
              }
            />
          ))}
        </View>

        <View style={[styles.row, { borderColor: c.line }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: c.ink }]}>{t("교정을 부탁해요")}</Text>
            <Text style={[styles.rowBody, { color: c.subtle }]}>
              {t("원어민이 고쳐줄 수 있게 표시해요.")}
            </Text>
          </View>
          <Switch
            value={requestCorrection}
            onValueChange={setRequestCorrection}
            trackColor={{ true: c.primary, false: c.sunken }}
          />
        </View>

        <View style={[styles.row, { borderColor: c.line }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: c.ink }]}>{t("파트너에게만 보이기")}</Text>
            <Text style={[styles.rowBody, { color: c.subtle }]}>
              {t("서로 연결된 사람만 볼 수 있어요.")}
            </Text>
          </View>
          <Switch
            value={partnersOnly}
            onValueChange={setPartnersOnly}
            trackColor={{ true: c.primary, false: c.sunken }}
          />
        </View>

        {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}

        <View style={{ marginTop: space.lg }}>
          <PrimaryButton
            label={t("올리기")}
            onPress={() => void publish()}
            disabled={!text.trim()}
            busy={busy}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.sm },
  input: {
    minHeight: 140,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    fontSize: 16,
    lineHeight: 23,
    textAlignVertical: "top",
  },
  count: { fontSize: 12, textAlign: "right" },
  label: { fontSize: 13, fontWeight: "600", marginTop: space.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowTitle: { fontSize: 15, fontWeight: "600" },
  rowBody: { fontSize: 12, marginTop: 2 },
  error: { fontSize: 13, marginTop: space.md },
});
