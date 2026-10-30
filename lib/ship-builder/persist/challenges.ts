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
/** Bump with a migration in `parseChallenges` if the stored shape changes. */
export const CHALLENGES_VERSION = 1;

interface StoredChallenges {
  v: number;
  designs: ChallengeProgress["designs"];
  nickname: ChallengeProgress["nickname"];
}

/** Never throws: absent, corrupt or newer-format text reads as no progress. */
export function parseChallenges(raw: string | null): ChallengeProgress {
  if (!raw) return EMPTY_PROGRESS;
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
    Object.keys(progress.designs).length === 0
  ) {
    return null;
  }
  const stored: StoredChallenges = {
    v: CHALLENGES_VERSION,
    designs: progress.designs,
    nickname: progress.nickname,
  };
  return JSON.stringify(stored);
}
