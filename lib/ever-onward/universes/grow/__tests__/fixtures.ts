import { newRun, upgradeCost } from "../../../engine/engine";
import { genericBots } from "../../../engine/bots";
import { simulate, type Strategy } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { growBots } from "../bots";
import { SEASONS, type Season } from "../seasons";
import { TUNING } from "../tuning";
import { growUniverse } from "..";

export const def = growUniverse;

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

/** The run with exactly this much in the water tank. */
export function withWater(run: RunState, amount: number): RunState {
  return { ...run, resources: { ...run.resources, tank: amount } };
}

/** A fresh yard run at the very start of the given season. */
export function inSeason(season: Season): RunState {
  const run = newRun(def);
  return { ...run, time: SEASONS.indexOf(season) * TUNING.seasons.seconds };
}

/** The eager tapper, who never buys the upgrades with these ids. */
export function neverBuys(ids: readonly string[]): Strategy {
  const base = growBots().tapper;
  return {
    ...base,
    choose: (run, affordable) => {
      const open = affordable.filter((u) => !ids.includes(u.id));
      if (base.choose) return base.choose(run, open);
      return [...open].sort(
        (a, b) =>
          (b.priority ?? 0) - (a.priority ?? 0) ||
          upgradeCost(run, a) - upgradeCost(run, b)
      )[0];
    },
  };
}
