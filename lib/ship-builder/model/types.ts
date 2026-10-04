import type { ShipKind } from "./kinds";
import type { HullArea, PaintColor } from "./paint";

export const PART_TYPES = [
  "deck-1x1",
  "deck-2x1",
  "cabin-1st",
  "cabin-2nd",
  "cabin-3rd",
  "cabin-crew",
  "bridge-3",
  "bridge",
  "bridge-5",
  "bridge-6",
  "bridge-7",
  "funnel",
  "mast",
  "davit",
  "lifeboat-standard",
  "lifeboat-collapsible",
  "funnel-large",
  "lifeboat-large",
  "propeller",
  "rudder",
  "turret-small",
  "turret-large",
  "radar-mast",
  "helipad",
  "helicopter",
  "rib-boat",
  "container",
  "hatch-cover",
  "cargo-crane",
  "lifeboat-freefall",
  "cabin-balcony",
  "pool",
  "waterslide",
  "climbing-wall",
  "lifeboat-enclosed",
  "raft-canister",
  "funnel-modern",
  "azipod",
  "dome",
  "searchlight",
  "crows-nest",
  "stern-flag",
  "wireless-aerial",
  "deckchair",
  "bench",
  "deck-lamp",
  "ventilator",
  "stairs",
] as const;

export type PartType = (typeof PART_TYPES)[number];

export type PartCategory =
  | "decks"
  | "cabins"
  | "command"
  | "funnels"
  | "masts"
  | "lifeboats"
  | "decor"
  | "propulsion"
  | "naval"
  | "cargo";

export type AttachPointType =
  | "funnel-mount"
  | "mast-mount"
  | "davit-point"
  | "boat-mount"
  | "large-funnel-mount"
  | "big-boat-mount"
  | "prop-mount"
  | "rudder-mount"
  | "heli-mount"
  | "freefall-mount"
  | "edge-mount"
  | "searchlight-mount"
  | "nest-mount"
  | "flag-mount"
  | "aerial-mount";

export type Rotation = 0 | 90 | 180 | 270;

export type CabinClass = "first" | "second" | "third";

/** Parent id used for attach points that belong to the hull itself. */
export const HULL_ID = "hull";

export interface GridAnchor {
  kind: "grid";
  level: number;
  x: number;
  z: number;
}

export interface AttachAnchor {
  kind: "attach";
  /** A part id, or HULL_ID. */
  parentId: string;
  pointId: string;
}

export type Anchor = GridAnchor | AttachAnchor;

export interface PlacedPart {
  id: string;
  type: PartType;
  anchor: Anchor;
  rotation: Rotation;
  /** Paint on the part's main surface. Absent means the default look. */
  color?: PaintColor;
}

export const BOW_IDS = [
  "straight",
  "clipper",
  "bulbous",
  "icebreaker",
] as const;
export type BowShape = (typeof BOW_IDS)[number];

export const STERN_IDS = ["counter", "cruiser", "transom", "canoe"] as const;
export type SternShape = (typeof STERN_IDS)[number];

export interface Hull {
  lengthSegments: number;
  /** Width in cells, MIN_BEAM to MAX_BEAM. Inside-hull cells are 0 <= z < beam. */
  beam: number;
  bow: BowShape;
  stern: SternShape;
  /** Paint per hull area. Absent means the default look. */
  paint?: Partial<Record<HullArea, PaintColor>>;
}

export interface Ship {
  v: 6;
  kind: ShipKind;
  name: string;
  hull: Hull;
  parts: PlacedPart[];
}

export interface Cell {
  level: number;
  x: number;
  z: number;
}

/**
 * Model-space position. x: cells from the bow toward the stern. y: levels
 * above the main deck. z: cells from the starboard edge toward port.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Side = "starboard" | "port";

export interface AttachPoint {
  id: string;
  type: AttachPointType;
  position: Vec3;
  side?: Side;
  /**
   * What this point occupies. Two points conflict when they share a claim.
   * Defaults to one key unique to the point (see claimsOf in attach.ts).
   */
  claims?: string[];
}

interface PartDefBase {
  type: PartType;
  category: PartCategory;
  name: string;
  description: string;
  /** Stability mass; per occupied cell for grid parts. */
  mass: number;
  /** Height in levels, used for the part's center of mass. */
  height: number;
  passengers?: { cabinClass: CabinClass; count: number };
  /** Crew beds per occupied cell. Crew are not passengers. */
  crewBerths?: number;
  seats?: number;
  stokers?: number;
  /** Engine power units a funnel provides. */
  power?: number;
  /** Twenty-foot-equivalent container units this part carries. */
  teu?: number;
  /** Ship kinds this part is listed for. Absent means every kind. */
  kinds?: ShipKind[];
}

export interface GridPartDef extends PartDefBase {
  placement: "grid";
  /**
   * `amenity` blocks (a pool) obey the support rules but nothing builds on
   * them and they expose no attach points. `decor` parts (deck chairs,
   * stairs) sit directly on the main deck or a deck block, nothing builds on
   * them, they expose no points and they never hold up their neighbours.
   */
  role: "deck" | "cabin" | "bridge" | "cargo" | "amenity" | "decor";
  /** Size at rotation 0: x along the length, z across the beam. */
  footprint: { x: number; z: number };
}

export interface AttachPartDef extends PartDefBase {
  placement: "attach";
  attachTo: AttachPointType;
  /** Restricts which point ids of the right type this part may use. */
  allowedPointIds?: string[];
  /** Shown when there's nowhere free to put this part. */
  emptyHint: string;
}

export type PartDef = GridPartDef | AttachPartDef;
