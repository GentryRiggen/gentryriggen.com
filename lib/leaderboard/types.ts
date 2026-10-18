import type { LevelId } from "@/lib/plane-builder/levels/types";

const MAX_SCORE_DISTANCE = 999_999_999;
export const SCORE_PRESTIGE_UNIT = 1e9;

export interface LeaderboardEntry {
  nickname: string;
  prestige: number;
  /** See `scoreFor`. Stored so board 1 needs only a one-field ordering. */
  score: number;
  lifetimeDistance: number;
  bestTimes: Partial<Record<LevelId, number>>;
  fastestRun: number | null;
}

export type BoardKind = "prestige" | "fastestRun" | { world: LevelId };

/**
 * `value` is the ordering field: score (prestige board), whole seconds
 * (fastestRun) or seconds (a world's best time).
 */
export interface LeaderboardRow {
  uid: string;
  nickname: string;
  value: number;
}

/** prestige * 1e9 + min(floor(lifetimeDistance), 999999999). */
export function scoreFor(prestige: number, lifetimeDistance: number): number {
  return (
    prestige * SCORE_PRESTIGE_UNIT +
    Math.min(Math.floor(lifetimeDistance), MAX_SCORE_DISTANCE)
  );
}
