/**
 * 서버에 닿지 않아 로그인 여부를 확인하지 못했고, 기기에 남은 프로필도 없을 때.
 *
 * 로그인 화면으로 보내지 않습니다 — 로그인은 살아 있을 수 있습니다(연결 끊김·시간 초과·
 * 서버 일시 장애). 다시 시도하거나, 원하면 여기서 로그아웃할 수 있습니다.
 */
import { Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { t } from "../lib/i18n";
import { useSession } from "../lib/session";
import { space, tapSize } from "../lib/theme";
import { useTheme } from "../lib/useTheme";
import { EmptyState } from "../ui";

export function SessionUnavailableScreen({ message }: { message: string }) {
  const c = useTheme();
  const { retry, signOut } = useSession();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <EmptyState
        emoji="📡"
        title={message}
        body={t("로그인 상태를 확인하지 못했어요. 연결되면 다시 시도해 주세요.")}
        onRetry={retry}
      />
      <Pressable
        onPress={() => void signOut()}
        accessibilityRole="button"
        style={{ minHeight: tapSize, alignItems: "center", justifyContent: "center", marginBottom: space.xl }}
      >
        <Text style={{ color: c.muted, fontSize: 14, fontWeight: "600" }}>{t("로그아웃")}</Text>
      </Pressable>
    </SafeAreaView>
  );
}
