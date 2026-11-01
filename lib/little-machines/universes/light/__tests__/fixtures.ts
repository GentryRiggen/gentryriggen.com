import { newRun } from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { lightUniverse } from "..";

export const def = lightUniverse;

/** Resources a player spends; draining them is the worst a player can do. */
const SPENDABLE = ["coins", "oil", "power", "energy", "resolve"] as const;

export function drain(run: RunState): RunState {
  const resources = { ...run.resources };
  for (const id of SPENDABLE) resources[id] = 0;
  return { ...run, resources };
}

/** A fresh run played (by the default bot) until it enters `phase`. */
export function runAtPhaseStart(
  phase: number,
  options: { prestige?: Record<string, number> } = {}
): RunState {
  if (phase === 0) return newRun(def, options.prestige);
  const result = simulate(def, {
    maxSeconds: 5 * 3600,
    step: 1,
    prestige: options.prestige,
    stopWhen: (run) => run.phase >= phase,
  });
  return result.finalRun;
}

/** The default bot's run, stopped at `time` seconds. */
export function runAtTime(time: number): RunState {
  return simulate(def, {
    maxSeconds: time,
    step: 1,
    stopWhen: (run) => run.time >= time,
  }).finalRun;
}

/** A level-1 prestige purchase that costs 16 of the 18 embers a run earns. */
export const MODEST_PRESTIGE: Record<string, number> = {
  "ember-tempo": 1,
  "ember-tap": 1,
  "ember-keeper": 1,
  "ember-thrift": 1,
  "ember-gift": 1,
};
