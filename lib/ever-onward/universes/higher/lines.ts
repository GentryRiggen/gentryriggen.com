import type { RunState } from "../../engine/types";

/** The three helper lines of each phase, by phase index. */
export const HELPER_LINES: readonly (readonly string[])[] = [
  ["bear", "ramp", "toy-crane"],
  ["mason", "crane", "concrete-truck"],
  ["sky-crew", "cloud-crane", "cable-spinner"],
  ["stair-lamp", "songbird", "hum"],
];

/** The scaling upgrade of each phase, by phase index. */
export const SCALE_IDS: readonly string[] = [
  "big-blocks",
  "scaffolding",
  "alloy",
  "light-load",
];

/** The brace upgrade (it makes the tower sway slower) of the first three phases. */
export const BRACE_IDS: readonly string[] = [
  "rug-corners",
  "cross-braces",
  "damper",
];

/** The one-off that halves the sway in each of the first three phases. */
export const STEADY_ONEOFF_IDS: readonly string[] = [
  "cushion-fort",
  "safety-nets",
  "ballast-ring",
];

/** Every upgrade of the Town: the tower's height (and so its shadow) counts them. */
export const TOWN_UPGRADE_IDS: readonly string[] = [
  "mason",
  "scaffolding",
  "cross-braces",
  "crane",
  "safety-nets",
  "concrete-truck",
  "neon-sign",
  "skyscraper",
];

export const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
export const res = (run: RunState, id: string): number =>
  run.resources[id] ?? 0;

/** Every level of every helper in the phase the run is in. */
export const helperLevels = (run: RunState): number =>
  (HELPER_LINES[run.phase] ?? []).reduce((sum, id) => sum + owned(run, id), 0);
