/**
 * 상대 문장 고쳐 주기. 상대가 배우는 말(대개 내 모국어)로 쓴 문장을 자연스럽게 고쳐 보냅니다.
 * 보낸 교정은 대화에 남고, 상대의 노트("받은 교정")에도 모입니다(서버가 함께 저장).
 * 원래 문장을 그대로 채워 두고 고치게 합니다 — 처음부터 다시 쓰는 것보다 빠르고, 바뀐 곳이 미리보기로 보입니다.
 */
import { useState } from "react";
import { View } from "react-native";
import { t } from "@/lib/i18n";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { TextField } from "@/ui/Field";
import { Text } from "@/ui/Text";
import { CorrectionView } from "@/features/notes/CorrectionView";

export function CorrectionDialog({
  original,
  visible,
  onClose,
  onSend,
}: {
  original: string;
  visible: boolean;
  onClose: () => void;
  onSend: (fixed: string, note: string) => Promise<boolean>;
}) {
  const { c } = useTheme();
  const [fixed, setFixed] = useState(original);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const changed = Boolean(fixed.trim()) && fixed.trim() !== original.trim();

  const send = async () => {
    if (!changed || busy) return;
    setBusy(true);
    const ok = await onSend(fixed.trim(), note.trim());
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Dialog
      visible={visible}
      title={t("문장 고쳐 주기")}
      body={t("자연스러운 말로 고쳐 주세요. 고친 문장은 상대의 노트에 모여요.")}
      onClose={() => (busy ? undefined : onClose())}
      actions={
        <>
          <Button label={t("취소")} variant="secondary" disabled={busy} onPress={onClose} />
          <Button label={t("교정 보내기")} icon="send" busy={busy} disabled={!changed} onPress={() => void send()} />
        </>
      }
    >
      <View style={{ gap: space.xs }}>
        <Text variant="label" tone="muted">
          {t("원래 문장")}
        </Text>
        <Text variant="body" selectable>
          {original}
        </Text>
      </View>
      <TextField label={t("고친 문장")} value={fixed} onChangeText={setFixed} multiline maxLength={4000} disabled={busy} />
      {changed ? (
        <View style={{ padding: space.md, borderRadius: radius.md, backgroundColor: c.surfaceSoft, gap: space.xs }}>
          <Text variant="label" tone="muted">
            {t("미리보기")}
          </Text>
          <CorrectionView original={original} fixed={fixed.trim()} />
        </View>
      ) : null}
      <TextField
        label={t("한 줄 설명 (선택)")}
        value={note}
        onChangeText={setNote}
        maxLength={300}
        placeholder={t("예: 과거형은 went 예요.")}
        disabled={busy}
      />
    </Dialog>
  );
}
