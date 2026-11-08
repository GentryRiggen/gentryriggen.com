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
import { TUNING } from "./tuning";
import { tickProbes } from "./probes";
import { tickGarden } from "./garden";
import {
  growthRate,
  rivalToll,
  tickHarbor,
  tollPay,
  trafficShare,
} from "./toll";
import { noteBuy, tankerDeal, tickTanker } from "./tanker";
import { tickFund } from "./fund";
import { hasFork, windRamp } from "./forkState";
import { overdriveBoost, overdriveStrain, tickOverdrive } from "./overdrive";
import { districtsDark, tickGrid } from "./grid";
import {
  buildMult,
  outageFactor,
  schoolMult,
  tickCrews,
  tickWeather,
} from "./weather";

const {
  coast: C,
  night: N,
  sky: S,
  last: L,
  projects: P,
  lamps: LAMPS,
} = TUNING;
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
  noteBuy(run, wasDark);
}

/** The oil market's own price, before any tanker's deal (a save from before reads today's). */
export const marketOilPrice = (run: RunState): number =>
  res(run, "oilBase") > 0 ? res(run, "oilBase") : res(run, "oilPrice");

function driftOilPrice(run: RunState, dt: number): void {
  const calm = run.mods.calm ?? 0;
  const before = marketOilPrice(run);
  const wobble =
    (nextRandom(run) - 0.5) * C.oilWobble * Math.sqrt(dt) * (1 - calm);
  const pull = (C.oilMean - before) * C.oilPull * dt;
  const base = Math.min(C.oilMax, Math.max(C.oilMin, before + pull + wobble));
  run.resources.oilBase = base;
  // A tanker in port sells below the market until it sails on.
  run.resources.oilPrice = base * tankerDeal(run);
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

/**
 * Sets the brightness (the streetlights' radio buttons). A new setting
 * takes a few seconds to settle, and the streetlights cannot change again
 * until it has: a choice is a commitment.
 */
export function setLamps(run: RunState, step: number): void {
  const next = Math.min(LAMPS.steps.length - 1, Math.max(0, Math.round(step)));
  if (next === lampStep(run) || lampLockLeft(run) > 0) return;
  run.resources.lamps = next;
  run.resources.lampChanges = res(run, "lampChanges") + 1;
  run.resources.lampLock = TUNING.grid.lampLockSeconds;
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
  tickCrews(run, dt);
  run.resources.lampLock = Math.max(0, res(run, "lampLock") - dt);
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
  overdriveBoost(run) *
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
    S.chartsSaving ** Math.min(1, tier(run, "nav")) *
    ifProject(run, "mirror-polish", SP.polishDrift) *
    (hasFork(run, "swarm")
      ? FK.sky.swarmDrift
      : hasFork(run, "mirrors")
        ? FK.sky.mirrorsDrift
        : 1) *
    overdriveStrain(run)
  );
}

const probeGrowthRate = (run: RunState): number => {
  const travel = S.travelBase * S.engineSaving ** tier(run, "engines");
  return (
    (S.probeGrowth *
      S.copyBonus ** tier(run, "copy") *
      ifProject(run, "probe-school", SP.schoolBoost)) /
    (1 + travel / S.travelHalf)
  );
};

/**
 * Steady glow: the fleet is flying true (at least `glowAt`), so it flies in
 * formation and takes stars a little faster.
 */
export const isFleetGlowing = (run: RunState): boolean =>
  isCourseInPlay(run) && headingOf(run) >= S.glowAt;

/** Stars the fleet takes per second at its heading (glow included). */
export const starsPerSecond = (run: RunState): number =>
  res(run, "probes") *
  S.takePerProbe *
  appetite(run) *
  speed(run) *
  headingFactor(run) *
  (isFleetGlowing(run) ? 1 + S.glowBonus : 1);

/** Energy per second from probes: every star taken pays a bounty. */
export const starBounty = (run: RunState): number =>
  S.starBounty *
  S.relayBonus ** tier(run, "relay") *
  ifProject(run, "relay-codes", SP.relayBoost) *
  overdriveBoost(run);

export const probeEnergyPerSecond = (run: RunState): number =>
  starsPerSecond(run) * starBounty(run);

/** Energy a solar flare pays when caught: a slice of income plus aiming. */
export const flareBonus = (run: RunState): number =>
  S.flareBonusSeconds *
  ifProject(run, "flare-watch", SP.flarePay) *
  (collectorEnergyPerSecond(run) +
    probeEnergyPerSecond(run) +
    aimEnergy(run) * 3);

/**
 * Drift builds, charts and a navigator fix the course. A solar flare opens
 * once its timer runs out and waits until it is caught (see `catch-flare`).
 */
function updateSkyEvents(run: RunState, dt: number): void {
  const r = run.resources;
  if (isCourseInPlay(run)) {
    r.heading = Math.max(0, headingOf(run) - driftPerSecond(run) * dt);
    if (isCourseAuto(run) && r.heading < S.autoCorrectBelow)
      r.heading = S.autoCorrectTo;
  }
  // Flares come as soon as there is a collector to catch one.
  if (res(run, "collectors") < 1 || r.flare > 0) return;
  r.flareCooldown -= dt;
  if (r.flareCooldown <= 0) r.flare = 1;
}

/** The wait before the next solar flare once one is caught. */
export const nextFlareIn = (run: RunState): number =>
  (S.flareGapMin + nextRandom(run) * S.flareGapSpread) *
  ifProject(run, "flare-watch", SP.flareGap) *
  ifProject(run, "probe-school", SP.schoolFlareGap);

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
  r.energy += collectorEnergyPerSecond(run) * dt + taken * starBounty(run);
  r.knowhow = res(run, "knowhow") + knowhowPerSecond(run) * dt;
}

// ----------------------------------------------------------- The Last Light

export const lightsLetGo = (run: RunState): number =>
  Object.keys(run.owned).filter((id) => id.startsWith("letgo-")).length;

/** What each light you let go leaves behind. */
export type LetGoGift = "fade" | "burst" | "taps";

/** In the order the lights are offered: three on offer always differ a little. */
export const LET_GO_GIFTS: Readonly<Record<string, LetGoGift>> = {
  "letgo-porch": "fade",
  "letgo-signs": "burst",
  "letgo-stadium": "taps",
  "letgo-bridges": "fade",
  "letgo-harbor": "taps",
  "letgo-towers": "burst",
  "letgo-festival": "burst",
  "letgo-fire": "fade",
  "letgo-moon": "taps",
  "letgo-sun": "fade",
  "letgo-night": "burst",
};

const giftsOwned = (run: RunState, gift: LetGoGift): number =>
  Object.entries(LET_GO_GIFTS).filter(
    ([id, g]) => g === gift && level(run, id) > 0
  ).length;

/** The flame, 0..flameFull; a save from before the flame starts it lit. */
export const flameOf = (run: RunState): number =>
  Math.min(L.flameFull, Math.max(0, run.resources.flame ?? L.startFlame));

export const flameFraction = (run: RunState): number =>
  flameOf(run) / L.flameFull;

/** Share of the flame lost each second. */
export function fadeRate(run: RunState): number {
  return (
    (res(run, "lights") + L.darkness) *
    L.decayPerLight *
    L.fadeSaving ** giftsOwned(run, "fade") *
    (hasFork(run, "release")
      ? FK.last.releaseFade
      : hasFork(run, "keep")
        ? FK.last.keepFade
        : 1) *
    (1 - L.brightDecay * (run.mods.bright ?? 0))
  );
}

/** A tap is worth more for every moon-like light let go. */
export const tapGiftMult = (run: RunState): number =>
  (1 + L.tapGift * giftsOwned(run, "taps")) *
  (hasFork(run, "keep") ? FK.last.keepTaps : 1);

/**
 * Share of the way to full one tap brings. The "taps" gifts make a tap let go
 * more (resolve), not warm more, or a keen tapper would hold the flame full.
 */
export const tapWarmth = (run: RunState): number =>
  Math.min(1, L.tapWarmth * tapMult(run));

/** Flame one tap adds: a share of what is missing, so a cold flame leaps. */
export const lastTapFlame = (run: RunState): number =>
  (L.flameFull - flameOf(run)) * tapWarmth(run);

export const lastTapResolve = (run: RunState): number =>
  L.resolvePerTap * tapGiftMult(run);

/** Flame the lantern holds at when tapped `tapsPerSecond` times a second. */
export const steadyFlame = (run: RunState, tapsPerSecond = 3): number => {
  const warming = tapWarmth(run) * tapsPerSecond;
  return (L.flameFull * warming) / Math.max(warming + fadeRate(run), 1e-6);
};

/**
 * Steering earns resolve: while the boat is out and still sailing, keeping
 * its heading true makes letting go faster (1x when it has lost the beam,
 * up to 1 + `steerBonus` when it is true). Never slower than usual.
 */
export function steerBonus(run: RunState): number {
  if (!isBoatOut(run) || boatArrived(run)) return 1;
  const truth =
    (boatHeadingOf(run) - L.steerFrom) / (L.steerTrue - L.steerFrom);
  return 1 + L.steerBonus * Math.min(1, Math.max(0, truth));
}

/** Resolve per second: a cold flame is slow (never stopped), letting go helps. */
export function resolvePerSecond(run: RunState): number {
  const warmth = L.flameFloor + (1 - L.flameFloor) * flameFraction(run);
  return (
    L.resolvePerSecond *
    steerBonus(run) *
    (1 + L.reliefPerLetGo * lightsLetGo(run)) *
    (hasFork(run, "release") ? FK.last.releaseResolve : 1) *
    warmth *
    speed(run)
  );
}

export const isBoatOut = (run: RunState): boolean =>
  run.phase === 3 && res(run, "lights") <= L.boatAtLights;

export const boatHeadingOf = (run: RunState): number =>
  Math.min(100, Math.max(0, run.resources.boatHeading ?? 100));

export const boatArrived = (run: RunState): boolean =>
  res(run, "boatProgress") >= 100;

/** How fast the boat sails: floor..1 of full pace, by how true its heading is. */
export const boatPace = (run: RunState): number =>
  L.boatFloor + (1 - L.boatFloor) * (boatHeadingOf(run) / 100);

/** The last light is up and the first ship waits for one flash. */
export const isReadyToFlash = (run: RunState): boolean =>
  run.phase === 3 &&
  res(run, "lights") <= 1 &&
  boatArrived(run) &&
  run.flags.finished !== true;

function tickLast(run: RunState, dt: number): void {
  const r = run.resources;
  const flame = flameOf(run);
  r.flame = Math.min(L.flameFull, flame * Math.exp(-fadeRate(run) * dt));
  r.resolve += resolvePerSecond(run) * dt;
  if (!isBoatOut(run) || boatArrived(run)) return;
  r.boatHeading = Math.max(0, boatHeadingOf(run) - L.boatDrift * dt);
  r.boatProgress = Math.min(
    100,
    res(run, "boatProgress") + (100 / L.boatSeconds) * boatPace(run) * dt
  );
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
  // Every phase: a probe away and a haul flowing in when the sky ends finish.
  tickProbes(run, dt, () => calmSkyIncomePerSecond(run));
  tickGarden(run, dt);
  tickFund(run, dt, () => fundIncome(run));
  tickOverdrive(run, dt, () =>
    run.phase === 1 ? nightSteadiness(run) : headingOf(run)
  );
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
    // Once the lamp panel is open, your own flashes burn oil too (a lit lamp
    // is a lit lamp), so the brightness is never a free lunch.
    if (isBeamOpen(run) && r.oil > 0)
      r.oil = Math.max(0, r.oil - burnAtStep(run, flashes, beamStep(run)));
  } else if (phase === 1) {
    r.power += crankPower(run);
  } else if (phase === 2) {
    r.energy += aimEnergy(run);
  } else {
    r.flame = Math.min(L.flameFull, flameOf(run) + lastTapFlame(run));
    r.resolve += lastTapResolve(run);
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
  return resolvePerSecond(run);
}

/** The gift every income visitor brings: a small slice of the phase's income. */
export const visitorGift = (run: RunState): number =>
  VISITOR_GIFT_SECONDS * incomePerSecond(run);
