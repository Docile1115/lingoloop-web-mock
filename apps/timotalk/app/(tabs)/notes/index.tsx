/**
 * 노트: 배운 것이 쌓이는 곳.
 *  - 이번 주: 받은 교정 · 저장한 표현 · 복습 · 연속 학습일
 *  - 복습: 오늘 다시 볼 문장이 있으면 "복습 시작"
 *  - 받은 교정(대화·커뮤니티) / 저장한 표현
 * 교정을 누르면 그 대화(또는 커뮤니티)로 갑니다. 저장한 표현은 지울 수 있습니다.
 */
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { CorrectionView } from "@/features/notes/CorrectionView";
import { useNotesData } from "@/features/notes/data";
import { dueItems, streak, useReviewState, weekCount } from "@/features/notes/review";
import { t } from "@/lib/i18n";
import { useMe } from "@/lib/session";
import { relativeTime } from "@/lib/time";
import type { ReceivedCorrection, SavedPhrase } from "@/lib/types";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Avatar } from "@/ui/Avatar";
import { Card } from "@/ui/Bits";
import { Button } from "@/ui/Button";
import { ConfirmDialog } from "@/ui/Dialog";
import { Page } from "@/ui/Page";
import { Segmented } from "@/ui/Segmented";
import { EmptyState, ErrorState, LoadingState } from "@/ui/States";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

const COLUMN = 720;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type Box = "corrections" | "phrases";

export default function Notes() {
  const { c } = useTheme();
  const router = useRouter();
  const { state, reload, removePhrase } = useNotesData();
  const me = useMe();
  const review = useReviewState(me.id);
  const [box, setBox] = useState<Box>("corrections");
  const [deleting, setDeleting] = useState<SavedPhrase | null>(null);

  const data = state.status === "ready" ? state.data : null;
  // 이번 주의 시작(지금부터 7일 전). 그릴 때마다 시계를 읽지 않게 화면을 열 때 한 번 정합니다.
  const [since] = useState(() => Date.now() - WEEK_MS);
  const recent = (iso: string) => Date.parse(iso) >= since;
  const due = data && review.state ? dueItems(data.corrections, data.phrases, review.state).length : 0;

  const stats = [
    { label: t("받은 교정"), value: data ? data.corrections.filter((row) => recent(row.createdAt)).length : 0 },
    { label: t("저장한 표현"), value: data ? data.phrases.filter((row) => recent(row.createdAt)).length : 0 },
    { label: t("복습"), value: review.state ? weekCount(review.state.log) : 0 },
    { label: t("연속 학습"), value: review.state ? streak(review.state.log) : 0, unit: t("일") },
  ];

  return (
    <Page onRefresh={reload} refreshing={false}>
      <Text variant="display" accessibilityRole="header">
        {t("노트")}
      </Text>

      <View style={{ width: "100%", maxWidth: COLUMN, gap: space.xl }}>
        <Card>
          <Text variant="label" tone="muted">
            {t("이번 주")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: space.md }}>
            {stats.map((stat) => (
              <View key={stat.label} style={{ flexBasis: "25%", flexGrow: 1, minWidth: 110, gap: space.xxs }}>
                <Text variant="display">{stat.unit ? `${stat.value}${stat.unit}` : String(stat.value)}</Text>
                <Text variant="meta" tone="muted">
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <View style={{ backgroundColor: c.inverse, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
          <View style={{ gap: space.xxs }}>
            <Text variant="headline" tone="onInverse">
              {due ? t("다시 볼 문장 {n}개", { n: due }) : t("오늘 복습할 문장이 없어요")}
            </Text>
            <Text variant="callout" tone="onInverseMuted">
              {due ? t("틀렸던 문장을 다시 써 보는 3분이에요.") : t("교정을 받거나 표현을 저장하면 복습할 문장이 생겨요.")}
            </Text>
          </View>
          {due ? (
            <View style={{ flexDirection: "row" }}>
              <Button label={t("복습 시작")} icon="refresh" onPress={() => router.push("/notes/review")} />
            </View>
          ) : null}
        </View>

        <Segmented
          label={t("노트 목록")}
          value={box}
          onChange={setBox}
          options={[
            { value: "corrections", label: t("받은 교정"), count: data?.corrections.length },
            { value: "phrases", label: t("저장한 표현"), count: data?.phrases.length },
          ]}
        />

        {state.status === "loading" ? (
          <LoadingState />
        ) : state.status === "error" ? (
          <ErrorState message={state.error} onRetry={reload} />
        ) : box === "corrections" ? (
          state.data.corrections.length === 0 ? (
            <EmptyState title={t("아직 받은 교정이 없어요")} body={t("대화에서 파트너가 고쳐 준 문장과 커뮤니티 글에서 받은 교정이 여기에 모여요.")} />
          ) : (
            <Card padded={false}>
              {state.data.corrections.map((row, index) => (
                <CorrectionRow key={`${row.source ?? "community"}:${row.id}`} correction={row} first={index === 0} />
              ))}
            </Card>
          )
        ) : state.data.phrases.length === 0 ? (
          <EmptyState title={t("아직 저장한 표현이 없어요")} body={t("대화방에서 상대 말을 누르고 \"저장\"을 고르면 여기에 모여요.")} />
        ) : (
          <Card padded={false}>
            {state.data.phrases.map((row, index) => (
              <View key={row.id} style={{ paddingVertical: space.md, paddingHorizontal: space.lg, gap: space.xs, borderTopWidth: index ? 1 : 0, borderTopColor: c.lineSoft }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
                  <View style={{ flex: 1, minWidth: 0, gap: space.xxs }}>
                    <Text variant="bodyStrong" selectable>
                      {row.phrase}
                    </Text>
                    {row.meaning ? (
                      <Text variant="callout" tone="muted" selectable>
                        {row.meaning}
                      </Text>
                    ) : null}
                  </View>
                  <Button label={t("삭제")} variant="ghost" onPress={() => setDeleting(row)} />
                </View>
                <Text variant="caption" tone="muted">
                  {[row.source, relativeTime(row.createdAt)].filter(Boolean).join(" · ")}
                </Text>
              </View>
            ))}
          </Card>
        )}
      </View>

      <ConfirmDialog
        visible={Boolean(deleting)}
        title={t("이 표현을 지울까요?")}
        body={deleting?.phrase}
        confirmLabel={t("삭제")}
        danger
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) void removePhrase(target.id).then((ok) => (ok ? showToast(t("표현을 지웠어요")) : showToast(t("지우지 못했어요."), "error")));
        }}
      />
    </Page>
  );
}

function CorrectionRow({ correction, first }: { correction: ReceivedCorrection; first: boolean }) {
  const { c } = useTheme();
  const router = useRouter();
  const fromName = correction.from ?? t("알 수 없는 상대");
  const fromChat = correction.source === "chat";
  const open = () => {
    if (fromChat && correction.conversationId) router.push({ pathname: "/chat/[id]", params: { id: correction.conversationId } });
    else if (correction.postId) router.push({ pathname: "/community/[postId]", params: { postId: correction.postId } });
    else router.push("/community");
  };
  return (
    <Pressable
      onPress={open}
      accessibilityRole="link"
      accessibilityHint={fromChat ? t("이 교정을 받은 대화를 열어요") : t("이 교정이 달린 글을 열어요")}
      style={({ pressed }) => ({
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
        gap: space.sm,
        backgroundColor: pressed ? c.surfaceSoft : "transparent",
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.lineSoft,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Avatar name={fromName} photo={correction.fromAvatarUrl} avatarMode={correction.fromAvatarMode} avatarConfig={correction.fromAvatarConfig} size={28} />
        <Text variant="meta" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
          {[fromChat ? t("{name}님이 대화에서", { name: fromName }) : t("{name}님이 내 글에서", { name: fromName }), relativeTime(correction.createdAt)].join(" · ")}
        </Text>
      </View>
      <CorrectionView original={correction.original} fixed={correction.fixed} note={correction.note} />
    </Pressable>
  );
}
