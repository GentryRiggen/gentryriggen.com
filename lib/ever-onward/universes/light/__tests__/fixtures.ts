import { newRun } from "../../../engine/engine";
import { simulate, type Strategy } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { lightUniverse } from "..";
import { tankCapacity } from "../tick";

export const def = lightUniverse;

const MIN = 60;

/**
 * A player who buys oil when the price is under the usual (2.0) and the tank
 * has room, or whenever it runs low, fixes the grid and the fleet's heading
 * when they dip, and takes the bonuses on offer.
 */
export function oilActions(run: RunState, available: readonly string[]) {
  const picks: string[] = [];
  // Looks after what needs hands: the grid and the fleet when they dip, and
  // takes the bonuses on offer.
  for (const id of ["balance-grid", "correct-course"]) {
    const level =
      id === "balance-grid" ? run.resources.grid : run.resources.heading;
    if (available.includes(id) && level < 45) picks.push(id);
  }
  for (const id of ["ride-rush", "catch-flare"])
    if (available.includes(id)) picks.push(id);
  if (!available.includes("buy-oil")) return picks;
  const capacity = tankCapacity(run);
  const { oil, oilPrice } = run.resources;
  const isLow = oil < capacity * 0.15;
  const isBargain = oilPrice < 2 && oil < capacity * 0.6;
  return isLow || isBargain ? [...picks, "buy-oil"] : picks;
}

/**
 * Taps a lot for the first 10 minutes of each phase, then mostly watches;
 * shops every 10 seconds; buys oil when it is cheap.
 */
export const REALISTIC: Strategy = {
  tapRate: (run) => {
    const phaseStart = run.transitions.at(-1)?.at ?? 0;
    return run.time - phaseStart < 10 * MIN ? 3 : 0.3;
  },
  shopEvery: 10,
  actions: oilActions,
};

/** Taps all the time. */
export const ACTIVE: Strategy = {
  tapsPerSecond: 3,
  shopEvery: 10,
  actions: oilActions,
};

/** Resources a player spends; draining them is the worst a player can do. */
const SPENDABLE = ["coins", "oil", "power", "energy", "resolve"] as const;

export function drain(run: RunState): RunState {
  const resources = { ...run.resources };
  for (const id of SPENDABLE) resources[id] = 0;
  // The worst of the coast: a storm about to hit and the dearest oil. (Probes,
  // stars and lights stay: zeroing those would make the state impossible.)
  resources.storm = 0;
  resources.stormCooldown = 0;
  resources.oilPrice = 5;
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
    strategy: REALISTIC,
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
    strategy: ACTIVE,
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
