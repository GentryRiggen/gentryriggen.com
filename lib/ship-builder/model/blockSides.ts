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

const CANDIDATE = "@candidate";

/**
 * The joined sides of a grid block (placed or a ghost candidate), against
 * the blocks already on the ship. Joins are symmetric, so two blocks that
 * meet either both go flush or both keep their faces (a flush face against
 * an inset one would leave a slot onto the open interior). A vertical side
 * joins when the blocks meeting across that plane form an exact match: every
 * edge cell of every block has a joinable neighbour straight across. The top
 * joins when every footprint cell has a block directly above and the blocks
 * above cover the flush edges below. Anything that is not a grid block (or a
 * non-joining one) gets no joins.
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
  for (const step of SIDE_STEPS) {
    joins[step.side] = isSideJoined(cells, step, own, inFootprint, occupancy);
  }
  joins.top =
    own === "wall" &&
    cells.every((c) => neighbourClass({ ...c, level: c.level + 1 }) !== null) &&
    topIsClosed(ship, cells, joins, inFootprint, occupancy);
  return joins;
}

interface SideBlock {
  cells: Cell[];
  /** True for blocks on the candidate's side of the plane. */
  isNear: boolean;
}

function shifted(cell: Cell, dx: number, dz: number): Cell {
  return { ...cell, x: cell.x + dx, z: cell.z + dz };
}

/**
 * Whether the plane a side faces is an exact match: starting from the block,
 * follow every neighbour across the plane (and every block that meets those
 * neighbours) and require each one's edge cells to all have a joinable
 * neighbour straight across. Every block in the group then reaches the same
 * verdict, so a partial overlap leaves all of them with their faces.
 */
function isSideJoined(
  cells: Cell[],
  { dx, dz }: Direction,
  own: BlockClass,
  inFootprint: ReadonlySet<string>,
  occupancy: Occupancy
): boolean {
  const seen = new Set<string>([CANDIDATE]);
  const queue: SideBlock[] = [{ cells, isNear: true }];
  const partCells = new Map<string, Cell[]>();
  const cellsOfPart = (part: PlacedPart): Cell[] => {
    const known = partCells.get(part.id);
    if (known) return known;
    const def = getPartDef(part.type);
    const found =
      def.placement === "grid" && part.anchor.kind === "grid"
        ? footprintCells(def, part.anchor, part.rotation)
        : [];
    partCells.set(part.id, found);
    return found;
  };

  for (let block = queue.shift(); block; block = queue.shift()) {
    // Near-side blocks look along the direction, far-side blocks back at them.
    const sign = block.isNear ? 1 : -1;
    const blockKeys = new Set(block.cells.map(cellKey));
    const facing = block.cells.filter(
      (c) => !blockKeys.has(cellKey(shifted(c, dx * sign, dz * sign)))
    );
    for (const cell of facing) {
      const across = cellKey(shifted(cell, dx * sign, dz * sign));
      // Back at the candidate from a far-side block: already accounted for.
      if (inFootprint.has(across)) continue;
      const other = occupancy.get(across);
      if (!other || blockClassOfPart(other) !== own) return false;
      if (seen.has(other.id)) continue;
      seen.add(other.id);
      queue.push({
        cells: cellsOfPart(other),
        isNear: !block.isNear,
      });
    }
  }
  return true;
}

/**
 * A top may only be left open (flush, no face) when the blocks above close
 * it. Where a flush side meets the block above, that block must be flush on
 * the same side too (or carry on past the edge); otherwise its inset wall
 * leaves a gap onto the open interior.
 */
function topIsClosed(
  ship: Ship,
  cells: Cell[],
  joins: BlockSides,
  inFootprint: ReadonlySet<string>,
  occupancy: Occupancy
): boolean {
  return SIDE_STEPS.every(({ side, dx, dz }) => {
    if (!joins[side]) return true;
    return cells.every((cell) => {
      if (inFootprint.has(cellKey(shifted(cell, dx, dz)))) return true;
      const above = occupancy.get(cellKey({ ...cell, level: cell.level + 1 }));
      if (!above) return false;
      const aboveCells = footprintCellKeys(above);
      const beyond = cellKey(
        shifted({ ...cell, level: cell.level + 1 }, dx, dz)
      );
      if (aboveCells.has(beyond)) return true;
      return joinedSides(ship, above, occupancy)[side];
    });
  });
}

function footprintCellKeys(part: PlacedPart): Set<string> {
  const def = getPartDef(part.type);
  if (def.placement !== "grid" || part.anchor.kind !== "grid") return new Set();
  return new Set(footprintCells(def, part.anchor, part.rotation).map(cellKey));
}

/** A compact key for a mask, for memo dependencies and cache keys. */
export function sidesKey(sides: BlockSides): string {
  return [sides.bow, sides.stern, sides.starboard, sides.port, sides.top]
    .map((joined) => (joined ? "1" : "0"))
    .join("");
}
