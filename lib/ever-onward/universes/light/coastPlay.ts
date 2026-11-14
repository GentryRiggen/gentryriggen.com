import { manualAction, newRun, performAction } from "../../engine/engine";
import type { RunState } from "../../engine/types";
import { lightUniverse as def } from ".";
import { beamActionId, bestBeamStep } from "./beam";
import { barrelOil, beamStep, goingRate, tankCapacity } from "./tick";
import { isTankerIn } from "./tanker";
import {
  TOLL_STEPS,
  shipShare,
  tollActionId,
  tollLockLeft,
  tollStep,
} from "./toll";
import { bestTollStep } from "./tollRead";

/**
 * The Coast's three dials, played for real: every second the sim taps, ticks
 * the world, and buys oil with real coins at the real price (a rush order, a
 * tanker's deal, the market), so the oil bill is paid, not assumed. Used by
 * the toll, oil and brightness dominance tests.
 */

export const SECONDS = 1500;
/** Twelve different worlds (the seeds are spread so no two share a stream). */
export const SEEDS = Array.from({ length: 12 }, (_, i) => i * 7919 + 13);

export type Buy = (run: RunState) => boolean;
export type TollPolicy = number | "read" | "blind";

/** What the player has bought: early on, with a trimmed wick, and with the second wick and big tanks. */
export const STAGES: Record<string, Record<string, number>> = {
  early: {},
  "wick-1": { "wick-1": 1 },
  "wick-2 and big tanks": {
    "wick-1": 1,
    "wick-2": 1,
    "tank-1": 1,
    "tank-2": 1,
  },
};

export const level = (run: RunState): number =>
  run.resources.oil / tankCapacity(run);

/** The tolls that earn the most per ship before any oil is counted (ignores what a ship burns). */
export function blindTollStep(run: RunState): number {
  const rate = goingRate(run);
  let best = 0;
  TOLL_STEPS.forEach((s, i) => {
    if (
      s.pay * shipShare(s.pay, rate) >
      TOLL_STEPS[best].pay * shipShare(TOLL_STEPS[best].pay, rate)
    )
      best = i;
  });
  return best;
}

/** Coins after `SECONDS` of play with the given habits (oil bought for real). */
export function play(
  seed: number,
  stage: string,
  options: {
    buy: Buy;
    beam: number | null;
    toll: TollPolicy;
  }
): number {
  let run = newRun(def, undefined, seed);
  run.owned = {
    ...run.owned,
    keeper: 14,
    lighthouse: 2,
    lens: 2,
    ...STAGES[stage],
  };
  def.tick(run, 0.1);
  run.resources.oil = tankCapacity(run);
  run.resources.coins = 0;
  for (let t = 0; t < SECONDS; t += 1) {
    // The lamp is looked at every 5 seconds, the sign when it can change.
    if (t % 5 === 0) {
      const want = options.beam ?? bestBeamStep(run);
      if (want !== beamStep(run))
        run = performAction(def, run, beamActionId(want));
    }
    if (tollLockLeft(run) <= 0) {
      const want =
        options.toll === "read"
          ? bestTollStep(run)
          : options.toll === "blind"
            ? blindTollStep(run)
            : options.toll;
      if (want !== tollStep(run))
        run = performAction(def, run, tollActionId(want));
    }
    if (options.buy(run) && barrelOil(run) > 0.1 * tankCapacity(run))
      run = performAction(def, run, "buy-oil");
    for (let tap = 0; tap < 3; tap += 1) run = manualAction(def, run);
    def.tick(run, 1);
  }
  return run.resources.coins;
}

export const total = (
  stage: string,
  options: Parameters<typeof play>[2]
): number => SEEDS.reduce((sum, seed) => sum + play(seed, stage, options), 0);

// ---------------------------------------------------------------- Buying

/**
 * Reads the market: any tanker below a fair price, any dip that is cheap for
 * how full the tank is (the emptier, the more it accepts), and never lets the
 * tank run into a rush order.
 */
export const readsTheMarket: Buy = (run) => {
  const l = level(run);
  const price = run.resources.oilPrice;
  return (
    l < 0.15 ||
    (isTankerIn(run) && price < 2 && l < 0.9) ||
    (price < 1 + 3 * (1 - l) * (1 - l) && l < 0.97)
  );
};

/** Habits that watch the price against one fixed line (a reading rule too, just a rigid one). */
export const FIXED_LINES: readonly string[] = [
  "waits for a price under 1, then emergency",
  "waits for a price under 1.4, then emergency",
  "waits for a price under 1.8, then emergency",
];

/** Habits that need no reading. */
export const HABITS: Record<string, Buy> = {
  "tops up under a quarter": (run) => level(run) < 0.25,
  "fills whenever there is room": (run) => level(run) < 0.9,
  "only from a tanker, or when dry": (run) =>
    (isTankerIn(run) && level(run) < 0.95) || level(run) <= 0.001,
  "tanker, or an emergency under 5%": (run) =>
    (isTankerIn(run) && level(run) < 0.95) || level(run) < 0.05,
  "waits for a price under 1, then emergency": (run) =>
    (run.resources.oilPrice < 1 && level(run) < 0.95) || level(run) < 0.05,
  "waits for a price under 1.4, then emergency": (run) =>
    (run.resources.oilPrice < 1.4 && level(run) < 0.95) || level(run) < 0.05,
  "waits for a price under 1.8, then emergency": (run) =>
    (run.resources.oilPrice < 1.8 && level(run) < 0.95) || level(run) < 0.05,
  "buys only when empty": (run) => level(run) < 0.05,
};

/** The buyer the toll and brightness tests use: a sensible, not clever, one. */
export const sensibleBuyer: Buy =
  HABITS["waits for a price under 1.4, then emergency"];
