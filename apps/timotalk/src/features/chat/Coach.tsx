/**
 * AI 코치: 이어서 물어볼 말을 제안하고, 쓰던 문장이 있으면 자연스럽게 다듬습니다.
 * 하루 AI 사용량을 쓰므로 버튼을 눌렀을 때만 묻습니다.
 */
import { useEffect, useState } from "react";
import { View } from "react-native";
import { currentLocaleSnapshot } from "@shared/i18n/core";
import { api, failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { ConversationSupport, SupportLine } from "@/lib/types";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Button, IconButton } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";

export function Coach({
  partnerId,
  draft,
  onInsert,
  onClose,
}: {
  partnerId: string;
  /** 연 순간의 입력칸 글. 있으면 다듬은 문장도 받습니다. */
  draft: string;
  onInsert: (text: string) => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const [state, setState] = useState<{ status: "loading" } | { status: "error"; error: string } | { status: "ready"; followUps: SupportLine[]; improved: string }>({
    status: "loading",
  });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    api<ConversationSupport>("/api/conversation-support", {
      body: { partnerId, stage: "ongoing", draft: draft.trim() || undefined, locale: currentLocaleSnapshot() },
      slow: true,
    })
      .then((support) => {
        if (!alive) return;
        const followUps = support.followUps?.length ? support.followUps : support.followUpQuestions.map((text) => ({ text, translation: "" }));
        setState({ status: "ready", followUps: followUps.filter((line) => line.text.trim()), improved: draft.trim() ? support.improvedDraft.trim() : "" });
      })
      .catch((caught) => {
        if (alive) setState({ status: "error", error: failureText(caught, t("AI가 지금 답하지 못했어요. 잠시 후 다시 시도해 주세요.")) });
      });
    return () => {
      alive = false;
    };
    // 연 순간의 글로 한 번만 묻습니다. 계속 고쳐 쓰는 동안 다시 부르면 사용량이 금방 닳습니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId]);

  const line = state.status === "ready" ? state.followUps[index % Math.max(1, state.followUps.length)] : undefined;

  return (
    <View style={{ marginHorizontal: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, gap: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs + 2 }}>
        <Icon name="spark" size={16} color={c.primaryStrong} />
        <Text variant="label" tone="primaryStrong" style={{ flex: 1 }}>
          {t("AI 코치")}
        </Text>
        <IconButton icon="close" label={t("AI 코치 닫기")} plain onPress={onClose} />
      </View>

      {state.status === "loading" ? (
        <Text variant="callout" tone="muted" aria-live="polite">
          {t("이어갈 말을 고르고 있어요")}
        </Text>
      ) : state.status === "error" ? (
        <Text variant="callout" tone="muted" accessibilityRole="alert">
          {state.error}
        </Text>
      ) : (
        <>
          {state.improved && state.improved !== draft.trim() ? (
            <View style={{ gap: space.xs }}>
              <Text variant="caption" tone="muted">
                {t("다듬은 문장")}
              </Text>
              <Text variant="body" style={{ fontWeight: "500" }} selectable>
                {state.improved}
              </Text>
              <View style={{ flexDirection: "row" }}>
                <Button label={t("이 문장으로 바꾸기")} variant="secondary" onPress={() => onInsert(state.improved)} />
              </View>
            </View>
          ) : null}
          {line ? (
            <View style={{ gap: space.xs }}>
              <Text variant="caption" tone="muted">
                {t("이어서 물어보기")}
              </Text>
              <Text variant="body" style={{ fontWeight: "500" }} selectable>
                {line.text}
              </Text>
              {line.translation ? (
                <Text variant="meta" tone="muted" selectable>
                  {line.translation}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", gap: space.sm }}>
                {state.followUps.length > 1 ? <Button label={t("다른 질문")} variant="secondary" onPress={() => setIndex((n) => n + 1)} /> : null}
                <Button label={t("넣기")} variant="secondary" onPress={() => onInsert(line.text)} />
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}
