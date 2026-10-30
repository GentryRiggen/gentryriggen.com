import type { ObstacleKind, SailState } from "../sail/types";
import { SMOOTH_FINISH_CELLS } from "./definitions";

/** How a Smooth sailing run is going, fed by the sail state each step. */
export interface SmoothRun {
  /** The farthest she has been from the start, in cells. */
  reach: number;
  /** How it ended: still going, past the finish line, hit, given up, or a ship with no way to sail. */
  status: "sailing" | "finished" | "hit" | "gave-up" | "cannot-sail";
  /** What she hit, when `status` is "hit". */
  hitKind?: ObstacleKind;
}

export const NEW_SMOOTH_RUN: SmoothRun = { reach: 0, status: "sailing" };

/**
 * Folds the sail state into the run: tracks the farthest reach (so turning
 * back or circling earns nothing), ends it at a hard hit or at the finish
 * line, and then stays as it was. Soft bumps (buoys) are not hits.
 */
export function trackSmooth(run: SmoothRun, sail: SailState): SmoothRun {
  if (run.status !== "sailing") return run;
  const reach = Math.max(run.reach, Math.hypot(sail.x, sail.z));
  if (sail.impact) {
    // The hit counts where she was; the finish line is checked first below.
    return reach >= SMOOTH_FINISH_CELLS
      ? { reach, status: "finished" }
      : { reach, status: "hit", hitKind: sail.impact.kind };
  }
  if (reach >= SMOOTH_FINISH_CELLS) return { reach, status: "finished" };
  return reach === run.reach ? run : { ...run, reach };
}

/** The player ended the sail early; what they had sailed still counts. */
export function giveUpSmooth(run: SmoothRun): SmoothRun {
  return run.status === "sailing" ? { ...run, status: "gave-up" } : run;
}
