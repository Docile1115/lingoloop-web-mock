# TimoTalk 새 앱 (웹 · iOS · Android 공용)

지금 웹(`app/`)과 옛 앱(`mobile/`)을 대신할 새 앱입니다. 한 코드로 웹·iOS·Android 를 함께 만듭니다
(Expo SDK 54 · Expo Router · react-native-web). 완성되면 옛 웹·앱과 한 번에 바꿉니다.
기획과 디자인 시안은 재구축 기획안(A안 "맑은 초록")을 따릅니다.

## 지금 들어 있는 것 (1단계)

- 로그인: 웹은 Firebase 팝업, 앱은 기기 Google·Apple 로그인. 세션은 서버 httpOnly 쿠키가 맡습니다.
- 오늘: 오늘의 파트너(위의 3명, 맞는 이유, AI 가 고른 첫 인사와 번역), 인사 보내기, 내 차례
- 대화방: 12초마다 새 메시지만 받기(`?after=`), 번역·표현 저장, AI 코치, 교환 세션 타이머, 읽음
- 대화 목록, 나(화면 언어·로그아웃). 커뮤니티·노트는 2단계에서 엽니다(지금은 안내 화면).
- 넓은 화면(900px 이상)에서는 왼쪽 메뉴, 휴대폰에서는 아래 탭. 밝은·어두운 모드.

## 구조

```
app/                 화면(Expo Router). (tabs)/ 안에 다섯 탭과 대화방(chat/[id], 숨은 탭)
src/theme/           디자인 토큰(A안 색·글자·간격)과 밝게/어둡게
src/ui/              공통 부품(Text·Button·Avatar·Card·메뉴·상태 표시·알림)
src/lib/             서버 호출(api.ts)·로그인 상태(session.tsx)·소셜 로그인(auth/)·언어(i18n.tsx)·시간·낱말
src/features/        기능별 데이터와 화면 조각(today·chat·chats)
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
