/**
 * 잠깐 떴다 사라지는 알림(토스트).
 *
 * 웹이 토스트로 알리는 결과(요청 수락·차단·신고·알림 끄기 등)를 앱에서도 알립니다.
 * 차단하고 대화방을 닫아도 보이도록 화면마다 두지 않고 앱 맨 위에 하나만 둡니다.
 * 화면 읽기 프로그램에도 같은 문장을 읽어 줍니다.
 */
import { useEffect, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../lib/useTheme";
import { radius, space } from "../lib/theme";

let show: ((message: string) => void) | null = null;

export function showToast(message: string) {
  show?.(message);
}

export function ToastHost() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  // 같은 문장이 연달아 와도 다시 띄우려고 번호를 함께 둡니다.
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  useEffect(() => {
    show = (message) => {
      setToast((current) => ({ id: (current?.id ?? 0) + 1, message }));
      AccessibilityInfo.announceForAccessibility(message);
    };
    return () => { show = null; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return (
    // 탭 막대 위에 띄웁니다. 누르는 것을 가로막지 않습니다.
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 72 }]}>
      <Text style={[styles.toast, { backgroundColor: c.ink, color: c.bg }]}>{toast.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: space.lg, right: space.lg, alignItems: "center" },
  toast: {
    overflow: "hidden",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.button,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    textAlign: "center",
  },
});
