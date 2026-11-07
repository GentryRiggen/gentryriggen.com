import { formatNumber } from "../../engine/format";
import { nextRandom } from "../../engine/rng";
import type { ActionDef, RunState } from "../../engine/types";
import { soilWearMult } from "./knowhow";
import { PHASE_FARM } from "./resources";
import { addSurge, flowSurge } from "./surge";
import { TUNING } from "./tuning";

/**
 * The farm's harvest day and what to plant for it.
 *
 * Every `daySeconds` the towns send a cart. What the crop in the ground pays
 * depends on what the towns want ON THAT DAY, and a crop needs time in the
 * ground to grow. So you plant now for what the towns will want later: plant
 * early and the crop is full grown but the forecast is a rough guess; plant
 * late and the forecast is sure but the crop is still small. A wrong guess
 * still sells, just for less, and a field left empty simply sends the cart
 * home.
 *
 * The soil keeps count: growing the same crop two harvests in a row wears
 * it out (every yield is lower), and a harvest of beans, which pay a steady
 * little, rests it and makes it rich.
 *
 * The towns' luck comes from a random stream of its own (`run.rng` is never
 * touched). State lives in hidden `run.resources`; a save without it is set
 * up from scratch on the first tick (an empty field, fair soil).
 */

const M = TUNING.market;
const S = TUNING.soil;

/** The crops the towns forecast a price for. */
export const CROPS = ["tomato", "corn", "pumpkin"] as const;
export type Crop = (typeof CROPS)[number];

/** Everything that can be in the ground (beans are not forecast). */
export const FIELD_CROPS = [...CROPS, "beans"] as const;
export type FieldCrop = (typeof FIELD_CROPS)[number];

export const CROP_LABELS: Readonly<Record<FieldCrop, string>> = {
  tomato: "Tomatoes",
  corn: "Corn",
  pumpkin: "Pumpkins",
  beans: "Beans",
};

export const MARKET_AGENT_ID = "market-agent";

/** Mixed into the run's seed so the towns' luck has a stream of its own. */
const SEED_MIX = 0x6d4b7;

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));

export const plantActionId = (crop: FieldCrop): string =>
  `market-plant-${crop}`;
export const PLANT_ACTION_IDS: readonly string[] =
  FIELD_CROPS.map(plantActionId);

// ------------------------------------------------------------------ the day

const isReady = (run: RunState): boolean => res(run, "mkReady") === 1;

/** Seconds into the current harvest day. */
export const daySeconds = (run: RunState): number => res(run, "mkDay");

/** Seconds until the cart comes. */
export const secondsToHarvest = (run: RunState): number =>
  Math.max(0, M.daySeconds - daySeconds(run));

/** Harvest days held so far. */
export const harvestDays = (run: RunState): number => res(run, "mkDays");

/** 0 (a rough guess), 1 (a better one) or 2 (sure): how firm the forecast is. */
export function forecastStage(run: RunState): 0 | 1 | 2 {
  const share = daySeconds(run) / M.daySeconds;
  return share < 1 / 3 ? 0 : share < 2 / 3 ? 1 : 2;
}

/** How far a stage's forecast can be out, either way. */
export const bandOf = (stage: number): number =>
  stage === 0 ? M.luck : stage === 1 ? M.luck / 2 : 0;

/** How much each town will want a crop on harvest day (the real thing). */
export function demandOn(run: RunState, crop: FieldCrop): number {
  if (crop === "beans") return M.beanDemand;
  const i = CROPS.indexOf(crop);
  return res(run, `mkBase${i}`) + res(run, `mkLuck${i}`);
}

export interface Forecast {
  /** The middle of the guess, as a multiple of the usual price. */
  middle: number;
  /** How far out it can be, either way (0 when sure). */
  band: number;
}

/** What the forecast says about a crop right now. */
export function forecastOf(run: RunState, crop: FieldCrop): Forecast {
  if (crop === "beans") return { middle: M.beanDemand, band: 0 };
  const i = CROPS.indexOf(crop);
  const stage = forecastStage(run);
  const base = res(run, `mkBase${i}`);
  const luck = res(run, `mkLuck${i}`);
  const middle =
    stage === 0 ? base : stage === 1 ? base + luck / 2 : base + luck;
  return { middle, band: bandOf(stage) };
}

/** The crop the forecast likes best right now (beans never). */
export function likeliestCrop(run: RunState): Crop {
  let best: Crop = CROPS[0];
  for (const crop of CROPS)
    if (forecastOf(run, crop).middle > forecastOf(run, best).middle)
      best = crop;
  return best;
}

/** The crop the towns will really want most on harvest day. */
export function bestCrop(run: RunState): Crop {
  let best: Crop = CROPS[0];
  for (const crop of CROPS)
    if (demandOn(run, crop) > demandOn(run, best)) best = crop;
  return best;
}

// ------------------------------------------------------------------ the field

/** True when something is in the ground. */
export const isFieldPlanted = (run: RunState): boolean =>
  res(run, "mkField") === 1;

/** The crop in the ground (a fresh farm reads tomatoes, with the field empty). */
export const plantedCrop = (run: RunState): FieldCrop =>
  FIELD_CROPS[clamp(Math.round(res(run, "mkCrop")), 0, FIELD_CROPS.length - 1)];

/** The crop harvested last time, or null before the first harvest. */
export function lastCrop(run: RunState): FieldCrop | null {
  const v = Math.round(res(run, "mkLast"));
  return v >= 1 && v <= FIELD_CROPS.length ? FIELD_CROPS[v - 1] : null;
}

/** How grown a crop would be on harvest day if it went in `inSeconds` from now. */
export const grownIfPlantedIn = (run: RunState, inSeconds = 0): number =>
  clamp((secondsToHarvest(run) - inSeconds) / M.growSeconds, 0, 1);

/** How grown what is in the ground is right now (0 when the field is empty). */
export const grownNow = (run: RunState): number =>
  isFieldPlanted(run)
    ? clamp((daySeconds(run) - res(run, "mkPlantAt")) / M.growSeconds, 0, 1)
    : 0;

/** How grown it will be on harvest day (if nothing is replanted). */
export const grownByHarvest = (run: RunState): number =>
  isFieldPlanted(run)
    ? clamp((M.daySeconds - res(run, "mkPlantAt")) / M.growSeconds, 0, 1)
    : 0;

/** What a crop grown this much pays, against one fully grown. */
export const growPay = (grown: number): number =>
  M.growFloor + (1 - M.growFloor) * clamp(grown, 0, 1);

// ------------------------------------------------------------------ the soil

/** The soil, 0 (worn out) to 1 (rich). */
export const soilOf = (run: RunState): number =>
  clamp(res(run, "mkSoil"), 0, 1);

/** How much the soil changes every yield (1 is fair soil). */
export const soilFactor = (run: RunState): number =>
  run.phase === 1 ? S.floor + S.reach * soilOf(run) : 1;

/** True when planting this crop again would wear the soil. */
export const wearsSoil = (run: RunState, crop: FieldCrop): boolean =>
  crop !== "beans" && lastCrop(run) === crop;

/**
 * What the fields pay between harvest days: a bare field pays little, and a
 * crop pays more as it grows, so planting early pays all day, not only when
 * the cart comes. The soil multiplies all of it.
 */
export const marketMult = (run: RunState): number =>
  M.fieldBase * (M.bareShare + M.growShare * grownNow(run)) * soilFactor(run);

// ------------------------------------------------------------------ planting

/** Plants a crop (a different one starts again from a seed). */
export function plantCrop(run: RunState, crop: FieldCrop): void {
  const index = FIELD_CROPS.indexOf(crop);
  if (index < 0) return;
  if (isFieldPlanted(run) && index === Math.round(res(run, "mkCrop"))) return;
  run.resources.mkCrop = index;
  run.resources.mkField = 1;
  run.resources.mkPlantAt = daySeconds(run);
  run.resources.mkPlants = res(run, "mkPlants") + 1;
}

/** The farm's pay a second as it stood when this harvest day began (0 before the first). */
export const dayStartPay = (run: RunState): number => res(run, "mkPay");

/** Times a crop has been planted (for the tally). */
export const plantingsSoFar = (run: RunState): number => res(run, "mkPlants");

// ------------------------------------------------------------------ the days

/** Draws the next harvest day's wave and luck, from the market's stream. */
function startDay(run: RunState): void {
  const r = run.resources;
  const stream = { rng: res(run, "mkRng") | 0 };
  const jitter = (nextRandom(stream) - 0.5) * 2 * M.angleJitter;
  r.mkAngle =
    (res(run, "mkAngle") +
      (2 * Math.PI * M.daySeconds) / M.periodSeconds +
      jitter) %
    (2 * Math.PI);
  for (let i = 0; i < CROPS.length; i += 1) {
    r[`mkBase${i}`] =
      Math.round(
        (1 +
          M.swing *
            Math.sin(res(run, "mkAngle") + (i * 2 * Math.PI) / CROPS.length)) *
          1000
      ) / 1000;
    // Luck never sinks a crop below `demandFloor` of the usual price.
    const luck = (nextRandom(stream) - 0.5) * 2 * M.luck;
    r[`mkLuck${i}`] =
      Math.round(
        Math.max(luck, M.demandFloor - res(run, `mkBase${i}`)) * 1000
      ) / 1000;
  }
  r.mkRng = stream.rng;
  r.mkDay = 0;
}

/** Gives the market its own stream and a first day (the farm begins). */
export function seedMarket(run: RunState): void {
  const r = run.resources;
  const stream = { rng: (run.rng ^ SEED_MIX) | 0 };
  r.mkAngle = nextRandom(stream) * 2 * Math.PI;
  r.mkRng = stream.rng;
  r.mkCrop = 0;
  r.mkField = 0;
  r.mkPlantAt = 0;
  r.mkLast = 0;
  r.mkSoil = S.start;
  r.mkDays = 0;
  r.mkAgentTime = 0;
  r.mkReady = 1;
  startDay(run);
}

/** True once the market agent is hired. */
export const hasMarketAgent = (run: RunState): boolean =>
  owned(run, MARKET_AGENT_ID) > 0;

/** What a harvest day was like: the scene and the log read this. */
export type DayMood = "none" | "cheer" | "droop" | "beans" | "empty";
const MOODS: readonly DayMood[] = ["none", "cheer", "droop", "beans", "empty"];

export interface DayResult {
  mood: DayMood;
  crop: FieldCrop;
  best: Crop;
  /** What the towns wanted of the crop, and of the best one (usual price: 1). */
  demand: number;
  bestDemand: number;
  grown: number;
  pays: number;
  /** The soil before and after (0 to 1). */
  soilBefore: number;
  soilAfter: number;
}

export const lastDay = (run: RunState): DayResult => ({
  mood: MOODS[clamp(Math.round(res(run, "mkResMood")), 0, MOODS.length - 1)],
  crop: FIELD_CROPS[
    clamp(Math.round(res(run, "mkResCrop")), 0, FIELD_CROPS.length - 1)
  ],
  best: CROPS[clamp(Math.round(res(run, "mkResBest")), 0, CROPS.length - 1)],
  demand: res(run, "mkResDemand"),
  bestDemand: res(run, "mkResBestDemand"),
  grown: res(run, "mkResGrown"),
  pays: res(run, "mkResPays"),
  soilBefore: res(run, "mkResSoilBefore"),
  soilAfter: res(run, "mkResSoilAfter"),
});

/** True for a few seconds after a harvest day (the scene shows the crowd). */
export const isDayShowing = (run: RunState): boolean =>
  res(run, "mkResAt") > 0 && run.time - res(run, "mkResAt") < M.showSeconds;

/** Pay for a harvest day: seconds of farm pay, times what the day wants. */
export function dayPays(
  farmPay: number,
  demand: number,
  grown: number
): number {
  return farmPay * M.daySharePay * demand * growPay(grown);
}

/** What planting this crop is worth on average, if it went in now (for bots). */
export const expectedPay = (run: RunState, crop: FieldCrop): number =>
  forecastOf(run, crop).middle * growPay(grownIfPlantedIn(run, 0));

/** Holds a harvest day: sells what is in the ground, tends the soil, starts the next. */
function holdDay(run: RunState, farmPay: number): void {
  const r = run.resources;
  const soilBefore = soilOf(run);
  const crop = plantedCrop(run);
  const planted = isFieldPlanted(run);
  const best = bestCrop(run);
  const bestDemand = demandOn(run, best);
  const demand = planted ? demandOn(run, crop) : 0;
  const grown = grownByHarvest(run);
  const pays = planted ? dayPays(farmPay, demand, grown) : 0;
  let mood: DayMood = "empty";
  if (planted) {
    if (crop === "beans") {
      mood = "beans";
      r.mkSoil = clamp(soilBefore + S.rest, 0, 1);
    } else {
      mood =
        demand >= bestDemand * TUNING.market.matchShare ? "cheer" : "droop";
      if (lastCrop(run) === crop)
        r.mkSoil = clamp(soilBefore - S.wear * soilWearMult(run), 0, 1);
    }
  }
  // An empty day rests the soil too: the same crop after a gap is not a repeat.
  r.mkLast = planted ? FIELD_CROPS.indexOf(crop) + 1 : 0;
  r.mkResAt = run.time;
  r.mkResMood = MOODS.indexOf(mood);
  r.mkResCrop = FIELD_CROPS.indexOf(crop);
  r.mkResBest = CROPS.indexOf(best);
  r.mkResDemand = demand;
  r.mkResBestDemand = bestDemand;
  r.mkResGrown = grown;
  r.mkResPays = pays;
  r.mkResSoilBefore = soilBefore;
  r.mkResSoilAfter = soilOf(run);
  r.mkDays = harvestDays(run) + 1;
  r.mkEarned = res(run, "mkEarned") + pays;
  r.mkField = 0;
  r.mkPlantAt = 0;
  addSurge(run, "mk", pays, M.surgeSeconds);
  startDay(run);
}

/**
 * Runs the harvest day clock for `dt` seconds. `farmPay` is a day of the
 * farm's pay (read lazily: only a harvest day needs it). A payout still
 * flowing keeps flowing after the farm ends. The market agent plants the
 * crop the forecast likes best, once, a while into every day, and is never
 * as sharp as a player who is watching the soil.
 */
export function tickMarket(
  run: RunState,
  dt: number,
  farmPay: () => number
): void {
  flowSurge(run, "mk", dt);
  if (run.phase !== 1) return;
  if (!isReady(run)) seedMarket(run);
  const r = run.resources;
  if (r.mkPaused === 1) return;
  r.mkDay = daySeconds(run) + dt;
  // The farm's pay is read once, at the start of each day: the pumpkin's
  // prices follow it, not the field (which is bare again after harvest day).
  if (res(run, "mkPayDay") !== harvestDays(run) + 1) {
    r.mkPay = farmPay() / M.daySeconds;
    r.mkPayDay = harvestDays(run) + 1;
  }
  if (
    hasMarketAgent(run) &&
    !isFieldPlanted(run) &&
    daySeconds(run) >= M.agentAt
  )
    plantCrop(run, likeliestCrop(run));
  if (daySeconds(run) >= M.daySeconds) holdDay(run, farmPay());
}

/**
 * For the simulator's income probes: nothing is pending and the day clock
 * stands still, so a harvest day is not read as income.
 */
export function withoutMarketDay(run: RunState): RunState {
  run.resources.mkPending = 0;
  run.resources.mkPaused = 1;
  return run;
}

const pct = (n: number): string => `${formatNumber(Math.round(n * 100))}%`;

/** What the forecast says, in plain words: "about 120%" or "100% to 150%". */
export function forecastText(f: Forecast): string {
  return f.band <= 0
    ? `${pct(f.middle)}, sure`
    : `${pct(Math.max(M.demandFloor, f.middle - f.band))} to ${pct(f.middle + f.band)}`;
}

/** The result line under the market: what the last harvest day was like. */
export function dayResultLine(run: RunState): string | null {
  if (harvestDays(run) <= 0) return null;
  const d = lastDay(run);
  const gain = `+${formatNumber(Math.floor(d.pays))} harvest`;
  const name = CROP_LABELS[d.crop].toLowerCase();
  if (d.mood === "empty")
    return "Harvest day came and the field was empty. The cart went home with nothing.";
  if (d.mood === "beans")
    return `Beans! They sold for a steady little (${gain}) and the soil is richer for it.`;
  const soil =
    d.soilAfter < d.soilBefore
      ? " Growing it twice in a row wore the soil."
      : "";
  if (d.mood === "cheer")
    return `The towns cheered for the ${name}: ${pct(d.demand)} of the usual price, ${gain}.${soil}`;
  return `The towns wanted ${CROP_LABELS[d.best].toLowerCase()} more than ${name} today. The ${name} sold for ${pct(d.demand)}, ${gain}.${soil}`;
}

/** The plant buttons; the market panel draws them itself. */
const PLANT: readonly ActionDef[] = FIELD_CROPS.map((crop) => ({
  id: plantActionId(crop),
  isInline: true,
  phases: [PHASE_FARM],
  describe: (run) => {
    const here = isFieldPlanted(run) && plantedCrop(run) === crop;
    const f = forecastOf(run, crop);
    const grown = here ? grownByHarvest(run) : grownIfPlantedIn(run, 0);
    return {
      label: here
        ? `${CROP_LABELS[crop]} are growing`
        : `Plant ${CROP_LABELS[crop].toLowerCase()}`,
      detail: `Harvest day pays ${f.band > 0 ? "about " : ""}${forecastText(f)}. Grown by then: ${pct(grown)}.${
        wearsSoil(run, crop) ? " Same as last time: wears the soil." : ""
      }`,
      isBlocked: here,
    };
  },
  perform: (run) => plantCrop(run, crop),
}));

export const MARKET_ACTIONS: readonly ActionDef[] = PLANT;
