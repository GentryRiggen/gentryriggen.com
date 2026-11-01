import { genericBots, type BotSet } from "../../engine/bots";
import { upgradeCost } from "../../engine/engine";
import type { Strategy } from "../../engine/sim";
import type { RunState, UpgradeDef } from "../../engine/types";
import { YARD_HARVEST, isWorthPicking } from "./actions";
import { seasonOf, secondsToAutumn } from "./seasons";
import { TUNING } from "./tuning";
import { STORAGE_IDS, isDry, rainOutlook } from "./water";
import { growUniverse } from ".";

type Actions = NonNullable<Strategy["actions"]>;

/** Seconds in one stretch of attention for the garden. */
const GARDEN_WINDOW = 30;

/** True for the one step at the start of each window (steps are 0.5 or 1 s). */
const isWindowStart = (run: RunState, seconds: number): boolean =>
  run.time % seconds < 0.5;

/** Picks the harvest at the start of each window, whatever the season. */
export const picksAnytime =
  (window = GARDEN_WINDOW): Actions =>
  (run, available) =>
    run.phase === 0 &&
    isWindowStart(run, window) &&
    isWorthPicking(run) &&
    available.includes(YARD_HARVEST)
      ? [YARD_HARVEST]
      : [];

/**
 * Picks in autumn, and waits for it when autumn is within one season. Ripe
 * produce never spoils, so waiting costs nothing but a little time.
 */
export const picksInAutumn =
  (window = GARDEN_WINDOW): Actions =>
  (run, available) => {
    if (run.phase !== 0 || !isWindowStart(run, window)) return [];
    const waits =
      seasonOf(run) !== "autumn" &&
      secondsToAutumn(run) <= TUNING.seasons.seconds;
    if (waits) return [];
    return isWorthPicking(run) && available.includes(YARD_HARVEST)
      ? [YARD_HARVEST]
      : [];
  };

/** Never picks by hand: the baskets do it. */
const picksNothing: Actions = () => [];

/** A storage upgrade the bot allows itself to buy right now. */
type StorageRule = (run: RunState) => boolean;

/** Builds storage only after the tank has run dry. */
const afterRunningDry: StorageRule = (run) => isDry(run);
/** Builds storage as soon as the rain outlook turns dry. */
const whenRainTurnsDry: StorageRule = (run) =>
  isDry(run) || rainOutlook(run) < TUNING.water.dryOutlook;

/** The tapper's shop, but storage only when `allows` says so. */
function withStorageRule(strategy: Strategy, allows: StorageRule): Strategy {
  const choose = (run: RunState, affordable: UpgradeDef[]) => {
    const open = affordable.filter(
      (u) => !STORAGE_IDS.includes(u.id) || allows(run)
    );
    if (strategy.choose) return strategy.choose(run, open);
    return [...open].sort(
      (a, b) =>
        (b.priority ?? 0) - (a.priority ?? 0) ||
        upgradeCost(run, a) - upgradeCost(run, b)
    )[0];
  };
  return { ...strategy, choose };
}

/** A strategy that plays the yard's harvest and water the given way. */
export function yardPlayer(
  base: Strategy,
  harvest: Actions,
  storage: StorageRule
): Strategy {
  return { ...withStorageRule(base, storage), actions: harvest };
}

/** The scorecard's player personalities for Make It Grow. */
export function growBots(): BotSet {
  const base = genericBots(growUniverse);
  const tapper = yardPlayer(base.tapper, picksAnytime(), whenRainTurnsDry);
  return {
    tapper,
    realistic: yardPlayer(base.realistic, picksInAutumn(45), whenRainTurnsDry),
    idle: {
      ...withStorageRule(base.idle, afterRunningDry),
      actions: picksNothing,
      greetAfter: Infinity,
    },
    dawdler: yardPlayer(base.dawdler, picksAnytime(60), afterRunningDry),
    skill: {
      0: {
        naive: yardPlayer(base.tapper, picksAnytime(), afterRunningDry),
        careful: yardPlayer(base.tapper, picksInAutumn(), whenRainTurnsDry),
      },
    },
    naiveOil: yardPlayer(base.tapper, picksAnytime(), afterRunningDry),
    cheapskateOil: tapper,
  };
}
