/**
 * 번역 방향 정하기. 글자 모양으로 대략 어떤 말인지 봅니다.
 * 상대 말이 내 화면 언어와 다르면 화면 언어로, 같으면(상대가 내 말을 연습하는 중) 내가 배우는 말로 옮깁니다.
 */
export function guessLanguage(text: string): string {
  if (/[\u3040-\u30ff]/.test(text)) return "ja";
  if (/[\uac00-\ud7af\u1100-\u11ff]/.test(text)) return "ko";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  if (/[a-zA-Z]/.test(text)) return "en";
  return "";
}

export function translationTarget(text: string, screenLanguage: string, learningLanguage?: string): string {
  const source = guessLanguage(text);
  if (source && source === screenLanguage) return learningLanguage || (screenLanguage === "en" ? "ko" : "en");
  return screenLanguage;
}
