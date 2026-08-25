import LingoLoopApp from "./components/LingoLoopApp";

/**
 * 제목·설명은 layout 의 generateMetadata 가 만듭니다.
 * 여기서 따로 정하면 그 값이 layout 을 덮어써서 언제나 한 언어로 굳습니다.
 */
export default function Home() {
  return <LingoLoopApp />;
}
