/**
 * 신고 창: 사유(웹·옛 앱과 같은 목록) · 자세한 내용(선택) · 함께 차단. 대화방 메뉴와 프로필 메뉴가 같이 씁니다.
 * 접수되면 접수번호를 알리고, 함께 차단했으면 서버 차단까지 끝난 뒤에 "차단했어요"라고 알립니다.
 */
import { useState } from "react";
import { View } from "react-native";
import { failureText } from "@/lib/api";
import { t, tx } from "@/lib/i18n";
import type { Profile } from "@/lib/types";
import { space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { ChoiceChip, TextField } from "@/ui/Field";
import { ListGroup, RadioRow } from "@/ui/List";
import { showToast } from "@/ui/Toast";
import { REPORT_REASONS, blockUser, reportUser, shortReportId } from "./actions";

export function ReportDialog({
  partner,
  visible,
  onClose,
  onReported,
}: {
  partner: Profile;
  visible: boolean;
  onClose: () => void;
  /** 접수가 끝났을 때. blocked 면 함께 차단까지 끝났습니다. */
  onReported: (blocked: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setReason("");
    setDetails("");
    setAlsoBlock(false);
  };

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    try {
      const id = shortReportId((await reportUser(partner.id, reason, details)).id);
      if (!alsoBlock) {
        showToast(t("신고가 접수되었어요 · 접수번호 {id}", { id }));
        reset();
        onReported(false);
        return;
      }
      try {
        await blockUser(partner.id);
        showToast(t("신고를 접수하고 차단했어요 · 접수번호 {id}", { id }));
        reset();
        onReported(true);
      } catch {
        showToast(t("신고는 접수했지만 차단하지 못했어요 · 접수번호 {id}", { id }), "error");
        reset();
        onReported(false);
      }
    } catch (caught) {
      showToast(failureText(caught, t("신고를 보내지 못했어요. 다시 시도해 주세요.")), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      visible={visible}
      title={t("{name}님 신고하기", { name: partner.name })}
      body={t("운영팀이 확인하고 조치해요. 신고한 사실은 상대에게 알리지 않아요.")}
      onClose={() => (busy ? undefined : onClose())}
      actions={
        <>
          <Button label={t("취소")} variant="secondary" disabled={busy} onPress={onClose} />
          <Button label={t("신고 보내기")} variant="danger" busy={busy} disabled={!reason} onPress={() => void submit()} />
        </>
      }
    >
      <View accessibilityRole="radiogroup" aria-label={t("신고 사유")}>
        <ListGroup title={t("신고 사유")}>
          {REPORT_REASONS.map((item) => (
            <RadioRow key={item.code} title={tx(item.label)} selected={reason === item.code} disabled={busy} onPress={() => setReason(item.code)} />
          ))}
        </ListGroup>
      </View>
      <TextField
        label={t("자세한 내용 (선택)")}
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={1000}
        placeholder={t("무슨 일이 있었는지 적어 주면 확인이 빨라요.")}
        disabled={busy}
      />
      <View style={{ flexDirection: "row", paddingTop: space.xs }}>
        <ChoiceChip
          label={t("{name}님 차단도 하기", { name: partner.name })}
          selected={alsoBlock}
          multiple
          disabled={busy}
          onPress={() => setAlsoBlock((value) => !value)}
        />
      </View>
    </Dialog>
  );
}
