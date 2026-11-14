import { genericBots, type BotSet } from "../../engine/bots";
import { upgradeCost } from "../../engine/engine";
import type { Strategy } from "../../engine/sim";
import type { RunState, UpgradeDef } from "../../engine/types";
import { YARD_HARVEST, isWorthPicking } from "./actions";
import {
  BEDS,
  SELL_HALF_ID,
  addBeeActionId,
  beesOn,
  bloomOf,
  honeyOf,
  isBeesOpen,
  isDormant,
  isPlanted,
  plantActionId as beePlantId,
  takeBeeActionId,
  winterEats,
  winterNeeds,
} from "./bees";
import {
  BIOMES,
  isBiomeLocked,
  lessActionId,
  moreActionId,
  pointsOf,
  type Biome,
} from "./biomes";
import {
  ENTER_ACTION_ID,
  FEED_ACTION_ID,
  entriesSoFar,
  pumpkinStep,
} from "./pumpkin";
import {
  CROPS,
  daySeconds,
  forecastOf,
  grownIfPlantedIn,
  growPay,
  isFieldPlanted,
  plantActionId,
  soilOf,
  wearsSoil,
  type FieldCrop,
} from "./market";
import { seasonOf, seasonSecondsLeft, secondsToAutumn } from "./seasons";
import { shownProjects } from "../../engine/engine";
import { FESTIVAL_ACTION_ID, festivalCost, knowhowOf } from "./knowhow";
import { currentFork, forkActionId, type ForkSide } from "./forks";
import { TUNING } from "./tuning";
import { STORAGE_IDS, isDry, rainOutlook, waterLevel } from "./water";
import {
  SHADE_ACTION_ID,
  SUN_ACTION_ID,
  isBlindMoving,
  leafOf,
  leafSeconds,
} from "./windowbox";
import { growUniverse } from ".";

type Actions = NonNullable<Strategy["actions"]>;

/**
 * A bot that lets one in a few side-machine choices go to the helper still
 * takes it after this long, so a skipped choice never stalls the bot.
 */
const SKIP_DELAY = 45;

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

/** Bees the bot wants on each bed (clover, sunflower, lavender, apple). */
const BEE_PLAN = { clover: 3, sunflower: 4, lavender: 2, apple: 3 } as const;

/**
 * Tends the bees like a careful player: plants every bed it can afford,
 * spreads bees to a plan (the apple tree only in autumn), calls a bee home
 * from a bed that is wearing thin, keeps enough honey for winter and sells
 * the rest (more of it in winter, when the price is best).
 */
export const tendsBees: Actions = (run, available) => {
  if (!isBeesOpen(run)) return [];
  const picks: string[] = [];
  const ok = (id: string) => available.includes(id);
  BEDS.forEach((bed, i) => {
    if (!isPlanted(run, i)) {
      if (ok(beePlantId(i))) picks.push(beePlantId(i));
      return;
    }
    let want: number = BEE_PLAN[bed.kind];
    if (bed.kind === "apple" && seasonOf(run) !== "autumn") want = 0;
    if (bloomOf(run, i) < 0.35) want = Math.min(want, beesOn(run, i) - 1);
    else if (bloomOf(run, i) < 0.55) want = Math.min(want, beesOn(run, i));
    if (beesOn(run, i) > want && ok(takeBeeActionId(i)))
      picks.push(takeBeeActionId(i));
    else if (beesOn(run, i) < want && ok(addBeeActionId(i)))
      picks.push(addBeeActionId(i));
  });
  if (picks.length > 0) return picks.slice(0, 1);
  // Keep a winter's worth (what is left of this one, in winter), sell the
  // rest: half at a time, so a sale is a step, not a habit.
  const keep = isDormant(run)
    ? winterEats(run) * seasonSecondsLeft(run) * 1.2
    : winterNeeds(run) * 1.4;
  if (honeyOf(run) > keep * 2 + 5 && ok(SELL_HALF_ID)) return [SELL_HALF_ID];
  return [];
};

/** Steps the bot feeds the prize pumpkin to before it enters it. */
const PUMPKIN_TARGET = 4;

/**
 * Tends the prize pumpkin: feeds it a step on each harvest day until it is
 * big enough, then enters it. Like the bee bot, one entry in every
 * `skipEvery`th goes to the fair helper instead (or after SKIP_DELAY).
 */
export const feedsPumpkin =
  (options: { skipEvery?: number; target?: number } = {}): Actions =>
  (run, available) => {
    if (run.phase !== 1) return [];
    const { skipEvery, target = PUMPKIN_TARGET } = options;
    const wantsEntry = pumpkinStep(run) >= target;
    if (
      wantsEntry &&
      skipEvery &&
      entriesSoFar(run) % skipEvery === skipEvery - 1 &&
      daySeconds(run) < SKIP_DELAY
    )
      return [];
    const id = wantsEntry ? ENTER_ACTION_ID : FEED_ACTION_ID;
    return available.includes(id) ? [id] : [];
  };

/**
 * Reads the leaves and turns the blind: shade when they curl or crisp up
 * (the soil is drying), sun when they droop or go floppy (too wet). It waits
 * for the blind to finish moving, and for the leaves to have looked that way
 * for `reactAfter` seconds (a slower player notices later). It never looks at
 * the weather: the leaves are all it reads.
 */
export const readsLeaves =
  (reactAfter = 4): Actions =>
  (run, available) => {
    if (run.phase !== 3 || isBlindMoving(run)) return [];
    const leaf = leafOf(run);
    if (leaf === "perky" || leafSeconds(run) < reactAfter) return [];
    const id =
      leaf === "curl" || leaf === "dry" ? SHADE_ACTION_ID : SUN_ACTION_ID;
    return available.includes(id) ? [id] : [];
  };

/**
 * How much a bot likes planting a crop now: what the forecast expects, times
 * how grown it would be, less a worry about wearing the soil, plus a liking
 * for beans once the soil is tired.
 */
function plantValue(run: RunState, crop: FieldCrop): number {
  const pay = forecastOf(run, crop).middle * growPay(grownIfPlantedIn(run, 0));
  if (crop === "beans") return pay * (soilOf(run) < 0.5 ? 1.5 : 1);
  return wearsSoil(run, crop) ? pay * 0.65 : pay;
}

/**
 * Looks at the forecast and plants for harvest day once the day is
 * `plantAt` seconds old (so the forecast has firmed up a little): the crop
 * the forecast and the soil like best, beans when the soil is tired. It
 * plants into an empty field only, and never changes its mind.
 */
export const cropPolicy =
  (window = 10, plantAt = 38): Actions =>
  (run, available) => {
    if (run.phase !== 1 || !isWindowStart(run, window)) return [];
    if (isFieldPlanted(run) || daySeconds(run) < plantAt) return [];
    let best: FieldCrop = CROPS[0];
    for (const crop of [...CROPS, "beans" as const])
      if (plantValue(run, crop) > plantValue(run, best)) best = crop;
    const id = plantActionId(best);
    return available.includes(id) ? [id] : [];
  };

/** Plants this crop into every empty field at once, whatever the forecast. */
export const alwaysPlants =
  (crop: FieldCrop): Actions =>
  (run, available) => {
    const id = plantActionId(crop);
    return run.phase === 1 && !isFieldPlanted(run) && available.includes(id)
      ? [id]
      : [];
  };

/** What a player who only wants the most green sets, and leaves. */
const GREEDY_MIX: Readonly<Record<Biome, number>> = {
  forest: 7,
  jungle: 7,
  meadow: 3,
  wetland: 3,
};

/** Slider points a careful bot spreads over the open kinds (a point is 5%). */
const CAREFUL_POINTS = 20;

/**
 * The mix a careful bot wants now. The world's fork leaves three kinds open
 * (the focus kind, jungle and meadow). The focus kind and the meadow take what
 * the jungle leaves; the jungle gets less while the tank is low or the rain is
 * dry, and more once the tank is full in a rainy spell. A point is 5% of the
 * mix, so a one point drift is left alone (see steerTo's tolerance) and the
 * bot does not flap across a line.
 */
export function idealMix(run: RunState): Record<Biome, number> {
  const open = BIOMES.filter((b) => !isBiomeLocked(run, b));
  const focus = open.find((b) => b !== "jungle" && b !== "meadow") ?? "forest";
  const level = waterLevel(run);
  const rain = rainOutlook(run);
  const jungle =
    level < 0.3 || rain < 0.3
      ? 4
      : level < 0.5 && rain < 0.5
        ? 5
        : level > 0.7 && rain > 0.55
          ? 8
          : 6;
  const mix: Record<Biome, number> = {
    forest: 0,
    jungle,
    meadow: CAREFUL_POINTS - jungle - 8,
    wetland: 0,
  };
  mix[focus] = 8;
  return mix;
}

/** Each biome's share of a mix, 0 to 1. */
function fractions(mix: Record<Biome, number>): Record<Biome, number> {
  const total = BIOMES.reduce((sum, b) => sum + mix[b], 0) || 1;
  return Object.fromEntries(BIOMES.map((b) => [b, mix[b] / total])) as Record<
    Biome,
    number
  >;
}

/**
 * Moves the sliders toward `want`: one point off the biome that asks for the
 * most too much and one onto the one that asks for the most too little, when
 * either is off by `tolerance` of the mix (so a near miss is left alone).
 */
function steerTo(
  run: RunState,
  available: readonly string[],
  want: Record<Biome, number>,
  tolerance = 0.07
): string[] {
  const goal = fractions(want);
  const now = fractions(
    Object.fromEntries(BIOMES.map((b) => [b, pointsOf(run, b)])) as Record<
      Biome,
      number
    >
  );
  const diff = (b: Biome) => goal[b] - now[b];
  // Only a move that gets closer: a point is worth 1/total of the mix.
  const total = BIOMES.reduce((sum, b) => sum + pointsOf(run, b), 0) || 1;
  tolerance = Math.max(tolerance, 0.6 / total);
  const ranked = [...BIOMES].sort((a, b) => diff(b) - diff(a));
  const picks: string[] = [];
  const up = ranked.find((b) => available.includes(moreActionId(b)));
  const down = [...ranked]
    .reverse()
    .find((b) => available.includes(lessActionId(b)));
  if (up && diff(up) >= tolerance) picks.push(moreActionId(up));
  if (down && diff(down) <= -tolerance) picks.push(lessActionId(down));
  return picks;
}

/**
 * Looks at the world now and then and moves the sliders toward the careful
 * mix (see idealMix), a point or two at a time.
 */
export const mixPolicy =
  (window = 15): Actions =>
  (run, available) =>
    run.phase === 2 && isWindowStart(run, window)
      ? steerTo(run, available, idealMix(run))
      : [];

/**
 * Sets the sliders to this mix on the first look and never touches them
 * again (the naive player: no eye on the water or the rot).
 */
export const setsMixOnce =
  (mix: Record<Biome, number>): Actions =>
  (run, available) =>
    run.phase === 2 ? steerTo(run, available, mix, 0.04) : [];

/**
 * Buys the given side of the current part's fork the moment it is open and
 * affordable. A fork costs less than the cheapest thing on offer when it
 * opens, so a bot that checks every step always gets there first.
 */
/** The side an engaged bot picks in each part: bees, crew, forest, night-light. */
const ENGAGED_SIDES: readonly ForkSide[] = [0, 0, 0, 1];

export const takesFork =
  (side?: ForkSide): Actions =>
  (run, available) => {
    const id = forkActionId(
      currentFork(run).id,
      side ?? ENGAGED_SIDES[run.phase] ?? 0
    );
    return available.includes(id) ? [id] : [];
  };

/**
 * Holds a festival when the know-how is there and no project is close: it
 * keeps back half of the cheapest project on offer, so ideas are not starved
 * by festivals (and festivals not by ideas).
 */
export const holdsFestival: Actions = (run, available) => {
  if (!available.includes(FESTIVAL_ACTION_ID)) return [];
  const shown = shownProjects(growUniverse, run);
  const reserve = shown.length
    ? 0.5 * Math.min(...shown.map((p) => p.costs[0].amount))
    : 0;
  return knowhowOf(run) >= festivalCost() + reserve ? [FESTIVAL_ACTION_ID] : [];
};

/** Both choices at once, so a bot can pick and follow in the same step. */
const alongside =
  (a: Actions, b: Actions): Actions =>
  (run, available) => [...a(run, available), ...b(run, available)];

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
  storage: StorageRule,
  fork: Actions = takesFork()
): Strategy {
  return {
    ...withStorageRule(base, storage),
    actions: alongside(fork, alongside(holdsFestival, harvest)),
  };
}

/** Takes the usual side everywhere but the world, where it takes `side`. */
export const takesWorldSide =
  (side: ForkSide): Actions =>
  (run, available) =>
    (run.phase === 2 ? takesFork(side) : takesFork())(run, available);

/**
 * A player who sets the world's sliders once and leaves them, with the given
 * side of the world's fork (the sweep and the guard test use it).
 */
export function staticMixPlayer(
  mix: Record<Biome, number>,
  side: ForkSide = 0
): Strategy {
  return yardPlayer(
    genericBots(growUniverse).tapper,
    setsMixOnce(mix),
    whenRainTurnsDry,
    takesWorldSide(side)
  );
}

/** A player who keeps adjusting the sliders, with the given world side. */
export function adjustingPlayer(side: ForkSide = 0): Strategy {
  return yardPlayer(
    genericBots(growUniverse).tapper,
    mixPolicy(),
    whenRainTurnsDry,
    takesWorldSide(side)
  );
}

/** The scorecard's player personalities for Make It Grow. */
export function growBots(): BotSet {
  const base = genericBots(growUniverse);
  const tapper = yardPlayer(
    base.tapper,
    alongside(
      picksAnytime(),
      alongside(
        tendsBees,
        alongside(
          cropPolicy(),
          alongside(feedsPumpkin(), alongside(mixPolicy(), readsLeaves(6)))
        )
      )
    ),
    whenRainTurnsDry
  );
  return {
    tapper,
    // The realistic player takes the wetland in the world (the tapper takes
    // the old forest), so both sides of that fork are played.
    realistic: yardPlayer(
      base.realistic,
      alongside(
        picksInAutumn(45),
        alongside(
          tendsBees,
          alongside(
            cropPolicy(20, 45),
            alongside(
              feedsPumpkin({ skipEvery: 6 }),
              alongside(mixPolicy(30), readsLeaves(5))
            )
          )
        )
      ),
      whenRainTurnsDry,
      takesWorldSide(1)
    ),
    idle: {
      ...withStorageRule(base.idle, afterRunningDry),
      projects: "best",
      actions: takesFork(1),
      greetAfter: Infinity,
    },
    dawdler: yardPlayer(
      base.dawdler,
      alongside(
        picksAnytime(60),
        alongside(
          tendsBees,
          alongside(
            cropPolicy(60, 70),
            alongside(
              feedsPumpkin({ skipEvery: 2 }),
              alongside(mixPolicy(90), readsLeaves(10))
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
          setsMixOnce(GREEDY_MIX),
          afterRunningDry
        ),
        careful: yardPlayer(base.tapper, mixPolicy(), whenRainTurnsDry),
      },
      1: {
        naive: yardPlayer(
          base.tapper,
          alongside(cropPolicy(), feedsPumpkin()),
          afterRunningDry
        ),
        careful: yardPlayer(
          base.tapper,
          alongside(cropPolicy(), feedsPumpkin()),
          whenRainTurnsDry
        ),
      },
      0: {
        naive: yardPlayer(
          base.tapper,
          alongside(picksAnytime(), tendsBees),
          afterRunningDry
        ),
        careful: yardPlayer(
          base.tapper,
          alongside(picksInAutumn(), tendsBees),
          whenRainTurnsDry
        ),
      },
    },
    claim: {
      1: {
        ignores: yardPlayer(base.tapper, cropPolicy(), whenRainTurnsDry),
        claims: yardPlayer(
          base.tapper,
          alongside(cropPolicy(), feedsPumpkin()),
          whenRainTurnsDry
        ),
      },
      0: {
        ignores: yardPlayer(base.tapper, picksInAutumn(), whenRainTurnsDry),
        claims: yardPlayer(
          base.tapper,
          alongside(picksInAutumn(), tendsBees),
          whenRainTurnsDry
        ),
      },
    },
    naiveOil: yardPlayer(
      base.tapper,
      alongside(picksAnytime(), tendsBees),
      afterRunningDry
    ),
    cheapskateOil: tapper,
  };
}
