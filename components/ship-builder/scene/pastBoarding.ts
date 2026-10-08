import type { SimBreakup, SimPhase } from "@/lib/ship-builder/sim/types";

/**
 * Whether it is too late to start a walk on the sinking ship: she has broken
 * in two, or gone under (descending to the sea floor, or done). There is no
 * climbing aboard a wreck, so the Walk button hides; a walk already under way
 * carries on.
 */
export function isPastBoarding(sim: {
  phase: SimPhase;
  breakup: SimBreakup | null;
}): boolean {
  return (
    sim.breakup !== null || sim.phase === "descending" || sim.phase === "done"
  );
}
