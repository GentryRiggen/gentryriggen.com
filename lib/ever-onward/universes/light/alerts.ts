import type { RunState } from "../../engine/types";
import { TUNING } from "./tuning";

const C = TUNING.coast;

/**
 * A warning the player should see right now, or null. The coast's lamp
 * running dry is the one that matters: income keeps flowing (a dim lamp
 * still guides some ships, so nobody is ever stuck) but it is easy to miss.
 */
export function lightAlert(run: RunState): string | null {
  if (run.complete || run.phase !== 0) return null;
  if ((run.resources.oil ?? 0) > 0) return null;
  const less = Math.round((1 - C.dimLamp) * 100);
  return `Out of oil! The lamp is dim, so ships pay ${less}% less. Buy oil to light it up.`;
}
