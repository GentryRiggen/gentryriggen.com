import type { FirebaseApp } from "firebase/app";
import { parseGameEvent, type GameEvent } from "@/lib/analytics/gameEvents";
import type { PageviewDoc } from "@/lib/analytics/types";
import type { SeasonGame, SeasonInfo } from "@/lib/leaderboard/season";
import type { AdminBoardRow } from "./adminBoard";
import { browserEnv, isRealBrowser } from "./appCheck";
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

/**
 * App Check for the SDK path (real browsers only: no dev, e2e, localhost or
 * automation). Failure must never block /admin, so errors are swallowed.
 */
async function initAppCheck(app: FirebaseApp): Promise<void> {
  const siteKey = firebaseConfig.recaptchaSiteKey;
  if (!siteKey || !isRealBrowser(browserEnv())) return;
  try {
    const { initializeAppCheck, ReCaptchaEnterpriseProvider } =
      await import("firebase/app-check");
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    // Fail open: the admin dashboard works without App Check.
  }
}

function getApp(): Promise<FirebaseApp> {
  appPromise ??= import("firebase/app").then(async (appMod) => {
    const existing = appMod.getApps()[0];
    if (existing) return existing;
    const app = appMod.initializeApp(firebaseConfig);
    await initAppCheck(app);
    return app;
  });
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

export interface GameEventsResult {
  events: GameEvent[];
  /** True when the fetch hit the cap, so the oldest events are missing. */
  truncated: boolean;
}

/** Days of gameplay events the dashboard loads unless told otherwise. */
export const GAME_EVENT_DAYS = 30;
/** Enough for a busy month; a warning shows if it is ever reached. */
export const GAME_EVENT_LIMIT = 5000;

/**
 * Gameplay events from the last `days` UTC days (today included), newest day
 * first. Queries by `day` only, so no other field needs an index. Malformed
 * docs are skipped.
 */
export async function fetchGameEvents(
  days: number = GAME_EVENT_DAYS,
  max: number = GAME_EVENT_LIMIT,
  now: Date = new Date()
): Promise<GameEventsResult> {
  const [app, fs] = await Promise.all([getApp(), import("firebase/firestore")]);
  const db = fs.getFirestore(app);
  const firstDay = new Date(now.getTime() - (days - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const snapshot = await fs.getDocs(
    fs.query(
      fs.collection(db, "gameEvents"),
      fs.where("day", ">=", firstDay),
      fs.orderBy("day", "desc"),
      fs.limit(Math.min(max, MAX_DOCS))
    )
  );
  const events: GameEvent[] = [];
  for (const d of snapshot.docs) {
    const event = parseGameEvent(d.data());
    if (event) events.push(event);
  }
  return { events, truncated: snapshot.size >= max };
}

export type { AdminBoardRow } from "./adminBoard";

/** Firestore plus the admin board operations, loaded on first use. */
async function adminBoard() {
  const [app, fs, ops] = await Promise.all([
    getApp(),
    import("firebase/firestore"),
    import("./adminBoard"),
  ]);
  return { db: fs.getFirestore(app), ops };
}

/** The game's current season (missing doc → season 1, no start date). */
export async function fetchAdminSeason(game: SeasonGame): Promise<SeasonInfo> {
  const { db, ops } = await adminBoard();
  return ops.readSeason(db, game);
}

/**
 * Transaction: reads seasons/{game}; if its number (1 when missing) is not
 * `expected` (the season the admin saw), throws without writing; else writes
 * expected + 1 with startedAt serverTimestamp. Returns the new number.
 */
export async function startNewSeason(
  game: SeasonGame,
  expected: number
): Promise<number> {
  const { db, ops } = await adminBoard();
  return ops.startSeason(db, game, expected);
}

/** Top 50 of a season: plane by score, ship by total stars. Show as text. */
export async function fetchAdminBoard(
  game: SeasonGame,
  season: number
): Promise<AdminBoardRow[]> {
  const { db, ops } = await adminBoard();
  return ops.readBoard(db, game, season);
}

export async function deleteBoardEntry(
  game: SeasonGame,
  season: number,
  uid: string
): Promise<void> {
  const { db, ops } = await adminBoard();
  await ops.deleteEntry(db, game, season, uid);
}

/**
 * One batch: ban doc + delete uid from every season 1..current of both games
 * + planeDaily from two days ago through tomorrow (UTC, by this browser's
 * clock). Deleting a missing doc is fine.
 */
export async function banAndDeleteEverywhere(uid: string): Promise<void> {
  const { db, ops } = await adminBoard();
  await ops.banEverywhere(db, uid);
}

/** updateDoc({ nickname, updatedAt }); the rules allow nothing else. */
export async function renameBoardEntry(
  game: SeasonGame,
  season: number,
  uid: string,
  nickname: string
): Promise<void> {
  const { db, ops } = await adminBoard();
  await ops.renameEntry(db, game, season, uid, nickname);
}

/** Whether the board is hidden from players (missing or bad doc → hidden). */
export async function fetchAdminBoardHidden(game: "plane"): Promise<boolean> {
  const { db, ops } = await adminBoard();
  return ops.readBoardHidden(db, game);
}

export async function setBoardHidden(
  game: "plane",
  hidden: boolean
): Promise<void> {
  const { db, ops } = await adminBoard();
  await ops.writeBoardHidden(db, game, hidden);
}
