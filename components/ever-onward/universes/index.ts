import { isUniverseUnlocked } from "@/lib/ever-onward/engine/progress";
import type { SaveData } from "@/lib/ever-onward/engine/types";
import { getPlayableUniverse } from "@/lib/ever-onward/universes";
import type { MusicSpec } from "../../game-audio/music";
import { GROW_TITLE_SCORE } from "../audio/growScores";
import { TITLE_SCORE } from "../audio/scores";
import type { UniverseUi } from "./types";
import { GROW_UI } from "./grow";
import { LIGHT_UI } from "./light";

/** The screen's per-universe pieces, by universe id. */
export const UNIVERSE_UI: Readonly<Record<string, UniverseUi>> = {
  light: LIGHT_UI,
  grow: GROW_UI,
};

export function uiFor(id: string): UniverseUi {
  const ui = UNIVERSE_UI[id];
  if (!ui) throw new Error(`No UI for universe ${id}`);
  return ui;
}

/**
 * The hub's theme: Make It Grow's while it is open and not yet finished (the
 * hub's new thing to try), the usual title theme otherwise.
 */
export function hubTitleScore(save: SaveData): MusicSpec {
  const grow = getPlayableUniverse("grow");
  if (!grow || !isUniverseUnlocked(grow, save)) return TITLE_SCORE;
  return (save.universes.grow?.completions ?? 0) > 0
    ? TITLE_SCORE
    : GROW_TITLE_SCORE;
}
