/**
 * 잠깐 떴다 사라지는 알림. 결과(보냈어요·저장했어요·실패했어요)를 알립니다.
 * 화면을 닫아도 보이도록 앱 맨 위에 하나만 둡니다. 화면 읽기 프로그램에도 읽어 줍니다.
 */
import { useEffect, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Icon } from "./Icon";
import { Text } from "./Text";

type Tone = "success" | "error";
let show: ((message: string, tone: Tone) => void) | null = null;

export function showToast(message: string, tone: Tone = "success") {
  show?.(message, tone);
}

export function ToastHost() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ id: number; message: string; tone: Tone } | null>(null);

  useEffect(() => {
    show = (message, tone) => {
      setToast((current) => ({ id: (current?.id ?? 0) + 1, message, tone }));
      AccessibilityInfo.announceForAccessibility(message);
    };
    return () => {
      show = null;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: space.lg, right: space.lg, bottom: insets.bottom + 92, alignItems: "center" }}
    >
      <View
        accessibilityRole={toast.tone === "error" ? "alert" : undefined}
        style={{
          maxWidth: 480,
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          paddingVertical: space.md,
          paddingHorizontal: space.lg,
          borderRadius: radius.md,
          backgroundColor: c.inverse,
        }}
      >
        <Icon name={toast.tone === "error" ? "close" : "check"} size={16} color={toast.tone === "error" ? c.attention : c.primary} strokeWidth={2.4} />
        <Text variant="callout" style={{ color: c.onInverse, fontWeight: "600", flexShrink: 1 }}>
          {toast.message}
        </Text>
      </View>
    </View>
  );
}
