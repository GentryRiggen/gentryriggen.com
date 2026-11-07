import { SCORED_UNIVERSES } from "../universes/scored";
import { jumpRun, type JumpPoint } from "./jump";
import { freshRun } from "../engine/map";
import { newUniverseSave } from "../engine/prestige";
import { simulate } from "../engine/sim";
import type { MapState, RunState } from "../engine/types";
import { mapPreset, type MapPreset } from "./mapJump";

/**
 * Loaded on demand (dynamic import) by Test mode, so the bots and the sim
 * never ship to players who don't use it.
 */
export function jumpTo(
  universeId: string,
  phase: number,
  point: JumpPoint
): RunState | null {
  const entry = SCORED_UNIVERSES[universeId];
  if (!entry) return null;
  return jumpRun(entry.def, entry.bots(), phase, point);
}

/**
 * Test mode's map jumps: the chart at `preset`, with a run just finished on
 * the square (played by the bot, so the scene is real).
 */
export function jumpToMap(
  universeId: string,
  preset: MapPreset
): { run: RunState; map: MapState } | null {
  const entry = SCORED_UNIVERSES[universeId];
  if (!entry?.def.map) return null;
  const map = mapPreset(entry.def, preset);
  const save = { ...newUniverseSave(entry.def), map };
  const run = simulate(entry.def, {
    strategy: entry.bots().tapper,
    maxSeconds: 6 * 3600,
    step: 1,
    startRun: freshRun(entry.def, save),
  }).finalRun;
  return { run, map };
}
