import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:5174";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title: {
      default: "LingoLoop — 함께 말하고, 함께 배우는 언어 교환",
      template: "%s | LingoLoop",
    },
    description:
      "Firebase Identity Platform 인증과 Firestore 영구 저장으로 파트너 매칭, 커뮤니티와 대화를 이어가는 언어 교환 서비스입니다.",
    applicationName: "LingoLoop",
    keywords: ["언어 교환", "language exchange", "학습 커뮤니티", "언어 파트너", "LingoLoop"],
    authors: [{ name: "LingoLoop" }],
    openGraph: {
      type: "website",
      siteName: "LingoLoop",
      title: "LingoLoop — 함께 말하고, 함께 배우는 언어 교환",
      description: "맞춤 파트너 매칭, 커뮤니티와 영구 저장되는 대화를 제공하는 반응형 언어 교환 서비스",
      images: [{ url: "/og.png", width: 1732, height: 908, alt: "LingoLoop 언어 교환 서비스" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "LingoLoop — 함께 말하고, 함께 배우는 언어 교환",
      description: "PC와 모바일에서 이어지는 소셜 언어 교환 서비스",
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
