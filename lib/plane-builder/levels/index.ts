// lib/plane-builder/levels/index.ts
import { CANYON } from "./canyon";
import { MEADOW } from "./meadow";
import { MOUNTAINS } from "./mountains";
import type { LevelDef, LevelId } from "./types";

export const LEVEL_ORDER: readonly LevelId[] = [
  "meadow",
  "canyon",
  "mountains",
];

export const LEVELS: Record<LevelId, LevelDef> = {
  meadow: MEADOW,
  canyon: CANYON,
  mountains: MOUNTAINS,
};

export function nextLevelId(id: LevelId): LevelId | null {
  const i = LEVEL_ORDER.indexOf(id);
  return LEVEL_ORDER[i + 1] ?? null;
}
