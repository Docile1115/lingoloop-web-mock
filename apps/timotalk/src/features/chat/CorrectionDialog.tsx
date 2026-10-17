/**
 * 상대 문장 고쳐 주기. 상대가 배우는 말(대개 내 모국어)로 쓴 문장을 자연스럽게 고쳐 보냅니다.
 * 보낸 교정은 대화에 남고, 상대의 노트("받은 교정")에도 모입니다(서버가 함께 저장).
 * 원래 문장을 그대로 채워 두고 고치게 합니다 — 처음부터 다시 쓰는 것보다 빠르고, 바뀐 곳이 미리보기로 보입니다.
 * 커뮤니티 글은 여러 문장이라 고칠 문장을 먼저 고르고(sentences), 설명 칸은 없습니다(글 교정에는 설명을 담을 곳이 없음).
 */
import { useState } from "react";
import { View } from "react-native";
import { t } from "@/lib/i18n";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { ListGroup, RadioRow } from "@/ui/List";
import { TextField } from "@/ui/Field";
import { Text } from "@/ui/Text";
import { CorrectionView } from "@/features/notes/CorrectionView";

export function CorrectionDialog({
  original: first,
  sentences,
  withNote = true,
  maxLength = 4000,
  body,
  visible,
  onClose,
  onSend,
}: {
  original: string;
  /** 고를 수 있는 문장들(커뮤니티 글). 둘 이상이면 먼저 고르게 합니다. */
  sentences?: string[];
  withNote?: boolean;
  /** 고친 문장 길이 한도(대화 4000자, 커뮤니티 댓글 1000자 — 서버와 같게) */
  maxLength?: number;
  body?: string;
  visible: boolean;
  onClose: () => void;
  onSend: (fixed: string, note: string, original: string) => Promise<boolean>;
}) {
  const { c } = useTheme();
  const [original, setOriginal] = useState(first);
  const [fixed, setFixed] = useState(first);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const changed = Boolean(fixed.trim()) && fixed.trim() !== original.trim();

  const send = async () => {
    if (!changed || busy) return;
    setBusy(true);
    const ok = await onSend(fixed.trim(), note.trim(), original);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Dialog
      visible={visible}
      title={t("문장 고쳐 주기")}
      body={body ?? t("자연스러운 말로 고쳐 주세요. 고친 문장은 상대의 노트에 모여요.")}
      onClose={() => (busy ? undefined : onClose())}
      actions={
        <>
          <Button label={t("취소")} variant="secondary" disabled={busy} onPress={onClose} />
          <Button label={t("교정 보내기")} icon="send" busy={busy} disabled={!changed} onPress={() => void send()} />
        </>
      }
    >
      {sentences && sentences.length > 1 ? (
        <View accessibilityRole="radiogroup" aria-label={t("고칠 문장 고르기")}>
          <ListGroup title={t("고칠 문장 고르기")}>
            {sentences.map((sentence) => (
              <RadioRow
                key={sentence}
                title={sentence}
                selected={sentence === original}
                disabled={busy}
                onPress={() => {
                  setOriginal(sentence);
                  setFixed(sentence);
                }}
              />
            ))}
          </ListGroup>
        </View>
      ) : (
        <View style={{ gap: space.xs }}>
          <Text variant="label" tone="muted">
            {t("원래 문장")}
          </Text>
          <Text variant="body" selectable>
            {original}
          </Text>
        </View>
      )}
      <TextField label={t("고친 문장")} value={fixed} onChangeText={setFixed} multiline maxLength={maxLength} disabled={busy} />
      {changed ? (
        <View style={{ padding: space.md, borderRadius: radius.md, backgroundColor: c.surfaceSoft, gap: space.xs }}>
          <Text variant="label" tone="muted">
            {t("미리보기")}
          </Text>
          <CorrectionView original={original} fixed={fixed.trim()} />
        </View>
      ) : null}
      {withNote ? (
        <TextField
          label={t("한 줄 설명 (선택)")}
          value={note}
          onChangeText={setNote}
          maxLength={300}
          placeholder={t("예: 과거형은 went 예요.")}
          disabled={busy}
        />
      ) : null}
    </Dialog>
  );
}
