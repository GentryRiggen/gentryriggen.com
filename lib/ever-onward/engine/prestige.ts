import { DEFAULT_SEED, newRun } from "./engine";
import type {
  PrestigeUpgradeDef,
  RunState,
  UniverseDef,
  UniverseSave,
} from "./types";

export function newUniverseSave(
  def: UniverseDef,
  seed: number = DEFAULT_SEED
): UniverseSave {
  return {
    run: newRun(def, {}, seed),
    best: null,
    completions: 0,
    embers: 0,
    prestigeUpgrades: {},
  };
}

/** The prestige currency's plural display name. */
export function prestigeLabel(def: UniverseDef): string {
  return def.prestige.label ?? "Embers";
}

/** The prestige currency's singular name ("Ember"). */
export function prestigeSingular(def: UniverseDef): string {
  return def.prestige.labelSingular ?? prestigeLabel(def).replace(/s$/, "");
}

/** Embers a run is worth if it ended now (a finished run counts every phase). */
export function emberReward(def: UniverseDef, run: RunState): number {
  const cleared = run.complete ? def.phases.length : run.phase;
  const { completionEmbers, phaseEmbers } = def.prestige;
  return cleared * phaseEmbers + (run.complete ? completionEmbers : 0);
}

/** A finished run can always start over; an unfinished one from phase 2 on. */
export function canRestart(run: RunState): boolean {
  return run.complete || run.phase >= 1;
}

/**
 * End the run (finished, or restarted from phase 2+): bank the embers, record
 * a completion, and start a fresh run shaped by the permanent upgrades.
 */
export function endRun(
  def: UniverseDef,
  save: UniverseSave,
  seed: number = DEFAULT_SEED
): UniverseSave {
  if (!canRestart(save.run)) return save;
  const { run } = save;
  const best = run.complete
    ? Math.min(save.best ?? Infinity, run.time)
    : save.best;
  return {
    ...save,
    best,
    completions: save.completions + (run.complete ? 1 : 0),
    embers: save.embers + emberReward(def, run),
    run: newRun(def, save.prestigeUpgrades, seed),
  };
}

function findPrestige(
  def: UniverseDef,
  id: string
): PrestigeUpgradeDef | undefined {
  return def.prestige.upgrades.find((u) => u.id === id);
}

/** Embers for the next level, or null if unknown or maxed. */
export function prestigeUpgradeCost(
  def: UniverseDef,
  save: UniverseSave,
  id: string
): number | null {
  const upgrade = findPrestige(def, id);
  if (!upgrade) return null;
  const level = save.prestigeUpgrades[id] ?? 0;
  if (level >= upgrade.maxLevel) return null;
  return Math.ceil(upgrade.cost * (upgrade.costGrowth ?? 1.5) ** level);
}

/** Spend embers on a permanent upgrade; it shapes the next fresh run. */
export function buyPrestigeUpgrade(
  def: UniverseDef,
  save: UniverseSave,
  id: string
): UniverseSave {
  const cost = prestigeUpgradeCost(def, save, id);
  if (cost === null || save.embers < cost) return save;
  return {
    ...save,
    embers: save.embers - cost,
    prestigeUpgrades: {
      ...save.prestigeUpgrades,
      [id]: (save.prestigeUpgrades[id] ?? 0) + 1,
    },
  };
}
