import { choices, counted, parseSquare, squareKey } from "./map";
import type { SquareKey, UniverseDef, UniverseSave } from "./types";

/**
 * The route bot's next square after a finished run: head for the nearest
 * artifact still ahead; when none is, go back to the visited square nearest
 * one; with everything found, head for the last square.
 */
export function routeStep(def: UniverseDef, save: UniverseSave): SquareKey {
  const map = def.map!;
  const state = counted(def, save);
  const here = parseSquare(state.at)!;
  const unfound = map.artifacts.filter((a) => !state.found.includes(a.id));
  const distance = (from: { x: number; y: number }) =>
    Math.min(
      Infinity,
      ...unfound
        .filter((a) => a.x >= from.x && a.y >= from.y)
        .map((a) => a.x - from.x + (a.y - from.y))
    );
  const towards = (tx: number, ty: number): SquareKey =>
    tx > here.x
      ? squareKey(here.x + 1, here.y)
      : squareKey(here.x, here.y + Math.min(1, ty - here.y));

  if (unfound.length === 0) return towards(map.cols - 1, map.rows - 1);
  if (distance(here) < Infinity) {
    const target = unfound
      .filter((a) => a.x >= here.x && a.y >= here.y)
      .sort(
        (a, b) =>
          a.x - here.x + (a.y - here.y) - (b.x - here.x + (b.y - here.y))
      )[0];
    return towards(target.x, target.y);
  }
  const { back } = choices(def, state);
  return back
    .map((key) => ({ key, d: distance(parseSquare(key)!) }))
    .sort((a, b) => a.d - b.d)[0].key;
}
