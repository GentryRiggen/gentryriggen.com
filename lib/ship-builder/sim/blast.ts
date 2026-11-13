import { resolveAttachPoint } from "../model/attach";
import { getPartDef } from "../model/catalog";
import {
  buildOccupancy,
  partCells,
  rotatedFootprint,
  type Occupancy,
} from "../model/grid";
import type { PlacedPart, Ship } from "../model/types";

/** Parts whose middle is within this many cells of the blast are thrown off. */
export const BLAST_REACH = 3;

/** A part a sea mine throws off the ship, where it sat (model frame). */
export interface BlastPiece {
  partId: string;
  /** Cells from the bow of its middle. */
  x: number;
  /** Deck level of its base. */
  level: number;
  /** Cells across the beam of its middle (model z). */
  z: number;
}

/** A part's middle in the model frame, or null when it has no place. */
function middleOf(
  ship: Ship,
  part: PlacedPart,
  occupancy: Occupancy
): { x: number; level: number; z: number } | null {
  if (part.anchor.kind === "grid") {
    const def = getPartDef(part.type);
    const size =
      def.placement === "grid"
        ? rotatedFootprint(def.footprint, part.rotation)
        : { x: 1, z: 1 };
    return {
      x: part.anchor.x + size.x / 2,
      level: part.anchor.level,
      z: part.anchor.z + size.z / 2,
    };
  }
  const point = resolveAttachPoint(ship, part.anchor, occupancy);
  if (!point) return null;
  return { x: point.position.x, level: point.position.y, z: point.position.z };
}

/** At most this many parts fly, so a blast stays readable (and cheap). */
export const MAX_THROWN = 24;

/**
 * The parts a sea mine going off `impactX` cells from the bow throws into the
 * air. It peels the ship from the top down near the blast: a part only goes
 * once everything fixed to it or stacked on it has gone, so nothing is left
 * floating. Nearest the blast first (the higher of two equally near), up to
 * `MAX_THROWN`. The same ship and spot always give the same list, in ship order.
 */
export function blastPiecesOf(
  ship: Ship,
  impactX: number,
  occupancy: Occupancy = buildOccupancy(ship)
): BlastPiece[] {
  const middles = new Map<string, { x: number; level: number; z: number }>();
  for (const part of ship.parts) {
    const middle = middleOf(ship, part, occupancy);
    if (middle) middles.set(part.id, middle);
  }

  // What rests on each part: things fixed to it, and blocks above it.
  const columns = new Map<string, { id: string; level: number }[]>();
  for (const part of ship.parts) {
    for (const cell of partCells(part)) {
      const key = `${cell.x}:${cell.z}`;
      const list = columns.get(key) ?? [];
      list.push({ id: part.id, level: cell.level });
      columns.set(key, list);
    }
  }
  const resting = new Map<string, Set<string>>();
  const restsOn = (baseId: string, id: string) => {
    if (baseId === id) return;
    const set = resting.get(baseId) ?? new Set<string>();
    set.add(id);
    resting.set(baseId, set);
  };
  for (const part of ship.parts) {
    if (part.anchor.kind === "attach") restsOn(part.anchor.parentId, part.id);
    for (const cell of partCells(part)) {
      for (const above of columns.get(`${cell.x}:${cell.z}`) ?? []) {
        if (above.level > cell.level) restsOn(part.id, above.id);
      }
    }
  }

  const candidates = ship.parts.filter((part) => {
    const middle = middles.get(part.id);
    return !!middle && Math.abs(middle.x - impactX) <= BLAST_REACH;
  });
  const order = (id: string) => {
    const middle = middles.get(id)!;
    return Math.abs(middle.x - impactX) * 100 - middle.level;
  };
  const thrown = new Set<string>();
  while (thrown.size < MAX_THROWN) {
    let best: string | null = null;
    for (const part of candidates) {
      if (thrown.has(part.id)) continue;
      const above = resting.get(part.id);
      if (above && [...above].some((id) => !thrown.has(id))) continue;
      if (best === null || order(part.id) < order(best)) best = part.id;
    }
    if (best === null) break;
    thrown.add(best);
  }

  const pieces: BlastPiece[] = [];
  for (const part of ship.parts) {
    const middle = middles.get(part.id);
    if (!thrown.has(part.id) || !middle) continue;
    pieces.push({ partId: part.id, ...middle });
  }
  return pieces;
}
