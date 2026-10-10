"use client";

import { useEffect, useRef, useState } from "react";
import { Languages, X } from "lucide-react";
import { t } from "../lib/i18n";

export type ExchangeSession = { conversationId: string; length: number; startedAt: number };

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * 언어 교환 턴 타이머. 앞 절반은 내가 배우는 말, 뒤 절반은 상대가 배우는 말(내 모국어)로
 * 이야기합니다. 이 기기에서만 재는 시계라 상대 화면에는 나오지 않습니다.
 *
 * 예전 자리에는 "영어 8분 · 한국어 7분" 이 모든 대화방에 똑같이 박혀 있었습니다 —
 * 실제로 잰 값이 아니었습니다.
 */
export function ExchangeSessionBar({
  session,
  firstLanguage,
  secondLanguage,
  onEnd,
  onToast,
}: {
  session: ExchangeSession;
  firstLanguage: string;
  secondLanguage: string;
  onEnd: () => void;
  onToast: (message: string) => void;
}) {
  const total = session.length * 60;
  const [now, setNow] = useState(() => Date.now());
  const announced = useRef({ half: false, end: false });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const elapsed = Math.min(total, Math.max(0, Math.floor((now - session.startedAt) / 1000)));
  const half = total / 2;
  const secondHalf = elapsed >= half;
  const language = secondHalf ? secondLanguage : firstLanguage;
  const remaining = total - elapsed;

  useEffect(() => {
    if (secondHalf && !announced.current.half && elapsed < total) {
      announced.current.half = true;
      onToast(t("이제 {language} 차례예요", { language: secondLanguage }));
    }
    if (elapsed >= total && !announced.current.end) {
      announced.current.end = true;
      onToast(t("교환 세션을 마쳤어요. 수고했어요!"));
      onEnd();
    }
  }, [elapsed, total, secondHalf, secondLanguage, onEnd, onToast]);

  return (
    <div className="exchange-banner exchange-session" role="timer" aria-live="off">
      <span className="exchange-banner-icon"><Languages size={18} /></span>
      <span>
        <strong>{t("{language} 차례", { language })}</strong>
        <small>{t("{time} 남음", { time: clock(remaining) })}</small>
      </span>
      <div className="balance-bar" aria-hidden="true"><i style={{ width: `${(elapsed / total) * 100}%` }} /></div>
      <button type="button" onClick={onEnd} aria-label={t("교환 세션 끝내기")}>
        {t("끝내기")} <X size={15} />
      </button>
    </div>
  );
}
