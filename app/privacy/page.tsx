import type { Metadata } from "next";
import { LegalPage } from "../components/LegalPage";
import styles from "../components/LegalPage.module.css";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description: "TimoTalk이 개인정보와 대화 데이터를 처리하는 방식입니다.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      current="privacy"
      title="개인정보 처리방침"
      summary="TimoTalk은 언어 교환에 필요한 정보만 사용하고, 대화와 계정 데이터를 안전하게 보관하기 위해 Google Cloud 기반 서비스를 이용합니다."
    >
      <section>
        <h2>1. 적용 범위</h2>
        <p>
          이 방침은 TimoTalk 웹 서비스와 향후 같은 계정으로 연결되는 모바일 앱에 적용됩니다.
          TimoTalk은 언어 교환 파트너 매칭, 커뮤니티, 대화, 보이스룸 및 선택적 AI 학습 도움을 제공합니다.
        </p>
        <p className={styles.note}>
          현재 TimoTalk에는 유료 결제 기능이 없으며 카드번호나 결제수단 정보를 수집하지 않습니다.
        </p>
      </section>

      <section>
        <h2>2. 처리하는 정보</h2>
        <h3>계정과 프로필</h3>
        <ul>
          <li>이메일 주소, 계정 식별자, 표시 이름 및 선택한 프로필 사진</li>
          <li>모국어·학습 언어, 학습 목표, 관심사, 선호 시간대와 매칭 조건</li>
          <li>사용자가 직접 입력한 국가·지역, 자기소개 및 기타 공개 프로필 정보</li>
        </ul>
        <h3>서비스 활동</h3>
        <ul>
          <li>게시물, 댓글, 반응, 팔로우 관계와 1:1 대화 내용</li>
          <li>보이스룸 제목·주제·참여 상태 등 운영 정보(현재 음성 녹음 파일은 저장하지 않음)</li>
          <li>차단, 신고, 메시지 요청 및 안전 기능 이용 기록</li>
        </ul>
        <h3>기술 정보</h3>
        <ul>
          <li>접속 시각, 요청 기록, 오류와 보안 이벤트 등 서비스 운영에 필요한 로그</li>
          <li>브라우저 언어와 화면 설정처럼 서비스 제공에 필요한 기기 환경 정보</li>
        </ul>
      </section>

      <section>
        <h2>3. 이용 목적</h2>
        <ul>
          <li>계정 생성·인증과 기기 변경 후 대화 복원</li>
          <li>설정한 조건에 맞는 언어 교환 파트너 추천</li>
          <li>게시물, 대화, 보이스룸 등 핵심 기능 제공</li>
          <li>스팸·사기·괴롭힘 대응, 신고 검토와 계정 보호</li>
          <li>오류 분석, 서비스 안정성 개선과 고객 문의 대응</li>
        </ul>
      </section>

      <section>
        <h2>4. Google·Apple 로그인과 처리 위탁</h2>
        <p>
          Google 또는 Apple 로그인을 선택하면 해당 공급자로부터 계정 식별자, 이메일 주소, 표시 이름과 기본 프로필 정보를 받을 수 있습니다.
          Apple의 이메일 가리기 기능을 사용하면 실제 이메일 대신 Apple이 만든 전달용 주소를 받을 수 있습니다.
          Google·Apple 계정 비밀번호는 TimoTalk이 받거나 저장하지 않습니다.
        </p>
        <p>
          계정 인증은 Google Cloud Identity Platform, 서비스 데이터는 Firestore, 애플리케이션 실행은 Cloud Run을 사용합니다.
          이러한 공급자는 TimoTalk을 대신해 데이터를 처리하며 각 서비스의 보안·개인정보 보호 조건을 적용받습니다.
        </p>
      </section>

      <section>
        <h2>5. 번역과 AI 도움</h2>
        <p>
          번역, 대화 주제 추천 또는 표현 도움을 직접 요청한 경우에만 해당 입력을 Google Vertex AI의 Gemini 모델로 처리할 수 있습니다.
          AI 요청·응답 원문을 별도 분석 컬렉션에 보관하지 않으며 일일 사용량만 기록합니다.
          다만 사용자가 실제로 전송한 대화 메시지는 대화 기록의 일부로 Firestore에 저장됩니다.
        </p>
        <p>AI 기능에는 개인정보, 금융정보, 인증번호 등 민감한 정보를 입력하지 않는 것이 좋습니다.</p>
      </section>

      <section>
        <h2>6. 보관과 삭제</h2>
        <p>
          계정과 서비스 데이터는 계정이 유지되는 동안 보관됩니다. 화면에서 삭제할 수 있는 콘텐츠는 해당 기능을 통해 삭제할 수 있고,
          계정 또는 전체 데이터 삭제는 아래 이메일로 요청할 수 있습니다. 요청 처리와 백업 반영에는 최대 30일이 걸릴 수 있습니다.
        </p>
        <p>
          신고, 사기 방지, 보안 사고 또는 법적 의무 대응에 필요한 최소 기록은 목적 달성에 필요한 기간 동안 제한적으로 더 보관할 수 있습니다.
          베타 운영 과정에서 항목별 보존 기간이 구체화되면 이 방침에 반영합니다.
        </p>
      </section>

      <section>
        <h2>7. 이용자의 선택과 권리</h2>
        <ul>
          <li>프로필 정보를 확인하고 수정할 수 있습니다.</li>
          <li>제공되는 기능을 통해 게시물이나 관계 정보를 관리할 수 있습니다.</li>
          <li>AI 기능을 사용하지 않아도 기본 언어 교환 기능을 이용할 수 있습니다.</li>
          <li>개인정보 열람·정정·삭제, 계정 삭제 또는 처리 관련 문의를 요청할 수 있습니다.</li>
        </ul>
      </section>

      <section>
        <h2>8. 안전과 미성년자 보호</h2>
        <p>
          법정 동의 연령 미만인 이용자는 보호자의 동의가 필요한 경우 그 동의를 받아야 합니다.
          TimoTalk은 신고와 차단 기능을 제공하며, 안전을 위협하는 계정이나 콘텐츠를 제한할 수 있습니다.
        </p>
      </section>

      <section>
        <h2>9. 문의와 변경 안내</h2>
        <p>
          개인정보 또는 데이터 삭제 요청은 <a href="mailto:dvdsang2@gmail.com">dvdsang2@gmail.com</a>으로 보내 주세요.
          중요한 변경이 있을 때에는 시행 전에 서비스 화면이나 적절한 방법으로 알립니다.
        </p>
      </section>
    </LegalPage>
  );
}
