import {
  adoptUnsaved,
  dropDesign,
  EMPTY_PROGRESS,
  recordBest,
  UNSAVED_KEY,
  type ChallengeProgress,
} from "@/lib/ship-builder/challenges/progress";
import type { ChallengeId } from "@/lib/ship-builder/challenges/definitions";
import {
  CHALLENGES_KEY,
  parseChallenges,
  serializeChallenges,
} from "@/lib/ship-builder/persist/challenges";
import { createStoredSetting } from "./createStoredSetting";

/** Stars and the leaderboard name, remembered per device. */
export const challengeProgress = createStoredSetting<ChallengeProgress>({
  key: CHALLENGES_KEY,
  parse: parseChallenges,
  serialize: serializeChallenges,
  fallback: EMPTY_PROGRESS,
});

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
  challengeProgress.set({ ...challengeProgress.get(), nickname });
}
