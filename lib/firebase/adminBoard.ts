import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import {
  FIRST_SEASON,
  seasonCollection,
  type SeasonGame,
  type SeasonInfo,
} from "@/lib/leaderboard/season";

/**
 * The admin's season and board operations, written against a Firestore
 * instance so the rules emulator tests can run the exact same writes. Loaded
 * only by lib/firebase/client.ts (so only on /admin). Every field read from an
 * entry was written by a player: show it as text.
 */

export interface AdminBoardRow {
  uid: string;
  nickname: string;
  updatedAt: Date | null;
  // plane
  prestige?: number;
  lifetimeDistance?: number;
  // ship
  totalStars?: number;
}

export const ADMIN_BOARD_LIMIT = 50;
/** Firestore's cap on writes in one batch. */
const MAX_BATCH_WRITES = 500;
const DAY_MS = 86_400_000;

const GAMES: SeasonGame[] = ["plane", "ship"];
/** Days around the admin's "today" whose daily entries a ban removes. */
const DAILY_DAY_OFFSETS = [1, 0, -1, -2];

function isSeasonNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= FIRST_SEASON;
}

/** The season after `data` (a seasons/{game} doc, undefined when missing). */
export function nextSeasonNumber(data: Record<string, unknown> | undefined) {
  if (data === undefined) return FIRST_SEASON + 1;
  if (!isSeasonNumber(data.number)) {
    throw new Error("The season doc is malformed.");
  }
  return data.number + 1;
}

function toDate(value: unknown): Date | null {
  const stamp = value as { toDate?: unknown } | null | undefined;
  if (typeof stamp?.toDate !== "function") return null;
  const date = (stamp.toDate as () => unknown)();
  return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
}

export async function readSeason(
  db: Firestore,
  game: SeasonGame
): Promise<SeasonInfo> {
  const snap = await getDoc(doc(db, "seasons", game));
  if (!snap.exists()) return { number: FIRST_SEASON, startedAt: null };
  const data = snap.data();
  if (!isSeasonNumber(data.number)) {
    throw new Error("The season doc is malformed.");
  }
  return { number: data.number, startedAt: toDate(data.startedAt) };
}

/** Thrown when the stored season is not the one the admin confirmed. */
export class SeasonChangedError extends Error {
  constructor(game: SeasonGame, expected: number, found: number) {
    super(
      `${game} is on season ${found}, not ${expected}: reload before starting one.`
    );
    this.name = "SeasonChangedError";
  }
}

/**
 * Starts the season after `expected` (the number the admin saw and confirmed;
 * 1 means the season doc must be missing). In a transaction, it reads the
 * stored number, throws SeasonChangedError when it differs from `expected`,
 * and writes expected + 1 explicitly (the rules accept exactly old + 1). A
 * stale tab, a second tab or a double click therefore cannot start a season
 * nobody confirmed: a contended transaction retries, re-reads the new number
 * and throws.
 */
export function startSeason(
  db: Firestore,
  game: SeasonGame,
  expected: number
): Promise<number> {
  const ref = doc(db, "seasons", game);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const number = nextSeasonNumber(snap.exists() ? snap.data() : undefined);
    if (number - 1 !== expected) {
      throw new SeasonChangedError(game, expected, number - 1);
    }
    tx.set(ref, { number, startedAt: serverTimestamp() });
    return number;
  });
}

/** A board doc as a row, or null when it is malformed. */
export function parseAdminRow(
  game: SeasonGame,
  uid: string,
  data: Record<string, unknown>
): AdminBoardRow | null {
  if (typeof data.nickname !== "string") return null;
  const base = {
    uid,
    nickname: data.nickname,
    updatedAt: toDate(data.updatedAt),
  };
  if (game === "plane") {
    if (
      typeof data.prestige !== "number" ||
      typeof data.lifetimeDistance !== "number"
    ) {
      return null;
    }
    return {
      ...base,
      prestige: data.prestige,
      lifetimeDistance: data.lifetimeDistance,
    };
  }
  if (typeof data.totalStars !== "number") return null;
  return { ...base, totalStars: data.totalStars };
}

/** Top 50: plane by score, ship by total stars. */
export async function readBoard(
  db: Firestore,
  game: SeasonGame,
  season: number
): Promise<AdminBoardRow[]> {
  const snapshot = await getDocs(
    query(
      collection(db, seasonCollection(game, season)),
      orderBy(game === "plane" ? "score" : "totalStars", "desc"),
      limit(ADMIN_BOARD_LIMIT)
    )
  );
  const rows: AdminBoardRow[] = [];
  for (const d of snapshot.docs) {
    const row = parseAdminRow(game, d.id, d.data());
    if (row) rows.push(row);
  }
  return rows;
}

export function deleteEntry(
  db: Firestore,
  game: SeasonGame,
  season: number,
  uid: string
): Promise<void> {
  return deleteDoc(doc(db, seasonCollection(game, season), uid));
}

/** The rules let the admin change only the name (to a generated one). */
export function renameEntry(
  db: Firestore,
  game: SeasonGame,
  season: number,
  uid: string,
  nickname: string
): Promise<void> {
  return updateDoc(doc(db, seasonCollection(game, season), uid), {
    nickname,
    updatedAt: serverTimestamp(),
  });
}

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Every doc a ban removes: the uid's entry in each season 1..current of both
 * games, and the daily challenge for the UTC days from two days ago through
 * tomorrow. The window is wide because `now` is the admin's clock, not the
 * server's; deleting a missing doc costs nothing.
 */
export function banDeletePaths(
  uid: string,
  planeSeason: number,
  shipSeason: number,
  now: Date
): string[] {
  const paths: string[] = [];
  const current: Record<SeasonGame, number> = {
    plane: planeSeason,
    ship: shipSeason,
  };
  for (const game of GAMES) {
    for (let season = FIRST_SEASON; season <= current[game]; season++) {
      paths.push(`${seasonCollection(game, season)}/${uid}`);
    }
  }
  for (const offset of DAILY_DAY_OFFSETS) {
    paths.push(
      `planeDaily/${dayKey(now.getTime() + offset * DAY_MS)}/entries/${uid}`
    );
  }
  return paths;
}

/**
 * One batch: the ban doc plus a delete of every path above (deleting a
 * missing doc is fine), so either all of it lands or none of it.
 */
export async function banEverywhere(
  db: Firestore,
  uid: string,
  now: Date = new Date()
): Promise<void> {
  const [plane, ship] = await Promise.all(
    GAMES.map((game) => readSeason(db, game))
  );
  const paths = banDeletePaths(uid, plane.number, ship.number, now);
  if (paths.length + 1 > MAX_BATCH_WRITES) {
    throw new Error("Too many seasons to ban in one batch.");
  }
  const batch = writeBatch(db);
  batch.set(doc(db, "leaderboardBans", uid), { bannedAt: serverTimestamp() });
  for (const path of paths) batch.delete(doc(db, path));
  await batch.commit();
}

/** Missing or malformed → hidden, as the players' client reads it. */
export async function readBoardHidden(
  db: Firestore,
  game: "plane"
): Promise<boolean> {
  const snap = await getDoc(doc(db, "boardSettings", game));
  const hidden = snap.exists() ? snap.data().hidden : undefined;
  return typeof hidden === "boolean" ? hidden : true;
}

export function writeBoardHidden(
  db: Firestore,
  game: "plane",
  hidden: boolean
): Promise<void> {
  return setDoc(doc(db, "boardSettings", game), { hidden });
}
