export type BrowserPlatform = {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
};

/**
 * iPadOS는 데스크톱 사이트 모드에서 Mac으로 자신을 표시하므로 터치 포인트도 함께 봅니다.
 * 그 외 macOS, Android, Windows 브라우저는 Google 로그인 경로를 사용합니다.
 */
export function isIOSDevice(browser: BrowserPlatform) {
  const userAgent = browser.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(userAgent)) return true;

  return browser.platform === "MacIntel" && (browser.maxTouchPoints || 0) > 1;
}
