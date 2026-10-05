import type { SimState } from "./types";

/** Where the sea floor is, world units below the normal waterline. */
export const FLOOR_DEPTH = 45;

/**
 * "Follow her down": continues a finished trial that sank, taking her (or
 * both halves) on to the sea floor. Any other state comes back unchanged.
 */
export function startDescent(state: SimState): SimState {
  if (state.phase !== "done" || state.outcome !== "sank") return state;
  return { ...state, phase: "descending" };
}

/** One descent step. Contract stub: Task 1 replaces the body. */
export function stepDescent(state: SimState): SimState {
  return { ...state, phase: "done" };
}
