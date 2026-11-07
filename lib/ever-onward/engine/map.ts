import { DEFAULT_SEED, newRun } from "./engine";
import type {
  ArtifactDef,
  MapState,
  RunState,
  SquareChange,
  SquareKey,
  UniverseDef,
  UniverseSave,
} from "./types";

/**
 * The prestige map (Paperclips style): every finished run is one step right
 * ("next door") or down ("within"), or back to a square already visited.
 * Artifacts sit on some squares, unknown until a run finishes there.
 */

export const START_SQUARE: SquareKey = "0,0";

export const squareKey = (x: number, y: number): SquareKey => `${x},${y}`;

/** The column and row of a key, or null if it isn't one. */
export function parseSquare(key: string): { x: number; y: number } | null {
  const match = /^(\d+),(\d+)$/.exec(key);
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]) };
}

const onBoard = (def: UniverseDef, key: string): boolean => {
  const square = parseSquare(key);
  const map = def.map;
  return !!square && !!map && square.x < map.cols && square.y < map.rows;
};

export function newMapState(): MapState {
  return { at: START_SQUARE, visited: [], found: [], off: [] };
}

/** The bottom-right square, where the map ends. */
export function lastSquare(map: NonNullable<UniverseDef["map"]>): SquareKey {
  return squareKey(map.cols - 1, map.rows - 1);
}

/** The universe's map progress; a missing one, or one off the board, starts over. */
export function mapOf(def: UniverseDef, save: UniverseSave): MapState {
  const state = save.map ?? newMapState();
  return onBoard(def, state.at) ? state : { ...state, at: START_SQUARE };
}

/** What a square changes: its column's change, then its row's. */
export function squareChanges(
  def: UniverseDef,
  key: SquareKey
): SquareChange[] {
  const square = parseSquare(key);
  if (!square || !def.map) return [];
  return [def.map.columns[square.x], def.map.rowChanges[square.y]].filter(
    (c): c is SquareChange => !!c && c.text !== ""
  );
}

export function artifactAt(
  def: UniverseDef,
  key: SquareKey
): ArtifactDef | undefined {
  const square = parseSquare(key);
  if (!square) return undefined;
  return def.map?.artifacts.find((a) => a.x === square.x && a.y === square.y);
}

/** Found artifacts that are switched on, in map order. */
export function activeArtifacts(
  def: UniverseDef,
  state: MapState
): ArtifactDef[] {
  return (def.map?.artifacts ?? []).filter(
    (a) => state.found.includes(a.id) && !state.off.includes(a.id)
  );
}

/** The player bought old permanent upgrades; they live on as the Keepsake. */
export function hasKeepsake(save: UniverseSave): boolean {
  return Object.values(save.prestigeUpgrades).some((level) => level > 0);
}

/** A fresh run on the save's square: keepsake, artifacts, then the square. */
export function freshRun(
  def: UniverseDef,
  save: UniverseSave,
  seed: number = DEFAULT_SEED
): RunState {
  if (!def.map) return newRun(def, save.prestigeUpgrades, seed);
  const state = mapOf(def, save);
  return newRun(def, save.prestigeUpgrades, seed, (run) => {
    for (const artifact of activeArtifacts(def, state)) {
      artifact.apply(run);
      run.flags[`art:${artifact.id}`] = true;
    }
    for (const change of squareChanges(def, state.at)) change.apply?.(run);
    const depth = parseSquare(state.at)?.y ?? 0;
    if (depth > 0) run.mods.depth = depth;
  });
}

/** Where a finished run can go: right and down ahead, any visited square back. */
export function choices(
  def: UniverseDef,
  state: MapState
): { ahead: SquareKey[]; back: SquareKey[] } {
  const square = parseSquare(state.at);
  const ahead = square
    ? [squareKey(square.x + 1, square.y), squareKey(square.x, square.y + 1)]
    : [];
  return {
    ahead: ahead.filter((k) => onBoard(def, k)),
    back: [...state.visited],
  };
}

/** The artifact a finished run is about to find, if any. */
export function pendingFind(
  def: UniverseDef,
  save: UniverseSave
): ArtifactDef | undefined {
  if (!def.map || !save.run.complete) return undefined;
  const state = mapOf(def, save);
  const artifact = artifactAt(def, state.at);
  return artifact && !state.found.includes(artifact.id) ? artifact : undefined;
}

/** The map state once the finished run on `at` is counted. */
function counted(def: UniverseDef, save: UniverseSave): MapState {
  const state = mapOf(def, save);
  const find = pendingFind(def, save);
  return {
    ...state,
    visited: state.visited.includes(state.at)
      ? state.visited
      : [...state.visited, state.at],
    found: find ? [...state.found, find.id] : state.found,
    ...(def.map && state.at === lastSquare(def.map) ? { done: true } : {}),
  };
}

/** The squares a finished run may move to (counting the square just finished). */
export function legalTargets(
  def: UniverseDef,
  save: UniverseSave
): SquareKey[] {
  if (!def.map || !save.run.complete) return [];
  const { ahead, back } = choices(def, counted(def, save));
  return [...ahead, ...back];
}

/**
 * Count the finished run (best time, completion, visit, find) and start the
 * next run on `target`. Anything else (unfinished run, illegal square) is a
 * no-op.
 */
export function stepMap(
  def: UniverseDef,
  save: UniverseSave,
  target: SquareKey,
  seed: number = DEFAULT_SEED
): UniverseSave {
  if (!legalTargets(def, save).includes(target)) return save;
  const { run } = save;
  const map = { ...counted(def, save), at: target };
  const next: UniverseSave = {
    ...save,
    best: Math.min(save.best ?? Infinity, run.time),
    completions: save.completions + 1,
    map,
  };
  return { ...next, run: freshRun(def, next, seed) };
}

/** Switch a found artifact with a catch on or off; it applies from the next run. */
export function toggleArtifact(
  def: UniverseDef,
  save: UniverseSave,
  id: string
): UniverseSave {
  const state = mapOf(def, save);
  const artifact = def.map?.artifacts.find((a) => a.id === id);
  if (!artifact?.catch || !state.found.includes(id)) return save;
  const off = state.off.includes(id)
    ? state.off.filter((o) => o !== id)
    : [...state.off, id];
  return { ...save, map: { ...state, off } };
}
