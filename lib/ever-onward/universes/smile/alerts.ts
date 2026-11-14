import type { RunState } from "../../engine/types";
import { STREETS, grumpyCount, isGrumpy, isTownOpen } from "./town";
import { realOf, isWorldOpen } from "./world";

/** A kind heads-up: a street is grumpy, or most smiles are painted. Nothing is ever stuck. */
export function smileAlert(run: RunState): string | null {
  if (run.complete) return null;
  if (isTownOpen(run) && grumpyCount(run) > 0) {
    const names = STREETS.filter((_, i) => isGrumpy(run, i)).map((s) => s.name);
    return `${names.join(" and ")} ${names.length > 1 ? "are" : "is"} grumpy! A street with no float cheers less and drags the town down. Send it one.`;
  }
  if (isWorldOpen(run) && realOf(run) < 0.25)
    return "Most of the smiles are painted on now. A quieter loudspeaker or a listening bench lets real ones back.";
  return null;
}
