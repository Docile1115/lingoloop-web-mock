const SUPPORTED_DM_SCOPES = new Set(["everyone", "matches", "followers", "mutual-follows"]);

export function decideDmRoute(policy = {}, relationships = {}) {
  const scope = policy.whoCanMessage === "all" ? "everyone" : policy.whoCanMessage;
  if (!SUPPORTED_DM_SCOPES.has(scope)) return { status: "denied", scope };
  const allowed =
    scope === "everyone" ||
    (scope === "matches" && relationships.matched === true) ||
    (scope === "followers" && relationships.follower === true) ||
    (scope === "mutual-follows" && relationships.mutualFollow === true);

  if (allowed) return { status: "accepted", scope };
  if (policy.routeOthersToRequests === true) return { status: "pending", scope };
  return { status: "denied", scope };
}

/**
 * 첫 인사에서 눈에 띄는 스팸 신호.
 *
 * 완벽한 판별은 못 하고, 그럴 필요도 없습니다 — 여기서 하는 일은 "요청함에 표시를
 * 달아 받는 사람이 먼저 알아보게" 하는 것뿐입니다. 지우거나 막지 않습니다.
 * 틀렸을 때 사람이 잃는 게 없어야 하므로, 확실한 것만 봅니다.
 */
// 한국어에는 \b 를 쓰지 않습니다 — 자바스크립트의 \b 는 [A-Za-z0-9_] 경계라
// 한글 앞뒤에서는 절대 맞지 않습니다(/\b텔레그램\b/ 는 아무것도 못 잡습니다).
// 영문만 \b 로 감싸고 한글은 그대로 찾습니다.
const SPAM_PATTERNS = [
  // 다른 앱으로 빼내려는 시도 — 언어 교환 사기의 가장 흔한 첫 수입니다.
  { code: "off-platform", test: (text) => /텔레그램|왓츠앱|라인\s?아이디|카톡\s?아이디|위챗|\b(telegram|whats\s?app|line\s?id|kakao\s?id|wechat)\b/i.test(text) },
  // 돈 이야기. "시간을 투자하다" 처럼 평범하게 쓰이는 말(투자·수익·알바)은 뺐습니다 —
  // 표시가 잦아지면 사람이 표시를 안 보게 되고, 그러면 표시가 있으나 마나입니다.
  { code: "money", test: (text) => /비트코인|가상화폐|고수익|원금\s?보장|송금해|입금해|대출|재테크|\b(crypto|bitcoin|usdt|binance)\b/i.test(text) },
  // 링크. 이메일 주소 안의 도메인은 빼고 봅니다 — 그건 아래 연락처가 잡습니다.
  { code: "link", test: (text) => /(https?:\/\/|www\.|(^|[^\w@.])[a-z0-9-]+\.(com|net|org|io|me|link|xyz)\b)/i.test(text) },
  // 연락처
  { code: "contact", test: (text) => /(\+?\d[\d\s-]{8,}\d)|[\w.+-]+@[\w-]+\.[\w.]+/.test(text) },
];

export function spamSignals(text) {
  const value = String(text || "");
  if (!value.trim()) return [];
  return SPAM_PATTERNS.filter((pattern) => pattern.test(value)).map((pattern) => pattern.code);
}
