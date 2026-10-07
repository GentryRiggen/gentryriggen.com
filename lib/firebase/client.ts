import type { FirebaseApp } from "firebase/app";
import type { PageviewDoc } from "@/lib/analytics/types";
import { firebaseConfig } from "./config";

/** Only used by /admin; public pages talk to Firestore over REST instead. */

export interface AuthUser {
  email: string | null;
  emailVerified: boolean;
}

export const MAX_DOCS = 20_000;

let appPromise: Promise<FirebaseApp> | null = null;

function getApp(): Promise<FirebaseApp> {
  appPromise ??= import("firebase/app").then(
    ({ getApps, initializeApp }) =>
      getApps()[0] ?? initializeApp(firebaseConfig)
  );
  return appPromise;
}

async function authModule() {
  const [app, mod] = await Promise.all([getApp(), import("firebase/auth")]);
  return { mod, auth: mod.getAuth(app) };
}

/** Subscribes to auth changes; resolves to the unsubscribe function. */
export async function watchAuth(
  onChange: (user: AuthUser | null) => void
): Promise<() => void> {
  const { mod, auth } = await authModule();
  return mod.onAuthStateChanged(auth, (user) =>
    onChange(
      user ? { email: user.email, emailVerified: user.emailVerified } : null
    )
  );
}

export async function signInWithGoogle(): Promise<void> {
  const { mod, auth } = await authModule();
  const provider = new mod.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await mod.signInWithPopup(auth, provider);
}

export async function signOutUser(): Promise<void> {
  const { mod, auth } = await authModule();
  await mod.signOut(auth);
}

export interface PageviewsResult {
  docs: PageviewDoc[];
  /** True when the fetch hit MAX_DOCS, so the oldest views are missing. */
  truncated: boolean;
}

export async function fetchPageviews(
  sinceMs: number,
  max: number = MAX_DOCS
): Promise<PageviewsResult> {
  const [app, fs] = await Promise.all([getApp(), import("firebase/firestore")]);
  const db = fs.getFirestore(app);
  const snapshot = await fs.getDocs(
    fs.query(
      fs.collection(db, "pageviews"),
      fs.where("ts", ">=", fs.Timestamp.fromMillis(sinceMs)),
      fs.orderBy("ts", "desc"),
      fs.limit(max)
    )
  );
  const docs = snapshot.docs.map((d) => {
    const data = d.data();
    return {
      site: data.site,
      path: data.path,
      ref: data.ref,
      device: data.device,
      browser: data.browser,
      os: data.os,
      screen: data.screen,
      tz: data.tz,
      vid: data.vid,
      ts: data.ts.toDate(),
    } as PageviewDoc;
  });
  return { docs, truncated: snapshot.size >= max };
}
