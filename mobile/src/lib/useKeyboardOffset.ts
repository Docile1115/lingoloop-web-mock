/**
 * KeyboardAvoidingView 의 keyboardVerticalOffset.
 *
 * 이 값은 "화면 맨 위에서 이 뷰가 시작하는 곳까지의 거리"입니다. 예전에는 90·100 을
 * 박아 두어 노치·다이내믹 아일랜드 기기와 가로 화면에서 입력칸이 키보드에 가리거나
 * 너무 떠 있었습니다. 상태바 높이는 안전 영역(위쪽)에서 받고, 헤더 높이는 native-stack 이
 * 기본 헤더 높이를 정하는 규칙(@react-navigation/elements 의 getDefaultHeaderHeight)과 같게 둡니다.
 *
 * iOS 에서만 씁니다. 안드로이드는 behavior 를 주지 않아 이 값을 보지 않습니다.
 */
import { PixelRatio, Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function useKeyboardOffset(
  /** header: 헤더 아래 화면, modal: 시트로 뜨는 화면, none: 헤더 없이 위쪽 안전 영역부터 시작하는 화면 */
  layout: "header" | "modal" | "none" = "header",
): number {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== "ios") return 0;
  if (layout === "none") return insets.top;
  const landscape = width > height;
  const pad = Platform.isPad;
  // 다이내믹 아일랜드 기기는 상태바가 안전 영역보다 조금 낮습니다(native-stack 과 같은 보정).
  const statusBar = insets.top > 50 ? insets.top - (5 + 1 / PixelRatio.get()) : insets.top;
  if (layout === "modal") {
    // 시트는 상태바 바로 아래에서 시작하고 헤더가 56 입니다. 시트 위쪽 여백은 시스템이 정해서 근삿값입니다.
    return (pad ? 56 : landscape ? 32 : 56) + insets.top;
  }
  // 가로 화면의 iPhone 은 헤더가 상태바를 품지 않습니다.
  const header = pad ? 50 : landscape ? 32 : 44;
  return header + (!pad && landscape ? 0 : statusBar);
}
