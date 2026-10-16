/**
 * 노트 탭 안의 화면들: 노트 → 복습.
 */
import { Stack } from "expo-router";
import { useTheme } from "@/theme/theme";

// 주소로 복습(/notes/review)에 바로 들어와도 밑에 노트를 깔아 둡니다.
export const unstable_settings = { initialRouteName: "index" };

export default function NotesLayout() {
  const { c } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
}
