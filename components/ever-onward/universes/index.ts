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
