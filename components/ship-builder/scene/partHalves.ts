import {
  aerialTarget,
  resolveAttachPoint,
  stringTarget,
} from "@/lib/ship-builder/model/attach";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import {
  rotatedFootprint,
  type Occupancy,
} from "@/lib/ship-builder/model/grid";
import {
  HULL_ID,
  type PlacedPart,
  type Ship,
} from "@/lib/ship-builder/model/types";

/** Which piece of a broken ship something rides with. */
export type HalfSide = "bow" | "stern";

export const HALF_SIDES: readonly HalfSide[] = ["bow", "stern"];

/** Cells from the bow → the half: ahead of the break is the bow. */
export function halfOfX(cellsFromBow: number, atX: number): HalfSide {
  return cellsFromBow < atX ? "bow" : "stern";
}

/**
 * Which half every part goes with when the ship breaks `atX` cells from the
 * bow. A grid part goes by the centre of its footprint (a block across the
 * break stays whole on one side). An attached part follows its parent chain
 * down to a grid part; one fixed to the hull itself goes by where it is
 * fixed. Anything that cannot be traced (a missing parent, a loop) goes with
 * the stern.
 */
export function partHalves(
  ship: Ship,
  atX: number,
  occupancy?: Occupancy
): Map<string, HalfSide> {
  const byId = new Map(ship.parts.map((part) => [part.id, part]));
  const sides = new Map<string, HalfSide>();

  const sideOf = (part: PlacedPart, visiting: Set<string>): HalfSide => {
    const known = sides.get(part.id);
    if (known) return known;
    let side: HalfSide = "stern";
    const def = getPartDef(part.type);
    if (part.anchor.kind === "grid" && def.placement === "grid") {
      const size = rotatedFootprint(def.footprint, part.rotation);
      side = halfOfX(part.anchor.x + size.x / 2, atX);
    } else if (part.anchor.kind === "attach") {
      const { parentId } = part.anchor;
      if (parentId === HULL_ID) {
        const point = resolveAttachPoint(ship, part.anchor, occupancy);
        if (point) side = halfOfX(point.position.x, atX);
      } else {
        const parent = byId.get(parentId);
        if (parent && !visiting.has(parent.id)) {
          visiting.add(part.id);
          side = sideOf(parent, visiting);
        }
      }
    }
    sides.set(part.id, side);
    return side;
  };

  for (const part of ship.parts) sideOf(part, new Set());
  return sides;
}

/**
 * Wires (aerials, string lights) strung from a pole in one half to a pole in
 * the other: they snap when she breaks, so neither half draws them.
 */
export function snappedWires(
  ship: Ship,
  atX: number,
  occupancy?: Occupancy
): Set<string> {
  const byId = new Map(ship.parts.map((part) => [part.id, part]));
  const snapped = new Set<string>();
  for (const part of ship.parts) {
    const isWire =
      part.type === "wireless-aerial" || part.type === "string-lights";
    if (!isWire || part.anchor.kind !== "attach") continue;
    const pole = byId.get(part.anchor.parentId);
    const from = resolveAttachPoint(ship, part.anchor, occupancy);
    if (!pole || !from) continue;
    const find = part.type === "string-lights" ? stringTarget : aerialTarget;
    const to = find(ship, pole, occupancy);
    if (to && halfOfX(from.position.x, atX) !== halfOfX(to.x, atX)) {
      snapped.add(part.id);
    }
  }
  return snapped;
}
