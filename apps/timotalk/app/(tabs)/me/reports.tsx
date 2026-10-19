/**
 * 신고 검토(운영자만). "나" 화면에 운영자에게만 줄이 보이고, 주소로 들어와도 서버가 운영자가 아니면 404 로 막습니다.
 * 처리 전 · 처리함 · 전체로 나눠 보고, 한 건씩 "조치함 / 문제없음"과 한 줄 메모를 남깁니다.
 * 실제 조치(글 지우기·이용 제한)는 아직 운영 콘솔에서 합니다 — 여기서는 판단과 이유를 기록합니다.
 */
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { listReports, reasonLabel, reviewReport, type AdminReport, type ReportFilter, type ReportOutcome } from "@/features/admin/reports";
import { shortReportId } from "@/features/chats/actions";
import { ApiError, failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import { relativeTime } from "@/lib/time";
import { space } from "@/theme/tokens";
import { Card, Pill } from "@/ui/Bits";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { TextField } from "@/ui/Field";
import { ListGroup, RadioRow } from "@/ui/List";
import { Page } from "@/ui/Page";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { Segmented } from "@/ui/Segmented";
import { EmptyState, ErrorState, LoadingState } from "@/ui/States";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

const COLUMN = 680;

const statusLabel = (status: string) => (status === "received" ? t("처리 전") : status === "actioned" ? t("조치함") : t("문제없음"));
const someone = (name: string | null) => name || t("알 수 없는 사람");

export default function ReportReview() {
  const [filter, setFilter] = useState<ReportFilter>("open");
  const [loaded, setLoaded] = useState<{ filter: ReportFilter; rows: AdminReport[] } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [reviewing, setReviewing] = useState<AdminReport | null>(null);

  useEffect(() => {
    let alive = true;
    listReports(filter)
      .then((rows) => {
        if (!alive) return;
        setLoaded({ filter, rows: rows ?? [] });
        setError("");
      })
      .catch((caught) => {
        // 운영자가 아니면 서버가 404 로 답합니다(경로 이름을 그대로 보여 주지 않습니다).
        if (alive) setError(caught instanceof ApiError && caught.status === 404 ? t("볼 수 없는 화면이에요.") : failureText(caught, t("불러오지 못했어요.")));
      });
    return () => {
      alive = false;
    };
  }, [filter, attempt]);

  // 다른 묶음을 고르면 새로 받을 때까지 불러오는 중으로 보입니다.
  const rows = loaded?.filter === filter ? loaded.rows : null;

  /** 처리한 신고를 지금 묶음에 맞게 바꾸거나 뺍니다. */
  const reviewed = (report: AdminReport) => {
    const belongs = filter === "all" || (filter === "open") === (report.status === "received");
    setLoaded((current) =>
      current
        ? { ...current, rows: belongs ? current.rows.map((row) => (row.id === report.id ? report : row)) : current.rows.filter((row) => row.id !== report.id) }
        : current,
    );
  };

  return (
    <Page>
      <ScreenHeader title={t("신고 검토")} fallback="/me" detail={t("운영자에게만 보이는 화면이에요.")} />
      <View style={{ width: "100%", maxWidth: COLUMN, gap: space.lg }}>
        <Segmented
          label={t("신고 묶음")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: t("처리 전") },
            { value: "closed", label: t("처리함") },
            { value: "all", label: t("전체") },
          ]}
        />
        {error && !rows ? (
          <ErrorState
            message={error}
            onRetry={() => {
              setError("");
              setAttempt((n) => n + 1);
            }}
          />
        ) : !rows ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <EmptyState title={filter === "open" ? t("처리할 신고가 없어요") : t("신고가 없어요")} />
        ) : (
          rows.map((report) => <ReportCard key={report.id} report={report} onReview={() => setReviewing(report)} />)
        )}
      </View>
      {reviewing ? (
        <ReviewDialog
          key={reviewing.id}
          report={reviewing}
          onClose={() => setReviewing(null)}
          onDone={(report) => {
            setReviewing(null);
            reviewed(report);
          }}
        />
      ) : null}
    </Page>
  );
}

function ReportCard({ report, onReview }: { report: AdminReport; onReview: () => void }) {
  const router = useRouter();
  const open = report.status === "received";
  return (
    <Card>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs + 2 }}>
        <Pill label={reasonLabel(report.reason)} tone={open ? "primary" : "neutral"} />
        <Pill label={report.targetType === "post" ? t("글") : report.targetType === "message" ? t("메시지") : t("사람")} />
        <Pill label={statusLabel(report.status)} />
      </View>

      {report.targetType === "post" ? (
        report.post ? (
          <View style={{ gap: space.xs }}>
            <Text variant="body" numberOfLines={6} selectable>
              {report.post.text}
            </Text>
            <Text variant="meta" tone="muted">
              {t("글쓴이 {name} · {time}", { name: someone(report.post.author.name), time: relativeTime(report.post.createdAt) })}
            </Text>
          </View>
        ) : (
          <Text variant="callout" tone="muted">
            {t("지워진 글이에요")}
          </Text>
        )
      ) : report.targetType === "message" ? (
        <Text variant="callout" tone="muted" selectable>
          {t("메시지 {id}", { id: report.target.id })}
        </Text>
      ) : (
        <Text variant="bodyStrong">{someone(report.target.name)}</Text>
      )}

      {report.details ? (
        <Text variant="callout" tone="inkSoft" selectable>
          {t("신고 내용: {details}", { details: report.details })}
        </Text>
      ) : null}
      <Text variant="meta" tone="muted">
        {[t("{name}님이 신고", { name: someone(report.reporter.name) }), relativeTime(report.submittedAt), shortReportId(report.id)].join(" · ")}
      </Text>
      {report.resolution ? (
        <Text variant="meta" tone="inkSoft">
          {t("처리 메모: {note}", { note: report.resolution })}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <Button label={open ? t("처리하기") : t("처리 바꾸기")} icon="check" variant={open ? "primary" : "secondary"} onPress={onReview} />
        {report.targetType === "post" && report.post ? (
          <Button
            label={t("글 보기")}
            variant="ghost"
            onPress={() => router.push({ pathname: "/community/[postId]", params: { postId: report.post!.id } })}
          />
        ) : null}
        {report.targetType === "user" ? (
          <Button label={t("프로필 보기")} variant="ghost" onPress={() => router.push({ pathname: "/people/[id]", params: { id: report.target.id } })} />
        ) : null}
      </View>
    </Card>
  );
}

function ReviewDialog({ report, onClose, onDone }: { report: AdminReport; onClose: () => void; onDone: (report: AdminReport) => void }) {
  const [outcome, setOutcome] = useState<ReportOutcome>(report.status === "dismissed" ? "dismissed" : "actioned");
  const [note, setNote] = useState(report.resolution);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const saved = await reviewReport(report.id, outcome, note.trim());
      showToast(outcome === "received" ? t("처리 전으로 되돌렸어요") : t("신고를 처리했어요"));
      onDone({ ...report, status: saved.status, resolution: saved.resolution });
    } catch (caught) {
      showToast(failureText(caught, t("저장하지 못했어요.")), "error");
      setBusy(false);
    }
  };

  return (
    <Dialog
      visible
      title={t("신고 처리")}
      body={t("어떻게 판단했는지 한 줄 남겨 두면 나중에 이유를 알 수 있어요.")}
      onClose={() => (busy ? undefined : onClose())}
      actions={
        <>
          <Button label={t("취소")} variant="secondary" disabled={busy} onPress={onClose} />
          <Button label={t("저장")} icon="check" busy={busy} onPress={() => void save()} />
        </>
      }
    >
      <View accessibilityRole="radiogroup" aria-label={t("처리 결과")}>
        <ListGroup title={t("처리 결과")}>
          <RadioRow title={t("조치함")} detail={t("규칙을 어겨 조치했어요.")} selected={outcome === "actioned"} disabled={busy} onPress={() => setOutcome("actioned")} />
          <RadioRow title={t("문제없음")} detail={t("규칙을 어기지 않았어요.")} selected={outcome === "dismissed"} disabled={busy} onPress={() => setOutcome("dismissed")} />
          {report.status !== "received" ? (
            <RadioRow title={t("처리 전으로 되돌리기")} selected={outcome === "received"} disabled={busy} onPress={() => setOutcome("received")} />
          ) : null}
        </ListGroup>
      </View>
      <TextField
        label={t("처리 메모 (선택)")}
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={500}
        placeholder={t("예: 광고 글이라 지웠어요.")}
        disabled={busy}
      />
    </Dialog>
  );
}
