import { genericBots, type BotSet } from "../../engine/bots";
import type { Strategy } from "../../engine/sim";
import type { RunState } from "../../engine/types";
import { barrelOil, tankCapacity } from "./tick";

/** The smallest share of the tank a bot bothers to buy in one click. */
const MIN_BARREL_SHARE = 0.4;
/** ... or this much when the lamp is nearly dry. */
const MIN_DRY_BARREL_SHARE = 0.25;

type OilChoice = (run: RunState, available: readonly string[]) => string[];

const buysOilWhen =
  (
    wants: (oil: number, price: number, capacity: number) => boolean
  ): OilChoice =>
  (run, available) => {
    if (!available.includes("buy-oil")) return [];
    const { oil, oilPrice } = run.resources;
    const capacity = tankCapacity(run);
    // A click worth making brings a real share of the tank: nobody clicks
    // for one more drop.
    const barrel = barrelOil(run);
    const isWorthIt =
      barrel >= capacity * MIN_BARREL_SHARE ||
      (oil < capacity * 0.15 && barrel >= capacity * MIN_DRY_BARREL_SHARE);
    return isWorthIt && wants(oil, oilPrice, capacity) ? ["buy-oil"] : [];
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
    // The first ship: steer it when it drifts, and the one flash that ends it.
    if (
      available.includes("steer-boat") &&
      (run.resources.boatHeading ?? 100) < below
    )
      picks.push("steer-boat");
    if (available.includes("flash-lamp")) picks.push("flash-lamp");
    // The windows wait for the player, so a claiming bot takes them at once.
    if (claims && available.includes("ride-rush")) picks.push("ride-rush");
    if (claims && available.includes("catch-flare")) picks.push("catch-flare");
    return picks;
  };

const combine =
  (...choices: OilChoice[]): OilChoice =>
  (run, available) =>
    choices.flatMap((choose) => choose(run, available));

/** The ending: steer the boat when it drifts, make the one flash. */
const lastPhaseActions: OilChoice = (run, available) => [
  ...(available.includes("steer-boat") &&
  (run.resources.boatHeading ?? 100) < 50
    ? ["steer-boat"]
    : []),
  ...(available.includes("flash-lamp") ? ["flash-lamp"] : []),
];

const withOil = (
  strategy: Strategy,
  actions: OilChoice,
  care: OilChoice = looksAfterThings(45, true)
): Strategy => ({
  ...strategy,
  actions: combine(actions, care),
});

/** Tends at `below` percent and claims, or not: one dial of a skill pair. */
const tender = (base: Strategy, below: number, claims: boolean): Strategy =>
  withOil(base, savvyOil, looksAfterThings(below, claims));

/** The scorecard's player personalities for Keep the Light On. */
export function lightBots(): BotSet {
  const base = genericBots();
  // The idle bot never presses a button outside the last phase (where the
  // ending is the story): it taps early and watches.
  const idleActions: OilChoice = (run, available) =>
    run.phase >= 3 ? lastPhaseActions(run, available) : [];
  const tendPair = {
    naive: tender(base.tapper, 15, true),
    careful: tender(base.tapper, 55, true),
  };
  const claimPair = {
    ignores: tender(base.tapper, 55, false),
    claims: tender(base.tapper, 55, true),
  };
  return {
    tapper: withOil(base.tapper, savvyOil),
    realistic: withOil(base.realistic, savvyOil, looksAfterThings(42, true)),
    idle: { ...base.idle, actions: idleActions, greetAfter: Infinity },
    dawdler: {
      ...withOil(base.dawdler, savvyOil, looksAfterThings(35, false)),
      greetAfter: 60,
    },
    // In the last phase "tending" is tapping the flame: a player who barely
    // taps against one who does.
    skill: {
      1: tendPair,
      2: tendPair,
      3: {
        naive: { ...base.tapper, tapsPerSecond: 0.5, actions: idleActions },
        careful: { ...base.tapper, actions: idleActions },
      },
    },
    claim: { 1: claimPair, 2: claimPair },
    naiveOil: withOil(base.tapper, naiveOil),
    cheapskateOil: withOil(base.tapper, cheapskateOil),
  };
}
