import { genericBots, type BotSet } from "../../engine/bots";
import type { Strategy } from "../../engine/sim";
import type { RunState } from "../../engine/types";
import { TUNING } from "./tuning";
import { tankCapacity } from "./tick";

/** Seconds a busy player takes to notice an event (and claim its bonus). */
const NOTICE_SECONDS = 10;

type OilChoice = (run: RunState, available: readonly string[]) => string[];

const buysOilWhen =
  (
    wants: (oil: number, price: number, capacity: number) => boolean
  ): OilChoice =>
  (run, available) => {
    if (!available.includes("buy-oil")) return [];
    const { oil, oilPrice } = run.resources;
    return wants(oil, oilPrice, tankCapacity(run)) ? ["buy-oil"] : [];
  };

/** Buys when the tank is low or the price is under the usual 2.0. */
const savvyOil = buysOilWhen(
  (oil, price, capacity) =>
    oil < capacity * 0.15 || (price < 2 && oil < capacity * 0.6)
);
/** Buys when the tank is low, whatever the price. */
const naiveOil = buysOilWhen((oil, _price, capacity) => oil < capacity * 0.15);
/** Buys only on a bargain, or when the lamp is about to go out. */
const cheapskateOil = buysOilWhen(
  (oil, price, capacity) =>
    (price < 1.4 && oil < capacity * 0.8) || oil < capacity * 0.04
);

/**
 * Looks after what needs hands: the grid and the fleet's heading when they dip
 * under `below` percent, and claims the evening rush and the solar flare when
 * `claims` (a busy or relaxed player may let them pass).
 */
const looksAfterThings =
  (below: number, claims: boolean): OilChoice =>
  (run, available) => {
    const picks: string[] = [];
    if (available.includes("balance-grid") && run.resources.grid < below)
      picks.push("balance-grid");
    if (available.includes("correct-course") && run.resources.heading < below)
      picks.push("correct-course");
    // A player notices an event a few seconds after it starts, not at once.
    if (
      claims &&
      available.includes("ride-rush") &&
      run.resources.rush <= TUNING.night.rushLength - NOTICE_SECONDS
    )
      picks.push("ride-rush");
    if (
      claims &&
      available.includes("catch-flare") &&
      run.resources.flare <= TUNING.sky.flareLength - NOTICE_SECONDS
    )
      picks.push("catch-flare");
    return picks;
  };

const combine =
  (...choices: OilChoice[]): OilChoice =>
  (run, available) =>
    choices.flatMap((choose) => choose(run, available));

const withOil = (
  strategy: Strategy,
  actions: OilChoice,
  care: OilChoice = looksAfterThings(45, true)
): Strategy => ({
  ...strategy,
  actions: combine(actions, care),
});

/** The scorecard's player personalities for Keep the Light On. */
export function lightBots(): BotSet {
  const base = genericBots();
  return {
    tapper: withOil(base.tapper, savvyOil),
    realistic: withOil(base.realistic, savvyOil, looksAfterThings(42, true)),
    idle: withOil(base.idle, savvyOil, looksAfterThings(60, false)),
    dawdler: withOil(base.dawdler, savvyOil, looksAfterThings(35, false)),
    skill: {
      2: {
        naive: withOil(base.tapper, savvyOil, looksAfterThings(15, false)),
        careful: withOil(base.tapper, savvyOil, looksAfterThings(55, true)),
      },
      1: {
        naive: withOil(base.tapper, savvyOil, looksAfterThings(15, false)),
        careful: withOil(base.tapper, savvyOil, looksAfterThings(55, true)),
      },
    },
    naiveOil: withOil(base.tapper, naiveOil),
    cheapskateOil: withOil(base.tapper, cheapskateOil),
  };
}
