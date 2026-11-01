import type { RunState } from "../../engine/types";
import { isDry } from "./water";

/** A kind heads-up: the garden is thirsty, but nothing is ever stuck. */
export function growAlert(run: RunState): string | null {
  if (run.complete || run.phase > 1) return null;
  if (!isDry(run)) return null;
  if (run.phase === 1)
    return "The fields are thirsty! Crops grow at half speed until it rains or you dig a well.";
  return "The garden is thirsty! Plants grow at half speed until it rains or you build more water storage.";
}
