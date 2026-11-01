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
  // Kept for the scene's flourish; never shown as a number.
  { id: "bloom", label: "Bloom", phases: HIDDEN },
];
