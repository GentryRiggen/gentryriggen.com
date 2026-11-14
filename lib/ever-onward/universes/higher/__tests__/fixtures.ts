import { newRun } from "../../../engine/engine";
import { genericBots } from "../../../engine/bots";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { higherUniverse } from "..";

export const def = higherUniverse;

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

/** The run with exactly these resources set. */
export function withResources(
  run: RunState,
  resources: Record<string, number>
): RunState {
  return { ...run, resources: { ...run.resources, ...resources } };
}

/** The run with exactly these upgrades owned (and nothing else). */
export function withOwned(
  run: RunState,
  owned: Record<string, number>
): RunState {
  return { ...run, owned };
}
