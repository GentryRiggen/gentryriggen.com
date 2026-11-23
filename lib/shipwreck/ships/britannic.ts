import { lowerDeckZ, titanic } from "./titanic";
import type {
  BulkheadDoor,
  Compartment,
  HullStation,
  Livery,
  Opening,
  PortholeRow,
  ShipSpec,
} from "./types";

/**
 * HMHS Britannic on the morning of 21 November 1916.
 *
 * The Titanic's younger sister: the same length and lines, 18 in wider
 * (94 ft extreme, confirmed by October 1911), an inner skin along her
 * boiler and engine rooms, six bulkheads taken up to B deck, gantry
 * davits. Outbound from Naples to Mudros as a hospital ship with no
 * patients aboard, she struck a mine in the Kea Channel at 8:12 AM,
 * turned for Kea, and was gone at 9:07.
 *
 * Sources (lib/shipwreck/sim/README.md, "The Britannic's data", has every
 * figure, where they disagree, and every assumption): Chirnside, "The
 * 'Olympic' Class Ships" and his Britannic FAQ [CH]; Wikipedia, "HMHS
 * Britannic" [WP]; Atlantic Liners [AL]; White Star History [WSH]; Kea
 * Divers [KD]; the Titanic's data (`titanic.ts`) for everything the
 * sisters share; titanicology.com on the Olympic's 1913 inner skin [TI].
 *
 * Ship frame: metres, origin on the keel at midships (half of LBP), x
 * forward, y to port, z up.
 */

const FT = 0.3048;
/** 94 ft extreme [CH, WP]; the Titanic's lines are 92 ft 6 in. */
const BEAM = 94 * FT; // 28.65
const BEAM_RATIO = 94 / 92.5;

function round(v: number, step: number): number {
  return Math.round(v / step) * step;
}

// ---------------------------------------------------------------------------
// Hull: the Titanic's offsets, every half-breadth scaled about the centre
// line by 94 / 92.5 (the same frames, a wider body: CH). Copied, never
// shared, so the Titanic's arrays stay hers.

function buildStations(): HullStation[] {
  return titanic.stations.map((s) => ({
    x: s.x,
    offsets: s.offsets.map(
      ([z, hb]) => [z, round(hb * BEAM_RATIO, 0.001)] as const
    ),
  }));
}
const STATIONS = buildStations();

/** Half-breadth of her hull at (x, z), from her stations (linear). */
function halfBreadthAt(x: number, z: number): number {
  const at = (s: HullStation): number => {
    const o = s.offsets;
    if (z <= o[0][0]) return o[0][1];
    for (let k = 1; k < o.length; k += 1)
      if (z <= o[k][0]) {
        const [za, ha] = o[k - 1];
        const [zb, hb] = o[k];
        return zb > za ? ha + ((hb - ha) * (z - za)) / (zb - za) : hb;
      }
    return o[o.length - 1][1];
  };
  let i = 1;
  while (i < STATIONS.length - 1 && STATIONS[i].x < x) i += 1;
  const a = STATIONS[i - 1];
  const b = STATIONS[i];
  const u = Math.min(1, Math.max(0, (x - a.x) / (b.x - a.x)));
  return at(a) + (at(b) - at(a)) * u;
}

// ---------------------------------------------------------------------------
// Decks: the Titanic's heights and sheer (the sisters were built on the
// same frames and deck heights).

/** Heights of the decks above the keel at their lowest point (amidships). */
export const BRITANNIC_DECKS = titanic.decks.map((d) => ({ ...d }));
const deckZ = (name: string): number =>
  (BRITANNIC_DECKS.find((d) => d.name === name) as { z: number }).z;
const DECK_C = deckZ("C");
const DECK_B = deckZ("B");
const DECK_E = deckZ("E");
const DECK_F = deckZ("F");
const DECK_G = deckZ("G");
const TANK_TOP = deckZ("Tank top");

/** The C deck (shelter deck) edge: the top of the hull, as the Titanic's. */
function britannicSheerZ(x: number): number {
  return titanic.sheerZ(x);
}
/** A deck that follows the C deck's sheer, at x. */
function deckAt(deck: number, x: number): number {
  return deck + britannicSheerZ(x) - DECK_C;
}

// ---------------------------------------------------------------------------
// Watertight subdivision: the Titanic's fifteen bulkheads (the British
// inquiry's table, feet from the forward perpendicular), the same frames
// in the Britannic [CH]. Six raised to B deck [WP, design section; five in
// WP's sinking section and AL]: D (forward of boiler room 6), F (boiler
// rooms 5/4, "stepped up to the underside of B deck", CH's FAQ) and K
// (aft of boiler room 1), the three CH names, with E, G and H, the
// boiler-room bulkheads between them (our assumption, R3). The rest as the
// Titanic's: A to C deck, B to D, C and J to E, L–P to D.

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
const STERN_X = STATIONS[0].x;
const STEM_X = STATIONS[STATIONS.length - 1].x;

type Top = "B" | "C" | "D" | "E";
// D and E decks: the Titanic's `lowerDeckZ` (a little more sheer than C).
const TOP_OF: Record<string, Top> = {
  A: "C",
  B: "D",
  C: "E",
  D: "B",
  E: "B",
  F: "B",
  G: "B",
  H: "B",
  J: "E",
  K: "B",
  L: "D",
  M: "D",
  N: "D",
  O: "D",
  P: "D",
};
/** The bulkheads raised to B deck (R3). */
export const BRITANNIC_RAISED_BULKHEADS = Object.keys(TOP_OF).filter(
  (k) => TOP_OF[k] === "B"
);
/** Top of bulkhead `name` (A–P) at its x. */
function topOf(name: keyof typeof BH): number {
  const x = BH[name];
  const deck = TOP_OF[name];
  if (deck === "B") return round(deckAt(DECK_B, x), 0.01);
  if (deck === "C") return round(britannicSheerZ(x), 0.01);
  return round(lowerDeckZ(deck === "D" ? deckZ("D") : DECK_E, x), 0.01);
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
 * The inner skin [WP, AL, WSH]: as the Olympic's of 1913, about 30 in
 * inboard of the shell below G deck and 36 in above it, from the tank top
 * to F deck, along all six boiler rooms and the reciprocating and turbine
 * engine rooms [TI]. Each such space is a centre cell with a narrow
 * void each side: its `span.y` is the hull's half-breadth at the space's
 * middle at her waterline less INNER_SKIN_M, so it follows the shell
 * where the lines narrow (boiler room 6).
 */
export const INNER_SKIN_M = 0.85;
/** The void between the skins: empty but for frames. */
const VOID_PERMEABILITY = 0.95;
/** Her draught (below), for where the inner skin is measured. */
const DRAUGHT = 10.3;

function skinned(
  id: string,
  label: string,
  kind: Compartment["kind"],
  fromX: number,
  toX: number,
  aftTop: number,
  fwdTop: number
): Compartment[] {
  const y = round(
    halfBreadthAt((fromX + toX) / 2, DRAUGHT) - INNER_SKIN_M,
    0.01
  );
  const wing = { permeability: VOID_PERMEABILITY };
  return [
    compartment(id, label, kind, fromX, toX, aftTop, fwdTop, {
      span: { side: "centre", y },
    }),
    compartment(
      `${id}-port`,
      `${label} port double skin`,
      kind,
      fromX,
      toX,
      aftTop,
      fwdTop,
      { span: { side: "port", y }, ...wing }
    ),
    compartment(
      `${id}-stbd`,
      `${label} starboard double skin`,
      kind,
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
    BH.P,
    round(britannicSheerZ(STERN_X), 0.01),
    topOf("P")
  ),
  compartment(
    "tunnel-2",
    "Back shaft tunnel",
    "shaft",
    BH.P,
    BH.O,
    topOf("P"),
    topOf("O")
  ),
  compartment(
    "tunnel-1",
    "Front shaft tunnel",
    "shaft",
    BH.O,
    BH.N,
    topOf("O"),
    topOf("N")
  ),
  compartment(
    "dynamo",
    "Dynamo room",
    "engine",
    BH.N,
    BH.M,
    topOf("N"),
    topOf("M")
  ),
  ...skinned(
    "turbine",
    "Turbine room",
    "engine",
    BH.M,
    BH.L,
    topOf("M"),
    topOf("L")
  ),
  ...skinned(
    "engine",
    "Engine room",
    "engine",
    BH.L,
    BH.K,
    topOf("L"),
    topOf("K")
  ),
  ...skinned(
    "br1",
    "Boiler room 1",
    "boiler",
    BH.K,
    BH.J,
    topOf("K"),
    topOf("J")
  ),
  ...skinned(
    "br2",
    "Boiler room 2",
    "boiler",
    BH.J,
    BH.H,
    topOf("J"),
    topOf("H")
  ),
  ...skinned(
    "br3",
    "Boiler room 3",
    "boiler",
    BH.H,
    BH.G,
    topOf("H"),
    topOf("G")
  ),
  ...skinned(
    "br4",
    "Boiler room 4",
    "boiler",
    BH.G,
    BH.F,
    topOf("G"),
    topOf("F")
  ),
  ...skinned(
    "br5",
    "Boiler room 5",
    "boiler",
    BH.F,
    BH.E,
    topOf("F"),
    topOf("E")
  ),
  ...skinned(
    "br6",
    "Boiler room 6",
    "boiler",
    BH.E,
    BH.D,
    topOf("E"),
    topOf("D")
  ),
  compartment("hold3", "Hold 3", "hold", BH.D, BH.C, topOf("D"), topOf("C")),
  compartment("hold2", "Hold 2", "hold", BH.C, BH.B, topOf("C"), topOf("B")),
  compartment("hold1", "Hold 1", "hold", BH.B, BH.A, topOf("B"), topOf("A")),
  compartment(
    "fore-peak",
    "Front peak",
    "peak",
    BH.A,
    STEM_X,
    topOf("A"),
    round(britannicSheerZ(STEM_X), 0.01)
  ),
];

// ---------------------------------------------------------------------------
// The mine and what it broke [WP]: "between holds two and three" on the
// starboard side; the bulkhead between hold 1 and the forepeak damaged;
// the firemen's tunnel to boiler room 6 seriously damaged, water flowing
// into that boiler room; "the first four watertight compartments were
// filling rapidly". README "The Britannic's data" for the sizes.

/** The mine's hole in the side shell (m²): a WWI moored mine (README). */
export const MINE_HOLE_M2 = 12;
/** The mine's hole: in hold 3's shell against the hold 2/3 bulkhead. */
const MINE_HOLE: Opening = {
  compartmentId: "hold3",
  areaM2: MINE_HOLE_M2,
  zLow: 2.5,
  zHigh: 7.0,
  x: round(BH.C - 2, 0.1),
  side: "starboard",
};

/** The boiler room 6/5 watertight door: it "failed to close properly". */
export const BR65_DOOR_M2 = 0.5;

/**
 * The bulkhead doors and the bulkheads the mine tore. The 6/5 door (a
 * sliding door at the tank top that stopped short: the gap under it) is
 * in every run unless `doorsClosed`; the `damage` ones come with the real
 * mine only (`whatIfOpenings` and the run read them by the real hole).
 *
 * - The hold 2/3 bulkhead, torn where the mine went off against it.
 * - The firemen's tunnel: a watertight passage on the tank top from the
 *   stair tower aft of bulkhead B through holds 2 and 3 to a door at the
 *   foot of bulkhead D into boiler room 6 (the Titanic's layout, as the
 *   sisters shared it). Torn, it carries hold 3's water into boiler
 *   room 6, and up the stair tower to where it opens at G deck over hold
 *   1 (into hold 1's spaces).
 * - The forepeak bulkhead (A), damaged by the blast.
 */
export const BRITANNIC_DOORS: readonly BulkheadDoor[] = [
  {
    id: "br6-br5",
    aftId: "br5",
    fwdId: "br6",
    x: BH.E,
    zLow: TANK_TOP,
    zHigh: round(TANK_TOP + BR65_DOOR_M2 / 1.1, 0.01),
    areaM2: BR65_DOOR_M2,
    kind: "door",
  },
  {
    id: "hold3-hold2",
    aftId: "hold3",
    fwdId: "hold2",
    x: BH.C,
    zLow: 2.5,
    zHigh: 7.0,
    areaM2: 1,
    kind: "damage",
  },
  {
    id: "tunnel",
    aftId: "br6",
    fwdId: "hold3",
    x: BH.D,
    zLow: TANK_TOP,
    zHigh: round(TANK_TOP + 2.0, 0.01),
    areaM2: 1.5,
    kind: "damage",
  },
  {
    id: "stair-tower",
    aftId: "hold2",
    fwdId: "hold1",
    x: BH.B,
    zLow: round(lowerDeckZ(DECK_G, BH.B), 0.01),
    zHigh: round(lowerDeckZ(DECK_G, BH.B) + 2.0, 0.01),
    areaM2: 0.5,
    kind: "damage",
  },
  {
    id: "forepeak",
    aftId: "hold1",
    fwdId: "fore-peak",
    x: BH.A,
    zLow: 3.0,
    zHigh: 7.0,
    areaM2: 0.5,
    kind: "damage",
  },
];

// ---------------------------------------------------------------------------
// Portholes (R8): "most of the lower-deck portholes forward" opened by the
// nurses to air the wards [WP]: a row 1 m over E deck (the wards' deck,
// whose open portholes went under about 15 minutes after the mine) from
// bulkhead G (boiler room 4's after end, about amidships) to the forepeak
// bulkhead, and one 1 m over F deck, the deck below, over the holds
// (bulkheads D to A), both sides, following the sheer. Above the inner
// skin's top (F deck, TI), so they open into the spaces inside it
// (`inboard`). The rest of her side scuttles were shut.

/** 16-inch scuttles (0.126 m²) about every 3 m, about half open (README). */
export const PORTHOLE_OPEN_M2_PER_M = 0.02;
const PORTHOLE_TO_X = BH.A;

function rows(deck: number, fromX: number): PortholeRow[] {
  const mid = (fromX + PORTHOLE_TO_X) / 2;
  return (["port", "starboard"] as const).map((side) => ({
    z: round(lowerDeckZ(deck, mid) + 1.0, 0.01),
    fromX,
    toX: PORTHOLE_TO_X,
    side,
    openM2PerM: PORTHOLE_OPEN_M2_PER_M,
    followsSheer: true,
    inboard: true,
  }));
}
/** Her open rows: F deck over the holds, E deck from amidships forward. */
const F_DECK_ROWS = rows(DECK_F, BH.D);
const E_DECK_ROWS = rows(DECK_E, BH.G);
const PORTHOLES: PortholeRow[] = [...F_DECK_ROWS, ...E_DECK_ROWS];
/** The E-deck rows' height (the ones that went under about 08:27). */
export const BRITANNIC_E_DECK_ROW_Z = E_DECK_ROWS[0].z;

// ---------------------------------------------------------------------------
// Her way (R9, R10, R11): README "The Britannic's data", "Her run for Kea".

const KN = 0.514444;
/** Shown seconds after 8:12 AM for a clock time 8:mm:ss AM. */
function at(m: number, s = 0): number {
  return (m - 12) * 60 + s;
}
/** Coasting with her engines stopped (HEADWAY_STOP_HALF_LIFE_S, 150 s). */
function coast(t0: number, u0: number): [number, number][] {
  return [1, 2, 4].map((k) => [t0 + 150 * k, round(u0 / 2 ** k, 0.01)]);
}
/** Way for the boats: slow enough to lower them, screws still turning. */
const BOATS_MS = round(2 * KN, 0.01);
/** Slow ahead again for the shore at 8:50. */
const SLOW_MS = round(3 * KN, 0.01);
/**
 * Her speed (R9; README "Her run for Kea"): about 20 knots at the mine;
 * full ahead for Kea through her turn, the way coming off as she swings on
 * her shafts with her bow filling; eased by 8:18 so the boats could be
 * lowered (they were, with her screws still turning [WP]); stopped about
 * 8:35 (R9: no source gives the time), coasting; slow ahead again at 8:50
 * [WP]; stopped at 9:00 [WP]. About 4.8 km (2.6 nmi) in all: she struck
 * about 3–4 nmi off Kea and her wreck lies 1.5 nmi off its north-west
 * point [KD].
 */
export const BRITANNIC_PROFILE: readonly (readonly [number, number])[] = [
  [0, round(20 * KN, 0.01)],
  [at(15), round(14 * KN, 0.01)],
  [at(18), BOATS_MS],
  [at(35), BOATS_MS],
  ...coast(at(35), BOATS_MS),
  [at(50), 0],
  [at(52), SLOW_MS],
  [at(60), SLOW_MS],
  ...coast(at(60), SLOW_MS),
  [at(60) + 1200, 0],
];

/**
 * Her turn for Kea (R10): from her course up the Kea Channel for Mudros
 * (about N 18° E, the bearing of Mudros) to the nearest Kea shore, where
 * the wreck lies from the wireless position (about east: README), a
 * swing of about 70° to starboard on her shafts (her steering was gone).
 */
const TURN_DEG = -70;
const TURN: readonly (readonly [number, number])[] = [
  [0, 0],
  [30, 0],
  [at(16), TURN_DEG],
];

// ---------------------------------------------------------------------------
// Boats (R5): 48 [WP]. Five gantry sets of six boats [WP: each could
// handle six]: one to starboard forward, abreast the first funnel by the
// officers' quarters, four aft by the fourth funnel, two each side
// (photographs: Wikimedia Commons "HMHS Britannic", "Britannic in Naples
// for Coaling"; the model README has the measurements). A set's six
// boats lie in one bay between its two arms, two rows across the deck
// and three tiers high (the 1914 builder's model, "Lifeboats of HMHS
// Britannic"), so all six share the set's x. Welin davits for the rest:
// six boats at the port forward position (its gantry never fitted) and
// six a side amidships between the second and third funnels, each pair
// double-banked (outboard and inboard) under one pair of davits.

export interface BritannicBoat {
  /** Index in `boat-lowered` events. */
  index: number;
  side: "port" | "starboard";
  /** Ship-frame x of the boat's middle (m). */
  x: number;
  kind: "gantry" | "welin";
}

/** Where the gantry sets stand (x, side): the middle of the bay. */
export const BRITANNIC_GANTRY_SETS: readonly {
  x: number;
  side: "port" | "starboard";
}[] = [
  { x: 54, side: "starboard" },
  { x: -38, side: "starboard" },
  { x: -38, side: "port" },
  { x: -61, side: "starboard" },
  { x: -61, side: "port" },
];
/** Welin davit pairs: forward to port, and amidships each side (m). */
const WELIN_FWD_X = [42, 53, 63.5];
const WELIN_MID_X = [-11, 0.5, 12];

function buildBoats(): BritannicBoat[] {
  const out: BritannicBoat[] = [];
  const add = (
    x: number,
    side: BritannicBoat["side"],
    kind: BritannicBoat["kind"]
  ) => out.push({ index: out.length, side, x: round(x, 0.1), kind });
  // Each set: outboard row then inboard, bottom tier to top.
  for (const set of BRITANNIC_GANTRY_SETS)
    for (let k = 0; k < 6; k += 1) add(set.x, set.side, "gantry");
  // The port forward position on Welin davits: three double davits.
  for (let deep = 0; deep < 2; deep += 1)
    for (const x of WELIN_FWD_X) add(x, "port", "welin");
  // Amidships between the second and third funnels, three double davits a side.
  for (const side of ["starboard", "port"] as const)
    for (let deep = 0; deep < 2; deep += 1)
      for (const x of WELIN_MID_X) add(x, side, "welin");
  return out;
}

export const BRITANNIC_BOATS: readonly BritannicBoat[] = buildBoats();

/**
 * 35 boats launched and stayed afloat [WP], from about 8:25 (the first
 * lowered as her way came off) to 8:50 (most people away), one about
 * every 43 s, alternating sides, aft gantries first. At 9:00 her engines
 * stopped and two long blasts on her whistle [WP]: her signal, a scripted
 * `radio` (the kind for a ship's own signals; index 0) with no physics.
 */
function scripted(): ShipSpec["scripted"] {
  const events: ShipSpec["scripted"][number][] = [
    { t: 0, kind: "explosion" },
    { t: at(60), kind: "radio", index: 0 },
  ];
  const order = BRITANNIC_BOATS.slice().sort(
    (a, b) => a.x - b.x || a.index - b.index
  );
  const n = 35;
  for (let k = 0; k < n; k += 1)
    events.push({
      t: round(at(25) + ((at(50) - at(25)) * k) / (n - 1), 1),
      kind: "boat-lowered",
      index: order[k].index,
    });
  return events.sort((a, b) => a.t - b.t);
}

const FUNNEL_X = titanic.funnels.map((f) => f.x);

// ---------------------------------------------------------------------------
// Load (R4): her load draught 34 ft 7 in, 53,200 tons [WP]; outbound from
// Naples with no patients, about a day and a half's coal burnt: README.

// ---------------------------------------------------------------------------
// Her look (the model reads these; plain numbers, no three.js).

/**
 * Her paint (R23): the hospital ship she was (default, as she sank), or the
 * White Star liner she was built to be and never sailed as.
 */
export const BRITANNIC_PAINT: "hospital" | "liner" = "hospital";

/**
 * Her funnels' paint in each look (sRGB): White Star buff in both; a sooty
 * lip as a hospital ship (her photographs), a deep black top as a liner
 * (her sisters, the builder's model). Model README, "The Britannic".
 */
export const BRITANNIC_FUNNEL_PAINTS: Record<
  "hospital" | "liner",
  { funnel: number; top: number }
> = {
  hospital: { funnel: 0xbb7f3a, top: 0x2b2621 },
  liner: { funnel: 0xbb7f3a, top: 0x18191c },
};

/**
 * Her two paints (R23 of her spec; the paint button, the save and the
 * model's swap read them): the hospital ship she was when she sank (the
 * default) and the White Star liner she was built to be. She never sailed
 * as a liner; that look is her sisters' and her builder's model's (model
 * README, "Her intended liner paint").
 */
export const BRITANNIC_LIVERIES: readonly Livery[] = [
  {
    id: "hospital",
    label: "Her 1916 hospital ship paint",
    year: 1916,
    default: true,
    sources: [
      "Wikimedia Commons, HMHS Britannic (starboard broadside under way, 1916)",
      "Wikimedia Commons, Britannic in Naples for Coaling (early 1916)",
      "Wikimedia Commons, Hmhs britannic departing from naples (port side)",
      "1907 Hague Convention X, art. 5: white, with a green band about 1.5 m broad",
    ],
    swatches: [0xe8e4d8, 0x2d6a3c],
    funnelPaint: BRITANNIC_FUNNEL_PAINTS.hospital,
  },
  {
    id: "liner",
    label: "Her White Star liner colours",
    year: 1914,
    sources: [
      "Wikimedia Commons, RMS Britannic 1914 Model (the builder's model: black hull, white superstructure, black-topped funnels)",
      "Wikimedia Commons, RMS Olympic Sea Trials in 1911 (her sister)",
      "Titanic Inquiry Project, Olympic and Titanic particulars: funnels buff, black top",
      "Wikipedia, MV Britannic (1929): White Star's black hull, gold line, white superstructure, buff funnels with a black top",
      "TRMA, White Star Buff: Weighing the Evidence",
    ],
    swatches: [0x121315, 0xbb7f3a],
    funnelPaint: BRITANNIC_FUNNEL_PAINTS.liner,
  },
];

export const britannic: ShipSpec = {
  id: "britannic",
  name: "Britannic",
  year: 1916,
  lbp: titanic.lbp,
  loa: titanic.loa,
  beam: round(BEAM, 0.01),
  depth: titanic.depth,
  draught: DRAUGHT,
  displacementT: 52650,
  kg: 10.93,
  lcg: -2.78,
  tcg: -0.02,
  stations: STATIONS,
  sheerZ: britannicSheerZ,
  superstructure: titanic.superstructure.map((s) => ({ ...s })),
  compartments: COMPARTMENTS,
  realNight: [MINE_HOLE],
  girder: { hogMaxNm: 6.0e9, sagMaxNm: 5.5e9 },
  scripted: scripted(),
  funnels: titanic.funnels.map((f, i) => ({
    x: FUNNEL_X[i],
    baseZ: f.baseZ,
    topZ: f.topZ,
    dummy: i === 3,
  })),
  decks: BRITANNIC_DECKS,
  seaDepthM: 120,
  clockStartS: 8 * 3600 + 12 * 60,
  cause: "mine",
  portholes: PORTHOLES,
  headway: {
    startMs: BRITANNIC_PROFILE[0][1],
    profile: BRITANNIC_PROFILE,
    turn: TURN,
    ram: { cp: 0.5, fromX: 63 },
  },
  doors: BRITANNIC_DOORS,
  wreck: { restDeg: 90, minListDeg: 10 },
  funnelPaint: BRITANNIC_FUNNEL_PAINTS.hospital,
  liveries: BRITANNIC_LIVERIES,
};

/** For the data tests: the hull's half-breadth and the raised tops. */
export const BRITANNIC_BH = BH;
export { halfBreadthAt as britannicHalfBreadthAt };
