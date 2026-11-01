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
  const rate =
    from === 0
      ? TUNING.farm.seedsToHarvest
      : from === 1
        ? TUNING.world.harvestToGreen
        : TUNING.migration.greenToCare;
  return Math.floor(amount * rate);
}

/** How much of the one pot is grown, 0 to 100. */
export const FULL_GROWTH = 100;

const HIDDEN: readonly string[] = [];

export const RESOURCES: readonly ResourceDef[] = [
  { id: "seeds", label: "Seeds", phases: [PHASE_YARD] },
  { id: "produce", label: "Ripe produce", phases: [PHASE_YARD] },
  { id: "harvest", label: "Harvest", phases: [PHASE_FARM] },
  { id: "green", label: "Green", phases: [PHASE_WORLD] },
  { id: "care", label: "Care", phases: [PHASE_SEED] },
  { id: "growth", label: "Growth (%)", phases: [PHASE_SEED] },
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
  // The bee dances: stage (0 foraging, 1 dancing), the clock, the dance
  // (angle and length), how many danced and followed, a pollination flowing
  // in, the last follow, and the bees' own random stream.
  ...[
    "beStage",
    "beTime",
    "beAngle",
    "beLen",
    "beDances",
    "beFollows",
    "bePending",
    "beSurgeRate",
    "beEarned",
    "bePicked",
    "beHinted",
    "beLastPays",
    "beBy",
    "bePaused",
    "beRng",
  ].map((id): ResourceDef => ({ id, label: id, phases: HIDDEN })),
  // The farm's market: the crop in the ground, how long it still sprouts,
  // the wave of demand (angle, speed), a wobble per crop, the agent's clock,
  // times replanted, and the market's own random stream.
  ...[
    "mkCrop",
    "mkSprout",
    "mkAngle",
    "mkSpeed",
    "mkWobble0",
    "mkWobble1",
    "mkWobble2",
    "mkAgentTime",
    "mkPlants",
    "mkRng",
  ].map((id): ResourceDef => ({ id, label: id, phases: HIDDEN })),
  // The county fair: stage (0 waiting, 1 open, 2 judging), clocks, the three
  // pumpkins on offer (size and shine), fairs finished, a payout flowing in,
  // the last entry, and the fair's own random stream.
  ...[
    "frStage",
    "frTime",
    "frJudge",
    "frSize0",
    "frSize1",
    "frSize2",
    "frShine0",
    "frShine1",
    "frShine2",
    "frShown",
    "frFairs",
    "frPending",
    "frSurgeRate",
    "frEarned",
    "frPicked",
    "frPlace",
    "frLastPays",
    "frBy",
    "frIncome",
    "frRng",
    "frPaused",
  ].map((id): ResourceDef => ({ id, label: id, phases: HIDDEN })),
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
  // Kept for the scene's flourish; never shown as a number.
  { id: "bloom", label: "Bloom", phases: HIDDEN },
];
