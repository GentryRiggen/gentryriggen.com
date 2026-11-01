import type { RunState } from "../../engine/types";
import { visitorHereFlag } from "../../engine/engine";
import {
  FULL_GROWTH,
  MANUAL_RESOURCES,
  PHASE_SEED,
  PHASE_IDS,
} from "./resources";
import { seasonBoost } from "./seasons";
import { TUNING } from "./tuning";
import { tickWater, waterFactor } from "./water";
import { RETURN_VISITOR_ID } from "./visitors";

/** The helper and the scaling upgrade of each phase, by phase index. */
export const HELPER_IDS = ["sprinkler", "scarecrow", "windbreak", "trellis"];
export const SCALE_IDS = ["mulch", "compost", "rain-makers", "sunny-sill"];

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const speed = (run: RunState): number => run.mods.speed ?? 1;
const tapMult = (run: RunState): number => run.mods.tapMult ?? 1;

const scaleMult = (run: RunState): number =>
  1 + TUNING.phases[run.phase].scalePer * owned(run, SCALE_IDS[run.phase]);

/** What one tap earns right now (in spring, planting pays more). */
export function manualPerTap(run: RunState): number {
  const season = run.phase === 0 ? seasonBoost(run, "plant") : 1;
  return TUNING.phases[run.phase].tap * scaleMult(run) * tapMult(run) * season;
}

/**
 * The phase's manual resource per second from helpers alone. In the yard it
 * is how fast the garden ripens produce: sprinklers and bees, halved while
 * the tank is dry, better in summer.
 */
/** Compost tea and the greenhouse make the whole garden ripen faster. */
const ripenMult = (run: RunState): number =>
  (1 + TUNING.yard.teaPer * owned(run, "compost-tea")) *
  (owned(run, "greenhouse") > 0 ? TUNING.yard.greenhouse : 1) *
  (owned(run, "orchard") > 0 ? TUNING.yard.orchard : 1);

export function incomePerSecond(run: RunState): number {
  const y = TUNING.yard;
  if (run.phase === 0)
    return (
      (owned(run, "sprinkler") * y.sprinklerRate +
        owned(run, "bee-hive") * y.hiveRate) *
      scaleMult(run) *
      ripenMult(run) *
      speed(run) *
      waterFactor(run) *
      seasonBoost(run, "grow")
    );
  return (
    owned(run, HELPER_IDS[run.phase]) *
    TUNING.phases[run.phase].helper *
    scaleMult(run) *
    speed(run)
  );
}

/**
 * The share of ripening produce the baskets and gardeners pick on their own,
 * at the base rate. The rest waits in the garden for a hand to pick it, and
 * waits as long as it takes. Wheelbarrows let the pickers keep up with more.
 */
export function pickShare(run: RunState): number {
  const y = TUNING.yard;
  const crew =
    owned(run, "basket") * y.basketShare +
    owned(run, "gardener") * y.gardenerShare;
  const cap = y.pickCap + y.barrowPer * owned(run, "wheelbarrow");
  return Math.min(cap, crew);
}

/** Produce per second picked into seeds with nobody lifting a finger. */
export const pickPerSecond = (run: RunState): number =>
  pickShare(run) * incomePerSecond(run);

/** Earned care also grows the one pot, which is all the seed phase asks for. */
function earn(run: RunState, amount: number): void {
  const id = MANUAL_RESOURCES[run.phase];
  run.resources[id] += amount;
  if (PHASE_IDS[run.phase] === PHASE_SEED)
    run.resources.growth = Math.min(
      FULL_GROWTH,
      run.resources.growth + amount * TUNING.seed.growthPerCare
    );
}

/** The yard: water, ripening, and the helpers that pick (never spoils). */
function tickYard(run: RunState, dt: number): void {
  tickWater(run, dt);
  run.resources.produce += incomePerSecond(run) * dt;
  const picked = Math.min(run.resources.produce, pickPerSecond(run) * dt);
  run.resources.produce -= picked;
  run.resources.seeds += picked;
}

export function tickGrow(run: RunState, dt: number): void {
  if (run.phase === 0) tickYard(run, dt);
  else earn(run, incomePerSecond(run) * dt);
}

export function manualGrow(run: RunState): void {
  earn(run, manualPerTap(run));
}

export const isGrowComplete = (run: RunState): boolean =>
  run.flags[visitorHereFlag(RETURN_VISITOR_ID)] === true;
