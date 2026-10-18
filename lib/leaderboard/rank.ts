import { BOARD_LIMIT } from "./client";
import type { LeaderboardRow } from "./types";

/** "desc" when bigger is better (prestige score), "asc" for times. */
export type Direction = "desc" | "asc";

export type Standing =
  | {
      kind: "ranked";
      /** 1-based place on the board. */
      rank: number;
      /** The player just ahead, or null at #1. */
      rival: LeaderboardRow | null;
      /** How far behind the rival (always >= 0), or null at #1. */
      gap: number | null;
      /** Players this value moved ahead of, from the stored row's value. */
      passed: LeaderboardRow[];
    }
  | {
      kind: "offBoard";
      /** The last row on a full board: beat it to get on. */
      cutoff: LeaderboardRow;
      gap: number;
    };

const isAhead = (a: number, b: number, direction: Direction) =>
  direction === "desc" ? a > b : a < b;

/**
 * Where `myValue` lands on a fetched board. The board may hold the player's
 * own (older, uploaded) row; it is replaced by `myValue`, so the answer is
 * right before the newest score finishes uploading. Ties go to the player.
 */
export function standingOn(
  rows: readonly LeaderboardRow[],
  uid: string,
  myValue: number,
  direction: Direction,
  limit: number = BOARD_LIMIT
): Standing {
  const stored = rows.find((row) => row.uid === uid) ?? null;
  const others = rows.filter((row) => row.uid !== uid);
  const ahead = others.filter((row) => isAhead(row.value, myValue, direction));
  const rank = ahead.length + 1;

  if (rank > limit) {
    const cutoff = others[limit - 1];
    return { kind: "offBoard", cutoff, gap: Math.abs(cutoff.value - myValue) };
  }

  const rival = ahead.length > 0 ? ahead[ahead.length - 1] : null;
  const passed =
    stored === null
      ? []
      : others.filter(
          (row) =>
            isAhead(row.value, stored.value, direction) &&
            !isAhead(row.value, myValue, direction)
        );
  return {
    kind: "ranked",
    rank,
    rival,
    gap: rival === null ? null : Math.abs(rival.value - myValue),
    passed,
  };
}
