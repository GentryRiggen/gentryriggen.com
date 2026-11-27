import type { ShipId } from "../ships/types";
import type { Seam, Stair, V2 } from "../walk/types";

/**
 * The room kit's data (see README.md): a ship's rooms inside her, as walk
 * areas with a look. Pure data, no three.js. Ship frame, as the walk maps:
 * metres, keel at midships, x forward, y to port, z up.
 */

export type RoomKind =
  "foyer" | "flight" | "landing" | "corridor" | "cabin" | "passage" | "lift";

/** Walls: oak panelling, white panelling, white enamel or painted steel. */
export type WallFinish = "oak" | "white-panel" | "enamel" | "steel";
export type FloorFinish = "lino" | "carpet" | "mosaic" | "steel";
/** How the room is lit (its lamps are `sconce`/`caged-bulb` furniture). */
export type LampStyle = "sconce" | "caged-bulb" | "dome" | "ceiling";

export interface RoomLook {
  finish: WallFinish;
  floor: FloorFinish;
  lamp: LampStyle;
  /** The side with portholes (an outboard wall), if any. */
  portholes?: "port" | "starboard";
}

export interface Room {
  /** "gs-boat", "gs-a", "b-corridor", "suite-1", "scotland-road", ... */
  id: string;
  kind: RoomKind;
  /** A name in spec.decks; the floor is deckZAt(deck, x) + raiseM. */
  deck: string;
  raiseM?: number;
  /** Counter-clockwise; every edge a wall unless it is a seam. */
  outline: readonly V2[];
  /** A flight: the floor falls dropM from `from` to `to`. */
  ramp?: { from: V2; to: V2; dropM: number };
  /** Ceiling over the floor (m); a flight's is over its higher end. */
  ceilingM: number;
  /** Rooms drawn together: "gs", "b-deck", "e-deck", "third-stairs". */
  zone: string;
  look: RoomLook;
  /** A corridor's (or flight's) centre line, for the hall assist. */
  axis?: readonly [V2, V2];
  /** Default: the bulkhead rule (`floodsFromSea` in water.ts). */
  water?: "sea" | "compartment";
  /** Drawn, not walkable (no seam or link leads into it). */
  noWalk?: boolean;
}

/** A deck door or a lift: the walk map's Stair, tagged. */
export type InteriorLink = Stair & { kind: "door" | "lift" };

/** A painted closed door on a wall. */
export interface ShutDoor {
  room: string;
  /** On a wall edge of the room's outline. */
  at: V2;
  /** The way its face looks, into the room (rad, 0 the bow, + to port). */
  facing: number;
  style: "oak" | "white" | "steel";
}

export type PieceId =
  | "bed"
  | "single-bed"
  | "bunk"
  | "wardrobe"
  | "washstand"
  | "sofa"
  | "table"
  | "chair"
  | "balustrade"
  | "newel"
  | "cherub-lamp"
  | "dome"
  | "clock-panel"
  | "pipes"
  | "caged-bulb"
  | "sconce"
  | "porthole"
  | "rope";

export interface Furniture {
  room: string;
  piece: PieceId;
  at: V2;
  /** The way it faces (rad); a blocking piece is square to the ship. */
  yaw: number;
  /** Stops the walker (a box from `PIECE_FOOTPRINT`, kit.ts). */
  blocks?: boolean;
}

export interface InteriorMap {
  ship: ShipId;
  rooms: readonly Room[];
  /** Open edges (doorways) between rooms. */
  seams: readonly Seam[];
  links: readonly InteriorLink[];
  shutDoors: readonly ShutDoor[];
  furniture: readonly Furniture[];
}
