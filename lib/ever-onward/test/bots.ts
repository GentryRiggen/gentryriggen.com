import { SCORED_UNIVERSES } from "../universes/scored";
import { jumpRun, type JumpPoint } from "./jump";
import type { RunState } from "../engine/types";

/**
 * Loaded on demand (dynamic import) by Test mode, so the bots and the sim
 * never ship to players who don't use it.
 */
export function jumpTo(
  universeId: string,
  phase: number,
  point: JumpPoint
): RunState | null {
  const entry = SCORED_UNIVERSES[universeId];
  if (!entry) return null;
  return jumpRun(entry.def, entry.bots(), phase, point);
}
