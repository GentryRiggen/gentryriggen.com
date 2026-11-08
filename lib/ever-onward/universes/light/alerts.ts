import type { RunState } from "../../engine/types";
import { FLAME_COLD } from "./goal";
import { flameFraction } from "./tick";

/**
 * A warning the player should see right now, or null. The coast's lamp
 * running dry is the one that matters: a dark lamp guides almost no ships
 * (and the ones that stayed away take a while to come back).
 */
export function lightAlert(run: RunState): string | null {
  if (run.complete) return null;
  if (run.phase === 3)
    return flameFraction(run) <= FLAME_COLD
      ? "The flame is cold! Tap Tend to warm it. A warm flame earns resolve faster."
      : null;
  if (run.phase !== 0) return null;
  if ((run.resources.oil ?? 0) > 0) return null;
  return "Out of oil! The lamp is dark, and ships are keeping away. Buy oil to light it.";
}
