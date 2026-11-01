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

// ---------------------------------------------------------------- The Coast

export const lighthouseCount = (run: RunState): number =>
  1 + level(run, "lighthouse");

export const shipsPerFlash = (run: RunState): number =>
  (1 + level(run, "lens")) * tapMult(run);

export const fare = (run: RunState): number =>
  C.fareGrowth ** level(run, "fees");

export const isStorming = (run: RunState): boolean => res(run, "storm") > 0;

/** Coins one tap earns on the coast. */
export function coastTapCoins(run: RunState): number {
  const bonus = isStorming(run) ? C.stormTapBonus : 1;
  return shipsPerFlash(run) * bonus * fare(run);
}

/** Lamp oil burned per second: a steady glow plus a bit per ship guided. */
const burnPerSecond = (run: RunState, shipsPerSecond: number): number =>
  (lighthouseCount(run) * C.burnBase + C.burnPerShip * shipsPerSecond) *
  C.wickSaving ** level(run, "wick");

/** Keeper tiers: id and how many flashes per second each one makes. */
export const KEEPER_TIERS = [
  { id: "keeper", flashes: 0.5 },
  { id: "crew", flashes: 6 },
  { id: "station", flashes: 70 },
  { id: "fleet", flashes: 800 },
] as const;

export const keeperCount = (run: RunState): number =>
  KEEPER_TIERS.reduce((sum, t) => sum + level(run, t.id), 0);

const autoFlashRate = (run: RunState): number =>
  KEEPER_TIERS.reduce((sum, t) => sum + level(run, t.id) * t.flashes, 0) *
  lighthouseCount(run) *
  (1 + C.lensAutoBonus * level(run, "lens"));

const tankCapacity = (run: RunState): number =>
  (C.tankBase + C.tankPerLevel * level(run, "tank")) * lighthouseCount(run);

function driftOilPrice(run: RunState, dt: number): void {
  const calm = run.mods.calm ?? 0;
  const wobble = (nextRandom(run) - 0.5) * 0.3 * Math.sqrt(dt) * (1 - calm);
  const pull = (C.oilMean - run.resources.oilPrice) * 0.03 * dt;
  run.resources.oilPrice = Math.min(
    C.oilMax,
    Math.max(C.oilMin, run.resources.oilPrice + pull + wobble)
  );
}

/** The keepers buy oil: a top-up when low, a full tank when it is cheap. */
function restockOil(run: RunState): void {
  const capacity = tankCapacity(run);
  const price = run.resources.oilPrice;
  const cheap = price <= 1.5 + 0.15 * level(run, "tank");
  let want = 0;
  if (cheap) want = capacity - run.resources.oil;
  else if (run.resources.oil < capacity * 0.2)
    want = capacity * 0.5 - run.resources.oil;
  if (want <= 0) return;
  const bought = Math.min(want, run.resources.coins / price);
  if (bought <= 0) return;
  run.resources.oil += bought;
  run.resources.coins -= bought * price;
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

function tickCoast(run: RunState, dt: number): void {
  driftOilPrice(run, dt);
  updateStorm(run, dt);
  const lamp = run.resources.oil > 0 ? 1 : C.dimLamp;
  const stormFactor = isStorming(run)
    ? Math.min(1, C.stormPassive + C.stormShutterBonus * level(run, "shutters"))
    : 1;
  const shipsPerSecond =
    autoFlashRate(run) * tapMult(run) * lamp * stormFactor * speed(run);
  const ships = shipsPerSecond * dt;
  run.resources.ships += ships;
  run.resources.coins += ships * fare(run);
  run.resources.oil = Math.max(
    0,
    run.resources.oil - burnPerSecond(run, shipsPerSecond) * dt
  );
  restockOil(run);
}

// ------------------------------------------------------------ No More Night

/** Megawatts of everything built, with the lines' bonus. */
export function supplyMW(run: RunState): number {
  const raw = N.gensMW.reduce(
    (sum, mw, i) => sum + mw * level(run, `gen${i + 1}`),
    0
  );
  return raw * (1 + N.lineBonus * level(run, "lines"));
}

export const demandMW = (run: RunState): number =>
  TOTAL_CITIES * N.perCityMW * N.bulbSaving ** level(run, "bulbs");

/** Cities powered right now (fractional), 0..TOTAL_CITIES. */
export function citiesLit(run: RunState): number {
  const delivered = Math.min(supplyMW(run), demandMW(run));
  return (delivered / demandMW(run)) * TOTAL_CITIES;
}

export const crankPower = (run: RunState): number =>
  (N.crankBase + N.crankPerLevel * level(run, "crank")) * tapMult(run);

function tickNight(run: RunState, dt: number): void {
  const supply = supplyMW(run);
  const demand = demandMW(run);
  const delivered = Math.min(supply, demand);
  const lit = (delivered / demand) * TOTAL_CITIES;
  run.resources.supply = supply;
  run.resources.demand = demand;
  run.resources.cities = lit;
  run.resources.night = Math.max(0, 100 * (1 - lit / TOTAL_CITIES));
  // Cities only pay for the power that reaches them.
  run.resources.power += delivered * N.payPerMW * speed(run) * dt;
}

// ------------------------------------------------------------------ The Sky

export const aimEnergy = (run: RunState): number =>
  (S.aimBase + S.aimPerLevel * level(run, "aim")) * tapMult(run);

const probeGrowthRate = (run: RunState): number => {
  const travel = S.travelBase * S.engineSaving ** level(run, "engines");
  return (
    (S.probeGrowth * S.copyBonus ** level(run, "copy")) /
    (1 + travel / S.travelHalf)
  );
};

function tickSky(run: RunState, dt: number): void {
  const r = run.resources;
  const remaining = r.stars;
  const open = remaining / TOTAL_STARS;
  if (r.probes > 0 && remaining > 0) {
    r.probes += r.probes * probeGrowthRate(run) * open * speed(run) * dt;
    const takePer = S.takePerProbe * S.appetiteBonus ** level(run, "appetite");
    const taken = Math.min(remaining, r.probes * takePer * speed(run) * dt);
    r.starsTaken += taken;
    r.stars = Math.max(0, TOTAL_STARS - r.starsTaken);
  }
  const collected =
    r.collectors * S.collectorEnergy * S.mirrorBonus ** level(run, "mirror");
  r.energy += (collected + r.starsTaken * S.energyPerStar) * speed(run) * dt;
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
