/**
 * 웹 문서 껍데기: 글꼴(IBM Plex Sans KR)과 바탕색·주소창 색.
 * 앱에서는 아무 일도 하지 않습니다.
 */
import { useEffect } from "react";
import { Platform } from "react-native";

const FONT_HREF = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap";

export function useWebShell(background: string) {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (!document.querySelector("link[data-timotalk-font]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT_HREF;
      link.setAttribute("data-timotalk-font", "");
      document.head.appendChild(link);
    }
    document.body.style.backgroundColor = background;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = background;
  }, [background]);
}
