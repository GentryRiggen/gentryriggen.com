import { getPartDef } from "./catalog";
import type {
  Cell,
  GridAnchor,
  GridPartDef,
  PlacedPart,
  Rotation,
  Ship,
} from "./types";

export const CELLS_PER_SEGMENT = 3;
export const MIN_BEAM = 3;
export const MAX_BEAM = 7;
export const DEFAULT_BEAM = 4;
/**
 * @deprecated The default beam only; ships have their own width. Use
 * `beamOf(ship)`.
 */
export const GRID_WIDTH = DEFAULT_BEAM;
/** Wing columns allowed past each hull edge. */
export const WING_REACH = 2;
export const MAX_LEVEL = 3;
export const MIN_SEGMENTS = 4;
export const MAX_SEGMENTS = 12;

/** Cell key → the grid part occupying it. */
export type Occupancy = Map<string, PlacedPart>;

export function gridLength(ship: Ship): number {
  return ship.hull.lengthSegments * CELLS_PER_SEGMENT;
}

export function beamOf(ship: Ship): number {
  return ship.hull.beam;
}

export function cellKey(cell: Cell): string {
  return `${cell.level}:${cell.x}:${cell.z}`;
}

export function rotatedFootprint(
  footprint: { x: number; z: number },
  rotation: Rotation
): { x: number; z: number } {
  return rotation === 90 || rotation === 270
    ? { x: footprint.z, z: footprint.x }
    : footprint;
}

export function footprintCells(
  def: GridPartDef,
  anchor: GridAnchor,
  rotation: Rotation
): Cell[] {
  const size = rotatedFootprint(def.footprint, rotation);
  const cells: Cell[] = [];
  for (let dx = 0; dx < size.x; dx++) {
    for (let dz = 0; dz < size.z; dz++) {
      cells.push({ level: anchor.level, x: anchor.x + dx, z: anchor.z + dz });
    }
  }
  return cells;
}

export function partCells(part: PlacedPart): Cell[] {
  const def = getPartDef(part.type);
  if (def.placement !== "grid" || part.anchor.kind !== "grid") return [];
  return footprintCells(def, part.anchor, part.rotation);
}

function inLevelsAndLength(ship: Ship, cell: Cell): boolean {
  return (
    cell.level >= 0 &&
    cell.level <= MAX_LEVEL &&
    cell.x >= 0 &&
    cell.x < gridLength(ship)
  );
}

/** Inside the hull or in a wing column, which may reach past either edge. */
export function inBounds(ship: Ship, cell: Cell): boolean {
  return (
    inLevelsAndLength(ship, cell) &&
    cell.z >= -WING_REACH &&
    cell.z <= beamOf(ship) - 1 + WING_REACH
  );
}

/** Over the hull itself (0 <= z < beam), as opposed to a wing cell. */
export function isInsideHull(ship: Ship, cell: Cell): boolean {
  return inLevelsAndLength(ship, cell) && cell.z >= 0 && cell.z < beamOf(ship);
}

export function isForwardHalf(ship: Ship, x: number): boolean {
  return x < gridLength(ship) / 2;
}

export function buildOccupancy(ship: Ship): Occupancy {
  const occupancy: Occupancy = new Map();
  for (const part of ship.parts) {
    for (const cell of partCells(part)) occupancy.set(cellKey(cell), part);
  }
  return occupancy;
}

/** Highest occupied level in a column, or -1 when the column is empty. */
export function topLevel(occupancy: Occupancy, x: number, z: number): number {
  for (let level = MAX_LEVEL; level >= 0; level--) {
    if (occupancy.has(cellKey({ level, x, z }))) return level;
  }
  return -1;
}
