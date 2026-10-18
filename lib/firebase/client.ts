import type { FirebaseApp } from "firebase/app";
import type { PageviewDoc } from "@/lib/analytics/types";
import { firebaseConfig } from "./config";

/** Only used by /admin; public pages talk to Firestore over REST instead. */

export interface AuthUser {
  uid: string;
  email: string | null;
}

/** Firestore rejects any query `limit` above 10,000, so that is the ceiling. */
export const FIRESTORE_MAX_LIMIT = 10_000;
export const MAX_DOCS = FIRESTORE_MAX_LIMIT;

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
    onChange(user ? { uid: user.uid, email: user.email } : null)
  );
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<void> {
  const { mod, auth } = await authModule();
  await mod.signInWithEmailAndPassword(auth, email, password);
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
  const docs: PageviewDoc[] = [];
  for (const d of snapshot.docs) {
    const data = d.data();
    const strings = [
      data.site,
      data.path,
      data.ref,
      data.device,
      data.browser,
      data.os,
      data.screen,
      data.tz,
      data.vid,
    ];
    // Skip malformed docs instead of crashing the whole dashboard.
    if (
      !(data.ts instanceof fs.Timestamp) ||
      strings.some((v) => typeof v !== "string")
    ) {
      continue;
    }
    docs.push({
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
    });
  }
  return { docs, truncated: snapshot.size >= max };
}

export interface LeaderboardAdminRow {
  uid: string;
  nickname: string;
  prestige: number;
  score: number;
  lifetimeDistance: number;
  updatedAt: Date | null;
}

export const LEADERBOARD_ADMIN_LIMIT = 50;

/** The top players by score. Fields come from player writes: show as text. */
export async function fetchLeaderboardTop(): Promise<LeaderboardAdminRow[]> {
  const [app, fs] = await Promise.all([getApp(), import("firebase/firestore")]);
  const db = fs.getFirestore(app);
  const snapshot = await fs.getDocs(
    fs.query(
      fs.collection(db, "leaderboard"),
      fs.orderBy("score", "desc"),
      fs.limit(LEADERBOARD_ADMIN_LIMIT)
    )
  );
  const rows: LeaderboardAdminRow[] = [];
  for (const d of snapshot.docs) {
    const data = d.data();
    if (
      typeof data.nickname !== "string" ||
      typeof data.prestige !== "number" ||
      typeof data.score !== "number" ||
      typeof data.lifetimeDistance !== "number"
    ) {
      continue;
    }
    rows.push({
      uid: d.id,
      nickname: data.nickname,
      prestige: data.prestige,
      score: data.score,
      lifetimeDistance: data.lifetimeDistance,
      updatedAt:
        data.updatedAt instanceof fs.Timestamp ? data.updatedAt.toDate() : null,
    });
  }
  return rows;
}

export async function deleteLeaderboardEntry(uid: string): Promise<void> {
  const [app, fs] = await Promise.all([getApp(), import("firebase/firestore")]);
  await fs.deleteDoc(fs.doc(fs.getFirestore(app), "leaderboard", uid));
}
