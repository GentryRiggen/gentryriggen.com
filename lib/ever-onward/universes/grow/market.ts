import { formatNumber } from "../../engine/format";
import { nextRandom } from "../../engine/rng";
import type { ActionDef, RunState } from "../../engine/types";
import { PHASE_FARM } from "./resources";
import { TUNING } from "./tuning";

/**
 * The farm's market: three towns ask for crops, and what they ask for drifts
 * on its own. Each crop pays what its towns want right now, so planting the
 * crop in demand earns noticeably more than planting the one nobody is
 * buying. Nothing is ever lost: a crop in low demand still sells, and a field
 * you leave alone keeps growing whatever it was last given.
 *
 * Demand is three slow waves a third of a year apart (so there is always one
 * crop worth planting and one worth skipping) plus a little wobble, all from a
 * random stream of its own (`run.rng` is never touched). State lives in
 * hidden `run.resources`, so a save without them reads as the first crop with
 * no demand wobble yet.
 */

const M = TUNING.market;

export const CROPS = ["tomato", "corn", "pumpkin"] as const;
export type Crop = (typeof CROPS)[number];

export const CROP_LABELS: Readonly<Record<Crop, string>> = {
  tomato: "Tomatoes",
  corn: "Corn",
  pumpkin: "Pumpkins",
};

export const MARKET_AGENT_ID = "market-agent";

/** Mixed into the run's seed so the towns' asks have a stream of their own. */
const SEED_MIX = 0x6d4b7;

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));

export const plantActionId = (crop: Crop): string => `market-plant-${crop}`;
export const PLANT_ACTION_IDS: readonly string[] = CROPS.map(plantActionId);

/** The crop in the ground right now (a fresh farm grows tomatoes). */
export const plantedCrop = (run: RunState): Crop =>
  CROPS[clamp(Math.round(res(run, "mkCrop")), 0, CROPS.length - 1)];

/**
 * What the towns ask for this crop: a multiple of the usual price, shown as
 * orders. A fresh market asks the usual price for everything.
 */
export function demandOf(run: RunState, crop: Crop): number {
  const i = CROPS.indexOf(crop);
  const wave = Math.sin(res(run, "mkAngle") + (i * 2 * Math.PI) / CROPS.length);
  return 1 + M.swing * wave + res(run, `mkWobble${i}`);
}

/** What a crop sells for now, relative to the usual price. */
export const cropPrice = (run: RunState, crop: Crop): number =>
  demandOf(run, crop);

/** The crop the towns are asking for the most. */
export function bestCrop(run: RunState): Crop {
  let best: Crop = CROPS[0];
  for (const crop of CROPS)
    if (cropPrice(run, crop) > cropPrice(run, best)) best = crop;
  return best;
}

/** The crop the towns want the least. */
export function leastWanted(run: RunState): Crop {
  let worst: Crop = CROPS[0];
  for (const crop of CROPS)
    if (cropPrice(run, crop) < cropPrice(run, worst)) worst = crop;
  return worst;
}

/** How much more the best crop pays than what is planted (1 = no better). */
export const demandGap = (run: RunState): number =>
  cropPrice(run, bestCrop(run)) / cropPrice(run, plantedCrop(run));

/** Seconds a newly planted crop still needs to sprout. */
export const sproutLeft = (run: RunState): number => res(run, "mkSprout");

/** A sprouting field pays less, rising to the full price as it comes up. */
export const sproutFactor = (run: RunState): number =>
  1 - (1 - M.sproutFloor) * clamp(sproutLeft(run) / M.sproutSeconds, 0, 1);

/** What the planted crop makes the farm worth right now (taps and helpers). */
export const marketMult = (run: RunState): number =>
  cropPrice(run, plantedCrop(run)) * sproutFactor(run);

/** Plants a crop (a different one starts to sprout). */
export function plantCrop(run: RunState, crop: Crop): void {
  const index = CROPS.indexOf(crop);
  if (index < 0 || index === Math.round(res(run, "mkCrop"))) return;
  run.resources.mkCrop = index;
  run.resources.mkSprout = M.sproutSeconds;
  run.resources.mkPlants = res(run, "mkPlants") + 1;
}

/** Times the field has been replanted (for the tally). */
export const plantingsSoFar = (run: RunState): number => res(run, "mkPlants");

/** Gives the market its own stream and a starting point (the farm begins). */
export function seedMarket(run: RunState): void {
  const stream = { rng: (run.rng ^ SEED_MIX) | 0 };
  run.resources.mkAngle = nextRandom(stream) * 2 * Math.PI;
  run.resources.mkRng = stream.rng;
  run.resources.mkSpeed = 1;
  run.resources.mkCrop = 0;
  run.resources.mkSprout = 0;
  run.resources.mkAgentTime = 0;
  for (let i = 0; i < CROPS.length; i += 1) run.resources[`mkWobble${i}`] = 0;
}

/** True once the market agent is hired. */
export const hasMarketAgent = (run: RunState): boolean =>
  owned(run, MARKET_AGENT_ID) > 0;

/**
 * Runs the towns' asks for `dt` seconds on the market's own stream, and the
 * market agent, who re-plants for demand now and then and never as quickly
 * or as shrewdly as a player who is looking.
 */
export function tickMarket(run: RunState, dt: number): void {
  if (run.phase !== 1) return;
  const r = run.resources;
  const stream = { rng: res(run, "mkRng") | 0 };
  const root = Math.sqrt(dt);
  for (let i = 0; i < CROPS.length; i += 1) {
    const w = res(run, `mkWobble${i}`);
    const step = (nextRandom(stream) - 0.5) * M.wobbleStep * root;
    r[`mkWobble${i}`] = clamp(
      w + step - w * M.wobblePull * dt,
      -M.wobbleMax,
      M.wobbleMax
    );
  }
  const speed = res(run, "mkSpeed") || 1;
  const drift = (nextRandom(stream) - 0.5) * M.speedStep * root;
  r.mkSpeed = clamp(speed + drift + (1 - speed) * M.speedPull * dt, 0.7, 1.3);
  r.mkRng = stream.rng;
  r.mkAngle =
    (res(run, "mkAngle") +
      ((2 * Math.PI) / M.periodSeconds) * res(run, "mkSpeed") * dt) %
    (2 * Math.PI);
  r.mkSprout = Math.max(0, sproutLeft(run) - dt);
  if (!hasMarketAgent(run)) return;
  r.mkAgentTime = res(run, "mkAgentTime") + dt;
  if (res(run, "mkAgentTime") < M.agentSeconds) return;
  r.mkAgentTime = 0;
  const best = bestCrop(run);
  if (best !== plantedCrop(run) && demandGap(run) >= M.agentMargin)
    plantCrop(run, best);
}

const PLANT: readonly ActionDef[] = CROPS.map((crop) => ({
  id: plantActionId(crop),
  phases: [PHASE_FARM],
  describe: (run) => {
    const price = cropPrice(run, crop);
    const here = plantedCrop(run) === crop;
    const wanted = bestCrop(run) === crop;
    return {
      label: here
        ? `${CROP_LABELS[crop]} are growing`
        : `Plant ${CROP_LABELS[crop].toLowerCase()}`,
      detail: `The towns pay ${formatNumber(Math.round(price * 100))}% for ${CROP_LABELS[crop].toLowerCase()} right now.`,
      isBlocked: here,
      hint: wanted
        ? { text: "most wanted", tone: "good" as const }
        : price === cropPrice(run, leastWanted(run))
          ? { text: "not wanted", tone: "neutral" as const }
          : undefined,
    };
  },
  perform: (run) => plantCrop(run, crop),
}));

export const MARKET_ACTIONS: readonly ActionDef[] = PLANT;
