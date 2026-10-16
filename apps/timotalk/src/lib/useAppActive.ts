/**
 * 앱(웹 탭)이 지금 앞에 보이는가. 뒤에 있는 동안에는 새로 받기를 멈춥니다 —
 * 보지 않는 화면을 위해 서버를 부르면 배터리와 요청 수만 씁니다.
 */
import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";

function visibleNow(): boolean {
  if (Platform.OS === "web") return typeof document === "undefined" || document.visibilityState !== "hidden";
  return AppState.currentState === "active";
}

export function useAppActive(): boolean {
  const [active, setActive] = useState(visibleNow);
  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof document === "undefined") return;
      const onChange = () => setActive(document.visibilityState !== "hidden");
      document.addEventListener("visibilitychange", onChange);
      return () => document.removeEventListener("visibilitychange", onChange);
    }
    const subscription = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => subscription.remove();
  }, []);
  return active;
}
