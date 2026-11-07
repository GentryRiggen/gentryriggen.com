import type { ResourceDef } from "../../engine/types";
import { TUNING } from "./tuning";

export const PHASE_YARD = "yard";
export const PHASE_FARM = "farm";
export const PHASE_WORLD = "world";
export const PHASE_SEED = "seed";

export type GrowPhaseId =
  | typeof PHASE_YARD
  | typeof PHASE_FARM
  | typeof PHASE_WORLD
  | typeof PHASE_SEED;

/** Phase ids, in order (the index is the run's `phase`). */
export const PHASE_IDS: readonly GrowPhaseId[] = [
  PHASE_YARD,
  PHASE_FARM,
  PHASE_WORLD,
  PHASE_SEED,
];

/** What each phase's tap earns, by phase index. */
export const MANUAL_RESOURCES = ["seeds", "harvest", "green", "care"] as const;

/**
 * What a payout still in flight when phase `from` ends is worth in the next
 * phase's own currency (whole units, rounded down like the phases' onEnter
 * gifts).
 */
export function carryOver(from: number, amount: number): number {
  if (from === 0) return Math.floor(amount * TUNING.farm.seedsToHarvest);
  // A payout still flowing when the farm ends is a lottery in size, so it is
  // capped: the world opens the same way however the farm ended.
  return Math.min(
    TUNING.world.carryCap,
    Math.floor(amount * TUNING.world.harvestToGreen)
  );
}

/** How much of the one pot is grown, 0 to 100. */
export const FULL_GROWTH = 100;

const HIDDEN: readonly string[] = [];

export const RESOURCES: readonly ResourceDef[] = [
  {
    id: "seeds",
    label: "Seeds",
    phases: [PHASE_YARD],
    purpose: "Buys garden helpers and milestones.",
  },
  {
    id: "produce",
    label: "Ripe produce",
    phases: [PHASE_YARD],
    purpose: "Pick it to turn it into seeds.",
  },
  {
    id: "honey",
    label: "Honey",
    phases: [PHASE_YARD],
    purpose: "Sell it, or keep it for winter.",
  },
  {
    id: "harvest",
    label: "Harvest",
    phases: [PHASE_FARM],
    purpose: "Buys farm helpers and milestones.",
  },
  {
    id: "green",
    label: "Green",
    phases: [PHASE_WORLD],
    purpose: "Buys world helpers and milestones.",
  },
  {
    id: "care",
    label: "Care",
    phases: [PHASE_SEED],
    purpose: "Every bit earned grows the pot.",
  },
  {
    id: "growth",
    label: "Growth (%)",
    phases: [PHASE_SEED],
    format: (v) => `${((v / FULL_GROWTH) * 100).toFixed(1)}%`,
  },
  // The backyard's hidden water: tank level, rain outlook (0 dry, 1 rainy)
  // and the rain's own random stream.
  {
    id: "tank",
    label: "Water tank",
    initial: TUNING.water.baseCapacity,
    phases: HIDDEN,
  },
  {
    id: "rainOutlook",
    label: "Rain outlook",
    initial: TUNING.water.outlookStart,
    phases: HIDDEN,
  },
  { id: "wtRng", label: "Water stream", phases: HIDDEN },
  { id: "wtDry", label: "Tank ran dry", phases: HIDDEN },
  // Pollination (bees.ts): each bed's planting, bees and bloom, when it
  // last wilted, the bees gone in a hungry winter, the rare flowers and the
  // crosses' own random stream.
  ...[
    ...[0, 1, 2, 3].flatMap((i) => [
      `pbPlanted${i}`,
      `pbBees${i}`,
      `pbBloom${i}`,
      `pbWiltAt${i}`,
    ]),
    "pbWilts",
    "pbLastWilt",
    "pbGone",
    "pbLeft",
    "pbLeftAt",
    "pbRare",
    "pbCrossAt",
    "pbCrossPair",
    "pbCrossPays",
    "pbPlants",
    "pbMoves",
    "pbSales",
    "pbLastSale",
    "pbHoneyMade",
    "pbPaused",
    "pbRng",
  ].map((id): ResourceDef => ({ id, label: id, phases: HIDDEN })),
  // The harvest day: clock and day count, what is in the field (crop index,
  // planted or not, when), the soil (0 to 1), the last crop harvested, each
  // crop's wave and luck for the coming day, the last day's result, a payout
  // flowing in, and the towns' own random stream.
  ...[
    "mkReady",
    "mkCrop",
    "mkField",
    "mkPlantAt",
    "mkDay",
    "mkDays",
    "mkAngle",
    "mkBase0",
    "mkBase1",
    "mkBase2",
    "mkLuck0",
    "mkLuck1",
    "mkLuck2",
    "mkSoil",
    "mkLast",
    "mkAgentTime",
    "mkPlants",
    "mkRng",
    "mkResAt",
    "mkResMood",
    "mkResCrop",
    "mkResBest",
    "mkResDemand",
    "mkResBestDemand",
    "mkResGrown",
    "mkResPays",
    "mkResSoilBefore",
    "mkResSoilAfter",
    "mkEarned",
    "mkPending",
    "mkSurgeRate",
    "mkPaused",
    "mkPay",
    "mkPayDay",
  ].map((id): ResourceDef => ({ id, label: id, phases: HIDDEN })),
  // The prize pumpkin: size step, stage (2 judging), the judging clock, the
  // size entered, entries, splits and feedings, the last outcome (what, how
  // big, when, what it paid, who entered), a payout flowing in and its own
  // random stream.
  ...[
    "pkStep",
    "pkStage",
    "pkJudge",
    "pkEnterStep",
    "pkUsed",
    "pkEntries",
    "pkSplits",
    "pkFed",
    "pkOutcome",
    "pkOutStep",
    "pkOutAt",
    "pkLastPays",
    "pkBy",
    "pkIncome",
    "pkEarned",
    "pkPending",
    "pkSurgeRate",
    "pkRng",
    "pkPaused",
  ].map((id): ResourceDef => ({ id, label: id, phases: HIDDEN })),
  // Know-how for the farm and the world, and the seconds of festival left
  // and festivals held.
  {
    id: "knowhow",
    label: "Know-how",
    phases: [PHASE_FARM, PHASE_WORLD],
    purpose: "Buys projects and festivals.",
  },
  ...["fsLeft", "fsCount"].map((id): ResourceDef => ({
    id,
    label: id,
    phases: HIDDEN,
  })),
  // Forks: 0 not chosen, 1 the first side, 2 the second (one per phase).
  ...["fkYard", "fkFarm", "fkWorld", "fkSeed"].map((id): ResourceDef => ({
    id,
    label: id,
    phases: HIDDEN,
  })),
  // The green world's mix: each biome's slider (0 to 10 points), how much of
  // the planet each covers (0 to 1), how far the green has reached, each
  // biome's rot (0 to 1), blights and heals so far (when, and which biome),
  // and times a slider was moved.
  ...[0, 1, 2, 3].map((i): ResourceDef => ({
    id: `bmWant${i}`,
    label: `bmWant${i}`,
    initial: TUNING.world.startMix[i],
    phases: HIDDEN,
  })),
  ...[
    ...[0, 1, 2, 3].map((i) => `bmBlight${i}`),
    "bmForest",
    "bmJungle",
    "bmMeadow",
    "bmWetland",
    "bmCover",
    "bmBlights",
    "bmBlightAt",
    "bmBlightWho",
    "bmHealed",
    "bmHealedAt",
    "bmHealedWho",
    "bmSwitches",
  ].map((id): ResourceDef => ({ id, label: id, phases: HIDDEN })),
  // The old window box: where the blind is aimed (0 to 4) and where it is
  // now (0 to 1), the soil's moisture, the sky (an index), its clock and how
  // many times it has changed, how
  // long the pot has grown well, the leaf's mood last seen (0 perky, 1 curl,
  // 2 dry, 3 droop, 4 soggy), the last thrive and last wilt (run time, and
  // which), how many times each has happened, dial moves, the pot's stage
  // (0 soil to 3 bloom, the bloom sound reads it), and its own random stream.
  ...[
    "wbAim",
    "wbLight",
    "wbMoist",
    "wbSky",
    "wbSkyTime",
    "wbSkyLen",
    "wbSkies",
    "wbGood",
    "wbLeaf",
    "wbLeafAt",
    "wbThriveAt",
    "wbThrives",
    "wbWiltAt",
    "wbWiltKind",
    "wbWilts",
    "wbMoves",
    "wbRng",
    "wbReady",
    "potStage",
  ].map((id): ResourceDef => ({ id, label: id, phases: HIDDEN })),
  // Kept for the scene's flourish; never shown as a number.
  { id: "bloom", label: "Bloom", phases: HIDDEN },
];
