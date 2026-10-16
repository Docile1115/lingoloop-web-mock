/**
 * 계정 삭제(앱스토어 심사 필수). 서버 DELETE /api/account 가 로그인 계정과 데이터를 지웁니다.
 * 무엇이 지워지는지 먼저 보여 주고, "확인했어요"를 고른 뒤에만 지울 수 있습니다.
 * 신고 기록은 다른 사람을 지키기 위해 남습니다(서버가 지우지 않음).
 */
import { useState } from "react";
import { View } from "react-native";
import { ApiError, api, failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { ChoiceChip } from "@/ui/Field";
import { Page } from "@/ui/Page";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

export default function DeleteAccount() {
  const { c } = useTheme();
  const { signOut } = useSession();
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const items = [
    t("프로필과 로그인 정보"),
    t("모든 대화 — 상대 화면에서도 사라져요"),
    t("쓴 글·댓글·교정"),
    t("저장한 표현과 노트"),
    t("마이룸과 방명록"),
  ];

  const remove = async () => {
    if (!understood || busy) return;
    setBusy(true);
    setError("");
    try {
      // 지울 기록이 많으면 오래 걸려서 AI 와 같은 긴 대기 시간을 씁니다.
      await api("/api/account", { method: "DELETE", body: { confirm: "DELETE" }, slow: true });
      showToast(t("계정을 지웠어요. 그동안 함께해 주셔서 고마워요."));
      await signOut();
    } catch (caught) {
      // 로그인 계정은 지웠고 남은 기록만 운영팀이 마저 지우는 경우 — 사용자에게는 지운 것과 같습니다.
      if (caught instanceof ApiError && caught.code === "ACCOUNT_DELETE_INCOMPLETE") {
        showToast(t("계정을 지웠어요. 남은 기록은 운영팀이 마저 지울게요."));
        await signOut();
        return;
      }
      setError(failureText(caught, t("계정을 지우지 못했어요. 잠시 후 다시 시도해 주세요.")));
      setBusy(false);
    }
  };

  return (
    <Page>
      <ScreenHeader title={t("계정 삭제")} fallback="/me" />
      <View style={{ width: "100%", maxWidth: 560, gap: space.xl }}>
        <View style={{ backgroundColor: c.dangerSoft, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
          <Text variant="headline" style={{ color: c.danger }}>
            {t("지운 계정은 되돌릴 수 없어요")}
          </Text>
          <Text variant="callout" tone="inkSoft">
            {t("아래 내용이 모두 지워져요.")}
          </Text>
          <View style={{ gap: space.xs }}>
            {items.map((item) => (
              <Text key={item} variant="callout" tone="ink">
                {"·  " + item}
              </Text>
            ))}
          </View>
          <Text variant="meta" tone="muted">
            {t("다른 사람을 지키기 위해 접수된 신고 기록은 남을 수 있어요.")}
          </Text>
        </View>

        <View style={{ flexDirection: "row" }}>
          <ChoiceChip label={t("위 내용을 확인했어요")} selected={understood} multiple disabled={busy} onPress={() => setUnderstood((value) => !value)} />
        </View>

        {error ? (
          <Text variant="callout" tone="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <View style={{ flexDirection: "row" }}>
          <Button label={t("계정 영구 삭제")} icon="trash" variant="danger" disabled={!understood} busy={busy} onPress={() => void remove()} />
        </View>
      </View>
    </Page>
  );
}
