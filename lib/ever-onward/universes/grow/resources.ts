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
  if (from >= 2)
    // The last seed starts small and calm: a flock still in the air at the
    // world's end is a few taps' worth of care, however big the world's income.
    return Math.min(
      TUNING.migration.carryCap,
      Math.floor(amount * TUNING.migration.greenToCare)
    );
  const rate =
    from === 0 ? TUNING.farm.seedsToHarvest : TUNING.world.harvestToGreen;
  return Math.floor(amount * rate);
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
  // The green world: the biome that is spreading (an index), how much of
  // the planet each one covers (0 to 1), a settle timer and times switched.
  ...[
    "bmActive",
    "bmForest",
    "bmJungle",
    "bmMeadow",
    "bmWetland",
    "bmSettle",
    "bmSwitches",
  ].map((id): ResourceDef => ({ id, label: id, phases: HIDDEN })),
  // Seed migration: stage (0 gathering, 1 ready, 2 flying), clocks, the
  // destination, the day's weather and how green each region is, flights
  // landed, green flowing in, the last flight, and the flocks' own stream.
  ...[
    "mgStage",
    "mgTime",
    "mgFly",
    "mgDest",
    "mgRoll0",
    "mgRoll1",
    "mgRoll2",
    "mgRoll3",
    "mgRoll4",
    "mgGreen0",
    "mgGreen1",
    "mgGreen2",
    "mgGreen3",
    "mgGreen4",
    "mgShown",
    "mgFlights",
    "mgPending",
    "mgSurgeRate",
    "mgEarned",
    "mgLastPays",
    "mgBy",
    "mgRng",
    "mgPaused",
  ].map((id): ResourceDef => ({ id, label: id, phases: HIDDEN })),
  // The old window box: stage (0 resting, 1 wanting), clocks, what the pot
  // wants, how many wants it has shown, answers given, the last answer (what
  // was chosen, what was wanted, what it paid, who gave it), care earned from
  // answers, the pot's stage (0 soil to 3 bloom, the bloom sound reads it),
  // and the pot's own random stream.
  ...[
    "wbStage",
    "wbTime",
    "wbWant",
    "wbShown",
    "wbTends",
    "wbLastChoice",
    "wbLastWant",
    "wbLastPays",
    "wbBy",
    "wbRng",
    "wbPaused",
    "potStage",
  ].map((id): ResourceDef => ({ id, label: id, phases: HIDDEN })),
  // Kept for the scene's flourish; never shown as a number.
  { id: "bloom", label: "Bloom", phases: HIDDEN },
];
