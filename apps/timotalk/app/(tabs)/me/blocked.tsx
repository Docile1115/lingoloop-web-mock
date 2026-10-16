/**
 * 차단한 사람. 차단을 풀면 서로 다시 추천·검색에 나오고 대화를 걸 수 있습니다.
 * 차단은 대화를 지우지 않고 목록에서 가리기만 해서(서버의 cleanupBlockedPair 는 마음·팔로우·알림만 정리),
 * 풀면 예전 대화가 다시 보입니다.
 */
import { useEffect, useState } from "react";
import { View } from "react-native";
import { api, failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Profile } from "@/lib/types";
import { nativeSummary, placeName } from "@/lib/words";
import { space } from "@/theme/tokens";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { ConfirmDialog } from "@/ui/Dialog";
import { ListGroup } from "@/ui/List";
import { Page } from "@/ui/Page";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { EmptyState, ErrorState, LoadingState } from "@/ui/States";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

type BlockRow = { id: string; blockedId: string; createdAt: string; partner: Profile };

export default function Blocked() {
  const [rows, setRows] = useState<BlockRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [target, setTarget] = useState<BlockRow | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api<BlockRow[]>("/api/blocks")
      .then((data) => {
        if (alive) setRows(data ?? []);
      })
      .catch((caught) => {
        if (alive) setLoadError(failureText(caught, t("불러오지 못했어요.")));
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const unblock = async () => {
    if (!target || busy) return;
    setBusy(true);
    try {
      await api(`/api/partners/${encodeURIComponent(target.blockedId)}/block`, { method: "DELETE" });
      setRows((current) => (current ?? []).filter((row) => row.id !== target.id));
      showToast(t("{name}님의 차단을 풀었어요", { name: target.partner.name }));
      setTarget(null);
    } catch (caught) {
      showToast(failureText(caught, t("차단을 풀지 못했어요. 다시 시도해 주세요.")), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <ScreenHeader title={t("차단한 사람")} detail={t("차단한 사람과는 서로 보이지 않고 대화할 수 없어요.")} fallback="/me" />
      <View style={{ width: "100%", maxWidth: 560 }}>
        {loadError ? (
          <ErrorState
            message={loadError}
            onRetry={() => {
              setLoadError("");
              setAttempt((n) => n + 1);
            }}
          />
        ) : !rows ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <EmptyState title={t("차단한 사람이 없어요")} body={t("대화방이나 프로필의 메뉴에서 차단할 수 있어요.")} />
        ) : (
          <ListGroup>
            {rows.map((row) => (
              <View key={row.id} style={{ minHeight: 64, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: space.md }}>
                <Avatar name={row.partner.name} photo={row.partner.avatarUrl} avatarMode={row.partner.avatarMode} avatarConfig={row.partner.avatarConfig} size={40} />
                <View style={{ flex: 1, minWidth: 0, gap: space.xxs }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {row.partner.name}
                  </Text>
                  <Text variant="meta" tone="muted" numberOfLines={1}>
                    {[placeName(row.partner), nativeSummary(row.partner)].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <Button label={t("차단 풀기")} variant="secondary" onPress={() => setTarget(row)} />
              </View>
            ))}
          </ListGroup>
        )}
      </View>

      <ConfirmDialog
        visible={Boolean(target)}
        title={t("{name}님의 차단을 풀까요?", { name: target?.partner.name ?? "" })}
        body={t("서로 다시 추천과 검색에 나오고 대화를 걸 수 있어요. 예전 대화도 다시 보여요.")}
        confirmLabel={t("차단 풀기")}
        busy={busy}
        onClose={() => setTarget(null)}
        onConfirm={() => void unblock()}
      />
    </Page>
  );
}
