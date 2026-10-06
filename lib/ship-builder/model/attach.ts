import { getPartDef } from "./catalog";
import {
  beamOf,
  cellKey,
  gridLength,
  isDecor,
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
  type PointProvider,
  type PlacedPart,
  type Ship,
  type Side,
  type Vec3,
} from "./types";
import { occupancyOf } from "./occupancyCache";
import { partAt, partById } from "./partIndex";

const DAVIT_HEIGHT = 0.8;
/** Height of a bridge above its level (see BRIDGE_HEIGHT in PartMesh). */
const BRIDGE_ROOF = 0.8;
/** Festoon lights hang this fraction of the way up a mast or funnel. */
const STRING_FRACTION = 0.85;
/** Underwater lights sit this far below the main deck (model y). */
export const UNDERWATER_MOUNT_Y = -1.8;
/** Underwater lights are spaced this many cells apart along each side. */
const UNDERWATER_SPACING = 2;
/** A mast's searchlight sits this far below its top. */
const MAST_LIGHT_DROP = 0.4;
/** A crow's nest sits this far up a mast, as a fraction of its height. */
const NEST_FRACTION = 0.6;
/** The stern flagpole stands this fraction of the stern's length aft. */
const FLAG_SETBACK = 0.8;
const DAVIT_REACH = 0.6;
/**
 * Sail spots on a wooden mast, lowest first. The lowest yard sits clear of the
 * deck for the tallest sail (2.0 high) to hang under it; the highest sits at
 * this fraction of the mast and the rest spread evenly between, so a main
 * mast's three sails clear each other.
 */
const SAIL_BASE_Y = 2.3;
const SAIL_TOP_FRACTION = 0.74;
/** A wooden mast's crow's nest sits above its highest yard. */
const WOOD_NEST_FRACTION = 0.88;
/**
 * The masthead flag base sits this far above the mast top, so it clears an
 * aerial at the same top and rests on a wooden mast's cap.
 */
const MASTHEAD_RISE = 0.1;
/** How far a helipad's surface rises above the deck tops it sits on. */
const HELIPAD_THICKNESS = 0.15;
/** The freefall boat sits this far forward of the stern tip's midpoint. */
const FREEFALL_SETBACK = 0.6;

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
/** Shared by davit and edge points, so one cell edge holds only one. */
const edgeClaim = (cell: Cell) => `edge:${cell.level}:${cell.x}:${cell.z}`;
const davitClaim = (davitId: string) => `davit:${davitId}`;

/**
 * Spots for underwater lights: every other cell along each side, keeping one
 * cell clear at each end like the portholes. Starboard is model z 0, port is
 * z = beam.
 */
function underwaterPoints(ship: Ship): AttachPoint[] {
  const length = gridLength(ship);
  const beam = beamOf(ship);
  const points: AttachPoint[] = [];
  for (let cell = 1; cell < length - 1; cell += UNDERWATER_SPACING) {
    for (const side of ["starboard", "port"] as const) {
      points.push({
        id: `uw:${side}:${cell}`,
        type: "hull-light-mount",
        position: {
          x: cell + 0.5,
          y: UNDERWATER_MOUNT_Y,
          z: side === "starboard" ? 0 : beam,
        },
        side,
      });
    }
  }
  return points;
}

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
    ...underwaterPoints(ship),
    {
      id: "rudder",
      type: "rudder-mount",
      position: { x: length + RUDDER_OFFSET, y: PROP_MOUNT_Y, z: centerline },
    },
    {
      id: "freefall",
      type: "freefall-mount",
      position: {
        x: length + sternLength(ship.hull.stern) / 2 - FREEFALL_SETBACK,
        y: 0,
        z: centerline,
      },
    },
    {
      id: "flag",
      type: "flag-mount",
      position: {
        x: length + sternLength(ship.hull.stern) * FLAG_SETBACK,
        y: 0,
        z: centerline,
      },
    },
    {
      id: "figurehead",
      type: "bow-mount",
      position: { x: -bowLength(ship.hull.bow) * 0.9, y: 0.4, z: centerline },
    },
    {
      id: "jib",
      type: "bow-mount",
      position: { x: -bowLength(ship.hull.bow) * 0.75, y: 0.9, z: centerline },
    },
    {
      id: "bowgun",
      type: "bow-mount",
      position: { x: -bowLength(ship.hull.bow) * 0.35, y: 0.3, z: centerline },
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
    const occupant = occupancy.get(cellKey({ level, x, z }));
    // Decor rides on a block; it doesn't widen a row's edge.
    if (!occupant || isDecor(occupant)) continue;
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
  // Cargo is plain stackable boxes: nothing mounts on or beside it.
  if (def.role === "cargo") return [];
  // Decor exposes no points: nothing mounts on or beside it either.
  if (def.role === "decor") return [];
  const { level, x, z } = part.anchor;
  if (def.role === "bridge") {
    const size = rotatedFootprint(def.footprint, part.rotation);
    const roof = {
      x: x + size.x / 2,
      y: level + BRIDGE_ROOF,
      z: z + size.z / 2,
    };
    return [
      { id: "light", type: "searchlight-mount", position: roof },
      { id: "nav", type: "nav-mount", position: roof },
    ];
  }
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

  if (def.role === "deck" || def.role === "cabin") {
    for (const cell of partCells(part)) {
      const covered = occupancy.has(
        cellKey({ ...cell, level: cell.level + 1 })
      );
      if (covered) continue;
      const side = davitSide(ship, occupancy, cell);
      if (!side) continue;
      const position = {
        x: cell.x + 0.5,
        y: level + 1,
        // On the cell's outward face.
        z: side === "starboard" ? cell.z : cell.z + 1,
      };
      const claims = [edgeClaim(cell)];
      points.push(
        {
          id: `davit:${cell.x}:${cell.z}`,
          type: "davit-point",
          position,
          side,
          claims,
        },
        {
          id: `edge:${cell.x}:${cell.z}`,
          type: "edge-mount",
          position,
          side,
          claims,
        }
      );
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

/** The mast heights a mast-like part has, or undefined for anything else. */
function mastHeight(part: PlacedPart): number | undefined {
  const def = getPartDef(part.type);
  return def.placement === "attach" && def.exposes === "mast"
    ? def.height
    : undefined;
}

function exposesFunnelPoints(part: PlacedPart): boolean {
  const def = getPartDef(part.type);
  return def.placement === "attach" && def.exposes === "funnel";
}

/** Height of anything lights can be strung from: a mast or a funnel. */
function poleHeight(part: PlacedPart): number | undefined {
  return exposesFunnelPoints(part)
    ? getPartDef(part.type).height
    : mastHeight(part);
}

/** The top of the other mast nearest to this one, if there is one. */
function nearestOtherMastTop(
  ship: Ship,
  mast: PlacedPart,
  base: Vec3,
  occupancy: Occupancy,
  heightOf: (part: PlacedPart) => number | undefined = mastHeight,
  fraction = 1
): Vec3 | undefined {
  let nearest: Vec3 | undefined;
  let nearestDistance = Infinity;
  for (const other of ship.parts) {
    const height = heightOf(other);
    if (height === undefined || other.id === mast.id) continue;
    if (other.anchor.kind !== "attach") continue;
    const point = resolveAttachPoint(ship, other.anchor, occupancy);
    if (!point) continue;
    const distance =
      Math.abs(point.position.x - base.x) + Math.abs(point.position.z - base.z);
    if (distance >= nearestDistance) continue;
    nearestDistance = distance;
    nearest = { ...point.position, y: point.position.y + height * fraction };
  }
  return nearest;
}

/**
 * Where a wireless aerial on this mast strings its wires: the top of the
 * nearest other mast, in model space. Undefined when there is none.
 */
export function aerialTarget(
  ship: Ship,
  mast: PlacedPart,
  occupancy: Occupancy = occupancyOf(ship)
): Vec3 | undefined {
  if (mast.anchor.kind !== "attach" || mastHeight(mast) === undefined) {
    return undefined;
  }
  const base = resolveAttachPoint(ship, mast.anchor, occupancy);
  return base && nearestOtherMastTop(ship, mast, base.position, occupancy);
}

/**
 * Where string lights on this mast or funnel end: the lighting height of the
 * nearest other mast or funnel, in model space. Undefined when there is none.
 */
export function stringTarget(
  ship: Ship,
  pole: PlacedPart,
  occupancy: Occupancy = occupancyOf(ship)
): Vec3 | undefined {
  if (pole.anchor.kind !== "attach" || poleHeight(pole) === undefined) {
    return undefined;
  }
  const base = resolveAttachPoint(ship, pole.anchor, occupancy);
  return (
    base &&
    nearestOtherMastTop(
      ship,
      pole,
      base.position,
      occupancy,
      poleHeight,
      STRING_FRACTION
    )
  );
}

function stringPoint(base: Vec3, height: number): AttachPoint {
  return {
    id: "string",
    type: "string-mount",
    position: { ...base, y: base.y + height * STRING_FRACTION },
  };
}

/** A funnel's only point: where festoon lights hang, if another pole exists. */
function funnelPoints(
  ship: Ship,
  part: PlacedPart,
  occupancy: Occupancy
): AttachPoint[] {
  const height = poleHeight(part);
  if (part.anchor.kind !== "attach" || height === undefined) return [];
  const base = resolveAttachPoint(ship, part.anchor, occupancy);
  if (!base || !stringTarget(ship, part, occupancy)) return [];
  return [stringPoint(base.position, height)];
}

function sailSpotY(height: number, slots: number, index: number): number {
  if (slots < 2) return SAIL_BASE_Y;
  const top = height * SAIL_TOP_FRACTION;
  return SAIL_BASE_Y + ((top - SAIL_BASE_Y) * index) / (slots - 1);
}

/**
 * A mast exposes a searchlight point near its top and, on a plain mast, a
 * crow's nest point; either kind exposes an aerial point while another mast
 * exists to string wires to. A wooden mast also exposes one sail spot per
 * slot and a masthead for the flag.
 */
function mastPoints(
  ship: Ship,
  part: PlacedPart,
  height: number,
  occupancy: Occupancy
): AttachPoint[] {
  if (part.anchor.kind !== "attach") return [];
  const base = resolveAttachPoint(ship, part.anchor, occupancy);
  if (!base) return [];
  const at = (y: number): Vec3 => ({
    ...base.position,
    y: base.position.y + y,
  });
  const points: AttachPoint[] = [
    {
      id: "light",
      type: "searchlight-mount",
      position: at(height - MAST_LIGHT_DROP),
    },
  ];
  const mastDef = getPartDef(part.type);
  const slots = mastDef.placement === "attach" ? (mastDef.sailSlots ?? 0) : 0;
  for (let i = 0; i < slots; i++) {
    points.push({
      id: `sail:${i}`,
      type: "sail-mount",
      position: at(sailSpotY(height, slots, i)),
    });
  }
  if (slots > 0) {
    points.push({
      id: "masthead",
      type: "masthead-mount",
      position: at(height + MASTHEAD_RISE),
    });
  }
  if (getPartDef(part.type).placement === "attach" && hasCrowsNest(part)) {
    points.push({
      id: "nest",
      type: "nest-mount",
      position: at(height * (slots > 0 ? WOOD_NEST_FRACTION : NEST_FRACTION)),
    });
  }
  if (nearestOtherMastTop(ship, part, base.position, occupancy)) {
    points.push({ id: "aerial", type: "aerial-mount", position: at(height) });
  }
  if (stringTarget(ship, part, occupancy)) {
    points.push(stringPoint(base.position, height));
  }
  return points;
}

function hasCrowsNest(part: PlacedPart): boolean {
  const def = getPartDef(part.type);
  return def.placement === "attach" && def.hasCrowsNest === true;
}

/** A placed helipad exposes one point, at its centre top, for a helicopter. */
function helipadPoints(
  ship: Ship,
  part: PlacedPart,
  occupancy: Occupancy
): AttachPoint[] {
  if (part.anchor.kind !== "attach") return [];
  const base = resolveAttachPoint(ship, part.anchor, occupancy);
  if (!base) return [];
  return [
    {
      id: "heli",
      type: "heli-mount",
      position: { ...base.position, y: base.position.y + HELIPAD_THICKNESS },
    },
  ];
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
  if (!davit || !isDavit(davit) || davit.anchor.kind !== "attach") {
    return undefined;
  }
  const point = resolveAttachPoint(ship, davit.anchor, occupancy);
  return isNextDavit(base, point) ? davit : undefined;
}

function isDavit(part: PlacedPart): boolean {
  const def = getPartDef(part.type);
  return def.placement === "attach" && def.exposes === "davit";
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

/** How each kind of point-offering part works out its points. */
const POINT_PROVIDERS: Record<
  PointProvider,
  (ship: Ship, part: PlacedPart, occupancy: Occupancy) => AttachPoint[]
> = {
  davit: davitPoints,
  helipad: helipadPoints,
  funnel: funnelPoints,
  mast: (ship, part, occupancy) =>
    mastPoints(ship, part, mastHeight(part) ?? 0, occupancy),
};

/** Every attach point a parent currently exposes, taken or not. */
export function attachPointsOf(
  ship: Ship,
  parentId: string,
  occupancy: Occupancy = occupancyOf(ship)
): AttachPoint[] {
  if (parentId === HULL_ID) return hullPoints(ship);
  const part = partById(ship, parentId);
  if (!part) return [];
  const def = getPartDef(part.type);
  const provider = def.placement === "attach" ? def.exposes : undefined;
  if (provider) return POINT_PROVIDERS[provider](ship, part, occupancy);
  return blockPoints(ship, part, occupancy);
}

export function resolveAttachPoint(
  ship: Ship,
  anchor: AttachAnchor,
  occupancy: Occupancy = occupancyOf(ship)
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
  occupancy: Occupancy = occupancyOf(ship)
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

/** What openAttachPoints reads from the ship; analyzeShip caches it. */
export interface PointSource {
  claimed: ReadonlySet<string>;
  pointsOf(parentId: string): AttachPoint[];
}

function uncachedPointSource(ship: Ship): PointSource {
  const occupancy = occupancyOf(ship);
  return {
    claimed: claimedKeys(ship, occupancy),
    pointsOf: (parentId) => attachPointsOf(ship, parentId, occupancy),
  };
}

/** Free points this attach part could go on right now. */
export function openAttachPoints(
  ship: Ship,
  def: AttachPartDef,
  source: PointSource = uncachedPointSource(ship)
): { parentId: string; point: AttachPoint }[] {
  const parentIds = [HULL_ID, ...ship.parts.map((part) => part.id)];
  return parentIds.flatMap((parentId) =>
    source
      .pointsOf(parentId)
      .filter(
        (point) =>
          pointFitsPart(def, point) &&
          !overlapsClaims(parentId, point, source.claimed)
      )
      .map((point) => ({ parentId, point }))
  );
}
