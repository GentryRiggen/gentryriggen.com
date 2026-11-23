import {
  type Compartment,
  type HullStation,
  type Livery,
  type ScriptedEvent,
  type ShipSpec,
  type TorpedoSpec,
  hullOpenings,
} from "./types";
import { linerFun } from "./funPaints";
import { FINISHER_SPOT, whatIfOpenings } from "../sim/run";

/**
 * RMS Carpathia on the morning of 17 July 1918, west of Fastnet.
 *
 * Sources (see lib/shipwreck/sim/README.md, "The Carpathia's data", for the
 * full list, where they disagree, and every assumption): _The Engineer_,
 * 8 August 1902, p. 136, "A floating dock and a new Cunarder" (558 ft by
 * 64 ft 3 in, four complete steel decks, a steel orlop in Nos. 1 and 2
 * holds, a bridge deck 290 ft long with a boat deck above it, third-class
 * cabins on the main deck forward of the boiler room, about 12,000 tons
 * dead weight, seven large single-ended boilers, two quadruple-expansion
 * engines); titanicinquiry.org's particulars (540.0 ft registered, 64.2 ft,
 * 37.4 ft, one funnel, four masts, twin screws, eight bulkheads); Tyne
 * Built Ships (540.0 × 64.5 × 37.4 ft; her last voyage Liverpool to Boston
 * in ballast); Maritimequest (558 ft × 64 ft 5 in, depth 41 ft);
 * Wikipedia (load draught 34 ft 7 in, beam 64 ft 6 in, 20 lifeboats in
 * 1912, the morning: port side near No. 3 hatch, the second hit in the
 * engine room, settling by the head with a list to port, 11 boats, the
 * third torpedo, sunk at 11:00 AM, upright in about 150 m);
 * thegreatoceanliners.com (between No. 4 hold and the stokehold, the
 * second within seconds, rockets, the third about No. 5 hatch, sunk about
 * ten minutes later); her photographs (Wikimedia Commons: "RMS-
 * Carpathia.jpg", starboard side, before 1914; "Steamship CARPATHIA -
 * broadside view.png", port side, 19 April 1912; "Carpathia Malta.jpg",
 * 1912): positions along her length are measured off them (README).
 *
 * Ship frame: metres, origin on the keel at midships (half of LBP), x
 * forward, y to port, z up.
 */

const FT = 0.3048;
const LBP = 540 * FT; // 164.59: her registered length
const HALF_LBP = LBP / 2; // 82.30: the forward (+) and after (-) perpendiculars
const BEAM = 64.5 * FT; // 19.66
const HALF_BEAM = BEAM / 2;
/** LOA 558 ft: a nearly plumb stem and a counter stern aft. */
const STEM_X = 83.28; // the stem head at the upper deck, 1 m before the FP
const STERN_X = round(STEM_X - 558 * FT, 0.01); // -86.8, the counter's end

/** Lowest point of the sheer, a little aft of midships. */
const SHEER_LOW_X = -5;
const SHEER_FWD = 1.8; // upper deck rise at the forward perpendicular (6 ft)
const SHEER_AFT = 0.9; // and at the after perpendicular (3 ft)

function round(v: number, step: number): number {
  return Math.round(v / step) * step;
}

function sheerShape(x: number): number {
  if (x >= SHEER_LOW_X) {
    const u = (x - SHEER_LOW_X) / (HALF_LBP - SHEER_LOW_X);
    return SHEER_FWD * u * u;
  }
  const u = (SHEER_LOW_X - x) / (SHEER_LOW_X + HALF_LBP);
  return SHEER_AFT * u * u;
}

/**
 * Heights of her decks above the keel at their lowest point (amidships).
 * Four complete steel decks (_The Engineer_): the upper deck (the top of
 * the hull, the well decks), the main deck (41 ft moulded depth, her
 * freeboard deck), the lower deck and a fourth deck in the holds, 8 ft
 * 6 in apart; a steel orlop in holds 1 and 2; the tank top over a 5 ft
 * double bottom. Above the upper deck the forecastle and the 290 ft
 * bridge deck, one tier high, and the boat deck over the bridge deck. No
 * poop (R21): abaft the bridge deck house her upper deck runs open to the
 * stern. "Main" and "Bridge" are her own names; the rest are ours
 * (README).
 */
const TIER = 2.6;
const DECK_UPPER = 15.1;
const DECK_MAIN = round(DECK_UPPER - TIER, 0.01); // 12.5 (41 ft)
const DECK_LOWER = round(DECK_MAIN - TIER, 0.01); // 9.9
const DECK_FOURTH = round(DECK_LOWER - TIER, 0.01); // 7.3
const DECK_ORLOP = 4.5;
const TANK_TOP = round(5 * FT, 0.01); // 1.52
const DECK_BRIDGE = round(DECK_UPPER + TIER, 0.01); // 17.7
const DECK_BOAT = round(DECK_BRIDGE + TIER, 0.01); // 20.3

export const CARPATHIA_DECKS = [
  { name: "Boat", z: DECK_BOAT },
  { name: "Bridge", z: DECK_BRIDGE },
  { name: "Forecastle", z: DECK_BRIDGE },
  { name: "Upper", z: DECK_UPPER },
  { name: "Main", z: DECK_MAIN },
  { name: "Lower", z: DECK_LOWER },
  { name: "Fourth", z: DECK_FOURTH },
  { name: "Orlop", z: DECK_ORLOP },
  { name: "Tank top", z: TANK_TOP },
];

/** The upper deck edge: the top of the hull. */
function carpathiaSheerZ(x: number): number {
  return DECK_UPPER + sheerShape(x);
}

/** A deck's height at x (every deck follows the upper deck's sheer). */
function deckZ(deck: number, x: number): number {
  return round(deck + sheerShape(x), 0.01);
}

// ---------------------------------------------------------------------------
// Hull form. A 14-knot intermediate liner (Froude number 0.18): a long
// parallel middle body, a fuller entrance and run than the express ships,
// a 2 m bilge radius, a nearly plumb stem with a rounded forefoot and a
// counter stern over the rudder. Tuned to a block coefficient of about
// 0.70 at her 34 ft 7 in load draught (README: "The Carpathia's data").

const PARALLEL_FWD = 22;
const PARALLEL_AFT = -30;
const BILGE_R = 2.0;
const COUNTER_LOW = 8.5; // the run ends at the sternpost below this height
const COUNTER_HIGH = 11.5; // and at the counter's end above this one

function smoothstep(a: number, b: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Forward end of the hull at height z (nearly plumb stem, round forefoot). */
function stemX(z: number): number {
  const rake =
    HALF_LBP +
    ((STEM_X - HALF_LBP) * (z - 10.5)) / (DECK_UPPER + SHEER_FWD - 10.5);
  if (z >= 3) return rake;
  const u = 1 - z / 3;
  return rake - 2.5 * u * u;
}

/** After end of the hull at height z: the sternpost low, the counter high. */
function sternX(z: number): number {
  return (
    -HALF_LBP - (-STERN_X - HALF_LBP) * smoothstep(COUNTER_LOW, COUNTER_HIGH, z)
  );
}

function bilge(z: number): number {
  if (z >= BILGE_R) return 1;
  const d = BILGE_R - z;
  return (
    (HALF_BEAM - BILGE_R + Math.sqrt(BILGE_R * BILGE_R - d * d)) / HALF_BEAM
  );
}

/** Fullness exponent p of the ends' half-breadth, 1 - u^p. */
const ENTRANCE_P = [1.1, 2.2, 2.8];
const RUN_P = [0.9, 2.0, 2.8];
function fullness(p: readonly number[], z: number): number {
  return (
    p[0] +
    (p[1] - p[0]) * smoothstep(0, 10.5, z) +
    (p[2] - p[1]) * smoothstep(10.5, DECK_UPPER + 1, z)
  );
}

/** Half-breadth of the moulded hull at (x, z), 0 outside it. */
function halfBreadth(x: number, z: number): number {
  const fwdEnd = stemX(z);
  const aftEnd = sternX(z);
  if (x >= fwdEnd || x <= aftEnd) return 0;
  let w = 1;
  if (x > PARALLEL_FWD) {
    const u = (x - PARALLEL_FWD) / (fwdEnd - PARALLEL_FWD);
    w = 1 - Math.pow(u, fullness(ENTRANCE_P, z));
  } else if (x < PARALLEL_AFT) {
    const u = (PARALLEL_AFT - x) / (PARALLEL_AFT - aftEnd);
    w = 1 - Math.pow(u, fullness(RUN_P, z));
  }
  return Math.max(0, HALF_BEAM * w * bilge(z));
}

/** Lowest z at which the hull exists at x. */
function bottomZ(x: number, top: number): number {
  if (x < stemX(0) && x > sternX(0)) return 0;
  let lo = 0;
  let hi = top;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (x < stemX(mid) && x > sternX(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Normalised heights of the offsets, dense at the bilge and the waterline. */
const LEVELS = [
  0, 0.01, 0.035, 0.07, 0.12, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1,
];
const STATION_COUNT = 61;

function buildStations(): HullStation[] {
  const stations: HullStation[] = [];
  for (let i = 0; i < STATION_COUNT; i += 1) {
    const x = STERN_X + ((STEM_X - STERN_X) * i) / (STATION_COUNT - 1);
    const top = carpathiaSheerZ(x);
    const bottom =
      i === 0 || i === STATION_COUNT - 1 ? top - 0.5 : bottomZ(x, top);
    const offsets = LEVELS.map((s) => {
      const z = bottom + (top - bottom) * s;
      return [round(z, 0.001), round(halfBreadth(x, z), 0.001)] as const;
    });
    stations.push({ x: round(x, 0.001), offsets });
  }
  return stations;
}

// ---------------------------------------------------------------------------
// The profile, measured off her photographs and scaled to the bridge
// deck's 290 ft (README): from the stem, a forecastle of about 42 ft, the
// forward well with the foremast, the 290 ft bridge deck house (its front
// 145 ft from the stem) with the bridge house on the boat deck from about
// 217 to 262 ft (its front some 17 ft abaft the mainmast, a gap with cowls
// before the funnel), and abaft the house the open after deck at the
// upper deck's height to the stern (R21: no raised poop), with the jigger
// mast at about 493 ft, a boat platform on stanchions just forward of it
// and a deckhouse at the stern. Each to about ±5 m.

/** Ship-frame x of a point `ft` feet aft of the stem head. */
function fromStem(ft: number): number {
  return round(STEM_X - ft * FT, 0.01);
}
const FORECASTLE_AFT_X = fromStem(42); // 70.48
const HOUSE_FWD_X = fromStem(145); // 39.08
/** The bridge house's front, the navigating bridge, the boat deck's front. */
const BRIDGE_X = fromStem(217); // 17.14
const BRIDGE_AFT_X = fromStem(262); // 3.42
const FUNNEL_X = fromStem(290); // -5.11
const HOUSE_AFT_X = fromStem(435); // -49.31
/** The stern deckhouse, 30 ft long, its after end 18 ft from the stern. */
const STERN_HOUSE_FWD_X = fromStem(510); // -72.17
const STERN_HOUSE_AFT_X = fromStem(540); // -81.31
/** Its walls 4.6 m out from the centre line: a walkway outside each. */
const STERN_HOUSE_HALF_BREADTH = 4.6;
/** The boat platform on stanchions forward of the jigger (P2). */
const PLATFORM_FWD_X = fromStem(467); // -59.06
const PLATFORM_AFT_X = fromStem(488); // -65.46

/** Her masts, forward to aft (fore, main, mizzen, jigger). */
export const CARPATHIA_MASTS: readonly number[] = [
  fromStem(95),
  fromStem(200),
  fromStem(382),
  fromStem(493),
];

/** The forward well deck between the forecastle and the house (the upper deck). */
export const CARPATHIA_WELLS = {
  forward: { fromX: HOUSE_FWD_X, toX: FORECASTLE_AFT_X, z: DECK_UPPER },
} as const;

/**
 * The open after deck (R21): the upper deck from the stern to the bridge
 * deck house's after end, behind open rails; the black hull stops at it.
 */
export const CARPATHIA_AFTER_DECK = {
  fromX: STERN_X,
  toX: HOUSE_AFT_X,
  z: DECK_UPPER,
} as const;

/**
 * The deckhouse at her stern on the after deck, one tier high, inboard of
 * a walkway each side (the steering gear's and gunners' rooms; her tenth
 * pair of boats on its roof, ours).
 */
export const CARPATHIA_STERN_HOUSE = {
  fromX: STERN_HOUSE_AFT_X,
  toX: STERN_HOUSE_FWD_X,
  halfBreadth: STERN_HOUSE_HALF_BREADTH,
  z: DECK_UPPER,
  topZ: DECK_BRIDGE,
} as const;

/** The boat platform on stanchions forward of the jigger, a tier up. */
export const CARPATHIA_BOAT_PLATFORM = {
  fromX: PLATFORM_AFT_X,
  toX: PLATFORM_FWD_X,
  z: DECK_BRIDGE,
} as const;

/** The bridge house on the boat deck, the navigating bridge on its roof. */
export const CARPATHIA_BRIDGE_HOUSE = {
  fromX: BRIDGE_AFT_X,
  toX: BRIDGE_X,
} as const;

/** The 290 ft bridge deck house and the boat deck over its after part. */
export const CARPATHIA_BRIDGE_DECK = {
  fromX: HOUSE_AFT_X,
  toX: HOUSE_FWD_X,
  z: DECK_BRIDGE,
} as const;
export const CARPATHIA_BOAT_DECK = {
  fromX: HOUSE_AFT_X,
  toX: BRIDGE_X,
  z: DECK_BOAT,
} as const;

// ---------------------------------------------------------------------------
// Watertight subdivision: eight bulkheads, nine compartments
// (titanicinquiry.org: "8 bulkheads"). Their positions are ours, argued
// from her hatches, masts and machinery (README): the boiler room under
// the bridge and the funnel, the engine room abaft it, three holds forward
// (Nos. 1 and 2 with the orlop, No. 3 under the house front) and two aft
// (No. 5 under the after deck), the peaks at the ends (the after one,
// with the steering gear under the stern deckhouse). Hold numbers:
// Wikipedia's "No. 3 hatch" for the first hit; GOL's "No. 4 hold" would
// number four forward (README).

const BH = {
  A: 74.0, // collision bulkhead (5% of LBP from the FP)
  B: 52.0, // No. 1 hold | No. 2
  C: 33.0, // No. 2 | No. 3
  D: 12.0, // No. 3 | the boiler room, under the bridge
  E: -8.0, // the boiler room | the engine room
  F: -25.0, // the engine room | No. 4 hold
  G: -48.0, // No. 4 | No. 5
  H: -62.0, // No. 5 | the after peak, under the boat platform
};

/**
 * The bunkers beside the boiler room: seven large single-ended boilers
 * (about 15½ ft across) cannot stand four abreast in her 64½ ft, so they
 * stand at most three abreast, leaving about 6 ft each side for the side
 * bunkers (README). Their inner bulkheads 7.9 m from the centre line.
 */
export const CARPATHIA_WING_Y = 7.9;
/**
 * Coal doors in each bunker's inner bulkhead, open while she steamed and
 * jammed with coal (as the Lusitania's): the gaps left, m² per bunker.
 */
const COAL_DOOR_M2 = 0.07;
/** Two days out of Liverpool, the side bunkers still nearly full of coal
 *  (the voids between the lumps). */
const WING_PERMEABILITY = 0.4;
/** Holds empty in ballast (void spaces). */
const HOLD_PERMEABILITY = 0.95;

function compartment(
  id: string,
  label: string,
  kind: Compartment["kind"],
  fromX: number,
  toX: number,
  aftTop: number,
  fwdTop: number,
  more: Partial<Compartment> = {}
): Compartment {
  return {
    id,
    label,
    kind,
    fromX,
    toX,
    aftBulkheadTopZ: aftTop,
    fwdBulkheadTopZ: fwdTop,
    ...more,
  };
}

/**
 * A bulkhead's top. Forward of the engine room they stop at the main deck
 * (the 'tween deck over them is one third-class space, _The Engineer_);
 * the collision bulkhead and the bulkheads abaft the engine room, under
 * the cargo 'tween decks aft, go to the upper deck (an assumption:
 * README, "The Carpathia's calibration").
 */
function topAt(x: number, deck: "upper" | "main" = "main"): number {
  return deckZ(deck === "upper" ? DECK_UPPER : DECK_MAIN, x);
}

const hold = { permeability: HOLD_PERMEABILITY };

/**
 * The boiler room with its side bunkers: centre, port wing, starboard wing,
 * joined by the jammed coal doors: the water that slowly finds its way
 * through them settles her through the morning (README).
 */
function boilerRoom(): Compartment[] {
  const y = CARPATHIA_WING_Y;
  const door = { crossFlowM2: COAL_DOOR_M2 };
  const wing = { permeability: WING_PERMEABILITY, ...door };
  const room = (id: string, label: string, more: Partial<Compartment>) =>
    compartment(
      id,
      label,
      "boiler",
      BH.E,
      BH.D,
      topAt(BH.E),
      topAt(BH.D),
      more
    );
  return [
    room("boiler", "Boiler room", { span: { side: "centre", y }, ...door }),
    room("boiler-port", "Boiler room port bunker", {
      span: { side: "port", y },
      ...wing,
    }),
    room("boiler-stbd", "Boiler room starboard bunker", {
      span: { side: "starboard", y },
      ...wing,
    }),
  ];
}

const COMPARTMENTS: Compartment[] = [
  compartment(
    "aft-peak",
    "Back peak",
    "stern",
    STERN_X,
    BH.H,
    round(carpathiaSheerZ(STERN_X), 0.01),
    topAt(BH.H, "upper")
  ),
  compartment(
    "hold5",
    "Hold 5",
    "hold",
    BH.H,
    BH.G,
    topAt(BH.H, "upper"),
    topAt(BH.G, "upper"),
    hold
  ),
  compartment(
    "hold4",
    "Hold 4",
    "hold",
    BH.G,
    BH.F,
    topAt(BH.G, "upper"),
    topAt(BH.F, "upper"),
    hold
  ),
  compartment(
    "engine",
    "Engine room",
    "engine",
    BH.F,
    BH.E,
    topAt(BH.F, "upper"),
    topAt(BH.E)
  ),
  ...boilerRoom(),
  compartment(
    "hold3",
    "Hold 3",
    "hold",
    BH.D,
    BH.C,
    topAt(BH.D),
    topAt(BH.C),
    hold
  ),
  compartment(
    "hold2",
    "Hold 2",
    "hold",
    BH.C,
    BH.B,
    topAt(BH.C),
    topAt(BH.B),
    hold
  ),
  compartment(
    "hold1",
    "Hold 1",
    "hold",
    BH.B,
    BH.A,
    topAt(BH.B),
    topAt(BH.A, "upper"),
    hold
  ),
  compartment(
    "fore-peak",
    "Front peak",
    "peak",
    BH.A,
    STEM_X,
    topAt(BH.A, "upper"),
    round(carpathiaSheerZ(STEM_X), 0.01)
  ),
];

// ---------------------------------------------------------------------------
// Her ballast voyage (README): her lightship (about 12,880 t: the hull at
// her 34 ft 7 in load draught less 12,000 tons dead weight) plus about
// 1,500 t of coal, 700 t of water, stores and people and 3,400 t of water
// ballast in her double bottom and peaks: 18,500 t, 8.00 m on an even keel
// (tuned inside 7.4–8.4 m).

const DRAUGHT = 8.0;

/** The torpedo's running depth below the surface (a U-boat's usual 3 m). */
const RUNNING_DEPTH = 3;

/** Shown seconds of the third torpedo: 10:50 AM, 95 minutes after the first. */
const FINISHER_T = 5700;

/** The hits' shown times: the second 8 s after the first (R4), the third at 10:50 AM (R5). */
export const CARPATHIA_HIT_T = { second: 8, third: FINISHER_T } as const;

/**
 * Her torpedoes: into her port side, forward first, 8 s apart. One
 * 1918 torpedo's hole: about 7 m along her side, 20 m², centred at its
 * running depth below her waterline (README). The first strikes at the
 * boiler room's forward bulkhead (No. 3 hold and the stokehold, R3); the
 * U-boat's third, at 10:50 AM, about No. 5 hatch.
 */
const NO5_HATCH_X = -57;
const TORPEDO: TorpedoSpec = {
  side: "port",
  order: "fwd-first",
  staggerS: CARPATHIA_HIT_T.second,
  hole: {
    areaM2: 20,
    zLow: round(DRAUGHT - RUNNING_DEPTH - 2, 0.01),
    zHigh: round(DRAUGHT - RUNNING_DEPTH + 2, 0.01),
    lengthM: 7,
  },
  hitX: { boiler: BH.D, hold5: NO5_HATCH_X },
  finisher: { spotId: "hold5", t: FINISHER_T },
  realSpots: ["boiler", "engine", FINISHER_SPOT],
};

// ---------------------------------------------------------------------------
// Her boats.

/** One of her lifeboats under davits. */
export interface CarpathiaBoat {
  /** Index in `boat-lowered` events. */
  index: number;
  label: string;
  side: "port" | "starboard";
  /** Ship-frame x of the boat's middle and the height of its keel (m). */
  x: number;
  z: number;
  /**
   * Wrecked by a torpedo in the real morning, at this shown time (the
   * second hit, in the engine room: "two boats wrecked", GOL): never
   * lowered. The scene may hide or break it then. Missing: whole.
   */
  wreckedAtT?: number;
}

/**
 * Twenty lifeboats (Wikipedia, 1912; her 1918 number is not in our
 * sources), ten a side, odd numbers to starboard, 1 and 2 forward: a pair
 * on the bridge deck's forward house, seven a side along the boat deck
 * from the bridge aft, a pair on the platform forward of the jigger (the
 * photographs, P1 and P2) and the tenth pair on the stern deckhouse's
 * roof (no photograph shows where: ours). Each boat's keel 1 m over its
 * deck: the forward pair's deck the house's roof, level with the boat
 * deck; the after pairs' a tier over the after deck.
 */
const BOAT_DECK_XS = [2, -6.5, -13, -19.5, -26, -32.5, -45];
/**
 * The two boats the second torpedo wrecked (GOL: "two boats wrecked"):
 * port boats 8 and 10, abreast the engine room where it struck (ours; the
 * accounts do not number them).
 */
const WRECKED_LABELS = ["8", "10"];
function buildBoats(): CarpathiaBoat[] {
  const spots: { x: number; deck: number }[] = [
    { x: 30, deck: DECK_BOAT },
    ...BOAT_DECK_XS.map((x) => ({ x, deck: DECK_BOAT })),
    {
      x: round((PLATFORM_AFT_X + PLATFORM_FWD_X) / 2, 0.01),
      deck: DECK_BRIDGE,
    },
    { x: -77, deck: DECK_BRIDGE },
  ];
  const out: CarpathiaBoat[] = [];
  spots.forEach(({ x, deck }, k) => {
    for (const side of ["starboard", "port"] as const) {
      const label = String(2 * k + (side === "starboard" ? 1 : 2));
      out.push({
        index: out.length,
        label,
        side,
        x,
        z: round(deckZ(deck, x) + 1, 0.01),
        ...(WRECKED_LABELS.includes(label)
          ? { wreckedAtT: CARPATHIA_HIT_T.second }
          : {}),
      });
    }
  });
  return out;
}
export const CARPATHIA_BOATS: readonly CarpathiaBoat[] = buildBoats();

/** Shown seconds after 9:15 AM for a clock time 9:mm AM (or 10:mm with h). */
function at(m: number, s = 0, h = 9): number {
  return (h - 9) * 3600 + (m - 15) * 60 + s;
}

/**
 * The eleven boats (Wikipedia, GOL), from about 9:25 to 9:55 AM, both
 * sides; the port boats nearest the hits (by the engine room, where two
 * were wrecked) last. The order and times are ours.
 */
const BOATS_AWAY: [string, number][] = [
  ["13", at(25)],
  ["15", at(27)],
  ["1", at(29)],
  ["16", at(31)],
  ["11", at(33)],
  ["3", at(36)],
  ["14", at(39)],
  ["2", at(42)],
  ["5", at(46)],
  ["12", at(50)],
  ["4", at(55)],
];

/** Rockets to call the patrol vessels (GOL), in the first 20 minutes. */
const ROCKETS_T = [at(17), at(20), at(24), at(29)];

function scripted(): ScriptedEvent[] {
  const events: ScriptedEvent[] = [
    // Steam from her broken boilers and lines just after the second hit,
    // until the pressure was gone (an estimate: no source times it).
    { t: CARPATHIA_HIT_T.second + 2, kind: "steam-start" },
    { t: at(25), kind: "steam-stop" },
    ...ROCKETS_T.map((t, index) => ({ t, kind: "rocket" as const, index })),
  ];
  for (const [label, t] of BOATS_AWAY) {
    const boat = CARPATHIA_BOATS.find((b) => b.label === label);
    if (boat) events.push({ t, kind: "boat-lowered", index: boat.index });
  }
  return events.sort((a, b) => a.t - b.t);
}

// ---------------------------------------------------------------------------
// Her look (the model reads these; plain numbers, no three.js).

/**
 * Her funnel's paint in each look (sRGB). Dazzle: a dark battle grey, the
 * funnel reading near black in the 1918 sinking photograph (Wikimedia
 * Commons, "R.m.s carpathia Sinking.jpg") over the paler hull; plain grey
 * (a recipe option, not offered in the game) keeps the lighter battle grey
 * all over; Cunard red as the period saw it (J. Kent Layton, TRMA: R234
 * G114 B48 from hand-tinted postcards, drawn a shade deeper in the same
 * hue as the Lusitania's: model README).
 */
export const CARPATHIA_FUNNEL_PAINTS = {
  dazzle: { funnel: 0x4a4f55, top: 0x3a3e43 },
  grey: { funnel: 0x7d8289, top: 0x7a7f86 },
  cunard: { funnel: 0xcc5a28, top: 0x141416 },
} as const;
/** Her funnel's paint in her default livery (1918 dazzle). */
export const CARPATHIA_FUNNEL_PAINT = CARPATHIA_FUNNEL_PAINTS.dazzle;

/**
 * Her paints (R28; the model README, "Her paint", cites every detail):
 * `dazzle-1918` as on the morning she sank (the default), `cunard-1912`
 * her original colours, as when she rescued the Titanic's survivors.
 */
export const CARPATHIA_LIVERIES: readonly Livery[] = [
  {
    id: "dazzle-1918",
    label: "Her 1918 dazzle paint",
    year: 1918,
    default: true,
    sources: [
      "Wikipedia, RMS Carpathia (citing the IWM film The Way of a Ship on the Sea, March 1918)",
      "The 1918 sinking photograph from U-55 (the funnel dark)",
    ],
    swatches: [0x1d1f22, 0xe6e7e3],
    funnelPaint: CARPATHIA_FUNNEL_PAINTS.dazzle,
    look: {
      hull: 0x1d1f22,
      funnel: CARPATHIA_FUNNEL_PAINTS.dazzle.funnel,
      top: CARPATHIA_FUNNEL_PAINTS.dazzle.top,
      dazzle: true,
    },
  },
  {
    id: "cunard-1912",
    label: "Her 1912 Cunard colours",
    year: 1912,
    sources: [
      "Wikimedia Commons, RMS-Carpathia.jpg (before 1914): black top, three narrow rings",
      "Wikimedia Commons, Color postcard of R. M. S Carpathia, ca. 1912 (DPLA)",
      "Wikimedia Commons, Carpathia Malta.jpg (1912)",
      "titanicinquiry.org, Carpathia particulars: red; black top; 3 narrow black rings",
      "J. Kent Layton, Building the Lusitania (TRMA): Cunard red",
    ],
    swatches: [CARPATHIA_FUNNEL_PAINTS.cunard.funnel, 0x141416],
    funnelPaint: CARPATHIA_FUNNEL_PAINTS.cunard,
    look: {
      hull: 0x121315,
      funnel: CARPATHIA_FUNNEL_PAINTS.cunard.funnel,
      top: CARPATHIA_FUNNEL_PAINTS.cunard.top,
    },
  },
  // Just for fun (1.7), over her 1912 shape: Cunard red and war grey were
  // really hers.
  ...linerFun(["fun-cunard", "fun-war-grey"], "cunard-1912"),
];

/**
 * The superstructure as the sim's buoyant boxes (aft to forward; each from
 * the upper deck edge up, so they do not overlap): the stern deckhouse
 * (its own footprint, inboard of the after deck's walkways: R21, no poop),
 * the bridge deck house under the boat deck (half a tier more for the
 * boat deck's houses), the bridge deck house forward of the bridge, and
 * the forecastle. The whole 290 ft house is `CARPATHIA_BRIDGE_DECK`.
 */
function box(fromX: number, toX: number, top: number) {
  return { fromX, toX, topZ: round(top + sheerShape((fromX + toX) / 2), 0.01) };
}
const SUPERSTRUCTURE = [
  {
    ...box(STERN_HOUSE_AFT_X, STERN_HOUSE_FWD_X, DECK_BRIDGE),
    halfBreadthM: STERN_HOUSE_HALF_BREADTH,
  },
  box(HOUSE_AFT_X, BRIDGE_X, DECK_BRIDGE + TIER / 2),
  box(BRIDGE_X, HOUSE_FWD_X, DECK_BRIDGE),
  box(FORECASTLE_AFT_X, STEM_X, DECK_BRIDGE),
];
/** Indices into `carpathia.superstructure`. */
export const CARPATHIA_SUPERSTRUCTURE = {
  sternHouse: 0,
  boatDeckHouse: 1,
  bridgeDeck: 2,
  forecastle: 3,
} as const;

const base: ShipSpec = {
  id: "carpathia",
  name: "Carpathia",
  year: 1918,
  lbp: round(LBP, 0.01),
  loa: round(STEM_X - STERN_X, 0.01),
  beam: round(BEAM, 0.01),
  depth: DECK_UPPER,
  draught: DRAUGHT,
  displacementT: 18500,
  // GM 1.14 m over this hull's KM of 7.74 m: her lightship's centre brought
  // down by the ballast, coal and stores low in her (README).
  kg: 6.6,
  lcg: -0.91, // over the centre of buoyancy: no trim
  // Coal drawn from her starboard bunkers first, or stores: enough to pick
  // the side she lands on (README, "The Carpathia's calibration").
  tcg: 0.02,
  stations: buildStations(),
  sheerZ: carpathiaSheerZ,
  superstructure: SUPERSTRUCTURE,
  compartments: COMPARTMENTS,
  realNight: [],
  // The Lusitania's scaled by her section and mild steel (README).
  girder: { hogMaxNm: 1.9e9, sagMaxNm: 1.7e9 },
  scripted: scripted(),
  funnels: [
    {
      x: FUNNEL_X,
      baseZ: round(deckZ(DECK_BOAT, FUNNEL_X) + 0.8, 0.01),
      // About 20 m tall from the boat deck (the photographs: 3.4 times
      // its 19½ ft width; ±2 m). Look only: the sim reads `baseZ`. Stayed:
      // the liners' stays rule (no `falls`).
      topZ: 41,
      dummy: false,
    },
  ],
  decks: CARPATHIA_DECKS,
  seaDepthM: 150,
  clockStartS: 9 * 3600 + 15 * 60, // 9:15 AM, the first torpedo
  cause: "torpedo",
  torpedo: TORPEDO,
  // Zig-zagging at convoy speed, about 10 knots (R9: an assumption), lost
  // within a couple of minutes with her engine room flooded.
  headway: { startMs: 10 * 0.514444, halfLifeS: 60 },
  // Her first two torpedoes' wakes streak in before the hit (scene only:
  // the sim starts at the hit), as the Lusitania's. The range they were
  // fired at is not in our sources: the Lusitania's 700 m at about 35
  // knots (U-20's diary) is used for the run-in.
  preRollS: 40,
  // Upright on the floor with a list to port (cunardshipwrecks.com: the
  // stern "perfectly intact with a list to port"): a rule (R8).
  wreck: { restDeg: -4, minListDeg: 0 },
  // R22: her way down is seen. Longer than the water is deep, she lands
  // her bow as her stern goes under, then swings down about it no faster
  // than the water allows, in real time (as the Fitzgerald, R11).
  pivotDrag: true,
  descentTimeScale: 1,
  // A What if with only the U-boat's return: her rockets and boats come
  // after its torpedo, not on a quiet morning.
  scriptedFromFirstHit: true,
  funnelPaint: CARPATHIA_FUNNEL_PAINT,
  liveries: CARPATHIA_LIVERIES,
};

export const carpathia: ShipSpec = {
  ...base,
  realNight: hullOpenings(whatIfOpenings(base, TORPEDO.realSpots)),
};
