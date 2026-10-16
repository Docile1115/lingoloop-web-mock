/**
 * 글자 모양으로 대략 어떤 말인지 봅니다(가나 → 일본어, 한글 → 한국어, 한자만 → 중국어, 로마자 → 영어).
 * 번역 방향과 웹 글꼴 고르기에 씁니다. 정확한 언어 판별이 아니라 글자 종류 보기입니다.
 */
export function guessLanguage(text: string): string {
  if (/[\u3040-\u30ff]/.test(text)) return "ja";
  if (/[\uac00-\ud7af\u1100-\u11ff]/.test(text)) return "ko";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  if (/[a-zA-Z]/.test(text)) return "en";
  return "";
}
