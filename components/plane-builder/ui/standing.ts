import { SCORE_PRESTIGE_UNIT } from "@/lib/leaderboard/types";

const MEDALS = ["🥇", "🥈", "🥉"] as const;

/** A medal for the top three places, otherwise null. */
export function medalFor(rank: number): string | null {
  return MEDALS[rank - 1] ?? null;
}

/** The prestige level packed into a prestige-board value. */
export function prestigeOf(value: number): number {
  return Math.floor(value / SCORE_PRESTIGE_UNIT);
}

/** Metres, or kilometres from 1 km up, rounded to read easily. */
export function formatKm(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  const km = metres / 1000;
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}
