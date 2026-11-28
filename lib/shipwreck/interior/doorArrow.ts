import { areaById, type V2, type WalkMap } from "../walk/types";
import type { DepthAt } from "./doorExit";

/**
 * The arrow over a deck door (1.16, see README.md "The way in"): which
 * door it stands over while walking her open decks. Pure: the caller
 * passes the water as `depthAt`, as for the door buttons.
 *
 * A door is open when its inside end is dry (the door button's rule). The
 * nearest open door on the walker's own deck area wins; with none there
 * (the forecastle, the poop), the nearest open door anywhere, so the arrow
 * still shows the way. Hidden (−1) inside a room, once she has broken,
 * and on a ship with no deck doors.
 */
export function doorArrow(
  map: WalkMap,
  area: string,
  at: V2,
  depthAt: DepthAt,
  broken: boolean
): number {
  if (broken || areaById(map, area)?.interior === true) return -1;
  let sameBest = -1;
  let sameD = Infinity;
  let anyBest = -1;
  let anyD = Infinity;
  for (let i = 0; i < map.stairs.length; i += 1) {
    const st = map.stairs[i];
    if (st.kind !== "door") continue;
    const d = Math.hypot(at[0] - st.from.at[0], at[1] - st.from.at[1]);
    // Cheap distance first: the water is only asked for a better door.
    const same = st.from.area === area;
    if (same ? d >= sameD : d >= anyD) continue;
    if (depthAt(st.to.area, st.to.at[0], st.to.at[1]) >= 0) continue;
    if (same) {
      sameBest = i;
      sameD = d;
    }
    if (d < anyD) {
      anyBest = i;
      anyD = d;
    }
  }
  return sameBest >= 0 ? sameBest : anyBest;
}
