import { t } from "@/lib/i18n";
import { ComingNext } from "@/ui/ComingNext";

export default function Community() {
  return (
    <ComingNext
      title={t("커뮤니티")}
      icon="community"
      lead={t("커뮤니티는 다음 단계에서 열려요")}
      points={[t("배우는 말로 짧은 글 쓰기"), t("원어민에게 교정 요청하고 받기"), t("받은 교정은 노트에 자동으로 모이기")]}
    />
  );
}
