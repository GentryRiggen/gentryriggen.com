import { goalAmount, milestoneGoal, percentGoal } from "../../engine/goal";
import type { GoalView, RunState } from "../../engine/types";
import { FULL_GROWTH } from "./resources";
import { UPGRADES } from "./upgrades";

const MILESTONES = [
  ["sprinkler", "basket", "gardener", "greenhouse", "orchard", "cold-frame"],
  ["scarecrow", "tractor", "glasshouse", "seed-drone", "grain-barn"],
  ["windbreak", "planting-rover", "sky-seeder", "seed-vault"],
] as const;
const LABELS = [
  "GROW THE GARDEN",
  "BRING IN THE HARVEST",
  "GREEN THE WORLD",
] as const;

export function growGoal(run: RunState): GoalView | null {
  if (run.complete) return null;
  if (run.phase < 3)
    return milestoneGoal(
      run,
      UPGRADES,
      LABELS[run.phase],
      MILESTONES[run.phase]
    );
  const growth = goalAmount(run.resources.growth, FULL_GROWTH) / FULL_GROWTH;
  return percentGoal(
    "HELP THE SEED BLOOM",
    growth,
    growth >= 1
      ? "The seed has bloomed. Someone is on their way."
      : "Tend the pot and answer what it needs"
  );
}
