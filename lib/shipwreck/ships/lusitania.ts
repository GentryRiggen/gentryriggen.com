import type {
  Compartment,
  HullStation,
  Opening,
  PortholeRow,
  ShipSpec,
} from "./types";

/**
 * RMS Lusitania on the afternoon of 7 May 1915.
 *
 * Sources (see lib/shipwreck/sim/README.md for the full list, where they
 * disagree, and every assumption): the Mersey inquiry's report ("The ship":
 * four boiler rooms, eleven principal transverse bulkheads making twelve
 * sections, a longitudinal bulkhead each side between the side coal bunkers
 * and the boiler rooms, 22 lifeboats on davits and 26 collapsibles) and
 * Leonard Peskett/Thomas Galbraith's evidence to it (LBP 760 ft, breadth
 * 88 ft, depth 60 ft 4½ in, 12 bulkheads, the shelter and upper decks);
 * Peeke, Jones & Walsh-Johnson, "The Lusitania Story", and Ramsay,
 * "Lusitania: Saga and Myth" (trial draughts 33 ft and 31 ft 6 in, the
 * transverse bunker forward of No. 1 boiler room, the afternoon); Ballard,
 * "Exploring the Lusitania" (the hit near No. 1 boiler room, the bow
 * striking the floor at 93 m, the wreck on her starboard side); Schwieger's
 * war diary (starboard, "right behind the bridge", running depth 3 m);
 * her general arrangement (profile and hold plan, "RMS Lusitania deck
 * plans", Wikimedia Commons: bulkheads, funnels, the superstructure's ends
 * and the boats are measured off it).
 *
 * Ship frame: metres, origin on the keel at midships (half of LBP), x
 * forward, y to port, z up.
 */

const FT = 0.3048;
const LBP = 760 * FT; // 231.65
const HALF_LBP = LBP / 2; // 115.82: the forward (+) and after (-) perpendiculars
const BEAM = (87 + 8 / 12) * FT; // 26.72 (87 ft 8 in moulded)
const HALF_BEAM = BEAM / 2;
/** LOA 787 ft: a nearly plumb stem and an elliptical counter aft. */
const STEM_X = 116.64; // the stem head at the forecastle
const STERN_X = round(STEM_X - 787 * FT, 0.01); // -123.24, the counter's end

/** Lowest point of the sheer, a little aft of midships. */
const SHEER_LOW_X = -10;
const SHEER_FWD = 3.0; // shelter deck rise at the forward perpendicular
const SHEER_AFT = 1.3; // and at the after perpendicular
const LOWER_DECK_EXTRA_FWD = 0.4;
const LOWER_DECK_EXTRA_AFT = 0.25;

function round(v: number, step: number): number {
  return Math.round(v / step) * step;
}

function sheerShape(x: number, fwd: number, aft: number): number {
  if (x >= SHEER_LOW_X) {
    const u = (x - SHEER_LOW_X) / (HALF_LBP - SHEER_LOW_X);
    return fwd * u * u;
  }
  const u = (SHEER_LOW_X - x) / (SHEER_LOW_X + HALF_LBP);
  return aft * u * u;
}

/**
 * Heights of the decks above the keel at their lowest point (amidships).
 * Her own letters: the Boat deck was A, then the Promenade (B), Shelter
 * (C, the top of the hull: the depth of 60 ft 4½ in), Upper (D), Main (E)
 * and Lower (F) decks, the orlop and the tank top over a 5 ft double
 * bottom. Spacings about 9 ft (the Shelter-to-Upper double-plated strake is
 * 14 ft 6 in deep, Galbraith).
 */
export const LUSITANIA_DECKS = [
  { name: "Boat", z: 24.0 },
  { name: "B", z: 21.15 },
  { name: "C", z: 18.4 },
  { name: "D", z: 15.6 },
  { name: "E", z: 12.95 },
  { name: "F", z: 10.4 },
  { name: "Orlop", z: 7.8 },
  { name: "Tank top", z: 1.52 },
];
const DECK_BOAT = 24.0;
const DECK_B = 21.15;
const DECK_C = 18.4;
const DECK_D = 15.6;
const DECK_E = 12.95;
const DECK_F = 10.4;

/** The Shelter (C) deck edge: the top of the hull. */
function lusitaniaSheerZ(x: number): number {
  return DECK_C + sheerShape(x, SHEER_FWD, SHEER_AFT);
}

/** A lower deck's height at x (a little more sheer than C). */
function lowerDeckZ(deck: number, x: number): number {
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
// Hull form. Finer than the Titanic's (she was built for 25 knots, Froude
// number 0.27): a short parallel middle body, long hollow entrance and
// run, a 3.6 m bilge radius, a nearly plumb stem with a rounded forefoot and
// a counter stern over the rudder. Tuned to a block coefficient of about
// 0.61 at her 33 ft 6 in load draught (README: "Lusitania's data").

const PARALLEL_FWD = 24;
const PARALLEL_AFT = -34;
const BILGE_R = 3.6;
const COUNTER_LOW = 8.0; // the run ends at the sternpost below this height
const COUNTER_HIGH = 12.5; // and at the counter's end above this one

function smoothstep(a: number, b: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Forward end of the hull at height z (nearly plumb stem, round forefoot). */
function stemX(z: number): number {
  const rake = HALF_LBP + 0.04 * z;
  if (z >= 3.5) return rake;
  const u = 1 - z / 3.5;
  return rake - 3.2 * u * u;
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
 * low down, about 1.2 at the waterline, fuller with flare up to the deck.
 */
const ENTRANCE_P = [0.55, 1.4, 2.2];
const RUN_P = [0.55, 1.5, 2.5];
function fullness(p: readonly number[], z: number): number {
  return (
    p[0] +
    (p[1] - p[0]) * smoothstep(0, 9.5, z) +
    (p[2] - p[1]) * smoothstep(9.5, 19, z)
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
  0, 0.01, 0.035, 0.07, 0.12, 0.19, 0.27, 0.36, 0.45, 0.53, 0.62, 0.72, 0.85, 1,
];
const STATION_COUNT = 61;

function buildStations(): HullStation[] {
  const stations: HullStation[] = [];
  for (let i = 0; i < STATION_COUNT; i += 1) {
    const x = STERN_X + ((STEM_X - STERN_X) * i) / (STATION_COUNT - 1);
    const top = lusitaniaSheerZ(x);
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
// Watertight subdivision, measured off her 1907 profile and hold plan
// (John Brown & Co., as reproduced in "RMS Lusitania deck plans",
// Wikimedia Commons; README "Lusitania's data"), scaled by her length
// between perpendiculars (2.84 px per foot, AP and FP at frames 0 and
// 300), each to about ±1 m. Twelve bulkheads (Galbraith's count; Mersey's
// "eleven principal" leaves out the chain locker's): the collision
// bulkhead, the trimming tank or cargo hold, the chain locker, the
// magazine/reserve coal/cargo hold, the transverse coal bunker right in
// front of No. 1 boiler room, the four boiler rooms (each centred under its
// funnel), the L.P. engine (turbine) room, the condenser and auxiliary
// machinery rooms, the steering gear with the tunnels' after ends, and
// the after peak. The chain locker and the condenser/auxiliary bulkhead
// are left out here (their spaces join the ones beside them): twelve
// sections, as Mersey.

const BH = {
  A: 102.2, // collision bulkhead (frame 288)
  B: 86.7, // trimming tank or cargo | chain locker and magazine
  C: 74.9, // magazine, reserve coal or cargo | transverse coal bunker
  D: 65.7, // transverse bunker | No. 1 boiler room
  E: 36.5, // No. 1 | No. 2
  F: 12.4, // No. 2 | No. 3
  G: -10.9, // No. 3 | No. 4
  H: -36.3, // No. 4 | L.P. engine (turbine) room
  J: -63.5, // turbine room | condenser room
  K: -81.1, // auxiliary machinery | steering gear and tunnels
  L: -111.7, // steering gear | after peak
};

/**
 * The longitudinal bulkheads between the side (wing) coal bunkers and the
 * boiler rooms: 9.5 m out from the centre line, so each wing is about
 * 3.9 m wide at the waterline and the boiler rooms 19 m (62 ft) across.
 */
export const LUSITANIA_WING_Y = 9.5;

/** Top of a bulkhead at x: the collision bulkheads to C, the rest to D. */
function topTo(deck: "C" | "D", x: number): number {
  if (deck === "C") return round(lusitaniaSheerZ(x), 0.01);
  return round(lowerDeckZ(DECK_D, x), 0.01);
}

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
 * Coal doors in each longitudinal bulkhead, open while she steamed and
 * jammed by the coal in them (they could not be shut): the gaps left, about
 * 0.1 m² per side bunker.
 */
const COAL_DOOR_M2 = 0.1;
/**
 * The side bunkers six days out of New York: mostly burnt down (Ballard:
 * the starboard bunker the torpedo struck was nearly empty).
 */
const WING_PERMEABILITY = 0.9;

/** A boiler room with its side bunkers: centre, port wing, starboard wing. */
function boilerRoom(
  n: number,
  fromX: number,
  toX: number,
  aftTop: number,
  fwdTop: number
): Compartment[] {
  const y = LUSITANIA_WING_Y;
  const door = { crossFlowM2: COAL_DOOR_M2 };
  const wing = { permeability: WING_PERMEABILITY, ...door };
  return [
    compartment(
      `br${n}`,
      `Boiler room ${n}`,
      "boiler",
      fromX,
      toX,
      aftTop,
      fwdTop,
      {
        span: { side: "centre", y },
        ...door,
      }
    ),
    compartment(
      `br${n}-port`,
      `Boiler room ${n} port bunker`,
      "boiler",
      fromX,
      toX,
      aftTop,
      fwdTop,
      { span: { side: "port", y }, ...wing }
    ),
    compartment(
      `br${n}-stbd`,
      `Boiler room ${n} starboard bunker`,
      "boiler",
      fromX,
      toX,
      aftTop,
      fwdTop,
      { span: { side: "starboard", y }, ...wing }
    ),
  ];
}

const COMPARTMENTS: Compartment[] = [
  compartment(
    "aft-peak",
    "Back peak",
    "stern",
    STERN_X,
    BH.L,
    round(lusitaniaSheerZ(STERN_X), 0.01),
    topTo("D", BH.L)
  ),
  compartment(
    "tunnels",
    "Steering gear",
    "shaft",
    BH.L,
    BH.K,
    topTo("D", BH.L),
    topTo("D", BH.K)
  ),
  compartment(
    "aux",
    "Condenser room",
    "engine",
    BH.K,
    BH.J,
    topTo("D", BH.K),
    topTo("D", BH.J)
  ),
  compartment(
    "turbine",
    "Turbine room",
    "engine",
    BH.J,
    BH.H,
    topTo("D", BH.J),
    topTo("D", BH.H)
  ),
  ...boilerRoom(4, BH.H, BH.G, topTo("D", BH.H), topTo("D", BH.G)),
  ...boilerRoom(3, BH.G, BH.F, topTo("D", BH.G), topTo("D", BH.F)),
  ...boilerRoom(2, BH.F, BH.E, topTo("D", BH.F), topTo("D", BH.E)),
  ...boilerRoom(1, BH.E, BH.D, topTo("D", BH.E), topTo("D", BH.D)),
  compartment(
    "cross-bunker",
    "Front coal bunker",
    "hold",
    BH.D,
    BH.C,
    topTo("D", BH.D),
    topTo("D", BH.C),
    { permeability: 0.6 }
  ),
  compartment(
    "hold2",
    "Hold 2",
    "hold",
    BH.C,
    BH.B,
    topTo("D", BH.C),
    topTo("C", BH.B)
  ),
  compartment(
    "hold1",
    "Hold 1",
    "hold",
    BH.B,
    BH.A,
    topTo("C", BH.B),
    topTo("C", BH.A)
  ),
  compartment(
    "fore-peak",
    "Front peak",
    "peak",
    BH.A,
    STEM_X,
    topTo("C", BH.A),
    round(lusitaniaSheerZ(STEM_X), 0.01)
  ),
];

/** The second explosion, a few seconds after the hit (shown seconds). */
export const SECOND_EXPLOSION_T = 8;
/** Steam venting: just after the second explosion, until 2:14 PM. */
const STEAM_START_T = SECOND_EXPLOSION_T + 2;
const STEAM_STOP_T = 4 * 60;

/**
 * The real afternoon. U-20's torpedo (set to run 3 m deep, so about 6 m
 * over her keel) struck under the bridge, just forward of No. 1 boiler
 * room: one hole across the bulkhead, into the transverse coal bunker and
 * No. 1's starboard side bunker. A few seconds later the second, larger
 * explosion low in the hull opened No. 1 boiler room itself and the
 * starboard bunker abaft it (No. 2's). No cause is claimed for it. About
 * 24 m² in all (README: "Lusitania's data").
 */
const REAL_AFTERNOON: Opening[] = [
  {
    compartmentId: "cross-bunker",
    areaM2: 8,
    zLow: 4.0,
    zHigh: 8.5,
    x: round(BH.D + 2, 0.1),
    side: "starboard",
  },
  {
    compartmentId: "br1-stbd",
    areaM2: 6,
    zLow: 4.0,
    zHigh: 8.5,
    x: round(BH.D - 2, 0.1),
    side: "starboard",
  },
  {
    compartmentId: "br1",
    areaM2: 6,
    zLow: 2.0,
    zHigh: 6.0,
    x: round(BH.D - 5, 0.1),
    side: "starboard",
    t: SECOND_EXPLOSION_T,
  },
  {
    compartmentId: "br2-stbd",
    areaM2: 4,
    zLow: 2.0,
    zHigh: 6.0,
    x: round(BH.E - 4, 0.1),
    side: "starboard",
    t: SECOND_EXPLOSION_T,
  },
];

/**
 * Side scuttles open on the warm afternoon: rows on the Lower (F) deck
 * clear of the boiler rooms' bunkers, and on the Main (E) deck along most
 * of her length, both sides, each following the sheer as her decks do
 * (`followsSheer`: `z` is at the row's middle). A 16-inch scuttle
 * (0.126 m²) about every 2 m, about 40% of them open: 0.025 m²
 * per metre of row (README).
 */
const PORTHOLE_OPEN_M2_PER_M = 0.025;
function rows(z: (x: number) => number, from: number, to: number) {
  const mid = (from + to) / 2;
  return (["port", "starboard"] as const).map((side): PortholeRow => ({
    z: round(z(mid), 0.01),
    fromX: from,
    toX: to,
    side,
    openM2PerM: PORTHOLE_OPEN_M2_PER_M,
    followsSheer: true,
  }));
}
const PORTHOLES: PortholeRow[] = [
  // Lower (F) deck: forward over the holds, aft over the after spaces.
  ...rows((x) => lowerDeckZ(DECK_F, x) + 1.0, BH.C, BH.A),
  ...rows((x) => lowerDeckZ(DECK_F, x) + 1.0, BH.L, BH.H),
  // Main (E) deck, from the after peak to the collision bulkhead.
  ...rows((x) => lowerDeckZ(DECK_E, x) + 1.0, BH.L, BH.A),
];

/** One of her 48 boats: 22 wooden ones on davits, 26 collapsibles. */
export interface LusitaniaBoat {
  /** Index in `boat-lowered` events. */
  index: number;
  label: string;
  side: "port" | "starboard";
  /** Ship-frame x of the boat's middle (m). */
  x: number;
  kind: "wooden" | "collapsible";
}

/**
 * The superstructure, measured off the profile like the bulkheads: the
 * house front (the navigating bridge and the Promenade deck's front, about
 * 45 m from the stem head; photographs agree), the boat deck's after end
 * and the second class house's after end. Between the house front and the
 * stem her side is plated up to the Promenade (B) deck: a long foredeck,
 * no well. Aft of the second class house the Shelter deck is open to the
 * stern: no raised poop.
 */
const HOUSE_FRONT_X = 72.0; // 144 ft from the FP
const BOAT_DECK_AFT = -63.2;
const AFT_HOUSE_X = -104.3;
/** The lifeboats' middles, first (1, 2) and last (21, 22) on each side. */
const FIRST_BOAT_X = 56;
const LAST_BOAT_X = -52;
/** The after collapsibles' deck, behind the boat deck. */
const AFT_DECK_X = -62;

function buildBoats(): LusitaniaBoat[] {
  const out: LusitaniaBoat[] = [];
  const step = (FIRST_BOAT_X - LAST_BOAT_X) / 10;
  const davitX = (k: number) => round(FIRST_BOAT_X - k * step, 0.1);
  // Wooden boats: odd numbers to starboard, even to port, 1 and 2 forward.
  for (let k = 0; k < 11; k += 1)
    for (const side of ["starboard", "port"] as const)
      out.push({
        index: out.length,
        label: String(2 * k + (side === "starboard" ? 1 : 2)),
        side,
        x: davitX(k),
        kind: "wooden",
      });
  // Collapsibles: 18 under the wooden boats (under 3–19 and 4–20), and
  // eight on the after deck, four a side (Mersey).
  for (let k = 1; k <= 9; k += 1)
    for (const side of ["starboard", "port"] as const) {
      const n = 2 * k + (side === "starboard" ? 1 : 2);
      out.push({
        index: out.length,
        label: `${n}A`,
        side,
        x: davitX(k),
        kind: "collapsible",
      });
    }
  for (let k = 0; k < 4; k += 1)
    for (const side of ["starboard", "port"] as const)
      out.push({
        index: out.length,
        label: `${side === "starboard" ? "S" : "P"}${k + 1}`,
        side,
        x: round(AFT_DECK_X - 6 - 4 * k, 0.1),
        kind: "collapsible",
      });
  return out;
}

export const LUSITANIA_BOATS: readonly LusitaniaBoat[] = buildBoats();

/** Shown seconds after 2:10 PM for a clock time 2:mm:ss PM. */
function at(m: number, s = 0): number {
  return (m - 10) * 60 + s;
}

/**
 * The six boats that got away, all from the starboard side, as the list
 * let them swing clear (the port boats swung in against the hull): 1 (it
 * overturned and righted itself), 9, 11, 13, 15 and 21, the last pulling
 * clear just before she went.
 */
const BOATS_AWAY: [string, number][] = [
  ["1", at(15)],
  ["9", at(17)],
  ["11", at(18)],
  ["13", at(19, 30)],
  ["15", at(21)],
  ["21", at(24)],
];

function scripted(): ShipSpec["scripted"] {
  const events: ShipSpec["scripted"][number][] = [
    { t: SECOND_EXPLOSION_T, kind: "explosion" },
    // Steam: a cloud of it shot up at the hit (lookout Leslie Morton), and
    // her steam pressure collapsed from 195 psi to 50 psi and falling as
    // No. 1 boiler room's lines and boilers were flooded and broken; with
    // it went her power at about 2:14 (README).
    { t: STEAM_START_T, kind: "steam-start" },
    { t: STEAM_STOP_T, kind: "steam-stop" },
  ];
  for (const [label, t] of BOATS_AWAY) {
    const boat = LUSITANIA_BOATS.find(
      (b) => b.label === label && b.kind === "wooden"
    );
    if (boat) events.push({ t, kind: "boat-lowered", index: boat.index });
  }
  return events.sort((a, b) => a.t - b.t);
}

/**
 * The funnels' bases, measured off the profile (each over the middle of its
 * boiler room, about 25.9 m apart).
 */
const FUNNEL_X = [51.2, 25.3, -0.6, -26.4];

/**
 * The paint switch. false: as she was on 7 May 1915 (funnels painted out
 * dark; the model also adds the gilt band round the base of the
 * superstructure). true: her peacetime Cunard colours (red funnels with
 * black tops). The model's README ("Her paint in May 1915") cites both.
 */
export const LUSITANIA_PEACETIME_PAINT = false;

/** Her funnels' paint, either way (sRGB; plain numbers, no three.js). */
export const LUSITANIA_FUNNEL_PAINT = {
  // Painted over: the top and bands barely differ from the rest.
  war: { funnel: 0x2e2f32, top: 0x2c2d30 },
  cunard: { funnel: 0xb5461f, top: 0x141416 },
} as const;

export const lusitania: ShipSpec = {
  id: "lusitania",
  name: "Lusitania",
  year: 1915,
  lbp: round(LBP, 0.01),
  loa: round(STEM_X - STERN_X, 0.01),
  beam: round(BEAM, 0.01),
  depth: DECK_C,
  // Six days out of New York with most of her coal burnt (README).
  draught: 9.35,
  displacementT: 35650,
  // GM 0.84 m over this hull's KM of 10.54 m (README: a GM under about
  // 1.2 m, as three flooded side bunkers could take it all away).
  kg: 9.7,
  lcg: -2.6,
  tcg: 0,
  stations: buildStations(),
  sheerZ: lusitaniaSheerZ,
  superstructure: [
    // The second class house aft (to the boat deck), the foredeck plated
    // up to B from the house front to the stem, and the long house under
    // the boat deck from its after end to the bridge. Flat tops at the
    // deck's height at each box's middle (the sheer). Index 2 is the boat
    // deck's house (the model reads its after end).
    {
      fromX: AFT_HOUSE_X,
      toX: BOAT_DECK_AFT,
      topZ: round(
        lusitaniaSheerZ((AFT_HOUSE_X + BOAT_DECK_AFT) / 2) + DECK_B - DECK_C,
        0.01
      ),
    },
    {
      fromX: HOUSE_FRONT_X,
      toX: STEM_X,
      topZ: round(
        lusitaniaSheerZ((HOUSE_FRONT_X + STEM_X) / 2) + DECK_B - DECK_C,
        0.01
      ),
    },
    {
      fromX: BOAT_DECK_AFT,
      toX: HOUSE_FRONT_X,
      topZ: round((DECK_B + DECK_BOAT) / 2, 0.01),
    },
  ],
  compartments: COMPARTMENTS,
  realNight: REAL_AFTERNOON,
  // About 15 m³ of section modulus in high-tensile steel (README).
  girder: { hogMaxNm: 5.0e9, sagMaxNm: 4.6e9 },
  scripted: scripted(),
  funnels: FUNNEL_X.map((x) => {
    const baseZ = round(
      DECK_BOAT + sheerShape(x, SHEER_FWD, SHEER_AFT) + 0.8,
      0.01
    );
    return { x, baseZ, topZ: round(baseZ + 23.5, 0.01), dummy: false };
  }),
  decks: LUSITANIA_DECKS,
  seaDepthM: 93,
  clockStartS: 14 * 3600 + 10 * 60, // 2:10 PM, the torpedo
  cause: "torpedo",
  portholes: PORTHOLES,
  // 18 knots, the engines unable to stop as steam failed; she carried her
  // way about 2 nautical miles (README).
  headway: { startMs: 18 * 0.514444, halfLifeS: 300 },
  // Her wreck lies on its starboard side in 93 m (Ballard). She comes down
  // listed to starboard (18–67° over the calibration sweep: the physics of
  // her last minute is touchy); the survey, not the sim, lays her over.
  wreck: { restDeg: 75, minListDeg: 10 },
  funnelPaint: LUSITANIA_PEACETIME_PAINT
    ? LUSITANIA_FUNNEL_PAINT.cunard
    : LUSITANIA_FUNNEL_PAINT.war,
};
