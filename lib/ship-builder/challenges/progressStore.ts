import {
  adoptUnsaved,
  dropDesign,
  EMPTY_PROGRESS,
  recordBest,
  startShipSeason,
  UNSAVED_KEY,
  type ChallengeProgress,
} from "@/lib/ship-builder/challenges/progress";
import type { ChallengeId } from "@/lib/ship-builder/challenges/definitions";
import {
  CHALLENGES_KEY,
  isNewerChallengesFormat,
  parseChallenges,
  serializeChallenges,
} from "@/lib/ship-builder/persist/challenges";
import {
  createStoredSetting,
  type StoredSetting,
} from "../persist/storedSetting";

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(CHALLENGES_KEY);
  } catch {
    return null;
  }
}

/**
 * The name the save held before this session changed it; undefined until
 * first asked for or until the name is first set.
 */
let loadedNickname: string | null | undefined;

const setting = createStoredSetting<ChallengeProgress>({
  key: CHALLENGES_KEY,
  parse: parseChallenges,
  // A newer build's data is left exactly as it is: throwing makes the setting
  // keep this session's progress in memory only, without touching storage.
  serialize(value) {
    if (isNewerChallengesFormat(readRaw())) {
      throw new Error("Challenge progress is in a newer format; not saved");
    }
    return serializeChallenges(value);
  },
  fallback: EMPTY_PROGRESS,
});

/** Stars and the leaderboard name, remembered per device. */
export const challengeProgress: StoredSetting<ChallengeProgress> = {
  ...setting,
  resetMemory() {
    loadedNickname = undefined;
    setting.resetMemory();
  },
};

function noteLoadedNickname(): void {
  if (loadedNickname === undefined) {
    loadedNickname = challengeProgress.get().nickname;
  }
}

/**
 * The name the save loaded with, before anything this session set: the board
 * sync takes a different name on the board as the admin's, never this one.
 */
export function loadedChallengeNickname(): string | null {
  noteLoadedNickname();
  return loadedNickname ?? null;
}

/** Records a value; returns whether it beat what was stored. */
export function recordChallengeBest(
  designKey: string,
  id: ChallengeId,
  value: number
): boolean {
  const before = challengeProgress.get();
  const after = recordBest(before, designKey, id, value);
  if (after === before) return false;
  challengeProgress.set(after);
  return true;
}

/** The ship in the builder was saved to My Ships: its stars follow it. */
export function adoptUnsavedChallenges(savedId: string): void {
  const before = challengeProgress.get();
  const after = adoptUnsaved(before, savedId);
  if (after !== before) challengeProgress.set(after);
}

/** A different ship took the place of the unsaved one, or one was deleted. */
export function forgetChallengeDesign(designKey: string): void {
  const before = challengeProgress.get();
  const after = dropDesign(before, designKey);
  if (after !== before) challengeProgress.set(after);
}

export function forgetUnsavedChallenges(): void {
  forgetChallengeDesign(UNSAVED_KEY);
}

export function setChallengeNickname(nickname: string): void {
  noteLoadedNickname();
  challengeProgress.set({ ...challengeProgress.get(), nickname });
}

/**
 * Moves the stars into season `number` when that is newer than theirs: the
 * season's stars start from zero, all-time stars stay. Returns whether it did.
 */
export function applyShipSeason(number: number): boolean {
  const before = challengeProgress.get();
  if (number <= before.season.number) return false;
  challengeProgress.set(startShipSeason(before, number));
  return true;
}
