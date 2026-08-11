import type { Metadata } from "next";
import LingoLoopApp from "./components/LingoLoopApp";

export const metadata: Metadata = {
  title: "LingoLoop — 함께 말하고, 함께 배우는 언어 교환",
  description:
    "파트너 매칭, 커뮤니티 교정, 학습형 채팅과 음성 라운지를 경험하는 반응형 언어 교환 서비스 데모입니다.",
};

export default function Home() {
  return <LingoLoopApp />;
}
