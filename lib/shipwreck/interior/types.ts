import type { ShipId } from "../ships/types";
import type { Seam, Stair, V2 } from "../walk/types";
import type { ModernPieceId } from "./modernPieces";

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
  // Her modern rooms (the Concordia): a three-storey hall's floor and its
  // galleries, a balcony cabin and its balcony, a lift lobby, the theatre
  // and its stage, the kids' club, a glass lift's car at one stop, and the
  // glass-roofed pool hall (a deck room).
  | "atrium"
  | "gallery"
  | "stateroom"
  | "balcony"
  | "lobby"
  | "theatre"
  | "stage"
  | "club"
  | "lift-car"
  | "pool-hall";

/**
 * Walls: oak panelling, white panelling, white enamel, painted steel, or
 * glass (tinted, see-through, double-sided: a deck room's glass walls and
 * the vault over them). Hers (1.18): cabin wood veneer, cream
 * wallcovering, marble, the kids' club's bright murals, the theatre's dark
 * red.
 */
export type WallFinish =
  | "oak"
  | "white-panel"
  | "enamel"
  | "steel"
  | "glass"
  | "cabin-veneer"
  | "cream"
  | "marble"
  | "kids"
  | "theatre";
/**
 * Floors; `tile` is pool mosaic, `teak` deck planking. Hers (1.18): cabin
 * carpet, marble, `soft` (the kids' play mat), the stage's boards.
 */
export type FloorFinish =
  | "lino"
  | "carpet"
  | "mosaic"
  | "steel"
  | "tile"
  | "teak"
  | "cabin-carpet"
  | "marble"
  | "soft"
  | "stage-wood";
/**
 * How the room is lit (its lamps are `sconce`/`caged-bulb` furniture);
 * hers: recessed downlights, strip lights, a chandelier over the well.
 */
export type LampStyle =
  | "sconce"
  | "caged-bulb"
  | "dome"
  | "ceiling"
  | "downlight"
  | "strip"
  | "chandelier";

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
  /**
   * Takes the sea slowly, through her doors and vents (the Concordia's
   * deck 1 rooms; spec "Slow flooding"): its level rises toward the sea's
   * at most `ROOM_SEEP_M_PER_S` once the sea is over its lowest floor.
   */
  seep?: true;
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

/** The Titanic's (Edwardian) pieces. */
export type EdwardianPieceId =
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
  | "rope";

/**
 * Every piece: the Edwardian ones and her modern ones (one list,
 * `MODERN_PIECE_IDS` in modernPieces.ts: the lift car, shafts, rails, seat
 * rows, the stage, the pool, cabins' beds and sofas, the bar, the kids'
 * club's toys, exit signs, emergency lamps).
 */
export type PieceId = EdwardianPieceId | ModernPieceId;

export interface Furniture {
  room: string;
  piece: PieceId;
  at: V2;
  /** The way it faces (rad); a blocking piece is square to the ship. */
  yaw: number;
  /** Stops the walker (a box from `PIECE_FOOTPRINT`, kit.ts). */
  blocks?: boolean;
  /** A `theatre-seat-row`'s seats (default ten): its width and footprint. */
  seats?: number;
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

/** One stop of a lift: the deck, the room it opens onto and its door. */
export interface LiftStop {
  /** A name in spec.decks: the car's floor at this stop. */
  deck: string;
  /** The landing's floor stands this far over `deck` (m): the car's too. */
  raiseM?: number;
  /** The room the car's door opens onto (a walkable room). */
  landing: string;
  /** The door: an edge of the landing's outline and of the car's plan. */
  door: readonly [V2, V2];
}

/**
 * A lift shaft (the Concordia's glass lifts): one car's plan, stopping at
 * each of `stops` (bottom to top). `withInterior` makes a `lift-car` area
 * per stop (`<id>@<deck>`), seamed to its landing by the door (merge.ts
 * `liftCars`).
 */
export interface LiftShaft {
  id: string;
  car: { min: V2; max: V2 };
  stops: readonly LiftStop[];
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
  /** Lift shafts with a car per stop (hers). */
  lifts?: readonly LiftShaft[];
  /**
   * The rooms close at this heel (|frame.listDeg|, degrees) as well as when
   * she breaks (hers: 30). Missing: only the break closes them.
   */
  closeAtHeelDeg?: number;
  /** On emergency power her lamps flicker more as she leans (hers). */
  emergencyFlicker?: true;
}
