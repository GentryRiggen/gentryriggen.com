import { isValidNickname } from "@/lib/leaderboard/nickname";
import {
  EMPTY_PROGRESS,
  parseProgress,
  type ChallengeProgress,
} from "../challenges/progress";

/**
 * Challenge stars live beside, not inside, the ship saves, so the ship
 * format (and every old save, autosave and share link) is untouched. Only
 * the best value per challenge per design is stored; stars are worked out
 * from it when shown, so retuning a threshold needs no migration.
 */
export const CHALLENGES_KEY = "ship-builder:challenges";
/**
 * Bump with a migration in `parseChallenges` if the stored shape changes, or
 * when a challenge id is added (an older build would drop the new id's bests
 * on its next save, so it leaves newer data alone instead). 2 added `smooth`;
 * 3 added `season` (an older save reads as season 0, so the first season
 * read starts its season stars from zero).
 */
export const CHALLENGES_VERSION = 3;

interface StoredChallenges {
  v: number;
  designs: ChallengeProgress["designs"];
  nickname: ChallengeProgress["nickname"];
  season: ChallengeProgress["season"];
}

/** True for stored text written by a newer build (a later `v`). */
export function isNewerChallengesFormat(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return false;
    const { v } = data as { v?: unknown };
    return typeof v === "number" && v > CHALLENGES_VERSION;
  } catch {
    return false;
  }
}

/**
 * Never throws: absent, corrupt or newer-format text reads as no progress.
 * Text from a newer build is only read past, never changed: the store does
 * not write over it (see progressStore.ts).
 */
export function parseChallenges(raw: string | null): ChallengeProgress {
  if (!raw || isNewerChallengesFormat(raw)) return EMPTY_PROGRESS;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return EMPTY_PROGRESS;
    return parseProgress(data, isValidNickname);
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function serializeChallenges(
  progress: ChallengeProgress
): string | null {
  if (
    progress.nickname === null &&
    Object.keys(progress.designs).length === 0 &&
    progress.season.number === 0 &&
    Object.keys(progress.season.designs).length === 0
  ) {
    return null;
  }
  const stored: StoredChallenges = {
    v: CHALLENGES_VERSION,
    designs: progress.designs,
    nickname: progress.nickname,
    season: progress.season,
  };
  return JSON.stringify(stored);
}
