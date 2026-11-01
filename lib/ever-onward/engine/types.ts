/**
 * Ever Onward engine types. A universe is data plus a few small pure
 * functions; the engine owns everything else (buying, phases, story, prestige,
 * saving). RunState is plain JSON so it can be saved and simulated as is.
 *
 * Hooks that receive a `RunState` (tick, manualAction, onBuy, onEnter, apply)
 * get a private draft the engine already cloned: mutate it freely. Predicates
 * (`isDone`, `isComplete`, `visibleWhen`, `when`) must only read.
 */

export interface PhaseTransition {
  from: string;
  to: string;
  /** Run time, in seconds, when the phase changed. */
  at: number;
}

export interface RunState {
  /** Index into `UniverseDef.phases`. */
  phase: number;
  /** Seconds of play in this run (the clock only runs while visible). */
  time: number;
  taps: number;
  complete: boolean;
  resources: Record<string, number>;
  /** Upgrade id to level bought. */
  owned: Record<string, number>;
  /** Numbers a universe or a prestige upgrade sets for the tick to read. */
  mods: Record<string, number>;
  flags: Record<string, boolean>;
  /** Upgrade ids that have popped in; they stay revealed. */
  revealed: string[];
  /** Story message ids, in the order they fired. */
  story: string[];
  /** Every phase change so far; the UI shows a moment for each new one. */
  transitions: PhaseTransition[];
  /** Deterministic RNG state (see rng.ts). */
  rng: number;
}

export interface ResourceDef {
  id: string;
  label: string;
  initial?: number;
  /** Phase ids where it is shown; omitted means always. */
  phases?: readonly string[];
}

export interface PhaseDef {
  id: string;
  title: string;
  /** A line or two for the transition moment into this phase. */
  intro?: string;
  /** The resource the free manual action earns here. */
  manualResource: string;
  manualLabel: string;
  /** True once the run should move on to the next phase. Ignored in the last. */
  isDone(run: RunState): boolean;
  onEnter?(run: RunState): void;
}

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  /** Phase ids where it can be bought; omitted means every phase. */
  phases?: readonly string[];
  /** Resource id it costs. */
  currency: string;
  baseCost: number;
  /** Cost is baseCost * costGrowth ^ level. */
  costGrowth: number;
  /** Omitted means one level (a one-off); use Infinity for no cap. */
  maxLevel?: number;
  /** Pops in the first time this is true (omitted: visible at once). */
  visibleWhen?(run: RunState): boolean;
  /** Sim hint: higher is bought first among the affordable. */
  priority?: number;
  onBuy?(run: RunState, newLevel: number): void;
}

export interface StoryMessage {
  id: string;
  text: string;
  /** Only fires while this phase is current. */
  phase?: string;
  /** Fires once, the first time this is true (omitted: on entering). */
  when?(run: RunState): boolean;
}

export interface PrestigeUpgradeDef {
  id: string;
  name: string;
  description: string;
  /** Embers for level 1. */
  cost: number;
  /** Cost multiplier per level; default 1.5. */
  costGrowth?: number;
  maxLevel: number;
  /** Shapes a fresh run (set mods, add starting resources, ...). */
  apply(run: RunState, level: number): void;
}

export interface PrestigeDef {
  /** Embers for finishing the universe. */
  completionEmbers: number;
  /** Embers for each phase cleared (kept when restarting from phase 2+). */
  phaseEmbers: number;
  upgrades: readonly PrestigeUpgradeDef[];
}

export interface UniverseDef {
  id: string;
  title: string;
  /** One-line goal shown on the hub card. */
  goal: string;
  resources: readonly ResourceDef[];
  phases: readonly PhaseDef[];
  upgrades: readonly UpgradeDef[];
  story: readonly StoryMessage[];
  prestige: PrestigeDef;
  /** Continuous production; dt is seconds, already clamped. */
  tick(run: RunState, dt: number): void;
  /** The free tap. Must earn the phase's manualResource whatever the state. */
  manualAction(run: RunState): void;
  /** Read in the last phase: true ends the run. */
  isComplete(run: RunState): boolean;
}

export interface UniverseSave {
  run: RunState;
  /** Fastest completion, in run seconds. */
  best: number | null;
  completions: number;
  embers: number;
  /** Prestige upgrade id to level. */
  prestigeUpgrades: Record<string, number>;
}

export interface SaveData {
  version: number;
  universes: Record<string, UniverseSave>;
  seenIntro: boolean;
}
