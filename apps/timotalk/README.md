# TimoTalk 새 앱 (웹 · iOS · Android 공용)

지금 웹(`app/`)과 옛 앱(`mobile/`)을 대신할 새 앱입니다. 한 코드로 웹·iOS·Android 를 함께 만듭니다
(Expo SDK 54 · Expo Router · react-native-web). 완성되면 옛 웹·앱과 한 번에 바꿉니다.
기획과 디자인 시안은 재구축 기획안(A안 "맑은 초록")을 따릅니다.

## 지금 들어 있는 것

1단계
- 로그인: 웹은 Firebase 팝업, 앱은 기기 Google·Apple 로그인. 세션은 서버 httpOnly 쿠키가 맡습니다.
- 오늘: 오늘의 파트너(위의 3명, 맞는 이유, AI 가 고른 첫 인사와 번역), 인사 보내기, 내 차례
- 대화방: 12초마다 새 메시지만 받기(`?after=`), 번역·표현 저장, AI 코치, 교환 세션 타이머, 읽음
- 대화 목록, 나(화면 언어·로그아웃)
- 넓은 화면(900px 이상)에서는 왼쪽 메뉴, 휴대폰에서는 아래 탭. 밝은·어두운 모드.

2단계
- 처음 설정, 나 설정(프로필 편집·받는 메시지·차단 목록·계정 삭제), 받은 요청함, 대화방 메뉴(알림 끄기·나가기·신고·차단)
- 사진·음성 메시지, 더 찾아보기(검색·조건), 상대 프로필, 알림
- 대화에서 문장 고쳐 주기, 노트(받은 교정·저장한 표현)와 복습
- 커뮤니티: 글 목록(내가 고쳐 줄 수 있는 글을 맨 위에), 글쓰기(쓴 말·교정 부탁·공개 범위·사진),
  글 화면(문장 골라 고쳐 주기·댓글과 답글·좋아요·내 글 지우기·글 신고)
- 폰 알림(앱만): 새 메시지·요청·교정. 나 > 알림에서 켜고 끄고, 누르면 그 대화·글이 열립니다(아래 "폰 알림 설정")
- 신고 검토(운영자만): 나 > 운영 > 신고 검토. 처리 전·처리함으로 나눠 보고 조치함·문제없음과 메모를 남깁니다

## 구조

```
app/                 화면(Expo Router). (tabs)/ 안에 다섯 탭과 대화방(chat/[id], 숨은 탭)
src/theme/           디자인 토큰(A안 색·글자·간격)과 밝게/어둡게
src/ui/              공통 부품(Text·Button·Avatar·Card·메뉴·상태 표시·알림)
src/lib/             서버 호출(api.ts)·로그인 상태(session.tsx)·소셜 로그인(auth/)·언어(i18n.tsx)·시간·낱말
src/features/        기능별 데이터와 화면 조각(today·chat·chats·people·notes·community 등)
```

- 번역 사전은 웹·옛 앱과 같은 `app/lib/i18n` 을 씁니다(`@shared/...`). 화면 문구는 모두 `t("한국어 원문")` 이고,
  새 문구를 넣으면 저장소 루트에서 `npm run i18n` 으로 키를 갱신하고 `en.ts`·`ja.ts` 에 번역을 더합니다.
  `tests/i18n.test.mjs` 가 이 폴더의 화면 코드도 검사합니다(한국어를 `t()` 밖에 직접 쓰면 실패).
- 서버(`backend/`)와 데이터는 그대로 씁니다. 응답 모양은 `src/lib/types.ts` 에 적었습니다.

## 실행

```bash
cd apps/timotalk
npm install
npm run web        # http://localhost:8081
```

개발 중에는 Metro 가 `/api` 를 로컬 API 로 넘깁니다(`metro.config.js`). 기본값은 로컬 에뮬레이터 기준이고
환경 변수로 바꿉니다.

| 변수 | 기본값 | 뜻 |
|---|---|---|
| `TIMOTALK_DEV_API` | `http://127.0.0.1:8080` | API 주소 |
| `TIMOTALK_DEV_PROXY_SECRET` | `local-emulator-only` | API 의 `PROXY_SHARED_SECRET` |
| `TIMOTALK_DEV_API_ORIGIN` | `http://localhost:5174` | API 의 `APP_ORIGIN`(이 값으로 바꿔 넘깁니다) |

API 를 띄우는 방법은 루트 README 의 "로컬 개발"을 따릅니다. 위 기본값은 API 를 Firebase 에뮬레이터(auth·firestore)에
붙여 띄울 때의 값이고, 개발용 GCP 프로젝트에 붙인 API 라면 그 API 의 `PROXY_SHARED_SECRET` 를 넘겨 주세요.
앱(iOS·Android)은 `EXPO_PUBLIC_API_BASE` 로 API 를 넘겨받는 웹 주소를 정합니다(기본은 운영 웹 주소).

## 검사

```bash
npm run typecheck   # 타입
npm run export:web  # 운영용 웹 빌드(dist/)
npm run bundle      # iOS·Android 번들이 만들어지는지
```

린트와 번역 검사는 저장소 루트에서 돌립니다(`npm run lint`, `npm test`).

## 폰 알림 설정 (계정 소유자 작업)

코드는 들어 있지만, 아래를 마치기 전에는 앱의 "폰 알림"이 "이 버전의 앱에서는 아직 쓸 수 없어요"로 꺼져 있습니다.
알림은 Expo 푸시 서비스가 Apple·Google 로 넘겨 줍니다(서버: `backend/push.mjs`).

1. Expo 계정으로 EAS 프로젝트를 만듭니다: 이 폴더에서 `npx eas-cli init`. `app.json` 에 `extra.eas.projectId` 가 들어갑니다.
2. iOS: Apple 개발자 계정에서 푸시 키(APNs, .p8)를 만들어 `npx eas-cli credentials` 로 올립니다.
3. Android: Firebase 프로젝트에 Android 앱(`com.lingoloop.app`)을 더하고 `google-services.json` 을 받아
   `app.json` 의 `android.googleServicesFile` 로 지정합니다. FCM V1 서비스 계정 키를 `npx eas-cli credentials` 로 올립니다.
4. (선택) Expo 프로젝트에서 푸시 보안을 켰다면 서버에 `EXPO_ACCESS_TOKEN` 을 넣습니다.
5. 실제 기기용으로 다시 빌드합니다(시뮬레이터·Expo Go 에서는 푸시 토큰을 받을 수 없습니다).

로컬에서는 API 의 `EXPO_PUSH_URL` 을 가짜 서버로 돌려 무엇이 보내지는지 확인할 수 있습니다.
