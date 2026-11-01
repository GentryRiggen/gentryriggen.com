import { genericBots, type BotSet } from "../../engine/bots";
import { upgradeCost } from "../../engine/engine";
import type { Strategy } from "../../engine/sim";
import type { RunState, UpgradeDef } from "../../engine/types";
import { YARD_HARVEST, isWorthPicking } from "./actions";
import { danceHint, dancesSoFar, followActionId } from "./bees";
import {
  BIOMES,
  activeBiome,
  bestBiome,
  biomeValue,
  spreadActionId,
  type Biome,
} from "./biomes";
import { enterActionId, fairsSoFar, likeliestPumpkin } from "./fair";
import { flightsSoFar, mostWelcoming, sendActionId } from "./migration";
import {
  bestCrop,
  cropPrice,
  plantActionId,
  plantedCrop,
  type Crop,
} from "./market";
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

/**
 * Follows the dance to the patch it points at. A bot with real attention
 * misses now and then: it lets one dance in every `skipEvery`th go to the
 * keeper (counted by the bees themselves, so the sim stays deterministic).
 */
export const followsDance =
  (options: { skipEvery?: number } = {}): Actions =>
  (run, available) => {
    if (run.phase !== 0) return [];
    const { skipEvery } = options;
    const dance = dancesSoFar(run);
    if (skipEvery && dance % skipEvery === skipEvery - 1) return [];
    const id = followActionId(danceHint(run));
    return available.includes(id) ? [id] : [];
  };

/**
 * Enters the pumpkin with the best expected payout. Like the bee bot, one
 * fair in every `skipEvery`th goes to the fair helper instead.
 */
export const entersFair =
  (options: { skipEvery?: number } = {}): Actions =>
  (run, available) => {
    if (run.phase !== 1) return [];
    const { skipEvery } = options;
    if (skipEvery && fairsSoFar(run) % skipEvery === skipEvery - 1) return [];
    const id = enterActionId(likeliestPumpkin(run));
    return available.includes(id) ? [id] : [];
  };

/**
 * Sends the flock to the most welcoming region. Like the fair bot, one flight
 * in every `skipEvery`th goes to the flock leader instead.
 */
export const sendsFlock =
  (options: { skipEvery?: number } = {}): Actions =>
  (run, available) => {
    if (run.phase !== 2) return [];
    const { skipEvery } = options;
    if (skipEvery && flightsSoFar(run) % skipEvery === skipEvery - 1) return [];
    const id = sendActionId(mostWelcoming(run));
    return available.includes(id) ? [id] : [];
  };

/**
 * Looks at the market now and then and plants the crop the towns want most,
 * once it beats what is planted by `margin` (so it never chases a crumb).
 */
export const cropPolicy =
  (window = 10, margin = TUNING.market.playerMargin): Actions =>
  (run, available) => {
    if (run.phase !== 1 || !isWindowStart(run, window)) return [];
    const best = bestCrop(run);
    if (best === plantedCrop(run)) return [];
    if (cropPrice(run, best) < cropPrice(run, plantedCrop(run)) * margin)
      return [];
    const id = plantActionId(best);
    return available.includes(id) ? [id] : [];
  };

/** Plants this crop on the first look and never changes its mind. */
export const alwaysPlants =
  (crop: Crop): Actions =>
  (run, available) => {
    const id = plantActionId(crop);
    return run.phase === 1 &&
      plantedCrop(run) !== crop &&
      available.includes(id)
      ? [id]
      : [];
  };

/**
 * Looks at the world now and then and spreads the biome worth the most,
 * once it beats the spreading one by `margin` (so it never chases a crumb).
 */
export const biomePolicy =
  (window = 15, margin = TUNING.world.playerMargin): Actions =>
  (run, available) => {
    if (run.phase !== 2 || !isWindowStart(run, window)) return [];
    const best = bestBiome(run);
    if (best === activeBiome(run)) return [];
    if (biomeValue(run, best) < biomeValue(run, activeBiome(run)) * margin)
      return [];
    const id = spreadActionId(best);
    return available.includes(id) ? [id] : [];
  };

/** Spreads this biome on the first look and never changes its mind. */
export const alwaysSpreads =
  (biome: Biome): Actions =>
  (run, available) => {
    const id = spreadActionId(biome);
    return run.phase === 2 &&
      activeBiome(run) !== biome &&
      available.includes(id)
      ? [id]
      : [];
  };

/** Every biome, for tests that want the list. */
export const ALL_BIOMES: readonly Biome[] = BIOMES;

/** Both choices at once, so a bot can pick and follow in the same step. */
const alongside =
  (a: Actions, b: Actions): Actions =>
  (run, available) => [...a(run, available), ...b(run, available)];

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
  const tapper = yardPlayer(
    base.tapper,
    alongside(
      picksAnytime(),
      alongside(
        followsDance(),
        alongside(
          cropPolicy(),
          alongside(entersFair(), alongside(biomePolicy(), sendsFlock()))
        )
      )
    ),
    whenRainTurnsDry
  );
  return {
    tapper,
    realistic: yardPlayer(
      base.realistic,
      alongside(
        picksInAutumn(45),
        alongside(
          followsDance({ skipEvery: 6 }),
          alongside(
            cropPolicy(20),
            alongside(
              entersFair({ skipEvery: 6 }),
              alongside(biomePolicy(30), sendsFlock({ skipEvery: 6 }))
            )
          )
        )
      ),
      whenRainTurnsDry
    ),
    idle: {
      ...withStorageRule(base.idle, afterRunningDry),
      actions: picksNothing,
      greetAfter: Infinity,
    },
    dawdler: yardPlayer(
      base.dawdler,
      alongside(
        picksAnytime(60),
        alongside(
          followsDance({ skipEvery: 2 }),
          alongside(
            cropPolicy(60),
            alongside(
              entersFair({ skipEvery: 2 }),
              alongside(biomePolicy(90), sendsFlock({ skipEvery: 2 }))
            )
          )
        )
      ),
      afterRunningDry
    ),
    skill: {
      2: {
        naive: yardPlayer(
          base.tapper,
          alongside(biomePolicy(), sendsFlock()),
          afterRunningDry
        ),
        careful: yardPlayer(
          base.tapper,
          alongside(biomePolicy(), sendsFlock()),
          whenRainTurnsDry
        ),
      },
      1: {
        naive: yardPlayer(
          base.tapper,
          alongside(cropPolicy(), entersFair()),
          afterRunningDry
        ),
        careful: yardPlayer(
          base.tapper,
          alongside(cropPolicy(), entersFair()),
          whenRainTurnsDry
        ),
      },
      0: {
        naive: yardPlayer(
          base.tapper,
          alongside(picksAnytime(), followsDance()),
          afterRunningDry
        ),
        careful: yardPlayer(
          base.tapper,
          alongside(picksInAutumn(), followsDance()),
          whenRainTurnsDry
        ),
      },
    },
    claim: {
      2: {
        ignores: yardPlayer(base.tapper, biomePolicy(), whenRainTurnsDry),
        claims: yardPlayer(
          base.tapper,
          alongside(biomePolicy(), sendsFlock()),
          whenRainTurnsDry
        ),
      },
      1: {
        ignores: yardPlayer(base.tapper, cropPolicy(), whenRainTurnsDry),
        claims: yardPlayer(
          base.tapper,
          alongside(cropPolicy(), entersFair()),
          whenRainTurnsDry
        ),
      },
      0: {
        ignores: yardPlayer(base.tapper, picksInAutumn(), whenRainTurnsDry),
        claims: yardPlayer(
          base.tapper,
          alongside(picksInAutumn(), followsDance()),
          whenRainTurnsDry
        ),
      },
    },
    naiveOil: yardPlayer(
      base.tapper,
      alongside(picksAnytime(), followsDance()),
      afterRunningDry
    ),
    cheapskateOil: tapper,
  };
}
