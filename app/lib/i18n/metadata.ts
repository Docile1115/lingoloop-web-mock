import type { Locale } from "./keys-locale";

/**
 * 브라우저 탭 제목과 검색 결과에 나가는 문구.
 *
 * 화면 안쪽 문구와 달리 이것들은 **서버에서** 만들어집니다. 그래서 화면용 t() 를
 * 쓸 수 없습니다(t 는 브라우저에 있는 현재 언어를 읽습니다).
 * 서버는 한국어로 그리고, 사용자가 고른 언어는 마운트 뒤 document.title 로 맞춥니다
 * — 이유는 app/layout.tsx 의 generateMetadata 주석에 적어 두었습니다.
 */
export const SITE_METADATA: Record<Locale, { title: string; description: string; ogDescription: string; keywords: string[] }> = {
  ko: {
    title: "LingoLoop — 진짜 사람과 배우는 언어 교환",
    description:
      "진짜 사람과 이야기하며 언어를 배워요. 주고받은 대화와 써둔 글은 계정에 남아 폰을 바꿔도 그대로 이어져요.",
    ogDescription: "나와 맞는 사람을 찾고, 커뮤니티에서 연습하고, 대화는 계정에 그대로 남아요.",
    keywords: ["언어 교환", "언어 파트너", "외국어 회화", "language exchange", "LingoLoop"],
  },
  en: {
    title: "LingoLoop — Learn a language with real people",
    description:
      "Trade languages with real people. Your profile, posts and conversations stay in your account, so nothing is lost when you switch devices.",
    ogDescription: "Find a partner who fits you, practice with the community, and keep every conversation in your account.",
    keywords: ["language exchange", "language partner", "practice speaking", "LingoLoop"],
  },
  ja: {
    title: "LingoLoop — 実際の人と学ぶ言語交換",
    description:
      "実際の人と言語を教え合いましょう。プロフィール・投稿・会話はアカウントに残るので、機種を変えても引き継がれます。",
    ogDescription: "自分に合うパートナーを見つけ、コミュニティで練習し、会話はアカウントにそのまま残ります。",
    keywords: ["言語交換", "言語パートナー", "会話練習", "language exchange", "LingoLoop"],
  },
};
