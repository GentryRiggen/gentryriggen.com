import {
  BOARD_LIMIT,
  commitDocumentResult,
  type CommitResult,
  fetchOwnFields,
  int,
  numberOf,
  runBoardQuery,
  type ClientDeps,
  type FirestoreValue,
  updatedAtOf,
} from "./client";
import { isValidNickname } from "./nickname";
import { seasonCollection, seasonQueryTarget } from "./season";
import type { LeaderboardRow } from "./types";

/**
 * A Ship Builder player's standing: stars across all their designs and their
 * best value per challenge (see lib/ship-builder/challenges). Mirrored by
 * `shipSeasons/{n}/entries` (and the frozen season 1 `shipLeaderboard`) in
 * firestore.rules.
 */
export interface ShipBoardEntry {
  nickname: string;
  totalStars: number;
  bests: Readonly<Record<string, number | undefined>>;
}

/** `fields` of a full-document write of a ship board entry. */
export function shipEntryFields(
  entry: ShipBoardEntry
): Record<string, FirestoreValue> {
  const bests: Record<string, FirestoreValue> = {};
  for (const [id, value] of Object.entries(entry.bests)) {
    if (typeof value === "number") bests[id] = int(value);
  }
  return {
    nickname: { stringValue: entry.nickname },
    totalStars: int(entry.totalStars),
    bests: { mapValue: { fields: bests } },
  };
}

/** Writes to `season`'s board. Never throws; resolves to how the write ended. */
export function submitShipEntry(
  entry: ShipBoardEntry,
  season: number,
  deps: ClientDeps = {}
): Promise<CommitResult> {
  return commitDocumentResult(
    seasonCollection("ship", season),
    shipEntryFields(entry),
    deps
  );
}

export function buildShipBoardQuery(season: number) {
  const { collectionId } = seasonQueryTarget("ship", season);
  return {
    structuredQuery: {
      from: [{ collectionId }],
      orderBy: [
        { field: { fieldPath: "totalStars" }, direction: "DESCENDING" },
      ],
      limit: BOARD_LIMIT,
    },
  };
}

/** Rows ordered by total stars; `value` is the star count. */
export function parseShipBoard(json: unknown): LeaderboardRow[] {
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
    const value = numberOf(document.fields.totalStars);
    // The rules only admit generated names; skip anything else anyway.
    if (!uid || !isValidNickname(nickname) || value === null) continue;
    rows.push({ uid, nickname, value });
  }
  return rows;
}

/**
 * `season`'s top 50 by total stars, or null on any failure. Reads need no
 * auth.
 */
export async function fetchShipBoard(
  season: number,
  deps: ClientDeps = {}
): Promise<LeaderboardRow[] | null> {
  const { parent } = seasonQueryTarget("ship", season);
  const json = await runBoardQuery(buildShipBoardQuery(season), deps, parent);
  return json === null ? null : parseShipBoard(json);
}

/** What the game needs of its own ship board entry. */
export interface OwnShipEntry {
  nickname: string;
  totalStars: number;
  /** When the entry was last written (ms since epoch), or null if unreadable. */
  updatedAt: number | null;
}

/**
 * The player's own entry in `season`, "missing" when there is none, or null
 * on any failure (a name the rules would not admit counts as one). Never
 * throws.
 */
export async function fetchOwnShipEntry(
  season: number,
  deps: ClientDeps = {}
): Promise<OwnShipEntry | "missing" | null> {
  const fields = await fetchOwnFields(seasonCollection("ship", season), deps);
  if (fields === null || fields === "missing") return fields;
  const nickname = (fields.nickname as { stringValue?: unknown } | undefined)
    ?.stringValue;
  const totalStars = numberOf(fields.totalStars);
  if (!isValidNickname(nickname) || totalStars === null) return null;
  return { nickname, totalStars, updatedAt: updatedAtOf(fields) };
}
