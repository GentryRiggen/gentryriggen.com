/**
 * The ship data format. One file per ship (`titanic.ts`); the sim, the 3D
 * model and the hull diagram all read it, so it is the single source of
 * truth for a ship.
 *
 * Ship frame: metres, origin on the keel line at midships (half of LBP),
 * `x` forward, `y` to port, `z` up from the keel.
 */

export type ShipId =
  | "titanic"
  | "lusitania"
  | "fitzgerald"
  | "carpathia"
  | "britannic"
  | "concordia"
  | "poseidon";

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
  /** A What-if editor skips this space's chip: it is tapped on the hull only. */
  noChip?: boolean;
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
  /** A compartment's id, or a superstructure box's (`superstructure[i].id`). */
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
  /** `false`: left out of her ride (`waveRide`): her rogue wave
   *  (`ShipSpec.wave`), whose roll is a rule. Missing: in her ride. */
  ride?: false;
}

/** A What-if spot of a wave ship (`ShipSpec.wave.spots`): what the wave
 *  smashes there. */
export interface WaveSpot {
  id: string;
  label: string;
  openings: readonly Opening[];
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
  /** Shown seconds after the first event; real seconds for a ship with
   *  `agroundTimeScale` (her shown time runs fast once aground). */
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

/**
 * A torpedo ship's own hits (the Carpathia's): one torpedo per chosen
 * compartment, on her own side, in her own order and gap. Missing on a
 * torpedo ship: the 1.1 rule (the real hit moved along her starboard side).
 */
export interface TorpedoSpec {
  side: "port" | "starboard";
  /** Order hits land along her length in a run with several. */
  order: "aft-first" | "fwd-first";
  /** Seconds between successive hits (hit k lands k·staggerS after the first). */
  staggerS: number;
  /** One torpedo's hole in her side: total area, its heights above the keel,
   *  and its length along her side. A hole across a bulkhead opens both
   *  spaces, the area shared by overlap length. */
  hole: { areaM2: number; zLow: number; zHigh: number; lengthM: number };
  /** Where a hit at a spot strikes (ship-frame x of the hole's middle).
   *  Missing for a spot: the spot's compartment middle. */
  hitX?: Readonly<Record<string, number>>;
  /** A later torpedo, offered as its own What-if spot (FINISHER_SPOT):
   *  strikes compartment `spotId` at shown `t`. */
  finisher?: { spotId: string; t: number };
  /** The What-if spots that give her real run (FINISHER_SPOT included if real). */
  realSpots: readonly string[];
}

/**
 * One of a ship's paints (a livery), switched live in the game. Plain data:
 * the model's recipe paints it (components/shipwreck/model/README.md).
 */
export interface Livery {
  /** "dazzle-1918", "cunard-1912", "war-1915", "cunard-1907", ... */
  id: string;
  /** Spoken and aria words, e.g. "Her 1912 Cunard colours". */
  label: string;
  year: number;
  /** Exactly one per ship. */
  default?: true;
  /** Where each detail of the paint comes from (the model README cites). */
  sources: readonly string[];
  /** The paint button's two swatches (sRGB): what the livery looks like. */
  swatches: readonly [number, number];
  /** Her funnels' paint in it (the hull diagram's and the title's). */
  funnelPaint?: { funnel: number; top: number };
  /**
   * The paint tray's little ship: her hull, her funnels and their tops
   * (sRGB). `band`: a stripe along the hull (the hospital ship's green);
   * `dazzle`: drawn striped.
   */
  look: LiveryLook;
  /**
   * A paint just for fun: colours real ships of her kind wore, never hers.
   * Painted over livery `from` (default her default): her shape in that
   * livery, these colours on her hull, funnels, masts and boats.
   */
  fun?: { from?: string; paint: FunPaint };
}

/** The paint tray's little ship (sRGB). */
export interface LiveryLook {
  hull: number;
  funnel: number;
  top: number;
  band?: number;
  dazzle?: true;
}

/**
 * A fun paint's colours (sRGB): the hull's topsides, its bottom under the
 * paint line and boot-top (default hers), the line under the sheer (null:
 * none), the funnels and their tops and bands, the masts and the
 * lifeboats (default hers).
 */
export interface FunPaint {
  topsides: number;
  bottom: number;
  boot?: number;
  sheerLine: number | null;
  funnel: number;
  funnelTop: number;
  mast?: number;
  boat?: { hull: number; bottom: number; cover?: number };
}

/** The story a ship plays: a crossover's `story`, else her own. */
export function storyIdOf(spec: Pick<ShipSpec, "id" | "story">): ShipId {
  return spec.story ?? spec.id;
}

/** Her real paints (the tray's first row), in her list's order. */
export function realLiveries(spec: ShipSpec): readonly Livery[] {
  return (spec.liveries ?? []).filter((l) => !l.fun);
}

/** Her fun paints (the tray's second row), in her list's order. */
export function funLiveries(spec: ShipSpec): readonly Livery[] {
  return (spec.liveries ?? []).filter((l) => l.fun);
}

/** Her livery `id`, or undefined. */
export function liveryOfSpec(
  spec: ShipSpec,
  id: string | null | undefined
): Livery | undefined {
  return spec.liveries?.find((l) => l.id === id);
}

/** The ship's default livery's id, or null when she has no choice. */
export function defaultLivery(spec: ShipSpec): string | null {
  const list = spec.liveries;
  if (!list || list.length < 2) return null;
  return (list.find((l) => l.default) ?? list[0]).id;
}

/**
 * The livery to show: `id` when it is one of hers, else her default (an
 * unknown or missing id, a save from another build). Null: no choice.
 */
export function resolveLivery(
  spec: ShipSpec,
  id: string | null | undefined
): string | null {
  const fallback = defaultLivery(spec);
  if (fallback === null) return null;
  return spec.liveries!.some((l) => l.id === id) ? id! : fallback;
}

/** The livery after `id` in her list (the paint button's next), or null. */
export function nextLivery(
  spec: ShipSpec,
  id: string | null | undefined
): Livery | null {
  const list = spec.liveries;
  const now = resolveLivery(spec, id);
  if (!list || now === null) return null;
  const i = list.findIndex((l) => l.id === now);
  return list[(i + 1) % list.length];
}

/** Her funnels' paint in a livery (the hull diagram's and the title's). */
export function funnelPaintOf(
  spec: ShipSpec,
  id: string | null | undefined
): { funnel: number; top: number } | undefined {
  const now = resolveLivery(spec, id);
  return (
    spec.liveries?.find((l) => l.id === now)?.funnelPaint ?? spec.funnelPaint
  );
}

/**
 * The floor near a coast, in the earth frame (metres, x along her heading at
 * the first event, y to port, origin at her midships then).
 */
export interface SeabedSpec {
  /** Shoreline near her track, earth metres (x along her heading at the
   *  first event, y to port), in order along the coast. */
  shore: readonly (readonly [x: number, y: number])[];
  /** Which side of the polyline is sea (+1: left of its direction). */
  seaSide: 1 | -1;
  /** [metres offshore, depth m] pairs, ascending, linear, held past the end. */
  profile: readonly (readonly [offshoreM: number, depthM: number])[];
  /** Rock bumps: depth min(profile, topDepthM + (r/radiusM)²·rise) inside radiusM. */
  rocks?: readonly {
    x: number;
    y: number;
    radiusM: number;
    topDepthM: number;
  }[];
}

export interface ShipSpec {
  id: ShipId;
  /**
   * Any ship in any wreck (`crossover`): the ship whose story (sea, place,
   * time, what opened the hull) she plays. Missing: her own. `id` stays
   * hers: her model, rooms, decks and paint.
   */
  story?: ShipId;
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
  /**
   * Buoyant volume above the hull once sealed decks submerge (coarse
   * boxes, from the deck edge, or their own `baseZ`, up to `topZ`). `halfBreadthM`: a deckhouse
   * inboard of an open deck, no wider than this either side of the centre
   * line (the Carpathia's stern house); missing, as wide as the deck.
   */
  superstructure: {
    fromX: number;
    toX: number;
    topZ: number;
    halfBreadthM?: number;
    /** A named space: openings may name it (`Opening.compartmentId`), its
     *  water is in `SimFrame.boxWater`. */
    id?: string;
    /** Its floor (m above the keel): a tier stacked on another box.
     *  Missing: the deck edge (`sheerZ`), as every earlier ship. */
    baseZ?: number;
  }[];
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
  cause: "iceberg" | "torpedo" | "storm" | "mine" | "rocks" | "wave";
  /** Torpedo ship's hits (side, order, hole). Missing: the 1.1 rule (the real
   *  hit moved along her starboard side, aft first, HIT_STAGGER_S apart). */
  torpedo?: TorpedoSpec;
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
    /**
     * A scripted drift (a rule, not physics, as `turn` is): [shown s,
     * earth x, earth y, heading deg (+ to port, 0 at the first event)],
     * t ascending; her origin follows it (Catmull-Rom on position,
     * shortest way on heading, held past the ends) until her first floor
     * touch, and her way through the water is its speed. Overrides
     * startMs, halfLifeS, profile and turn for her position and heading.
     */
    path?: readonly (readonly [
      t: number,
      x: number,
      y: number,
      yawDeg: number,
    ])[];
    /** The same until it diverges; used with SimOptions.toSea. */
    pathToSea?: readonly (readonly [
      t: number,
      x: number,
      y: number,
      yawDeg: number,
    ])[];
    /**
     * The drift is hers only in a run whose hull openings reach one of
     * these spaces (her power: a rule, as the path is); any other run
     * keeps her way (`startMs`, straight on). Missing: every run drifts.
     */
    pathWhenOpen?: readonly string[];
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
  /**
   * The paints she can be shown in (R23: one `default`). Missing or one
   * entry: no choice. The model's recipe maps each id to its paint
   * (components/shipwreck/model/README.md, "Liveries").
   */
  liveries?: readonly Livery[];
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
   * Ruling R22 (the Carpathia): a whole hull that lands on its bow in water
   * shallower than she is long swings down about that contact no faster
   * than the water lets it (her weight in water against pressure drag on
   * her plan: `descent.ts`, `pivotRate`), and logs `stern-lands` when her
   * stern reaches the floor, not as her bow touches. Missing: the 1.0
   * plough rule (she eases to rest in a few seconds).
   */
  pivotDrag?: true;
  /**
   * Her scripted events (`scripted`) count from her first hit, not from
   * t = 0: a What if whose first torpedo comes late (the Carpathia's
   * U-boat alone) has no rockets or boats before it. Missing: from t = 0.
   */
  scriptedFromFirstHit?: true;
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
  /**
   * The sea floor near a coast (a floor that varies with position): depth
   * from the distance offshore, plus rock bumps. The sim's floor, the
   * scene's floor and the camera's clamp all read `floorAt`
   * (sim/seabed.ts). Missing: the flat floor at `seaDepthM`.
   */
  seabed?: SeabedSpec;
  /**
   * The hole a What-if gives a compartment the real night did not tear
   * (a `"rocks"` ship's). Missing: the iceberg's 0.2 m² on her starboard
   * side.
   */
  gash?: {
    side: "port" | "starboard";
    zLow: number;
    zHigh: number;
    areaM2: number;
  };
  /**
   * Heeling moments from outside (physics with cited inputs), in roll like
   * any moment. `wind`: a steady wind from `fromDeg` (earth, + to port of
   * her heading at the first event, the way the wind comes from) of `kn`
   * knots on `areaM2` of her side, its centre `leverM` above the centre of
   * the underwater side, drag coefficient `cd`: M = ½ ρ_air C_d A V²
   * cos β |cos β| h, β off her beam. `rock`: a mass (t) held at a
   * ship-frame point from shown `t`.
   */
  heel?: {
    wind?: {
      fromDeg: number;
      kn: number;
      areaM2: number;
      leverM: number;
      cd: number;
    };
    rock?: { t: number; massT: number; x: number; y: number; z: number };
    /**
     * Weight moved across her (her people at their muster stations and
     * her boats swung out on one side): `massT` shifted from the centre
     * line to `y` (m, + to port), ramped in from shown `fromT` to `toT`.
     * A moment only (massT·g·y), no weight added.
     */
    muster?: { fromT: number; toT: number; massT: number; y: number };
  };
  /**
   * The blackout from the water (a rule, its threshold calibrated): the
   * lights go out (`lights-out`) and the pumps stop once the water in
   * `compartmentId` is `depthM` deep; then `SimFrame.power` is
   * `emergencyLight`, never 0. Replaces the 1.0 dynamo rule. Missing: the
   * dynamo rule.
   */
  blackout?: {
    compartmentId: string;
    depthM: number;
    emergencyLight: number;
    /** Out once |roll| passes this (degrees; a rule, its threshold
     *  calibrated). Missing: only the water. */
    listDeg?: number;
  };
  /**
   * The rest aground (a rule, not physics, like `wreck`): a floating body
   * touching the floor with its way lost and listed at least `minListDeg`
   * toward `restDeg`'s side rolls along `pace` from wherever physics left
   * it, never back, to `restDeg`, seated on the floor; then the run ends
   * `aground`. Missing: no rule.
   */
  aground?: {
    restDeg: number;
    minListDeg: number;
    /** [real s after the first event, roll deg] pace, ascending. */
    pace: readonly (readonly [realT: number, deg: number])[];
  };
  /**
   * Once `aground` fires, shown time runs this many times slower than real
   * (as `descentTimeScale` does under water). Missing: 1.
   */
  agroundTimeScale?: number;
  /**
   * Water in her superstructure boxes weighs where it lies (its own
   * transverse centre: the low side it came in by), not on the centre line
   * (the 1.0 rule: cabins cut it up). A box flooded to the sea's level is
   * then buoyant only by what water cannot fill, as it should be once it
   * is deep in the sea (a cruise ship heeled past her deck edge). Missing:
   * the 1.0 rule.
   */
  boxWaterAtSide?: true;
  /**
   * The share of the breadth at a bulkhead top water spills across along
   * her bulkhead deck (physics, a stated input: her closed splashtight
   * doors, leaking, are the weir). Missing: SPILL_BREADTH (0.1, a liner's
   * deck cut up by cabins and passages).
   */
  spillBreadth?: number;
  /**
   * Air caught in her spaces (physics: Boyle, the orifice laws; sim README
   * "Trapped air"). Each space sealed from the air above the sea keeps its
   * air, squeezed by the sea, and loses it only through openings under the
   * sea where its pressure beats the sea's, and through these leaks.
   * Missing: none (the 1.0 flooding: a space fills to the sea's level).
   */
  trappedAir?: {
    /** Stated slow leak per space (m²), by kind; boxes use `box`. */
    leakM2: Partial<Record<Compartment["kind"] | "box", number>>;
  };
  /**
   * The rogue wave (a rule, not physics, for her roll): its group joins
   * her storm (`stormOf`), its biggest crest at her at `group.t`, and is
   * left out of her ride (`ride: false`); from then her roll eases
   * (smoothstep) to `peakDeg` over `rollS` real seconds, then physics owns
   * it from rest (`wave.ts`). Missing: no wave.
   */
  wave?: {
    group: WaveGroup;
    /** The roll rule's peak (degrees, + to starboard). */
    peakDeg: number;
    /** Its duration (real s). */
    rollS: number;
    /** What if: the smaller wave (its height and its rule's peak). */
    smaller: { heightM: number; peakDeg: number };
    /** What if: the wave from ahead (its direction); no roll rule, the
     *  group is in her ride. */
    ahead: { dirDeg: number };
    /** What it smashes, aft to forward. `fwd` spots only from ahead (it
     *  breaks over her bow). */
    spots: readonly (WaveSpot & { fwd?: true })[];
    /**
     * The breaking wave's green water and burst windows in her boxes (a
     * rule, not physics: no breaking-wave impact model): during the real
     * wave's roll rule, box `id` (a `superstructure[i].id`) fills to at
     * least `fill` of its volume, linearly from `fromU` to `toU` of
     * `rollS` (0..1); its air goes out with the water's volume. From the
     * hand-off physics carries the water. Only in a run of the real wave
     * (not the smaller one or from ahead) with one of `spots` open (its
     * glass broken: every opening of that spot in the run). Missing: none.
     */
    boxFlood?: readonly {
      id: string;
      fill: number;
      fromU: number;
      toU: number;
      /** The What-if spots whose broken glass lets it in. */
      spots: readonly string[];
    }[];
  };
  /**
   * Once `capsized` fires, shown time runs this many times slower than
   * real (as `agroundTimeScale`). Missing: 1.
   */
  capsizeTimeScale?: number;
  /**
   * A rule: a run whose ship is whole, afloat and never `capsized` ends
   * `floated` (`sheltered`) once she is within `maxListDeg` at or after
   * `afterS` shown seconds from the wave (`wave.group.t`). Missing: no
   * such end.
   */
  rideOut?: { afterS: number; maxListDeg: number };
  /**
   * The run's end (shown s after the first event; a rule): there a body
   * afloat keel up ends `capsized`. Missing: END_T (6:00 AM), no such
   * outcome.
   */
  endS?: number;
}
