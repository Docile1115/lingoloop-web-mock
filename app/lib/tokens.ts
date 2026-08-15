/**
 * UI 토큰.
 * 웹은 ui.css의 CSS 변수로, 이후 React Native는 StyleSheet로 같은 값을 소비합니다.
 * 값 근거: 실측 집계 — 본문 15/21이 지배적이고 line-height는 일괄 1.4 비율.
 */

export const type = {
  title: { size: 20, line: 25, weight: 600 },
  body: { size: 15, line: 21, weight: 400 },
  meta: { size: 13, line: 18.2, weight: 400 },
  caption: { size: 12, line: 16.8, weight: 400 },
} as const;

export const color = {
  text: "#000000",
  textSub: "#424242",
  textMuted: "#999999",
  accent: "#6f55ed",
  base: "#ffffff",
  raised: "#fafafa",
  sunken: "#f5f5f5",
  divider: "#e5e5e5",
  borderStrong: "rgba(0, 0, 0, 0.15)",
  fill: "rgba(0, 0, 0, 0.035)",
  scrim: "rgba(0, 0, 0, 0.15)",
  inverse: "#000000",   // 실측 — 팔로우 버튼 채움
} as const;

/** 다크 모드 실측값. */
export const darkColor = {
  text: "#f3f5f7",
  textSub: "#cccccc",
  textMuted: "#777777",
  accent: "#6f55ed",
  base: "#0a0a0a",
  raised: "#101010",
  sunken: "#181818",
  divider: "#2d2d2d",
  borderStrong: "rgba(243, 245, 247, 0.15)",
  fill: "rgba(255, 255, 255, 0.08)",
  scrim: "rgba(0, 0, 0, 0.6)",
  inverse: "#efefef",
} as const;

/** 12가 기본 리듬, 24가 섹션 구분. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** button 10은 실측값. sm 8은 미디어 카드용. RN에서 원형은 size / 2 로 계산합니다. */
export const radius = { sm: 8, button: 10, md: 12, lg: 18, pill: 999 } as const;

/** 표준 컨트롤 높이 — 버튼·아이콘버튼·액션 모두 36. */
export const controlHeight = 36;

/** 24 / 28 / 36 은 실측 — 각각 깊은 답글 / 답글 / 최상위 게시물. */
export const avatarSize = { xs: 24, sm: 28, md: 36, lg: 48, xl: 64, profile: 84 } as const;  // profile 84는 실측

/** 실측 transition. 0.15s ease가 111회로 지배적. */
export const motion = {
  base: "0.15s ease",
  mid: "0.2s ease",
  slow: "0.3s ease",
  enter: "0.5s ease",
} as const;

/** 피드 본문 컬럼 폭 실측. 인용 카드는 543. */
export const contentWidth = 591;
export const quoteWidth = 543;

/** 데스크톱 사이드바 실측. */
export const sidebar = { width: 230, itemWidth: 200, itemHeight: 34, padX: 15 } as const;

/**
 * 실측 아이콘 크기. aria-label로 용도 확인됨:
 * 16 메타(#999) · 18 사이드바 내비(검색·메시지·알림·프로필) · 20 액션(새 메시지).
 */
export const iconSize = { xs: 12, sm: 14, md: 16, nav: 18, action: 20, xl: 24 } as const;

/** 유일한 그림자 값. */
export const shadow = "0 6px 8px rgba(0, 0, 0, 0.08)";

/** DM 실측. 꼬리는 그룹 마지막 말풍선의 바깥 아래 모서리를 4px로 줄여 표현합니다. */
export const bubble = {
  radius: 18,
  tailRadius: 4,
  padY: 8,
  padX: 12,
  maxWidth: 564,
  received: "#f5f5f5",
  sent: "#101010",
} as const;

/** DM 목록 실측. */
export const conversation = { avatar: 50, rowHeight: 50 } as const;

/** 검색 필드 실측 — 채움형 pill. */
export const searchField = { height: 40, radius: 22 } as const;

/** 토글 실측. radius 16은 높이 절반으로 클램프되어 pill로 렌더됩니다. */
export const toggle = { width: 40, height: 24, radius: 16, off: "#dbdfe4" } as const;

/** 설정 행 실측 — 구분선 없음. */
export const settingRow = { height: 72 } as const;

/** 섹션 라벨 실측 — 12px/16.8px/600 #999999. */
export const sectionLabel = { size: 12, line: 16.8, weight: 600 } as const;

export type AvatarSize = keyof typeof avatarSize;

/** 레이아웃 골격 — 전부 실측. */
export const layout = {
  feedMaxWidth: 640,
  feedPadX: 24,
  contentWidth: 591,
  avatarColumn: 48,   // grid-template-columns: 48px <본문>
  bodyColumn: 543,
  modalWidth: 620,
  sidebarFull: 230,
  sidebarMini: 68,
  mobileHeader: 60,
  mobileTabBar: 50,
} as const;

/** 브레이크포인트 실측. */
export const breakpoint = { sidebarCollapse: 1318, mobile: 562 } as const;

/** 오버레이 실측. */
export const overlay = {
  dimmer: "rgba(0, 0, 0, 0.7)",
  modalShadow: "0 12px 24px rgba(0, 0, 0, 0.08)",
  cardShadow: "0 0 12px rgba(0, 0, 0, 0.04)",
  barBg: "rgba(255, 255, 255, 0.85)",
  barBlur: "blur(28.5px)",
} as const;

/** 화면 제목 실측 — 전 화면 20/25/600 동일. 프로필 이름만 24/33.6/700. */
export const screenTitle = { size: 20, line: 25, weight: 600 } as const;

/** 빈 상태 실측 — 제목도 회색(#999)입니다. */
export const emptyState = {
  title: { size: 20, line: 25, weight: 600, color: "#999999" },
  desc: { size: 16, line: 21, weight: 400, color: "#999999" },
} as const;

/** 필터 칩 실측 — 선택 여부와 무관하게 0.5px 테두리, 선택 시 배경만 채움. */
export const filterChip = { height: 33, radius: 20, size: 13, weight: 600 } as const;

/** 검색 필드 실측 — 목록 패널 40 / 검색 전용 화면 44. radius는 둘 다 22. */
export const searchSizes = { inline: 40, page: 44, radius: 22 } as const;
