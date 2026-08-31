"use client";

import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  OAuthProvider,
  setPersistence,
  signInWithPopup,
  signOut,
} from "firebase/auth";

export type SocialProvider = "google" | "apple";
export type SocialAuthFailure =
  | "provider-disabled"
  | "popup-closed"
  | "popup-blocked"
  | "account-exists"
  | "unauthorized-domain";

export class SocialAuthError extends Error {
  constructor(readonly reason: SocialAuthFailure) {
    super(reason);
    this.name = "SocialAuthError";
  }
}

export type SocialAuthConfig = {
  firebase: Pick<FirebaseOptions, "apiKey" | "authDomain" | "projectId">;
  providers: Record<SocialProvider, boolean>;
};

const FIREBASE_APP_NAME = "lingoloop-browser-auth";

function providerFor(provider: SocialProvider) {
  if (provider === "google") {
    const google = new GoogleAuthProvider();
    google.setCustomParameters({ prompt: "select_account" });
    return google;
  }

  const apple = new OAuthProvider("apple.com");
  apple.addScope("email");
  apple.addScope("name");
  return apple;
}

export async function getSocialIdToken(config: SocialAuthConfig, provider: SocialProvider) {
  if (!config.providers[provider]) {
    throw new SocialAuthError("provider-disabled");
  }

  const firebaseApp = getApps().some((app) => app.name === FIREBASE_APP_NAME)
    ? getApp(FIREBASE_APP_NAME)
    : initializeApp(config.firebase, FIREBASE_APP_NAME);
  const auth = getAuth(firebaseApp);
  await setPersistence(auth, inMemoryPersistence);

  try {
    const credential = await signInWithPopup(auth, providerFor(provider));
    return await credential.user.getIdToken();
  } catch (caught) {
    const code = typeof caught === "object" && caught && "code" in caught ? String(caught.code) : "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      throw new SocialAuthError("popup-closed");
    }
    if (code === "auth/popup-blocked") {
      throw new SocialAuthError("popup-blocked");
    }
    if (code === "auth/account-exists-with-different-credential") {
      throw new SocialAuthError("account-exists");
    }
    if (code === "auth/unauthorized-domain") {
      throw new SocialAuthError("unauthorized-domain");
    }
    if (code === "auth/operation-not-allowed") {
      throw new SocialAuthError("provider-disabled");
    }
    throw caught;
  } finally {
    await signOut(auth).catch(() => undefined);
  }
}
