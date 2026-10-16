/**
 * 웹: 브라우저에 들어 있는 음성 합성(speechSynthesis). 패키지가 필요 없습니다.
 * 언어를 알려 줘야 그 말의 목소리로 읽습니다(모르면 브라우저 기본 목소리).
 */
const BCP47: Record<string, string> = { ko: "ko-KR", en: "en-US", ja: "ja-JP", zh: "zh-CN", es: "es-ES", fr: "fr-FR", de: "de-DE" };

export const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

export function speak(text: string, language: string): void {
  if (!canSpeak || !text.trim()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  if (BCP47[language]) utterance.lang = BCP47[language];
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (canSpeak) window.speechSynthesis.cancel();
}
