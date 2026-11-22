import type {
  Compartment,
  DeckOpening,
  HullStation,
  Opening,
  ShipSpec,
  StormSpec,
} from "./types";
import { stormComponents } from "../sim/waves";

/**
 * SS Edmund Fitzgerald on the afternoon of 10 November 1975, Lake Superior.
 *
 * Sources (see lib/shipwreck/sim/README.md, "The Fitzgerald's data", for
 * the full list, where they disagree, and every assumption): the U.S.
 * Coast Guard Marine Board of Investigation's report (1977: vessel data,
 * the holds, hatches, coamings, clamps, vents, pumps, the cargo, the
 * load line, the last voyage, the wreck survey); the NTSB's report
 * NTSB-MAR-78-3 (1978: the midship section and tank plan, the pumps, the
 * taconite's voids, the hatch covers' 4 ft design head, the analysis);
 * Hultquist, Dutter & Schwab, "Reexamination of the 9–10 November 1975
 * 'Edmund Fitzgerald' Storm Using Today's Technology", BAMS 87(5), 2006
 * (NOAA/GLERL's hindcast: significant height over 7 m at 7 PM, 7.5–7.8 m
 * by 8 PM, waves running west to east).
 *
 * Ship frame: metres, origin on the keel at midships (half of LBP), x
 * forward, y to port, z up.
 */

const FT = 0.3048;
const IN = FT / 12;
const LBP = 711 * FT; // 216.71
const HALF_LBP = LBP / 2; // 108.36: the forward (+) and after (-) perpendiculars
const BEAM = 75 * FT; // 22.86
const HALF_BEAM = BEAM / 2;
/** Moulded depth to the spar deck at side, amidships (39 ft). */
const DEPTH = 39 * FT; // 11.89
/**
 * LOA 729 ft: a nearly upright stem and a round stern beyond the
 * perpendiculars. Her photographs (the 1971 bow slide; USACE "underway")
 * show a stem nearly plumb from the keel to the forecastle with a small
 * rake: 0.5 m from the waterline (the forward perpendicular) to the spar
 * deck at the stem, so the 18 ft between LOA and LBP is mostly her round
 * stern's overhang (the model README).
 */
const STEM_RAKE = 0.5;
const STEM_X = round(HALF_LBP + STEM_RAKE, 0.01); // 108.86, the stem at the spar deck
const STERN_X = round(STEM_X - 729 * FT, 0.01); // -113.34, the round stern's end

/** Her draught leaving Superior: 27 ft 2 in forward, 27 ft 6 in aft. */
const DRAUGHT_FWD = 27 * FT + 2 * IN; // 8.28
const DRAUGHT_AFT = 27 * FT + 6 * IN; // 8.38
const DRAUGHT = (DRAUGHT_FWD + DRAUGHT_AFT) / 2; // 8.33

/** Sheer of the spar deck (estimates from her profile: a laker's nearly
 *  straight deck line, rising a little to the bow). */
const SHEER_FWD = 0.9;
const SHEER_AFT = 0.45;
/** Camber of the spar deck (18 in) and her hatch coamings (24 in). */
const CAMBER = 18 * IN;
const COAMING = 24 * IN;
/** Ballast tank vents: 18 in over the deck (with the mushroom cap). */
const VENT_HEIGHT = 18 * IN;

function round(v: number, step: number): number {
  return Math.round(v / step) * step;
}

function sheerShape(x: number): number {
  if (x >= 0) {
    const u = x / HALF_LBP;
    return SHEER_FWD * u * u;
  }
  const u = -x / HALF_LBP;
  return SHEER_AFT * u * u;
}

/** The spar deck at side: the top of her hull. */
function fitzgeraldSheerZ(x: number): number {
  return DEPTH + sheerShape(x);
}

/**
 * Heights of her decks above the keel at their lowest point (amidships).
 * The spar deck is the hull's top (39 ft); the forecastle and texas decks
 * of the forward house and the poop deck of the after house are about
 * 8 ft 6 in apart, the main deck a deck below the spar deck (its doors in
 * the screen bulkheads), the tank top over a 5 ft double bottom. The
 * pilothouse stands one tall tier on the texas deck (the 1971 bow slide:
 * about as tall as the forecastle tier, 3.3 m to its visor, its windows in
 * the upper third); its floor a step up on its void, 0.7 m, puts an
 * officer's eye at the window band (model README).
 */
const DECK_STEP = 2.6;
const DECK_SPAR = round(DEPTH, 0.01);
const DECK_FORECASTLE = round(DECK_SPAR + DECK_STEP, 0.01);
const DECK_TEXAS = round(DECK_FORECASTLE + DECK_STEP, 0.01);
const DECK_PILOTHOUSE = round(DECK_TEXAS + 0.7, 0.01);
const DECK_POOP = round(DECK_SPAR + DECK_STEP, 0.01);
const DECK_BOAT = round(DECK_POOP + DECK_STEP, 0.01);
const DECK_MAIN = round(DECK_SPAR - DECK_STEP, 0.01);
const TANK_TOP = round(5 * FT, 0.01); // 1.52

export const FITZGERALD_DECKS = [
  { name: "Pilothouse", z: DECK_PILOTHOUSE },
  { name: "Texas", z: DECK_TEXAS },
  { name: "Forecastle", z: DECK_FORECASTLE },
  { name: "After house top", z: DECK_BOAT },
  { name: "Poop", z: DECK_POOP },
  { name: "Spar", z: DECK_SPAR },
  { name: "Main", z: DECK_MAIN },
  { name: "Tank top", z: TANK_TOP },
];

// ---------------------------------------------------------------------------
// Hull form. A straight-decker: a long parallel middle body, a short full
// entrance under a raked stem, a short run to a round stern, flat bottom,
// a tight bilge. Tuned to a block coefficient of about 0.84 at her draught
// (README: "The Fitzgerald's data").

const PARALLEL_FWD = 72;
const PARALLEL_AFT = -66;
const BILGE_R = 1.6;
/** The run ends at the sternpost below this height, the round stern's end above. */
const STERN_LOW = 4.5;
const STERN_HIGH = 9.5;

function smoothstep(a: number, b: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** The stem's forefoot: a tight round into the keel (m). */
const FOREFOOT_R = 1.5;

/** Forward end of the hull at height z: the stem nearly upright, its small
 *  rake straight on down to a tight forefoot. */
function stemX(z: number): number {
  const rake =
    HALF_LBP +
    ((STEM_X - HALF_LBP) * (z - DRAUGHT)) / (DEPTH - DRAUGHT + SHEER_FWD);
  if (z >= FOREFOOT_R) return rake;
  const d = FOREFOOT_R - z;
  return rake - (FOREFOOT_R - Math.sqrt(FOREFOOT_R * FOREFOOT_R - d * d));
}

/** After end of the hull at height z: the sternpost low, the round stern high. */
function sternX(z: number): number {
  return (
    -HALF_LBP - (-STERN_X - HALF_LBP) * smoothstep(STERN_LOW, STERN_HIGH, z)
  );
}

function bilge(z: number): number {
  if (z >= BILGE_R) return 1;
  const d = BILGE_R - z;
  return (
    (HALF_BEAM - BILGE_R + Math.sqrt(BILGE_R * BILGE_R - d * d)) / HALF_BEAM
  );
}

/** Fullness exponent p of the ends' half-breadth, 1 − u^p. */
const ENTRANCE_P = [1.2, 1.9, 2.6];
const RUN_P = [0.9, 1.7, 2.6];
function fullness(p: readonly number[], z: number): number {
  return (
    p[0] +
    (p[1] - p[0]) * smoothstep(0, DRAUGHT, z) +
    (p[2] - p[1]) * smoothstep(DRAUGHT, DEPTH + SHEER_FWD, z)
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
  0, 0.01, 0.04, 0.09, 0.15, 0.25, 0.37, 0.5, 0.62, 0.7, 0.76, 0.84, 0.92, 1,
];
const STATION_COUNT = 61;

function buildStations(): HullStation[] {
  const stations: HullStation[] = [];
  for (let i = 0; i < STATION_COUNT; i += 1) {
    const x = STERN_X + ((STEM_X - STERN_X) * i) / (STATION_COUNT - 1);
    const top = fitzgeraldSheerZ(x);
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
// Subdivision (USCG, NTSB Figure 2). Positions from her hatches: 21 on
// 24 ft centres, No. 1 forward; the screen bulkheads between Nos. 7 and 8
// and Nos. 13 and 14; holds 177 ft, 144 ft and 198 ft long; the wreck's bow
// section, 276 ft from the stem, ends between hatches 8 and 9, which puts
// No. 1 hatch 87 ft aft of the forward perpendicular.

/** Ship-frame x of hatch n (1 forward … 21 aft). */
function hatchX(n: number): number {
  return round(HALF_LBP - (87 + 24 * (n - 1)) * FT, 0.01);
}
const BH = {
  /** Collision bulkhead: the forepeak | No. 1 hold and its tanks (21 ft forward of No. 1 hatch). */
  collision: round(HALF_LBP - 66 * FT, 0.01), // 88.24
  /** Screen bulkhead between hatches 7 and 8 (frame 69). */
  screen1: round(HALF_LBP - 243 * FT, 0.01), // 34.29
  /** Screen bulkhead between hatches 13 and 14 (frame 117). */
  screen2: round(HALF_LBP - 387 * FT, 0.01), // -9.6
  /** The holds' after end, 18 ft aft of No. 21 hatch: the engine room's forward bulkhead. */
  engineFwd: round(HALF_LBP - 585 * FT, 0.01), // -69.95
  /** The after peak's bulkhead, 20 ft forward of the after perpendicular. */
  aftPeak: round(-HALF_LBP + 20 * FT, 0.01), // -102.26
};

/**
 * The ballast tanks' inboard bulkhead in this model (m from the centre
 * line). Her eight tanks a side are L-shaped (NTSB Figure 2: under the
 * hold's hopper to the centre line and up the side under the tunnel). A
 * cell here is a whole-depth column, so each side's tanks and tunnel are a
 * wing outboard of this line, sized so that the wing plus the half of the
 * double bottom left under the hold make up the space the holds leave
 * (the holds 860,950 ft³: README).
 */
export const FITZGERALD_TANK_Y = 7.43;

/** Her last cargo: 26,116 long tons. */
export const FITZGERALD_CARGO_T = round(26116 * 1.0160469, 0.1); // 26,535.5
/**
 * How it was stowed (USCG, "Cargo and Loading Procedure": about 28% in
 * the middle half of the hold's length, 36% in each end quarter), worked
 * out for her three holds (177, 144 and 198 ft): No. 1 41.1%, No. 2 15.5%,
 * No. 3 43.4%.
 */
const CARGO_SHARE = { hold1: 0.411, hold2: 0.155, hold3: 0.434 };

/**
 * Each hold's permeability: the share of its cell water can fill. Taconite
 * weighs 130 lb/ft³ in bulk (2.08 t/m³, USCG) and its voids hold up to
 * 27.5 lb of water a cubic foot (a share of 0.44, NTSB): the pellets' solid
 * volume (cargo / bulk density × (1 − voids)) is not floodable; nor is
 * the double bottom under the hold, which this cell includes but which is
 * part of the ballast tanks (README).
 */
const HOLD_PERMEABILITY = { hold1: 0.563, hold2: 0.721, hold3: 0.574 };
/** Empty ballast tanks and the tunnels (their framing takes a little). */
const TANK_PERMEABILITY = 0.95;
/** An 8 in vent pipe's bore (m²): two to each ballast tank (USCG). */
const VENT_PIPE_M2 = round(Math.PI * (4 * IN) ** 2, 0.0001); // 0.0324
/** Her ballast tanks beside each hold (NTSB Figure 2: Nos. 1–3, 4–5, 6–8 a side). */
const TANKS_BY_HOLD = { 1: 3, 2: 2, 3: 3 } as const;

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

/** A bulkhead top at the spar deck at x. */
function deckAt(x: number): number {
  return round(fitzgeraldSheerZ(x), 0.01);
}
/**
 * The screen bulkheads were not watertight: sluices in their lower part
 * let the holds drain aft to the suction well (USCG), and a door at the
 * main deck. Water crosses them from the tank top up.
 */
const SCREEN_TOP = TANK_TOP;

/** A hold with its port and starboard ballast tanks (and tunnels). */
function hold(
  n: 1 | 2 | 3,
  fromX: number,
  toX: number,
  aftTop: number,
  fwdTop: number
): Compartment[] {
  const id = `hold${n}` as const;
  const y = FITZGERALD_TANK_Y;
  const tank = (side: "port" | "starboard") =>
    compartment(
      `tank${n}-${side === "port" ? "p" : "s"}`,
      `Hold ${n} ${side} ballast tanks`,
      "hold",
      fromX,
      toX,
      deckAt(fromX),
      deckAt(toX),
      {
        span: { side, y },
        permeability: TANK_PERMEABILITY,
        // Deep down, a tank's trapped air leaves by its own two vents.
        burstM2: round(2 * TANKS_BY_HOLD[n] * VENT_PIPE_M2, 0.001),
      }
    );
  return [
    compartment(id, `Cargo hold ${n}`, "hold", fromX, toX, aftTop, fwdTop, {
      span: { side: "centre", y },
      permeability: HOLD_PERMEABILITY[id],
      cargoT: round(FITZGERALD_CARGO_T * CARGO_SHARE[id], 0.1),
      // Laden with pellets, a hold cannot be pumped (USCG, NTSB).
      pumped: false,
    }),
    tank("port"),
    tank("starboard"),
  ];
}

const COMPARTMENTS: Compartment[] = [
  compartment(
    "aft-peak",
    "Back peak",
    "stern",
    STERN_X,
    BH.aftPeak,
    deckAt(STERN_X),
    deckAt(BH.aftPeak)
  ),
  compartment(
    "engine",
    "Engine room",
    "engine",
    BH.aftPeak,
    BH.engineFwd,
    deckAt(BH.aftPeak),
    deckAt(BH.engineFwd)
  ),
  ...hold(3, BH.engineFwd, BH.screen2, deckAt(BH.engineFwd), SCREEN_TOP),
  ...hold(2, BH.screen2, BH.screen1, SCREEN_TOP, SCREEN_TOP),
  ...hold(1, BH.screen1, BH.collision, SCREEN_TOP, deckAt(BH.collision)),
  compartment(
    "fore-peak",
    "Front peak",
    "peak",
    BH.collision,
    STEM_X,
    deckAt(BH.collision),
    deckAt(STEM_X)
  ),
];

/** The hold a hatch opens into. */
function holdOf(n: number): "hold1" | "hold2" | "hold3" {
  return n <= 7 ? "hold1" : n <= 13 ? "hold2" : "hold3";
}

/** One of her 21 cargo hatches (No. 1 forward). */
export interface FitzgeraldHatch {
  number: number;
  /** Ship-frame x of its middle (m). */
  x: number;
  /** Its deck opening's id (`deckOpenings`, What-if spots). */
  id: string;
}

export const FITZGERALD_HATCHES: readonly FitzgeraldHatch[] = Array.from(
  { length: 21 },
  (_, i) => ({ number: i + 1, x: hatchX(i + 1), id: `hatch-${i + 1}` })
);

/**
 * Leak past a hatch cover while it holds (m²): its gasket on the coaming
 * with too few Kestner clamps done up (USCG: most of the clamps found on
 * the wreck were undamaged, so unfastened; the covers were not kept
 * weathertight). The gasket runs round the cover's edge, 11 ft 7 in by
 * 54 ft (the coaming stands 3 ft outboard of the 11 × 48 ft opening):
 * 40.0 m, so 0.30 m² is a 7.5 mm gap on average (README: tuned, 2–10 mm
 * is the range kept; round the opening itself, 36 m, it would be 8.3 mm).
 */
const HATCH_LEAK_M2 = 0.3;
/**
 * Head of green water over a cover's coaming at which it gives way (m).
 * The covers were designed for a 4 ft head (46 CFR 45.145; NTSB); the
 * NTSB found a 12.5 ft (3.8 m) head enough to fail one. An assumption a
 * little under that: about three times the design head.
 */
const HATCH_FAIL_HEAD_M = 3.5;
/** A failed cover leaves the whole 11 × 48 ft hatch open. */
const HATCH_OPEN_M2 = round(11 * FT * 48 * FT, 0.01); // 49.05

const HATCHES: DeckOpening[] = FITZGERALD_HATCHES.map((h) => ({
  id: h.id,
  compartmentId: holdOf(h.number),
  kind: "hatch",
  x: h.x,
  y: 0,
  // The coaming's top at the centre line: 24 in over a deck with 18 in
  // of camber (3 ft 6 in over the deck at side, USCG).
  z: round(fitzgeraldSheerZ(h.x) + CAMBER + COAMING, 0.01),
  areaM2: HATCH_LEAK_M2,
  failHeadM: HATCH_FAIL_HEAD_M,
  failedAreaM2: HATCH_OPEN_M2,
}));

/**
 * The two vents she lost, at the starboard deck edge over the ballast
 * tanks beside No. 1 hold (the USCG thought the damage most likely
 * forward; the survey found a vent torn from the deck, "an opening in the
 * deck at the base of the vent pipe", on the starboard side of the bow
 * section). An 8 in pipe torn away with the deck round its base (m²).
 */
const VENT_OPEN_M2 = 0.05;
const VENT_Y = -(HALF_BEAM - 0.6);
const BROKEN_VENTS: DeckOpening[] = [hatchX(3) - 3.6, hatchX(5) - 3.6].map(
  (x, i) => ({
    id: `vent-${i + 1}`,
    compartmentId: "tank1-s",
    kind: "vent",
    x: round(x, 0.01),
    y: round(VENT_Y, 0.01),
    z: round(fitzgeraldSheerZ(x) + VENT_HEIGHT, 0.01),
    areaM2: VENT_OPEN_M2,
  })
);

/**
 * Her topside damage beside the vents (USCG: "a fence rail down"; the
 * NTSB: hull damage at the deck with the vents): a split along her
 * starboard sheer strake at the deck edge where the fence rail went (the
 * model's `FENCE_GAP`, from No. 5 hatch's vent to just aft of No. 3
 * hatch, about 22 m), into the No. 1 starboard tanks. A crack 5 mm wide
 * on average over 20 m, its middle 0.3 m under the deck edge: 0.1 m², in
 * four pieces along it so each piece sees its own wave (README: "What
 * floods her").
 */
const SPLIT_M2 = 0.1;
const SPLIT_UNDER_DECK = 0.3;
const SPLIT_PIECES = 4;
const RAIL_SPLIT: DeckOpening[] = Array.from(
  { length: SPLIT_PIECES },
  (_, i) => {
    const x0 = hatchX(5) - 6;
    const x1 = hatchX(3) + 1.5;
    const x = x0 + ((x1 - x0) * (i + 0.5)) / SPLIT_PIECES;
    return {
      id: `rail-split-${i + 1}`,
      compartmentId: "tank1-s",
      kind: "split",
      x: round(x, 0.01),
      y: round(-HALF_BEAM, 0.01),
      z: round(fitzgeraldSheerZ(x) - SPLIT_UNDER_DECK, 0.01),
      areaM2: round(SPLIT_M2 / SPLIT_PIECES, 0.0001),
    };
  }
);

/**
 * Her graze on Six Fathom Shoal, north of Caribou Island, about 2:45 PM:
 * the Anderson's master saw her pass close to the shoal, inside the
 * course he held off it, and the 1976 Canadian Hydrographic Service
 * survey found the shoal reaching about a mile further east than charted
 * (USCG Marine Board; the Lake Carriers' Association's case). A rake along
 * her forward bottom into the ballast tanks: three strips, each a What-if
 * spot. Part of her real run (ruling R14, the sim's best reconstruction
 * of all the reported damage), because topside damage alone cannot make
 * the list she reported at 3:30 PM; the USCG itself did not accept the
 * grounding, and the experts still disagree (README). A 0.05 m² split
 * each (tuned to that list against her pumps: about 5° by 5:30 PM). The
 * strips open at 3:30 PM (shown 0), not at the graze itself, so the sim's
 * list lags the record (a list reported by 3:30) by about 30–45 minutes.
 */
const SHOAL_STRIP_M2 = 0.05;
const SHOAL: Opening[] = (
  [
    ["tank1-s", hatchX(4), "starboard"],
    ["tank1-p", hatchX(4), "port"],
    ["tank2-s", hatchX(10), "starboard"],
  ] as const
).map(([compartmentId, x, side]) => ({
  compartmentId,
  areaM2: SHOAL_STRIP_M2,
  zLow: 0,
  zHigh: 0.6,
  x: round(x, 0.1),
  side,
}));

// ---------------------------------------------------------------------------
// The storm (README, "The Fitzgerald's storm").

/** She steered 141° true for Whitefish Point (USCG, NTSB). */
const HEADING_DEG = 141;
/**
 * The sea ran from about 300° true (the Anderson's 7 PM wind, 300° at
 * 50 kt; the hindcast's waves ran west to east): toward 120°, 21° to port
 * of her heading, so over her starboard quarter.
 */
const SEA_TOWARD_DEG = 120;
const SEA_DIR = HEADING_DEG - SEA_TOWARD_DEG; // + toward port
const HS_M = 7.6;
const PEAK_PERIOD_S = 11;

/** Shown seconds after 3:30 PM for a clock time h:mm PM. */
function pm(h: number, m: number): number {
  return (h + 12 - 15) * 3600 + (m - 30) * 60;
}

const STORM: StormSpec = {
  components: stormComponents({
    hsM: HS_M,
    peakPeriodS: PEAK_PERIOD_S,
    dirDeg: SEA_DIR,
    seed: 1975,
  }),
  hsM: HS_M,
  windKn: 50,
  // The sea building through the afternoon (the hindcast): about 5.7 m at
  // 3:30 PM, 6 m at 4 PM, over 7 m at 7 PM, 7.6 m by 8 PM.
  ramp: [
    [pm(3, 30), round(5.7 / HS_M, 0.001)],
    [pm(4, 0), round(6.0 / HS_M, 0.001)],
    [pm(7, 0), round(7.1 / HS_M, 0.001)],
    [pm(8, 0), 1],
  ],
  groups: [
    {
      // The "three sisters": a group of three big seas just after 7:10.
      t: pm(7, 12),
      heightM: 5,
      count: 3,
      periodS: PEAK_PERIOD_S,
      dirDeg: SEA_DIR,
    },
  ],
};

/**
 * Her speed toward Whitefish: the Anderson, making 14.6 mph, closed from
 * about 17 miles astern at 3:35 PM to about 10 at 7:00 (USCG), and told
 * her she was "gaining about a mile and a half an hour": about 12.8 mph.
 */
const SPEED_MS = round(12.8 * 0.44704, 0.01); // 5.72
/** At 7:10 she was about 16 miles from Whitefish Point: there by 8:25 PM. */
const SHELTER_T = pm(8, 25);

/** Two 7,000 gpm main ballast pumps ("Yes, both of them"). */
const PUMPS_M3S = round((2 * 7000 * 3.785411784) / 1000 / 60, 0.001); // 0.883

/** One of her boats: two 50-person lifeboats aft, two 25-person rafts. */
export interface FitzgeraldBoat {
  index: number;
  label: string;
  kind: "lifeboat" | "raft";
  side: "port" | "starboard" | "centre";
  /** Ship-frame x of its middle (m) and the deck it stands on. */
  x: number;
  deck: "Poop" | "Texas";
}

/**
 * The USCG: the lifeboats on the poop deck aft, port and starboard; one
 * raft aft of the forward house on the texas deck, starboard, the other
 * aft of the after deckhouse on the poop deck.
 */
export const FITZGERALD_BOATS: readonly FitzgeraldBoat[] = [
  {
    index: 0,
    label: "1",
    kind: "lifeboat",
    side: "starboard",
    x: -96,
    deck: "Poop",
  },
  {
    index: 1,
    label: "2",
    kind: "lifeboat",
    side: "port",
    x: -96,
    deck: "Poop",
  },
  {
    index: 2,
    label: "Forward raft",
    kind: "raft",
    side: "starboard",
    x: 88,
    deck: "Texas",
  },
  {
    index: 3,
    label: "After raft",
    kind: "raft",
    side: "centre",
    x: -108,
    deck: "Poop",
  },
];

/**
 * Her houses, measured off the general arrangement (Great Lakes
 * Engineering Works hull 301, 1958; Detroit Historical Society): aft, a
 * house over the engine room from the stern to just aft of No. 21 hatch,
 * with a second tier under the funnel; forward, the raised forecastle
 * from the collision bulkhead to the stem, the texas tier on it and the
 * pilothouse on top (not buoyant volume here: its void and glass).
 */
const AFT_HOUSE_FWD_X = -69;
const AFT_TIER = { fromX: -106, toX: -76 };
const FORECASTLE_AFT_X = 88.5;
const TEXAS_TIER = { fromX: 90, toX: 104 };

/** A box from the spar deck up to a deck `tiers` decks above it. */
function house(fromX: number, toX: number, tiers: number) {
  return {
    fromX,
    toX,
    topZ: round(fitzgeraldSheerZ((fromX + toX) / 2) + tiers * DECK_STEP, 0.01),
  };
}

export const fitzgerald: ShipSpec = {
  id: "fitzgerald",
  name: "Edmund Fitzgerald",
  year: 1975,
  lbp: round(LBP, 0.01),
  loa: round(STEM_X - STERN_X, 0.01),
  beam: round(BEAM, 0.01),
  depth: DECK_SPAR,
  draught: round(DRAUGHT, 0.001),
  displacementT: 34750,
  kg: 5.4,
  lcg: 1.32,
  tcg: 0,
  stations: buildStations(),
  sheerZ: fitzgeraldSheerZ,
  superstructure: [
    // Flat tops at each tier's deck; a box is buoyant while it is dry.
    // The forward-most box is the forecastle (its deck is the
    // `forecastle-under` landmark).
    house(STERN_X, AFT_TIER.fromX, 1),
    house(AFT_TIER.fromX, AFT_TIER.toX, 2),
    house(AFT_TIER.toX, AFT_HOUSE_FWD_X, 1),
    house(FORECASTLE_AFT_X, TEXAS_TIER.fromX, 1),
    house(TEXAS_TIER.fromX, TEXAS_TIER.toX, 2),
    house(TEXAS_TIER.toX, STEM_X, 1),
  ],
  compartments: COMPARTMENTS,
  // Her hull damage: the graze on Six Fathom Shoal (R14); the rest of her
  // damage is topside, in her deck (`deckOpenings`).
  realNight: SHOAL,
  girder: { hogMaxNm: 2.0e9, sagMaxNm: 2.0e9 },
  scripted: [
    // Her radars failed (4:10 PM) and her last message (7:10 PM), as words.
    { t: pm(4, 10), kind: "radio", index: 0 },
    { t: pm(7, 10), kind: "radio", index: 1 },
  ],
  funnels: [
    {
      x: -94,
      baseZ: round(DECK_BOAT + sheerShape(-94), 0.01),
      topZ: round(DECK_BOAT + sheerShape(-94) + 7.5, 0.01),
      dummy: false,
      // A welded stack on her after house: no source has it coming off in
      // the dive (the liners' stays rule is theirs).
      falls: false,
    },
  ],
  decks: FITZGERALD_DECKS,
  // Columbia's stack: dark red under a black top (the model's paint; the
  // hull diagram reads it).
  funnelPaint: { funnel: 0x45201b, top: 0x161616 },
  seaDepthM: 162,
  clockStartS: 15 * 3600 + 30 * 60, // 3:30 PM, her first report
  cause: "storm",
  // Lake Superior in November: fresh, its surface about 6–7 °C on 10
  // November (NOAA CoastWatch GLSEA average), the deep lake about 4 °C.
  waterDensity: 1000,
  storm: STORM,
  deckOpenings: [...HATCHES, ...BROKEN_VENTS, ...RAIL_SPLIT],
  // Her spar deck between the houses: open rails, no bulwark, a bay to
  // each hatch (green water stands on it and runs off: deckWater.ts).
  openDeck: {
    fromX: AFT_HOUSE_FWD_X,
    toX: FORECASTLE_AFT_X,
    bayX: FITZGERALD_HATCHES.map((h) => h.x).reverse(),
    camberM: round(CAMBER, 0.001),
  },
  shoalOpenings: SHOAL,
  pumpsM3s: PUMPS_M3S,
  headway: { startMs: SPEED_MS },
  shelter: { t: SHELTER_T, name: "Whitefish Bay" },
  // The stern section, emptied of cargo, rolled over (USCG) as it went
  // down: a rule. In 162 m with her bow on the floor it is wholly under as
  // she breaks and its broken end strikes the floor about 4 s later, so it
  // rolls at 50° a second (R10: over before it lands, not on the floor).
  wreckParts: { stern: { capsize: true, restDeg: 180, rollDegS: 50 } },
  // Her dive is short (under a minute from bow under to the floor): it
  // plays in real time (ruling R11).
  descentTimeScale: 1,
};
