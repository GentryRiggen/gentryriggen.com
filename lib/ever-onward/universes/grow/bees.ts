import { formatNumber } from "../../engine/format";
import { nextRandom } from "../../engine/rng";
import type { RunState } from "../../engine/types";
import { seasonOf, type Season } from "./seasons";
import { TUNING } from "./tuning";

/**
 * Pollination: the backyard's bees, and the choices that come with them.
 *
 * Every hive brings a few bees. You plant flower beds (clover, sunflowers,
 * lavender, an apple tree) with seeds, then send bees to them. Each bed gives
 * something different, and each one tires as the bees work it:
 *  - clover makes honey quickly, but wears out fast;
 *  - sunflowers make the whole garden ripen faster;
 *  - lavender calms the bees, so every other bed tires more slowly;
 *  - the apple tree gives very little, until autumn, when it pays a lot.
 * A bed worked too hard WILTS: the bees fly home and the bed has to be
 * planted again. Two healthy beds side by side, both being worked, sometimes
 * cross into a rare flower that makes the garden ripen faster for good.
 *
 * Honey can be sold for seeds (it fetches the most in winter, when nobody else
 * has any), but in winter the hive eats it. A hive that runs out of honey in
 * winter loses bees; they come back slowly in spring.
 *
 * Random numbers (the crosses) come from a stream of their own (`run.rng` is
 * never touched). All state is hidden `run.resources` plus one flag, so a save
 * without them reads as "not opened yet".
 */

const P = TUNING.pollen;

export const BEES_OPEN_FLAG = "bees-open";
/** The purchase that opens pollination: the first hive in the garden. */
export const BEES_OPEN_UPGRADE = "bee-hive";
export const BEE_KEEPER_ID = "bee-keeper";

export type BedKind = "clover" | "sunflower" | "lavender" | "apple";

export interface BedDef {
  kind: BedKind;
  name: string;
  /** What it gives, in a few plain words (the panel's first line). */
  gives: string;
  /** Seconds of the garden's ripening that planting it costs. */
  plantSeconds: number;
  /** The smallest it ever costs, in seeds. */
  plantFloor: number;
  /** Bloom regrown per second (towards full), before the season. */
  regrow: number;
  /** Bloom worn away per working bee per second. */
  wear: number;
}

/** Left to right in the scene; neighbours can cross. */
export const BEDS: readonly BedDef[] = [
  {
    kind: "clover",
    name: "Clover",
    gives: "Honey, fast",
    plantSeconds: 15,
    plantFloor: 400,
    regrow: 0.05,
    wear: 0.011,
  },
  {
    kind: "sunflower",
    name: "Sunflowers",
    gives: "The garden ripens faster",
    plantSeconds: 30,
    plantFloor: 900,
    regrow: 0.04,
    wear: 0.007,
  },
  {
    kind: "lavender",
    name: "Lavender",
    gives: "Calm bees: other beds tire slower",
    plantSeconds: 25,
    plantFloor: 700,
    regrow: 0.04,
    wear: 0.005,
  },
  {
    kind: "apple",
    name: "Apple tree",
    gives: "A big crop of honey in autumn",
    plantSeconds: 45,
    plantFloor: 1500,
    regrow: 0.03,
    wear: 0.008,
  },
];

export const BED_COUNT = BEDS.length;

/** The rare flowers two neighbouring beds can cross into. */
export const RARE_FLOWERS: readonly string[] = [
  "Sun-clover",
  "Twilight bell",
  "Blossom lantern",
];

export const plantActionId = (bed: number): string => `pb-plant-${bed}`;
export const addBeeActionId = (bed: number): string => `pb-add-${bed}`;
export const takeBeeActionId = (bed: number): string => `pb-take-${bed}`;
export const SELL_HALF_ID = "pb-sell-half";
export const SELL_ALL_ID = "pb-sell-all";

export const BEE_ACTION_IDS: readonly string[] = [
  ...BEDS.flatMap((_, i) => [
    plantActionId(i),
    addBeeActionId(i),
    takeBeeActionId(i),
  ]),
  SELL_HALF_ID,
  SELL_ALL_ID,
];

/** Mixed into the run's seed so the crosses have a stream of their own. */
const SEED_MIX = 0xbee5;

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

export const isBeesOpen = (run: RunState): boolean =>
  run.phase === 0 && run.flags[BEES_OPEN_FLAG] === true;

export const hasBeeKeeper = (run: RunState): boolean =>
  owned(run, BEE_KEEPER_ID) > 0;

// ---------------------------------------------------------------- the bees

/** Bees the hives hold when nobody has gone. */
export const beesKept = (run: RunState): number =>
  owned(run, BEES_OPEN_UPGRADE) * P.beesPerHive;

/** Bees that flew off in a hungry winter and haven't come back yet. */
export const beesGone = (run: RunState): number =>
  Math.min(beesKept(run), Math.floor(res(run, "pbGone")));

/** Bees in the garden right now. */
export const beeCount = (run: RunState): number =>
  Math.max(0, beesKept(run) - beesGone(run));

export const isPlanted = (run: RunState, bed: number): boolean =>
  res(run, `pbPlanted${bed}`) === 1;

/** Bees sent to a bed. */
export const beesOn = (run: RunState, bed: number): number =>
  Math.max(0, Math.floor(res(run, `pbBees${bed}`)));

export const beesWorking = (run: RunState): number =>
  BEDS.reduce((sum, _, i) => sum + beesOn(run, i), 0);

/** Bees resting at the hive. */
export const beesHome = (run: RunState): number =>
  Math.max(0, beeCount(run) - beesWorking(run));

/** How healthy a bed's flowers are, 0 (wilting) to 1 (full bloom). */
export const bloomOf = (run: RunState, bed: number): number =>
  isPlanted(run, bed) ? clamp01(res(run, `pbBloom${bed}`)) : 0;

/** True for a few seconds after a bed wilted (the scene shows it). */
export const justWilted = (run: RunState, bed: number): boolean =>
  run.time - res(run, `pbWiltAt${bed}`) < P.wiltShowSeconds &&
  res(run, `pbWiltAt${bed}`) > 0;

export const wiltsSoFar = (run: RunState): number => res(run, "pbWilts");

/** In winter the flowers sleep and every bee stays home. */
export const isDormant = (run: RunState): boolean => seasonOf(run) === "winter";

// ---------------------------------------------------------------- the beds

/** What planting a bed costs now, in seeds. */
export const plantCost = (run: RunState, bed: number, income: number): number =>
  Math.ceil(
    Math.max(BEDS[bed].plantFloor, BEDS[bed].plantSeconds * Math.max(0, income))
  );

/** Lavender calms the bees: every other bed wears this much as fast. */
export const calmFactor = (run: RunState): number => {
  const lavender = BEDS.findIndex((b) => b.kind === "lavender");
  const calm =
    P.lavenderCalm ** (beesOn(run, lavender) * yieldOf(run, lavender));
  return calm * (hasBeeKeeper(run) ? P.keeperWear : 1);
};

/** How well a bed's bees work, by its bloom: a tired bed gives less. */
export const yieldOf = (run: RunState, bed: number): number =>
  isPlanted(run, bed)
    ? P.yieldFloor + (1 - P.yieldFloor) * bloomOf(run, bed)
    : 0;

/** Bloom lost per second on a bed right now (negative: it is regrowing). */
export function wearRate(run: RunState, bed: number): number {
  if (!isPlanted(run, bed) || isDormant(run)) return 0;
  const def = BEDS[bed];
  const season = seasonOf(run);
  const regrow =
    def.regrow *
    (season === "spring" ? P.springRegrow : 1) *
    (1 - bloomOf(run, bed));
  const calm = def.kind === "lavender" ? 1 : calmFactor(run);
  return beesOn(run, bed) * def.wear * calm - regrow;
}

/** Seconds until a bed wilts at this pace, or null when it is holding up. */
export function secondsToWilt(run: RunState, bed: number): number | null {
  const rate = wearRate(run, bed);
  if (rate <= 0.0005) return null;
  return bloomOf(run, bed) / rate;
}

const APPLE = BEDS.findIndex((b) => b.kind === "apple");
const CLOVER = BEDS.findIndex((b) => b.kind === "clover");
const SUNFLOWER = BEDS.findIndex((b) => b.kind === "sunflower");

/** Honey made per second right now. */
export function honeyPerSecond(run: RunState): number {
  if (!isBeesOpen(run) || isDormant(run)) return 0;
  const season = seasonOf(run);
  const summer = season === "summer" ? P.summerYield : 1;
  const clover = beesOn(run, CLOVER) * yieldOf(run, CLOVER) * P.cloverHoney;
  const apple =
    beesOn(run, APPLE) *
    yieldOf(run, APPLE) *
    (season === "autumn" ? P.appleAutumnHoney : P.appleHoney);
  return (clover + apple) * summer;
}

/** Honey the hive eats each second in winter. */
export const winterEats = (run: RunState): number =>
  beeCount(run) * P.winterEat;

/** Honey a whole winter takes. */
export const winterNeeds = (run: RunState): number =>
  winterEats(run) * TUNING.seasons.seconds;

export const honeyOf = (run: RunState): number => res(run, "honey");

/** Rare flowers grown so far this run. */
export const rareCount = (run: RunState): number =>
  Math.min(P.rareMax, res(run, "pbRare"));

/**
 * How much faster the garden ripens thanks to the bees: sunflowers (and the
 * apple tree in autumn) while they are worked, and every rare flower for good.
 */
export function pollenRipenMult(run: RunState): number {
  if (run.phase !== 0 || run.flags[BEES_OPEN_FLAG] !== true) return 1;
  const rare = 1 + rareCount(run) * P.rareRipen;
  if (isDormant(run)) return rare;
  const summer = seasonOf(run) === "summer" ? P.summerYield : 1;
  const sun =
    beesOn(run, SUNFLOWER) *
    yieldOf(run, SUNFLOWER) *
    P.sunflowerRipen *
    summer;
  const apple =
    seasonOf(run) === "autumn"
      ? beesOn(run, APPLE) * yieldOf(run, APPLE) * P.appleAutumnRipen
      : 0;
  return rare * (1 + sun + apple);
}

/** What one honey sells for, in seconds of the garden's ripening. */
export const honeySeasonPrice = (season: Season): number =>
  P.honeyPrice[season];

export const honeyPrice = (run: RunState, income: number): number =>
  honeySeasonPrice(seasonOf(run)) * P.honeySeconds * Math.max(0, income);

// --------------------------------------------------------------- actions

export function plantBed(run: RunState, bed: number): void {
  if (!isBeesOpen(run) || isPlanted(run, bed)) return;
  const r = run.resources;
  r[`pbPlanted${bed}`] = 1;
  r[`pbBloom${bed}`] = P.plantBloom;
  r[`pbBees${bed}`] = 0;
  r.pbPlants = res(run, "pbPlants") + 1;
}

export const canAddBee = (run: RunState, bed: number): boolean =>
  isBeesOpen(run) && isPlanted(run, bed) && beesHome(run) > 0;

export function addBee(run: RunState, bed: number): void {
  if (!canAddBee(run, bed)) return;
  run.resources[`pbBees${bed}`] = beesOn(run, bed) + 1;
  run.resources.pbMoves = res(run, "pbMoves") + 1;
}

export function takeBee(run: RunState, bed: number): void {
  if (!isBeesOpen(run) || beesOn(run, bed) <= 0) return;
  run.resources[`pbBees${bed}`] = beesOn(run, bed) - 1;
  run.resources.pbMoves = res(run, "pbMoves") + 1;
}

/** Sells a share of the honey for seeds at today's price. */
export function sellHoney(run: RunState, share: number, income: number): void {
  if (!isBeesOpen(run)) return;
  const sold = honeyOf(run) * share;
  if (sold <= 0) return;
  const r = run.resources;
  const pays = sold * honeyPrice(run, income);
  r.honey = honeyOf(run) - sold;
  r.seeds = res(run, "seeds") + pays;
  r.pbSales = res(run, "pbSales") + 1;
  r.pbLastSale = pays;
}

// ------------------------------------------------------------------ tick

export function openBees(run: RunState): void {
  if (run.flags[BEES_OPEN_FLAG] === true) return;
  run.flags[BEES_OPEN_FLAG] = true;
  run.resources.pbRng = (run.rng ^ SEED_MIX) | 0;
}

function wilt(run: RunState, bed: number): void {
  const r = run.resources;
  r[`pbPlanted${bed}`] = 0;
  r[`pbBloom${bed}`] = 0;
  r[`pbBees${bed}`] = 0;
  r[`pbWiltAt${bed}`] = run.time;
  r.pbWilts = wiltsSoFar(run) + 1;
  r.pbLastWilt = bed;
}

/** Healthy, worked neighbours sometimes cross into a rare flower. */
function tryCross(run: RunState, dt: number, income: number): void {
  if (rareCount(run) >= P.rareMax) return;
  const r = run.resources;
  for (let i = 0; i < BED_COUNT - 1; i += 1) {
    const a = bloomOf(run, i);
    const b = bloomOf(run, i + 1);
    if (beesOn(run, i) < 1 || beesOn(run, i + 1) < 1) continue;
    if (a < P.crossBloom || b < P.crossBloom) continue;
    const stream = { rng: res(run, "pbRng") | 0 };
    const roll = nextRandom(stream);
    r.pbRng = stream.rng;
    if (roll >= P.crossRate * a * b * dt) continue;
    r.pbRare = rareCount(run) + 1;
    r.pbCrossAt = run.time;
    r.pbCrossPair = i;
    r.pbCrossPays = P.crossBurstSeconds * Math.max(0, income);
    r.seeds = res(run, "seeds") + res(run, "pbCrossPays");
    return;
  }
}

/** True for a few seconds after a rare flower crossed (the scene bursts). */
export const justCrossed = (run: RunState): boolean =>
  res(run, "pbCrossAt") > 0 &&
  run.time - res(run, "pbCrossAt") < P.crossShowSeconds;

/** True while hungry bees are leaving (winter, honey gone). */
export const isLeaving = (run: RunState): boolean =>
  isDormant(run) && honeyOf(run) <= 0 && beeCount(run) > 0 && isBeesOpen(run);

/**
 * Runs pollination for `dt` seconds. `income` is the garden's ripening per
 * second (read lazily: only a cross needs it).
 */
export function tickBees(
  run: RunState,
  dt: number,
  income: () => number
): void {
  if (run.phase !== 0) return;
  if (run.flags[BEES_OPEN_FLAG] !== true) {
    if (owned(run, BEES_OPEN_UPGRADE) > 0) openBees(run);
    return;
  }
  if (res(run, "pbPaused") === 1) return;
  const r = run.resources;
  if (isDormant(run)) {
    // Winter: the hive eats honey; with none left, bees leave.
    const eats = winterEats(run) * dt;
    if (honeyOf(run) >= eats) r.honey = honeyOf(run) - eats;
    else {
      r.honey = 0;
      if (beeCount(run) > 0) {
        const before = Math.floor(res(run, "pbLeft"));
        r.pbGone = res(run, "pbGone") + dt / P.leaveSeconds;
        r.pbLeft = res(run, "pbLeft") + dt / P.leaveSeconds;
        if (Math.floor(r.pbLeft) > before) r.pbLeftAt = run.time;
        // A bee that leaves comes off the busiest bed first (they're home
        // in winter, but the plan should still add up).
        while (beesWorking(run) > beeCount(run)) {
          let busiest = 0;
          for (let i = 1; i < BED_COUNT; i += 1)
            if (beesOn(run, i) > beesOn(run, busiest)) busiest = i;
          r[`pbBees${busiest}`] = beesOn(run, busiest) - 1;
        }
      }
    }
    return;
  }
  // Bees that left in winter drift back in the warm seasons.
  if (res(run, "pbGone") > 0)
    r.pbGone = Math.max(0, res(run, "pbGone") - dt / P.returnSeconds);
  r.honey = honeyOf(run) + honeyPerSecond(run) * dt;
  r.pbHoneyMade = res(run, "pbHoneyMade") + honeyPerSecond(run) * dt;
  for (let i = 0; i < BED_COUNT; i += 1) {
    if (!isPlanted(run, i)) continue;
    const next = bloomOf(run, i) - wearRate(run, i) * dt;
    if (next <= 0) wilt(run, i);
    else r[`pbBloom${i}`] = Math.min(1, next);
  }
  tryCross(run, dt, income());
}

/** For the simulator's income probes: no crosses in a probe. */
export function withoutBees(run: RunState): RunState {
  run.resources.pbPaused = 1;
  return run;
}

/** What a bed's bees are doing for you right now, in plain words. */
export function bedEffect(run: RunState, bed: number): string {
  if (!isPlanted(run, bed)) return BEDS[bed].gives;
  if (isDormant(run)) return "Asleep for the winter";
  const n = beesOn(run, bed);
  if (n === 0) return "No bees here yet";
  const season = seasonOf(run);
  const summer = season === "summer" ? P.summerYield : 1;
  const work = n * yieldOf(run, bed);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  switch (BEDS[bed].kind) {
    case "clover":
      return `+${(work * P.cloverHoney * summer).toFixed(2)} honey/sec`;
    case "sunflower":
      return `Garden ripens +${pct(work * P.sunflowerRipen * summer)} faster`;
    case "lavender":
      return `Other beds tire ${pct(1 - P.lavenderCalm ** work)} slower`;
    case "apple":
      return season === "autumn"
        ? `Autumn crop! +${(work * P.appleAutumnHoney).toFixed(2)} honey/sec, ripening +${pct(work * P.appleAutumnRipen)}`
        : `Only +${(work * P.appleHoney * summer).toFixed(2)} honey/sec until autumn`;
  }
}

/**
 * True when the bees want a look: a bed close to wilting, bees idle at the
 * hive with a bed to go to, or winter coming with too little honey.
 */
export function needsBees(run: RunState): boolean {
  if (!isBeesOpen(run)) return false;
  for (let i = 0; i < BED_COUNT; i += 1) {
    const left = secondsToWilt(run, i);
    if (left !== null && left < P.warnSeconds) return true;
  }
  if (isDormant(run)) return false;
  if (beesHome(run) > 0 && BEDS.some((_, i) => isPlanted(run, i))) return true;
  return seasonOf(run) === "autumn" && honeyOf(run) < winterNeeds(run);
}

// --------------------------------------------------------------- the log

/** Count of things that go in the log (wilts, crosses, hungry winters). */
export const beeEvents = (run: RunState): number =>
  wiltsSoFar(run) + res(run, "pbRare") + Math.floor(res(run, "pbLeft"));

export function beeResultLine(run: RunState): string | null {
  const crossAt = res(run, "pbCrossAt");
  const wiltAt = Math.max(...BEDS.map((_, i) => res(run, `pbWiltAt${i}`)));
  const leftAt = res(run, "pbLeftAt");
  const latest = Math.max(crossAt, wiltAt, leftAt);
  if (latest <= 0) return null;
  if (latest === crossAt) {
    const name = RARE_FLOWERS[res(run, "pbCrossPair")] ?? "A rare flower";
    return `${name}! Two healthy beds crossed into a rare flower: the garden ripens faster for good, and +${formatNumber(Math.floor(res(run, "pbCrossPays")))} seeds.`;
  }
  if (latest === wiltAt) {
    const bed = BEDS[res(run, "pbLastWilt")]?.name ?? "A bed";
    return `${bed} wilted! The bees worked it too hard. Plant it again to use it.`;
  }
  return "The honey ran out and hungry bees flew away. They'll drift back in spring.";
}
