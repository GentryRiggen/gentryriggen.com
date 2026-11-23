import { cruiseFun } from "./funPaints";
import type {
  BulkheadDoor,
  Compartment,
  HullStation,
  Livery,
  Opening,
  PortholeRow,
  SeabedSpec,
  ShipSpec,
} from "./types";

/**
 * The cruise ship Costa Concordia on the night of 13 January 2012.
 *
 * Fincantieri yard no. 6122 (2006): 290.2 m overall, 247.4 m between
 * perpendiculars, 35.5 m wide, diesel-electric. Leaving Civitavecchia for
 * Savona she sailed close past Isola del Giglio and at 21:45:07 her port
 * side, aft, struck the easternmost rock of Le Scole at 15.5 knots. Her
 * engine rooms flooded, she lost all power, drifted north, turned back on
 * the wind with her rudders jammed, touched the rocks by Punta Gabbianara
 * with her stern about 22:39 and came to rest on her starboard side.
 *
 * Sources (lib/shipwreck/sim/README.md, "The Concordia's data and
 * sources", has every figure, where they disagree, and every assumption):
 * the Italian marine casualties body's report [MIT]; Safety at Sea's
 * flooding simulation as quoted there [SaS]; Wikipedia [WPD, WPS, WPC,
 * WPP]; EMODnet bathymetry [EMO]; OpenStreetMap's coastline of Giglio
 * (© OpenStreetMap contributors, ODbL) [OSM].
 *
 * Ship frame: metres, origin on the keel at midships (half of LBP), x
 * forward, y to port, z up.
 */

function round(v: number, step: number): number {
  return Math.round(v / step) * step;
}

const KN = 1852 / 3600;
const LBP = 247.4;
const BEAM = 35.5;
const HALF = BEAM / 2;
/** Departure draught, even keel [MIT §4.7.2]. */
const DRAUGHT = 8.12;

// ---------------------------------------------------------------------------
// Frames [MIT §4.7.2]: 0.725 m apart in the damaged zone; frame 0 taken at
// the aft perpendicular and the spacing kept for the whole length (stated:
// the report gives neither).

export const FRAME_M = 0.725;
/** Ship-frame x of frame `n`. */
export function frameX(n: number): number {
  return round(-LBP / 2 + n * FRAME_M, 0.001);
}

// ---------------------------------------------------------------------------
// Decks. [MIT p.103, the shell expansion]: deck C 2.2 m, B 5.6 m, A 8.4 m
// and deck 0 (the bulkhead deck) 11.2 m above the base line. Deck 1 at
// 14.18 m (the "14.18 m" of [MIT §2.1] and the depth [WPS] give: the
// register's depth, to deck 1). Decks 2–14 every 2.8 m (deck C to A
// spacing; stated): deck 14 at 50.6 m, her top deck about 52 m over the
// keel (spec).

export const DECK0_Z = 11.2;
export const DECK1_Z = 14.18;
const DECK_STEP_M = 2.8;
function upperDeckZ(n: number): number {
  return round(DECK1_Z + (n - 1) * DECK_STEP_M, 0.01);
}
/** Her decks, top down: 14 to 1, the bulkhead deck 0, then A, B and C. */
export const CONCORDIA_DECKS: { name: string; z: number }[] = [
  ...Array.from({ length: 14 }, (_, i) => ({
    name: String(14 - i),
    z: upperDeckZ(14 - i),
  })),
  { name: "0", z: DECK0_Z },
  { name: "A", z: 8.4 },
  { name: "B", z: 5.6 },
  { name: "C", z: 2.2 },
];
/** Deck 3: the top of her steel side shell, under the lifeboat deck (4). */
export const DECK3_Z = upperDeckZ(3);

// ---------------------------------------------------------------------------
// Hull. No lines plan is public: a cruise ship's form built to her
// particulars (README, "Her hull"): a long parallel midbody, flat bottom
// and a 2.5 m bilge, a fine raked bow with its stem top far forward
// (her LOA is 43 m more than her LBP), a wide transom stern whose run
// lifts the bottom clear of the water aft of the rudders. The fullness is
// set so she displaces her 56,600 t at 8.12 m (block coefficient 0.77 on
// LBP: derived, stated).

/** Aft end (transom) and stem top: LOA 290.2 m [MIT, WPS]. */
export const STERN_X = -139.0;
export const STEM_X = round(STERN_X + 290.2, 0.01);
/** Where the waterline ends forward (the forefoot), m. */
const STEM_WL_X = 128;
/** The parallel midbody [assumed]. */
const MID_AFT_X = -52;
const MID_FWD_X = 26;
/** The run: the bottom rises from here aft to the transom's foot. */
const RUN_X = -78;
const TRANSOM_FOOT_Z = 9.6;
/** The forefoot: the bottom rises from here to the stem. */
const FOREFOOT_X = 104;

/** Height of the section's bottom at x. */
function bottomZ(x: number): number {
  if (x < RUN_X) {
    const u = (RUN_X - x) / (RUN_X - STERN_X);
    return TRANSOM_FOOT_Z * u ** 1.6;
  }
  if (x > FOREFOOT_X) {
    if (x <= STEM_WL_X) {
      const u = (x - FOREFOOT_X) / (STEM_WL_X - FOREFOOT_X);
      return 3.0 * u ** 2;
    }
    // The raked stem: from the forefoot (3 m) up to the stem top at deck 3.
    const u = (x - STEM_WL_X) / (STEM_X - STEM_WL_X);
    return 3.0 + (DECK3_Z - 0.5 - 3.0) * u ** 0.8;
  }
  return 0;
}

/** Waterline half-breadth at x (the widest under the waterline). */
function waterlineHB(x: number): number {
  if (x >= MID_AFT_X && x <= MID_FWD_X) return HALF;
  if (x > MID_FWD_X) {
    const u = Math.min(1, (x - MID_FWD_X) / (STEM_WL_X - MID_FWD_X));
    return HALF * (1 - u ** 2.1);
  }
  const u = (MID_AFT_X - x) / (MID_AFT_X - STERN_X);
  return HALF * (1 - 0.32 * u ** 1.8);
}

/** Deck-3 half-breadth at x (the flare forward, the wide transom aft). */
function deckHB(x: number): number {
  if (x <= 50) {
    if (x >= MID_AFT_X) return HALF;
    const u = (MID_AFT_X - x) / (MID_AFT_X - STERN_X);
    return HALF * (1 - 0.18 * u ** 2);
  }
  const u = Math.min(1, (x - 50) / (STEM_X - 50));
  return HALF * Math.sqrt(Math.max(0, 1 - u ** 2.2));
}

/** Superellipse exponent: full sections amidships, finer to the ends. */
function fullness(x: number): number {
  if (x >= MID_AFT_X && x <= MID_FWD_X) return 9;
  if (x > MID_FWD_X) {
    const u = Math.min(1, (x - MID_FWD_X) / (STEM_WL_X - MID_FWD_X));
    return 9 - 7.2 * u ** 0.9;
  }
  const u = (MID_AFT_X - x) / (MID_AFT_X - STERN_X);
  return 9 - 6 * u;
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
  10,
  DECK0_Z,
  DECK1_Z,
  17,
  DECK3_Z,
];

function buildStations(): HullStation[] {
  const n = 61;
  const out: HullStation[] = [];
  for (let i = 0; i < n; i += 1) {
    const x = round(STERN_X + ((STEM_X - STERN_X) * i) / (n - 1), 0.01);
    const zb = Math.min(bottomZ(x), DECK3_Z - 0.5);
    const wl = waterlineHB(x);
    const dk = deckHB(x);
    const k = fullness(x);
    // The shaped part (superellipse) from the bottom to the waterline, or
    // 2 m over a bottom that is already above it (the run, the stem).
    const zs = Math.min(DECK3_Z, Math.max(DRAUGHT, zb + 2));
    const offsets: [number, number][] = [];
    const zs0 = [zb, ...Z_LEVELS.filter((z) => z > zb + 0.05)];
    if (zs > DRAUGHT && !zs0.includes(zs)) zs0.push(zs);
    zs0.sort((a, b) => a - b);
    for (const z of zs0) {
      let hb: number;
      if (z <= zs) {
        const u = Math.min(1, Math.max(0, (z - zb) / (zs - zb)));
        hb = wl * Math.pow(1 - Math.pow(1 - u, k), 1 / k);
      } else {
        // Above: straight to the deck-3 breadth (flare or tumble).
        const u = (z - zs) / (DECK3_Z - zs);
        hb = wl + (dk - wl) * Math.min(1, Math.max(0, u));
      }
      offsets.push([round(z, 0.001), round(Math.max(0, hb), 0.001)]);
    }
    out.push({ x, offsets });
  }
  return out;
}
const STATIONS = buildStations();

/** The top of her hull (deck 3's edge): level, as a cruise ship's is. */
function concordiaSheerZ(): number {
  return DECK3_Z;
}

// ---------------------------------------------------------------------------
// Watertight subdivision (R4). WTC 4–8 at the side shell's frames [MIT
// §4.7.6 table, Figure 33]: 44, 60, 76, 100, 116, 140. The rest are not in
// the report's text: WTC 1–3 aft (frames 8 and 24, the steering gear and
// stern thrusters, then stores) and WTC 9–19 forward to a collision
// bulkhead about 5% of LBP aft of the FP (frame 324), spaced evenly (stated:
// the floodable-length rule needs each under about 14.6 m, the two-
// compartment standard [MIT §4.7.2 gives 10.71 m damage]). Every bulkhead
// up to deck 0 (11.2 m), the bulkhead deck [MIT p.103].

const BULKHEAD_FRAMES = [
  8, 24, 44, 60, 76, 100, 116, 140, 158, 176, 194, 212, 230, 248, 266, 284, 304,
  324,
];
const WTC_LABEL: Record<number, [string, Compartment["kind"]]> = {
  1: ["Steering gear", "stern"],
  2: ["Stern thrusters", "shaft"],
  3: ["Stores", "hold"],
  4: ["Reefer compressor room", "engine"],
  5: ["Electric motor room", "engine"],
  6: ["Back generator room", "engine"],
  7: ["Front generator room", "engine"],
  8: ["Pump and water-maker room", "engine"],
  19: ["Front peak", "peak"],
};

function buildCompartments(): Compartment[] {
  const xs = [STERN_X, ...BULKHEAD_FRAMES.map(frameX), STEM_X];
  const out: Compartment[] = [];
  for (let i = 0; i < xs.length - 1; i += 1) {
    const n = i + 1;
    const [label, kind] = WTC_LABEL[n] ?? [`Stores and workrooms ${n}`, "hold"];
    out.push({
      id: `wtc${n}`,
      label,
      kind,
      // Her stores and workrooms along the middle: tapped on the hull.
      ...(WTC_LABEL[n] ? {} : { noChip: true }),
      fromX: xs[i],
      toX: xs[i + 1],
      aftBulkheadTopZ: i === 0 ? DECK3_Z : DECK0_Z,
      fwdBulkheadTopZ: i === xs.length - 2 ? DECK3_Z : DECK0_Z,
    });
  }
  return out;
}
const COMPARTMENTS = buildCompartments();

// ---------------------------------------------------------------------------
// The gash (R5) [MIT §4.7.2, §4.7.6]: the rock tore her port side from
// frame 124 aft to frame 52, where it stuck, about 52.9 m in all; the main
// breach frames 52–101 (35.9 m), from the bilge strake to 1 m under the
// waterline; "some square metres" into WTCs 4, 5 and 6; WTC 7 through its
// ladder space (progressive); tear A across frame 116 (1.12 m × 0.05 m)
// into WTC 8's double bottom. The rock ran aft along her side as she ran
// on, at about 7.5 m/s (her 15.5 kn falling to 8.3): each hole opens as it
// passed (`t`), frame 124 at t = 0, frame 52 at about 7 s.

const GASH_LOW_Z = 2.2;
const GASH_HIGH_Z = round(DRAUGHT - 1, 0.01);
/** Seconds after the strike the rock reached frame `n` (124 → 0, 52 → 7). */
function rockAt(n: number): number {
  return round(((124 - n) / (124 - 52)) * 7, 0.1);
}

/**
 * Each compartment's hole, m² (calibrated to the report's fill times
 * inside "some square metres": README, "The Concordia's calibration").
 */
export const GASH_M2 = {
  wtc4: 0.1,
  wtc5: 5.0,
  wtc6: 2.5,
  wtc7: 0.28,
  wtc8: round(1.12 * 0.05, 0.001),
};

function gash(
  id: keyof typeof GASH_M2,
  fromFrame: number,
  toFrame: number,
  zLow = GASH_LOW_Z,
  zHigh = GASH_HIGH_Z
): Opening {
  const mid = (fromFrame + toFrame) / 2;
  return {
    compartmentId: id,
    areaM2: GASH_M2[id],
    zLow,
    zHigh,
    x: frameX(mid),
    side: "port",
    t: rockAt(mid),
  };
}

const REAL_GASH: Opening[] = [
  // Tear A, under the bilge keel across frame 116, in the double bottom.
  gash("wtc8", 115.5, 117, 0.6, 1.6),
  // WTC 7: the ladder space just forward of the main breach.
  gash("wtc7", 100, 106),
  gash("wtc6", 76, 100),
  gash("wtc5", 60, 76),
  // WTC 4: frames 52–60, where the rock stuck and half filled the hole.
  gash("wtc4", 52, 60),
];

/**
 * The door into the electric motor room (R6) [SaS keypoint 1]: opened at
 * 21:45:46 so water ran from WTC 5 into WTC 4; open from the strike here
 * (39 s early: stated). A watertight sliding door at deck C, 2 m high;
 * its open area calibrated to WTC 4 "partially flooded ... completely
 * filled after about 40 minutes" [MIT §4.7.1]: 0.22 m², a door left
 * barely open (a fully open 1 m × 2 m door fills WTC 4 in minutes).
 * Open only on her real night (a hand opened it); a What if keeps it shut
 * (run.ts).
 */
export const PEM_DOOR_M2 = 0.22;
const DOORS: readonly BulkheadDoor[] = [
  {
    id: "pem-door",
    aftId: "wtc4",
    fwdId: "wtc5",
    x: frameX(60),
    zLow: 2.2,
    zHigh: 4.2,
    areaM2: PEM_DOOR_M2,
    kind: "door",
  },
];

/**
 * The mooring decks aft at deck 1 [SaS keypoint 10: "some flooding of
 * Deck 1 at the aft mooring deck"]: open fairleads and doors, both sides,
 * wet once she is down by the stern. A row 0.4 m tall (the sim's strip)
 * along the after 20 m, 0.03 m² per metre: about 0.6 m² a side, a few
 * fairleads (calibrated: README).
 */
const MOORING: PortholeRow[] = (["port", "starboard"] as const).map((side) => ({
  z: round(DECK1_Z + 1.0, 0.01),
  fromX: STERN_X + 1,
  toX: STERN_X + 21,
  side,
  openM2PerM: 0.03,
}));

// ---------------------------------------------------------------------------
// Her earth frame and the coast (R8, R9). Origin: her midships at the
// strike; x along her heading then (350° [MIT §3]); y to port (260°).
// Positions from latitude and longitude by a local equirectangular
// projection about 42.36° N (under a metre's error over these 3 km).
// Her midships at the strike: the easternmost rock of Le Scole (Scola
// piccola's east tip [OSM]) at her port side, at frame 124 (where the
// tear began), so 33.8 m aft of midships and half her beam to port.

const EARTH_R = 6371008.8;
const LAT0 = 42.36;
const HEADING = (350 * Math.PI) / 180;
const PORT = (260 * Math.PI) / 180;
/** The rock she struck: Scola piccola's east tip [OSM]. */
export const LE_SCOLE_ROCK = { lat: 42.3556634, lon: 10.9302657 };

function eastNorth(lat: number, lon: number): [number, number] {
  const r = Math.PI / 180;
  return [lon * r * EARTH_R * Math.cos(LAT0 * r), lat * r * EARTH_R];
}
const ORIGIN = ((): [number, number] => {
  const [e, n] = eastNorth(LE_SCOLE_ROCK.lat, LE_SCOLE_ROCK.lon);
  const aft = -frameX(124); // the rock is this far aft of midships
  const stbd = (80 * Math.PI) / 180;
  return [
    e + aft * Math.sin(HEADING) + HALF * Math.sin(stbd),
    n + aft * Math.cos(HEADING) + HALF * Math.cos(stbd),
  ];
})();

/** Earth-frame x, y (m) of a latitude and longitude (degrees). */
export function concordiaEarth(lat: number, lon: number): [number, number] {
  const [e0, n0] = eastNorth(lat, lon);
  const e = e0 - ORIGIN[0];
  const n = n0 - ORIGIN[1];
  return [
    round(e * Math.sin(HEADING) + n * Math.cos(HEADING), 0.1),
    round(e * Math.sin(PORT) + n * Math.cos(PORT), 0.1),
  ];
}

/** A clock time on the night (h, m, s) as seconds after the strike. */
function after(h: number, m: number, s = 0): number {
  return h * 3600 + m * 60 + s - (21 * 3600 + 45 * 60 + 7);
}

/** The fixes the path and the tests use [MIT §2.4.5, §3]. */
export const CONCORDIA_FIXES = {
  /** 22:12, the coast guard's position off Punta Lazzaretto [MIT §3]. */
  north: {
    t: after(22, 12),
    lat: 42 + 22 / 60 + 24 / 3600,
    lon: 10 + 55 / 60 + 36 / 3600,
  },
  /** 22:14, MRSC Livorno's AIS position [MIT §2.4.5]. */
  ais: { t: after(22, 14), lat: 42 + 22.1 / 60, lon: 10 + 55.32 / 60 },
  /** 22:58, "practically still in its final position" [MIT §2.4.5]. */
  final: {
    t: after(22, 58),
    lat: 42 + 21 / 60 + 50.76 / 3600,
    lon: 10 + 55 / 60 + 17.4 / 3600,
  },
};

/**
 * Giglio's east coast from south of Giglio Porto to north of Punta
 * Gabbianara [OSM coastline, simplified to 20 m], south to north, then
 * on to her north cape (so the open sea beyond the island is sea).
 */
const SHORE_LATLON: readonly (readonly [number, number])[] = [
  [42.343177, 10.923947],
  [42.350041, 10.924638],
  [42.350171, 10.923293],
  [42.35049, 10.923073],
  [42.350161, 10.921824],
  [42.350412, 10.921791],
  [42.350298, 10.922377],
  [42.350927, 10.920752],
  [42.352218, 10.920462],
  [42.352823, 10.921593],
  [42.353771, 10.921396],
  [42.354287, 10.921965],
  [42.354937, 10.921877],
  [42.35463, 10.923747],
  [42.355016, 10.923795],
  [42.355138, 10.923442],
  [42.355286, 10.923869],
  [42.355812, 10.923694],
  [42.355434, 10.925784],
  [42.355604, 10.926434],
  [42.356364, 10.927052],
  [42.35693, 10.925887],
  [42.358175, 10.924973],
  [42.358224, 10.924546],
  [42.358955, 10.924242],
  [42.359264, 10.923603],
  [42.359178, 10.922646],
  [42.359598, 10.922875],
  [42.359841, 10.92205],
  [42.361442, 10.921222],
  [42.359678, 10.921833],
  [42.359476, 10.921166],
  [42.359916, 10.920768],
  [42.359474, 10.92066],
  [42.360373, 10.919385],
  [42.360551, 10.919604],
  [42.360319, 10.919844],
  [42.360847, 10.919487],
  [42.360917, 10.920568],
  [42.361188, 10.920416],
  [42.361058, 10.919596],
  [42.361509, 10.919506],
  [42.361599, 10.92014],
  [42.361849, 10.9193],
  [42.362188, 10.919506],
  [42.36264, 10.918608],
  [42.363894, 10.919149],
  [42.364837, 10.918531],
  [42.365093, 10.918682],
  [42.364913, 10.919056],
  [42.365226, 10.919174],
  [42.365127, 10.919555],
  [42.365679, 10.919422],
  [42.365251, 10.920772],
  [42.366045, 10.920723],
  [42.366686, 10.919814],
  [42.366535, 10.919204],
  [42.36684, 10.918965],
  [42.367435, 10.920603],
  [42.368355, 10.92031],
  [42.368343, 10.91848],
  [42.367064, 10.918575],
  [42.367992, 10.917889],
  [42.368084, 10.916481],
  [42.368723, 10.915439],
  [42.369171, 10.913001],
  [42.370083, 10.912746],
  [42.370302, 10.913449],
  [42.370887, 10.913072],
  [42.371045, 10.911803],
  [42.371254, 10.911907],
  [42.371767, 10.910741],
  [42.373362, 10.91223],
  [42.373762, 10.91107],
  [42.373887, 10.91131],
  [42.374175, 10.910993],
  [42.374106, 10.910095],
  [42.374599, 10.909742],
  [42.375214, 10.908477],
  [42.375633, 10.908474],
  [42.375895, 10.907596],
  [42.37761, 10.907345],
  // Punta del Fenaio, her north cape, where the coast turns west.
  [42.389786, 10.885892],
];

/** Le Scole's islets [OSM]: centroid and outline radius (m); above water
 *  (top 0). */
const SCOLE_LATLON: readonly (readonly [number, number, number])[] = [
  [42.355659, 10.930145, 11], // Scola piccola
  [42.355969, 10.928963, 52], // Scola grande
  [42.356437, 10.928849, 22],
  [42.355948, 10.927434, 43],
];

/**
 * The floor (R9): depth by distance offshore, linear [MIT: 27 m where she
 * lay at 04:39 and 100 m at the anchor point; WPD about 20 m; WPP the
 * 30 m ledge; WPS a 70 m trough beside her; EMO from 50 m at 200 m
 * offshore to 146 m 2 km out]. Two rock spurs under her starboard side
 * where she lay [WPP] (README, "The seabed").
 */
const PROFILE: readonly (readonly [number, number])[] = [
  [0, 0],
  [25, 8],
  [70, 18],
  [150, 28],
  [200, 45],
  [260, 66],
  [300, 78],
  [460, 98],
  [760, 104],
  [1200, 110],
  [2000, 146],
  [3500, 150],
];
/**
 * The two spurs she lay on [WPP], earth x, y (m), radius (m), top depth
 * (m): not surveyed (no public survey gives them), placed under her
 * starboard quarter and her starboard bow where her drift brings her.
 */
export const SPURS: readonly (readonly [number, number, number, number])[] = [
  [1156, 499, 25, 14.5],
  [1026, 574, 25, 18],
];

function buildSeabed(): SeabedSpec {
  return {
    shore: SHORE_LATLON.map(([lat, lon]) => concordiaEarth(lat, lon)),
    seaSide: -1,
    profile: PROFILE,
    rocks: [
      ...SCOLE_LATLON.map(([lat, lon, r]) => {
        const [x, y] = concordiaEarth(lat, lon);
        return { x, y, radiusM: r, topDepthM: 0 };
      }),
      ...SPURS.map(([x, y, r, top]) => ({ x, y, radiusM: r, topDepthM: top })),
    ],
  };
}

// ---------------------------------------------------------------------------
// Her drift (R8): a rule, not physics. After the strike she ran on at
// 8.3 kn on 350° with no power [MIT §3], her way dying to 0.3 kn at 22:11
// (an exponential decay through those two speeds), which carries her to
// the 22:12 position off Punta Lazzaretto (it lies on her 350° line,
// 1.95 km on). Then her bow swung to starboard, round to the south-west,
// on the north-east wind and her jammed rudders [MIT §3, §4.7], and she
// drifted back to the coast by Punta Gabbianara, her stern touching the
// rocks about 22:39, still at 22:58 [MIT §2.4.5]. Leeway is folded into
// her heading. README "Her drift" for the 22:14 AIS fix, which this does
// not pass (it cannot be reached from the 22:12 one in two minutes).

const V0 = 8.3 * KN;
const V_STOP = 0.3 * KN;
const T_STOP = after(22, 11);
const DECAY = Math.log(V0 / V_STOP) / T_STOP;

function outbound(): [number, number, number, number][] {
  const [nx, ny] = concordiaEarth(
    CONCORDIA_FIXES.north.lat,
    CONCORDIA_FIXES.north.lon
  );
  const s = (t: number) => (V0 / DECAY) * (1 - Math.exp(-DECAY * t));
  const scale = nx / s(CONCORDIA_FIXES.north.t);
  // A point a minute before the strike on the same line at 8.3 kn only
  // shapes the curve's start (Catmull-Rom): her speed from t = 0 is the
  // 8.3 kn she fell to at once [MIT §3]. Runs start at 0.
  return [-60, 0, 60, 180, 360, 600, 900, 1200, T_STOP].map((t) => [
    t,
    round((t < 0 ? V0 * t : s(t)) * scale, 0.1),
    round((ny * t) / CONCORDIA_FIXES.north.t, 0.1),
    0,
  ]);
}

/** Shared with the What if "blown out to sea" to here: her bow starting
 *  round (her way all but gone), 27.5 and 30 minutes on. */
const TURN_START: [number, number, number, number][] = [
  [1650, 1956, -34, -12],
  [1800, 1958, -36, -40],
];

function realDrift(): [number, number, number, number][] {
  const [fx, fy] = concordiaEarth(
    CONCORDIA_FIXES.final.lat,
    CONCORDIA_FIXES.final.lon
  );
  return [
    ...outbound(),
    ...TURN_START,
    [2100, 1905, 0, -100],
    [2400, 1790, 75, -150],
    [2700, 1630, 175, -185],
    [3000, 1440, 290, -205],
    [3300, round(fx + 55, 0.1), round(fy - 35, 0.1), -210],
    [3700, round(fx + 15, 0.1), round(fy - 8, 0.1), -210],
    [CONCORDIA_FIXES.final.t, fx, fy, -210],
  ];
}

/**
 * The What if "blown out to sea" (R16): the same until 22:15, then a
 * counterfactual drift east-south-east into deep water at the real drift's
 * pace (about 0.6 m/s), her bow round to the east.
 */
function seaDrift(): [number, number, number, number][] {
  return [
    ...outbound(),
    ...TURN_START,
    [2100, 1930, -150, -80],
    [2400, 1870, -330, -100],
    [3000, 1740, -700, -110],
    [3600, 1600, -1060, -110],
    [4800, 1330, -1790, -110],
  ];
}

// ---------------------------------------------------------------------------
// Boats (R19): 26 lifeboats [MIT §4.5], 13 a side on deck 4, from
// x −84 to +84 about 14 m apart (measured off the builder's scale model's
// broadside photograph: components/shipwreck/model/README.md, "The Costa
// Concordia"). Starboard first from 22:55 [MIT §3],
// one about every 2.5 minutes, then port from 23:20; three port boats
// were never lowered (23 of 26 used [MIT §2.4.6]). Times are real seconds
// after the strike (`agroundTimeScale` ships: see run.ts).

export interface ConcordiaBoat {
  /** Index in `boat-lowered` events. */
  index: number;
  side: "port" | "starboard";
  /** Ship-frame x of the boat's middle (m). */
  x: number;
}

const BOAT_AFT_X = -84;
const BOAT_FWD_X = 84;
function buildBoats(): ConcordiaBoat[] {
  const out: ConcordiaBoat[] = [];
  for (const side of ["starboard", "port"] as const)
    for (let k = 0; k < 13; k += 1)
      out.push({
        index: out.length,
        side,
        x: round(BOAT_AFT_X + ((BOAT_FWD_X - BOAT_AFT_X) * k) / 12, 0.1),
      });
  return out;
}
export const CONCORDIA_BOATS: readonly ConcordiaBoat[] = buildBoats();
/** The three port boats never lowered: the forward three [assumed]. */
export const CONCORDIA_BOATS_KEPT = [23, 24, 25];

function scripted(): ShipSpec["scripted"] {
  const events: ShipSpec["scripted"][number][] = [];
  CONCORDIA_BOATS.forEach((b) => {
    if (CONCORDIA_BOATS_KEPT.includes(b.index)) return;
    const k = b.side === "starboard" ? b.index : b.index - 13;
    const start = b.side === "starboard" ? after(22, 55) : after(23, 20);
    events.push({ t: start + k * 150, kind: "boat-lowered", index: b.index });
  });
  return events.sort((a, b) => a.t - b.t);
}

// ---------------------------------------------------------------------------
// Load (R3): 56,600 t at 8.12 m even keel [MIT §4.7.1, §4.7.2]. KG for an
// intact GM of about 2 m (unsourced; README).

/**
 * Her funnel: Costa yellow with the blue "C", under a black top (the
 * exhaust cage) [WC: every photograph; model README].
 */
const FUNNEL_PAINT = { funnel: 0xf2c230, top: 0x1c1c1e };

/** Her one real paint, then the cruise fun paints (1.7, R18). */
export const CONCORDIA_LIVERIES: readonly Livery[] = [
  {
    id: "costa-2012",
    label: "Her Costa colours",
    year: 2012,
    default: true,
    sources: [
      "Wikimedia Commons, Category:Costa Concordia (ship, 2006): white hull and decks, a blue line at the waterline, the yellow funnel with the blue C and its black top",
      "MIT report §4.7.2: the blue stripe at her waterline",
    ],
    swatches: [0xeeeeea, 0xf2c230],
    funnelPaint: FUNNEL_PAINT,
    look: { hull: 0xeeeeea, funnel: 0xf2c230, top: 0x1c1c1e },
  },
  ...cruiseFun(),
];

export const concordia: ShipSpec = {
  id: "concordia",
  name: "Costa Concordia",
  year: 2012,
  lbp: LBP,
  loa: 290.2,
  beam: BEAM,
  depth: DECK3_Z,
  draught: DRAUGHT,
  displacementT: 56600,
  kg: 14.6,
  lcg: -5.8,
  stations: STATIONS,
  sheerZ: concordiaSheerZ,
  superstructure: [
    // Aft terraces (decks 4–9), the main block (to deck 11) and the top
    // tier with the pool decks, sports deck and spa (to deck 14).
    { fromX: STERN_X + 1, toX: -112, topZ: upperDeckZ(9) },
    { fromX: -112, toX: 112, topZ: upperDeckZ(11) },
    { fromX: -70, toX: 96, topZ: upperDeckZ(14), halfBreadthM: 14 },
    { fromX: 112, toX: 128, topZ: upperDeckZ(8) },
  ],
  compartments: COMPARTMENTS,
  realNight: REAL_GASH,
  girder: { hogMaxNm: 10e9, sagMaxNm: 11e9 },
  scripted: scripted(),
  // One funnel aft, its middle 87 m from her stern and its black top 66.5 m
  // over the keel (measured off the builder's scale model's broadside
  // photograph: model README, "The Costa Concordia"); its foot under the
  // top deck.
  funnels: [
    {
      x: -52,
      baseZ: upperDeckZ(13),
      topZ: 66.5,
      dummy: false,
      falls: false,
    },
  ],
  decks: CONCORDIA_DECKS,
  seaDepthM: 30,
  clockStartS: 21 * 3600 + 45 * 60 + 7,
  cause: "rocks",
  portholes: MOORING,
  preRollS: 40,
  headway: {
    startMs: round(15.5 * KN, 0.01),
    path: realDrift(),
    pathToSea: seaDrift(),
    pathWhenOpen: ["wtc5", "wtc6"],
  },
  doors: DOORS,
  wreck: { restDeg: 65, minListDeg: 10 },
  pumpsM3s: round((240 + 265 + 240 + 240) / 3600, 0.01),
  seabed: buildSeabed(),
  gash: { side: "port", zLow: GASH_LOW_Z, zHigh: GASH_HIGH_Z, areaM2: 4.0 },
  heel: {
    wind: { fromDeg: -55, kn: 17, areaM2: 10500, leverM: 23.5, cd: 1.0 },
    rock: {
      t: 213,
      massT: round(97 * (1 - 1.025 / 2.7), 0.1),
      x: frameX(52),
      y: 10.7,
      z: 4,
    },
    muster: { fromT: after(21, 55), toT: after(22, 40), massT: 230, y: -15 },
  },
  blackout: { compartmentId: "wtc6", depthM: 2.0, emergencyLight: 0.25 },
  aground: {
    restDeg: 65,
    minListDeg: 10,
    pace: [
      [after(23, 11, 24), 30],
      [after(24, 0), 40],
      [after(24, 41), 65],
    ],
  },
  agroundTimeScale: 6,
  boxWaterAtSide: true,
  spillBreadth: 0.02,
  funnelPaint: FUNNEL_PAINT,
  liveries: CONCORDIA_LIVERIES,
};

/** For the data tests. */
export const CONCORDIA_BULKHEAD_FRAMES = BULKHEAD_FRAMES;
