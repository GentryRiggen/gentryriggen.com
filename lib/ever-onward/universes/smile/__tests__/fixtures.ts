import { newRun } from "../../../engine/engine";
import { genericBots } from "../../../engine/bots";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { smileUniverse } from "..";

export const def = smileUniverse;

/** A fresh run played (by the eager tapper) until it enters phase `index`. */
export function runAtPhaseStart(index: number): RunState {
  if (index === 0) return newRun(def);
  return simulate(def, {
    maxSeconds: 8 * 3600,
    step: 1,
    strategy: genericBots(def).tapper,
    stopWhen: (run) => run.phase >= index,
  }).finalRun;
}
