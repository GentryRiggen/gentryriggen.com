import type { Blocker, WalkArea, WalkMap } from "../walk/types";
import { pieceBlocker } from "./kit";
import type { InteriorMap, Room } from "./types";

/** A room as a walk area (flagged `interior`). */
function roomArea(r: Room): WalkArea {
  return {
    id: r.id,
    deck: r.deck,
    ...(r.raiseM !== undefined ? { raiseM: r.raiseM } : {}),
    outline: r.outline,
    interior: true,
    ...(r.ramp ? { ramp: r.ramp } : {}),
    ...(r.axis ? { axis: r.axis } : {}),
    kind: r.kind,
    ...(r.noWalk ? { noWalk: true as const } : {}),
  };
}

/**
 * A ship's walk map with her interior merged in: rooms become interior
 * areas, blocking furniture becomes blockers, links join the stairs and
 * seams join `seams`. The deck map's own entries are kept as they are.
 */
export function withInterior(deckMap: WalkMap, interior: InteriorMap): WalkMap {
  if (deckMap.ship !== interior.ship)
    throw new Error(`interior ${interior.ship} on map ${deckMap.ship}`);
  const blockers: Blocker[] = [...deckMap.blockers];
  for (const f of interior.furniture) {
    const b = pieceBlocker(f);
    if (b) blockers.push(b);
  }
  return {
    ship: deckMap.ship,
    areas: [...deckMap.areas, ...interior.rooms.map(roomArea)],
    blockers,
    stairs: [...deckMap.stairs, ...interior.links],
    seams: [...(deckMap.seams ?? []), ...interior.seams],
    spawn: deckMap.spawn,
  };
}
