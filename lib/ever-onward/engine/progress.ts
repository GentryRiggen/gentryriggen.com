import type { UniverseSave } from "./types";

/** A universe the player has actually played (not just opened). */
export function hasStartedUniverse(universe: UniverseSave): boolean {
  return (
    universe.completions > 0 || universe.run.time > 0 || universe.run.taps > 0
  );
}
