export const PART_TYPES = [
  "deck-1x1",
  "deck-2x1",
  "cabin-1st",
  "cabin-2nd",
  "cabin-3rd",
  "bridge",
  "funnel",
  "mast-fore",
  "mast-aft",
  "davit",
  "lifeboat-standard",
  "lifeboat-collapsible",
  "funnel-large",
  "lifeboat-large",
  "propeller",
] as const;

export type PartType = (typeof PART_TYPES)[number];

export type PartCategory =
  | "decks"
  | "cabins"
  | "command"
  | "funnels"
  | "masts"
  | "lifeboats"
  | "propulsion";

export type AttachPointType =
  | "funnel-mount"
  | "mast-mount"
  | "davit-point"
  | "boat-mount"
  | "large-funnel-mount"
  | "big-boat-mount"
  | "prop-mount";

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
}

export interface Hull {
  lengthSegments: number;
  /** Width in cells, MIN_BEAM to MAX_BEAM. Inside-hull cells are 0 <= z < beam. */
  beam: number;
}

export interface Ship {
  v: 2;
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
  seats?: number;
  stokers?: number;
  /** Engine power units a funnel provides. */
  power?: number;
}

export interface GridPartDef extends PartDefBase {
  placement: "grid";
  role: "deck" | "cabin" | "bridge";
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
