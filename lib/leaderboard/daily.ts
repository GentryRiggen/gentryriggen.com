import { firebaseConfig, isFirebaseConfigured } from "@/lib/firebase/config";
import type { FirebaseWebConfig } from "@/lib/firebase/config";
import { dailyFor, isDateKey } from "@/lib/plane-builder/daily/daily";
import type { LevelId } from "@/lib/plane-builder/levels/types";
import { getIdToken } from "./auth";
import { documentsUrl, leaderboardAppCheckHeaders } from "./client";
import type { ClientDeps } from "./client";
import type { LeaderboardRow } from "./types";

/** The daily board shows this many pilots. */
export const DAILY_BOARD_LIMIT = 20;
const DEFAULT_BASE_URL = "https://firestore.googleapis.com";

/** One pilot's best time on one day's challenge: `planeDaily/{date}/entries/{uid}`. */
export interface DailyEntry {
  nickname: string;
  /** The challenge's world; firestore.rules uses it for the minimum time. */
  world: LevelId;
  /** Sim seconds to the finish. */
  time: number;
}

const entryName = (projectId: string, date: string, uid: string) =>
  `projects/${projectId}/databases/(default)/documents/planeDaily/${date}/entries/${uid}`;

/**
 * A full-document write (no updateMask, so the doc is exactly these fields).
 * `updatedAt` is set by the server.
 */
export function buildDailySubmitBody(
  projectId: string,
  date: string,
  uid: string,
  entry: DailyEntry
) {
  return {
    writes: [
      {
        update: {
          name: entryName(projectId, date, uid),
          fields: {
            nickname: { stringValue: entry.nickname },
            world: { stringValue: entry.world },
            time: { doubleValue: entry.time },
          },
        },
        updateTransforms: [
          { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
        ],
      },
    ],
  };
}

export function dailyCommitUrl(
  config: FirebaseWebConfig,
  baseUrl: string = DEFAULT_BASE_URL
): string {
  return `${documentsUrl(config, baseUrl)}:commit?key=${config.apiKey}`;
}

/** A query on the day's `entries` subcollection (the parent is the day). */
export function dailyRunQueryUrl(
  config: FirebaseWebConfig,
  date: string,
  baseUrl: string = DEFAULT_BASE_URL
): string {
  return `${documentsUrl(config, baseUrl)}/planeDaily/${date}:runQuery?key=${config.apiKey}`;
}

export function buildDailyQuery() {
  return {
    structuredQuery: {
      from: [{ collectionId: "entries" }],
      orderBy: [{ field: { fieldPath: "time" }, direction: "ASCENDING" }],
      limit: DAILY_BOARD_LIMIT,
    },
  };
}

/**
 * Rows of a day's board. With `world`, rows naming any other world are
 * dropped (the rules already refuse them; this is defence in depth, and a
 * server-side filter would need a composite index).
 */
export function parseDailyBoard(
  json: unknown,
  world?: string
): LeaderboardRow[] {
  if (!Array.isArray(json)) return [];
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
    const rowWorld = (
      document.fields.world as { stringValue?: unknown } | undefined
    )?.stringValue;
    if (world !== undefined && rowWorld !== world) continue;
    const time = document.fields.time as
      { doubleValue?: unknown; integerValue?: unknown } | undefined;
    const value = Number(time?.doubleValue ?? time?.integerValue);
    if (!uid || typeof nickname !== "string" || !Number.isFinite(value)) {
      continue;
    }
    rows.push({ uid, nickname, value });
  }
  return rows;
}

/** Never throws; resolves to whether the write was accepted. */
export async function submitDaily(
  date: string,
  entry: DailyEntry,
  deps: ClientDeps = {}
): Promise<boolean> {
  const config = deps.config ?? firebaseConfig;
  if (!isFirebaseConfigured(config) || !isDateKey(date)) return false;
  try {
    const session = await (deps.getSession ?? getIdToken)();
    if (!session) return false;
    const fetchImpl = deps.fetchImpl ?? ((...args) => fetch(...args));
    const response = await fetchImpl(dailyCommitUrl(config, deps.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.idToken}`,
        ...(await leaderboardAppCheckHeaders(deps)),
      },
      body: JSON.stringify(
        buildDailySubmitBody(config.projectId, date, session.uid, entry)
      ),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** The day's top 20, or null on any failure. Reads need no auth. */
export async function fetchDailyBoard(
  date: string,
  deps: ClientDeps = {}
): Promise<LeaderboardRow[] | null> {
  const config = deps.config ?? firebaseConfig;
  if (!isFirebaseConfigured(config) || !isDateKey(date)) return null;
  try {
    const fetchImpl = deps.fetchImpl ?? ((...args) => fetch(...args));
    const response = await fetchImpl(
      dailyRunQueryUrl(config, date, deps.baseUrl),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await leaderboardAppCheckHeaders(deps)),
        },
        body: JSON.stringify(buildDailyQuery()),
      }
    );
    if (!response.ok) return null;
    return parseDailyBoard(await response.json(), dailyFor(date).world);
  } catch {
    return null;
  }
}
