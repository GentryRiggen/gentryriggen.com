import { resolveAttachPoint } from "../model/attach";
import { getPartDef } from "../model/catalog";
import {
  beamOf,
  cellKey,
  facingCell,
  gridLength,
  MAX_LEVEL,
  partCells,
  WING_REACH,
} from "../model/grid";
import { occupancyOf } from "../model/occupancyCache";
import type { PartType, PlacedPart, Ship } from "../model/types";
import {
  ATTACH_BLOCK_RADIUS,
  type BlockerCircle,
  LOW_OBSTACLE_MAX,
  type StairLink,
  type WalkGrid,
} from "./types";

/** A block at MAX_LEVEL has its roof one level higher still. */
const SURFACE_LEVELS = MAX_LEVEL + 2;

/**
 * Attach parts nobody bumps into: lights, flags and aerials are too thin or
 * too high, boats hang outboard of the rail on their davits, props, rudders
 * and azipods are under the hull, and a helipad is a flat painted pad.
 */
const NON_BLOCKING_ATTACH: ReadonlySet<PartType> = new Set<PartType>([
  "nav-lights",
  "string-lights",
  "stern-flag",
  "underwater-light",
  "searchlight",
  "wireless-aerial",
  "crows-nest",
  "propeller",
  "rudder",
  "azipod",
  "helipad",
  "lifeboat-standard",
  "lifeboat-collapsible",
  "lifeboat-large",
  "lifeboat-enclosed",
  "lifeboat-freefall",
  "rib-boat",
]);

/**
 * Blocks whose roof a person can stand on. Pools, decor and attach parts never
 * are. Containers are floors but have no stairs of their own (you jump up).
 */
const FLOOR_ROLES = ["deck", "cabin", "bridge", "cargo"];
/** Blocks stairs may climb to. */
const STAIR_TARGET_ROLES = ["deck", "cabin", "bridge"];

/**
 * How far a roof sits below the whole-level top of its cell: the bridge is a
 * lower block (see BRIDGE_HEIGHT in PartMesh) and a container is a little
 * short of a level (CONTAINER_HEIGHT in cargoParts). Everything else is flush.
 */
const ROOF_DROP: Readonly<Record<string, number>> = {
  bridge: 0.2,
  cargo: 0.06,
};

function isGridRole(part: PlacedPart | undefined, ...roles: string[]) {
  if (!part) return false;
  const def = getPartDef(part.type);
  return def.placement === "grid" && roles.includes(def.role);
}

function isStairs(part: PlacedPart | undefined): part is PlacedPart {
  if (!part) return false;
  const def = getPartDef(part.type);
  return def.placement === "grid" && def.climbsToFacedBlock === true;
}

/** Same ship object and same parts means the same grid. */
interface CacheEntry {
  grid: WalkGrid;
  parts: readonly PlacedPart[];
  count: number;
}
const cache = new WeakMap<Ship, CacheEntry>();

/**
 * The walkable map of a ship, built once per ship object.
 *
 * A person stands on a surface (a "level") in a cell column. Level 0 is the
 * main deck, open hull between 0 <= z < beam; a block at grid level L has its
 * roof at level L + 1. Standing on level L in a column needs
 *  - the cell at level L free of parts (except stairs, which are walkable),
 *  - and a floor under it: the hull for level 0, otherwise a deck or cabin
 *    block at level L - 1 (so wing columns outside the hull need a deck).
 * Pools and decor are never floors and never walkable, so they wall off their
 * own cells; the roofs of decks, cabins, bridges and containers are floors. Level changes happen only through stair links.
 * The hull edge is a rail; the bow and stern tips beyond the grid are not
 * walkable.
 */
export function walkGridOf(ship: Ship): WalkGrid {
  const cached = cache.get(ship);
  if (
    cached &&
    cached.parts === ship.parts &&
    cached.count === ship.parts.length
  ) {
    return cached.grid;
  }
  const grid = buildWalkGrid(ship);
  cache.set(ship, {
    grid,
    parts: ship.parts,
    count: ship.parts.length,
  });
  return grid;
}

function buildWalkGrid(ship: Ship): WalkGrid {
  const length = gridLength(ship);
  const beam = beamOf(ship);
  const occupancy = occupancyOf(ship);
  const width = beam + 2 * WING_REACH;

  const index = (x: number, z: number, level: number): number =>
    (level * width + (z + WING_REACH)) * length + x;
  const inArea = (x: number, z: number, level: number): boolean =>
    Number.isInteger(x) &&
    Number.isInteger(z) &&
    Number.isInteger(level) &&
    x >= 0 &&
    x < length &&
    z >= -WING_REACH &&
    z < beam + WING_REACH &&
    level >= 0 &&
    level < SURFACE_LEVELS;

  const walkable = new Uint8Array(SURFACE_LEVELS * width * length);
  for (let level = 0; level < SURFACE_LEVELS; level++) {
    for (let z = -WING_REACH; z < beam + WING_REACH; z++) {
      for (let x = 0; x < length; x++) {
        const here = occupancy.get(cellKey({ level, x, z }));
        if (here && !isStairs(here)) continue;
        const hasFloor =
          level === 0
            ? z >= 0 && z < beam
            : isGridRole(
                occupancy.get(cellKey({ level: level - 1, x, z })),
                ...FLOOR_ROLES
              );
        if (hasFloor) walkable[index(x, z, level)] = 1;
      }
    }
  }

  const isWalkable = (x: number, z: number, level: number): boolean =>
    inArea(x, z, level) && walkable[index(x, z, level)] === 1;

  const stairs: StairLink[] = [];
  const linksFrom = new Map<string, StairLink[]>();
  const linkKey = (at: StairLink["from"]): string => cellKey(at);
  const addLink = (link: StairLink) => {
    stairs.push(link);
    const key = linkKey(link.from);
    linksFrom.set(key, [...(linksFrom.get(key) ?? []), link]);
  };
  for (const part of ship.parts) {
    if (!isStairs(part)) continue;
    const [cell] = partCells(part);
    if (!cell || !isWalkable(cell.x, cell.z, cell.level)) continue;
    const faced = facingCell(cell, part.rotation);
    const block = occupancy.get(cellKey(faced));
    // The faced block's roof must be one level up and open to stand on.
    if (!isGridRole(block, ...STAIR_TARGET_ROLES)) continue;
    if (!isWalkable(faced.x, faced.z, cell.level + 1)) continue;
    const low = { x: cell.x, z: cell.z, level: cell.level };
    const high = { x: faced.x, z: faced.z, level: cell.level + 1 };
    addLink({ from: low, to: high });
    addLink({ from: high, to: low });
  }

  const blockers: BlockerCircle[] = [];
  for (const part of ship.parts) {
    const def = getPartDef(part.type);
    if (def.placement !== "attach" || part.anchor.kind !== "attach") continue;
    if (NON_BLOCKING_ATTACH.has(part.type)) continue;
    const point = resolveAttachPoint(ship, part.anchor, occupancy);
    if (!point) continue;
    blockers.push({
      x: point.position.x,
      z: point.position.z,
      level: Math.round(point.position.y),
      radius: ATTACH_BLOCK_RADIUS,
    });
  }
  const blockersByLevel = new Map<number, BlockerCircle[]>();
  for (const blocker of blockers) {
    blockersByLevel.set(blocker.level, [
      ...(blockersByLevel.get(blocker.level) ?? []),
      blocker,
    ]);
  }

  return {
    length,
    beam,
    blockers,
    stairs,
    blockersAt: (level) => blockersByLevel.get(level) ?? [],
    floorLevel(x, z) {
      for (let level = SURFACE_LEVELS - 1; level >= 0; level--) {
        if (isWalkable(x, z, level)) return level;
      }
      return null;
    },
    isWalkable,
    obstructionAt(x, z, level) {
      const part = occupancy.get(cellKey({ level, x, z }));
      if (!part) return null;
      const def = getPartDef(part.type);
      if (def.placement !== "grid" || def.climbsToFacedBlock) return null;
      if (FLOOR_ROLES.includes(def.role)) {
        return { top: level + 1 - (ROOF_DROP[def.role] ?? 0), isFloor: true };
      }
      const isLow = def.height <= LOW_OBSTACLE_MAX;
      return { top: isLow ? level + def.height : level + 10, isFloor: false };
    },
    dropLevel(x, z, level) {
      for (let below = level - 1; below >= 0; below--) {
        if (isWalkable(x, z, below)) return below;
        if (occupancy.has(cellKey({ level: below, x, z }))) return null;
      }
      return null;
    },
    surfaceHeight(x, z, level) {
      const block = occupancy.get(cellKey({ level: level - 1, x, z }));
      const def = block && getPartDef(block.type);
      const drop = def?.placement === "grid" ? ROOF_DROP[def.role] : undefined;
      return level - (level > 0 ? (drop ?? 0) : 0);
    },
    isBlocked: (x, z, level) => !isWalkable(x, z, level),
    stepLevel(fromX, fromZ, fromLevel, toX, toZ) {
      if (Math.abs(fromX - toX) + Math.abs(fromZ - toZ) !== 1) return null;
      if (isWalkable(toX, toZ, fromLevel)) return fromLevel;
      const link = linksFrom
        .get(linkKey({ level: fromLevel, x: fromX, z: fromZ }))
        ?.find((l) => l.to.x === toX && l.to.z === toZ);
      return link ? link.to.level : null;
    },
  };
}
