/**
 * 나 탭 안의 화면들: 나 → 프로필 편집 · 받는 메시지 · 차단한 사람 · 계정 삭제.
 * 탭 안에 쌓아서 넓은 화면에서는 왼쪽 메뉴가, 휴대폰에서는 아래 탭이 그대로 남습니다.
 */
import { Stack } from "expo-router";
import { useTheme } from "@/theme/theme";

// 주소로 안쪽 화면(/me/edit 등)에 바로 들어와도 밑에 "나"를 깔아 둡니다. 없으면 뒤로 가기가 탭 밖(오늘)으로 나갑니다.
export const unstable_settings = { initialRouteName: "index" };

export default function MeLayout() {
  const { c } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
}
