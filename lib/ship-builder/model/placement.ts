import {
  attachPointsOf,
  claimedKeys,
  claimsOf,
  claimsOfPart,
  overlapsClaims,
  pointFitsPart,
  resolveAttachPoint,
  rowExtent,
} from "./attach";
import { ATTACH_POINT_LABELS, getPartDef } from "./catalog";
import {
  buildOccupancy,
  beamOf,
  cellKey,
  DEFAULT_BEAM,
  footprintCells,
  inBounds,
  isForwardHalf,
  MAX_BEAM,
  MAX_SEGMENTS,
  MIN_BEAM,
  MIN_SEGMENTS,
  partCells,
  type Occupancy,
} from "./grid";
import {
  isGrounded,
  MAX_OVERHANG,
  neighbours,
  stepsToSupport,
  supportMap,
  type SupportMap,
} from "./support";
import {
  HULL_ID,
  type AttachPartDef,
  type Cell,
  type GridPartDef,
  type Hull,
  type PlacedPart,
  type Ship,
} from "./types";

export type RuleResult = { ok: true } | { ok: false; reason: string };
export type PartCandidate = Omit<PlacedPart, "id">;

export const MAX_NAME_LENGTH = 60;

/**
 * Truncates to MAX_NAME_LENGTH without splitting a surrogate pair. The schema
 * counts UTF-16 units, so astral characters (emoji) are dropped whole until
 * the result fits that limit too.
 */
export function clampName(name: string): string {
  const codePoints = Array.from(name).slice(0, MAX_NAME_LENGTH);
  let length = codePoints.reduce((sum, char) => sum + char.length, 0);
  while (length > MAX_NAME_LENGTH) {
    const dropped = codePoints.pop();
    if (dropped === undefined) break;
    length -= dropped.length;
  }
  return codePoints.join("");
}
export const DEFAULT_SEGMENTS = 8;

const OK: RuleResult = { ok: true };
const fail = (reason: string): RuleResult => ({ ok: false, reason });

export function emptyShip(
  name = "Untitled liner",
  lengthSegments = DEFAULT_SEGMENTS,
  beam = DEFAULT_BEAM
): Ship {
  return { v: 2, name, hull: { lengthSegments, beam }, parts: [] };
}

/** Whether a small or large funnel stands on the cell directly below. */
function isUnderFunnel(ship: Ship, cell: Cell, occupancy: Occupancy): boolean {
  const belowKey = `top:${cell.level - 1}:${cell.x}:${cell.z}`;
  return ship.parts.some((part) => {
    if (part.anchor.kind !== "attach") return false;
    const def = getPartDef(part.type);
    if (def.placement !== "attach") return false;
    if (
      def.attachTo !== "funnel-mount" &&
      def.attachTo !== "large-funnel-mount"
    ) {
      return false;
    }
    const point = resolveAttachPoint(ship, part.anchor, occupancy);
    return (
      point !== undefined &&
      claimsOf(part.anchor.parentId, point).includes(belowKey)
    );
  });
}

function holdsDavitAt(
  ship: Ship,
  block: PlacedPart,
  x: number,
  z: number
): boolean {
  return ship.parts.some(
    (p) =>
      p.type === "davit" &&
      p.anchor.kind === "attach" &&
      p.anchor.parentId === block.id &&
      p.anchor.pointId === `davit:${x}:${z}`
  );
}

/**
 * A davit sits on the outermost cell of its row, so a cell placed further out
 * on that side would leave it stranded.
 */
function isOutboardOfDavit(
  ship: Ship,
  cell: Cell,
  occupancy: Occupancy
): boolean {
  const extent = rowExtent(ship, occupancy, cell.level, cell.x);
  if (!extent) return false;
  const holdsDavit = (edgeZ: number) => {
    const edge = occupancy.get(cellKey({ ...cell, z: edgeZ }));
    return edge !== undefined && holdsDavitAt(ship, edge, cell.x, edgeZ);
  };
  if (cell.z < extent.min && extent.min <= 0) return holdsDavit(extent.min);
  if (cell.z > extent.max && extent.max >= beamOf(ship) - 1) {
    return holdsDavit(extent.max);
  }
  return false;
}

/**
 * Every candidate cell must be within MAX_OVERHANG steps of a grounded cell,
 * walking through the ship's cells plus the candidate's own.
 */
function checkSupport(
  ship: Ship,
  cells: Cell[],
  occupancy: Occupancy
): RuleResult {
  const own = new Set(cells.map(cellKey));
  const isOccupied = (key: string) => occupancy.has(key) || own.has(key);
  const isHeld = cells.every(
    (cell) =>
      stepsToSupport(ship, isOccupied, cell, MAX_OVERHANG) <= MAX_OVERHANG
  );
  if (isHeld) return OK;
  const touchesShip = cells.some(
    (cell) =>
      isGrounded(ship, occupancy, cell) ||
      neighbours(cell).some((n) => occupancy.has(cellKey(n)))
  );
  return touchesShip
    ? fail("Too far from a support (max 2 cells)")
    : fail("Needs a deck beneath every cell");
}

function canPlaceGrid(
  ship: Ship,
  def: GridPartDef,
  candidate: PartCandidate,
  occupancy: Occupancy
): RuleResult {
  if (candidate.anchor.kind !== "grid") {
    return fail("Place this on the deck grid");
  }
  const cells = footprintCells(def, candidate.anchor, candidate.rotation);

  if (cells.some((cell) => !inBounds(ship, cell))) {
    return fail("Outside the hull");
  }
  if (cells.some((cell) => occupancy.has(cellKey(cell)))) {
    return fail("That space is taken");
  }

  for (const cell of cells) {
    if (cell.level === 0) continue;
    const below = occupancy.get(cellKey({ ...cell, level: cell.level - 1 }));
    if (!below) continue;
    if (below.type === "bridge") {
      return fail("Can't build on top of the bridge");
    }
    if (isUnderFunnel(ship, cell, occupancy)) {
      return fail("Can't build over a funnel");
    }
    if (holdsDavitAt(ship, below, cell.x, cell.z)) {
      return fail("Can't build over a davit");
    }
  }

  if (cells.some((cell) => isOutboardOfDavit(ship, cell, occupancy))) {
    return fail("Can't build outboard of a davit");
  }

  const support = checkSupport(ship, cells, occupancy);
  if (!support.ok) return support;

  if (def.role === "bridge") {
    if (cells.some((cell) => !isForwardHalf(ship, cell.x))) {
      return fail("The bridge must be in the forward half");
    }
    const covered = cells.some((cell) =>
      occupancy.has(cellKey({ ...cell, level: cell.level + 1 }))
    );
    if (covered) return fail("The bridge must be on top of its stack");
  }

  return OK;
}

function canPlaceAttach(
  ship: Ship,
  def: AttachPartDef,
  candidate: PartCandidate,
  occupancy: Occupancy,
  claimed: ReadonlySet<string> | undefined
): RuleResult {
  // The store always places attach parts at rotation 0; anything else came
  // from hand-edited or hostile data.
  if (candidate.rotation !== 0) return fail("Attach parts can't be rotated");
  const missing = fail(`Needs a free ${ATTACH_POINT_LABELS[def.attachTo]}`);
  if (candidate.anchor.kind !== "attach") return missing;
  const { parentId, pointId } = candidate.anchor;
  const point = attachPointsOf(ship, parentId, occupancy).find(
    (p) => p.id === pointId
  );
  if (!point || !pointFitsPart(def, point)) return missing;
  if (
    overlapsClaims(parentId, point, claimed ?? claimedKeys(ship, occupancy))
  ) {
    return fail("That spot is taken");
  }
  return OK;
}

/**
 * Expects a ship that passed validateShip (no parent cycles). Callers that
 * place many parts in a row can pass the ship's claimedKeys to avoid
 * recomputing them for each one.
 */
export function canPlace(
  ship: Ship,
  candidate: PartCandidate,
  occupancy: Occupancy = buildOccupancy(ship),
  claimed?: ReadonlySet<string>
): RuleResult {
  const def = getPartDef(candidate.type);
  return def.placement === "grid"
    ? canPlaceGrid(ship, def, candidate, occupancy)
    : canPlaceAttach(ship, def, candidate, occupancy, claimed);
}

export function place(
  ship: Ship,
  part: PlacedPart
): { ok: true; ship: Ship } | { ok: false; reason: string } {
  if (part.id === HULL_ID) {
    return { ok: false, reason: "Reserved part id" };
  }
  if (ship.parts.some((p) => p.id === part.id)) {
    return { ok: false, reason: "Duplicate part id" };
  }
  const result = canPlace(ship, part);
  if (!result.ok) return result;
  return { ok: true, ship: { ...ship, parts: [...ship.parts, part] } };
}

/**
 * Structural check (bounds, support, attach point exists, bridge still in the
 * forward half). Used to find parts left dangling or invalid after a removal
 * or a hull resize.
 */
function isStillSupported(
  ship: Ship,
  part: PlacedPart,
  occupancy: Occupancy,
  support: SupportMap
): boolean {
  if (part.anchor.kind === "attach") {
    const { parentId, pointId } = part.anchor;
    return attachPointsOf(ship, parentId, occupancy).some(
      (p) => p.id === pointId
    );
  }
  const def = getPartDef(part.type);
  const cells = partCells(part);
  const isBridge = def.placement === "grid" && def.role === "bridge";
  if (isBridge && cells.some((cell) => !isForwardHalf(ship, cell.x))) {
    return false;
  }
  return cells.every((cell) => {
    if (!inBounds(ship, cell)) return false;
    const steps = support.get(cellKey(cell));
    return steps !== undefined && steps <= MAX_OVERHANG;
  });
}

function without(ship: Ship, ids: ReadonlySet<string>): Ship {
  return { ...ship, parts: ship.parts.filter((p) => !ids.has(p.id)) };
}

/**
 * Root ids plus everything that loses support without them, in ship order.
 * Also takes anything that is still held up but can't be rebuilt in any
 * order, so removeParts can always hand back a ship that validates.
 * Expects a ship that passed validateShip (no parent cycles).
 */
export function cascadeIds(ship: Ship, rootIds: string[]): string[] {
  const removed = new Set(rootIds);
  for (;;) {
    let changed = true;
    while (changed) {
      changed = false;
      const remaining = without(ship, removed);
      const occupancy = buildOccupancy(remaining);
      // One BFS per pass; parts dropped in this pass are seen by the next.
      const support = supportMap(remaining, occupancy);
      for (const part of remaining.parts) {
        if (!isStillSupported(remaining, part, occupancy, support)) {
          removed.add(part.id);
          changed = true;
        }
      }
    }
    const { stuck } = planBuild(without(ship, removed));
    if (stuck.length === 0) break;
    for (const part of stuck) removed.add(part.id);
  }
  return ship.parts.filter((p) => removed.has(p.id)).map((p) => p.id);
}

/**
 * Drops the given ids. The rest keep their order where they can, but a part
 * now held up only by a part saved after it moves behind that part, so the
 * result still replays through validateShip. Pass ids from cascadeIds.
 */
export function removeParts(ship: Ship, ids: string[]): Ship {
  const { order, stuck } = planBuild(without(ship, new Set(ids)));
  return { ...ship, parts: [...order, ...stuck] };
}

/** A new hull length, beam, or both; omitted fields stay as they are. */
export type HullSize = Partial<Hull>;

function withSize(ship: Ship, size: HullSize): Ship {
  return { ...ship, hull: { ...ship.hull, ...size } };
}

/** Ids of the parts a resize would remove. Callers clamp the size first. */
export function previewHullSize(ship: Ship, size: HullSize): string[] {
  return cascadeIds(withSize(ship, size), []);
}

export function setHullSize(ship: Ship, size: HullSize): Ship {
  const resized = withSize(ship, size);
  return removeParts(resized, cascadeIds(resized, []));
}

export function previewHullLength(
  ship: Ship,
  lengthSegments: number
): string[] {
  return previewHullSize(ship, { lengthSegments });
}

export function setHullLength(ship: Ship, lengthSegments: number): Ship {
  return setHullSize(ship, { lengthSegments });
}

function isIntegerIn(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

/** A ship being rebuilt one part at a time, with its occupancy kept current. */
interface Build {
  ship: Ship;
  occupancy: Occupancy;
  claimed: Set<string>;
  ids: Set<string>;
}

function startBuild(ship: Ship): Build {
  return {
    ship: { ...ship, parts: [] },
    occupancy: new Map(),
    claimed: new Set(),
    ids: new Set(),
  };
}

/** place(), without rebuilding the occupancy for every part. */
function addToBuild(build: Build, part: PlacedPart): RuleResult {
  if (part.id === HULL_ID) return fail("Reserved part id");
  if (build.ids.has(part.id)) return fail("Duplicate part id");
  const result = canPlace(build.ship, part, build.occupancy, build.claimed);
  if (!result.ok) return result;
  for (const key of claimsOfPart(build.ship, part, build.occupancy)) {
    build.claimed.add(key);
  }
  build.ship.parts.push(part);
  build.ids.add(part.id);
  for (const cell of partCells(part)) build.occupancy.set(cellKey(cell), part);
  return OK;
}

/**
 * Rebuilds the ship in list order, deferring any part that can't go in yet
 * and retrying it after the rest. `stuck` holds parts that never fit.
 */
function planBuild(ship: Ship): { order: PlacedPart[]; stuck: PlacedPart[] } {
  const build = startBuild(ship);
  let pending = ship.parts;
  while (pending.length > 0) {
    const deferred = pending.filter((part) => !addToBuild(build, part).ok);
    if (deferred.length === pending.length) break;
    pending = deferred;
  }
  return { order: build.ship.parts, stuck: pending };
}

/** Re-applies every placement in order; used on loaded or shared data. */
export function validateShip(ship: Ship): RuleResult {
  const { lengthSegments, beam } = ship.hull;
  if (!isIntegerIn(lengthSegments, MIN_SEGMENTS, MAX_SEGMENTS)) {
    return fail("Hull length out of range");
  }
  if (!isIntegerIn(beam, MIN_BEAM, MAX_BEAM)) return fail("Beam out of range");
  const build = startBuild(ship);
  for (const part of ship.parts) {
    const result = addToBuild(build, part);
    if (!result.ok) return fail(`Part ${part.id}: ${result.reason}`);
  }
  return OK;
}
