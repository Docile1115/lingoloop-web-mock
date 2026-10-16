/**
 * 디자인 토큰 — A안 "맑은 초록".
 *
 * 화면의 모든 색·글자 크기·간격은 여기서만 정합니다. 웹·iOS·Android 가 같은 값을 씁니다.
 * 어두운 모드는 같은 이름에 다른 값을 줍니다(시안 C 의 어두운 바탕을 A 의 초록에 맞춘 것).
 *
 * 대비: 본문 글자는 바탕 위에서 4.5:1 이상입니다.
 *  - 초록 버튼(primary) 위 글자는 흰색이 아니라 onPrimary(짙은 초록)입니다. 흰색은 2.2:1 이라 읽기 어렵습니다.
 *  - 초록 글자(primaryStrong)는 흰 바탕에서 4.8:1 입니다.
 */
import { Platform } from "react-native";

export type Palette = {
  /** 화면 바탕 */
  bg: string;
  /** 카드·입력칸 바탕 */
  surface: string;
  /** 카드 안의 옅은 칸(AI 제안 상자 등) */
  surfaceSoft: string;
  /** 눌린 상태·나뉜 칸 */
  sunken: string;
  ink: string;
  inkSoft: string;
  muted: string;
  /** 지운 글자(교정 전 문장)처럼 일부러 흐린 글자. 본문에는 쓰지 않습니다. */
  faint: string;
  line: string;
  lineSoft: string;
  primary: string;
  onPrimary: string;
  primaryStrong: string;
  primarySoft: string;
  /** 교정된 부분 강조 */
  highlight: string;
  /** 안 읽음 같은 주의 표시(노랑) */
  attention: string;
  onAttention: string;
  attentionSoft: string;
  onAttentionSoft: string;
  danger: string;
  /** 위험 버튼(계정 삭제 등) 위 글자 */
  onDanger: string;
  /** 위험 안내 상자 바탕 */
  dangerSoft: string;
  /** 대화 상자 뒤를 가리는 막 */
  scrim: string;
  /** 반전 카드(복습 등) */
  inverse: string;
  onInverse: string;
  onInverseMuted: string;
};

export const light: Palette = {
  bg: "#F5F7F4",
  surface: "#FFFFFF",
  surfaceSoft: "#EEF3EE",
  sunken: "#E6ECE7",
  ink: "#0F1A14",
  inkSoft: "#34423A",
  muted: "#56645B",
  faint: "#8A958E",
  line: "#DCE3DD",
  lineSoft: "#E8EDE9",
  primary: "#00C853",
  onPrimary: "#08160E",
  primaryStrong: "#00873A",
  primarySoft: "#E3F5E9",
  highlight: "#D6F5E1",
  attention: "#FFD54A",
  onAttention: "#0F1A14",
  attentionSoft: "#FFF4CC",
  onAttentionSoft: "#7A5D00",
  danger: "#C62828",
  onDanger: "#FFFFFF",
  dangerSoft: "#FDECEA",
  scrim: "rgba(15, 26, 20, 0.45)",
  inverse: "#0F1A14",
  onInverse: "#FFFFFF",
  onInverseMuted: "#C5D0C8",
};

export const dark: Palette = {
  bg: "#0D1210",
  surface: "#151C18",
  surfaceSoft: "#1C2621",
  sunken: "#232E28",
  ink: "#E9F0EB",
  inkSoft: "#C9D4CD",
  muted: "#A0ADA5",
  faint: "#6F7C74",
  line: "#2A352F",
  lineSoft: "#202A24",
  primary: "#2FD872",
  onPrimary: "#06140C",
  primaryStrong: "#5BE394",
  primarySoft: "#163322",
  highlight: "#1F4A30",
  attention: "#FFC857",
  onAttention: "#0D1210",
  attentionSoft: "#33280F",
  onAttentionSoft: "#F3D27A",
  danger: "#FF8A80",
  onDanger: "#2A0B08",
  dangerSoft: "#3A1A17",
  scrim: "rgba(0, 0, 0, 0.6)",
  inverse: "#E9F0EB",
  onInverse: "#0D1210",
  onInverseMuted: "#3A4740",
};

/** 간격(px). 같은 간격을 반복해 써야 화면이 정돈돼 보입니다. */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { sm: 12, md: 16, lg: 20, pill: 999 } as const;

/** 손가락으로 누를 수 있는 최소 크기 */
export const tapSize = 44;

/**
 * 글꼴. 웹은 IBM Plex Sans KR(webShell.ts 에서 불러옴), 앱은 기기 기본 글꼴입니다.
 * 한글 글꼴 파일은 굵기마다 수 MB 라 앱에 넣지 않습니다 — 기기 기본(애플 SD 산돌고딕·
 * 노토 산스)이 한국 앱에서 가장 흔하고 잘 읽힙니다.
 */
export const fontFamily = Platform.select({
  web: "'IBM Plex Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif",
  default: undefined,
});

/**
 * 웹에서 중국어·일본어 문장에 쓰는 글꼴(ui/Text.tsx 가 글자 모양을 보고 고릅니다).
 * IBM Plex Sans KR 에는 간체자와 일본식 한자가 없어서, 그대로 두면 없는 글자만 브라우저가
 * 다른 글꼴(윈도에서는 명조 계열)로 채워 한 문장 안에서 글꼴이 섞입니다. 기기에 있는 고딕 글꼴을 고릅니다.
 */
export const cjkFontFamily = {
  zh: "'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', 'Noto Sans CJK SC', 'Source Han Sans SC', sans-serif",
  ja: "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic UI', 'Yu Gothic', Meiryo, 'Noto Sans JP', 'Noto Sans CJK JP', sans-serif",
} as const;

/** 글자 단계. 화면에서 새 크기를 지어내지 않고 여기서 고릅니다. */
export const type = {
  display: { fontSize: 24, lineHeight: 31, fontWeight: "700", letterSpacing: -0.4 },
  title: { fontSize: 18, lineHeight: 25, fontWeight: "700" },
  headline: { fontSize: 17, lineHeight: 23, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: "600" },
  callout: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
  meta: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "600" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
  tab: { fontSize: 11, lineHeight: 14, fontWeight: "500" },
} as const;

export type TypeVariant = keyof typeof type;

/** 넓은 화면(웹·태블릿)에서 옆 메뉴로 바꾸는 너비 */
export const WIDE_BREAKPOINT = 900;
/** 본문이 너무 넓어지지 않게 막는 폭 */
export const CONTENT_MAX_WIDTH = 1120;
