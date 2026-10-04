import { getPartDef } from "./catalog";
import {
  beamOf,
  buildOccupancy,
  cellKey,
  gridLength,
  partCells,
  rotatedFootprint,
  WING_REACH,
  type Occupancy,
} from "./grid";
import {
  HULL_ID,
  type AttachAnchor,
  type AttachPartDef,
  type AttachPoint,
  type Cell,
  type PlacedPart,
  type Ship,
  type Side,
} from "./types";

/** Prow extends forward of x = 0; stern extends aft of the last cell. */
export const PROW_LENGTH = 2;
export const STERN_LENGTH = 1.5;
const DAVIT_HEIGHT = 0.8;
const DAVIT_REACH = 0.6;

function hullPoints(ship: Ship): AttachPoint[] {
  const length = gridLength(ship);
  const centerline = beamOf(ship) / 2;
  return [
    {
      id: "mast-fore",
      type: "mast-mount",
      position: { x: -PROW_LENGTH / 2, y: 0, z: centerline },
    },
    {
      id: "mast-aft",
      type: "mast-mount",
      position: { x: length + STERN_LENGTH / 2, y: 0, z: centerline },
    },
  ];
}

/** Lowest and highest occupied z in one row (same level and x), if any. */
export function rowExtent(
  ship: Ship,
  occupancy: Occupancy,
  level: number,
  x: number
): { min: number; max: number } | undefined {
  let extent: { min: number; max: number } | undefined;
  for (let z = -WING_REACH; z <= beamOf(ship) - 1 + WING_REACH; z++) {
    if (!occupancy.has(cellKey({ level, x, z }))) continue;
    extent = { min: extent?.min ?? z, max: z };
  }
  return extent;
}

/**
 * The side whose davit a cell would carry: it must be the outermost occupied
 * cell of its row on that side, at or past that hull edge.
 */
export function davitSide(
  ship: Ship,
  occupancy: Occupancy,
  cell: Cell
): Side | undefined {
  const extent = rowExtent(ship, occupancy, cell.level, cell.x);
  if (!extent) return undefined;
  if (cell.z === extent.min && cell.z <= 0) return "starboard";
  if (cell.z === extent.max && cell.z >= beamOf(ship) - 1) return "port";
  return undefined;
}

function isCovered(part: PlacedPart, occupancy: Occupancy): boolean {
  return partCells(part).some((cell) =>
    occupancy.has(cellKey({ ...cell, level: cell.level + 1 }))
  );
}

function blockPoints(
  ship: Ship,
  part: PlacedPart,
  occupancy: Occupancy
): AttachPoint[] {
  const def = getPartDef(part.type);
  if (def.placement !== "grid" || part.anchor.kind !== "grid") return [];
  const { level, x, z } = part.anchor;
  const points: AttachPoint[] = [];

  if (def.role === "deck" && !isCovered(part, occupancy)) {
    const size = rotatedFootprint(def.footprint, part.rotation);
    points.push({
      id: "funnel",
      type: "funnel-mount",
      position: { x: x + size.x / 2, y: level + 1, z: z + size.z / 2 },
    });
  }

  if (def.role !== "bridge" && level >= 1) {
    for (const cell of partCells(part)) {
      const covered = occupancy.has(
        cellKey({ ...cell, level: cell.level + 1 })
      );
      if (covered) continue;
      const side = davitSide(ship, occupancy, cell);
      if (!side) continue;
      points.push({
        id: `davit:${cell.x}:${cell.z}`,
        type: "davit-point",
        position: {
          x: cell.x + 0.5,
          y: level + 1,
          // On the cell's outward face.
          z: side === "starboard" ? cell.z : cell.z + 1,
        },
        side,
      });
    }
  }

  return points;
}

function davitPoints(
  ship: Ship,
  part: PlacedPart,
  occupancy: Occupancy
): AttachPoint[] {
  if (part.anchor.kind !== "attach") return [];
  const base = resolveAttachPoint(ship, part.anchor, occupancy);
  if (!base) return [];
  // Starboard is low z, so outboard is -z there and +z on the port side.
  const outward = base.side === "starboard" ? -1 : 1;
  return [
    {
      id: "boat",
      type: "boat-mount",
      position: {
        x: base.position.x,
        y: base.position.y + DAVIT_HEIGHT,
        z: base.position.z + outward * DAVIT_REACH,
      },
      side: base.side,
    },
  ];
}

/** Every attach point a parent currently exposes, taken or not. */
export function attachPointsOf(
  ship: Ship,
  parentId: string,
  occupancy: Occupancy = buildOccupancy(ship)
): AttachPoint[] {
  if (parentId === HULL_ID) return hullPoints(ship);
  const part = ship.parts.find((p) => p.id === parentId);
  if (!part) return [];
  if (part.type === "davit") return davitPoints(ship, part, occupancy);
  return blockPoints(ship, part, occupancy);
}

export function resolveAttachPoint(
  ship: Ship,
  anchor: AttachAnchor,
  occupancy: Occupancy = buildOccupancy(ship)
): AttachPoint | undefined {
  return attachPointsOf(ship, anchor.parentId, occupancy).find(
    (point) => point.id === anchor.pointId
  );
}

export function isPointTaken(
  ship: Ship,
  parentId: string,
  pointId: string
): boolean {
  return ship.parts.some(
    (part) =>
      part.anchor.kind === "attach" &&
      part.anchor.parentId === parentId &&
      part.anchor.pointId === pointId
  );
}

export function pointFitsPart(def: AttachPartDef, point: AttachPoint): boolean {
  return (
    point.type === def.attachTo &&
    (!def.allowedPointIds || def.allowedPointIds.includes(point.id))
  );
}

/** Free points this attach part could go on right now. */
export function openAttachPoints(
  ship: Ship,
  def: AttachPartDef
): { parentId: string; point: AttachPoint }[] {
  const occupancy = buildOccupancy(ship);
  const parentIds = [HULL_ID, ...ship.parts.map((part) => part.id)];
  return parentIds.flatMap((parentId) =>
    attachPointsOf(ship, parentId, occupancy)
      .filter(
        (point) =>
          pointFitsPart(def, point) && !isPointTaken(ship, parentId, point.id)
      )
      .map((point) => ({ parentId, point }))
  );
}
