import type { SaveData, UniverseDef, UniverseSave } from "./types";

/** A universe the player has actually played (not just opened). */
export function hasStartedUniverse(universe: UniverseSave): boolean {
  return (
    universe.completions > 0 ||
    universe.embers > 0 ||
    universe.run.time > 0 ||
    universe.run.taps > 0
  );
}

/**
 * Whether the player can open a universe. Judged by `completions`, which
 * only ever grows, so a restart or an old save never locks it again.
 */
export function isUniverseUnlocked(def: UniverseDef, save: SaveData): boolean {
  if (!def.requires) return true;
  return (save.universes[def.requires.universeId]?.completions ?? 0) > 0;
}
