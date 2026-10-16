/**
 * 탭 화면의 공통 틀: 위쪽 안전 영역, 바탕색, 넓은 화면에서의 최대 폭.
 */
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { CONTENT_MAX_WIDTH, space } from "@/theme/tokens";

export function Page({
  children,
  refreshing,
  onRefresh,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space.xl, paddingBottom: space.xxxl, paddingHorizontal: space.xl }}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={c.primaryStrong} /> : undefined}
    >
      <View style={{ width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center", gap: space.xxl }}>{children}</View>
    </ScrollView>
  );
}
