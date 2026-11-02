import type { RunState } from "../../engine/types";
import { isTired } from "./meter";

/** A kind heads-up: the crowd is worn out, but nothing is ever stuck. */
export function smileAlert(run: RunState): string | null {
  if (run.complete || !isTired(run)) return null;
  return run.phase === 2
    ? "Everyone is worn out! Pay is lower until the cheer meter cools. Masks, quiet hours and a little rest all help."
    : "The crowd is worn out! Pay is lower until the cheer meter cools. Benches, shady corners and a little rest all help.";
}
