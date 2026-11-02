import type { RunState } from "../../engine/types";
import { TUNING } from "./tuning";

/**
 * Which way each fork in the road went. This leaf module holds only the
 * state (a flag a side), so the tick can read it without importing the
 * cards (forks.ts), which read the tick.
 */

/** One side of a fork. */
export type ForkSideId =
  | "fresnel"
  | "crews"
  | "coal"
  | "wind"
  | "swarm"
  | "mirrors"
  | "release"
  | "keep";

export type ForkId = "coast" | "night" | "sky" | "last";

export const forkFlag = (side: ForkSideId): string => `fork-${side}`;

/** True once this side was chosen (and so, the other one never will be). */
export const hasFork = (run: RunState, side: ForkSideId): boolean =>
  run.flags[forkFlag(side)] === true;

const F = TUNING.fork;

/**
 * How far the wind farms are built, 0..1: they take a while. Buying the
 * wind side starts the clock (`forkWindAt`); a save with the flag and no
 * clock reads as built.
 */
export function windRamp(run: RunState): number {
  if (!hasFork(run, "wind")) return 0;
  const at = run.resources.forkWindAt;
  if (at === undefined || !Number.isFinite(at)) return 1;
  return Math.min(1, Math.max(0, (run.time - at) / F.night.windRampSeconds));
}

/** Records the side and starts anything that grows from the moment it is chosen. */
export function markFork(run: RunState, side: ForkSideId): void {
  run.flags[forkFlag(side)] = true;
  if (side === "wind") run.resources.forkWindAt = run.time;
}
