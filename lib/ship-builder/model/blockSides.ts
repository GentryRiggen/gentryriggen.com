import { getPartDef } from "./catalog";
import { cellKey, footprintCells, type Occupancy } from "./grid";
import { occupancyOf } from "./occupancyCache";
import type { PartCandidate } from "./placement";
import type { Cell, GridPartDef, PlacedPart, Ship } from "./types";

/**
 * Which sides of a grid block are joined to a neighbouring block, so the two
 * read as one continuous wall. Bow is toward model x = 0, stern toward larger
 * x, starboard toward z = 0 and port toward larger z (see modelToWorld).
 * The bottom is never listed: it is always flat.
 */
export interface BlockSides {
  bow: boolean;
  stern: boolean;
  starboard: boolean;
  port: boolean;
  top: boolean;
}

export const NO_JOINED_SIDES: BlockSides = {
  bow: false,
  stern: false,
  starboard: false,
  port: false,
  top: false,
};

type BlockClass = "wall" | "bridge";

/**
 * The superstructure blocks that merge: decks, cabins and bridges. Cargo
 * containers, pools (amenity) and decor are their own objects and never join,
 * and neither does the low hatch cover, which is shorter than a level. A
 * bridge is a lower wheelhouse, so it only merges sideways with another
 * bridge: against a full-height block the walls would not line up.
 */
function blockClassOf(def: GridPartDef): BlockClass | null {
  if (def.type === "hatch-cover") return null;
  if (def.role === "bridge") return "bridge";
  if (def.role === "deck" || def.role === "cabin") return "wall";
  return null;
}

function blockClassOfPart(part: PlacedPart): BlockClass | null {
  const def = getPartDef(part.type);
  return def.placement === "grid" ? blockClassOf(def) : null;
}

interface Direction {
  side: keyof BlockSides;
  dx: number;
  dz: number;
}

const SIDE_STEPS: Direction[] = [
  { side: "bow", dx: -1, dz: 0 },
  { side: "stern", dx: 1, dz: 0 },
  { side: "starboard", dx: 0, dz: -1 },
  { side: "port", dx: 0, dz: 1 },
];

/**
 * The joined sides of a grid block (placed or a ghost candidate), against
 * the blocks already on the ship. A vertical side is joined when every cell
 * along it has a joinable neighbour at the same level; the top is joined when
 * every footprint cell has a block directly above. Anything that is not a
 * grid block (or a non-joining one) gets no joins.
 */
export function joinedSides(
  ship: Ship,
  part: PartCandidate,
  occupancy: Occupancy = occupancyOf(ship)
): BlockSides {
  const def = getPartDef(part.type);
  if (def.placement !== "grid" || part.anchor.kind !== "grid") {
    return NO_JOINED_SIDES;
  }
  const own = blockClassOf(def);
  if (own === null) return NO_JOINED_SIDES;

  const cells = footprintCells(def, part.anchor, part.rotation);
  const inFootprint = new Set(cells.map(cellKey));
  const neighbourClass = (cell: Cell): BlockClass | null => {
    if (inFootprint.has(cellKey(cell))) return null;
    const other = occupancy.get(cellKey(cell));
    return other ? blockClassOfPart(other) : null;
  };

  const joins = { ...NO_JOINED_SIDES };
  for (const { side, dx, dz } of SIDE_STEPS) {
    // The cells on this edge are those whose neighbour is outside the block.
    const edge = cells.filter(
      (c) => !inFootprint.has(cellKey({ ...c, x: c.x + dx, z: c.z + dz }))
    );
    joins[side] = edge.every(
      (c) => neighbourClass({ ...c, x: c.x + dx, z: c.z + dz }) === own
    );
  }
  joins.top =
    own === "wall" &&
    cells.every((c) => neighbourClass({ ...c, level: c.level + 1 }) !== null);
  return joins;
}

/** A compact key for a mask, for memo dependencies and cache keys. */
export function sidesKey(sides: BlockSides): string {
  return [sides.bow, sides.stern, sides.starboard, sides.port, sides.top]
    .map((joined) => (joined ? "1" : "0"))
    .join("");
}
