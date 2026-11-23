/**
 * The ship data format. One file per ship (`titanic.ts`); the sim, the 3D
 * model and the hull diagram all read it, so it is the single source of
 * truth for a ship.
 *
 * Ship frame: metres, origin on the keel line at midships (half of LBP),
 * `x` forward, `y` to port, `z` up from the keel.
 */

export type ShipId = "titanic" | "lusitania" | "fitzgerald" | "britannic";

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
  /**
   * Cargo stowed in this space (t), part of `displacementT`: the mass
   * model lays it along the space by section area, and the kind shares
   * (machinery, stores, steel) take the rest of the displacement. Missing:
   * none (the 1.0 shares of the whole displacement).
   */
  cargoT?: number;
  /** Can the pumps work this space? Default: every space for a ship with
   *  `pumpsM3s`, else the machinery spaces (1.0). A laden ore hold cannot
   *  be pumped (the pellets choke the suction). */
  pumped?: boolean;
  /**
   * The opening (m²) the sea finds once the space's deck is VENT_BURST_M
   * under and its trapped air gives way. Missing: VENT_BURST_M2 (a liner's
   * vents, skylights and hatch covers bursting). A ballast tank has no
   * hatch or skylight: its air leaves by its own vent pipes.
   */
  burstM2?: number;
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

/** A watertight door (or other opening) in the transverse bulkhead between
 *  two neighbouring compartments; orifice flow on the head difference. */
export interface BulkheadDoor {
  id: string;
  aftId: string; // compartment ids, neighbours
  fwdId: string;
  x: number;
  zLow: number;
  zHigh: number;
  areaM2: number;
  /** "door": a watertight door (SimOptions.doorsClosed shuts it);
   *  "damage": a bulkhead torn by the blast (never shuts). */
  kind: "door" | "damage";
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
  /**
   * The row is above the top of an inner skin (a double hull to a deck
   * under it): where a space has wing cells (`span`), its pieces open into
   * the space inside them, not the wing. Default false (the outermost
   * cell, a bunker's shell).
   */
  inboard?: boolean;
}

/** One wave component of a storm (deterministic: no Math.random). */
export interface WaveComponent {
  amplitudeM: number;
  /** Deep-water dispersion gives its wavelength, g·T²/2π (deep: the sea
   *  is deeper than half of it). */
  periodS: number;
  /** Direction the wave travels toward, degrees from the ship's +x at the
   *  first event, + toward port. */
  dirDeg: number;
  /** Radians. */
  phase: number;
}

/** A group of big waves (the "three sisters") in a storm. */
export interface WaveGroup {
  /** Shown seconds after the first event when its biggest crest passes
   *  (the sim rides it on the sea's nearest crest: `lockGroups`). */
  t: number;
  /** Crest-to-trough height of its biggest wave (m), on top of the sea. */
  heightM: number;
  /** How many big waves (at least half the height) it holds. */
  count: number;
  periodS: number;
  /** Direction it travels toward, as `WaveComponent.dirDeg`. */
  dirDeg: number;
  /**
   * Earth position (m) its biggest crest passes at `t`. Missing: where the
   * ship's headway (and the sim's drift) has carried her by then
   * (`stormOf(spec)` fills it in), so the group reaches her.
   */
  x?: number;
  y?: number;
}

export interface StormSpec {
  components: readonly WaveComponent[];
  /** Significant height the components were fitted to (m), for tests and words. */
  hsM: number;
  /** Extra wave groups, at the ship's position unless they say where. */
  groups?: readonly WaveGroup[];
  /**
   * The sea building or easing through time: [shown s, factor] pairs, t
   * ascending, linear between them and held beyond the ends; the factor
   * scales the components (the groups keep their own heights). Missing:
   * a steady sea. `hsM` is the components' height at factor 1.
   */
  ramp?: readonly (readonly [t: number, factor: number])[];
  /** For the scene (spray, snow drift) and words. */
  windKn: number;
}

/** An opening in the deck that the sea reaches only when a wave puts water over it. */
export interface DeckOpening {
  id: string;
  compartmentId: string;
  /** "vent" and "split" are topside damage (`SimOptions.topsideDamage`). */
  kind: "hatch" | "vent" | "split" | "other";
  x: number;
  /** + to port (ship frame). */
  y: number;
  /** Height of the opening's lip above the keel (coaming or vent top), m. */
  z: number;
  /** Leak area while intact (gaps under a hatch cover, a broken vent's pipe), m². */
  areaM2: number;
  /** A hatch cover gives way once the water over it reaches this head (m); then `failedAreaM2` opens. */
  failHeadM?: number;
  failedAreaM2?: number;
  /** Seconds after the first event it starts to leak (default 0). */
  t?: number;
  /**
   * A hatch cover with every clamp done up (a What-if choice): no leak
   * while it holds, and `HATCH_TIGHT_FAIL_FACTOR` times the failure head,
   * as `SimOptions.hatchesTight` does for every hatch.
   */
  tight?: boolean;
}

/**
 * An opening a run starts with: one in the hull (`Opening`) or one in her
 * deck the waves reach (`DeckOpening`, which has a `kind`). A run's deck
 * openings are the ones it is given, if any; else the ship's own.
 */
export type RunOpening = Opening | DeckOpening;

export function isDeckOpening(o: RunOpening): o is DeckOpening {
  return "kind" in o;
}

/** The hull openings of a run's openings. */
export function hullOpenings(list: readonly RunOpening[]): Opening[] {
  return list.filter((o): o is Opening => !isDeckOpening(o));
}

export interface ScriptedEvent {
  t: number;
  kind:
    | "steam-start"
    | "steam-stop"
    | "rocket"
    | "boat-lowered"
    | "explosion"
    | "radio";
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
  /** `falls: false`: the funnel never falls (no `funnel-falls`; the liners'
   *  stays rule is for their stayed funnels). Missing: it may. */
  funnels: {
    x: number;
    baseZ: number;
    topZ: number;
    dummy: boolean;
    falls?: false;
  }[];
  decks: { name: string; z: number }[]; // Boat, A, B, C, D, E, F, G, Orlop, Tank top (for lights by deck and the diagram)
  seaDepthM: number; // 3,800 for Titanic
  /** Seconds after midnight of the first event (Titanic 23*3600+40*60). */
  clockStartS: number;
  /** What opened the hull: drives words, scene and What-if. */
  cause: "iceberg" | "torpedo" | "storm" | "mine";
  portholes?: readonly PortholeRow[];
  /**
   * Seconds shown before the first event in a run with holes (a torpedo's
   * run-in: its wake streaks in before the hit). Default 0 (the Titanic).
   * Shown time is negative then; the sim starts at the hit.
   */
  preRollS?: number;
  /**
   * A run's timeline shows only its last part: this fraction of the story
   * (0.1 = the last 10%), from when the runner finishes. Until then the
   * playback holds at the first moment. Missing: the whole run (the
   * Fitzgerald's afternoon is hours of storm before a few minutes' loss).
   */
  timelineTail?: number;
  /**
   * Forward speed at the first event (no propulsion model) and, if given,
   * its half-life from then. Missing `halfLifeS`: she keeps her speed (her
   * engine still turning) until she goes under, then loses it with
   * `HEADWAY_LOST_HALF_LIFE_S`.
   */
  headway?: {
    startMs: number;
    halfLifeS?: number;
    /** [shown s, m/s] pairs, t ascending, linear, held past the ends;
     *  overrides startMs/halfLifeS while she is afloat. */
    profile?: readonly (readonly [t: number, ms: number])[];
    /** [shown s, yaw deg] pairs (+ to port, i.e. a turn to starboard is −),
     *  linear; the heading her way carries her along. */
    turn?: readonly (readonly [t: number, yawDeg: number])[];
    /** Dynamic head factor Cp on hull openings and porthole rows with
     *  x ≥ fromX: head += Cp·u²/2g. */
    ram?: { cp: number; fromX: number };
  };
  /** Watertight doors and torn bulkheads between neighbouring compartments. */
  doors?: readonly BulkheadDoor[];
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
  /** Water density (kg/m³). Missing: RHO (1025, sea water). */
  waterDensity?: number;
  /** A storm: one wave field for the deck openings and the sea drawn. */
  storm?: StormSpec;
  /** Openings in her deck the waves reach (hatches, vents). */
  deckOpenings?: readonly DeckOpening[];
  /**
   * Her open weather deck (a laker's: open rails, no bulwark), where green
   * water stands and runs (`deckWater.ts`): bays sampled at `bayX`
   * (evenly spaced, aft to forward: one a hatch), from `fromX` to `toX`
   * (her houses), the deck `camberM` higher at the centre line than at
   * side. Missing: no deck water (the openings see only the sea).
   */
  openDeck?: {
    fromX: number;
    toX: number;
    bayX: readonly number[];
    camberM: number;
  };
  /** Hull damage from a grounding, added only by `SimOptions.shoal`. */
  shoalOpenings?: readonly Opening[];
  /** Bilge pumps (m³/s, total) that start at the first event and work
   *  every hull space. Missing: the 1.0 behaviour (PUMP_M3S, machinery). */
  pumpsM3s?: number;
  /** She reaches shelter at this shown time if still afloat: the run ends `floated`. */
  shelter?: { t: number; name: string };
  /**
   * How much faster than real time the way down plays once every part is
   * under (shown time runs this many times slower than real). Missing:
   * DESCENT_TIME_SCALE (6). 1: in real time (ruling R11).
   */
  descentTimeScale?: number;
  /**
   * Per-part wreck rules after a break (a rule, not physics, like `wreck`):
   * the bow by the `wreck` rule's terms; the stern, once wholly under,
   * rolls over during its fall and lands at `restDeg` (about 180: upside
   * down). Missing: `wreck`, else the 1.0 rest, for each part.
   */
  wreckParts?: {
    bow?: { restDeg: number; minListDeg: number };
    /** `rollDegS`: its rate (degrees per real second) from when it is
     *  wholly under; missing, STERN_CAPSIZE_DEG_S. */
    stern?: { capsize: true; restDeg: number; rollDegS?: number };
  };
}
