import {
  attachPointsOf,
  openAttachPoints,
} from "@/lib/ship-builder/model/attach";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import { gridLength, beamOf, MAX_LEVEL } from "@/lib/ship-builder/model/grid";
import type { ShipKind } from "@/lib/ship-builder/model/kinds";
import {
  canPlace,
  emptyShip,
  place,
  type PartCandidate,
} from "@/lib/ship-builder/model/placement";
import type {
  Anchor,
  AttachAnchor,
  GridAnchor,
  Rotation,
  PartType,
  Ship,
} from "@/lib/ship-builder/model/types";
import {
  footprintBase,
  modelToWorld,
  type WorldPosition,
} from "@/components/ship-builder/scene/coords";

/** A minimal ship and the one part the studio draws on it. */
export interface StudioScene {
  ship: Ship;
  candidate: PartCandidate;
  /** The part's own origin in world space (PartMesh puts the part there). */
  origin: WorldPosition;
}

/**
 * Parts that can hold others, tried (in this order) as scaffolding when a
 * part has nowhere to attach on a bare hull. The scaffold is never drawn.
 */
const SCAFFOLD: readonly PartType[] = [
  "deck-1x1",
  "deck-2x1",
  "cabin-1st",
  "bridge",
  "funnel",
  "mast",
  "mast-wood-main",
  "davit",
  "helipad",
];

/** A roomy hull, so the longest bridge and 2x2 mounts fit. */
const STUDIO_SEGMENTS = 12;
const STUDIO_BEAM = 7;
const MAX_DEPTH = 4;
const MAX_STATES = 1500;

function kindFor(type: PartType): ShipKind {
  return getPartDef(type).kinds?.[0] ?? "liner";
}

const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];

interface Spot {
  anchor: Anchor;
  rotation: Rotation;
}

/**
 * The first cell a grid part is allowed on, scanning up from the main deck.
 * Every cell is tried at rotation 0 before any other rotation, so a part only
 * turns when it has to (stairs facing a block).
 */
function firstGridSpot(ship: Ship, type: PartType): Spot | null {
  for (const rotation of ROTATIONS) {
    for (let level = 0; level <= MAX_LEVEL; level++) {
      for (let x = 0; x < gridLength(ship) * 3; x++) {
        for (let z = 0; z < beamOf(ship); z++) {
          const anchor: GridAnchor = { kind: "grid", level, x, z };
          if (canPlace(ship, { type, anchor, rotation }).ok) {
            return { anchor, rotation };
          }
        }
      }
    }
  }
  return null;
}

/** The first free attach point for `type` on this ship, if any. */
function firstAttachSpot(ship: Ship, type: PartType): Spot | null {
  const def = getPartDef(type);
  if (def.placement !== "attach") return null;
  const open = openAttachPoints(ship, def)[0];
  if (!open) return null;
  const anchor: AttachAnchor = {
    kind: "attach",
    parentId: open.parentId,
    pointId: open.point.id,
  };
  return { anchor, rotation: 0 };
}

function spotFor(ship: Ship, type: PartType) {
  return getPartDef(type).placement === "grid"
    ? firstGridSpot(ship, type)
    : firstAttachSpot(ship, type);
}

/** Ships with one more scaffold part, each way it can be added. */
function grow(ship: Ship): Ship[] {
  const grown: Ship[] = [];
  for (const type of SCAFFOLD) {
    if (
      getPartDef(type).kinds &&
      !getPartDef(type).kinds?.includes(ship.kind)
    ) {
      continue;
    }
    const spot = spotFor(ship, type);
    if (!spot) continue;
    const placed = place(ship, {
      id: `scaffold-${ship.parts.length}`,
      type,
      ...spot,
    });
    if (placed.ok) grown.push(placed.ship);
  }
  return grown;
}

/**
 * Finds a ship the part can sit on. A grid part needs only a legal cell; an
 * attach part needs a free point of its kind, so a funnel goes on a deck, a
 * crow's nest on a mast on a bridge, and a wire on a second mast. Breadth
 * first over a few scaffold parts; returns null when none works.
 */
function findHost(type: PartType): Ship | null {
  let frontier = [
    emptyShip(kindFor(type), "Studio", STUDIO_SEGMENTS, STUDIO_BEAM),
  ];
  let seen = 0;
  for (let depth = 0; depth <= MAX_DEPTH; depth++) {
    for (const ship of frontier) {
      if (spotFor(ship, type)) return ship;
    }
    const next: Ship[] = [];
    for (const ship of frontier) {
      for (const grown of grow(ship)) {
        if (++seen > MAX_STATES) return null;
        next.push(grown);
      }
    }
    frontier = next;
  }
  return null;
}

/**
 * A minimal ship and candidate for any Ship Builder part, so PartMesh draws
 * it exactly as in game. Throws when no legal spot can be built for it.
 */
export function buildStudioScene(type: PartType): StudioScene {
  const ship = findHost(type);
  const spot = ship && spotFor(ship, type);
  if (!ship || !spot) {
    throw new Error(`No place to put a ${type} in a studio ship`);
  }
  const { anchor, rotation } = spot;
  const candidate: PartCandidate = { type, anchor, rotation };
  const length = gridLength(ship);
  const beam = beamOf(ship);
  const def = getPartDef(type);
  if (anchor.kind === "grid" && def.placement === "grid") {
    const { center } = footprintBase(def, anchor, rotation);
    return { ship, candidate, origin: modelToWorld(length, beam, center) };
  }
  if (anchor.kind !== "attach") throw new Error(`Bad anchor for ${type}`);
  const point = attachPointsOf(ship, anchor.parentId).find(
    (p) => p.id === anchor.pointId
  );
  if (!point) throw new Error(`Lost the attach point for ${type}`);
  return {
    ship,
    candidate,
    origin: modelToWorld(length, beam, point.position),
  };
}
