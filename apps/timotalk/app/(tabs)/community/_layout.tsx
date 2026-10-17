/**
 * 커뮤니티 탭 안의 화면들: 글 목록 → 글 · 글쓰기.
 */
import { Stack } from "expo-router";
import { useTheme } from "@/theme/theme";

// 주소로 글(/community/글id)에 바로 들어와도 밑에 글 목록을 깔아 둡니다.
export const unstable_settings = { initialRouteName: "index" };

export default function CommunityLayout() {
  const { c } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
}
