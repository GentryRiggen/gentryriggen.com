import type { RunState } from "../../engine/types";
import { isTired } from "./meter";
import { STREETS, grumpyCount, isGrumpy, isTownOpen } from "./town";

/** A kind heads-up: a street is grumpy, or the world is worn out. Nothing is ever stuck. */
export function smileAlert(run: RunState): string | null {
  if (run.complete) return null;
  if (isTownOpen(run) && grumpyCount(run) > 0) {
    const names = STREETS.filter((_, i) => isGrumpy(run, i)).map((s) => s.name);
    return `${names.join(" and ")} ${names.length > 1 ? "are" : "is"} grumpy! A street with no float cheers less and drags the town down. Send it one.`;
  }
  if (!isTired(run)) return null;
  return "Everyone is worn out! Pay is lower until the cheer meter cools. Masks, quiet hours and a little rest all help.";
}
