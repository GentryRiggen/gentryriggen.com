import type { SimBreakup, SimPhase } from "@/lib/ship-builder/sim/types";

/**
 * Whether a walk on the sinking ship is over: she has broken in two, or gone
 * under (descending to the sea floor, or done). There is no half to ride yet,
 * so the walker stops and the trial plays on to its result.
 */
export function isWalkOver(sim: {
  phase: SimPhase;
  breakup: SimBreakup | null;
}): boolean {
  return (
    sim.breakup !== null || sim.phase === "descending" || sim.phase === "done"
  );
}
