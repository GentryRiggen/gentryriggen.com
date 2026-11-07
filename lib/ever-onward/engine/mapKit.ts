import type { RunState } from "./types";

/**
 * Small helpers for map data: artifacts and squares stack, so they multiply
 * or add onto whatever the keepsake (and earlier artifacts) already set.
 */
export const mul = (run: RunState, mod: string, by: number): void => {
  run.mods[mod] = (run.mods[mod] ?? 1) * by;
};

export const add = (run: RunState, mod: string, by: number): void => {
  run.mods[mod] = (run.mods[mod] ?? 0) + by;
};

/**
 * Extra helpers of `id` at the start of every run, never past the upgrade's
 * `max` (a reload would clamp and refund the extra).
 */
export const helpers = (
  run: RunState,
  id: string,
  n: number,
  max: number
): void => {
  run.owned[id] = Math.min(max, (run.owned[id] ?? 0) + n);
};
