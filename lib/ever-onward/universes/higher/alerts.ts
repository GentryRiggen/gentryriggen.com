import type { RunState } from "../../engine/types";
import { toddlerSeconds, toddlerStage } from "./playroom";
import { swayOf } from "./sway";

/** The tower is wobbling above this. */
export const WOBBLE_AT = 0.7;

/** A kind heads-up: the town and sky tower lean (nothing falls); in the playroom, the toddler.  */
export function higherAlert(run: RunState): string | null {
  if (run.complete || run.phase > 2) return null;
  if (run.phase === 0) {
    const stage = toddlerStage(run);
    if (stage === "coming")
      return `The toddler is coming in ${toddlerSeconds(run)} seconds! Tumbles will be three times as likely while it stomps. Bank your streak or slow down.`;
    if (stage === "stomping")
      return "The toddler is stomping on the rug! The tower tumbles three times as easily until it goes.";
    return null;
  }
  if (swayOf(run) < WOBBLE_AT) return null;
  return "The tower is wobbling! The crew works at half speed until you press Steady. Braces, a good footing and hard hats make it wobble less.";
}
