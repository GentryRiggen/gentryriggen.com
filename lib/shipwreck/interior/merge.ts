import type { Blocker, Seam, V2, WalkArea, WalkMap } from "../walk/types";
import { pieceBlocker } from "./kit";
import { liftCarId } from "./lift";
import type { InteriorMap, LiftShaft, Room } from "./types";

/**
 * A room as a walk area: flagged `interior`, or, a deck room, an open-deck
 * area (no flag: deck speed, jumping, never closed) whose every edge is a
 * wall (glass you cannot jump over). Either keeps its kind.
 */
function roomArea(r: Room): WalkArea {
  return {
    id: r.id,
    deck: r.deck,
    ...(r.raiseM !== undefined ? { raiseM: r.raiseM } : {}),
    outline: r.outline,
    ...(r.deckRoom
      ? { wallEdges: r.outline.map((_, i) => i) }
      : { interior: true as const }),
    ...(r.ramp ? { ramp: r.ramp } : {}),
    ...(r.axis ? { axis: r.axis } : {}),
    kind: r.kind,
    ...(r.noWalk ? { noWalk: true as const } : {}),
  };
}

/** The blockers of the furniture in a set of rooms (in furniture order). */
function furnitureBlockers(
  interior: InteriorMap,
  rooms: ReadonlySet<string> | null
): Blocker[] {
  const out: Blocker[] = [];
  for (const f of interior.furniture) {
    if (rooms && !rooms.has(f.room)) continue;
    const b = pieceBlocker(f);
    if (b) out.push(b);
  }
  return out;
}

/**
 * A ship's deck rooms as open-deck areas and their furniture's blockers,
 * for her deck map (the pool hall is part of her open decks: one source,
 * the interior's data).
 */
export function deckRoomWalk(interior: InteriorMap): {
  areas: WalkArea[];
  blockers: Blocker[];
} {
  const rooms = interior.rooms.filter((r) => r.deckRoom);
  return {
    areas: rooms.map(roomArea),
    blockers: furnitureBlockers(interior, new Set(rooms.map((r) => r.id))),
  };
}

// --- Lift shafts (hers) ---------------------------------------------------------

/** A lift car's ceiling over its floor (m): the glass car's height. */
export const LIFT_CAR_CEILING_M = 2.4;

/** The car's plan, counter-clockwise, with the door's ends cut into it. */
function carOutline(lift: LiftShaft, door: readonly [V2, V2]): V2[] {
  const { min, max } = lift.car;
  const rect: V2[] = [
    [min[0], min[1]],
    [max[0], min[1]],
    [max[0], max[1]],
    [min[0], max[1]],
  ];
  const eps = 1e-6;
  for (let i = 0; i < 4; i += 1) {
    const a = rect[i];
    const b = rect[(i + 1) % 4];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    const at = (p: V2) => ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len;
    const off = (p: V2) =>
      Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len;
    if (door.some((p) => off(p) > eps || at(p) < -eps || at(p) > len + eps))
      continue;
    const inner = [...door]
      .sort((p, q) => at(p) - at(q))
      .filter((p) => at(p) > eps && at(p) < len - eps);
    return [...rect.slice(0, i + 1), ...inner, ...rect.slice(i + 1)];
  }
  throw new Error(`lift ${lift.id}: a door off its car's walls`);
}

/**
 * An interior's lift cars as rooms (one `lift-car` per stop, on the stop's
 * deck, in its landing's zone, its plan the car's with the door cut in),
 * and the seams that join each to its landing. No links: the cars ride
 * (`WalkerState.ride`, lift.ts), the walker standing in one car area
 * until the ride ends in the car at the arrival stop. Empty for an
 * interior without shafts (the Titanic's lift is two rooms and a link).
 */
export function liftCars(interior: InteriorMap): {
  rooms: Room[];
  seams: Seam[];
} {
  const rooms: Room[] = [];
  const seams: Seam[] = [];
  for (const lift of interior.lifts ?? []) {
    for (const stop of lift.stops) {
      const landing = interior.rooms.find((r) => r.id === stop.landing);
      if (!landing)
        throw new Error(`lift ${lift.id}: no landing ${stop.landing}`);
      const id = liftCarId(lift.id, stop.deck);
      rooms.push({
        id,
        kind: "lift-car",
        deck: stop.deck,
        ...(stop.raiseM ? { raiseM: stop.raiseM } : {}),
        outline: carOutline(lift, stop.door),
        ceilingM: LIFT_CAR_CEILING_M,
        zone: landing.zone,
        look: { finish: "cream", floor: "marble", lamp: "downlight" },
      });
      seams.push({ a: id, b: stop.landing, at: stop.door });
    }
  }
  return { rooms, seams };
}

/**
 * A ship's walk map with her interior merged in: rooms become interior
 * areas (deck rooms open-deck ones), blocking furniture becomes blockers,
 * links join the stairs and seams join `seams`; each lift shaft adds its
 * cars and their seams (`liftCars`), and the shafts ride along as `lifts`. The deck map's own entries
 * are kept as they are, except an area of a deck room's id (and the
 * blockers in it), which the room's data replaces, so a deck map built
 * with `deckRoomWalk` merges to the same areas.
 */
export function withInterior(deckMap: WalkMap, interior: InteriorMap): WalkMap {
  if (deckMap.ship !== interior.ship)
    throw new Error(`interior ${interior.ship} on map ${deckMap.ship}`);
  const replaced = new Set(
    interior.rooms.filter((r) => r.deckRoom).map((r) => r.id)
  );
  const blockers: Blocker[] = deckMap.blockers.filter(
    (b) => !replaced.has(b.area)
  );
  blockers.push(...furnitureBlockers(interior, null));
  const lifts = liftCars(interior);
  return {
    // The deck map's own flags (her lean) carry over.
    ...deckMap,
    ship: deckMap.ship,
    areas: [
      ...deckMap.areas.filter((a) => !replaced.has(a.id)),
      ...interior.rooms.map(roomArea),
      ...lifts.rooms.map(roomArea),
    ],
    blockers,
    stairs: [...deckMap.stairs, ...interior.links],
    seams: [...(deckMap.seams ?? []), ...interior.seams, ...lifts.seams],
    spawn: deckMap.spawn,
    ...(interior.lifts ? { lifts: interior.lifts } : {}),
  };
}
