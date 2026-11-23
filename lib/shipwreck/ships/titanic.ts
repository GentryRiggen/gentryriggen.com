import type { Compartment, HullStation, Opening, ShipSpec } from "./types";

/**
 * RMS Titanic on the night of 14–15 April 1912.
 *
 * Sources (see lib/shipwreck/sim/README.md for the full list and every
 * assumption): the British Wreck Commissioner's report (compartment lengths,
 * bulkhead tops, deck extents, bridge position); S. Halpern, "A Matter of
 * Stability and Trim" (the night's draught and displacement, KG, GM, Cb, Cp,
 * waterplane area, LCF, F deck height); Hackett & Bedford 1996 (GM).
 *
 * Ship frame: metres, origin on the keel at midships (half of LBP), x
 * forward, y to port, z up.
 */

const FT = 0.3048;
const LBP = 850 * FT; // 259.08
const HALF_LBP = LBP / 2; // 129.54: the forward (+) and after (-) perpendiculars
const BEAM = 92.5 * FT; // 28.19
const HALF_BEAM = BEAM / 2;
const STERN_X = -138.7; // the counter's after end (LOA 269.1 m)
const STEM_X = 130.4; // the stem head at the forecastle

/** Lowest point of the sheer, about amidships. */
const SHEER_LOW_X = -10;
const SHEER_FWD = 3.4; // C deck rise at the forward perpendicular
const SHEER_AFT = 1.2; // C deck rise at the after perpendicular
/** D and E decks have a little more sheer than C (D–C 10.5 ft, 9 ft forward). */
const LOWER_DECK_EXTRA_FWD = 0.46;
const LOWER_DECK_EXTRA_AFT = 0.3;

function sheerShape(x: number, fwd: number, aft: number): number {
  if (x >= SHEER_LOW_X) {
    const u = (x - SHEER_LOW_X) / (HALF_LBP - SHEER_LOW_X);
    return fwd * u * u;
  }
  const u = (SHEER_LOW_X - x) / (SHEER_LOW_X + HALF_LBP);
  return aft * u * u;
}

/** Heights of the decks above the keel at their lowest point (amidships). */
export const TITANIC_DECKS = [
  { name: "Boat", z: 28.19 },
  { name: "A", z: 25.15 },
  { name: "B", z: 22.4 },
  { name: "C", z: 19.66 },
  { name: "D", z: 16.46 },
  { name: "E", z: 13.72 },
  { name: "F", z: 11.2 },
  { name: "G", z: 8.69 },
  { name: "Orlop", z: 6.25 },
  { name: "Tank top", z: 1.6 },
];
const DECK_C = 19.66;
const DECK_D = 16.46;
const DECK_E = 13.72;
const DECK_B = 22.4;
const DECK_A = 25.15;
const DECK_BOAT = 28.19;

/** The C deck (shelter deck) edge: the top of the hull. */
function titanicSheerZ(x: number): number {
  return DECK_C + sheerShape(x, SHEER_FWD, SHEER_AFT);
}

/** D and E deck height at x (more sheer than C). Her sisters share it. */
export function lowerDeckZ(deck: number, x: number): number {
  return (
    deck +
    sheerShape(
      x,
      SHEER_FWD + LOWER_DECK_EXTRA_FWD,
      SHEER_AFT + LOWER_DECK_EXTRA_AFT
    )
  );
}

// ---------------------------------------------------------------------------
// Hull form. A parallel middle body, a fine entrance with flare above the
// water, a fine run to the sternpost under a counter stern that overhangs
// the rudder, a flat bottom with a 3 m bilge radius. Tuned so the hull
// displaces the night's 49,075 t at 9.83 m (Cb 0.674 at the 10.54 m load
// draught; H&W's 0.684 is on slightly different dimensions) with Halpern's
// waterplane (5,564 m²), KB and BM. The offsets below are generated from it.

const PARALLEL_FWD = 55;
const PARALLEL_AFT = -62;
const BILGE_R = 4.4;
const COUNTER_LOW = 8.5; // the run ends at the sternpost below this height
const COUNTER_HIGH = 13.0; // and at the counter's end above this one

function smoothstep(a: number, b: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Forward end of the hull at height z (plumb stem, rounded forefoot). */
function stemX(z: number): number {
  const rake = HALF_LBP + 0.04 * z;
  if (z >= 3) return rake;
  const u = 1 - z / 3;
  return rake - 2.6 * u * u;
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

/**
 * Fullness exponent p of the ends' half-breadth, 1 - u^p: hollow (p < 1)
 * low down, about 1.3 at the waterline, full with flare up to the deck.
 */
const ENTRANCE_P = [0.36, 1.17, 2.0];
const RUN_P = [0.38, 1.35, 2.4];
function fullness(p: readonly number[], z: number): number {
  return (
    p[0] +
    (p[1] - p[0]) * smoothstep(0, 10, z) +
    (p[2] - p[1]) * smoothstep(10, 20, z)
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
  // The bilge rounds the bottom over the whole length; toward the ends the
  // fine waterlines already narrow it.
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
  0, 0.01, 0.035, 0.07, 0.12, 0.19, 0.27, 0.36, 0.45, 0.53, 0.62, 0.72, 0.85, 1,
];
const STATION_COUNT = 61;

function round(v: number, step: number): number {
  return Math.round(v / step) * step;
}

function buildStations(): HullStation[] {
  const stations: HullStation[] = [];
  for (let i = 0; i < STATION_COUNT; i += 1) {
    const x = STERN_X + ((STEM_X - STERN_X) * i) / (STATION_COUNT - 1);
    const top = titanicSheerZ(x);
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
// Watertight subdivision (British inquiry report: lengths in feet from the
// forward perpendicular: A 46, B 91, C 142, D 193, E 247, F 304, G 361,
// H 418, J 478, K 514, L 583, M 640, N 703, O 757, P 814; AP 850).

function bulkheadX(feetFromFp: number): number {
  return round((425 - feetFromFp) * FT, 0.01);
}
const BH = {
  A: bulkheadX(46),
  B: bulkheadX(91),
  C: bulkheadX(142),
  D: bulkheadX(193),
  E: bulkheadX(247),
  F: bulkheadX(304),
  G: bulkheadX(361),
  H: bulkheadX(418),
  J: bulkheadX(478),
  K: bulkheadX(514),
  L: bulkheadX(583),
  M: bulkheadX(640),
  N: bulkheadX(703),
  O: bulkheadX(757),
  P: bulkheadX(814),
};

/** Top of bulkhead at x: A to C deck, B to D, C–J to E, K–P to D. */
function topTo(deck: "C" | "D" | "E", x: number): number {
  if (deck === "C") return round(titanicSheerZ(x), 0.01);
  return round(lowerDeckZ(deck === "D" ? DECK_D : DECK_E, x), 0.01);
}

function compartment(
  id: string,
  label: string,
  kind: Compartment["kind"],
  fromX: number,
  toX: number,
  aftTop: number,
  fwdTop: number
): Compartment {
  return {
    id,
    label,
    kind,
    fromX,
    toX,
    aftBulkheadTopZ: aftTop,
    fwdBulkheadTopZ: fwdTop,
  };
}

const COMPARTMENTS: Compartment[] = [
  compartment(
    "aft-peak",
    "Back peak",
    "stern",
    STERN_X,
    BH.P,
    round(titanicSheerZ(STERN_X), 0.01),
    topTo("D", BH.P)
  ),
  compartment(
    "tunnel-2",
    "Back shaft tunnel",
    "shaft",
    BH.P,
    BH.O,
    topTo("D", BH.P),
    topTo("D", BH.O)
  ),
  compartment(
    "tunnel-1",
    "Front shaft tunnel",
    "shaft",
    BH.O,
    BH.N,
    topTo("D", BH.O),
    topTo("D", BH.N)
  ),
  compartment(
    "dynamo",
    "Dynamo room",
    "engine",
    BH.N,
    BH.M,
    topTo("D", BH.N),
    topTo("D", BH.M)
  ),
  compartment(
    "turbine",
    "Turbine room",
    "engine",
    BH.M,
    BH.L,
    topTo("D", BH.M),
    topTo("D", BH.L)
  ),
  compartment(
    "engine",
    "Engine room",
    "engine",
    BH.L,
    BH.K,
    topTo("D", BH.L),
    topTo("D", BH.K)
  ),
  compartment(
    "br1",
    "Boiler room 1",
    "boiler",
    BH.K,
    BH.J,
    topTo("D", BH.K),
    topTo("E", BH.J)
  ),
  compartment(
    "br2",
    "Boiler room 2",
    "boiler",
    BH.J,
    BH.H,
    topTo("E", BH.J),
    topTo("E", BH.H)
  ),
  compartment(
    "br3",
    "Boiler room 3",
    "boiler",
    BH.H,
    BH.G,
    topTo("E", BH.H),
    topTo("E", BH.G)
  ),
  compartment(
    "br4",
    "Boiler room 4",
    "boiler",
    BH.G,
    BH.F,
    topTo("E", BH.G),
    topTo("E", BH.F)
  ),
  compartment(
    "br5",
    "Boiler room 5",
    "boiler",
    BH.F,
    BH.E,
    topTo("E", BH.F),
    topTo("E", BH.E)
  ),
  compartment(
    "br6",
    "Boiler room 6",
    "boiler",
    BH.E,
    BH.D,
    topTo("E", BH.E),
    topTo("E", BH.D)
  ),
  compartment(
    "hold3",
    "Hold 3",
    "hold",
    BH.D,
    BH.C,
    topTo("E", BH.D),
    topTo("E", BH.C)
  ),
  compartment(
    "hold2",
    "Hold 2",
    "hold",
    BH.C,
    BH.B,
    topTo("E", BH.C),
    topTo("D", BH.B)
  ),
  compartment(
    "hold1",
    "Hold 1",
    "hold",
    BH.B,
    BH.A,
    topTo("D", BH.B),
    topTo("C", BH.A)
  ),
  compartment(
    "fore-peak",
    "Front peak",
    "peak",
    BH.A,
    STEM_X,
    topTo("C", BH.A),
    round(titanicSheerZ(STEM_X), 0.01)
  ),
];

/**
 * The iceberg damage: about 1.15 m² (12.4 ft²) in all, in short split seams
 * and sprung plates low on the starboard bow, spread over about 75 m from the
 * front peak to the forward bunker of boiler room 5 (Wilding's 12 ft²; the
 * 1996 sonar survey's six thin openings). The split between compartments is
 * an estimate that fits the survivors' accounts of how fast each one filled.
 */
const REAL_NIGHT: Opening[] = [
  {
    compartmentId: "fore-peak",
    areaM2: 0.05,
    zLow: 4.0,
    zHigh: 6.5,
    x: 122,
    side: "starboard",
  },
  {
    compartmentId: "hold1",
    areaM2: 0.2,
    zLow: 3.0,
    zHigh: 7.0,
    x: 108,
    side: "starboard",
  },
  {
    compartmentId: "hold2",
    areaM2: 0.3,
    zLow: 2.0,
    zHigh: 6.0,
    x: 94,
    side: "starboard",
  },
  {
    compartmentId: "hold3",
    areaM2: 0.25,
    zLow: 1.5,
    zHigh: 5.0,
    x: 78,
    side: "starboard",
  },
  {
    compartmentId: "br6",
    areaM2: 0.3,
    zLow: 1.0,
    zHigh: 3.5,
    x: 63,
    side: "starboard",
  },
  {
    compartmentId: "br5",
    areaM2: 0.05,
    zLow: 2.5,
    zHigh: 3.5,
    x: 53,
    side: "starboard",
  },
];

/** The lifeboats in the order of `index` in boat-lowered events. */
export const TITANIC_BOATS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "A",
  "B",
  "C",
  "D",
] as const;

/** Clock time (after midnight, h:mm) to seconds after the 11:40 PM collision. */
function at(h: number, m: number): number {
  return (h * 60 + m + 20) * 60;
}

/** Lowered in about the historical order (Boat 7 first, the last at 2:05). */
const BOAT_ORDER: [string, number, number][] = [
  ["7", 0, 45],
  ["5", 0, 50],
  ["3", 0, 55],
  ["8", 1, 0],
  ["1", 1, 5],
  ["6", 1, 8],
  ["16", 1, 12],
  ["14", 1, 18],
  ["12", 1, 22],
  ["9", 1, 26],
  ["11", 1, 30],
  ["13", 1, 34],
  ["15", 1, 37],
  ["C", 1, 40],
  ["2", 1, 45],
  ["10", 1, 50],
  ["4", 1, 55],
  ["D", 2, 2],
  ["B", 2, 4],
  ["A", 2, 5],
];

function scripted(): ShipSpec["scripted"] {
  const events: ShipSpec["scripted"][number][] = [
    { t: 10 * 60, kind: "steam-start" }, // 11:50 PM
    { t: at(0, 30), kind: "steam-stop" },
  ];
  for (let i = 0; i < 8; i += 1)
    events.push({ t: at(0, 45) + i * 7 * 60, kind: "rocket", index: i });
  for (const [boat, h, m] of BOAT_ORDER)
    events.push({
      t: at(h, m),
      kind: "boat-lowered",
      index: (TITANIC_BOATS as readonly string[]).indexOf(boat),
    });
  return events.sort((a, b) => a.t - b.t);
}

const FUNNEL_X = [54, 19.3, -15.3, -50];
/** The navigating bridge, 190 ft from the bow (the boat deck's forward end). */
const BRIDGE_X = round(HALF_LBP - 190 * FT, 0.1);

export const titanic: ShipSpec = {
  id: "titanic",
  name: "Titanic",
  year: 1912,
  lbp: round(LBP, 0.01),
  loa: round(STEM_X - STERN_X, 0.01),
  beam: round(BEAM, 0.01),
  depth: DECK_C,
  // The night's condition (Halpern after Wilding): 32 ft 3 in mean draught,
  // 48,300 long tons. Her load draught was 34 ft 7 in (10.54 m), 52,310 tons.
  draught: 9.83,
  displacementT: 49075,
  // GM 0.80 m (2 ft 7.5 in, Hackett & Bedford from Olympic's inclining) over
  // this hull's KM of 11.58 m (Halpern: KM 11.68 m, KG 10.88 m).
  kg: 10.78,
  lcg: -2.75, // over the centre of buoyancy at 9.83 m, so she floats level
  // A few centimetres to port: coal drawn unevenly from the bunkers and
  // stores. Enough to choose a side when flooding takes her stability away
  // (she leaned to port late in the night).
  tcg: 0.02,
  stations: buildStations(),
  sheerZ: titanicSheerZ,
  superstructure: [
    // Coarse boxes from the C deck edge up: the poop (105 ft) and forecastle
    // (125 ft) on B deck, the bridge deck (550 ft, B) and over most of it
    // the A deck houses (500 ft, aft from the bridge). The A deck promenade
    // was open at the sides, so the middle box stops short of A deck.
    {
      fromX: STERN_X,
      toX: round(STERN_X + 105 * FT, 0.1),
      topZ: round(DECK_B + 0.7, 0.01),
    },
    {
      fromX: round(HALF_LBP - 175 * FT - 550 * FT, 0.1),
      toX: round(BRIDGE_X - 500 * FT, 0.1),
      topZ: DECK_B,
    },
    {
      fromX: round(BRIDGE_X - 500 * FT, 0.1),
      toX: BRIDGE_X,
      topZ: round((DECK_B + DECK_A) / 2, 0.01),
    },
    { fromX: BRIDGE_X, toX: round(HALF_LBP - 175 * FT, 0.1), topZ: DECK_B },
    {
      fromX: round(HALF_LBP - 125 * FT, 0.1),
      toX: STEM_X,
      topZ: round(DECK_B + 2.6, 0.01),
    },
  ],
  compartments: COMPARTMENTS,
  realNight: REAL_NIGHT,
  girder: { hogMaxNm: 4.9e9, sagMaxNm: 4.5e9 },
  scripted: scripted(),
  funnels: FUNNEL_X.map((x, i) => {
    const baseZ = round(
      DECK_BOAT + sheerShape(x, SHEER_FWD, SHEER_AFT) + 0.8,
      0.01
    );
    return { x, baseZ, topZ: round(baseZ + 24.2, 0.01), dummy: i === 3 };
  }),
  decks: TITANIC_DECKS,
  seaDepthM: 3800,
  clockStartS: 23 * 3600 + 40 * 60, // 11:40 PM, the collision
  cause: "iceberg",
};
