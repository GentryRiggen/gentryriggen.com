import type { RunState } from "../../engine/types";
import { visitorHereFlag } from "../../engine/engine";
import { MANUAL_RESOURCES } from "./resources";
import { pollenRipenMult, tickBees } from "./bees";
import { greenMult, tickBiomes } from "./biomes";
import { tickFair } from "./fair";
import { phaseBoost, tickKnowhow } from "./knowhow";
import {
  farmForkMult,
  orchardMult,
  seedHelperMult,
  sprinklerForkMult,
} from "./forks";
import {
  bankGainFor,
  bankKept,
  bankStock,
  savedShare,
  tickBank,
} from "./seedbank";
import { tickMigration } from "./migration";
import { marketMult, tickMarket } from "./market";
import { seasonBoost } from "./seasons";
import { TUNING } from "./tuning";
import { tickWater, waterFactor } from "./water";
import { RETURN_VISITOR_ID } from "./visitors";
import { addCare, isWindowBoxOpen, tickWindowBox } from "./windowbox";

/** The helper and the scaling upgrade of each phase, by phase index. */
export const HELPER_IDS = ["sprinkler", "scarecrow", "windbreak", "trellis"];
export const SCALE_IDS = ["mulch", "compost", "rain-makers", "sunny-sill"];

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const speed = (run: RunState): number => run.mods.speed ?? 1;
const tapMult = (run: RunState): number => run.mods.tapMult ?? 1;

/**
 * What a line of helpers makes at `level`: every level multiplies the line by
 * `TUNING.stackGrowth`, so each purchase is a visible jump, not one more
 * identical helper. Level 0 is nothing.
 */
export const stacked = (level: number): number =>
  level <= 0 ? 0 : TUNING.stackGrowth ** level;

/** Scaling upgrades multiply too: each level makes taps and helpers pay more. */
const scaleMult = (run: RunState): number =>
  (1 + TUNING.phases[run.phase].scalePer) **
  (owned(run, SCALE_IDS[run.phase]) +
    (run.phase === 1 ? owned(run, "silo") : 0));

/**
 * The farm's pay before the seed bank takes its share: the bank's yield
 * bonus is already in, the kept share is not yet out.
 */
function farmGrossTap(run: RunState): number {
  return (
    TUNING.phases[1].tap *
    scaleMult(run) *
    tapMult(run) *
    marketMult(run) *
    farmForkMult(run) *
    phaseBoost(run) *
    (1 + bankGain(run))
  );
}

/** Harvest per second from the farm's helpers, kept share not yet taken. */
function farmGrossIncome(run: RunState): number {
  return (
    farmHelpers(run) *
    scaleMult(run) *
    marketMult(run) *
    speed(run) *
    waterFactor(run) *
    farmForkMult(run) *
    phaseBoost(run) *
    (1 + bankGain(run))
  );
}

/** The seed bank's yield bonus, read against the farm without the bank. */
export function bankGain(run: RunState): number {
  if (run.phase !== 1) return 0;
  const reference =
    (farmHelpers(run) *
      scaleMult(run) *
      marketMult(run) *
      speed(run) *
      waterFactor(run) +
      TUNING.farm.bank.referenceTaps *
        TUNING.phases[1].tap *
        scaleMult(run) *
        tapMult(run) *
        marketMult(run)) *
    farmForkMult(run);
  return bankGainFor(bankStock(run), reference);
}

/** What one tap earns right now (in spring, planting pays more). */
export function manualPerTap(run: RunState): number {
  if (run.phase === 1) return farmGrossTap(run) * (1 - savedShare(run));
  const season = run.phase === 0 ? seasonBoost(run, "plant") : 1;
  // On the farm a tap picks whatever is planted, at what the towns pay.
  const market = run.phase === 1 ? marketMult(run) : 1;
  const biomes = run.phase === 2 ? greenMult(run) : 1;
  return (
    TUNING.phases[run.phase].tap *
    scaleMult(run) *
    tapMult(run) *
    season *
    market *
    biomes *
    (run.phase === 2 ? phaseBoost(run) : 1) *
    // The bees pollinate what you plant too.
    pollenRipenMult(run)
  );
}

/** Harvest per second from the farm's helpers, before any bonus. */
const farmHelpers = (run: RunState): number => {
  const f = TUNING.farm;
  return (
    stacked(owned(run, "scarecrow")) * f.scarecrowRate +
    stacked(owned(run, "tractor")) * f.tractorRate +
    stacked(owned(run, "glasshouse")) * f.glasshouseRate +
    stacked(owned(run, "seed-drone")) * f.droneRate
  );
};

/** Green per second from the world's helpers, before any bonus. */
const worldHelpers = (run: RunState): number => {
  const w = TUNING.world;
  return (
    stacked(owned(run, "windbreak")) * w.windbreakRate +
    stacked(owned(run, "planting-rover")) * w.roverRate +
    stacked(owned(run, "sky-seeder")) * w.seederRate
  );
};

/**
 * The phase's manual resource per second from helpers alone. In the yard it
 * is how fast the garden ripens produce: sprinklers and bees, halved while
 * the tank is dry, better in summer.
 */
/** Compost tea and the greenhouse make the whole garden ripen faster. */
const ripenMult = (run: RunState): number =>
  (1 + TUNING.yard.teaPer) ** owned(run, "compost-tea") *
  (owned(run, "greenhouse") > 0 ? TUNING.yard.greenhouse : 1) *
  (owned(run, "orchard") > 0 ? orchardMult(run) : 1);

export function incomePerSecond(run: RunState): number {
  const y = TUNING.yard;
  if (run.phase === 0)
    return (
      (stacked(owned(run, "sprinkler")) *
        y.sprinklerRate *
        sprinklerForkMult(run) +
        stacked(owned(run, "bee-hive")) * y.hiveRate) *
      scaleMult(run) *
      ripenMult(run) *
      pollenRipenMult(run) *
      speed(run) *
      waterFactor(run) *
      seasonBoost(run, "grow")
    );
  if (run.phase === 1) return farmGrossIncome(run) * (1 - savedShare(run));
  if (run.phase === 2)
    return (
      worldHelpers(run) *
      scaleMult(run) *
      greenMult(run) *
      phaseBoost(run) *
      speed(run) *
      waterFactor(run)
    );
  if (run.phase === 3) {
    const b = TUNING.windowbox;
    return (
      (stacked(owned(run, "trellis")) * TUNING.phases[3].helper +
        stacked(owned(run, "wind-chime")) * b.chimeRate +
        stacked(owned(run, "dew-collector")) * b.dewRate) *
      seedHelperMult(run) *
      scaleMult(run) *
      speed(run)
    );
  }
  return (
    stacked(owned(run, HELPER_IDS[run.phase])) *
    TUNING.phases[run.phase].helper *
    scaleMult(run) *
    speed(run)
  );
}

/**
 * The share of ripening produce the baskets and gardeners pick on their own,
 * at the base rate. The rest waits in the garden for a hand to pick it, and
 * waits as long as it takes. Wheelbarrows let the pickers keep up with more;
 * past that limit each extra helper still adds a twentieth of its share.
 */
export function pickShare(run: RunState): number {
  const y = TUNING.yard;
  const crew =
    stacked(owned(run, "basket")) * y.basketShare +
    stacked(owned(run, "gardener")) * y.gardenerShare;
  const cap = y.pickCap + y.barrowPer * owned(run, "wheelbarrow");
  // Past the cap a helper still carries a little (a fraction of its share),
  // so no basket or gardener is ever a wasted buy. Wheelbarrows lift the cap.
  return crew <= cap ? crew : cap + (crew - cap) * y.overflowKeep;
}

/** Produce per second picked into seeds with nobody lifting a finger. */
export const pickPerSecond = (run: RunState): number =>
  pickShare(run) * incomePerSecond(run);

/** Earned care also grows the one pot, which is all the seed phase asks for. */
function earn(run: RunState, amount: number): void {
  if (run.phase === 3) {
    addCare(run, amount);
    return;
  }
  run.resources[MANUAL_RESOURCES[run.phase]] += amount;
}

/** What a second of tending is worth: the helpers plus one tap. */
export const tendingValue = (run: RunState): number =>
  incomePerSecond(run) + manualPerTap(run);

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
  else if (run.phase === 1) {
    tickWater(run, dt);
    tickMarket(run, dt);
    earn(run, incomePerSecond(run) * dt);
    tickBank(run, farmGrossIncome(run) * savedShare(run), dt);
  } else if (run.phase === 2) {
    tickWater(run, dt);
    tickBiomes(run, dt);
    earn(run, incomePerSecond(run) * dt);
  } else earn(run, incomePerSecond(run) * dt);
  tickKnowhow(run, dt);
  // After the phase ends, a pollination in flight still finishes paying out.
  tickBees(run, dt, () => incomePerSecond(run));
  tickFair(run, dt, () => incomePerSecond(run));
  tickMigration(run, dt, () => incomePerSecond(run));
  if (isWindowBoxOpen(run)) tickWindowBox(run, dt, () => tendingValue(run));
}

export function manualGrow(run: RunState): void {
  earn(run, manualPerTap(run));
  if (run.phase === 1) bankKept(run, farmGrossTap(run) * savedShare(run));
}

export const isGrowComplete = (run: RunState): boolean =>
  run.flags[visitorHereFlag(RETURN_VISITOR_ID)] === true;
