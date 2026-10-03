import { attachPointsOf, isPointTaken, pointFitsPart } from "./attach";
import { ATTACH_POINT_LABELS, getPartDef } from "./catalog";
import {
  buildOccupancy,
  cellKey,
  footprintCells,
  inBounds,
  isForwardHalf,
  MAX_SEGMENTS,
  MIN_SEGMENTS,
  partCells,
  type Occupancy,
} from "./grid";
import {
  HULL_ID,
  type AttachPartDef,
  type GridPartDef,
  type PlacedPart,
  type Ship,
} from "./types";

export type RuleResult = { ok: true } | { ok: false; reason: string };
export type PartCandidate = Omit<PlacedPart, "id">;

export const MAX_NAME_LENGTH = 60;
export const DEFAULT_SEGMENTS = 8;

const OK: RuleResult = { ok: true };
const fail = (reason: string): RuleResult => ({ ok: false, reason });

export function emptyShip(
  name = "Untitled liner",
  lengthSegments = DEFAULT_SEGMENTS
): Ship {
  return { v: 1, name, hull: { lengthSegments }, parts: [] };
}

function holdsFunnel(ship: Ship, block: PlacedPart): boolean {
  return ship.parts.some(
    (p) =>
      p.type === "funnel" &&
      p.anchor.kind === "attach" &&
      p.anchor.parentId === block.id
  );
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

  if (candidate.anchor.level > 0) {
    for (const cell of cells) {
      const below = occupancy.get(cellKey({ ...cell, level: cell.level - 1 }));
      if (!below) return fail("Needs a deck beneath every cell");
      if (below.type === "bridge") {
        return fail("Can't build on top of the bridge");
      }
      if (holdsFunnel(ship, below)) return fail("Can't build over a funnel");
      if (holdsDavitAt(ship, below, cell.x, cell.z)) {
        return fail("Can't build over a davit");
      }
    }
  }

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
  occupancy: Occupancy
): RuleResult {
  const missing = fail(`Needs a free ${ATTACH_POINT_LABELS[def.attachTo]}`);
  if (candidate.anchor.kind !== "attach") return missing;
  const { parentId, pointId } = candidate.anchor;
  const point = attachPointsOf(ship, parentId, occupancy).find(
    (p) => p.id === pointId
  );
  if (!point || !pointFitsPart(def, point)) return missing;
  if (isPointTaken(ship, parentId, pointId)) return fail("That spot is taken");
  return OK;
}

/** Expects a ship that passed validateShip (no parent cycles). */
export function canPlace(
  ship: Ship,
  candidate: PartCandidate,
  occupancy: Occupancy = buildOccupancy(ship)
): RuleResult {
  const def = getPartDef(candidate.type);
  return def.placement === "grid"
    ? canPlaceGrid(ship, def, candidate, occupancy)
    : canPlaceAttach(ship, def, candidate, occupancy);
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
 * or a hull shrink.
 */
function isStillSupported(
  ship: Ship,
  part: PlacedPart,
  occupancy: Occupancy
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
  return cells.every(
    (cell) =>
      inBounds(ship, cell) &&
      (cell.level === 0 ||
        occupancy.has(cellKey({ ...cell, level: cell.level - 1 })))
  );
}

/**
 * Root ids plus everything that loses support without them, in ship order.
 * Expects a ship that passed validateShip (no parent cycles).
 */
export function cascadeIds(ship: Ship, rootIds: string[]): string[] {
  const removed = new Set(rootIds);
  let changed = true;
  while (changed) {
    changed = false;
    const remaining: Ship = {
      ...ship,
      parts: ship.parts.filter((p) => !removed.has(p.id)),
    };
    const occupancy = buildOccupancy(remaining);
    for (const part of remaining.parts) {
      if (!isStillSupported(remaining, part, occupancy)) {
        removed.add(part.id);
        changed = true;
      }
    }
  }
  return ship.parts.filter((p) => removed.has(p.id)).map((p) => p.id);
}

export function removeParts(ship: Ship, ids: string[]): Ship {
  const drop = new Set(ids);
  return { ...ship, parts: ship.parts.filter((p) => !drop.has(p.id)) };
}

export function removeWithCascade(ship: Ship, partId: string): Ship {
  return removeParts(ship, cascadeIds(ship, [partId]));
}

function withLength(ship: Ship, lengthSegments: number): Ship {
  return { ...ship, hull: { lengthSegments } };
}

export function previewHullLength(
  ship: Ship,
  lengthSegments: number
): string[] {
  return cascadeIds(withLength(ship, lengthSegments), []);
}

export function setHullLength(ship: Ship, lengthSegments: number): Ship {
  const resized = withLength(ship, lengthSegments);
  return removeParts(resized, cascadeIds(resized, []));
}

/** Re-applies every placement in order; used on loaded or shared data. */
export function validateShip(ship: Ship): RuleResult {
  const { lengthSegments } = ship.hull;
  if (
    !Number.isInteger(lengthSegments) ||
    lengthSegments < MIN_SEGMENTS ||
    lengthSegments > MAX_SEGMENTS
  ) {
    return fail("Hull length out of range");
  }
  let built: Ship = { ...ship, parts: [] };
  for (const part of ship.parts) {
    const result = place(built, part);
    if (!result.ok) return fail(`Part ${part.id}: ${result.reason}`);
    built = result.ship;
  }
  return OK;
}
