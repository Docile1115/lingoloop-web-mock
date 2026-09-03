# TimoTalk 앱 (React Native / Expo)

웹은 데스크톱 전용이고, 폰은 이 앱이 맡습니다.

## 돌려보기

```bash
cd mobile
npm install
npx expo run:android
```

기본값은 운영 서버를 봅니다. 네이티브 Google Sign-In 모듈 때문에 Expo Go가 아닌
개발 빌드 또는 스토어 빌드가 필요합니다. iOS는 macOS에서 `npx expo run:ios`로
검증합니다.

로컬 서버를 보려면 `.env.example` 을 읽고 `.env` 를 만드세요.

## 웹과 무엇을 나눠 쓰나

`@shared/*` 는 저장소 루트의 `app/lib/` 을 가리킵니다 (metro.config.js).

| 공유 | 왜 |
|---|---|
| `i18n/core.ts` · `en.ts` · `ja.ts` · `keys.ts` | 873개 문구를 한 벌로. **현재 언어 저장소도 같은 모듈**이라 앱에서 언어를 바꾸면 어댑터가 내는 문구도 함께 바뀝니다 |
| `live-data.ts` | 서버 응답 → 화면 모양. 시차·언어 이름·단계 이름 규칙이 두 화면에서 어긋나지 않게 |
| `demo-data.ts` 의 타입 | 타입만 씁니다(`import type`). 픽스처 데이터는 번들에 들어가지 않습니다 |

화면 코드는 나눠 쓰지 않습니다. 데스크톱 3단 레이아웃과 폰 한 화면 쌓기를
한 컴포넌트로 만들면 양쪽 다 나빠집니다.

문구를 새로 쓰면 저장소 루트에서 `npm run i18n` 을 돌리세요 — 스캐너가
`mobile/src` 도 함께 훑습니다.

## 소셜 로그인과 세션

- iOS에는 Apple 로그인만, Android에는 Google 로그인만 표시합니다. 이메일/비밀번호
  로그인과 회원가입은 없습니다.
- 공급자 ID token을 Firebase Authentication에 넘겨 Firebase ID token을 받은 뒤
  웹과 동일하게 `POST /api/auth/session`에서 httpOnly 서버 세션으로 교환합니다.
- 로그인 직후 Firebase 인증 상태를 지우고, 이후에는 네이티브 쿠키 저장소의 서버
  세션만 사용합니다. 어느 API에서든 401이 오면 로그인 화면으로 돌아갑니다.

### 출시 전 인증 설정

1. Apple Developer에서 `com.lingoloop.app`의 Sign in with Apple capability를 켜고,
   Firebase/Identity Platform의 Apple 공급자에 같은 bundle ID와 Apple 자격정보를
   등록합니다. `usesAppleSignIn`과 Expo config plugin은 이미 설정되어 있습니다.
2. GCP/Firebase에 Android OAuth client를 만들고 package `com.lingoloop.app` 및 개발,
   업로드, Play App Signing 인증서의 SHA-1을 모두 등록합니다. Firebase 프로젝트와
   같은 GCP 프로젝트에 "웹 애플리케이션" OAuth client도 있어야 합니다.
3. 운영 API의 `/api/auth/config.googleWebClientId`에 **웹 client ID**를 설정합니다.
   앱은 이 값을 우선 사용하므로 빌드 환경 변수 없이도 로그인할 수 있습니다. 로컬
   API가 값을 제공하지 않을 때만 `.env.example`의
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`를 fallback으로 지정합니다. 둘 다 Android
   client ID가 아닌 웹 client ID여야 하며, client secret은 앱에 넣으면 안 됩니다.
4. 백엔드 `/api/auth/config`에서 해당 플랫폼 공급자가 활성화되어 있어야 합니다.

Android의 Google 네이티브 모듈은 React Native autolinking으로 포함됩니다. iOS에서는
Google 로그인을 사용하지 않으므로 Google URL scheme이나 GoogleService-Info.plist를
등록하지 않습니다.

## 운영 시 참고

- **세션 14일.** 서버의 최근 로그인 보안 제한 때문에 만료된 세션을 오래된 refresh
  token으로 자동 재발급하지 않습니다. 쿠키가 만료되거나 사라지면 안전하게 다시
  소셜 로그인을 요청합니다.
- **푸시 알림 없음.** DM 이 와도 모릅니다.
