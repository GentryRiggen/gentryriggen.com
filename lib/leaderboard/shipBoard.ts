import {
  BOARD_LIMIT,
  commitDocument,
  int,
  numberOf,
  runBoardQuery,
  type ClientDeps,
  type FirestoreValue,
} from "./client";
import { isValidNickname } from "./nickname";
import type { LeaderboardRow } from "./types";

export const SHIP_COLLECTION = "shipLeaderboard";

/**
 * A Ship Builder player's standing: stars across all their designs and their
 * best value per challenge (see lib/ship-builder/challenges). Mirrored by
 * `shipLeaderboard` in firestore.rules.
 */
export interface ShipBoardEntry {
  nickname: string;
  totalStars: number;
  bests: Readonly<Record<string, number | undefined>>;
}

/** `fields` of a full-document write of `shipLeaderboard/{uid}`. */
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

/** Never throws; resolves to whether the write was accepted. */
export function submitShipEntry(
  entry: ShipBoardEntry,
  deps: ClientDeps = {}
): Promise<boolean> {
  return commitDocument(SHIP_COLLECTION, shipEntryFields(entry), deps);
}

export function buildShipBoardQuery() {
  return {
    structuredQuery: {
      from: [{ collectionId: SHIP_COLLECTION }],
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

/** The top 50 by total stars, or null on any failure. Reads need no auth. */
export async function fetchShipBoard(
  deps: ClientDeps = {}
): Promise<LeaderboardRow[] | null> {
  const json = await runBoardQuery(buildShipBoardQuery(), deps);
  return json === null ? null : parseShipBoard(json);
}
