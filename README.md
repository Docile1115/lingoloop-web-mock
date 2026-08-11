# LingoLoop

언어를 **공부하는 사람끼리 서로 가르치고 배우는 경험**을 웹에서 검증하기 위한 반응형 언어교환 mock입니다. HelloTalk의 공개된 공식 기능 설명에서 파트너 탐색, 대화 중 번역·교정, 커뮤니티 피드, 보이스룸/라이브 같은 제품 패턴을 조사한 뒤, 독립 브랜드 **LingoLoop**의 PC·모바일 경험으로 다시 설계했습니다.

> [!IMPORTANT]
> LingoLoop는 HelloTalk과 제휴·후원·승인 관계가 없는 독립적인 학습용 프로토타입입니다. HelloTalk의 상표, 로고, 화면, 문구, 소스 코드, 실제 사용자 데이터는 사용하지 않습니다. 이 저장소의 프로필·게시물·대화는 모두 가상 데이터입니다.

## 현재 범위

이 버전의 목표는 실제 서비스 구축 전 제품 구조와 핵심 상호작용을 빠르게 검증하는 것입니다. 프런트엔드와 mock 백엔드를 분리했으며, 별도 인프라나 외부 서비스 없이 로컬에서 실행할 수 있습니다.

- PC: 좌측 내비게이션, 중앙 작업 영역, 우측 학습 컨텍스트의 3열 레이아웃
- 모바일: `파트너 / 커뮤니티 / 연습 / 대화 / 내 학습` 중심의 5탭 레이아웃
- 반응형 SPA: 같은 도메인 상태와 API 계약을 공유하되 화면 크기에 맞춰 정보 밀도와 내비게이션을 변경
- mock backend: 메모리 기반 가상 데이터와 결정론적 번역·교정 응답을 독립 API로 제공
- 모바일 확장성: 이후 React Native 앱이 같은 API 계약과 도메인 모델을 재사용할 수 있도록 UI와 데이터 경계를 분리

HelloTalk의 공식 자료는 모바일 앱의 핵심 탭과 기능을 중심으로 설명합니다. 따라서 이 프로젝트의 PC 3열 화면은 해당 웹 화면을 복제한 것이 아니라, 같은 언어교환 과업을 데스크톱 정보 밀도에 맞춰 확장한 LingoLoop 고유 설계입니다.

## 구현 기능

| 영역 | 제공하는 mock 경험 |
| --- | --- |
| 온보딩 | 모국어, 학습 언어, 수준, 목표·관심사를 설정하는 첫 진입 흐름 |
| 파트너 | 추천 목록, 검색·언어·접속 상태 필터, 매칭 점수, 사용자 프로필, 대화 시작 |
| 커뮤니티 | 피드 탐색, 게시물 작성, 좋아요, 댓글 맥락, 번역, 원문 교정 제안 |
| 대화 | 1:1·그룹 대화 목록, 텍스트 전송, 보이스 메시지 UI, 번역·교정, 읽지 않은 메시지 상태 |
| 언어교환 | 교환 세션 예약, 언어별 턴 타이머, 통화 시작·종료 mock |
| 라이브 연습 | 보이스룸·라이브 탐색, 입장, 듣기 상태, 손들기·발언자 상태 mock |
| 학습 | 오늘의 목표, 연속 학습 기록, 저장한 표현, 받은 교정, 주간 활동 대시보드 |
| 계정 | 프로필, 학습 설정, 개인정보 노출 설정, 알림 설정 |
| 안전 | 사용자 신고·차단, DM 요청, 커뮤니티 안전 안내 mock |
| 탐색·수익화 | 통합 검색, 알림 센터, VIP 혜택 안내 및 가입 화면 mock |

번역, 교정, 음성, 통화, 라이브, VIP, 신고·차단은 사용자 흐름을 확인하기 위한 UI/API 시뮬레이션입니다. 실제 AI 번역, 음성 인식, WebRTC, 결제, 푸시 알림, 운영자 심사와 연결되어 있지 않습니다.

## 빠른 시작

### 요구 사항

- Node.js `>= 22.13.0`
- npm

### 설치 및 실행

```bash
npm install
npm run dev
```

기본 주소는 `http://localhost:5173`입니다. 같은 origin의 `/api/*` 요청이 mock backend로 라우팅되므로 별도 API 프로세스, 데이터베이스, 클라우드 계정은 필요하지 않습니다.

### 검증

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## npm scripts

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 프런트엔드와 로컬 mock API 개발 서버 실행 |
| `npm run build` | 배포 가능한 프로덕션 번들 생성 |
| `npm run typecheck` | TypeScript 정적 타입 검사 |
| `npm run lint` | ESLint 규칙 검사 |
| `npm test` | 렌더링 및 핵심 mock 동작 테스트 |

## Mock API

mock backend는 프런트엔드와 독립된 네트워크 계약을 제공합니다. 현재 화면은 즉시 실행되고 API 장애 중에도 탐색할 수 있도록 `app/lib/demo-data.ts`의 UI fixture로 먼저 렌더링하며, 시작 시 주요 조회 endpoint의 상태를 확인하고 메시지·신고 같은 동작에서 API를 호출합니다. API 응답은 `{ data, meta }` 또는 `{ error, meta }` 형태의 JSON이며, 같은 origin으로 실행하되 CORS preflight를 위한 `OPTIONS` 요청도 처리합니다.

| Method | Endpoint | 용도 |
| --- | --- | --- |
| `GET` | `/api/health` | mock 서버 상태 확인 |
| `GET` | `/api/bootstrap` | 현재 사용자, 알림, 요약 지표 등 초기 화면 데이터 |
| `GET` | `/api/partners` | 추천 파트너 목록과 검색·필터 결과 |
| `GET` | `/api/posts` | 커뮤니티 게시물 목록 |
| `GET` | `/api/conversations` | 1:1·그룹 대화 목록 |
| `GET` | `/api/conversations/:id` | 특정 대화와 메시지 조회 |
| `GET` | `/api/conversations/:id/messages` | 특정 대화의 메시지만 조회 |
| `GET` | `/api/corrections` | 게시물·메시지 교정 내역 |
| `GET` | `/api/rooms` | 보이스룸·라이브 연습 목록 |
| `GET` | `/api/notifications` | 알림 목록 |
| `GET` | `/api/profile` | 현재 mock 사용자 프로필 |
| `GET` | `/api/languages` | 지원 언어 fixture 목록 |
| `GET` | `/api/search?q=...` | 파트너·게시물 통합 검색 |
| `POST` | `/api/messages` | 텍스트·보이스 메시지 전송 결과 생성 |
| `POST` | `/api/translate` | 입력 문장의 가상 번역 결과 생성 |
| `POST` | `/api/corrections` | 문장 교정 제안 결과 생성 |
| `POST` | `/api/reports` | 사용자 또는 콘텐츠 신고 접수 mock |
| `OPTIONS` | `/api/*` | 로컬 프런트엔드용 CORS preflight |

목록 endpoint는 `cursor`, `limit` query를 받으며 `limit`은 최대 50입니다. 주요 필터는 다음과 같습니다.

- 파트너: `q`, `nativeLanguage`, `learningLanguage`, `status`
- 게시물: `language`, `authorId`, `tag`
- 대화: `unread=true`
- 교정: `sourceId`, `sourceType`

쓰기 endpoint는 입력을 검증하고 성공 응답을 만들지만 영속 저장하지 않습니다.

## 시스템 구성도

```mermaid
flowchart LR
    subgraph Clients["사용자 화면"]
        PC["PC · 3열 UI"]
        Mobile["모바일 · 5탭 UI"]
    end

    subgraph Frontend["React Frontend · app/"]
        Shell["Responsive App Shell"]
        Features["파트너 · 피드 · 대화 · 연습 · 학습"]
        State["UI State & API Client"]
        Fallback[("UI Demo Fixtures")]
        Shell --> Features --> State
        Fallback -->|"초기 화면 · fallback"| State
    end

    subgraph MockBackend["Mock Backend · mock-api/ · same-origin /api/*"]
        Router["HTTP Router + CORS"]
        Services["매칭 · 번역 · 교정 · 신고 mock"]
        Memory[("In-memory Fixtures")]
        Router --> Services --> Memory
    end

    PC --> Shell
    Mobile --> Shell
    State -->|"JSON / HTTP"| Router

    RN["향후 React Native 앱"] -.->|"같은 API 계약"| Router
    State -.->|"mock 교체 후 같은 계약"| Real["향후 실서비스 Backend"]
```

목표 경계는 `React UI → API client → HTTP mock API`입니다. 현재는 제품 데모의 복원력을 위해 프런트엔드 fixture와 서버 fixture를 함께 두고 API 연결 상태를 표시합니다. 다음 단계에서 조회 결과로 화면 상태를 hydrate하고 공유 schema를 도입하면, mock 서버를 실서비스 API로 바꾸거나 React Native 클라이언트를 추가할 때 UI 변경 범위를 줄일 수 있습니다.

## 사용자 흐름

```mermaid
flowchart TD
    Start["LingoLoop 시작"] --> Onboarding["언어 · 수준 · 목표 온보딩"]
    Onboarding --> Home{"무엇을 연습할까요?"}

    Home --> Partners["파트너 추천 · 필터"]
    Partners --> Profile["파트너 프로필"]
    Profile --> Conversation["1:1 대화 시작"]

    Home --> Community["커뮤니티 피드"]
    Community --> Post["게시 · 좋아요 · 댓글"]
    Post --> Correction["번역 · 문장 교정"]
    Correction --> Saved["표현 저장"]

    Home --> Practice["보이스룸 · 라이브"]
    Practice --> Room["입장 · 듣기 · 손들기"]
    Room --> Conversation

    Home --> Chats["1:1 · 그룹 대화"]
    Chats --> Conversation
    Conversation --> Tools["번역 · 교정 · 보이스 메시지"]
    Conversation --> Session["교환 세션 예약 · 턴 타이머 · 통화 mock"]

    Home --> Learning["내 학습 대시보드"]
    Saved --> Learning
    Tools --> Learning

    Profile --> Safety["신고 · 차단"]
    Post --> Safety
    Conversation --> Safety
```

## 기술 스택

| 구분 | 기술 |
| --- | --- |
| UI | React 19, React DOM, TypeScript |
| 앱 프레임워크 | vinext 기반 App Router, Vite |
| 스타일 | 반응형 CSS, 모바일·데스크톱 전용 레이아웃 |
| Mock backend | Worker-compatible Fetch API router, JSON, 메모리 fixture |
| 배포 어댑터 | Cloudflare Worker 엔트리포인트(현재 인프라 구성은 범위 밖) |
| 품질 | ESLint, TypeScript, Node test runner |
| 향후 데이터 계층 | 현재 없음. 실서비스 단계에서 제품 요구에 맞춰 선택 |

## 프런트엔드와 mock 백엔드의 분리

| 관심사 | Frontend | Mock backend |
| --- | --- | --- |
| 책임 | 반응형 렌더링, 내비게이션, 상호작용, UI fixture·로컬 상태, API 상태 확인 | 데이터 조회 계약, 입력 검증, 번역·교정·신고 규칙 시뮬레이션 |
| 위치 | `app/`, `public/` | `mock-api/` |
| 통신 | API client가 같은 origin의 `/api/*`로 JSON 요청 | Worker가 API 요청을 분기하고 JSON 응답 |
| 교체 전략 | React Native에서도 도메인/API 타입 재사용 | 실제 인증·DB·AI·실시간 서버로 대체 |

현재는 제품 mock이므로 저장소·인증·실시간 채널이 단순하고, 일부 UI 동작은 로컬 상태만 갱신합니다. 별도의 API 경계를 함께 제공하므로 다음 단계에서 OpenAPI 또는 공유 TypeScript schema로 계약을 고정하고 화면 데이터를 서버 응답으로 단계적으로 전환할 수 있습니다.

## 폴더 구조

```text
matchOP/
├── app/
│   ├── components/          # 화면·기능별 React 컴포넌트
│   ├── lib/                 # 프런트엔드용 타입과 즉시 렌더링용 데모 데이터
│   ├── globals.css          # 디자인 토큰과 반응형 스타일
│   ├── layout.tsx           # 문서 셸과 메타데이터
│   └── page.tsx             # LingoLoop SPA 진입점
├── mock-api/
│   ├── data.ts              # 사용자·피드·대화·룸 fixture와 타입
│   └── router.ts            # 검증, CORS, pagination, JSON API router
├── public/                  # 정적 이미지·아이콘 자산
├── tests/                   # 렌더링 및 동작 검증
├── worker/
│   └── index.ts             # vinext/Cloudflare Worker 엔트리포인트
├── .openai/hosting.json     # 현재 비어 있는 선택적 호스팅 바인딩 선언
├── package.json             # 실행·검증 scripts와 의존성
├── vite.config.ts           # vinext/Vite 로컬 개발 구성
└── README.md
```

## Mock의 한계

- 계정 생성·로그인·세션 검증은 실제 인증이 아닙니다.
- 프로필, 게시물, 대화, 알림은 가상 데이터이며 쓰기 요청 결과는 영속 저장되지 않습니다.
- 초기 목록은 프런트엔드 fixture로 렌더링됩니다. 모든 조회 endpoint 결과가 화면 상태를 직접 hydrate하는 단계는 아직 아닙니다.
- 번역·교정 결과는 데모 규칙 또는 준비된 응답이며 AI 품질을 나타내지 않습니다.
- 보이스 메시지, 음성·영상 통화, 보이스룸, 라이브는 미디어 UI 상태만 흉내 냅니다. 녹음, 스트리밍, WebRTC, STT/TTS는 없습니다.
- VIP는 상품 구조를 보여주는 mock이며 결제·구독·환불 처리가 없습니다.
- 신고·차단은 운영자 큐, 자동 모더레이션, 법적 보존 정책과 연결되지 않습니다.
- 오프라인 동기화, 푸시 알림, 파일 업로드, 다중 기기 동기화, 실시간 presence는 구현 범위 밖입니다.
- 프로덕션 수준의 보안, 개인정보 동의, 연령 분리, 접근성·국제화 검증을 완료한 서비스가 아닙니다.

## React Native 및 실서비스 전환 로드맵

1. **API 계약 고정 및 완전 연결**  
   OpenAPI 또는 공유 TypeScript schema로 요청·응답과 오류 형식을 명시하고, 모든 화면을 API 조회 결과로 hydrate한 뒤 mock contract test를 추가합니다.
2. **공유 도메인 계층 추출**  
   사용자, 언어, 게시물, 대화, 교정, 룸 모델과 API client를 UI에서 분리해 웹·React Native가 함께 사용합니다.
3. **React Native 클라이언트**  
   모바일 5탭 구조를 네이티브 내비게이션으로 옮기고 카메라, 마이크, 알림, 딥링크 권한 흐름을 구현합니다.
4. **실서비스 백엔드**  
   인증, 관계형 DB, 객체 저장소, 검색, WebSocket presence·메시징, 작업 큐와 캐시를 mock API 뒤에 단계적으로 연결합니다.
5. **언어 학습·미디어 서비스**  
   번역·교정 모델, STT/TTS, WebRTC 통화·보이스룸, 콘텐츠 업로드와 처리 파이프라인을 도입합니다.
6. **Trust & Safety**  
   연령·지역별 정책, 신고 심사, 차단 강제, 스팸 방지, rate limit, 감사 로그, 개인정보 삭제·보존 절차를 구축합니다.
7. **운영 준비**  
   결제·구독, 관측성, 백업, CI/CD, 부하·보안·접근성 테스트, 다국어 번역 운영을 완료한 뒤 점진적으로 출시합니다.

인프라 선택은 이 mock 단계의 의도적인 범위 밖입니다. API 계약과 기능 경계가 안정된 뒤 사용량, 지역, 개인정보 요구 사항을 기준으로 결정합니다.

## HelloTalk 공식 자료 조사

아래 자료는 2026-08-11에 확인했습니다. 기능의 존재와 일반적인 사용자 패턴을 이해하기 위한 참고 자료이며, LingoLoop의 명칭·UI·구현은 독립적으로 제작했습니다.

- [About HelloTalk](https://www.hellotalk.com/en/about): 네이티브 화자와의 실제 대화, 문화 교류, 교정, 라이브 학습이라는 서비스 방향
- [HelloTalk 기능 개요](https://www.hellotalk.com/en/features): 채팅, 파트너 매칭, 커뮤니티 피드, 보이스룸, 라이브, 번역의 전체 기능군
- [Navigating HelloTalk](https://creators.hellotalk.com/article/navigating-hellotalk): Chats, Moments, Connect, Live, Me로 이어지는 공식 앱 탐색 구조
- [Chat & Messaging](https://www.hellotalk.com/en/features/chat): 텍스트·음성·영상 대화와 번역·교정·전사 학습 도구
- [Language Exchange Partners](https://www.hellotalk.com/en/features/language-exchange): 학습 목표, 관심사, 시간대, 언어 수준을 고려한 파트너 발견 패턴
- [What is Language Exchange?](https://www.hellotalk.com/en/faq/chats-learning-features/293): 두 언어를 번갈아 연습하는 예약형 교환 통화 패턴
- [What are Voicerooms?](https://www.hellotalk.com/en/faq/live-and-voiceroom/403): 여러 학습자가 실시간으로 듣기·말하기를 연습하는 오디오 이벤트
- [Translation](https://www.hellotalk.com/en/features/translation): 대화 맥락 안의 텍스트·음성·이미지 번역과 학습 보조 패턴
- [Community Guidelines](https://www.hellotalk.com/community-guidelines): 상호 존중, 도움, 신고·차단과 운영 안전의 중요성

## 라이선스·브랜드 안내

이 프로토타입을 공개하거나 상용화하기 전에는 저장소 라이선스, 개인정보 처리방침, 이용약관, 커뮤니티 정책을 별도로 확정해야 합니다. **HelloTalk**은 해당 권리자의 상표이며, **LingoLoop**는 이 mock에서 사용하는 독립적인 프로젝트명입니다.
