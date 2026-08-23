import type { Metadata } from "next";
import ProductionLingoLoopApp from "./components/ProductionLingoLoopApp";

export const metadata: Metadata = {
  title: "LingoLoop — 함께 말하고, 함께 배우는 언어 교환",
  description:
    "Firebase Identity Platform 인증과 Firestore 영구 저장으로 파트너 매칭, 커뮤니티와 대화를 이어가는 언어 교환 서비스입니다.",
};

export default function Home() {
  return <ProductionLingoLoopApp />;
}
