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
import { TUNING } from "./tuning";

const { coast: C, night: N, sky: S, last: L } = TUNING;

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

export const shipsPerFlash = (run: RunState): number =>
  (1 + level(run, "lens")) * tapMult(run);

export const fare = (run: RunState): number =>
  C.fareGrowth ** tier(run, "fees") * C.dockBonus ** tier(run, "dock");

export const isStorming = (run: RunState): boolean => res(run, "storm") > 0;

/** A dry lamp is dim: it guides fewer ships, but still guides some. */
export const lampFactor = (run: RunState): number =>
  res(run, "oil") > 0 ? 1 : C.dimLamp;

/** Coins one tap earns on the coast. */
export function coastTapCoins(run: RunState): number {
  const bonus = isStorming(run) ? C.stormTapBonus : 1;
  return shipsPerFlash(run) * bonus * fare(run) * lampFactor(run);
}

/** Coins one tap would earn on a calm night with a full lamp. */
export const calmTapCoins = (run: RunState): number =>
  shipsPerFlash(run) * fare(run);

/** How much each keeper's work is multiplied by their training. */
export const trainingMult = (run: RunState): number =>
  C.trainingSteps
    .slice(0, tier(run, "train"))
    .reduce((product, step) => product * step, 1);

export const keeperCount = (run: RunState): number => level(run, "keeper");

/** Flashes per second the keepers make, lamp and weather aside. */
export const autoFlashRate = (run: RunState): number =>
  keeperCount(run) *
  C.keeperFlashes *
  lighthouseCount(run) *
  trainingMult(run) *
  (1 + C.lensAutoBonus * level(run, "lens")) *
  tapMult(run) *
  speed(run);

/** Coins per second the keepers earn on a calm night with a full lamp. */
export const autoCoinsPerSecond = (run: RunState): number =>
  autoFlashRate(run) * fare(run);

const oilSaving = (run: RunState): number => C.wickSaving ** tier(run, "wick");

/** Lamp oil burned per second: a steady glow plus a bit per ship guided. */
export const burnPerSecond = (run: RunState, shipsPerSecond: number): number =>
  (lighthouseCount(run) * C.burnBase + burnPerShip(run) * shipsPerSecond) *
  oilSaving(run);

/** A bigger operation burns more oil per ship: little at first, a lot later. */
const burnPerShip = (run: RunState): number =>
  C.burnPerShip + C.burnPerShipPerLighthouse * (lighthouseCount(run) - 1);

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
    autoFlashRate(run) + C.tankTapsPerSecond * shipsPerFlash(run);
  const seconds = C.tankSeconds + C.tankSecondsPerTier * tier(run, "tank");
  return Math.max(
    C.tankBase * lighthouseCount(run),
    burnPerSecond(run, fullTiltShips) * seconds
  );
};

/**
 * Oil one barrel brings: half a tank, never more than the tank has room for
 * or most of the bank can pay for (a poor lighthouse still gets a small barrel).
 */
export const barrelOil = (run: RunState): number =>
  Math.max(
    0,
    Math.min(
      Math.max(C.barrelMin, tankCapacity(run) * C.barrelShare),
      tankCapacity(run) - res(run, "oil"),
      Math.max(
        C.barrelMin,
        (res(run, "coins") * C.barrelCoinShare) /
          Math.max(res(run, "oilPrice"), 0.01)
      )
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
  const price = run.resources.oilPrice;
  const affordable = Math.min(oil, run.resources.coins / price);
  if (affordable <= 0) return;
  run.resources.oil += affordable;
  run.resources.coins -= affordable * price;
}

function driftOilPrice(run: RunState, dt: number): void {
  const calm = run.mods.calm ?? 0;
  const before = run.resources.oilPrice;
  const wobble =
    (nextRandom(run) - 0.5) * C.oilWobble * Math.sqrt(dt) * (1 - calm);
  const pull = (C.oilMean - before) * C.oilPull * dt;
  run.resources.oilPrice = Math.min(
    C.oilMax,
    Math.max(C.oilMin, before + pull + wobble)
  );
  const slope = (run.resources.oilPrice - before) / dt;
  run.resources.oilTrend +=
    (slope - run.resources.oilTrend) * Math.min(1, dt / C.trendSeconds);
}

/**
 * The oil merchant contract: tops the tank up whenever oil is cheap, and a
 * little at any price when it is nearly dry. Never more than coins allow.
 */
function merchantBuys(run: RunState): void {
  if (level(run, "contract") === 0) return;
  const capacity = tankCapacity(run);
  const oil = run.resources.oil;
  if (run.resources.oilPrice <= C.contractPrice && oil < capacity * 0.7) {
    buyBarrel(run);
  } else if (oil < capacity * 0.05) {
    buyBarrel(run);
  }
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
  Math.min(1, C.stormPassive + C.stormShutterBonus * tier(run, "shutters"));

function tickCoast(run: RunState, dt: number): void {
  driftOilPrice(run, dt);
  updateStorm(run, dt);
  const stormFactor = isStorming(run) ? stormPassive(run) : 1;
  const shipsPerSecond = autoFlashRate(run) * lampFactor(run) * stormFactor;
  const ships = shipsPerSecond * dt;
  run.resources.ships += ships;
  run.resources.coins += ships * fare(run);
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

/** Megawatts of everything built, with the lines' bonus. */
export function supplyMW(run: RunState): number {
  const raw = N.gensMW.reduce(
    (sum, mw, i) => sum + mw * level(run, `gen${i + 1}`),
    0
  );
  return (
    raw *
    (1 + N.lineBonus * tier(run, "lines")) *
    N.substationBonus ** tier(run, "subs")
  );
}

export const demandMW = (run: RunState): number =>
  TOTAL_CITIES * N.perCityMW * N.bulbSaving ** tier(run, "bulbs");

/** Cities powered right now (fractional), 0..TOTAL_CITIES. */
export function citiesLit(run: RunState): number {
  const delivered = Math.min(supplyMW(run), demandMW(run));
  return (delivered / demandMW(run)) * TOTAL_CITIES;
}

/** Steadiness 0..100; a save from before the grid existed counts as steady. */
export const gridSteadiness = (run: RunState): number =>
  run.resources.grid ?? 100;

/** What cities pay while the grid is this steady: floor..1, never zero. */
export const gridFactor = (run: RunState): number =>
  N.gridFloor + (1 - N.gridFloor) * (gridSteadiness(run) / 100);

export const isGridAuto = (run: RunState): boolean => tier(run, "grid") >= 2;
export const isRushOn = (run: RunState): boolean => res(run, "rush") > 0;
export const isGridInPlay = (run: RunState): boolean =>
  run.phase === 1 && supplyMW(run) >= N.gridVisibleSupplyMW;

/** How hard the grid is worked, 0..1 (on a log scale: every plant counts). */
export const gridLoad = (run: RunState): number =>
  Math.min(1, Math.log10(1 + supplyMW(run)) / Math.log10(1 + demandMW(run)));

/** Steadiness lost per second right now (percent), rush included. */
export function strainPerSecond(run: RunState): number {
  return (
    (N.strainBase + N.strainPerLoad * gridLoad(run)) *
    (isRushOn(run) ? N.rushStrainMult : 1) *
    N.balancerSaving ** Math.min(1, tier(run, "grid"))
  );
}

export const crankPower = (run: RunState): number =>
  (N.crankBase + N.crankPerLevel * level(run, "crank")) * tapMult(run);

export const powerPerSecond = (run: RunState): number =>
  Math.min(supplyMW(run), demandMW(run)) *
  N.payPerMW *
  speed(run) *
  gridFactor(run);

/** Power the evening rush pays when claimed: a slice of income plus taps. */
export const rushBonus = (run: RunState): number =>
  N.rushBonusSeconds * (powerPerSecond(run) + crankPower(run) * 3);

/** Strain builds, the rush comes and goes, a smart grid fixes itself. */
function updateGrid(run: RunState, dt: number): void {
  const r = run.resources;
  if (!isGridInPlay(run)) return;
  r.grid = Math.max(0, gridSteadiness(run) - strainPerSecond(run) * dt);
  if (isGridAuto(run) && r.grid < N.autoBalanceBelow) r.grid = N.autoBalanceTo;
  if (r.rush > 0) {
    r.rush = Math.max(0, r.rush - dt);
    return;
  }
  r.rushCooldown -= dt;
  if (r.rushCooldown > 0) return;
  r.rush = N.rushLength;
  r.rushCooldown = N.rushGapMin + nextRandom(run) * N.rushGapSpread;
}

function tickNight(run: RunState, dt: number): void {
  updateGrid(run, dt);
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
    delivered * N.payPerMW * speed(run) * gridFactor(run) * dt;
}

// ------------------------------------------------------------------ The Sky

export const collectorEnergyPerSecond = (run: RunState): number =>
  level(run, "collector") *
  S.collectorEnergy *
  S.mirrorBonus ** tier(run, "mirror") *
  speed(run);

export const travelSeconds = (run: RunState): number =>
  S.travelBase * S.engineSaving ** tier(run, "engines");

export const copySpeed = (run: RunState): number =>
  S.copyBonus ** tier(run, "copy");

export const appetite = (run: RunState): number =>
  S.appetiteBonus ** tier(run, "appetite");

export const aimEnergy = (run: RunState): number =>
  (S.aimBase + S.aimPerLevel * level(run, "aim")) * tapMult(run);

/** Heading 0..100; a save from before course drift counts as on course. */
export const headingOf = (run: RunState): number =>
  run.resources.heading ?? 100;

/** How well the fleet flies: floor..1, never zero. */
export const headingFactor = (run: RunState): number =>
  S.headingFloor + (1 - S.headingFloor) * (headingOf(run) / 100);

export const isCourseAuto = (run: RunState): boolean => tier(run, "nav") >= 2;
export const isFlareOn = (run: RunState): boolean => res(run, "flare") > 0;
export const isCourseInPlay = (run: RunState): boolean =>
  run.phase === 2 && res(run, "probes") >= 1;

/** Heading lost per second (percent): more probes, more ways to wander. */
export function driftPerSecond(run: RunState): number {
  return (
    (S.driftBase + S.driftPerDecade * Math.log10(1 + res(run, "probes"))) *
    S.chartsSaving ** Math.min(1, tier(run, "nav"))
  );
}

const probeGrowthRate = (run: RunState): number => {
  const travel = S.travelBase * S.engineSaving ** tier(run, "engines");
  return (
    (S.probeGrowth * S.copyBonus ** tier(run, "copy")) /
    (1 + travel / S.travelHalf)
  );
};

/** Stars the fleet takes per second at its heading. */
export const starsPerSecond = (run: RunState): number =>
  res(run, "probes") *
  S.takePerProbe *
  appetite(run) *
  speed(run) *
  headingFactor(run);

/** Energy per second from probes: every star taken pays a bounty. */
export const starBounty = (run: RunState): number =>
  S.starBounty * S.relayBonus ** tier(run, "relay");

export const probeEnergyPerSecond = (run: RunState): number =>
  starsPerSecond(run) * starBounty(run);

/** Energy a solar flare pays when caught: a slice of income plus aiming. */
export const flareBonus = (run: RunState): number =>
  S.flareBonusSeconds *
  (collectorEnergyPerSecond(run) +
    probeEnergyPerSecond(run) +
    aimEnergy(run) * 3);

/** Drift builds, flares come and go, charts and a navigator fix the course. */
function updateSkyEvents(run: RunState, dt: number): void {
  const r = run.resources;
  if (isCourseInPlay(run)) {
    r.heading = Math.max(0, headingOf(run) - driftPerSecond(run) * dt);
    if (isCourseAuto(run) && r.heading < S.autoCorrectBelow)
      r.heading = S.autoCorrectTo;
  }
  // Flares come as soon as there is a collector to catch one.
  if (res(run, "collectors") < 1) return;
  if (r.flare > 0) {
    r.flare = Math.max(0, r.flare - dt);
    return;
  }
  r.flareCooldown -= dt;
  if (r.flareCooldown > 0) return;
  r.flare = S.flareLength;
  r.flareCooldown = S.flareGapMin + nextRandom(run) * S.flareGapSpread;
}

function tickSky(run: RunState, dt: number): void {
  updateSkyEvents(run, dt);
  const r = run.resources;
  const remaining = r.stars;
  const open = remaining / TOTAL_STARS;
  let taken = 0;
  if (r.probes > 0 && remaining > 0) {
    r.probes +=
      r.probes *
      probeGrowthRate(run) *
      open *
      speed(run) *
      headingFactor(run) *
      dt;
    taken = Math.min(remaining, starsPerSecond(run) * dt);
    r.starsTaken += taken;
    r.stars = Math.max(0, TOTAL_STARS - r.starsTaken);
  }
  const collected =
    r.collectors * S.collectorEnergy * S.mirrorBonus ** tier(run, "mirror");
  r.energy += collected * speed(run) * dt + taken * starBounty(run);
}

// ----------------------------------------------------------- The Last Light

export const lightsLetGo = (run: RunState): number =>
  Object.keys(run.owned).filter((id) => id.startsWith("letgo-")).length;

export function decayPerSecond(run: RunState): number {
  const lights = res(run, "lights");
  return (
    lights *
    L.decayPerLight *
    L.shieldSaving ** level(run, "shield") *
    (1 - L.brightDecay * (run.mods.bright ?? 0))
  );
}

export const lastTapEnergy = (run: RunState): number =>
  L.tapEnergy * (1 + L.glassBonus * level(run, "glass")) * tapMult(run);

function tickLast(run: RunState, dt: number): void {
  run.resources.energy = Math.max(
    0,
    run.resources.energy - decayPerSecond(run) * dt
  );
  run.resources.resolve += L.resolvePerSecond * speed(run) * dt;
}

// ------------------------------------------------------------------- Shared

/** Keep the numbers the UI and scene read in step with what is owned. */
export function syncDisplay(run: RunState): void {
  const r = run.resources;
  r.lighthouses = lighthouseCount(run);
  r.keepers = keeperCount(run);
  r.collectors = level(run, "collector");
  r.lights = Math.max(0, TOTAL_LIGHTS - lightsLetGo(run));
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
  if (phase === 0) tickCoast(run, dt);
  else if (phase === 1) tickNight(run, dt);
  else if (phase === 2) tickSky(run, dt);
  else tickLast(run, dt);
  syncDisplay(run);
}

export function manualLight(run: RunState): void {
  const r = run.resources;
  const phase = run.phase;
  if (phase === 0) {
    const flashes = shipsPerFlash(run);
    r.ships += flashes;
    r.coins += coastTapCoins(run);
  } else if (phase === 1) {
    r.power += crankPower(run);
  } else if (phase === 2) {
    r.energy += aimEnergy(run);
  } else {
    r.energy += lastTapEnergy(run);
    r.resolve += L.resolvePerTap;
    if (r.lights <= 1 && level(run, "remember") > 0) run.flags.finished = true;
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
