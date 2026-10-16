import { t } from "@/lib/i18n";
import { ComingNext } from "@/ui/ComingNext";

export default function Notes() {
  return (
    <ComingNext
      title={t("노트")}
      icon="notes"
      lead={t("노트는 다음 단계에서 열려요")}
      points={[t("대화와 글에서 받은 교정 모아 보기"), t("대화방에서 저장한 표현 모아 보기"), t("틀렸던 문장을 다시 써 보는 복습 카드")]}
    />
  );
}
