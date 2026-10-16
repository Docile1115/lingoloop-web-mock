/**
 * 안쪽 화면(프로필 편집·설정 등)의 머리: 뒤로 + 제목.
 * 주소로 바로 들어와 뒤로 갈 곳이 없으면(웹) fallback 화면으로 갑니다.
 */
import { useRouter, type Href } from "expo-router";
import { View } from "react-native";
import { t } from "@/lib/i18n";
import { space } from "@/theme/tokens";
import { IconButton } from "./Button";
import { Text } from "./Text";

export function ScreenHeader({ title, fallback, detail }: { title: string; fallback: Href; detail?: string }) {
  const router = useRouter();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginLeft: -space.sm }}>
      <IconButton icon="back" label={t("뒤로")} plain onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))} />
      <View style={{ flex: 1, minWidth: 0, gap: space.xxs }}>
        <Text variant="display" accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
        {detail ? (
          <Text variant="callout" tone="muted">
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
