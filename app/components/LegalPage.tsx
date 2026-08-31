import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./LegalPage.module.css";

type LegalPageProps = {
  current: "privacy" | "terms";
  title: string;
  summary: string;
  children: ReactNode;
};

export function LegalPage({ current, title, summary, children }: LegalPageProps) {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#legal-content">본문으로 이동</a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} href="/" aria-label="TimoTalk 홈">
            <span className={styles.brandMark} aria-hidden="true">T</span>
            <span>Timo<strong>Talk</strong></span>
          </Link>
          <nav className={styles.nav} aria-label="정책 문서">
            <Link aria-current={current === "privacy" ? "page" : undefined} href="/privacy">
              개인정보 처리방침
            </Link>
            <Link aria-current={current === "terms" ? "page" : undefined} href="/terms">
              이용약관
            </Link>
          </nav>
        </div>
      </header>

      <main className={styles.main} id="legal-content">
        <section className={styles.hero}>
          <p className={styles.eyebrow}>TimoTalk 정책 안내</p>
          <h1>{title}</h1>
          <p className={styles.summary}>{summary}</p>
          <p className={styles.updated}>시행일: 2026년 8월 31일</p>
        </section>
        <article className={styles.content}>{children}</article>
      </main>

      <footer className={styles.footer}>
        <div>
          <Link href="/">TimoTalk으로 돌아가기</Link>
          <span aria-hidden="true">·</span>
          <a href="mailto:dvdsang2@gmail.com">문의하기</a>
        </div>
        <p>언어 장벽은 낮추고, 사람 사이의 경계는 존중합니다.</p>
      </footer>
    </div>
  );
}
