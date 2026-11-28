import type { Stair, V2, WalkMap } from "../walk/types";

/**
 * Going in and out by the deck doors without walking through them (the
 * door buttons and the test hooks; see README.md "Doors"). Pure: the
 * caller passes the water over a point as `depthAt` (m over the floor,
 * negative when dry), so the rules never read the sim.
 */

/** The door button shows within this of a deck door's outside end (m). */
export const DOOR_REACH_M = 4;

/** Water over the floor at a point of an area (m; negative when dry). */
export type DepthAt = (area: string, x: number, y: number) => number;

/** Where a door puts the walker: an area, a point and the way to face. */
export interface DoorPlace {
  /** The door's id. */
  id: string;
  area: string;
  at: V2;
  /** Heading in the ship frame (rad), facing on through the door. */
  yaw: number;
}

function isDoor(st: Stair): boolean {
  return st.kind === "door";
}

function dry(depthAt: DepthAt, end: Stair["from"]): boolean {
  return depthAt(end.area, end.at[0], end.at[1]) < 0;
}

/** Facing from one end of a door to the other. */
function heading(from: V2, to: V2): number {
  return Math.atan2(to[1] - from[1], to[0] - from[0]);
}

function inside(st: Stair): DoorPlace {
  return {
    id: st.id,
    area: st.to.area,
    at: st.to.at,
    yaw: heading(st.from.at, st.to.at),
  };
}

function outside(st: Stair): DoorPlace {
  return {
    id: st.id,
    area: st.from.area,
    at: st.from.at,
    yaw: heading(st.to.at, st.from.at),
  };
}

/**
 * The door to go in by from the open deck: door `id` when given (anywhere,
 * as a test hook may ask), else the nearest deck door on the walker's area
 * whose outside end is within DOOR_REACH_M. Either way only when its inside
 * is dry. Returns where to stand inside, or null.
 */
export function doorToEnter(
  map: WalkMap,
  area: string,
  at: V2,
  depthAt: DepthAt,
  id?: string
): DoorPlace | null {
  let best: Stair | null = null;
  let bestD = Infinity;
  for (const st of map.stairs) {
    if (!isDoor(st)) continue;
    if (id !== undefined) {
      if (st.id === id && dry(depthAt, st.to)) return inside(st);
      continue;
    }
    if (st.from.area !== area) continue;
    const d = Math.hypot(at[0] - st.from.at[0], at[1] - st.from.at[1]);
    if (d > DOOR_REACH_M || d >= bestD || !dry(depthAt, st.to)) continue;
    best = st;
    bestD = d;
  }
  return best ? inside(best) : null;
}

/**
 * Where Go outside puts the walker: the outside end of the door they came
 * in by when it is dry, else the nearest deck door (to `near`, the walker,
 * when given) whose outside end is dry, else null (the caller then tries
 * the spawn, `placeWalker`, and failing that the sea).
 */
export function doorExit(
  map: WalkMap,
  cameInBy: string | null,
  depthAt: DepthAt,
  near?: V2
): DoorPlace | null {
  const doors = map.stairs.filter(isDoor);
  const came = cameInBy ? doors.find((d) => d.id === cameInBy) : undefined;
  if (came && dry(depthAt, came.from)) return outside(came);
  let best: Stair | null = null;
  let bestD = Infinity;
  for (const st of doors) {
    if (!dry(depthAt, st.from)) continue;
    const d = near
      ? Math.hypot(near[0] - st.from.at[0], near[1] - st.from.at[1])
      : 0;
    if (d >= bestD) continue;
    best = st;
    bestD = d;
  }
  return best ? outside(best) : null;
}

/**
 * A walk-out's heading turned to face along her deck (hers: a lifeboat
 * stands 0.45 m outside her recess doors, so facing square out of the door
 * looks into its hull): a heading mostly across the ship faces aft, toward
 * her midships; one mostly along her is kept.
 */
export function alongDeck(yaw: number): number {
  return Math.abs(Math.sin(yaw)) > Math.SQRT1_2 ? Math.PI : yaw;
}
