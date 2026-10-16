/**
 * 대화 상자. 휴대폰에서는 아래에서 올라오는 시트, 넓은 화면에서는 가운데 상자입니다.
 * 신고 사유 고르기, "정말 나갈까요?" 같은 확인에 씁니다.
 *
 * 웹에서는 react-native 의 Alert 가 아무것도 띄우지 않으므로, 확인이 필요한 곳은 모두 이 상자를 씁니다.
 * 바깥을 누르거나 Esc(웹)·뒤로 가기(안드로이드)를 누르면 onClose 가 불립니다.
 */
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "@/lib/i18n";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Button } from "./Button";
import { Text } from "./Text";

const SHEET_BREAKPOINT = 640;

export function Dialog({
  visible,
  title,
  body,
  onClose,
  children,
  actions,
}: {
  visible: boolean;
  title: string;
  body?: string;
  onClose: () => void;
  children?: React.ReactNode;
  /** 아래 단추들. 오른쪽 끝이 주된 일입니다. */
  actions?: React.ReactNode;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const sheet = width < SHEET_BREAKPOINT;
  return (
    // 바탕을 가리는 막과 상자가 함께 나타나게 fade 를 씁니다(slide 는 막까지 아래에서 밀려 올라옵니다).
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: sheet ? "flex-end" : "center", alignItems: "center", padding: sheet ? 0 : space.xl }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("닫기")}
          style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}
        />
        <View
          role="dialog"
          aria-modal
          aria-label={title}
          style={{
            width: "100%",
            maxWidth: 480,
            maxHeight: "90%",
            backgroundColor: c.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            borderBottomLeftRadius: sheet ? 0 : radius.lg,
            borderBottomRightRadius: sheet ? 0 : radius.lg,
            paddingBottom: (sheet ? insets.bottom : 0) + space.xl,
          }}
        >
          <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
            <Text variant="title" accessibilityRole="header">
              {title}
            </Text>
            {body ? (
              <Text variant="callout" tone="muted">
                {body}
              </Text>
            ) : null}
            {children}
          </ScrollView>
          {actions ? (
            <View style={{ paddingHorizontal: space.xl, flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: space.sm }}>
              {actions}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/** 확인 상자: 설명 한 줄과 [취소] [하기] */
export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  /** 되돌릴 수 없는 일이면 빨간 단추 */
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      visible={visible}
      title={title}
      body={body}
      onClose={busy ? () => undefined : onClose}
      actions={
        <>
          <Button label={t("취소")} variant="secondary" disabled={busy} onPress={onClose} />
          <Button label={confirmLabel} variant={danger ? "danger" : "primary"} busy={busy} onPress={onConfirm} />
        </>
      }
    />
  );
}
