import { firebaseConfig, isFirebaseConfigured } from "@/lib/firebase/config";
import type { FirebaseWebConfig } from "@/lib/firebase/config";
import { getIdToken } from "./auth";
import type { AuthSession } from "./auth";
import type { BoardKind, LeaderboardEntry, LeaderboardRow } from "./types";

const DEFAULT_BASE_URL = "https://firestore.googleapis.com";
export const BOARD_LIMIT = 50;
const COLLECTION = "leaderboard";

export interface ClientDeps {
  config?: FirebaseWebConfig;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  getSession?: () => Promise<AuthSession | null>;
}

type FirestoreValue =
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { nullValue: null }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

const documentsUrl = (config: FirebaseWebConfig, baseUrl: string) =>
  `${baseUrl}/v1/projects/${config.projectId}/databases/(default)/documents`;

export function commitUrl(
  config: FirebaseWebConfig,
  baseUrl: string = DEFAULT_BASE_URL
): string {
  return `${documentsUrl(config, baseUrl)}:commit?key=${config.apiKey}`;
}

export function runQueryUrl(
  config: FirebaseWebConfig,
  baseUrl: string = DEFAULT_BASE_URL
): string {
  return `${documentsUrl(config, baseUrl)}:runQuery?key=${config.apiKey}`;
}

const int = (n: number): FirestoreValue => ({ integerValue: String(n) });

/**
 * A full-document write of `leaderboard/{uid}` (no updateMask, so the stored
 * doc is exactly these fields, as firestore.rules require). `updatedAt` is
 * set by the server.
 */
export function buildSubmitBody(
  projectId: string,
  uid: string,
  entry: LeaderboardEntry
) {
  const bestTimes: Record<string, FirestoreValue> = {};
  for (const [world, seconds] of Object.entries(entry.bestTimes)) {
    if (typeof seconds === "number") {
      bestTimes[world] = { doubleValue: seconds };
    }
  }
  const fields: Record<string, FirestoreValue> = {
    nickname: { stringValue: entry.nickname },
    prestige: int(entry.prestige),
    score: int(entry.score),
    lifetimeDistance: { doubleValue: entry.lifetimeDistance },
    bestTimes: { mapValue: { fields: bestTimes } },
    fastestRun:
      entry.fastestRun === null ? { nullValue: null } : int(entry.fastestRun),
  };
  return {
    writes: [
      {
        update: {
          name: `projects/${projectId}/databases/(default)/documents/${COLLECTION}/${uid}`,
          fields,
        },
        updateTransforms: [
          { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
        ],
      },
    ],
  };
}

/** Never throws; resolves to whether the write was accepted. */
export async function submitEntry(
  entry: LeaderboardEntry,
  deps: ClientDeps = {}
): Promise<boolean> {
  const config = deps.config ?? firebaseConfig;
  if (!isFirebaseConfigured(config)) return false;
  try {
    const session = await (deps.getSession ?? getIdToken)();
    if (!session) return false;
    const fetchImpl = deps.fetchImpl ?? ((...args) => fetch(...args));
    const response = await fetchImpl(commitUrl(config, deps.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.idToken}`,
      },
      body: JSON.stringify(
        buildSubmitBody(config.projectId, session.uid, entry)
      ),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function orderField(kind: BoardKind): string {
  if (kind === "prestige") return "score";
  if (kind === "fastestRun") return "fastestRun";
  return `bestTimes.${kind.world}`;
}

export function buildBoardQuery(kind: BoardKind) {
  const direction = kind === "prestige" ? "DESCENDING" : "ASCENDING";
  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId: COLLECTION }],
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

function numberOf(value: unknown): number | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as { integerValue?: unknown; doubleValue?: unknown };
  const n =
    v.integerValue !== undefined ? Number(v.integerValue) : v.doubleValue;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** Reads `a.b` out of Firestore REST fields, descending through mapValues. */
function valueAtPath(fields: Record<string, unknown>, path: string): unknown {
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

/** The top 50 rows, or null on any failure. Reads need no auth. */
export async function fetchBoard(
  kind: BoardKind,
  deps: ClientDeps = {}
): Promise<LeaderboardRow[] | null> {
  const config = deps.config ?? firebaseConfig;
  if (!isFirebaseConfigured(config)) return null;
  try {
    const fetchImpl = deps.fetchImpl ?? ((...args) => fetch(...args));
    const response = await fetchImpl(runQueryUrl(config, deps.baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBoardQuery(kind)),
    });
    if (!response.ok) return null;
    return parseBoard(await response.json(), kind);
  } catch {
    return null;
  }
}
