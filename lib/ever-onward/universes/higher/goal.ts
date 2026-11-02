import { goalAmount, milestoneGoal, percentGoal } from "../../engine/goal";
import type { GoalView, RunState } from "../../engine/types";
import { FULL_DESCENT } from "./resources";
import { UPGRADES } from "./upgrades";

const MILESTONES = [
  ["bear", "ramp", "toy-crane", "fairy-lights", "treehouse"],
  ["mason", "crane", "concrete-truck", "neon-sign", "skyscraper"],
  ["sky-crew", "cloud-crane", "cable-spinner", "beacon", "space-elevator"],
] as const;
const LABELS = [
  "BUILD A TREEHOUSE",
  "RAISE THE TOWER",
  "REACH ABOVE THE CLOUDS",
] as const;

export function higherGoal(run: RunState): GoalView | null {
  if (run.complete) return null;
  if (run.phase < 3)
    return milestoneGoal(
      run,
      UPGRADES,
      LABELS[run.phase],
      MILESTONES[run.phase]
    );
  const descent =
    goalAmount(run.resources.descent, FULL_DESCENT) / FULL_DESCENT;
  return percentGoal(
    "CARRY THE BLOCK HOME",
    descent,
    (run.owned["set-down"] ?? 0) > 0
      ? "The block is down. Someone is on their way."
      : descent >= 0.95
        ? "Set the block down when you are ready"
        : "Every step brings the ground closer"
  );
}
