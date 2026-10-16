/**
 * 오늘 화면의 복습 알림: 다시 볼 문장이 있을 때만 작게 보여 줍니다(없으면 아무것도 그리지 않음).
 */
import { View } from "react-native";
import { useRouter } from "expo-router";
import { t } from "@/lib/i18n";
import { useMe } from "@/lib/session";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";
import { useNotesData } from "./data";
import { dueItems, useReviewState } from "./review";

export function ReviewNudge() {
  const { c } = useTheme();
  const router = useRouter();
  const me = useMe();
  const { state } = useNotesData();
  const review = useReviewState(me.id);
  if (state.status !== "ready" || !review.state) return null;
  const due = dueItems(state.data.corrections, state.data.phrases, review.state).length;
  if (!due) return null;
  return (
    <View style={{ backgroundColor: c.inverse, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
      <View style={{ gap: space.xxs }}>
        <Text variant="headline" tone="onInverse">
          {t("다시 볼 문장 {n}개", { n: due })}
        </Text>
        <Text variant="callout" tone="onInverseMuted">
          {t("틀렸던 문장을 다시 써 보는 3분이에요.")}
        </Text>
      </View>
      <View style={{ flexDirection: "row" }}>
        <Button label={t("복습 시작")} icon="refresh" onPress={() => router.push("/notes/review")} />
      </View>
    </View>
  );
}
