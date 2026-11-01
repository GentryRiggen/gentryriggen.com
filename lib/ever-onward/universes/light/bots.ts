import { genericBots, type BotSet } from "../../engine/bots";
import type { Strategy } from "../../engine/sim";
import type { RunState } from "../../engine/types";
import { tankCapacity } from "./tick";

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

const withOil = (strategy: Strategy, actions: OilChoice): Strategy => ({
  ...strategy,
  actions,
});

/** The scorecard's player personalities for Keep the Light On. */
export function lightBots(): BotSet {
  const base = genericBots();
  return {
    tapper: withOil(base.tapper, savvyOil),
    realistic: withOil(base.realistic, savvyOil),
    idle: withOil(base.idle, savvyOil),
    naiveOil: withOil(base.tapper, naiveOil),
    cheapskateOil: withOil(base.tapper, cheapskateOil),
  };
}
