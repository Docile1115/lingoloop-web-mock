/**
 * 복습: 틀렸던 문장을 다시 써 보는 3분.
 *  - 받은 교정: 고치기 전 문장을 보여 주고 직접 고쳐 써 본 뒤 정답(고친 문장)과 비교합니다.
 *  - 저장한 표현: 표현을 보고 뜻을 떠올린 뒤 확인합니다.
 * "알았어요"면 다음 상자로(더 나중에 다시), "다시 볼게요"면 내일 다시 나옵니다(features/notes/review.ts).
 * 한 번에 최대 10개. 시작할 때 고른 묶음으로 끝까지 갑니다(도중에 새로 받지 않음).
 */
import { useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { CorrectionView } from "@/features/notes/CorrectionView";
import { useNotesData } from "@/features/notes/data";
import { SESSION_SIZE, dueItems, streak, useReviewState, type ReviewItem } from "@/features/notes/review";
import { t } from "@/lib/i18n";
import { useMe } from "@/lib/session";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Card } from "@/ui/Bits";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/Field";
import { Page } from "@/ui/Page";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { EmptyState, ErrorState, LoadingState } from "@/ui/States";
import { Text } from "@/ui/Text";

const COLUMN = 560;

export default function Review() {
  const { state: notes, reload } = useNotesData();
  const me = useMe();
  const review = useReviewState(me.id);
  // 시작할 때 고른 묶음. 채점하면 일정이 바뀌지만 이번 묶음은 그대로 둡니다.
  const [session, setSession] = useState<ReviewItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(0);

  const ready = notes.status === "ready" && review.state;
  const queue = useMemo(() => {
    if (session) return session;
    if (notes.status !== "ready" || !review.state) return null;
    return dueItems(notes.data.corrections, notes.data.phrases, review.state).slice(0, SESSION_SIZE);
  }, [session, notes, review.state]);

  const current = queue?.[index];
  const finished = Boolean(queue && queue.length && index >= queue.length);

  const grade = (knew: boolean) => {
    if (!queue || !current) return;
    if (!session) setSession(queue);
    review.grade(current.key, knew);
    setDone((n) => n + 1);
    setIndex((n) => n + 1);
  };

  return (
    <Page>
      <ScreenHeader title={t("복습")} detail={queue && queue.length && !finished ? t("{current} / {total}", { current: Math.min(index + 1, queue.length), total: queue.length }) : undefined} fallback="/notes" />
      <View style={{ width: "100%", maxWidth: COLUMN, gap: space.xl }}>
        {notes.status === "error" ? (
          <ErrorState message={notes.error} onRetry={reload} />
        ) : !ready || !queue ? (
          <LoadingState />
        ) : finished ? (
          <Finished count={done} days={streak(review.state!.log)} />
        ) : !current ? (
          <EmptyState title={t("오늘 복습할 문장이 없어요")} body={t("교정을 받거나 표현을 저장하면 복습할 문장이 생겨요.")} />
        ) : (
          <ReviewCard key={current.key} item={current} onGrade={grade} />
        )}
      </View>
    </Page>
  );
}

function ReviewCard({ item, onGrade }: { item: ReviewItem; onGrade: (knew: boolean) => void }) {
  const { c } = useTheme();
  const [answer, setAnswer] = useState("");
  const [shown, setShown] = useState(false);

  if (item.kind === "phrase") {
    return (
      <Card>
        <Text variant="label" tone="muted">
          {t("무슨 뜻일까요?")}
        </Text>
        <Text variant="display" selectable>
          {item.phrase.phrase}
        </Text>
        {shown ? (
          <View style={{ padding: space.md, borderRadius: radius.md, backgroundColor: c.surfaceSoft }}>
            <Text variant="body" selectable>
              {item.phrase.meaning}
            </Text>
          </View>
        ) : null}
        <Actions shown={shown} onShow={() => setShown(true)} onGrade={onGrade} />
      </Card>
    );
  }

  const correction = item.correction;
  const matched = answer.trim() && answer.trim().replace(/\s+/g, " ") === correction.fixed.trim().replace(/\s+/g, " ");
  return (
    <Card>
      <Text variant="label" tone="muted">
        {t("이 문장을 자연스럽게 고쳐 보세요")}
      </Text>
      <Text variant="headline" selectable>
        {correction.original}
      </Text>
      <TextField label={t("내 답 (선택)")} value={answer} onChangeText={setAnswer} multiline maxLength={4000} disabled={shown} placeholder={t("머릿속으로만 떠올려도 돼요")} />
      {shown ? (
        <View style={{ padding: space.md, borderRadius: radius.md, backgroundColor: c.surfaceSoft, gap: space.sm }}>
          {answer.trim() ? (
            <Text variant="label" tone={matched ? "primaryStrong" : "muted"}>
              {matched ? t("정답과 같아요!") : t("정답과 비교해 보세요")}
            </Text>
          ) : null}
          <CorrectionView original={correction.original} fixed={correction.fixed} note={correction.note} />
        </View>
      ) : null}
      <Actions shown={shown} onShow={() => setShown(true)} onGrade={onGrade} />
    </Card>
  );
}

function Actions({ shown, onShow, onGrade }: { shown: boolean; onShow: () => void; onGrade: (knew: boolean) => void }) {
  if (!shown) return <Button label={t("정답 보기")} onPress={onShow} />;
  return (
    <View style={{ flexDirection: "row", gap: space.sm }}>
      <Button label={t("다시 볼게요")} variant="secondary" grow onPress={() => onGrade(false)} />
      <Button label={t("알았어요")} icon="check" grow onPress={() => onGrade(true)} />
    </View>
  );
}

function Finished({ count, days }: { count: number; days: number }) {
  const router = useRouter();
  return (
    <EmptyState
      title={t("오늘 {n}문장을 복습했어요", { n: count })}
      body={days > 1 ? t("{days}일째 이어서 공부하고 있어요. 내일도 만나요!", { days }) : t("내일 다시 볼 문장을 골라 둘게요.")}
      action={<Button label={t("노트로 돌아가기")} variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace("/notes"))} />}
    />
  );
}
