/**
 * The ship data format. One file per ship (`titanic.ts`); the sim, the 3D
 * model and the hull diagram all read it, so it is the single source of
 * truth for a ship.
 *
 * Ship frame: metres, origin on the keel line at midships (half of LBP),
 * `x` forward, `y` to port, `z` up from the keel.
 */

export type ShipId = "titanic" | "lusitania";

export interface HullStation {
  x: number;
  /** [z, halfBreadth] pairs from the bottom of the section up to its top. */
  offsets: readonly (readonly [z: number, halfBreadth: number])[];
}

export interface Compartment {
  id: string;
  label: string;
  kind: "peak" | "hold" | "boiler" | "engine" | "shaft" | "stern";
  fromX: number;
  toX: number;
  aftBulkheadTopZ: number;
  fwdBulkheadTopZ: number;
  /** Share of the space flood water can fill (default by kind in the sim). */
  permeability?: number;
  /** Transverse extent. Missing = the full breadth (the 1.0 behaviour).
   *  centre: |y| <= y; port: y >= y; starboard: y <= -y (y > 0, metres). */
  span?: { side: "centre" | "port" | "starboard"; y: number };
  /** Open area (m²) joining this cell to the cell(s) beside it across a
   *  longitudinal bulkhead at the same x (coal doors, leaks). Default 0. */
  crossFlowM2?: number;
}

export interface Opening {
  compartmentId: string;
  areaM2: number;
  zLow: number;
  zHigh: number;
  x: number;
  side: "port" | "starboard";
  /** Shown seconds after the first event when it opens (default 0). */
  t?: number;
}

/** A row of side scuttles (portholes) that lets water in once under. */
export interface PortholeRow {
  z: number;
  fromX: number;
  toX: number;
  side: "port" | "starboard";
  /** Open area per metre of row when the portholes are open (m²/m). */
  openM2PerM: number;
  /**
   * The row follows the sheer, as a deck does: `z` is its height at the
   * row's middle, and at x it is z + sheerZ(x) − sheerZ(middle). Default
   * false (a level row at `z`).
   */
  followsSheer?: boolean;
}

export interface ScriptedEvent {
  t: number;
  kind: "steam-start" | "steam-stop" | "rocket" | "boat-lowered" | "explosion";
  index?: number;
}

export interface ShipSpec {
  id: ShipId;
  name: string;
  year: number;
  lbp: number;
  loa: number;
  beam: number;
  depth: number;
  draught: number;
  displacementT: number;
  kg: number;
  lcg: number; // mass and its centre (ship frame)
  /** Transverse centre of mass, + to port (m); default 0. */
  tcg?: number;
  stations: readonly HullStation[]; // ≥ 41 stations, aft to fwd, the full hull to the top of the shelter deck
  sheerZ: (x: number) => number; // height of the uppermost continuous deck edge at x
  superstructure: { fromX: number; toX: number; topZ: number }[]; // buoyant volume above the hull once sealed decks submerge (coarse boxes)
  compartments: readonly Compartment[]; // the 16 watertight compartments, aft to fwd
  realNight: readonly Opening[]; // the iceberg damage
  girder: { hogMaxNm: number; sagMaxNm: number }; // hull girder strength
  scripted: readonly ScriptedEvent[]; // historical non-physics events (t seconds after collision)
  funnels: { x: number; baseZ: number; topZ: number; dummy: boolean }[];
  decks: { name: string; z: number }[]; // Boat, A, B, C, D, E, F, G, Orlop, Tank top (for lights by deck and the diagram)
  seaDepthM: number; // 3,800 for Titanic
  /** Seconds after midnight of the first event (Titanic 23*3600+40*60). */
  clockStartS: number;
  /** What opened the hull: drives words, scene and What-if. */
  cause: "iceberg" | "torpedo";
  portholes?: readonly PortholeRow[];
  /** Forward speed at the first event and its decay (no propulsion model). */
  headway?: { startMs: number; halfLifeS: number };
  /**
   * Her wreck as surveyed, for the rest on the floor: a rule, not physics.
   * A body that lands listed at least `minListDeg` toward the side her
   * wreck lies on (`restDeg`, + to starboard as `roll`) eases over to
   * `restDeg`, or keeps its list if that is more; one that lands any
   * other way keeps the list it landed with. Missing: the 1.0 rest, which
   * eases a landed body upright (the Titanic's halves).
   */
  wreck?: { restDeg: number; minListDeg: number };
  /**
   * Her funnels' paint (sRGB): the body and the top band. The model and
   * the hull diagram both read it. Missing: the Titanic's buff with black
   * tops (the 1.0 look).
   */
  funnelPaint?: { funnel: number; top: number };
}
