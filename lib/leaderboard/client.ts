import { appCheckHeaders } from "@/lib/firebase/appCheck";
import { firebaseConfig, isFirebaseConfigured } from "@/lib/firebase/config";
import type { FirebaseWebConfig } from "@/lib/firebase/config";
import { getIdToken } from "./auth";
import type { AuthSession } from "./auth";
import { seasonCollection, seasonQueryTarget } from "./season";
import type { BoardKind, LeaderboardEntry, LeaderboardRow } from "./types";

const DEFAULT_BASE_URL = "https://firestore.googleapis.com";
export const BOARD_LIMIT = 50;

export interface ClientDeps {
  config?: FirebaseWebConfig;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  getSession?: () => Promise<AuthSession | null>;
  getAppCheckHeaders?: () => Promise<Record<string, string>>;
}

/** App Check header for Firestore REST calls (identitytoolkit gets none yet). */
export function leaderboardAppCheckHeaders(
  deps: ClientDeps
): Promise<Record<string, string>> {
  return (deps.getAppCheckHeaders ?? (() => appCheckHeaders("leaderboard")))();
}

export type FirestoreValue =
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { nullValue: null }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

export const documentsUrl = (config: FirebaseWebConfig, baseUrl: string) =>
  `${baseUrl}/v1/projects/${config.projectId}/databases/(default)/documents`;

export function commitUrl(
  config: FirebaseWebConfig,
  baseUrl: string = DEFAULT_BASE_URL
): string {
  return `${documentsUrl(config, baseUrl)}:commit?key=${config.apiKey}`;
}

/**
 * A structured query's endpoint. With a `parent` document path (such as
 * "planeSeasons/3"), the query runs on that document's subcollections.
 */
export function runQueryUrl(
  config: FirebaseWebConfig,
  baseUrl: string = DEFAULT_BASE_URL,
  parent = ""
): string {
  const root = documentsUrl(config, baseUrl);
  const base = parent === "" ? root : `${root}/${parent}`;
  return `${base}:runQuery?key=${config.apiKey}`;
}

export const int = (n: number): FirestoreValue => ({ integerValue: String(n) });

/**
 * A full-document write of `<collection>/{uid}` (no updateMask, so the stored
 * doc is exactly these fields, as firestore.rules require). `updatedAt` is
 * set by the server.
 */
export function buildDocumentBody(
  projectId: string,
  collection: string,
  uid: string,
  fields: Record<string, FirestoreValue>
) {
  return {
    writes: [
      {
        update: {
          name: `projects/${projectId}/databases/(default)/documents/${collection}/${uid}`,
          fields,
        },
        updateTransforms: [
          { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
        ],
      },
    ],
  };
}

function entryFields(entry: LeaderboardEntry): Record<string, FirestoreValue> {
  const bestTimes: Record<string, FirestoreValue> = {};
  for (const [world, seconds] of Object.entries(entry.bestTimes)) {
    if (typeof seconds === "number") {
      bestTimes[world] = { doubleValue: seconds };
    }
  }
  return {
    nickname: { stringValue: entry.nickname },
    prestige: int(entry.prestige),
    score: int(entry.score),
    lifetimeDistance: { doubleValue: entry.lifetimeDistance },
    bestTimes: { mapValue: { fields: bestTimes } },
    fastestRun:
      entry.fastestRun === null ? { nullValue: null } : int(entry.fastestRun),
  };
}

/** The Plane Builder entry as a write of the season's `{collection}/{uid}`. */
export function buildSubmitBody(
  projectId: string,
  uid: string,
  entry: LeaderboardEntry,
  season: number
) {
  return buildDocumentBody(
    projectId,
    seasonCollection("plane", season),
    uid,
    entryFields(entry)
  );
}

/**
 * Signs in anonymously and commits `<collection>/{uid}` with `fields`. Never
 * throws; resolves to whether the write was accepted.
 */
export async function commitDocument(
  collection: string,
  fields: Record<string, FirestoreValue>,
  deps: ClientDeps = {}
): Promise<boolean> {
  return (await commitDocumentResult(collection, fields, deps)) === "ok";
}

/**
 * How a write ended: accepted, refused by the rules (HTTP 403), or not
 * delivered at all (no config or session, a network error, a server error).
 */
export type CommitResult = "ok" | "refused" | "error";

/** Like `commitDocument`, but tells a refusal from a failure to deliver. */
export async function commitDocumentResult(
  collection: string,
  fields: Record<string, FirestoreValue>,
  deps: ClientDeps = {}
): Promise<CommitResult> {
  const config = deps.config ?? firebaseConfig;
  if (!isFirebaseConfigured(config)) return "error";
  try {
    const session = await (deps.getSession ?? getIdToken)();
    if (!session) return "error";
    const fetchImpl = deps.fetchImpl ?? ((...args) => fetch(...args));
    const response = await fetchImpl(commitUrl(config, deps.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.idToken}`,
        ...(await leaderboardAppCheckHeaders(deps)),
      },
      body: JSON.stringify(
        buildDocumentBody(config.projectId, collection, session.uid, fields)
      ),
    });
    if (response.ok) return "ok";
    return response.status === 403 ? "refused" : "error";
  } catch {
    return "error";
  }
}

/**
 * Writes the entry to `season`'s board. Never throws; resolves to whether
 * the write was accepted.
 */
export async function submitEntry(
  entry: LeaderboardEntry,
  season: number,
  deps: ClientDeps = {}
): Promise<boolean> {
  return (await submitEntryResult(entry, season, deps)) === "ok";
}

/** Like `submitEntry`, but tells a refusal from a failure to deliver. */
export function submitEntryResult(
  entry: LeaderboardEntry,
  season: number,
  deps: ClientDeps = {}
): Promise<CommitResult> {
  return commitDocumentResult(
    seasonCollection("plane", season),
    entryFields(entry),
    deps
  );
}

/** What the game needs of its own board entry. */
export interface OwnEntry {
  nickname: string;
  prestige: number;
  lifetimeDistance: number;
  /** When the entry was last written (ms since epoch), or null if unreadable. */
  updatedAt: number | null;
}

/** A document's `updatedAt` in ms, or null when absent or unreadable. */
export function updatedAtOf(fields: Record<string, unknown>): number | null {
  const stamp = (fields.updatedAt as { timestampValue?: unknown } | undefined)
    ?.timestampValue;
  const updatedAt = typeof stamp === "string" ? Date.parse(stamp) : NaN;
  return Number.isFinite(updatedAt) ? updatedAt : null;
}

function parseOwnEntry(fields: Record<string, unknown>): OwnEntry | null {
  const nickname = (fields.nickname as { stringValue?: unknown } | undefined)
    ?.stringValue;
  const prestige = numberOf(fields.prestige);
  const lifetimeDistance = numberOf(fields.lifetimeDistance);
  if (typeof nickname !== "string" || prestige === null) return null;
  if (lifetimeDistance === null) return null;
  return {
    nickname,
    prestige,
    lifetimeDistance,
    updatedAt: updatedAtOf(fields),
  };
}

/**
 * GET of the player's own doc in `collection` (needs the anonymous uid, not
 * the token: reads are public). Its fields, "missing" when there is none, or
 * null on any failure. Never throws.
 */
export async function fetchOwnFields(
  collection: string,
  deps: ClientDeps = {}
): Promise<Record<string, unknown> | "missing" | null> {
  const config = deps.config ?? firebaseConfig;
  if (!isFirebaseConfigured(config)) return null;
  try {
    const session = await (deps.getSession ?? getIdToken)();
    if (!session) return null;
    const fetchImpl = deps.fetchImpl ?? ((...args) => fetch(...args));
    const base = documentsUrl(config, deps.baseUrl ?? DEFAULT_BASE_URL);
    const path = `${collection}/${session.uid}`;
    const response = await fetchImpl(`${base}/${path}?key=${config.apiKey}`, {
      method: "GET",
      headers: { ...(await leaderboardAppCheckHeaders(deps)) },
    });
    if (response.status === 404) return "missing";
    if (!response.ok) return null;
    const json: unknown = await response.json();
    const fields = (json as { fields?: unknown } | null)?.fields;
    return typeof fields === "object" && fields !== null
      ? (fields as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * The player's own entry in `season`, "missing" when there is none, or null
 * on any failure. Never throws.
 */
export async function fetchOwnEntry(
  season: number,
  deps: ClientDeps = {}
): Promise<OwnEntry | "missing" | null> {
  const fields = await fetchOwnFields(seasonCollection("plane", season), deps);
  if (fields === null || fields === "missing") return fields;
  return parseOwnEntry(fields);
}

/**
 * Runs a structured query (under `parent`, a document path, when given): the
 * raw JSON reply, or null on any failure.
 */
export async function runBoardQuery(
  body: unknown,
  deps: ClientDeps = {},
  parent = ""
): Promise<unknown> {
  const config = deps.config ?? firebaseConfig;
  if (!isFirebaseConfigured(config)) return null;
  try {
    const fetchImpl = deps.fetchImpl ?? ((...args) => fetch(...args));
    const response = await fetchImpl(
      runQueryUrl(config, deps.baseUrl, parent),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await leaderboardAppCheckHeaders(deps)),
        },
        body: JSON.stringify(body),
      }
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function orderField(kind: BoardKind): string {
  if (kind === "prestige") return "score";
  if (kind === "fastestRun") return "fastestRun";
  return `bestTimes.${kind.world}`;
}

export function buildBoardQuery(kind: BoardKind, season: number) {
  const direction = kind === "prestige" ? "DESCENDING" : "ASCENDING";
  const { collectionId } = seasonQueryTarget("plane", season);
  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId }],
    orderBy: [{ field: { fieldPath: orderField(kind) }, direction }],
    limit: BOARD_LIMIT,
  };
  if (kind === "fastestRun") {
    structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: "fastestRun" },
        op: "GREATER_THAN",
        value: { integerValue: "0" },
      },
    };
  }
  return { structuredQuery };
}

export function numberOf(value: unknown): number | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as { integerValue?: unknown; doubleValue?: unknown };
  const n =
    v.integerValue !== undefined ? Number(v.integerValue) : v.doubleValue;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** Reads `a.b` out of Firestore REST fields, descending through mapValues. */
export function valueAtPath(
  fields: Record<string, unknown>,
  path: string
): unknown {
  let bag: Record<string, unknown> | undefined = fields;
  const parts = path.split(".");
  for (let i = 0; i < parts.length; i++) {
    const next: unknown = bag?.[parts[i]];
    if (i === parts.length - 1) return next;
    bag = (next as { mapValue?: { fields?: Record<string, unknown> } } | null)
      ?.mapValue?.fields;
  }
  return undefined;
}

export function parseBoard(json: unknown, kind: BoardKind): LeaderboardRow[] {
  if (!Array.isArray(json)) return [];
  const path = orderField(kind);
  const rows: LeaderboardRow[] = [];
  for (const item of json) {
    const document = (item as { document?: unknown } | null)?.document as
      { name?: unknown; fields?: Record<string, unknown> } | undefined;
    if (!document || typeof document.name !== "string" || !document.fields) {
      continue;
    }
    const uid = document.name.split("/").pop();
    const nickname = (
      document.fields.nickname as { stringValue?: unknown } | undefined
    )?.stringValue;
    const value = numberOf(valueAtPath(document.fields, path));
    if (!uid || typeof nickname !== "string" || value === null) continue;
    rows.push({ uid, nickname, value });
  }
  return rows;
}

/** `season`'s top 50 rows, or null on any failure. Reads need no auth. */
export async function fetchBoard(
  kind: BoardKind,
  season: number,
  deps: ClientDeps = {}
): Promise<LeaderboardRow[] | null> {
  const { parent } = seasonQueryTarget("plane", season);
  const json = await runBoardQuery(buildBoardQuery(kind, season), deps, parent);
  return json === null ? null : parseBoard(json, kind);
}
