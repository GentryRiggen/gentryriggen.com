import type { ResourceDef } from "../../engine/types";

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
export const MANUAL_RESOURCES = ["water", "harvest", "green", "care"] as const;

/** How much of the one pot is grown, 0 to 100. */
export const FULL_GROWTH = 100;

const HIDDEN: readonly string[] = [];

export const RESOURCES: readonly ResourceDef[] = [
  { id: "water", label: "Water", phases: [PHASE_YARD] },
  { id: "harvest", label: "Harvest", phases: [PHASE_FARM] },
  { id: "green", label: "Green", phases: [PHASE_WORLD] },
  { id: "care", label: "Care", phases: [PHASE_SEED] },
  { id: "growth", label: "Growth (%)", phases: [PHASE_SEED] },
  // Kept for the scene's flourish; never shown as a number.
  { id: "bloom", label: "Bloom", phases: HIDDEN },
];
