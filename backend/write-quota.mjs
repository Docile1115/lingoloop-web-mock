/**
 * 사용자별 하루 쓰기 한도.
 *
 * 만드는 데 비용이 거의 들지 않는 쓰기는 스크립트 하나로 남의 알림함과 저장소를 채울 수
 * 있습니다. 사람이 하루에 정상적으로 쓰는 양보다 넉넉하게 잡고, 넘으면 서울 날짜가 바뀔
 * 때까지 막습니다.
 *
 * 한 사람당 문서 하나(writeQuotas/{uid})에 그날 날짜와 행동별 횟수를 담습니다. 날짜가 바뀌면
 * 0 부터 다시 셉니다 — 날마다 새 문서를 만들지 않아 지울 것도 없습니다(homeQuotas 와 같은 방식).
 * 저장은 호출하는 쪽이 행동을 기록하는 transaction 안에서 합니다.
 */
export const WRITE_LIMITS = Object.freeze({
  posts: Object.freeze({ limit: 30, label: "게시물 작성" }),
  // 댓글과 교정을 함께 셉니다.
  replies: Object.freeze({ limit: 200, label: "댓글·교정 작성" }),
  // 글 좋아요와 파트너에게 보내는 마음을 함께 셉니다. 누르고 취소하는 것도 한 번씩입니다.
  reactions: Object.freeze({ limit: 500, label: "좋아요·마음 보내기" }),
  // 팔로우와 언팔로우를 함께 셉니다 — 반복하면 상대 알림함에 알림이 계속 생깁니다.
  follows: Object.freeze({ limit: 200, label: "팔로우 변경" }),
  reports: Object.freeze({ limit: 30, label: "신고 접수" }),
  messageRequests: Object.freeze({ limit: 20, label: "새 메시지 요청" }),
});

/**
 * 이번 행동을 센 다음 상태. 한도에 닿았으면 allowed: false 이고 next 가 없습니다.
 * 저장된 값이 깨져 있으면(음수·숫자 아님) 0 으로 봅니다 — 서버만 쓰는 문서입니다.
 */
export function nextWriteQuota(current, action, day, limits = WRITE_LIMITS) {
  const rule = limits[action];
  if (!rule || !Number.isInteger(rule.limit) || rule.limit < 1) throw new Error("Unknown write quota action: " + action);
  const counts =
    current?.day === day && current.counts && typeof current.counts === "object" && !Array.isArray(current.counts)
      ? current.counts
      : {};
  const stored = Number(counts[action] || 0);
  const used = Number.isSafeInteger(stored) && stored > 0 ? stored : 0;
  if (used >= rule.limit) return { allowed: false, limit: rule.limit, used };
  return { allowed: true, limit: rule.limit, used: used + 1, next: { day, counts: { ...counts, [action]: used + 1 } } };
}

export function writeQuotaMessage(action, limits = WRITE_LIMITS) {
  const rule = limits[action];
  return "오늘 " + rule.label + " 한도(" + rule.limit + "회)를 모두 사용했습니다. 내일 다시 시도해 주세요.";
}
