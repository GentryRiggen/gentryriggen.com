import { isProjectDone } from "../../engine/engine";
import { nextRandom } from "../../engine/rng";
import type { RunState } from "../../engine/types";
import {
  PHASE_COAST,
  PHASE_LAST,
  PHASE_NIGHT,
  PHASE_SKY,
  TOTAL_CITIES,
  TOTAL_LIGHTS,
  TOTAL_STARS,
} from "./resources";
import {
  REMOVED_NIGHT_COSTS,
  REMOVED_NIGHT_SCALE,
  REMOVED_SKY_COSTS,
  REMOVED_SKY_SCALE,
} from "./costs";
import { TUNING } from "./tuning";
import {
  SKY_DIALS_FLAG,
  copyMult,
  mirrorMult,
  speedMult,
  tickDesign,
  wildFraction,
  wildShare,
} from "./design";
import { lightMult, openSkyDials, tickSunEdge } from "./sunEdge";
import {
  letGoCount,
  resolvePerSecond as lastResolvePerSecond,
  stoke,
  tapResolve,
  tickWarmth,
} from "./warmth";
import {
  growthRate,
  rivalToll,
  tickHarbor,
  tollPay,
  trafficShare,
} from "./toll";
import {
  isTankerIn,
  noteBuy,
  oilHabit,
  tankerDeal,
  tickTanker,
} from "./tanker";
import { tickFund } from "./fund";
import { hasFork, windRamp } from "./forkState";
import { overdriveBoost, tickOverdrive } from "./overdrive";
import { districtsDark, tickGrid } from "./grid";
import {
  buildMult,
  outageFactor,
  schoolMult,
  tickCrews,
  tickWeather,
} from "./weather";

const { coast: C, night: N, sky: S, projects: P, lamps: LAMPS } = TUNING;
const SP = P.sky;
const FK = TUNING.fork;

/** True once the night project `id` is done (see projects.ts). */
export const hasProject = (run: RunState, id: string): boolean =>
  isProjectDone(run, id);

/** A project's multiplier when it is done, 1 otherwise. */
const ifProject = (run: RunState, id: string, mult: number): number =>
  hasProject(run, id) ? mult : 1;

export const level = (run: RunState, id: string): number => run.owned[id] ?? 0;
const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const speed = (run: RunState): number => run.mods.speed ?? 1;
const tapMult = (run: RunState): number => run.mods.tapMult ?? 1;

/**
 * Steps of a one-off chain bought so far: `wick-1`, `wick-2`, ... count while
 * each one is owned in order.
 */
export function tier(run: RunState, base: string): number {
  let n = 0;
  while ((run.owned[`${base}-${n + 1}`] ?? 0) > 0) n += 1;
  return n;
}

// ---------------------------------------------------------------- The Coast

export const lighthouseCount = (run: RunState): number =>
  1 + level(run, "lighthouse");

/** Ships one flash guides from the lens alone (1 with none). */
export const lensShips = (run: RunState): number =>
  C.lensShips[Math.min(C.lensShips.length - 1, level(run, "lens"))];

/** The Fresnel lens guides more ships with every flash, yours and the keepers'. */
export const fresnelMult = (run: RunState): number =>
  hasFork(run, "fresnel") ? FK.coast.fresnelFlash : 1;

/** More keepers flash far more often (they do not help your own taps). */
export const keeperCrewMult = (run: RunState): number =>
  hasFork(run, "crews") ? FK.coast.crewsFlash : 1;

// ------------------------------------------------------- The lamp's brightness

/** The brightness step, 0 (dim) to the last (blazing); old saves read Normal. */
export const beamStep = (run: RunState): number => {
  const raw = run.resources.lampBeam;
  const step =
    typeof raw === "number" && Number.isFinite(raw)
      ? Math.round(raw)
      : C.beam.defaultStep;
  return Math.min(C.beam.steps.length - 1, Math.max(0, step));
};

/** What a brightness step does to the ships a flash guides and the oil burned. */
export const beamAt = (step: number) => C.beam.steps[step];

/** The knob opens with the first keeper. */
export const isBeamOpen = (run: RunState): boolean =>
  run.phase === 0 && level(run, "keeper") >= 1;

/** Ships per flash and keeper flashes, times the brightness (Normal is 1). */
export const beamPay = (run: RunState): number => beamAt(beamStep(run)).pay;

/** Sets the lamp's brightness (the lamp panel's buttons). */
export function setBeam(run: RunState, step: number): void {
  const next = Math.min(C.beam.steps.length - 1, Math.max(0, Math.round(step)));
  if (next === beamStep(run)) return;
  run.resources.lampBeam = next;
  run.resources.lampBeamChanges = res(run, "lampBeamChanges") + 1;
}

/** Ships one flash guides if every ship picked your harbor (what the tank is sized for). */
export const flashShipsAtFullTraffic = (run: RunState): number =>
  lensShips(run) * tapMult(run) * fresnelMult(run) * beamPay(run);

/** Ships one flash guides: those that choose your harbor at the toll you set. */
export const shipsPerFlash = (run: RunState): number =>
  flashShipsAtFullTraffic(run) * trafficShare(run);

/** What a ship pays at the harbor before the toll: the fees and the docks. */
export const fare = (run: RunState): number =>
  C.fareGrowth ** tier(run, "fees") * C.dockBonus ** tier(run, "dock");

/** How much your lighthouses and docks raise the going rate (1 with one lighthouse and no docks). */
export const harborGrowth = (run: RunState): number =>
  growthRate(lighthouseCount(run), tier(run, "dock"));

/**
 * What a ship pays with your toll on top. A grown harbor raises the going
 * rate (so the best toll climbs), but the fees and docks already pay for that
 * growth, so the toll is read against it: the same relative toll earns the
 * same at any size.
 */
export const farePaid = (run: RunState): number =>
  (fare(run) * tollPay(run) * rivalPayFactor(run)) / harborGrowth(run);

/**
 * A rival that charges more lets every toll earn a little more, and one that
 * charges less a little less (the same for every toll, so it never changes
 * which toll is best, and the coast's income is not rocked by a big swing).
 */
const rivalPayFactor = (run: RunState): number =>
  (rivalToll(run) / C.harbor.rivalStart) ** -(1 - C.harbor.rivalPayShare);

/** The going rate ships measure your toll against (the rival's, grown by your harbor). */
export const goingRate = (run: RunState): number =>
  run.resources.hbRate > 0
    ? run.resources.hbRate
    : rivalToll(run) * harborGrowth(run);

export const isStorming = (run: RunState): boolean => res(run, "storm") > 0;

/** A dry lamp is dark: only a few ships still find the harbor. */
export const lampFactor = (run: RunState): number =>
  res(run, "oil") > 0 ? 1 : C.dimLamp / beamPay(run);

/**
 * A flash also stirs the keepers: each tap brings a small share of a second
 * of their work, so a tap never shrinks to nothing as the keepers grow.
 */
const tapShareCoins = (run: RunState): number =>
  C.tapShare * autoCoinsPerSecond(run);

/** Coins one tap earns on the coast. */
export function coastTapCoins(run: RunState): number {
  const bonus = isStorming(run) ? C.stormTapBonus : 1;
  return (
    shipsPerFlash(run) * bonus * farePaid(run) * lampFactor(run) +
    tapShareCoins(run)
  );
}

/** Coins one tap would earn on a calm night with a full lamp. */
export const calmTapCoins = (run: RunState): number =>
  shipsPerFlash(run) * farePaid(run) + tapShareCoins(run);

/** How much each keeper's work is multiplied by their training. */
export const trainingMult = (run: RunState): number =>
  C.trainingSteps
    .slice(0, tier(run, "train"))
    .reduce((product, step) => product * step, 1);

export const keeperCount = (run: RunState): number => level(run, "keeper");

/** Keeper milestones reached (5, 10, 25 and 40 keepers). */
export const keeperMilestonesReached = (run: RunState): number =>
  C.keeperMilestones.filter((m) => keeperCount(run) >= m).length;

/** Every keeper's work doubles at each milestone. */
export const keeperMilestoneMult = (run: RunState): number =>
  C.keeperMilestoneMult ** keeperMilestonesReached(run);

/** The next milestone's keeper count, or null once all are reached. */
export const nextKeeperMilestone = (run: RunState): number | null =>
  C.keeperMilestones.find((m) => keeperCount(run) < m) ?? null;

/** Each lighthouse after the first doubles the ships (they compound). */
export const lighthouseMult = (run: RunState): number =>
  C.lighthouseMult ** (lighthouseCount(run) - 1);

/** Flashes per second the keepers make, lamp and weather aside. */
export const autoFlashRate = (run: RunState): number =>
  autoFlashRateAtFullTraffic(run) * trafficShare(run);

/** The same, if every ship picked your harbor. */
const autoFlashRateAtFullTraffic = (run: RunState): number =>
  keeperCount(run) *
  C.keeperFlashes *
  lighthouseMult(run) *
  keeperMilestoneMult(run) *
  trainingMult(run) *
  lensShips(run) *
  fresnelMult(run) *
  keeperCrewMult(run) *
  tapMult(run) *
  beamPay(run) *
  speed(run);

/** Coins per second the keepers earn on a calm night with a full lamp. */
export const autoCoinsPerSecond = (run: RunState): number =>
  autoFlashRate(run) * farePaid(run);

const oilSaving = (run: RunState): number =>
  C.wickSaving ** tier(run, "wick") *
  (hasFork(run, "crews") ? FK.coast.crewsOil : 1);

/**
 * Lamp oil burned per second. Oil follows the fares: every coin of fare a
 * keeper's ship pays burns `burnPerShip` oil, so the oil bill is the same
 * share of the income all game. The brightness multiplies the whole bill
 * (not per ship), so brighter pays more but costs even more.
 */
export const burnPerSecond = (run: RunState, shipsPerSecond: number): number =>
  burnAtStep(run, shipsPerSecond, beamStep(run));

/** The same burn with the lamp at `step` (`shipsPerSecond` is at today's step). */
export const burnAtStep = (
  run: RunState,
  shipsPerSecond: number,
  step: number
): number =>
  (shipsPerSecond / beamPay(run)) *
  C.burnPerShip *
  fare(run) *
  oilSaving(run) *
  beamAt(step).burn;

/** Oil burned per second by an idle lamp, for previews. */
export const idleBurn = (run: RunState): number =>
  burnPerSecond(run, autoFlashRate(run));

/**
 * The tank holds this many seconds of oil at full tilt (keepers plus a few
 * taps a second), so it keeps up as the coast grows: every tank upgrade holds
 * longer, never a flood of barrel clicks.
 */
export const tankCapacity = (run: RunState): number => {
  const fullTiltShips =
    autoFlashRateAtFullTraffic(run) +
    C.tankTapsPerSecond * flashShipsAtFullTraffic(run);
  const seconds = C.tankSeconds + C.tankSecondsPerTier * tier(run, "tank");
  // Sized for the Normal step, so the tank is the same whatever the knob says.
  return Math.max(
    C.tankBase,
    burnAtStep(run, fullTiltShips, C.beam.defaultStep) * seconds
  );
};

/**
 * Oil one click brings: enough to fill the tank, or as much as the coins can
 * pay for. One click, one full tank: no shrinking barrels to tap through.
 */
export const barrelOil = (run: RunState): number =>
  Math.max(
    0,
    Math.min(
      tankCapacity(run) - res(run, "oil"),
      res(run, "coins") / Math.max(res(run, "oilPrice"), 0.01)
    )
  );

/** The price is cheap or dear against what oil usually costs. */
export const isOilCheap = (run: RunState): boolean =>
  res(run, "oilPrice") <= C.cheapPrice;
export const isOilDear = (run: RunState): boolean =>
  res(run, "oilPrice") >= C.dearPrice;

/** Buys one barrel at today's price (the action and the merchant use this). */
export function buyBarrel(run: RunState): void {
  const oil = barrelOil(run);
  if (oil <= 0) return;
  const wasDark = run.resources.oil <= 0;
  run.resources.oil += oil;
  run.resources.coins -= oil * run.resources.oilPrice;
  noteBuy(run, wasDark, oil / tankCapacity(run));
}

/** What a barrel really costs you: the market price, as your buying habit pays it. */
export const habitOilCost = (run: RunState): number =>
  marketOilPrice(run) * oilHabit(run);

/** The oil market's own price, before any tanker's deal (a save from before reads today's). */
export const marketOilPrice = (run: RunState): number =>
  res(run, "oilBase") > 0 ? res(run, "oilBase") : res(run, "oilPrice");

/** A tank nearly empty means a rush order: the oil costs more than it would if you had ordered ahead. */
export const rushFactor = (run: RunState): number =>
  res(run, "oil") < tankCapacity(run) * C.rushBelow ? C.rushMult : 1;

function driftOilPrice(run: RunState, dt: number): void {
  const calm = run.mods.calm ?? 0;
  const before = marketOilPrice(run);
  const wobble =
    (nextRandom(run) - 0.5) * C.oilWobble * Math.sqrt(dt) * (1 - calm);
  const pull = (C.oilMean - before) * C.oilPull * dt;
  const base = Math.min(C.oilMax, Math.max(C.oilMin, before + pull + wobble));
  run.resources.oilBase = base;
  // A tanker in port sells below the market until it sails on; an almost
  // empty tank can only be filled by a rush order, which costs more.
  run.resources.oilPrice = isTankerIn(run)
    ? base * tankerDeal(run)
    : base * rushFactor(run);
  const slope = (base - before) / dt;
  run.resources.oilTrend +=
    (slope - run.resources.oilTrend) * Math.min(1, dt / C.trendSeconds);
}

/**
 * The oil merchant contract: whenever the tank falls under a quarter, a
 * full tank is ordered, at whatever the price is (never more than coins
 * allow). It keeps the lamp lit, and pays no attention to the market.
 */
function merchantBuys(run: RunState): void {
  if (level(run, "contract") === 0) return;
  if (run.resources.oil < tankCapacity(run) * C.contractBelow) buyBarrel(run);
}

function updateStorm(run: RunState, dt: number): void {
  if (run.resources.storm > 0) {
    run.resources.storm = Math.max(0, run.resources.storm - dt);
    return;
  }
  run.resources.stormCooldown -= dt;
  if (run.resources.stormCooldown > 0) return;
  const calm = run.mods.calm ?? 0;
  run.resources.storm = C.stormLength * (1 - calm * 0.5);
  run.resources.stormCooldown =
    C.stormGapMin + nextRandom(run) * C.stormGapSpread;
}

export const stormPassive = (run: RunState): number =>
  C.stormPassive[Math.min(C.stormPassive.length - 1, tier(run, "shutters"))];

function tickCoast(run: RunState, dt: number): void {
  updateStorm(run, dt);
  tickTanker(run, dt, isBeamOpen(run));
  driftOilPrice(run, dt);
  tickHarbor(run, dt, harborGrowth(run), isStorming(run), res(run, "oil") <= 0);
  const stormFactor = isStorming(run) ? stormPassive(run) : 1;
  const shipsPerSecond = autoFlashRate(run) * lampFactor(run) * stormFactor;
  const ships = shipsPerSecond * dt;
  run.resources.ships += ships;
  run.resources.coins += ships * farePaid(run);
  run.resources.oil = Math.max(
    0,
    run.resources.oil - burnPerSecond(run, shipsPerSecond) * dt
  );
  merchantBuys(run);
}

/** What the coast costs to run, per second, in coins (oil at today's price). */
export function coastUpkeep(run: RunState): number {
  if (res(run, "oil") <= 0) return 0;
  const shipsPerSecond = autoFlashRate(run) * lampFactor(run);
  return burnPerSecond(run, shipsPerSecond) * res(run, "oilPrice");
}

// ------------------------------------------------------------ No More Night

/** Each plant's megawatts, after the projects that boost it. */
export const plantMW = (run: RunState, index: number): number =>
  N.gensMW[index] *
  (index === 1 ? ifProject(run, "co-op", P.coopBoost) : 1) *
  (index === 2 ? ifProject(run, "fish-ladders", P.ladderBoost) : 1) *
  (index === 3 ? ifProject(run, "wind-maps", P.windBoost) : 1);

/** Power plants built, of every kind. */
export const plantCount = (run: RunState): number =>
  N.gensMW.reduce((sum, _, i) => sum + level(run, `gen${i + 1}`), 0);

/**
 * Coal pays at once; the wind farms grow in over `windRampSeconds` to a
 * bigger number. Neither before the fork is chosen.
 */
export const forkSupplyMult = (run: RunState): number =>
  hasFork(run, "coal")
    ? FK.night.coalSupply
    : 1 + (FK.night.windSupply - 1) * windRamp(run);

/** Megawatts of everything built, with the lines' bonus. */
export function supplyMW(run: RunState): number {
  const raw = N.gensMW.reduce(
    (sum, _, i) => sum + plantMW(run, i) * level(run, `gen${i + 1}`),
    0
  );
  return (
    raw *
    N.lineBonus ** tier(run, "lines") *
    N.substationBonus ** tier(run, "subs") *
    forkSupplyMult(run)
  );
}

// ------------------------------------------------------- The streetlights

/** The streetlights knob opens with the grid. */
export const isLampsOpen = (run: RunState): boolean => isGridInPlay(run);

/** The brightness step, 0 (soft glow) to the last (dazzling). */
export const lampStep = (run: RunState): number => {
  const raw = run.resources.lamps;
  const step =
    typeof raw === "number" && Number.isFinite(raw)
      ? Math.round(raw)
      : LAMPS.defaultStep;
  return Math.min(LAMPS.steps.length - 1, Math.max(0, step));
};

/** What the brightness does right now (always "bright" in other phases). */
export const lampEffect = (run: RunState) =>
  LAMPS.steps[run.phase === 1 ? lampStep(run) : LAMPS.defaultStep];

/** Seconds until the streetlights can change again (0: they can). */
export const lampLockLeft = (run: RunState): number =>
  Math.max(0, res(run, "lampLock"));

/** The step the streetlights are settling to (the one shown as picked). */
export const lampChosen = (run: RunState): number => {
  const next = Math.round(res(run, "lampNext"));
  return next > 0 && next <= LAMPS.steps.length ? next - 1 : lampStep(run);
};

/**
 * Picks a brightness (the streetlights' radio buttons). The cities only
 * follow it once it has settled, a few seconds later, and the streetlights
 * cannot change again until then: a choice is a commitment, so changing your
 * mind at the last minute costs the time it takes. A change made from dusk
 * to the end of the rush is for tonight: the lights go back to what they
 * were once the rush is over (see `returnLampsHome`).
 */
export function setLamps(run: RunState, step: number): void {
  const next = Math.min(LAMPS.steps.length - 1, Math.max(0, Math.round(step)));
  if (next === lampChosen(run) || lampLockLeft(run) > 0) return;
  const clock = res(run, "pgClock");
  const isEvening =
    res(run, "pgStarted") > 0 &&
    clock >= TUNING.grid.duskAt &&
    clock < TUNING.grid.rushAt + TUNING.grid.rushSeconds;
  if (!isEvening) run.resources.lampHome = 0;
  else if (res(run, "lampHome") <= 0)
    run.resources.lampHome = lampChosen(run) + 1;
  run.resources.lampNext = next + 1;
  run.resources.lampChanges = res(run, "lampChanges") + 1;
  run.resources.lampLock = TUNING.grid.lampLockSeconds;
}

/** The rush is over: tonight's lights settle back to what they were. */
export function returnLampsHome(run: RunState): void {
  const home = Math.round(res(run, "lampHome")) - 1;
  run.resources.lampHome = 0;
  if (home < 0 || home === lampChosen(run)) return;
  run.resources.lampNext = home + 1;
  run.resources.lampLock = Math.max(
    res(run, "lampLock"),
    TUNING.grid.lampLockSeconds
  );
}

/** Counts the settling down, and lets the cities follow once it is done. */
function settleLamps(run: RunState, dt: number): void {
  const left = Math.max(0, res(run, "lampLock") - dt);
  run.resources.lampLock = left;
  if (left > 0 || res(run, "lampNext") <= 0) return;
  run.resources.lamps = lampChosen(run);
  run.resources.lampNext = 0;
}

/**
 * A save from before the batteries owns the cut load balancer and smart
 * grid: while it is in the night, pay back what they cost (at the prices
 * they were bought at) and take them off the books, once.
 */
function refundRemovedUpgrades(run: RunState): void {
  for (const [id, cost] of Object.entries(REMOVED_NIGHT_COSTS)) {
    const levels = Math.floor(run.owned[id] ?? 0);
    if (levels <= 0) continue;
    run.resources.power =
      res(run, "power") + cost * REMOVED_NIGHT_SCALE * levels;
    delete run.owned[id];
  }
}

/**
 * A save from before the sky's dials owns the racing fins and mission
 * control: while it is in the sky, pay back what they cost and take them off
 * the books, once.
 */
function refundRemovedSkyUpgrades(run: RunState): void {
  for (const [id, cost] of Object.entries(REMOVED_SKY_COSTS)) {
    const levels = Math.floor(run.owned[id] ?? 0);
    if (levels <= 0) continue;
    run.resources.energy =
      res(run, "energy") + cost * REMOVED_SKY_SCALE * levels;
    delete run.owned[id];
  }
}

/** Demand at a given brightness (for the knob's "lights up the rest" hint). */
export const demandAtStep = (run: RunState, step: number): number =>
  (demandMW(run) / lampEffect(run).demand) * LAMPS.steps[step].demand;

export const demandMW = (run: RunState): number =>
  TOTAL_CITIES *
  N.perCityMW *
  N.bulbSaving ** tier(run, "bulbs") *
  ifProject(run, "smart-meters", P.meterDemand) *
  ifProject(run, "lamplighters", P.lampDemand) *
  lampEffect(run).demand;

/** What every megawatt that reaches a city pays (smart meters: more). */
export const cityPay = (run: RunState): number =>
  N.payPerMW *
  ifProject(run, "smart-meters", P.meterPay) *
  lampEffect(run).pay *
  outageFactor(run) *
  buildMult(run);

/**
 * Know-how a second. Night: every plant's crew learns a little. Sky: every
 * collector's crew does, and the fleet's size adds a little more.
 */
export const knowhowPerSecond = (run: RunState): number =>
  run.phase === 2
    ? (SP.knowhowPerCollector * level(run, "collector") +
        SP.knowhowPerDecade * Math.log10(1 + res(run, "probes"))) *
      speed(run)
    : P.knowhowPerPlant *
      plantCount(run) *
      ifProject(run, "night-school", P.schoolBoost) *
      lampEffect(run).knowhow *
      schoolMult(run) *
      speed(run);

/** Know-how a second at a given brightness. */
export const knowhowAtStep = (run: RunState, step: number): number =>
  (knowhowPerSecond(run) / lampEffect(run).knowhow) * LAMPS.steps[step].knowhow;

/** Cities powered right now (fractional), 0..TOTAL_CITIES. */
export function citiesLit(run: RunState): number {
  const delivered = Math.min(supplyMW(run), demandMW(run));
  return (delivered / demandMW(run)) * TOTAL_CITIES;
}

/**
 * What overdrive reads at night (0..100): the lights are all on, or some
 * district has gone dark. Hot plants make the rush bigger and stop charging.
 */
export const nightSteadiness = (run: RunState): number =>
  districtsDark(run) > 0 ? 0 : 100;

/** The grid opens once the plants make this much (see grid.ts). */
export const isGridInPlay = (run: RunState): boolean =>
  run.phase === 1 && supplyMW(run) >= N.gridVisibleSupplyMW;

export const crankPower = (run: RunState): number =>
  (N.crankBase + N.crankPerLevel * level(run, "crank")) * tapMult(run) +
  N.crankShare * powerPerSecond(run);

export const powerPerSecond = (run: RunState): number =>
  Math.min(supplyMW(run), demandMW(run)) *
  cityPay(run) *
  speed(run) *
  overdriveBoost(run);

/**
 * The night's pay and know-how run on `delivered` megawatts. The grid's
 * clock moves the day along: a share of the plants' power charges the
 * batteries, the evening rush draws them down, and a rush that is not met
 * puts districts out (see grid.ts).
 */
function tickNight(run: RunState, dt: number): void {
  refundRemovedUpgrades(run);
  tickCrews(run, dt);
  settleLamps(run, dt);
  tickWeather(run, dt, () => incomePerSecond(run));
  const gridMult = tickGrid(run, dt, () => incomePerSecond(run));
  const supply = supplyMW(run);
  const demand = demandMW(run);
  const delivered = Math.min(supply, demand);
  const lit = (delivered / demand) * TOTAL_CITIES;
  run.resources.supply = supply;
  run.resources.demand = demand;
  run.resources.cities = lit;
  run.resources.night = Math.max(0, 100 * (1 - lit / TOTAL_CITIES));
  // Cities only pay for the power that reaches them.
  run.resources.power +=
    delivered * cityPay(run) * speed(run) * overdriveBoost(run) * gridMult * dt;
  run.resources.knowhow = res(run, "knowhow") + knowhowPerSecond(run) * dt;
}

// ------------------------------------------------------------------ The Sky

export const collectorEnergyPerSecond = (run: RunState): number =>
  level(run, "collector") *
  S.collectorEnergy *
  S.collectorMilestoneMult **
    S.collectorMilestones.filter((count) => level(run, "collector") >= count)
      .length *
  S.mirrorBonus ** tier(run, "mirror") *
  ifProject(run, "mirror-polish", SP.polishBoost) *
  (hasFork(run, "mirrors") ? FK.sky.mirrorsEnergy : 1) *
  mirrorMult(run) *
  lightMult(run) *
  (1 - wildLight(run)) *
  speed(run);

export const travelSeconds = (run: RunState): number =>
  S.travelBase * S.engineSaving ** tier(run, "engines");

export const copySpeed = (run: RunState): number =>
  S.copyBonus ** tier(run, "copy");

export const appetite = (run: RunState): number =>
  S.appetiteBonus ** tier(run, "appetite") *
  ifProject(run, "star-atlas", SP.atlasBoost);

export const aimEnergy = (run: RunState): number =>
  (S.aimBase + S.aimPerLevel * level(run, "aim")) * tapMult(run);

/** The sky's dials matter once there is a fleet to design and to lose. */
export const isFleetInPlay = (run: RunState): boolean =>
  run.phase === 2 && res(run, "probes") >= 1;

/** The share of the sunlight wild probes keep for themselves. */
export const wildLight = (run: RunState): number =>
  TUNING.dials.wildLight * wildShare(run);

const probeGrowthRate = (run: RunState): number => {
  const travel = S.travelBase * S.engineSaving ** tier(run, "engines");
  return (
    (S.probeGrowth *
      S.copyBonus ** tier(run, "copy") *
      ifProject(run, "probe-school", SP.schoolBoost)) /
    (1 + travel / S.travelHalf)
  );
};

/** Stars the tame fleet takes per second. */
export const starsPerSecond = (run: RunState): number =>
  res(run, "probes") *
  S.takePerProbe *
  appetite(run) *
  speed(run) *
  speedMult(run) *
  (1 - TUNING.dials.wildCrowd * wildShare(run));

/** Energy per star taken, light and mirrors included. */
export const starBounty = (run: RunState): number =>
  S.starBounty *
  S.relayBonus ** tier(run, "relay") *
  ifProject(run, "relay-codes", SP.relayBoost) *
  mirrorMult(run) *
  lightMult(run);

export const probeEnergyPerSecond = (run: RunState): number =>
  starsPerSecond(run) * starBounty(run);

/** The share of new copies that go wild. */
export const wildCopies = (run: RunState): number =>
  wildFraction(run, ifProject(run, "probe-school", SP.schoolWild));

function tickSky(run: RunState, dt: number): void {
  const r = run.resources;
  // Overdrive belongs to the night; a minute left over from an old save ends.
  r.odLeft = 0;
  refundRemovedSkyUpgrades(run);
  if (run.flags[SKY_DIALS_FLAG] !== true && res(run, "probes") >= 1)
    openSkyDials(run);
  tickDesign(run, dt, () => {
    r.knowhow = res(run, "knowhow") + SP.perHome;
  });
  tickSunEdge(run, dt, () => {
    r.knowhow = res(run, "knowhow") + SP.perFlare;
  });
  const remaining = r.stars;
  const open = remaining / TOTAL_STARS;
  let taken = 0;
  if ((r.probes > 0 || res(run, "skWild") > 0) && remaining > 0) {
    const growth =
      probeGrowthRate(run) *
      open *
      speed(run) *
      (1 - TUNING.dials.wildCrowd * wildShare(run)) *
      dt;
    const wild = res(run, "skWild");
    const noticed = wildShare(run);
    // Copies the fleet makes: the share that go wild leave it and grow on their own.
    const copies = r.probes * growth * copyMult(run);
    const strays = copies * wildCopies(run);
    r.probes += copies - strays;
    r.skWild = wild + strays + wild * growth * TUNING.dials.wildGrowth;
    if (
      strays > 0 &&
      noticed < TUNING.dials.wildNotice &&
      wildShare(run) >= TUNING.dials.wildNotice
    ) {
      r.skWilds = res(run, "skWilds") + 1;
      r.skWildLeft = TUNING.dials.wildBannerSeconds;
    }
    taken = Math.min(remaining, starsPerSecond(run) * dt);
    r.starsTaken += taken;
    r.stars = Math.max(0, TOTAL_STARS - r.starsTaken);
  }
  r.energy += collectorEnergyPerSecond(run) * dt + taken * starBounty(run);
  r.knowhow = res(run, "knowhow") + knowhowPerSecond(run) * dt;
}

// ----------------------------------------------------------- The Last Light

// The warmth, the lights and the boat live in warmth.ts; these names are kept
// here because the rest of the game reads them from the tick.
export {
  boatArrived,
  boatPace,
  isBoatOut,
  isReadyToFlash,
  letGoCount as lightsLetGo,
  resolvePerSecond,
  warmthOf as flameFraction,
} from "./warmth";

// ------------------------------------------------------------------- Shared

/** Keep the numbers the UI and scene read in step with what is owned. */
export function syncDisplay(run: RunState): void {
  const r = run.resources;
  r.lighthouses = lighthouseCount(run);
  r.keepers = keeperCount(run);
  r.collectors = level(run, "collector");
  r.lights = Math.max(0, TOTAL_LIGHTS - letGoCount(run));
  if (run.phase >= 1) {
    r.supply = supplyMW(run);
    r.demand = demandMW(run);
    if (run.phase === 1) {
      r.cities = citiesLit(run);
      r.night = Math.max(0, 100 * (1 - r.cities / TOTAL_CITIES));
    }
  }
}

export function tickLight(run: RunState, dt: number): void {
  const phase = run.phase;
  tickFund(run, dt, () => fundIncome(run));
  tickOverdrive(run, dt, () => nightSteadiness(run));
  if (phase === 0) tickCoast(run, dt);
  else if (phase === 1) tickNight(run, dt);
  else if (phase === 2) tickSky(run, dt);
  else tickWarmth(run, dt);
  syncDisplay(run);
}

export function manualLight(run: RunState): void {
  const r = run.resources;
  const phase = run.phase;
  if (phase === 0) {
    const flashes = shipsPerFlash(run);
    r.ships += flashes;
    r.coins += coastTapCoins(run);
    // Once the lamp panel is open, your own flashes burn oil too (a lit lamp
    // is a lit lamp), so the brightness is never a free lunch.
    if (isBeamOpen(run) && r.oil > 0)
      r.oil = Math.max(0, r.oil - burnAtStep(run, flashes, beamStep(run)));
  } else if (phase === 1) {
    r.power += crankPower(run);
  } else if (phase === 2) {
    r.energy += aimEnergy(run);
  } else {
    stoke(run, tapMult(run));
    r.resolve += tapResolve(run) * tapMult(run);
  }
}

export const isLightComplete = (run: RunState): boolean =>
  run.flags.finished === true;

export const PHASES_BY_INDEX = [
  PHASE_COAST,
  PHASE_NIGHT,
  PHASE_SKY,
  PHASE_LAST,
] as const;

// ----------------------------------------------------------------- Visitors

/** Seconds of a phase's income a visitor's gift is worth (a flare is 25). */
export const VISITOR_GIFT_SECONDS = 15;

/**
 * What the phase earns per second, taps at a steady 3 a second included, in
 * the phase's own currency: the yardstick for a gift (a visitor's gift is a
 * small slice, not a jackpot).
 */
export function incomePerSecond(run: RunState): number {
  if (run.phase === 0)
    return (
      autoCoinsPerSecond(run) * lampFactor(run) +
      C.tankTapsPerSecond * coastTapCoins(run)
    );
  if (run.phase === 1) return powerPerSecond(run) + crankPower(run) * 3;
  if (run.phase === 2)
    return (
      collectorEnergyPerSecond(run) +
      probeEnergyPerSecond(run) +
      aimEnergy(run) * 3
    );
  return 0;
}

/**
 * The coast's income on a calm night with a full lamp, taps at a steady 3 a
 * second included: the yardstick for the tide clock's catch, so a storm or a
 * dry lamp when the nets come in never makes it bigger or smaller.
 */
export const calmIncomePerSecond = (run: RunState): number =>
  autoCoinsPerSecond(run) + C.tankTapsPerSecond * calmTapCoins(run);

/**
 * The sky's income on a calm day, taps at a steady 3 a second included: the
 * yardstick for a probe's haul, so a flare or a drifting fleet when it
 * launches never makes it bigger or smaller by much.
 */
export const calmSkyIncomePerSecond = (run: RunState): number =>
  collectorEnergyPerSecond(run) +
  probeEnergyPerSecond(run) +
  aimEnergy(run) * 3;

/**
 * What the fund measures its size against: the part's income a second on a
 * calm day (the last part counts the pace of letting go).
 */
export function fundIncome(run: RunState): number {
  if (run.phase === 0) return calmIncomePerSecond(run);
  if (run.phase === 1) return incomePerSecond(run);
  if (run.phase === 2) return calmSkyIncomePerSecond(run);
  return lastResolvePerSecond(run);
}

/** The gift every income visitor brings: a small slice of the phase's income. */
export const visitorGift = (run: RunState): number =>
  VISITOR_GIFT_SECONDS * incomePerSecond(run);
