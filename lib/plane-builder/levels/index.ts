// lib/plane-builder/levels/index.ts
import { BEACH } from "./beach";
import { CANYON } from "./canyon";
import { CITY } from "./city";
import { GLACIER } from "./glacier";
import { ISLANDS } from "./islands";
import { JUNGLE } from "./jungle";
import { MEADOW } from "./meadow";
import { MOUNTAINS } from "./mountains";
import { STORM } from "./storm";
import { VOLCANO } from "./volcano";
import type { LevelDef, LevelId } from "./types";

export const LEVEL_ORDER: readonly LevelId[] = [
  "meadow",
  "canyon",
  "mountains",
  "beach",
  "jungle",
  "city",
  "glacier",
  "volcano",
  "storm",
  "islands",
];

export const LEVELS: Record<LevelId, LevelDef> = {
  meadow: MEADOW,
  canyon: CANYON,
  mountains: MOUNTAINS,
  beach: BEACH,
  jungle: JUNGLE,
  city: CITY,
  glacier: GLACIER,
  volcano: VOLCANO,
  storm: STORM,
  islands: ISLANDS,
};

export function nextLevelId(id: LevelId): LevelId | null {
  const i = LEVEL_ORDER.indexOf(id);
  return LEVEL_ORDER[i + 1] ?? null;
}
