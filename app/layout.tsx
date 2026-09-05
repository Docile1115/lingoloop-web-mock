import type { Metadata } from "next";
import { headers } from "next/headers";
import { SITE_METADATA } from "./lib/i18n/metadata";
import "./globals.css";
import "./room.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:5174";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  // 서버는 한국어 한 벌로 그립니다.
  //
  // 요청 언어(Accept-Language)로 고르게 해봤더니, 처음 흘려보낸 HTML 과 스트리밍
  // 메타데이터가 서로 다른 언어가 되어 하이드레이션이 어긋났습니다(React 가
  // "고쳐지지 않는다"고 경고합니다). 서버가 언어를 요청마다 바꾸려면 본문까지
  // 요청 컨텍스트로 옮겨야 하는데, 서버가 그리는 건 잠깐 보이는 로딩 화면뿐입니다.
  // 그래서 문서 전체를 한국어로 맞춰두고(lang·본문·메타데이터), 사용자가 고른
  // 언어는 마운트 뒤 브라우저에서 document.title 로 다시 맞춥니다.
  const copy = SITE_METADATA.ko;

  return {
    metadataBase,
    title: {
      default: copy.title,
      template: "%s | TimoTalk",
    },
    description: copy.description,
    applicationName: "TimoTalk",
    keywords: copy.keywords,
    authors: [{ name: "TimoTalk" }],
    openGraph: {
      type: "website",
      siteName: "TimoTalk",
      title: copy.title,
      description: copy.ogDescription,
      images: [{ url: "/og.png", width: 1731, height: 909, alt: copy.title }],
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
