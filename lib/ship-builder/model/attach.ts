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
import { bowLength, sternLength } from "./hullEnds";
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
import { partAt, partById } from "./partIndex";

const DAVIT_HEIGHT = 0.8;
const DAVIT_REACH = 0.6;

/** Model y of a propeller shaft: below the keel (deck is y 0, keel ≈ −2.8). */
export const PROP_MOUNT_Y = -3.1;
/** Propellers sit this far forward of the hull's last cell. */
const PROP_SETBACK = 0.5;
/** The rudder hangs this far aft of the hull's last cell, behind the props. */
const RUDDER_OFFSET = 0.2;

export function propCount(beam: number): number {
  if (beam <= 3) return 2;
  return beam === 4 ? 3 : 4;
}

/** The resources a point occupies; see AttachPoint.claims. */
export function claimsOf(parentId: string, point: AttachPoint): string[] {
  return point.claims ?? [`${parentId}/${point.id}`];
}

const topClaim = (cell: Cell) => `top:${cell.level}:${cell.x}:${cell.z}`;
const davitClaim = (davitId: string) => `davit:${davitId}`;

function hullPoints(ship: Ship): AttachPoint[] {
  const length = gridLength(ship);
  const beam = beamOf(ship);
  const centerline = beam / 2;
  const props = propCount(beam);
  const propellers: AttachPoint[] = Array.from({ length: props }, (_, i) => ({
    id: `prop:${i}`,
    type: "prop-mount",
    position: {
      x: length - PROP_SETBACK,
      y: PROP_MOUNT_Y,
      z: (beam * (i + 1)) / (props + 1),
    },
  }));
  return [
    {
      id: "mast-fore",
      type: "mast-mount",
      position: { x: -bowLength(ship.hull.bow) / 2, y: 0, z: centerline },
    },
    {
      id: "mast-aft",
      type: "mast-mount",
      position: {
        x: length + sternLength(ship.hull.stern) / 2,
        y: 0,
        z: centerline,
      },
    },
    ...propellers,
    {
      id: "rudder",
      type: "rudder-mount",
      position: { x: length + RUDDER_OFFSET, y: PROP_MOUNT_Y, z: centerline },
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

/** Whether the cell holds an uncovered deck-role block. */
function isOpenDeckTop(occupancy: Occupancy, cell: Cell): boolean {
  const occupant = occupancy.get(cellKey(cell));
  if (!occupant) return false;
  const def = getPartDef(occupant.type);
  if (def.placement !== "grid" || def.role !== "deck") return false;
  return !occupancy.has(cellKey({ ...cell, level: cell.level + 1 }));
}

/**
 * One point per 2×2 square of open deck tops whose lowest-x, lowest-z corner
 * belongs to this block, so each square is exposed exactly once.
 */
function largeFunnelPoints(
  part: PlacedPart,
  occupancy: Occupancy
): AttachPoint[] {
  const points: AttachPoint[] = [];
  for (const c of partCells(part)) {
    const square: Cell[] = [
      c,
      { ...c, x: c.x + 1 },
      { ...c, z: c.z + 1 },
      { ...c, x: c.x + 1, z: c.z + 1 },
    ];
    if (!square.every((cell) => isOpenDeckTop(occupancy, cell))) continue;
    points.push({
      id: `funnel-lg:${c.x}:${c.z}`,
      type: "large-funnel-mount",
      position: { x: c.x + 1, y: c.level + 1, z: c.z + 1 },
      claims: square.map(topClaim),
    });
  }
  return points;
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
    const position = { x: x + size.x / 2, y: level + 1, z: z + size.z / 2 };
    const claims = partCells(part).map(topClaim);
    points.push(
      { id: "funnel", type: "funnel-mount", position, claims },
      { id: "mast", type: "mast-mount", position, claims }
    );
  }

  if (def.role === "deck") points.push(...largeFunnelPoints(part, occupancy));

  if (def.role !== "bridge") {
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
  const y = base.position.y + DAVIT_HEIGHT;
  const z = base.position.z + outward * DAVIT_REACH;
  const points: AttachPoint[] = [
    {
      id: "boat",
      type: "boat-mount",
      position: { x: base.position.x, y, z },
      side: base.side,
      claims: [davitClaim(part.id)],
    },
  ];
  const neighbour = nextDavit(ship, part.anchor, base, occupancy);
  if (neighbour) {
    points.push({
      id: "big-boat",
      type: "big-boat-mount",
      position: { x: base.position.x + 0.5, y, z },
      side: base.side,
      claims: [davitClaim(part.id), davitClaim(neighbour.id)],
    });
  }
  return points;
}

/**
 * The davit one cell aft of this one on the same edge, if any. Looks only at
 * the neighbouring cell, so finding big-boat points stays linear in davits.
 */
function nextDavit(
  ship: Ship,
  anchor: AttachAnchor,
  base: AttachPoint,
  occupancy: Occupancy
): PlacedPart | undefined {
  const parent = partById(ship, anchor.parentId);
  if (!parent || parent.anchor.kind !== "grid") return undefined;
  const [, x, z] = anchor.pointId.split(":").map(Number);
  const block = occupancy.get(
    cellKey({ level: parent.anchor.level, x: x + 1, z })
  );
  if (!block) return undefined;
  const davit = partAt(ship, block.id, `davit:${x + 1}:${z}`);
  if (davit?.type !== "davit" || davit.anchor.kind !== "attach") {
    return undefined;
  }
  const point = resolveAttachPoint(ship, davit.anchor, occupancy);
  return isNextDavit(base, point) ? davit : undefined;
}

/** Same side, level and edge, one cell further aft. */
function isNextDavit(
  base: AttachPoint,
  other: AttachPoint | undefined
): boolean {
  return (
    other !== undefined &&
    other.side === base.side &&
    other.position.y === base.position.y &&
    other.position.z === base.position.z &&
    other.position.x === base.position.x + 1
  );
}

/** Every attach point a parent currently exposes, taken or not. */
export function attachPointsOf(
  ship: Ship,
  parentId: string,
  occupancy: Occupancy = buildOccupancy(ship)
): AttachPoint[] {
  if (parentId === HULL_ID) return hullPoints(ship);
  const part = partById(ship, parentId);
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

/** The claims one placed part holds; empty for grid parts. */
export function claimsOfPart(
  ship: Ship,
  part: PlacedPart,
  occupancy: Occupancy
): string[] {
  if (part.anchor.kind !== "attach") return [];
  const point = resolveAttachPoint(ship, part.anchor, occupancy);
  return point ? claimsOf(part.anchor.parentId, point) : [];
}

/** Every claim held by a placed attach part. */
export function claimedKeys(ship: Ship, occupancy: Occupancy): Set<string> {
  const claimed = new Set<string>();
  for (const part of ship.parts) {
    for (const key of claimsOfPart(ship, part, occupancy)) claimed.add(key);
  }
  return claimed;
}

export function overlapsClaims(
  parentId: string,
  point: AttachPoint,
  claimed: ReadonlySet<string>
): boolean {
  return claimsOf(parentId, point).some((key) => claimed.has(key));
}

export function isPointTaken(
  ship: Ship,
  parentId: string,
  pointId: string,
  occupancy: Occupancy = buildOccupancy(ship)
): boolean {
  const anchor: AttachAnchor = { kind: "attach", parentId, pointId };
  const point = resolveAttachPoint(ship, anchor, occupancy);
  if (!point) return false;
  return overlapsClaims(parentId, point, claimedKeys(ship, occupancy));
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
  const claimed = claimedKeys(ship, occupancy);
  const parentIds = [HULL_ID, ...ship.parts.map((part) => part.id)];
  return parentIds.flatMap((parentId) =>
    attachPointsOf(ship, parentId, occupancy)
      .filter(
        (point) =>
          pointFitsPart(def, point) && !overlapsClaims(parentId, point, claimed)
      )
      .map((point) => ({ parentId, point }))
  );
}
