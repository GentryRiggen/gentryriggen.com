import { goalAmount, milestoneGoal, percentGoal } from "../../engine/goal";
import type { GoalView, RunState } from "../../engine/types";
import { FULL_TRUST } from "./resources";
import { UPGRADES } from "./upgrades";

const MILESTONES = [
  ["balloon", "puppy", "lemonade", "magic-hat", "next-door"],
  ["clown", "band", "smile-factory", "fireworks", "key-to-town"],
  [
    "poster",
    "loudspeaker",
    "cheer-tower",
    "cheer-blimp",
    "no-bad-days",
    "cheer-satellite",
  ],
] as const;
const LABELS = [
  "CHEER UP A FRIEND",
  "FILL THE TOWN WITH CHEER",
  "SPREAD CHEER EVERYWHERE",
] as const;

export function smileGoal(run: RunState): GoalView | null {
  if (run.complete) return null;
  if (run.phase < 3)
    return milestoneGoal(
      run,
      UPGRADES,
      LABELS[run.phase],
      MILESTONES[run.phase]
    );
  const trust = goalAmount(run.resources.trust, FULL_TRUST) / FULL_TRUST;
  return percentGoal(
    "MAKE ROOM FOR A SMILE",
    trust,
    trust >= 1
      ? "One small, real smile. Stay for a moment."
      : "Listen, make room, and share a little tea"
  );
}
