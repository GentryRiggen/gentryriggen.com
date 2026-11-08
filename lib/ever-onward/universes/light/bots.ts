import { genericBots, type BotSet } from "../../engine/bots";
import type { Strategy } from "../../engine/sim";
import type { RunState, UpgradeDef } from "../../engine/types";
import {
  barrelOil,
  demandAtStep,
  isBeamOpen,
  beamStep,
  isLampsOpen,
  knowhowAtStep,
  lampChosen,
  supplyMW,
  tankCapacity,
} from "./tick";
import { lampActionId } from "./lamps";
import { beamActionId, beamNumbers, bestBeamStep } from "./beam";
import {
  isMaxed,
  shownProjects,
  upgradeCost,
  visibleUpgrades,
} from "../../engine/engine";
import {
  DEPOSIT_SHARES,
  WITHDRAW_ACTION,
  depositActionId,
  fundBalance,
  fundKind,
  fundPayout,
  isFundOpen,
} from "./fund";
import { lightUniverse } from ".";
import { cloneRun } from "../../engine/engine";
import { chosenSide, forkActionId, forkOf, chooseSide } from "./forks";
import type { ForkDef, ForkSide } from "./forks";
import { fundIncome } from "./tick";
import { OVERDRIVE_ACTION, isOverdriveOpen, overdriveCost } from "./overdrive";
import { cometCloseness, isProbeOut, launchActionId } from "./probes";
import {
  PICK_ACTION,
  WATER_ACTION,
  bloomCount,
  growingCount,
  thirstyCount,
} from "./garden";
import { tollActionId, tollLockLeft, tollStep } from "./toll";
import { bestTollStep, tollNet } from "./tollRead";
import { isTankerIn } from "./tanker";
import {
  POST_BUILD,
  POST_SCHOOL,
  POST_WATCH,
  chanceOf,
  crewCount,
  crewPostActionId,
  crewsAt,
  crewsPosted,
  isCommitted,
  forecastStep,
  frontsSoFar,
  isWeatherOpen,
  postOf,
  readyAtLandfall,
  sizeMult,
  stormSize,
  townWorth,
  readyShare,
  secondsToLandfall,
  weatherStage,
} from "./weather";
import {
  bestLampForTonight,
  gridClock,
  isGridOpen,
  isRushNow,
  rushOutcome,
  rushExcessAt,
  secondsToRush,
  batteryCharge,
  batteryCapacity,
  dailyChargeRoom,
} from "./grid";
import { TUNING } from "./tuning";

const W = TUNING.weather;

/** The smallest share of the tank a bot bothers to buy in one click. */
const MIN_BARREL_SHARE = 0.4;
/** The tank share under which a player buys whatever the coins allow. */
const PANIC_SHARE = 0.05;
/** ... or this much when the lamp is nearly dry. */
const MIN_DRY_BARREL_SHARE = 0.25;

/** Seconds in one stretch of attention for the garden (the bots' deterministic skips count these). */
const GARDEN_WINDOW_SECONDS = 30;

export type OilChoice = (
  run: RunState,
  available: readonly string[]
) => string[];

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
    // About to go dark: anyone buys what they can afford, however small.
    const isPanic = oil < capacity * PANIC_SHARE && barrel >= capacity * 0.03;
    return (isWorthIt && wants(oil, oilPrice, capacity)) || isPanic
      ? ["buy-oil"]
      : [];
  };

/**
 * Buys when the tank is low (never let the lamp go dark), or when a tanker is
 * in or the price is low and the tank has room worth filling.
 */
const savvyOil: OilChoice = (run, available) =>
  buysOilWhen(
    (oil, price, capacity) =>
      oil < capacity * 0.2 ||
      ((isTankerIn(run) || price < 1.2) && oil < capacity * 0.6)
  )(run, available);
/** Buys when the tank is low, whatever the price. */
const naiveOil = buysOilWhen((oil, _price, capacity) => oil < capacity * 0.15);
/** Buys only on a bargain, or when the lamp is about to go out. */
const cheapskateOil = buysOilWhen(
  (oil, price, capacity) =>
    (price < 1.2 && oil < capacity * 0.8) || oil < capacity * 0.04
);

/**
 * Looks after what needs hands: the fleet's heading when it dips under
 * `below` percent, and claims the solar flare when `claims` (a busy or
 * relaxed player may let it pass).
 */
const looksAfterThings =
  (below: number, claims: boolean): OilChoice =>
  (run, available) => {
    const picks: string[] = [];
    if (available.includes("correct-course") && run.resources.heading < below)
      picks.push("correct-course");
    // The first ship: steer it when it drifts, and the one flash that ends it.
    if (
      available.includes("steer-boat") &&
      (run.resources.boatHeading ?? 100) < below
    )
      picks.push("steer-boat");
    if (available.includes("flash-lamp")) picks.push("flash-lamp");
    // The window waits for the player, so a claiming bot takes it at once.
    if (claims && available.includes("catch-flare")) picks.push("catch-flare");
    return picks;
  };

/** How sure the forecast must be before a crew is sent at each step (the last step takes any that pays). */
const SURE_ENOUGH = [60, 45, 0] as const;

/**
 * Posts the crews. By default they build (a player who `learns` sends the last
 * crew to the school while a project waits only on know-how: building pays
 * more, so the bots' crews keep at it); and in a storm forecast the ones worth it go to the
 * likeliest towns. A crew sent to watch is committed until the storm lands
 * and builds nothing meanwhile, so a bot waits for a forecast sure enough for
 * the step (an early guess is a keepsake), then weighs what the town is worth
 * (its chance, how ready a crew would be, the bonus, the storm's size, the
 * town's worth and the outage it saves) against the building it gives up and
 * the road it pays for. A bot with real attention misses now and then: it
 * skips every `skipEvery`th front (counted by the desk, so the sim stays
 * deterministic), and `onlyEvery` makes a distracted player tend just one
 * front in so many.
 */
export const tendsCrews =
  (
    options: {
      skipEvery?: number;
      onlyEvery?: number;
      watches?: boolean;
      learns?: boolean;
      fromStep?: number;
      sureEnough?: readonly number[];
    } = {}
  ): OilChoice =>
  (run, available) => {
    if (run.phase !== 1) return [];
    const crews = crewCount(run);
    const front = frontsSoFar(run);
    const { skipEvery, onlyEvery } = options;
    const isInattentive =
      (skipEvery && front % skipEvery === skipEvery - 1) ||
      (onlyEvery && front % onlyEvery !== 0);
    // The last crew goes to the school while a project waits only on
    // know-how, and stays until it is done (no flip-flopping).
    const schoolCrew = crews - 1;
    const isLearning =
      options.learns === true &&
      wantsKnowhow(run, 120, {
        hasOverdrive: false,
        isStaying: postOf(run, schoolCrew) === POST_SCHOOL,
      });
    const committed = Array.from({ length: crews }, (_, c) => c).filter((c) =>
      isCommitted(run, c)
    );
    const wanted: number[] = [];
    const step = forecastStep(run);
    if (
      options.watches !== false &&
      !isInattentive &&
      isWeatherOpen(run) &&
      weatherStage(run) === "forecast" &&
      step >= (options.fromStep ?? WATCH_FROM_STEP)
    ) {
      const left = secondsToLandfall(run);
      const sure = (options.sureEnough ?? SURE_ENOUGH)[step - 1] ?? 0;
      const worth = (town: number): number =>
        (chanceOf(run, town) / 100) *
          (readyShare(readyAtLandfall(run, town, crewsAt(run, town) === 0)) *
            W.bonusSeconds *
            sizeMult(stormSize(run)) *
            townWorth(town) +
            W.outageShare * W.outageSeconds) -
        TUNING.crews.buildBoost * (left + 2 * TUNING.grid.moveSeconds) -
        // sandbags and wages for going out (a crew already there has paid)
        (crewsPosted(run, POST_WATCH + town) > 0
          ? 0
          : TUNING.grid.moveFeeSeconds);
      const room = crews - 1 - committed.length;
      [0, 1, 2]
        .filter((town) => chanceOf(run, town) >= sure)
        .sort((a, b) => worth(b) - worth(a))
        .forEach((town) => {
          if (wanted.length < room && worth(town) > 0)
            wanted.push(POST_WATCH + town);
        });
    }
    // Crews already on a wanted post stay. The others fill the rest: the one
    // at the school first (it is not building anyway), then the highest
    // builder, so the first crew keeps the building going.
    const posts: number[] = Array.from({ length: crews }, (_, c) =>
      postOf(run, c)
    );
    const baseOf = (crew: number): number =>
      crew === schoolCrew && isLearning ? POST_SCHOOL : POST_BUILD;
    const open = [...wanted];
    const taken = new Set<number>(committed);
    posts.forEach((post, c) => {
      if (taken.has(c)) return;
      const at = open.indexOf(post);
      if (at >= 0) {
        open.splice(at, 1);
        taken.add(c);
      }
    });
    const isIdle = (crew: number): boolean =>
      posts[crew] === POST_SCHOOL || baseOf(crew) === POST_SCHOOL;
    const free = posts
      .map((_, c) => c)
      .filter((c) => !taken.has(c))
      .sort((a, b) => Number(isIdle(b)) - Number(isIdle(a)) || b - a);
    const sent = new Map<number, number>();
    free.forEach((crew) => {
      const target = open.shift();
      if (target !== undefined) sent.set(crew, target);
    });
    const picks: string[] = [];
    posts.forEach((post, c) => {
      if (taken.has(c)) return;
      const target = sent.get(c) ?? baseOf(c);
      if (target === post) return;
      const id = crewPostActionId(c, target);
      if (available.includes(id)) picks.push(id);
    });
    return picks;
  };

/** The forecast step a bot starts weighing the towns from. */
const WATCH_FROM_STEP = 1;

/** Seconds in one stretch of attention for the harbor desk. */
const TOLL_WINDOW = 20;
/** A new toll must earn this much more than today's to be worth repainting the sign for. */
const TOLL_SWITCH_GAIN = 1.1;

/**
 * Reads the going rate off the rival's sign and sets the toll that earns the
 * most from it, when that beats today's by enough. A bot with real attention
 * looks in windows of 20 seconds and misses one window in every `skipEvery`th
 * (counted by the clock, so the sim stays deterministic); a distracted one
 * (`onlyEvery`) looks in just one window in so many. `step` makes a bot that
 * never reads the sign (it sets that toll once and leaves it).
 */
const setsToll =
  (
    options: { skipEvery?: number; onlyEvery?: number; step?: number } = {}
  ): OilChoice =>
  (run, available) => {
    const window = Math.floor(run.time / TOLL_WINDOW);
    const { skipEvery, onlyEvery, step } = options;
    if (skipEvery && window % skipEvery === skipEvery - 1) return [];
    if (onlyEvery && window % onlyEvery !== 0) return [];
    if (tollLockLeft(run) > 0) return [];
    const want = step ?? bestTollStep(run);
    const now = tollStep(run);
    if (want === now) return [];
    const gain = tollNet(run, want) / Math.max(tollNet(run, now), 1e-6);
    if (step === undefined && gain < TOLL_SWITCH_GAIN) return [];
    const id = tollActionId(want);
    return available.includes(id) ? [id] : [];
  };

/** Seconds in one stretch of attention for the probe races. */
const RACE_WINDOW = 30;

/**
 * Launches the racing probe whenever it sits at the dock, on the route that
 * fits the player: `comet` is how close the comet must be before the bot
 * chases it (it reads the bar), `plain` the route it flies otherwise (0 short
 * hop, 1 long loop). A bot with real attention misses now and then: it lets
 * the probe sit at the dock for one 30 s stretch in every `skipEvery`th
 * (counted by the clock, so the sim stays deterministic), and `onlyEvery`
 * makes a distracted player launch in just one stretch in so many. A probe at
 * the dock waits, so a miss costs only time.
 */
const racesProbes =
  (options: {
    comet: number;
    plain: number;
    skipEvery?: number;
    onlyEvery?: number;
  }): OilChoice =>
  (run, available) => {
    if (isProbeOut(run)) return [];
    const stretch = Math.floor(run.time / RACE_WINDOW);
    const { skipEvery, onlyEvery } = options;
    if (skipEvery && stretch % skipEvery === skipEvery - 1) return [];
    if (onlyEvery && stretch % onlyEvery !== 0) return [];
    const route = cometCloseness(run) >= options.comet ? 2 : options.plain;
    const id = launchActionId(route);
    return available.includes(id) ? [id] : [];
  };

/**
 * Waters the garden and picks the blooms. A bot with real attention looks in
 * on it in windows of 20 seconds and misses one window in every `skipEvery`
 * (counted by the clock, so the sim stays deterministic); a distracted one
 * (`onlyEvery`) looks in just one window in so many. Blooms wait and growth
 * only slows without water, so a miss costs nothing but time.
 */
const tendsGarden =
  (options: { skipEvery?: number; onlyEvery?: number } = {}): OilChoice =>
  (run, available) => {
    const window = Math.floor(run.time / GARDEN_WINDOW_SECONDS);
    const { skipEvery, onlyEvery } = options;
    if (skipEvery && window % skipEvery === skipEvery - 1) return [];
    if (onlyEvery && window % onlyEvery !== 0) return [];
    // Picks when a few blooms are ready, waters when every plant looks dry:
    // nobody taps the can while the soil is still wet.
    const picks =
      bloomCount(run) >= 2 && available.includes(PICK_ACTION)
        ? [PICK_ACTION]
        : [];
    const waters =
      growingCount(run) > 0 &&
      thirstyCount(run) === growingCount(run) &&
      available.includes(WATER_ACTION)
        ? [WATER_ACTION]
        : [];
    return [...picks, ...waters];
  };

/** Seconds before the rush a reading player sets the streetlights (they take a while to settle). */
const EVENING_LOOK = TUNING.grid.lampLockSeconds + 3;

/**
 * Sets the streetlights by the situation: soft enough to light the last
 * towns the moment the plants can (the phase ends); soft while a project on
 * offer waits only on know-how (quiet crews learn faster); otherwise
 * dazzling, and when the evening nears (`reads`) the brightest that still
 * gets through tonight's rush with every district lit. `patience` is how
 * many seconds of soft-glow learning a project may be away and still be
 * worth softening for. `fixed` never reads and never changes (a test's
 * player who set the knob once); `skipEvery` and `onlyEvery` are the days it
 * does not look.
 */
export const setsLamps =
  (
    options: {
      patience?: number;
      reads?: boolean;
      fixed?: number;
      skipEvery?: number;
      onlyEvery?: number;
    } = {}
  ): OilChoice =>
  (run, available) => {
    if (!isLampsOpen(run)) return [];
    const supply = supplyMW(run);
    const finishing = [3, 2, 1, 0].find(
      (step) => supply >= demandAtStep(run, step)
    );
    const days = run.resources.pgDays ?? 0;
    const { skipEvery, onlyEvery } = options;
    const isInattentive =
      (skipEvery && days % skipEvery === skipEvery - 1) ||
      (onlyEvery && days % onlyEvery !== 0);
    const clock = gridClock(run);
    // The reading is done as the evening nears and held through the rush.
    const isDusk =
      isGridOpen(run) &&
      clock >= TUNING.grid.rushAt - EVENING_LOOK &&
      clock < TUNING.grid.rushAt;
    const isRush = isRushNow(run);
    const base =
      options.fixed ??
      (wantsKnowhow(run, options.patience ?? 120, { hasOverdrive: false })
        ? 0
        : DAZZLING);
    const reading =
      options.fixed === undefined &&
      options.reads !== false &&
      !isInattentive &&
      isDusk
        ? Math.min(base, bestLampForTonight(run))
        : base;
    // Through the rush the streetlights are left as the evening set them.
    if (isRush && options.fixed === undefined && finishing === undefined)
      return [];
    const want =
      finishing !== undefined && options.fixed === undefined
        ? finishing
        : reading;
    if (want === lampChosen(run)) return [];
    const id = lampActionId(want);
    return available.includes(id) ? [id] : [];
  };

/** The brightest step: it pays the most when the evening is easy. */
const DAZZLING = 3;

/** A move to another brightness must beat today's by this much (no flicker). */
const BEAM_SWITCH_GAIN = 1.25;
/** Seconds in one stretch of attention for the lamp's brightness. */
const BEAM_WINDOW = 45;

/**
 * Reads the lamp panel and picks the brightness that earns the most after
 * the oil bill, but only when it is clearly better than the current one.
 */
const setsBeam: OilChoice = (run, available) => {
  if (!isBeamOpen(run)) return [];
  // It looks at the lamp once in a while, not every second.
  if (Math.floor(run.time) % BEAM_WINDOW !== 0) return [];
  const want = bestBeamStep(run);
  const now = beamStep(run);
  if (want === now) return [];
  const gain = beamNumbers(run, want).net;
  const have = beamNumbers(run, now).net;
  if (gain < have * BEAM_SWITCH_GAIN + 1e-9) return [];
  const id = beamActionId(want);
  return available.includes(id) ? [id] : [];
};

/** The night's streetlights and the coast's lamp: each only acts in its own part. */
const setsAllLamps = (
  options: Parameters<typeof setsLamps>[0] = {}
): OilChoice => {
  const night = setsLamps(options);
  return (run, available) => [
    ...night(run, available),
    ...setsBeam(run, available),
  ];
};

/** Projects that lift income enough to dim the lights for. */
const WORTH_DIMMING_FOR: ReadonlySet<string> = new Set([
  "night-school",
  "smart-meters",
  "fish-ladders",
  "co-op",
  "wind-maps",
]);

/**
 * A big project on offer has its power but waits on know-how, and soft-glow
 * learning would get there within `patience` seconds.
 */
function wantsKnowhow(
  run: RunState,
  patience: number,
  options: { isStaying?: boolean; hasOverdrive?: boolean } = {}
): boolean {
  // Overdrive is a second thing know-how buys, all night once the plants run.
  if (options.hasOverdrive !== false && isOverdriveOpen(run)) return true;
  const softRate = knowhowAtStep(run, 0);
  return shownProjects(lightUniverse, run).some((p) => {
    if (!WORTH_DIMMING_FOR.has(p.id)) return false;
    const powerOk = p.costs.every(
      (c) =>
        c.resource === "knowhow" ||
        (run.resources[c.resource] ?? 0) >= c.amount * 0.5
    );
    const missing =
      (p.costs.find((c) => c.resource === "knowhow")?.amount ?? 0) -
      (run.resources.knowhow ?? 0);
    // Once dimmed for it, stay dimmed until it is done (no flip-flopping
    // while the power dips for a purchase).
    const isDimmed = options.isStaying ?? lampChosen(run) === 0;
    return (
      (powerOk || isDimmed) &&
      missing > 0 &&
      missing / Math.max(softRate, 1e-6) <= patience
    );
  });
}

/**
 * Parks coins in the fund while saving up. It looks at the cheapest upgrade
 * on offer and keeps `share` of that price in the jar (as big a deposit as
 * fits), then takes it all out the moment the jar plus the wallet can pay.
 * A `share` of 0 never invests; 1 parks as much as the price itself.
 */
const EMPTY_JAR_SHARE = 0.05;
/** A deposit smaller than this share of the price is not worth the click. */
const MIN_DEPOSIT_SHARE = 0.1;

/**
 * Parks coins in the fund while saving up, but only when the wait for the
 * cheapest upgrade on offer is long (`minWait` seconds of income or more):
 * money taken out early pays a steep fee, so it is for what is not needed
 * soon. It parks as much as `share` of the price (as big a deposit as
 * fits) and takes it all out the moment the jar plus the wallet can pay.
 * A `share` of 0 never invests.
 */
export const investsInFund =
  (share: number, minWait: number): OilChoice =>
  (run, available) => {
    if (share <= 0 || !isFundOpen(run)) return [];
    const { currency } = fundKind(run);
    const prices = visibleUpgrades(lightUniverse, run)
      .filter((u) => !isMaxed(run, u) && u.currency === currency)
      .map((u) => upgradeCost(run, u));
    if (prices.length === 0) return [];
    const target = Math.min(...prices);
    const money = run.resources[currency] ?? 0;
    if (money >= target) return [];
    const parked = fundBalance(run);
    if (money + fundPayout(run) >= target)
      return available.includes(WITHDRAW_ACTION) ? [WITHDRAW_ACTION] : [];
    // One deposit per saving-up spell: nobody feeds the jar every few seconds.
    if (parked > target * EMPTY_JAR_SHARE) return [];
    const wait = (target - money) / Math.max(fundIncome(run), 1e-6);
    if (wait < minWait) return [];
    const room = share * target;
    const biggestFirst = [...DEPOSIT_SHARES].sort((a, b) => b - a);
    const fits = biggestFirst.find(
      (s) =>
        money * s <= room &&
        money * s >= target * MIN_DEPOSIT_SHARE &&
        available.includes(depositActionId(s))
    );
    return fits === undefined ? [] : [depositActionId(fits)];
  };

/**
 * Runs overdrive when the grid (or the fleet) is steady enough to hold it
 * (`startAt` percent) and the know-how is not wanted by a project that is
 * ready except for know-how: ideas that last come first.
 */
export const runsOverdrive =
  (startAt: number): OilChoice =>
  (run, available) => {
    if (!available.includes(OVERDRIVE_ACTION)) return [];
    // At night the question is the next rush: start only when it is far
    // enough off to be over before it, and the batteries are full so the
    // minute without charging leaves them ready.
    if (run.phase === 1) {
      const room = TUNING.overdrive.seconds + 12;
      if (isGridOpen(run) && (isRushNow(run) || secondsToRush(run) < room))
        return [];
      if (
        batteryCapacity(run) > 0 &&
        batteryCharge(run) < batteryCapacity(run) * (startAt / 100)
      )
        return [];
    } else if ((run.resources.heading ?? 100) < startAt) return [];
    const readyProjects = shownProjects(lightUniverse, run).filter((p) =>
      p.costs.every(
        (c) =>
          c.resource === "knowhow" ||
          (run.resources[c.resource] ?? 0) >= c.amount * 0.7
      )
    );
    const reserve = readyProjects.length
      ? Math.min(
          ...readyProjects.map(
            (p) => p.costs.find((c) => c.resource === "knowhow")?.amount ?? 0
          )
        )
      : 0;
    return (run.resources.knowhow ?? 0) >= overdriveCost(run) + reserve
      ? [OVERDRIVE_ACTION]
      : [];
  };

/** Seconds the bot looks ahead at what a side will pay, and keeps benefiting. */
const FORK_LOOK_SECONDS = 240;
const FORK_VALUE_SECONDS = 600;
/** The bot looks at a fork once in this many seconds (a stretch of attention). */
const FORK_LOOK_EVERY = 10;

/** The main resource's pace after `FORK_LOOK_SECONDS`, with this side chosen (or none). */
function paceAfter(run: RunState, side: ForkSide | null): number {
  const draft = cloneRun(run);
  if (side) chooseSide(draft, side.id);
  for (let t = 0; t < FORK_LOOK_SECONDS; t += 10) lightUniverse.tick(draft, 10);
  const main = lightUniverse.phases[run.phase].manualResource;
  const before = draft.resources[main] ?? 0;
  lightUniverse.tick(draft, 1);
  return (draft.resources[main] ?? 0) - before;
}

/** What a side is worth: the pace it adds over a while, less what it costs. */
const sideValue = (run: RunState, base: number, side: ForkSide): number =>
  (paceAfter(run, side) - base) * FORK_VALUE_SECONDS - side.price;

/** Picks the fork's better side by what it will pay, and buys it when it can. */
export const choosesFork: OilChoice = (run, available) => {
  const fork: ForkDef | undefined = forkOf(run);
  if (!fork || !fork.isOpen(run) || chosenSide(run, fork) !== null) return [];
  if (Math.floor(run.time) % FORK_LOOK_EVERY !== 0) return [];
  const money = run.resources[fork.currency] ?? 0;
  if (money < Math.min(...fork.sides.map((s) => s.price))) return [];
  const base = paceAfter(run, null);
  const best = [...fork.sides].sort(
    (a, b) => sideValue(run, base, b) - sideValue(run, base, a)
  )[0];
  const id = forkActionId(best.id);
  return money >= best.price && available.includes(id) ? [id] : [];
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

/**
 * How much of an evening's rush of this size (0 mild to 3 scorching, with the
 * streetlights at this peak) the batteries could meet on a full day's charge.
 */
function eveningCover(run: RunState, level: number, lampPeak: number): number {
  const stored = Math.min(batteryCapacity(run), dailyChargeRoom(run));
  return rushOutcome(run, rushExcessAt(run, level, lampPeak), stored).covered;
}

/** The shop order when nothing says otherwise: priority, then the cheapest. */
const cheapestFirst = (
  run: RunState,
  affordable: UpgradeDef[]
): UpgradeDef | undefined =>
  [...affordable].sort(
    (a, b) =>
      (b.priority ?? 0) - (a.priority ?? 0) ||
      upgradeCost(run, a) - upgradeCost(run, b)
  )[0];

const isBattery = (id: string): boolean => id.startsWith("batt-");

/**
 * Buys by the shop's usual order, but keeps the batteries in step with the
 * plants: when a rush of `level` (a hot evening by default) is less than
 * `target` met with the streetlights at `lampPeak`, a battery comes first. It
 * never waits for one with money in hand: a plant bought meanwhile pays for
 * the next battery sooner. A `target` of 0 never puts a battery first.
 */
export const buysBatteries =
  (target = 0.9, level = 2, lampPeak = 1) =>
  (run: RunState, affordable: UpgradeDef[]): UpgradeDef | undefined => {
    if (run.phase !== 1 || !isGridOpen(run))
      return cheapestFirst(run, affordable);
    if (eveningCover(run, level, lampPeak) >= target)
      return cheapestFirst(run, affordable);
    const batteries = affordable
      .filter((u) => isBattery(u.id))
      .sort((a, b) => upgradeCost(run, a) - upgradeCost(run, b));
    return batteries.length > 0 ? batteries[0] : cheapestFirst(run, affordable);
  };

const withOil = (
  strategy: Strategy,
  actions: OilChoice,
  care: OilChoice = looksAfterThings(45, true),
  weather: OilChoice = () => [],
  toll: OilChoice = () => [],
  race: OilChoice = () => [],
  garden: OilChoice = () => [],
  lamps: OilChoice = () => [],
  fund: OilChoice = () => [],
  know: OilChoice = () => [],
  fork: OilChoice = () => []
): Strategy => ({
  ...strategy,
  // The fork first: a big, rare choice should not lose its coins to oil.
  actions: combine(
    fork,
    actions,
    care,
    weather,
    toll,
    race,
    garden,
    lamps,
    fund,
    know
  ),
});

/**
 * A player for the night alone (the dials' tests): the eager tapper with the
 * shop order, oil, and exactly the streetlight and crew habits given.
 */
export function nightPlayer(habits: {
  lamps?: OilChoice;
  crews?: OilChoice;
}): Strategy {
  const tapper = genericBots(lightUniverse).tapper;
  return withOil(
    { ...tapper, choose: buysBatteries() },
    savvyOil,
    looksAfterThings(74, true),
    habits.crews ?? (() => []),
    () => [],
    () => [],
    () => [],
    habits.lamps ?? (() => []),
    () => [],
    () => [],
    choosesFork
  );
}

/** Tends at `below` percent and claims, or not: one dial of a skill pair. */
const tender = (base: Strategy, below: number, claims: boolean): Strategy =>
  withOil(base, savvyOil, looksAfterThings(below, claims));

/** How much of the next price the scorecard's players keep parked while saving. */
export const DEFAULT_FUND_SHARE = 0.3;
/** ... and the shortest wait (in seconds of income) worth parking for. */
export const DEFAULT_FUND_WAIT = 30;

/** The scorecard's player personalities for Keep the Light On. */
export function lightBots(
  options: { fundShare?: number; fundWait?: number } = {}
): BotSet {
  const fundShare = options.fundShare ?? DEFAULT_FUND_SHARE;
  const fundWait = options.fundWait ?? DEFAULT_FUND_WAIT;
  const generic = genericBots(lightUniverse);
  // Every player buys plants and batteries in step (the shop's order, mostly).
  const shops = (strategy: Strategy): Strategy => ({
    ...strategy,
    choose: buysBatteries(),
  });
  const base = {
    ...generic,
    tapper: shops(generic.tapper),
    realistic: shops(generic.realistic),
    idle: shops(generic.idle),
    dawdler: shops(generic.dawdler),
  };
  // The idle bot presses no chore button outside the last phase (where the
  // ending is the story): it taps early and watches. It does take a fork in
  // the road, which is a shop purchase with a picture, not a chore.
  const idleActions: OilChoice = (run, available) => [
    ...choosesFork(run, available),
    ...(run.phase >= 3 ? lastPhaseActions(run, available) : []),
  ];
  const tendPair = {
    naive: tender(base.tapper, 15, true),
    careful: tender(base.tapper, 74, true),
  };
  const claimPair = {
    ignores: tender(base.tapper, 74, false),
    claims: tender(base.tapper, 74, true),
  };
  // At night the careful player reads each evening and posts the crews; the
  // naive one sets the streetlights once and leaves every crew building.
  const nightPair = {
    naive: withOil(
      base.tapper,
      savvyOil,
      looksAfterThings(15, true),
      () => [],
      () => [],
      () => [],
      () => [],
      setsAllLamps({ patience: 30, fixed: 2 })
    ),
    careful: withOil(
      base.tapper,
      savvyOil,
      looksAfterThings(74, true),
      tendsCrews(),
      () => [],
      () => [],
      () => [],
      setsAllLamps({ patience: 30 })
    ),
  };
  return {
    tapper: withOil(
      base.tapper,
      savvyOil,
      looksAfterThings(74, true),
      tendsCrews({ skipEvery: 10 }),
      setsToll({ skipEvery: 8 }),
      racesProbes({ comet: 0.7, plain: 0, skipEvery: 8 }),
      tendsGarden({ skipEvery: 6 }),
      setsAllLamps({ patience: 30, skipEvery: 8 }),
      investsInFund(fundShare, fundWait),
      runsOverdrive(85),
      choosesFork
    ),
    realistic: withOil(
      base.realistic,
      savvyOil,
      looksAfterThings(42, true),
      tendsCrews({ skipEvery: 5 }),
      setsToll({ skipEvery: 4 }),
      racesProbes({ comet: 0.85, plain: 1, skipEvery: 4 }),
      tendsGarden({ skipEvery: 3 }),
      setsAllLamps({ patience: 30, skipEvery: 4 }),
      investsInFund(fundShare, fundWait),
      runsOverdrive(80),
      choosesFork
    ),
    // Projects are permanent shop buys on a panel, not chores, so the idle
    // player starts them too (it never tends, claims or runs anything).
    idle: {
      ...base.idle,
      projects: "best",
      actions: idleActions,
      greetAfter: Infinity,
    },
    dawdler: {
      ...withOil(
        base.dawdler,
        savvyOil,
        looksAfterThings(35, false),
        tendsCrews({ onlyEvery: 3 }),
        setsToll({ onlyEvery: 3 }),
        racesProbes({ comet: 2, plain: 1, onlyEvery: 3 }),
        tendsGarden({ onlyEvery: 3 }),
        setsAllLamps({ patience: 30, onlyEvery: 3 }),
        investsInFund(fundShare, fundWait * 2),
        () => [],
        choosesFork
      ),
      greetAfter: 60,
    },
    // In the last phase "tending" is tapping the flame: a player who barely
    // taps against one who does.
    skill: {
      1: nightPair,
      2: tendPair,
      3: {
        naive: { ...base.tapper, tapRate: () => 0.5, actions: idleActions },
        careful: { ...base.tapper, actions: idleActions },
      },
    },
    claim: { 2: claimPair },
    naiveOil: withOil(base.tapper, naiveOil),
    cheapskateOil: withOil(base.tapper, cheapskateOil),
  };
}
