import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:5173";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title: {
      default: "LingoLoop — 함께 말하고, 함께 배우는 언어 교환",
      template: "%s | LingoLoop",
    },
    description:
      "실제 대화에서 배우는 소셜 언어 교환 서비스 LingoLoop의 프런트엔드·mock API 프로토타입입니다.",
    applicationName: "LingoLoop",
    keywords: ["언어 교환", "language exchange", "학습 커뮤니티", "React", "mock app"],
    authors: [{ name: "LingoLoop Prototype" }],
    openGraph: {
      type: "website",
      siteName: "LingoLoop",
      title: "LingoLoop — 함께 말하고, 함께 배우는 언어 교환",
      description: "파트너 매칭, 문장 교정, 학습형 채팅과 음성 라운지를 경험하는 반응형 웹 프로토타입",
      images: [{ url: "/og.png", width: 1732, height: 908, alt: "LingoLoop 언어 교환 웹 mock" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "LingoLoop — 함께 말하고, 함께 배우는 언어 교환",
      description: "PC와 모바일에서 만나는 독립적인 소셜 언어 교환 프로토타입",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
