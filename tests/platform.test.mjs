import assert from "node:assert/strict";
import test from "node:test";
import { isIOSDevice } from "../app/lib/platform.ts";

const cases = [
  ["iPhone Safari", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X)", platform: "iPhone", maxTouchPoints: 5 }, true],
  ["iPad WebView", { userAgent: "Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", platform: "iPad", maxTouchPoints: 5 }, true],
  ["iPadOS desktop mode", { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel", maxTouchPoints: 5 }, true],
  ["macOS Safari", { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.6 Safari/605.1.15", platform: "MacIntel", maxTouchPoints: 0 }, false],
  ["Android Chrome", { userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/139.0 Mobile Safari/537.36", platform: "Linux armv8l", maxTouchPoints: 5 }, false],
  ["Android WebView", { userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9 Build/AP3A) AppleWebKit/537.36 Version/4.0 Chrome/139.0 Mobile Safari/537.36; wv", platform: "Linux armv8l", maxTouchPoints: 5 }, false],
  ["Windows Chrome", { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/139.0 Safari/537.36", platform: "Win32", maxTouchPoints: 0 }, false],
  ["unknown", {}, false],
];

for (const [name, browser, expected] of cases) {
  test(`${name} 기기 판별`, () => {
    assert.equal(isIOSDevice(browser), expected);
  });
}
