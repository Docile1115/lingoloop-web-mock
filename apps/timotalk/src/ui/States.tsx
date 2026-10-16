/** 불러오는 중 · 실패 · 비어 있음. 모든 목록이 이 세 가지를 같은 모양으로 보여 줍니다. */
import { ActivityIndicator, View } from "react-native";
import { t } from "@/lib/i18n";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";
import { Button } from "./Button";
import { Text } from "./Text";

export function LoadingState({ label }: { label?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ paddingVertical: space.xxxl, alignItems: "center", gap: space.md }} aria-live="polite">
      <ActivityIndicator color={c.primaryStrong} />
      {label ? (
        <Text variant="meta" tone="muted">
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ paddingVertical: space.xxl, alignItems: "center", gap: space.md }} accessibilityRole="alert">
      <Text variant="callout" tone="muted" style={{ textAlign: "center" }}>
        {message}
      </Text>
      {onRetry ? <Button label={t("다시 시도")} variant="secondary" icon="refresh" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <View style={{ paddingVertical: space.xxl, paddingHorizontal: space.lg, alignItems: "center", gap: space.sm }}>
      <Text variant="headline" style={{ textAlign: "center" }}>
        {title}
      </Text>
      {body ? (
        <Text variant="callout" tone="muted" style={{ textAlign: "center" }}>
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
}
