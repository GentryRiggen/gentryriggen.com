import { stormComponents } from "../sim/waves";
import { cruiseFun } from "./funPaints";
import type {
  Compartment,
  HullStation,
  Livery,
  Opening,
  ShipSpec,
  StormSpec,
} from "./types";

/**
 * The Poseidon: a made-up cruise ship (the first in the game), of our own
 * design, that evokes the one in the 2006 film. On New Year's Eve, near
 * midnight, in the open North Atlantic, a giant rogue wave hits her port
 * side and rolls her over, keel up (a rule); then physics: the sea pours
 * in through what the wave smashed, she floats upside down on the air
 * caught inside her, and as it leaks out she sinks.
 *
 * Her particulars are ours (R3), chosen in the range real cruise ships of
 * 2000–2010 have [CR]: the Concordia class (290 m, 35.5 m, 8.2 m), the
 * Carnival Conquest class (290 m, 35.4 m, 8.2 m), the Grand class (290 m,
 * 36 m, 8.5 m) and the Voyager class (311 m, 38.6 m, 8.8 m). Every figure
 * marked "ours" is ours; the sim README ("The Poseidon's data") gives the
 * ranges, the wave's and the sea's sources ([DRA], [QE2], [ROG], [ATL],
 * [SOL], [BOY], [SEW]) and every assumption.
 *
 * Ship frame: metres, origin on the keel at midships (half of LBP), x
 * forward, y to port, z up.
 */

function round(v: number, step: number): number {
  return Math.round(v / step) * step;
}

/** Between perpendiculars (ours; [CR] 247–270 m). */
const LBP = 265;
/** Overall (ours; [CR] 290–311 m). */
const LOA = 305;
/** Moulded beam (ours; [CR] 35.4–38.6 m). */
const BEAM = 36.0;
const HALF = BEAM / 2;
/** Draught, even keel (ours; [CR] 8.2–8.8 m). */
const DRAUGHT = 8.4;

// ---------------------------------------------------------------------------
// Decks (ours): deck 0, the bulkhead deck, 14.5 m over the keel (R3); the
// decks above every 2.8 m (the Concordia's deck spacing [MIT]): deck 1 at
// 17.3 m, deck 14 (her top) at 53.7 m. Her hull's steel side shell runs to
// deck 1 (`depth`); the superstructure's tiers stand on it.

export const DECK0_Z = 14.5;
const DECK_STEP_M = 2.8;
/** Height of deck n over the keel (n = 0 … 14). */
export function deckZ(n: number): number {
  return round(DECK0_Z + n * DECK_STEP_M, 0.01);
}
/** The top of her hull's side shell: deck 1. */
export const HULL_TOP_Z = deckZ(1);
/** Her decks, top down: 14 to 0. */
export const POSEIDON_DECKS: { name: string; z: number }[] = Array.from(
  { length: 15 },
  (_, i) => ({ name: String(14 - i), z: deckZ(14 - i) })
);

// ---------------------------------------------------------------------------
// Hull (ours). A cruise ship's form at her particulars, as the Concordia's
// (sim README, "Her hull"): a long parallel midbody, a flat bottom and a
// round bilge, a bulbous bow with a raked stem far forward (her LOA is
// 40 m over her LBP), a wide transom stern whose run lifts the bottom
// clear of the water aft of her rudders. Her fullness is set so she
// displaces about 57,500 t at 8.4 m (block coefficient 0.70 on LBP, R3:
// 265 × 36 × 8.4 × 0.70 × 1.025).

/** Her transom (aft end) and stem top: LOA 305 m. */
export const STERN_X = -148;
export const STEM_X = round(STERN_X + LOA, 0.01);
/** Where the waterline ends forward (the stem at the waterline). */
const STEM_WL_X = 133;
/** The parallel midbody (ours). */
const MID_AFT_X = -25;
const MID_FWD_X = 15;
/** The run: the bottom rises from here aft to the transom's foot. */
const RUN_X = -88;
const TRANSOM_FOOT_Z = 9.4;
/** The forefoot: the bottom rises from here to the stem. */
const FOREFOOT_X = 128;

/** Height of the section's bottom at x. */
function bottomZ(x: number): number {
  if (x < RUN_X) {
    const u = (RUN_X - x) / (RUN_X - STERN_X);
    return TRANSOM_FOOT_Z * u ** 1.5;
  }
  if (x > FOREFOOT_X) {
    if (x <= STEM_WL_X + 4) {
      // The bulb's foot.
      const u = (x - FOREFOOT_X) / (STEM_WL_X + 4 - FOREFOOT_X);
      return 2.0 * u ** 2;
    }
    // The raked stem: from the bulb up to the stem top under deck 1.
    const u = (x - STEM_WL_X - 4) / (STEM_X - STEM_WL_X - 4);
    return 2.0 + (HULL_TOP_Z - 0.5 - 2.0) * u ** 0.75;
  }
  return 0;
}

/** Waterline half-breadth at x (the widest under the waterline). */
function waterlineHB(x: number): number {
  if (x >= MID_AFT_X && x <= MID_FWD_X) return HALF;
  if (x > MID_FWD_X) {
    const u = Math.min(1, (x - MID_FWD_X) / (STEM_WL_X + 6 - MID_FWD_X));
    return HALF * (1 - u ** 1.9);
  }
  const u = (MID_AFT_X - x) / (MID_AFT_X - STERN_X);
  return HALF * (1 - AFT_TAPER * u ** 1.7);
}

/** Deck-1 half-breadth at x (the flare forward, the wide transom aft). */
function deckHB(x: number): number {
  if (x <= 45) {
    if (x >= MID_AFT_X) return HALF;
    const u = (MID_AFT_X - x) / (MID_AFT_X - STERN_X);
    return HALF * (1 - 0.16 * u ** 2);
  }
  const u = Math.min(1, (x - 45) / (STEM_X - 45));
  return HALF * Math.sqrt(Math.max(0, 1 - u ** 2.2));
}

/**
 * Her fullness (ours, tuned to 57,500 t at 8.4 m with her centre of
 * buoyancy near midships: block coefficient 0.705 on LBP): how much her
 * waterline narrows aft, and the sections' superellipse exponent
 * amidships and how far it falls to each end.
 */
const AFT_TAPER = 0.5;
const FULL_MID = 6;
const FULL_FWD = 4.6;
const FULL_AFT = 4.6;
/** Superellipse exponent: full sections amidships, finer to the ends. */
function fullness(x: number): number {
  if (x >= MID_AFT_X && x <= MID_FWD_X) return FULL_MID;
  if (x > MID_FWD_X) {
    const u = Math.min(1, (x - MID_FWD_X) / (STEM_WL_X - MID_FWD_X));
    return FULL_MID - FULL_FWD * u ** 0.9;
  }
  const u = (MID_AFT_X - x) / (MID_AFT_X - STERN_X);
  return FULL_MID - FULL_AFT * u;
}

const Z_LEVELS = [
  0,
  0.25,
  0.6,
  1.1,
  1.8,
  2.6,
  3.6,
  5,
  6.6,
  DRAUGHT,
  10.5,
  12.5,
  DECK0_Z,
  HULL_TOP_Z,
];

function buildStations(): HullStation[] {
  const n = 61;
  const out: HullStation[] = [];
  for (let i = 0; i < n; i += 1) {
    const x = round(STERN_X + ((STEM_X - STERN_X) * i) / (n - 1), 0.01);
    const zb = Math.min(bottomZ(x), HULL_TOP_Z - 0.5);
    const wl = waterlineHB(x);
    const dk = deckHB(x);
    const k = fullness(x);
    // The shaped part (superellipse) from the bottom to the waterline, or
    // 2 m over a bottom that is already above it (the run, the stem).
    const zs = Math.min(HULL_TOP_Z, Math.max(DRAUGHT, zb + 2));
    const zs0 = [zb, ...Z_LEVELS.filter((z) => z > zb + 0.05)];
    if (zs > DRAUGHT && !zs0.includes(zs)) zs0.push(zs);
    zs0.sort((a, b) => a - b);
    const offsets: [number, number][] = [];
    for (const z of zs0) {
      let hb: number;
      if (z <= zs) {
        const u = Math.min(1, Math.max(0, (z - zb) / (zs - zb)));
        hb = wl * Math.pow(1 - Math.pow(1 - u, k), 1 / k);
      } else {
        // Above: straight to the deck-1 breadth (flare or tumble).
        const u = (z - zs) / (HULL_TOP_Z - zs);
        hb = wl + (dk - wl) * Math.min(1, Math.max(0, u));
      }
      offsets.push([round(z, 0.001), round(Math.max(0, hb), 0.001)]);
    }
    out.push({ x, offsets });
  }
  return out;
}
const STATIONS = buildStations();

/** The top of her hull (deck 1's edge): level, as a cruise ship's is. */
function poseidonSheerZ(): number {
  return HULL_TOP_Z;
}

// ---------------------------------------------------------------------------
// Watertight subdivision (ours, R4): 20 compartments. The after peak
// bulkhead 22 m forward of her transom, the collision bulkhead 5% of LBP
// aft of the forward perpendicular (SOLAS II-1 Reg. 12: 5–8%), and 18
// spaces between, evenly 13.6 m long: under the floodable length a
// two-compartment cruise ship of her size needs (about 14–15 m, as the
// Concordia's [MIT §4.7.2]). Every bulkhead up to deck 0 (14.5 m). Her
// machinery amidships aft (diesel-electric: six generators in three rooms,
// two propulsion motors aft of them).

const AFT_PEAK_X = -126;
const COLLISION_X = round(LBP / 2 - 0.05 * LBP, 0.01);
const SPACES = 18;
const BULKHEADS: number[] = Array.from({ length: SPACES + 1 }, (_, k) =>
  round(AFT_PEAK_X + ((COLLISION_X - AFT_PEAK_X) * k) / SPACES, 0.01)
);
const WTC_LABEL: Record<number, [string, Compartment["kind"]]> = {
  1: ["Steering gear", "stern"],
  2: ["Stern thrusters", "shaft"],
  3: ["Propulsion motor room", "engine"],
  4: ["Switchboard room", "engine"],
  5: ["Back generator room", "engine"],
  6: ["Middle generator room", "engine"],
  7: ["Front generator room", "engine"],
  8: ["Boilers and purifiers", "engine"],
  19: ["Bow thrusters", "hold"],
  20: ["Front peak", "peak"],
};

/**
 * Her side tanks and voids (ours, R4): a longitudinal bulkhead WING_M in
 * from each side from WTC 3 to WTC 18 (fuel, ballast and fresh water,
 * voids), in five tanks a side, each from one transverse bulkhead to
 * another (`WING_GROUPS`, by WTC number): each its own watertight space
 * with no way in but its stated leak. Five a side keeps her 30 spaces
 * inside the X-ray's 32.
 */
const WING_M = 5;
const WING_GROUPS: readonly (readonly [number, number])[] = [
  [3, 5],
  [6, 8],
  [9, 11],
  [12, 14],
  [15, 18],
];
const WING_PERMEABILITY = 0.95;

function buildCompartments(): Compartment[] {
  const xs = [STERN_X, ...BULKHEADS, STEM_X];
  const y = round(HALF - WING_M, 0.01);
  const winged = (n: number) => WING_GROUPS.some(([a, b]) => n >= a && n <= b);
  const out: Compartment[] = [];
  for (let i = 0; i < xs.length - 1; i += 1) {
    const n = i + 1;
    const [label, kind] = WTC_LABEL[n] ?? [`Stores and workrooms ${n}`, "hold"];
    out.push({
      id: `wtc${n}`,
      label,
      kind,
      ...(WTC_LABEL[n] ? {} : { noChip: true }),
      fromX: xs[i],
      toX: xs[i + 1],
      aftBulkheadTopZ: i === 0 ? HULL_TOP_Z : DECK0_Z,
      fwdBulkheadTopZ: i === xs.length - 2 ? HULL_TOP_Z : DECK0_Z,
      ...(winged(n) ? { span: { side: "centre" as const, y } } : {}),
    });
  }
  // The side tanks after her compartments, aft to forward, port first.
  WING_GROUPS.forEach(([a, b], g) => {
    for (const side of ["port", "starboard"] as const)
      out.push({
        id: `tanks${g + 1}-${side === "port" ? "p" : "s"}`,
        label: `Side tanks ${g + 1}, ${side}`,
        kind: "hold",
        noChip: true,
        fromX: xs[a - 1],
        toX: xs[b],
        aftBulkheadTopZ: DECK0_Z,
        fwdBulkheadTopZ: DECK0_Z,
        span: { side, y },
        permeability: WING_PERMEABILITY,
      });
  });
  return out;
}
const COMPARTMENTS = buildCompartments();
const comp = (id: string) => COMPARTMENTS.find((c) => c.id === id)!;
const mid = (c: { fromX: number; toX: number }) =>
  round((c.fromX + c.toX) / 2, 0.01);

// ---------------------------------------------------------------------------
// The superstructure (ours, R4): tiers fore and aft, each a named space
// (`id`) the sea can get into. The lower tiers hold decks 1–6 (the public
// rooms, the promenade on deck 4 with the boat recess, the atrium), the
// upper tiers decks 7–11 (cabins with balconies, the bridge forward on
// deck 8), and on top, forward of her funnel, the ballroom: a round room
// two decks tall on decks 12–13, about 30 m across, under a glass dome
// about 9 m high (its dome's volume added as 4 m more of the box: a cap
// 30 m across and 9 m high holds about 3,560 m³, a 30 × 30 m slab 4 m
// deep). Aft of the funnel the pool deck's houses (decks 12–13).

const LOWER_TOP = deckZ(7);
const UPPER_TOP = deckZ(12);
const TOP_TOP = deckZ(14);
/**
 * The ballroom (ours): x from, to, its half-breadth, and a top 4 m over
 * deck 14. The box is a volume equivalent: the dome's crown stands about
 * 9 m above deck 14, above the box's top (the model draws the dome; the
 * sim needs only its volume, about 3,560 m³, a 30 × 30 m slab 4 m deep).
 */
export const BALLROOM = {
  fromX: -18,
  toX: 12,
  halfBreadthM: 15,
  baseZ: deckZ(12),
  topZ: round(deckZ(14) + 4, 0.01),
};
/** Her funnel (ours): raked, aft, its foot on deck 12 (R5). */
const FUNNEL_X = -70;

export const POSEIDON_SUPERSTRUCTURE: ShipSpec["superstructure"] = [
  { id: "aft-lower", fromX: STERN_X + 1, toX: -60, topZ: LOWER_TOP },
  { id: "mid-lower", fromX: -60, toX: 50, topZ: LOWER_TOP },
  { id: "fwd-lower", fromX: 50, toX: 128, topZ: LOWER_TOP },
  {
    id: "aft-upper",
    fromX: -136,
    toX: -60,
    baseZ: LOWER_TOP,
    topZ: UPPER_TOP,
  },
  { id: "mid-upper", fromX: -60, toX: 50, baseZ: LOWER_TOP, topZ: UPPER_TOP },
  { id: "fwd-upper", fromX: 50, toX: 118, baseZ: LOWER_TOP, topZ: UPPER_TOP },
  {
    id: "top-aft",
    fromX: -112,
    toX: -24,
    baseZ: UPPER_TOP,
    topZ: TOP_TOP,
    halfBreadthM: 14,
  },
  { id: "ballroom", ...BALLROOM },
];
const box = (id: string) => POSEIDON_SUPERSTRUCTURE.find((s) => s.id === id)!;

// ---------------------------------------------------------------------------
// The wave (R7): 30 m crest to trough, breaking, one crest, a 15 s period,
// from her port beam ([DRA] 25.6 m in Hs ≈ 12 m; [QE2] about 29 m,
// reported; [ROG] a rogue wave is over twice Hs). It reaches her at the
// first event (t = 0, 23:58:00). Her swell around it (ours, [ATL]): a
// winter North Atlantic swell of Hs 3 m, 12 s, from her port beam.

/** What the wave smashes on her port side (R9), each area ours and
 *  calibrated (sim README, "The Poseidon's calibration"). */
export const SPOT_M2 = {
  /** The aft mooring deck's doors and the marina door (two 3 × 2.5 m
   *  doors stove in, of the four there). */
  stern: 15,
  /** Glass broken in the aft lower tier's window rows, decks 3–6. */
  aftWin: 120,
  /** The same, midships. */
  midWin: 150,
  /** The funnel casing's louvres and the engine-room air intakes. */
  vents: 12,
  /** The ballroom dome's glass (about 40 m², R9). */
  ballroom: 40,
  /** The forward lower tier's windows, decks 3–6. */
  fwdWin: 110,
  /** The bridge front (deck 8): its windows stove in. */
  bridge: 25,
  /** The atrium doors on deck 5 (glass, 4 m tall). */
  atrium: 30,
  /** The gangway doors (hull, deck 0 to 1). */
  gangway: 12,
};

function into(
  id: string,
  areaM2: number,
  x: number,
  zLow: number,
  zHigh: number
): Opening {
  return { compartmentId: id, areaM2, zLow, zHigh, x, side: "port", t: 0 };
}

const WINDOWS_LOW = deckZ(3);
const WINDOWS_HIGH = deckZ(7) - 0.3;

const SPOTS: NonNullable<ShipSpec["wave"]>["spots"] = [
  {
    id: "stern",
    label: "The back doors",
    openings: [into("wtc1", SPOT_M2.stern, -140, DECK0_Z, HULL_TOP_Z - 0.2)],
  },
  {
    id: "aft-win",
    label: "Back windows",
    openings: [
      into("aft-lower", SPOT_M2.aftWin, -104, WINDOWS_LOW, WINDOWS_HIGH),
    ],
  },
  {
    id: "mid-win",
    label: "Middle windows",
    openings: [
      into("mid-lower", SPOT_M2.midWin, -5, WINDOWS_LOW, WINDOWS_HIGH),
    ],
  },
  {
    id: "vents",
    label: "Engine air vents",
    // The casing and intakes come down through her decks into the
    // engine rooms: their openings are at the hull's top (inverted, they
    // open downward).
    openings: (["wtc5", "wtc6", "wtc7"] as const).map((id) =>
      into(
        id,
        round(SPOT_M2.vents / 3, 0.01),
        mid(comp(id)),
        DECK0_Z + 0.5,
        HULL_TOP_Z - 0.2
      )
    ),
  },
  {
    id: "ballroom",
    label: "The ballroom dome",
    openings: [
      into(
        "ballroom",
        SPOT_M2.ballroom,
        mid(BALLROOM),
        deckZ(14),
        BALLROOM.topZ - 0.2
      ),
    ],
  },
  {
    id: "fwd-win",
    label: "Front windows",
    fwd: true,
    openings: [
      into("fwd-lower", SPOT_M2.fwdWin, 88, WINDOWS_LOW, WINDOWS_HIGH),
      into("fwd-upper", SPOT_M2.bridge, 112, deckZ(8), deckZ(9) - 0.2),
    ],
  },
  {
    id: "lobby",
    label: "The lobby doors",
    openings: [
      into("mid-lower", SPOT_M2.atrium, 20, deckZ(5), deckZ(5) + 4),
      into(
        "wtc11",
        SPOT_M2.gangway,
        mid(comp("wtc11")),
        DECK0_Z,
        HULL_TOP_Z - 0.2
      ),
    ],
  },
];

/**
 * The breaking wave's green water and burst glass in her superstructure
 * (a rule, not physics: sim README, "The Poseidon's box flood"): each box
 * fills to `fill` over its share of the roll, the top and upper tiers
 * (the first under as she rolls past 90°) before the lower ones, in a run
 * with one of its `spots` open (the glass on that side of it broken: the
 * aft, middle and front windows, the lobby doors amidships, the dome).
 * The fills are the smallest that leave her keel up after the hand-off
 * with every spot open (calibrated: README).
 */
export const BOX_FILL = { top: 1, upper: 1, lower: 1 };
const BOX_FLOOD: NonNullable<ShipSpec["wave"]>["boxFlood"] = [
  {
    id: "top-aft",
    fill: BOX_FILL.top,
    fromU: 0.35,
    toU: 0.75,
    spots: ["aft-win"],
  },
  {
    id: "aft-upper",
    fill: BOX_FILL.upper,
    fromU: 0.4,
    toU: 0.85,
    spots: ["aft-win"],
  },
  {
    id: "mid-upper",
    fill: BOX_FILL.upper,
    fromU: 0.4,
    toU: 0.85,
    spots: ["mid-win", "lobby"],
  },
  {
    id: "fwd-upper",
    fill: BOX_FILL.upper,
    fromU: 0.4,
    toU: 0.85,
    spots: ["fwd-win"],
  },
  {
    id: "ballroom",
    fill: BOX_FILL.top,
    fromU: 0.35,
    toU: 0.75,
    spots: ["ballroom"],
  },
  {
    id: "aft-lower",
    fill: BOX_FILL.lower,
    fromU: 0.5,
    toU: 1,
    spots: ["aft-win"],
  },
  {
    id: "mid-lower",
    fill: BOX_FILL.lower,
    fromU: 0.5,
    toU: 1,
    spots: ["mid-win", "lobby"],
  },
  {
    id: "fwd-lower",
    fill: BOX_FILL.lower,
    fromU: 0.5,
    toU: 1,
    spots: ["fwd-win"],
  },
];

const STORM: StormSpec = {
  components: stormComponents({
    hsM: 3,
    peakPeriodS: 12,
    dirDeg: -90,
    spreadDeg: 15,
    count: 12,
    seed: 2006,
  }),
  hsM: 3,
  windKn: 20,
};

// ---------------------------------------------------------------------------
// Boats (ours, R16): 24 lifeboats, 12 a side, in the recess on deck 4,
// from x −84 to +84 (as the Concordia's). Never lowered: no time, no
// people.

export interface PoseidonBoat {
  index: number;
  side: "port" | "starboard";
  /** Ship-frame x of the boat's middle (m). */
  x: number;
}

function buildBoats(): PoseidonBoat[] {
  const out: PoseidonBoat[] = [];
  for (const side of ["starboard", "port"] as const)
    for (let k = 0; k < 12; k += 1)
      out.push({
        index: out.length,
        side,
        x: round(-84 + (168 * k) / 11, 0.1),
      });
  return out;
}
export const POSEIDON_BOATS: readonly PoseidonBoat[] = buildBoats();
/** The boat recess's deck. */
export const BOAT_DECK_Z = deckZ(4);

/** Her funnel's paint (ours, R6): white under a deep blue top (the gold
 *  wave stripe on it is the model's: `poseidonRecipe.ts`). */
const FUNNEL_PAINT = { funnel: 0xf4f4f0, top: 0x1c3f73 };

/** Her one real paint (ours, R6), then the cruise fun paints (the
 *  Concordia's set, R6). */
export const POSEIDON_LIVERIES: readonly Livery[] = [
  {
    id: "poseidon",
    label: "Her own colours",
    year: 2006,
    default: true,
    sources: [
      'Ours (R6): a made-up ship. White hull and decks, a sea-blue line along the hull\'s top, a deep blue boot-top over a dark red bottom, a white funnel with a deep blue top and a gold wave stripe, orange boats, her name in deep blue (model README, "The Poseidon")',
      "Checked for believability against Wikimedia Commons photographs of cruise ships of 2000–2010 [WC], never the film",
    ],
    swatches: [0xf4f4f0, 0x1f5f94],
    funnelPaint: FUNNEL_PAINT,
    look: { hull: 0xf4f4f0, funnel: 0xf4f4f0, top: 0x1c3f73, band: 0x1f5f94 },
  },
  ...cruiseFun(),
];

/**
 * Her stated slow air leaks per space (m², R8: 0.001–0.05; calibrated so
 * she floats keel up 35–60 minutes: sim README, "The Poseidon's
 * calibration"): her hull's ducts and door seals, her engine rooms' (their
 * casings and uptakes), her superstructure's (stairways, lifts, cabins).
 */
export const LEAK = { hull: 0.01, engine: 0.004, box: 0.03 };

/** Every spot's openings: her real night (R9). */
const REAL: Opening[] = SPOTS.flatMap((s) => s.openings);

export const poseidon: ShipSpec = {
  id: "poseidon",
  name: "Poseidon",
  year: 2006,
  lbp: LBP,
  loa: LOA,
  beam: BEAM,
  depth: HULL_TOP_Z,
  draught: DRAUGHT,
  // 265 × 36 × 8.4 × 0.70 × 1.025 (R3, ours).
  displacementT: 57500,
  // For an intact GM of 2.0 m (ours, R3: 1.5–3 m; her KM is 16.1 m),
  // over her centre of buoyancy.
  kg: 14.1,
  lcg: -5.8,
  stations: STATIONS,
  sheerZ: poseidonSheerZ,
  superstructure: POSEIDON_SUPERSTRUCTURE,
  compartments: COMPARTMENTS,
  realNight: REAL,
  // IACS UR S11 for her size (L 265 m, B 36 m, Cb 0.70): wave moments
  // 3.5 GN·m hogging and 4.1 GN·m sagging, still water about the same;
  // their sum (7.1 and 8.2 GN·m) times an ultimate factor of 3.2 (ours,
  // R17: she does not break). 1.8 broke her in a What-if whose box flood
  // (a rule) fills only her middle (20.1 GN·m hogging) or only her ends
  // (22.4 GN·m sagging): sim README, "The Poseidon's calibration".
  girder: { hogMaxNm: 22.7e9, sagMaxNm: 26.2e9 },
  scripted: [],
  funnels: [
    {
      x: FUNNEL_X,
      baseZ: deckZ(12),
      topZ: 78,
      dummy: false,
      falls: false,
    },
  ],
  decks: POSEIDON_DECKS,
  seaDepthM: 4000,
  clockStartS: 23 * 3600 + 58 * 60,
  cause: "wave",
  preRollS: 60,
  storm: STORM,
  wave: {
    group: { t: 0, heightM: 30, count: 1, periodS: 15, dirDeg: -90 },
    peakDeg: 190,
    rollS: 25,
    smaller: { heightM: 15, peakDeg: 45 },
    ahead: { dirDeg: 0 },
    spots: SPOTS,
    boxFlood: BOX_FLOOD,
  },
  trappedAir: {
    leakM2: {
      peak: LEAK.hull,
      hold: LEAK.hull,
      engine: LEAK.engine,
      shaft: LEAK.hull,
      stern: LEAK.hull,
      box: LEAK.box,
    },
  },
  blackout: {
    compartmentId: "wtc6",
    depthM: 2.0,
    emergencyLight: 0.25,
    listDeg: 60,
  },
  capsizeTimeScale: 6,
  rideOut: { afterS: 300, maxListDeg: 10 },
  endS: 870,
  wreck: { restDeg: 180, minListDeg: 120 },
  funnelPaint: FUNNEL_PAINT,
  liveries: POSEIDON_LIVERIES,
};

/** For the data tests. */
export const POSEIDON_BULKHEADS = BULKHEADS;
export { box as poseidonBox, comp as poseidonComp };
