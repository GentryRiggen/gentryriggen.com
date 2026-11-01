import type { RunState } from "../../engine/types";
import { isDry } from "./water";

/** A kind heads-up: the garden is thirsty, but nothing is ever stuck. */
export function growAlert(run: RunState): string | null {
  if (run.complete || run.phase > 2) return null;
  if (!isDry(run)) return null;
  if (run.phase === 2)
    return "The land is thirsty! Growth slows to half until it rains, or you bend a river or seed a cloud. Thirsty jungles drink the most.";
  if (run.phase === 1)
    return "The fields are thirsty! Crops grow at half speed until it rains or you dig a well.";
  return "The garden is thirsty! Plants grow at half speed until it rains or you build more water storage.";
}
