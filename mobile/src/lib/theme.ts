/**
 * 색과 치수.
 *
 * 초록(프라이머리)에 노랑(세컨더리)을 더했습니다. 두 색을 나란히 놓았을 때
 * 하나가 튀지 않도록 밝기를 재서 골랐습니다 — #00c853 과 #FFC300 의 상대
 * 밝기 차이가 0.18 로, 후보 중 가장 붙어 있으면서도 둘 다 선명합니다.
 *
 * 노랑은 **글자로 쓰지 않습니다.** 흰 배경 위 대비가 1.6 이라 안 보입니다.
 * 채움색으로 쓰고 그 위에는 어두운 잉크를 얹습니다(대비 10.68). 밝은 화면에서
 * 노란 글자가 필요하면 secondaryInk(#8c6b00, 흰 배경 위 4.98)를 씁니다.
 *
 * 어느 조합이든 4.5:1 을 넘습니다. 눈대중으로 고르면 다크 모드에서 안 보이는
 * 글자가 반드시 생깁니다.
 */
const brand = {
  primary: "#00c853",
  primaryStrong: "#00a844",
  onPrimary: "#08160e",
  secondary: "#FFC300",
  onSecondary: "#241a00",
} as const;

export const light = {
  ...brand,
  bg: "#ffffff",
  surface: "#ffffff",
  surfaceSoft: "#f7f7f8",
  sunken: "#f0f0f2",
  line: "#e4e4e7",
  lineStrong: "#d0d0d6",
  ink: "#09090b",
  muted: "#52525b",
  subtle: "#8b8b94",
  danger: "#e11d48",
  secondaryInk: "#8c6b00",
} as const;

export const dark = {
  ...brand,
  bg: "#000000",
  surface: "#0b0b0d",
  surfaceSoft: "#121214",
  sunken: "#1a1a1d",
  line: "#232327",
  lineStrong: "#33333a",
  ink: "#fafafa",
  muted: "#a1a1aa",
  subtle: "#71717a",
  danger: "#fb7185",
  secondaryInk: "#FFC300",
} as const;

/** 두 팔레트는 키가 같고 값만 다릅니다. 한쪽을 기준으로 잡으면 값까지 고정됩니다. */
export type Palette = { [K in keyof typeof light]: string };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** 팝한 인상은 대부분 모서리에서 나옵니다 — 각진 것보다 둥근 쪽이 가볍습니다. */
export const radius = { xs: 6, sm: 10, button: 14, md: 18, lg: 22, pill: 999 } as const;

/** 손가락으로 누르는 것의 최소 크기. 웹은 24, 손가락은 44 가 기준입니다. */
export const tapSize = 44;

/**
 * 글자 크기.
 *
 * Threads 처럼 본문을 크게 잡습니다(15). 화면이 좁을수록 작게 쓰고 싶어지지만,
 * 폰은 팔 길이만큼 떨어져 있어서 작으면 그냥 안 읽힙니다.
 */
export const type = {
  screenTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.8 },
  title: { fontSize: 19, fontWeight: "700", letterSpacing: -0.3 },
  name: { fontSize: 15, fontWeight: "700", letterSpacing: -0.1 },
  body: { fontSize: 15, lineHeight: 22 },
  meta: { fontSize: 13 },
  caption: { fontSize: 12 },
} as const;
