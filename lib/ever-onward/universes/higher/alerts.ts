import type { RunState } from "../../engine/types";
import { swayOf } from "./sway";

/** The tower is wobbling above this. */
export const WOBBLE_AT = 0.7;

/** A kind heads-up: the tower leans, but nothing is ever knocked down. */
export function higherAlert(run: RunState): string | null {
  if (run.complete || run.phase > 2) return null;
  if (swayOf(run) < WOBBLE_AT) return null;
  return "The tower is wobbling! The crew works at half speed until you press Steady. Braces, a good footing and hard hats make it wobble less.";
}
