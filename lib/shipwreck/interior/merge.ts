import type { Blocker, WalkArea, WalkMap } from "../walk/types";
import { pieceBlocker } from "./kit";
import type { InteriorMap, Room } from "./types";

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

/**
 * A ship's walk map with her interior merged in: rooms become interior
 * areas (deck rooms open-deck ones), blocking furniture becomes blockers,
 * links join the stairs and seams join `seams`. The deck map's own entries
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
  return {
    // The deck map's own flags (her lean) carry over.
    ...deckMap,
    ship: deckMap.ship,
    areas: [
      ...deckMap.areas.filter((a) => !replaced.has(a.id)),
      ...interior.rooms.map(roomArea),
    ],
    blockers,
    stairs: [...deckMap.stairs, ...interior.links],
    seams: [...(deckMap.seams ?? []), ...interior.seams],
    spawn: deckMap.spawn,
  };
}
