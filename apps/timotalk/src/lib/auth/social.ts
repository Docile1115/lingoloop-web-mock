/**
 * 소셜 로그인 — 화면이 가져다 쓰는 이름.
 *
 * 실제 로그인은 플랫폼마다 다릅니다. Metro 가 웹에서는 social.web.ts, 앱에서는 social.native.ts 를
 * 고르므로 이 파일은 실행되지 않습니다. 타입 검사(tsc)는 이 파일을 보므로 웹 구현의 모양을 그대로
 * 내보냅니다. 앱 구현(social.native.ts)도 같은 이름과 모양을 지킵니다.
 */
export { availableProviders, loadAuthConfig, SignInError, signInWith, type AuthConfig, type Provider } from "./social.web";
