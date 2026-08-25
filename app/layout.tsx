import type { Metadata } from "next";
import { headers } from "next/headers";
import { SITE_METADATA, localeFromAcceptLanguage } from "./lib/i18n/metadata";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:5174";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  // 탭 제목과 검색 결과는 서버에서 만들어지므로 화면용 t() 를 쓸 수 없습니다.
  // 요청 언어로 고르고, 앱에서 언어를 바꾸면 브라우저에서 제목을 다시 맞춥니다.
  const locale = localeFromAcceptLanguage(requestHeaders.get("accept-language"));
  const copy = SITE_METADATA[locale];

  return {
    metadataBase,
    title: {
      default: copy.title,
      template: "%s | LingoLoop",
    },
    description: copy.description,
    applicationName: "LingoLoop",
    keywords: copy.keywords,
    authors: [{ name: "LingoLoop" }],
    openGraph: {
      type: "website",
      siteName: "LingoLoop",
      title: copy.title,
      description: copy.ogDescription,
      images: [{ url: "/og.png", width: 1732, height: 908, alt: copy.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.ogDescription,
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
