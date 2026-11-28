import type { ShipId } from "../ships/types";
import type { Seam, Stair, V2 } from "../walk/types";

/**
 * The room kit's data (see README.md): a ship's rooms inside her, as walk
 * areas with a look. Pure data, no three.js. Ship frame, as the walk maps:
 * metres, keel at midships, x forward, y to port, z up.
 */

export type RoomKind =
  | "foyer"
  | "flight"
  | "landing"
  | "corridor"
  | "cabin"
  | "passage"
  | "lift"
  | "pool-hall";

/**
 * Walls: oak panelling, white panelling, white enamel, painted steel, or
 * glass (tinted, see-through, double-sided: a deck room's glass walls and
 * the vault over them).
 */
export type WallFinish = "oak" | "white-panel" | "enamel" | "steel" | "glass";
/** Floors; `tile` is pool mosaic, `teak` deck planking. */
export type FloorFinish =
  "lino" | "carpet" | "mosaic" | "steel" | "tile" | "teak";
/** How the room is lit (its lamps are `sconce`/`caged-bulb` furniture). */
export type LampStyle = "sconce" | "caged-bulb" | "dome" | "ceiling";

export interface RoomLook {
  finish: WallFinish;
  floor: FloorFinish;
  lamp: LampStyle;
  /** The side with portholes (an outboard wall), if any. */
  portholes?: "port" | "starboard";
  /**
   * A glass room's walls drawn solid instead (outline edge indices): the
   * pool hall's ends, where the lido decks stand a deck higher.
   */
  solidEdges?: readonly number[];
  /**
   * A glass room's dome over its flat glass roof (at its eaves, `ceilingM`):
   * its middle, half-length (x), half-width (y) and height (m).
   */
  dome?: { at: V2; a: number; b: number; rise: number };
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
  /**
   * A deck room (the Concordia's pool hall): walked as an open-deck area
   * (deck speed, jumping, never closed; every edge a wall), drawn by the
   * kit whenever walking on her. Its own data is its only source: a deck
   * map that has an area of its id takes it from here (`deckRoomWalk`).
   */
  deckRoom?: true;
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
  /** `glass`: a modern pair of glass doors in chrome frames (hers). */
  style: "oak" | "white" | "steel" | "glass";
}

export type PieceId =
  | "bed"
  | "single-bed"
  | "bunk"
  | "wardrobe"
  | "washstand"
  | "washbasin"
  | "sofa"
  | "table"
  | "chair"
  | "balustrade"
  | "newel"
  | "cherub-lamp"
  | "dome"
  | "clock-panel"
  | "pipes"
  | "fire-buckets"
  | "hose-reel"
  | "caged-bulb"
  | "sconce"
  | "porthole"
  | "rope"
  // Her modern pieces (lib/shipwreck/interior/modernPieces.ts, the same
  // ids): the rest join with her rooms (1.18).
  | "pool-edge"
  | "lounger"
  | "exit-sign";

export interface Furniture {
  room: string;
  piece: PieceId;
  at: V2;
  /** The way it faces (rad); a blocking piece is square to the ship. */
  yaw: number;
  /** Stops the walker (a box from `PIECE_FOOTPRINT`, kit.ts). */
  blocks?: boolean;
}

/** The picture on a room entry's button (the HUD draws it). */
export type EntryIcon = "staircase" | "bed" | "bunk" | "corridor";

/**
 * A room you can start a walk in from the camera picker (1.16): its
 * button's picture and words (aria-label only), the room and where to
 * stand in it, facing `yaw` (ship frame, rad, 0 the bow, + to port).
 */
export interface RoomEntry {
  id: string;
  /** "Grand Staircase": the button reads "Walk inside: Grand Staircase". */
  label: string;
  icon: EntryIcon;
  /** The room's id (a walkable room of this interior). */
  room: string;
  at: V2;
  yaw: number;
}

export interface InteriorMap {
  ship: ShipId;
  rooms: readonly Room[];
  /** Open edges (doorways) between rooms. */
  seams: readonly Seam[];
  links: readonly InteriorLink[];
  shutDoors: readonly ShutDoor[];
  furniture: readonly Furniture[];
  /** The rooms the camera picker can start a walk in (none: no buttons). */
  entries?: readonly RoomEntry[];
}
