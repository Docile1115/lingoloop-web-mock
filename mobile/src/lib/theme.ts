/**
 * 앱 색·치수.
 *
 * 웹의 app/lib/tokens.ts 를 쓰려 했지만 그 파일의 accent 는 아직 예전 보라색
 * (#6f55ed)이고 지금 브랜드는 초록(#00c853)입니다. 값이 어긋난 채로 공유하면
 * 두 화면의 색이 달라지므로, 색은 지금 웹이 실제로 쓰는 값(globals.css 의
 * --primary 계열)을 그대로 옮겨 적고 간격·글자 크기 규칙만 같은 리듬을 씁니다.
 */
export const light = {
  bg: "#ffffff",
  surface: "#ffffff",
  surfaceSoft: "#fafafa",
  sunken: "#f5f5f5",
  line: "#e5e5e5",
  ink: "#0a0a0a",
  muted: "#5c5c5c",
  subtle: "#8a8a8a",
  primary: "#00c853",
  primaryStrong: "#00a844",
  onPrimary: "#08160e",
  danger: "#dc2626",
} as const;

export const dark = {
  bg: "#0a0a0a",
  surface: "#101010",
  surfaceSoft: "#161616",
  sunken: "#181818",
  line: "#2d2d2d",
  ink: "#f3f5f7",
  muted: "#b4b4b4",
  subtle: "#7d7d7d",
  primary: "#00c853",
  primaryStrong: "#00a844",
  onPrimary: "#08160e",
  danger: "#f05252",
} as const;

/** 두 팔레트는 키가 같고 값만 다릅니다. 한쪽을 기준으로 잡으면 값까지 고정돼 버립니다. */
export type Palette = { [K in keyof typeof light]: string };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { xs: 4, sm: 8, button: 10, md: 12, lg: 18, pill: 999 } as const;
/** 손가락으로 누르는 것의 최소 크기. 웹은 24, 손가락은 44 가 기준입니다. */
export const tapSize = 44;
