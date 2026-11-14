import { artifactAt, counted, newMapState } from "../engine/map";
import { routeStep } from "../engine/mapRoute";
import { newUniverseSave } from "../engine/prestige";
import type { MapState, UniverseDef, UniverseSave } from "../engine/types";

/** Test mode's map jumps: where on the chart to land, with a run just finished. */
export type MapPreset = "first" | "half" | "end";

export const MAP_PRESETS: readonly { id: MapPreset; label: string }[] = [
  { id: "first", label: "First find" },
  { id: "half", label: "Halfway" },
  { id: "end", label: "Near the end" },
];

/**
 * The map state for a preset, walked by the route bot (no runs are played):
 * "first" finishes a run on the first artifact; "half" stands on an unfound
 * artifact with about half found; "end" has everything found, one step from
 * the last square.
 */
export function mapPreset(def: UniverseDef, preset: MapPreset): MapState {
  const map = def.map!;
  if (preset === "first") {
    const first = [...map.artifacts].sort((a, b) => a.x + a.y - (b.x + b.y))[0];
    return { ...newMapState(), at: `${first.x},${first.y}` };
  }
  const half = Math.floor(map.artifacts.length / 2);
  let save: UniverseSave = {
    ...newUniverseSave(def),
    run: { ...newUniverseSave(def).run, complete: true },
  };
  for (let guard = 0; guard < 400; guard += 1) {
    const state = save.map!;
    const waiting = artifactAt(def, state.at);
    if (
      preset === "half" &&
      state.found.length >= half &&
      waiting &&
      !state.found.includes(waiting.id)
    )
      return state;
    if (preset === "end" && state.found.length === map.artifacts.length)
      return {
        ...state,
        at: `${map.cols - 1},${map.rows - 2}`,
      };
    const next = { ...counted(def, save), at: routeStep(def, save) };
    save = { ...save, map: next };
  }
  return save.map!;
}
