import { genericBots, type BotSet } from "../../engine/bots";
import type { Strategy } from "../../engine/sim";
import type { RunState } from "../../engine/types";
import {
  barrelOil,
  demandAtStep,
  isGridAuto,
  isLampsOpen,
  knowhowAtStep,
  lampStep,
  supplyMW,
  tankCapacity,
  tier,
} from "./tick";
import { lampActionId } from "./lamps";
import { shownProjects } from "../../engine/engine";
import { lightUniverse } from ".";
import { cometCloseness, isProbeOut, launchActionId } from "./probes";
import {
  PICK_ACTION,
  WATER_ACTION,
  bloomCount,
  growingCount,
  thirstyCount,
} from "./garden";
import { HAUL_ACTION, SET_NETS_ACTION, highTidesSoFar } from "./tide";
import {
  chanceOf,
  crewActionId,
  crewCount,
  crewThatMoves,
  crewsPlaced,
  frontsSoFar,
  hasCrew,
  isOut,
  isWeatherOpen,
  readyAtLandfall,
  readyShare,
  weatherStage,
} from "./weather";

/** The smallest share of the tank a bot bothers to buy in one click. */
const MIN_BARREL_SHARE = 0.4;
/** ... or this much when the lamp is nearly dry. */
const MIN_DRY_BARREL_SHARE = 0.25;

/** Seconds in one stretch of attention for the garden (the bots' deterministic skips count these). */
const GARDEN_WINDOW_SECONDS = 30;

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

/**
 * Sends the repair crews by the forecast. At every step it weighs each town
 * by its chance times how ready a crew there would be at landfall (a crew
 * that moves starts over), and moves the crew worth least to the town worth
 * most when that gains enough. Between storms it sends a crew to fix a dark
 * town. A bot with real attention misses now and then: it skips every
 * `skipEvery`th front (counted by the desk, so the sim stays deterministic),
 * and `onlyEvery` makes a distracted player tend just one front in so many.
 */
const tendsWeather =
  (options: { skipEvery?: number; onlyEvery?: number } = {}): OilChoice =>
  (run, available) => {
    if (!isWeatherOpen(run)) return [];
    const front = frontsSoFar(run);
    const { skipEvery, onlyEvery } = options;
    if (skipEvery && front % skipEvery === skipEvery - 1) return [];
    if (onlyEvery && front % onlyEvery !== 0) return [];
    const towns = [0, 1, 2];
    const send = (town: number): string[] => {
      const id = crewActionId(town);
      return available.includes(id) ? [id] : [];
    };
    if (weatherStage(run) !== "forecast") {
      // Between storms: fix a dark town (a crew there fixes it fast).
      const dark = towns.find((t) => isOut(run, t) && !hasCrew(run, t));
      return dark === undefined ? [] : send(dark);
    }
    const value = (town: number, isMoving: boolean): number =>
      chanceOf(run, town) * readyShare(readyAtLandfall(run, town, isMoving));
    const free = towns.filter((t) => !hasCrew(run, t));
    const best = free.sort((a, b) => value(b, true) - value(a, true))[0];
    if (best === undefined) return [];
    if (crewsPlaced(run) < crewCount(run)) return send(best);
    const mover = crewThatMoves(run, best);
    if (mover === null) return send(best);
    const gain = value(best, true) - value(mover, false);
    return gain >= WEATHER_MOVE_GAIN ? send(best) : [];
  };

/** Points of (chance x readiness) a move must gain to be worth it. */
const WEATHER_MOVE_GAIN = 4;

/**
 * Hauls full nets in and sets them again. A bot with real attention misses
 * now and then: it leaves the nets in the water for one cycle in every
 * `skipEvery`th (counted by the clock itself, so the sim stays
 * deterministic), and `onlyEvery` makes a distracted player set them in just
 * one cycle in so many. Full nets wait, so a miss costs only the catch.
 */
const tendsTide =
  (options: { skipEvery?: number; onlyEvery?: number } = {}): OilChoice =>
  (run, available) => {
    if (available.includes(HAUL_ACTION)) return [HAUL_ACTION];
    const cycle = highTidesSoFar(run);
    const { skipEvery, onlyEvery } = options;
    if (skipEvery && cycle % skipEvery === skipEvery - 1) return [];
    if (onlyEvery && cycle % onlyEvery !== 0) return [];
    return available.includes(SET_NETS_ACTION) ? [SET_NETS_ACTION] : [];
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

/**
 * Sets the streetlights by the situation: soft enough to light the last
 * towns the moment the plants can (the phase ends); soft while a project on
 * offer waits only on know-how (quiet crews learn faster); otherwise as
 * bright as the grid allows (dazzling with a load balancer or a smart grid).
 * `patience` is how many seconds of soft-glow learning a project may be away
 * and still be worth softening for.
 */
const setsLamps =
  (options: { patience?: number } = {}): OilChoice =>
  (run, available) => {
    if (!isLampsOpen(run)) return [];
    const supply = supplyMW(run);
    const finishing = [3, 2, 1, 0].find(
      (step) => supply >= demandAtStep(run, step)
    );
    const want =
      finishing ??
      (wantsKnowhow(run, options.patience ?? 120) ? 0 : brightest(run));
    if (want === lampStep(run)) return [];
    const id = lampActionId(want);
    return available.includes(id) ? [id] : [];
  };

/** As bright as the grid can take without a lot of balancing. */
const brightest = (run: RunState): number =>
  isGridAuto(run) || tier(run, "grid") >= 1 ? 3 : 2;

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
function wantsKnowhow(run: RunState, patience: number): boolean {
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
    const isDimmed = lampStep(run) === 0;
    return (
      (powerOk || isDimmed) &&
      missing > 0 &&
      missing / Math.max(softRate, 1e-6) <= patience
    );
  });
}

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
  care: OilChoice = looksAfterThings(45, true),
  weather: OilChoice = () => [],
  tide: OilChoice = () => [],
  race: OilChoice = () => [],
  garden: OilChoice = () => [],
  lamps: OilChoice = () => []
): Strategy => ({
  ...strategy,
  actions: combine(actions, care, weather, tide, race, garden, lamps),
});

/** Tends at `below` percent and claims, or not: one dial of a skill pair. */
const tender = (base: Strategy, below: number, claims: boolean): Strategy =>
  withOil(base, savvyOil, looksAfterThings(below, claims));

/** The scorecard's player personalities for Keep the Light On. */
export function lightBots(): BotSet {
  const base = genericBots(lightUniverse);
  // The idle bot never presses a button outside the last phase (where the
  // ending is the story): it taps early and watches.
  const idleActions: OilChoice = (run, available) =>
    run.phase >= 3 ? lastPhaseActions(run, available) : [];
  const tendPair = {
    naive: tender(base.tapper, 15, true),
    careful: tender(base.tapper, 74, true),
  };
  const claimPair = {
    ignores: tender(base.tapper, 74, false),
    claims: tender(base.tapper, 74, true),
  };
  return {
    tapper: withOil(
      base.tapper,
      savvyOil,
      looksAfterThings(74, true),
      tendsWeather({ skipEvery: 10 }),
      tendsTide({ skipEvery: 8 }),
      racesProbes({ comet: 0.7, plain: 0, skipEvery: 8 }),
      tendsGarden({ skipEvery: 6 }),
      setsLamps({ patience: 60 })
    ),
    realistic: withOil(
      base.realistic,
      savvyOil,
      looksAfterThings(42, true),
      tendsWeather({ skipEvery: 5 }),
      tendsTide({ skipEvery: 4 }),
      racesProbes({ comet: 0.85, plain: 1, skipEvery: 4 }),
      tendsGarden({ skipEvery: 3 }),
      setsLamps({ patience: 60 })
    ),
    idle: { ...base.idle, actions: idleActions, greetAfter: Infinity },
    dawdler: {
      ...withOil(
        base.dawdler,
        savvyOil,
        looksAfterThings(35, false),
        tendsWeather({ onlyEvery: 3 }),
        tendsTide({ onlyEvery: 3 }),
        racesProbes({ comet: 2, plain: 1, onlyEvery: 3 }),
        tendsGarden({ onlyEvery: 3 }),
        setsLamps({ patience: 60 })
      ),
      greetAfter: 60,
    },
    // In the last phase "tending" is tapping the flame: a player who barely
    // taps against one who does.
    skill: {
      1: tendPair,
      2: tendPair,
      3: {
        naive: { ...base.tapper, tapRate: () => 0.5, actions: idleActions },
        careful: { ...base.tapper, actions: idleActions },
      },
    },
    claim: { 1: claimPair, 2: claimPair },
    naiveOil: withOil(base.tapper, naiveOil),
    cheapskateOil: withOil(base.tapper, cheapskateOil),
  };
}
