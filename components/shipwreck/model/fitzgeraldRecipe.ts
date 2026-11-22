import {
  FITZGERALD_BOATS,
  FITZGERALD_HATCHES,
} from "@/lib/shipwreck/ships/fitzgerald";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import { createHullSurface } from "./hullSurface";
import {
  hash01,
  normalize,
  type Block,
  type BoatRecipe,
  type BoxPart,
  type DavitRecipe,
  type FunnelRecipe,
  type Hatch,
  type LightSpot,
  type MastRecipe,
  type NameBoard,
  type Placement,
  type Propeller,
  type RailRun,
  type ShipLayout,
  type ShipPaint,
  type ShipRecipe,
  type V3,
  type Wire,
} from "./titanicRecipe";

/**
 * SS Edmund Fitzgerald's details as on 10 November 1975: a straight-decked
 * Great Lakes ore carrier, her houses at the ends and 21 hatches between
 * (README, "The Edmund Fitzgerald"). Pure data and placement maths, like
 * `titanicRecipe.ts`; `buildShip.ts` turns it into geometry.
 *
 * Ship frame: metres, x forward, y to port, z up from the keel at
 * midships. Her decks (`spec.decks`): Pilothouse, Texas, Forecastle, After
 * house top, Poop, Spar (the top of the hull), Main, Tank top.
 *
 * Her houses, funnel, hatches and boats stand where the ship data puts
 * them (`spec.superstructure`, `spec.funnels`, `FITZGERALD_HATCHES`,
 * `FITZGERALD_BOATS`), so the model moves with the data. What the data has
 * no field for (the pilothouse's size, the masts, the hatch crane, the
 * steering pole, the anchors, the name boards) is measured off her
 * photographs (README).
 *
 * The two ballast tank vents and the length of fence rail she lost before
 * 3:30 PM (her first report) are left out: torn stubs mark the places.
 */

const FT = 0.3048;
const IN = FT / 12;
const TO_RAD = Math.PI / 180;

// Paint (sRGB). Sources and where they disagree: README.
/** Columbia Transportation's hull red, from the 1971 colour photographs. */
const HULL_RED = 0x611f1f;
/** Under the water: the same red, darker (an assumption, README). */
const BOTTOM_RED = 0x4a1818;
/** Cabins and the forecastle's plating: an off-white, a little warm. */
const CREAM = 0xe7e0cc;
/** House tops: grey-green deck paint (the builder's model, README). */
const HOUSE_TOP = 0x8f978c;
/** The spar deck and the hatch coamings: red oxide, as on most lakers. */
const DECK_RED = 0x6b3326;
/** The hatch covers: the deck's red oxide, a shade darker. */
const COVER_RED = 0x5a2820;
/** Columbia's stack: dark red, a buff band with a red star and white C, a black top. */
const STACK_RED = 0x45201b;
const STACK_BUFF = 0xd9a53a;
const STACK_TOP = 0x161616;
const STAR_RED = 0xb3221c;
const LETTER_WHITE = 0xf2efe6;
/** Masts, radar and the fence rail's posts. */
const MAST = 0x2a2a2c;
const RADAR = 0x34363a;
const STEEL = 0x3a3634;
/** The fence rail's wire, dull steel (so it does not glow at night). */
const FENCE_WIRE = 0x5a5650;
/** The pilothouse's glass, unlit at night (her officers kept it dark). */
const GLASS = 0x1b242c;
const RUST = 0x5a3424;
const TORN = 0x1c1410;

const PAINT: ShipPaint = {
  funnel: STACK_RED,
  funnelTop: STACK_TOP,
  sheerLine: null,
  name: "EDMUND FITZGERALD",
  mast: MAST,
  ventLining: 0x2a1a14,
  port: "MILWAUKEE",
  // Black letters on the white forecastle and the after house, white on
  // the red counter (photographs).
  letters: {
    bow: 0x1a1a1a,
    stern: LETTER_WHITE,
    font: "sans",
    weight: "heavy",
  },
  // A welded hull: the plates' seams show faintly.
  hull: { topsides: HULL_RED, bottom: BOTTOM_RED, relief: 0.3 },
  // Her lifeboats: white over red (the No. 2 boat, Valley Camp museum).
  boat: { hull: 0xf1efe8, bottom: HULL_RED },
};

/** The deck's camber: 18 in (USCG). */
const CAMBER = 18 * IN;
/** Coamings 11 ft 7 in by 54 ft (3 ft outboard of the 11 × 48 ft opening). */
const COAMING = { hx: ((11 + 7 / 12) * FT) / 2, hw: (54 * FT) / 2 };
/** The steel cover laps the coaming a little, 0.3 m deep with its skirt. */
const COVER = { hx: COAMING.hx + 0.08, hw: COAMING.hw + 0.07, h: 0.3 };
/** The tier height of her houses (the data's deck step). */
const TIER = 2.6;
/** The texas house is set in from the forecastle's sides. */
const TEXAS_INSET = 1.6;
/** The after house's upper tier is set in so the lifeboats stand beside it. */
const AFTER_INSET = 3.6;
/** The pilothouse: half its breadth, its length (her photographs). */
const PILOT_HW = 6.0;
/**
 * The propeller aperture, drawn open (README): the sternpost's after face
 * this far forward of the after perpendicular, the aperture's top this
 * high over the keel (clear of the blades' tips).
 */
export const APERTURE = { fwd: 2.7, top: 6.8 } as const;
/** Her ballast tanks beside each hold, a side (NTSB Figure 2: 3, 2, 3). */
const TANKS_PER_HOLD = { 1: 3, 2: 2, 3: 3 } as const;
/** Ballast tank vents: mushroom vents, 18 in over the deck (USCG). */
const VENT_SCALE = 0.17;
/** Where the hatch crane's rails run, each side of the centre line. */
const CRANE_Y = 9.1;

/** Ship-frame x of hatch n (1 forward … 21 aft), from the data. */
function hatchX(n: number): number {
  return FITZGERALD_HATCHES[n - 1].x;
}

/**
 * The starboard fence rail that was down by 3:30 PM: over No. 1 hold's
 * starboard tanks, where the vents were lost (an assumption, README),
 * from forward of No. 5 hatch's vent to just aft of No. 3 hatch.
 */
export const FENCE_GAP: readonly [number, number] = [
  hatchX(5) - 6,
  hatchX(3) + 1.5,
];

export function fitzgeraldRecipe(spec: ShipSpec): ShipRecipe {
  // Her stern is round and broad in plan above the water and her bow
  // bluff (photographs); the offsets narrow to the sternpost and the stem
  // all the way up (fine for the sim's volumes). The drawn hull flares out
  // to a round counter and a full forecastle from the waterline up, as the
  // Titanic's counter does (README).
  // Both flares start above her draught, so the drawn hull is the
  // offsets' own (within 5 cm) at and below it everywhere but the
  // propeller aperture: between the sternpost and the rudder post the
  // hull is cut from the drawing only (the sim keeps the deadwood:
  // README). The roundings blend into the offsets (`blend`) and are worked
  // out exactly at every row, rows at the same heights from section to
  // section, so the flares show no crease; the bow's narrows to her sharp
  // stem over its last few metres (`tip`).
  const AP = -spec.lbp / 2;
  const hull = createHullSurface(
    spec,
    { fromX: -84, exponent: 2.8, zFrom: 8.6, zTo: 11.7, blend: 3.5 },
    { fromX: 80, exponent: 2, zFrom: 8.75, zTo: 11.5, tip: 4.5, blend: 2.5 },
    { fromX: -1000, toX: AP + APERTURE.fwd, zTop: APERTURE.top }
  );
  const deckByName = new Map(spec.decks.map((d, i) => [d.name, i]));
  const deckIndex = (name: string): number => {
    const i = deckByName.get(name);
    if (i === undefined) throw new Error(`no deck ${name}`);
    return i;
  };
  const deckZ = (name: string, x: number): number =>
    spec.decks[deckIndex(name)].z + (spec.sheerZ(x) - spec.depth);
  const edge = (x: number): number => hull.topHalfBreadth(x);
  const Spar = (x: number) => deckZ("Spar", x);
  const Fc = (x: number) => deckZ("Forecastle", x);
  const Texas = (x: number) => deckZ("Texas", x);
  const Poop = (x: number) => deckZ("Poop", x);
  const Top = (x: number) => deckZ("After house top", x);
  const sides: (1 | -1)[] = [1, -1];

  // The data's houses: [0..2] aft (the stern, the two-tier middle, the
  // front), [3..5] forward (the forecastle's after end, the texas tier,
  // the bow).
  const sup = spec.superstructure;
  const stem = hull.xMax;
  const stern = hull.xMin;
  /** The forecastle's after end; the after house's front. */
  const FC = sup[3].fromX;
  /** The middle of her name on the forecastle. */
  const nameX = FC + 8.4;
  const AH = sup[2].toX;
  /** The texas tier on the forecastle; the after house's upper tier. */
  const TX0 = sup[4].fromX;
  const TX1 = sup[4].toX;
  const AT0 = sup[1].fromX;
  const AT1 = sup[1].toX;
  /** The pilothouse on the texas deck, set back from its front. */
  const PH0 = TX0 + 5.5;
  const PH1 = TX1 - 1.8;
  /**
   * The pilothouse: its floor the data's Pilothouse deck (a step up on its
   * void over the texas deck), one tier to the visor: about 3.3 m over the
   * texas deck, as her photographs show (README).
   */
  const pilotH = deckZ("Pilothouse", 0) - Texas(0) + TIER;
  const pilotRoof = (x: number) => Texas(x) + pilotH;

  const layout: ShipLayout = {
    sternX: stern,
    stemX: stem,
    forecastleFrom: FC,
    poopTo: AH,
    bridgeDeckFrom: AH,
    bridgeDeckTo: FC,
    boatDeckFrom: AT0,
    boatDeckTo: AT1,
    promenadeEnclosedFrom: AT1,
    aHouseInset: AFTER_INSET,
    // The paint line at her 27 ft 6 in draught aft leaving Superior; no
    // boot-top (photographs).
    loadWaterline: 27.5 * FT,
    bootTop: 0,
  };

  // -------------------------------------------------------------------------
  // The deck and the houses.
  const blocks: Block[] = [
    {
      id: "spar-deck",
      x0: stern + 0.02,
      x1: stem - 0.02,
      deck: "Spar",
      h: 0.03,
      wall: "white",
      wallColor: HULL_RED,
      roof: "paint",
      roofColor: DECK_RED,
      camber: CAMBER,
      ends: false,
    },
    // Forward: the raised forecastle, flush with the sides and white; a
    // solid bulwark round its bow; the texas house on it, its front
    // rounded; the pilothouse on top, raised on its void, under a visor.
    {
      id: "forecastle",
      x0: FC,
      x1: stem - 0.02,
      deck: "Spar",
      h: TIER,
      wall: "white",
      wallColor: CREAM,
      roof: "paint",
      roofColor: HOUSE_TOP,
    },
    {
      id: "forecastle-bulwark",
      x0: TX1,
      x1: stem - 0.02,
      deck: "Forecastle",
      h: 1.0,
      strip: 0.2,
      wall: "white",
      wallColor: CREAM,
      roof: "paint",
      roofColor: CREAM,
      ends: false,
    },
    {
      id: "texas-house",
      x0: TX0,
      x1: TX1,
      deck: "Forecastle",
      h: TIER,
      inset: TEXAS_INSET,
      roundFwd: 4.5,
      wall: "white",
      wallColor: CREAM,
      roof: "paint",
      roofColor: HOUSE_TOP,
    },
    {
      id: "pilothouse",
      x0: PH0,
      x1: PH1,
      deck: "Texas",
      h: pilotH,
      halfWidth: PILOT_HW,
      roundFwd: 2.6,
      wall: "white",
      wallColor: CREAM,
      roof: "paint",
      roofColor: HOUSE_TOP,
    },
    {
      id: "pilothouse-visor",
      x0: PH0 - 0.2,
      x1: PH1 + 0.45,
      deck: "Texas",
      dz: pilotH,
      h: 0.16,
      halfWidth: PILOT_HW + 0.3,
      roundFwd: 3.0,
      wall: "white",
      wallColor: CREAM,
      roof: "paint",
      roofColor: HOUSE_TOP,
      under: true,
    },
    // Aft: the house from the stern to No. 21's after side, flush and
    // white; its upper tier set in, the lifeboats beside it.
    {
      id: "after-house",
      x0: stern + 0.02,
      x1: AH,
      deck: "Spar",
      h: TIER,
      wall: "white",
      wallColor: CREAM,
      roof: "paint",
      roofColor: HOUSE_TOP,
    },
    {
      id: "after-tier",
      x0: AT0,
      x1: AT1,
      deck: "Poop",
      h: TIER,
      inset: AFTER_INSET,
      wall: "white",
      wallColor: CREAM,
      roof: "paint",
      roofColor: HOUSE_TOP,
    },
    // The hatch crane's rails, outboard of the coamings.
    {
      id: "crane-rails",
      x0: hatchX(21) - 3,
      x1: hatchX(1) + 3,
      deck: "Spar",
      h: 0.4,
      halfWidth: CRANE_Y + 0.12,
      strip: 0.24,
      wall: "white",
      wallColor: STEEL,
      roof: "paint",
      roofColor: STEEL,
    },
  ];

  // -------------------------------------------------------------------------
  // Hatches: 21 one-piece steel covers on their coamings (the data's).
  const openings = new Map((spec.deckOpenings ?? []).map((o) => [o.id, o]));
  const hatches: Hatch[] = FITZGERALD_HATCHES.map((h) => ({
    x0: h.x - COVER.hx,
    x1: h.x + COVER.hx,
    hw: COVER.hw,
    // The cover rests on the coaming's top, the sim's opening.
    z: openings.get(h.id)?.z ?? Spar(h.x) + CAMBER + 24 * IN,
    h: COVER.h,
    color: COVER_RED,
    coaming: { hx: COAMING.hx, hw: COAMING.hw, color: DECK_RED },
  }));

  // -------------------------------------------------------------------------
  // The funnel: Columbia's colours (README).
  const funnels: FunnelRecipe[] = spec.funnels.map((f, i) => ({
    index: i,
    x: f.x,
    baseZ: f.baseZ,
    topZ: f.topZ,
    dummy: f.dummy,
    semiA: 2.5,
    semiB: 2.3,
    rake: 2 * TO_RAD,
    blackTop: 0.27 * (f.topZ - f.baseZ),
    bands: [],
    pipes: [],
    hasWhistle: true,
    stripes: [{ from: 0.42, to: 0.72, color: STACK_BUFF }],
    emblem: { z: 0.57, r: 0.95, star: STAR_RED, letter: LETTER_WHITE },
  }));

  // -------------------------------------------------------------------------
  // Masts: the radar mast on the pilothouse; the after mast abaft the
  // funnel, taller (photographs).
  const fMast = (PH0 + PH1) / 2 - 0.6;
  const aMast = funnels[0].x - funnels[0].semiA - 1.6;
  const masts: MastRecipe[] = [
    {
      id: "fore",
      x: fMast,
      baseZ: pilotRoof(fMast) + 0.16,
      topZ: pilotRoof(fMast) + 6.8,
      r0: 0.24,
      r1: 0.14,
      rake: 0,
      // A radar mast: no yard; splayed legs and a railed platform (boxes).
      yard: false,
    },
    {
      id: "main",
      x: aMast,
      baseZ: Top(aMast),
      topZ: Top(aMast) + 14.5,
      r0: 0.26,
      r1: 0.12,
      rake: 0,
    },
  ];
  const [fore, main] = masts;

  // -------------------------------------------------------------------------
  // Boats (FITZGERALD_BOATS order): two 50-person lifeboats on the poop
  // deck in gravity davits, port and starboard beside the upper tier; two
  // 25-person rafts in their canisters.
  const LIFEBOAT = { length: 24 * FT, beam: 8.5 * FT, depth: 3.6 * FT };
  const RAFT = { length: 1.7, beam: 0.95, depth: 0.7 };
  /** The forward raft's platform, off the texas deck's after end. */
  const raftPlatformY = -6.4;
  const boats: BoatRecipe[] = FITZGERALD_BOATS.map((b) => {
    const deck = deckZ(b.deck, b.x);
    const s = b.side === "port" ? 1 : b.side === "starboard" ? -1 : 0;
    const e = edge(b.x);
    if (b.kind === "lifeboat")
      return {
        index: b.index,
        label: b.label,
        kind: "lifeboat",
        side: b.side,
        x: b.x,
        y: s * (e - 1.45),
        z: deck + 0.25,
        ...LIFEBOAT,
        hasDavits: true,
        edgeY: s * (e - 0.15),
        deckZ: deck,
      } satisfies BoatRecipe;
    return {
      index: b.index,
      label: b.label,
      kind: "collapsible",
      side: b.side,
      x: b.x,
      y: s === 0 ? 0 : b.deck === "Texas" ? raftPlatformY : s * (e - 1.2),
      z: deck + 0.1,
      ...RAFT,
      hasDavits: false,
      edgeY: s * (e - 0.15),
      deckZ: deck,
    } satisfies BoatRecipe;
  });
  const davits: DavitRecipe[] = [];
  for (const b of boats) {
    if (!b.hasDavits) continue;
    for (const dx of [-1, 1]) {
      const x = b.x + dx * (b.length / 2 - 0.45);
      // Stowed in: the arms over the boat.
      davits.push({
        boat: b.index,
        x,
        footY: b.edgeY,
        headY: b.y,
        z: Poop(x),
      });
    }
  }

  // -------------------------------------------------------------------------
  // Lights.
  const lights: LightSpot[] = [];
  const boxes: BoxPart[] = [];
  /** The pilothouse's windows' middle height. */
  const winZ = (x: number) => Texas(x) + pilotH - 0.95;
  let serial = 0;
  const seed = () => hash01(serial++, 1975);
  const dFc = deckIndex("Forecastle");
  const dPoop = deckIndex("Poop");
  const dSpar = deckIndex("Spar");

  function wallLight(
    kind: LightSpot["kind"],
    p: V3,
    n: V3,
    w: number,
    h: number,
    deck: number
  ): void {
    lights.push({
      kind,
      p: [p[0] + n[0] * 0.03, p[1] + n[1] * 0.03, p[2] + n[2] * 0.03],
      n,
      w,
      h,
      deck,
      seed: seed(),
    });
  }
  /** A light on a wall `inset` in from the deck edge, facing outboard. */
  function edgeLight(
    kind: LightSpot["kind"],
    x: number,
    z: number,
    s: 1 | -1,
    inset: number,
    w: number,
    h: number,
    deck: number
  ): void {
    const e = edge(x) - inset;
    if (e < 1.5) return;
    const d = 0.4;
    const slope = (edge(x + d) - edge(x - d)) / (2 * d);
    wallLight(kind, [x, s * e, z], normalize([-slope, s, 0]), w, h, deck);
  }
  function row(
    x0: number,
    x1: number,
    step: number,
    gap: number,
    rowId: number,
    at: (x: number) => void
  ): void {
    const n = Math.floor((x1 - x0) / step);
    for (let i = 0; i <= n; i += 1) {
      if (hash01(i, rowId) < gap) continue;
      at(x0 + i * step);
    }
  }
  /** Places round a rounded front of half-breadth `hw(x)` over length R. */
  function roundFront(
    emit: (p: V3, n: V3) => void,
    x1: number,
    R: number,
    hw: (x: number) => number,
    z: number,
    ts: number[]
  ): void {
    const curve = (x: number) => {
      const t = Math.min(1, (x - (x1 - R)) / R);
      return hw(x) * Math.sqrt(Math.max(0, 1 - t * t));
    };
    for (const t of ts)
      for (const s of sides) {
        const x = x1 - R + R * t;
        const d = 0.05;
        const slope = (curve(x + d) - curve(x - d)) / (2 * d);
        emit([x, s * curve(x), z], normalize([-slope, s, 0]));
      }
    emit([x1, 0, z], [1, 0, 0]);
  }
  /** A pane of the pilothouse's dark glass, standing just proud of its wall. */
  const glass = (p: V3, n: V3, w: number, h: number) =>
    boxes.push({
      c: [p[0] + n[0] * 0.02, p[1] + n[1] * 0.02, p[2]],
      size: [0.04, w, h],
      color: GLASS,
      yaw: Math.atan2(n[1], n[0]),
    });
  const port = (x: number, z: number, s: 1 | -1, inset: number, deck: number) =>
    edgeLight("porthole", x, z, s, inset, 0.42, 0.42, deck);

  for (const s of sides) {
    const id = s > 0 ? 0 : 1;
    // The forecastle's portholes in two staggered rows, the lower one
    // forward of the name.
    row(FC + 0.8, stem - 4, 2.2, 0.15, 10 + id, (x) =>
      port(x, Spar(x) + 1.85, s, 0, dSpar)
    );
    row(nameX + 7, stem - 3, 2.2, 0.2, 18 + id, (x) =>
      port(x + 1.1, Spar(x + 1.1) + 1.05, s, 0, dSpar)
    );
    // The texas house's.
    row(TX0 + 0.8, TX1 - 4.6, 1.8, 0.1, 12 + id, (x) =>
      port(x, Fc(x) + 1.45, s, TEXAS_INSET, dFc)
    );
    // The after house's two tiers: portholes below, windows above.
    row(stern + 3.5, AH - 0.8, 2.0, 0.15, 14 + id, (x) =>
      port(x, Spar(x) + 1.75, s, 0, dSpar)
    );
    row(AT0 + 0.9, AT1 - 0.9, 1.9, 0.1, 16 + id, (x) =>
      port(x, Poop(x) + 1.5, s, AFTER_INSET, dPoop)
    );
    // The pilothouse's side windows, high under the visor: dark glass,
    // not lights (a pilothouse is kept dark at night).
    for (let x = PH0 + 0.7; x < PH1 - 2.7; x += 1.15)
      glass([x, s * PILOT_HW, winZ(x)], [0, s, 0], 0.95, 1.05);
  }
  roundFront(
    (p, n) => wallLight("porthole", p, n, 0.42, 0.42, dFc),
    TX1,
    4.5,
    (x) => edge(x) - TEXAS_INSET,
    Fc(TX1) + 1.45,
    [0.2, 0.55, 0.85]
  );
  // The pilothouse's front: a band of windows round its curve.
  roundFront(
    (p, n) => glass(p, n, 0.95, 1.05),
    PH1,
    2.6,
    () => PILOT_HW,
    winZ(PH1),
    [0.08, 0.3, 0.5, 0.68, 0.84, 0.95]
  );
  for (const y of [-3.6, -1.2, 1.2, 3.6]) {
    // The pilothouse's after windows; the after tier's end windows.
    glass([PH0, y, winZ(PH0)], [-1, 0, 0], 0.9, 1.0);
    wallLight(
      "window",
      [AT0, y, Poop(AT0) + 1.45],
      [-1, 0, 0],
      1.0,
      1.0,
      dPoop
    );
    wallLight("window", [AT1, y, Poop(AT1) + 1.45], [1, 0, 0], 1.0, 1.0, dPoop);
  }
  for (let y = -9; y <= 9.01; y += 2.25) {
    // Portholes in the houses' faces over the deck.
    wallLight(
      "porthole",
      [AH, y, Spar(AH) + 1.75],
      [1, 0, 0],
      0.42,
      0.42,
      dSpar
    );
    if (Math.abs(y) < edge(FC) - 1)
      wallLight(
        "porthole",
        [FC, y, Spar(FC) + 1.75],
        [-1, 0, 0],
        0.42,
        0.42,
        dSpar
      );
  }
  // Deck lights: floodlights on the houses' faces and the after mast,
  // lighting the hatches.
  for (const y of [-7.5, -3, 3, 7.5]) {
    wallLight("window", [AH, y, Poop(AH) - 0.3], [1, 0, 0], 0.5, 0.36, dSpar);
    wallLight("window", [FC, y, Fc(FC) - 0.3], [-1, 0, 0], 0.5, 0.36, dSpar);
  }
  wallLight(
    "window",
    [main.x + 0.3, 0, main.baseZ + 7],
    normalize([1, 0, -0.35]),
    0.6,
    0.45,
    dSpar
  );
  wallLight(
    "window",
    [fore.x - 0.3, 0, fore.baseZ + 3.0],
    normalize([-1, 0, -0.35]),
    0.55,
    0.42,
    dSpar
  );

  // -------------------------------------------------------------------------
  // Ventilators. Ballast tank vents (mushroom-capped, 18 in high), two to
  // each of her 16 tanks (USCG), at the deck edge between the hatches
  // nearest each end of the tank; the two she lost are gone, a torn stub
  // and a dark hole where each stood. A few cowls on the houses.
  const lost = (spec.deckOpenings ?? []).filter((o) => o.kind === "vent");
  const drums: Placement[] = [];
  /** Between-hatch places for a vent: abaft each hatch, 12 ft. */
  const slots = FITZGERALD_HATCHES.map((h) => h.x - 3.6);
  for (const t of spec.compartments) {
    const m = /^tank([123])-([ps])$/.exec(t.id);
    if (!m) continue;
    const n = TANKS_PER_HOLD[Number(m[1]) as 1 | 2 | 3];
    const s = m[2] === "p" ? 1 : -1;
    for (let k = 0; k < n; k += 1) {
      const x0 = t.fromX + ((t.toX - t.fromX) * k) / n;
      const x1 = t.fromX + ((t.toX - t.fromX) * (k + 1)) / n;
      const inTank = slots.filter((x) => x > x0 && x <= x1);
      if (inTank.length === 0) continue;
      const ends = [Math.min(...inTank), Math.max(...inTank)];
      for (const x of ends) {
        const y = s * (edge(x) - 0.6);
        if (lost.some((v) => Math.hypot(v.x - x, v.y - y) < 0.5)) continue;
        drums.push({ p: [x, y, Spar(x)], yaw: 0, scale: VENT_SCALE });
      }
    }
  }
  for (const v of lost) {
    boxes.push({
      c: [v.x, v.y, Spar(v.x) + 0.012],
      size: [0.75, 0.6, 0.03],
      color: TORN,
    });
    boxes.push({
      c: [v.x, v.y, Spar(v.x) + 0.08],
      size: [0.22, 0.22, 0.16],
      color: RUST,
      yaw: 0.4,
    });
  }
  const vents: Placement[] = [];
  const cowl = (x: number, y: number, z: number, scale: number, turn: number) =>
    vents.push({ p: [x, y, z], yaw: turn * Math.PI, scale });
  for (const s of sides) {
    cowl(funnels[0].x + 4.6, s * 3.2, Top(funnels[0].x + 4.6), 0.55, 0);
    cowl(funnels[0].x + 9.5, s * 5.6, Top(funnels[0].x + 9.5), 0.5, s * 0.5);
    cowl(AH - 1.2, s * 5.0, Poop(AH - 1.2), 0.42, 0);
    cowl(
      TX1 + 1.6,
      s * Math.min(4.2, edge(TX1 + 1.6) - 1.4),
      Fc(TX1 + 1.6),
      0.42,
      0
    );
  }

  // -------------------------------------------------------------------------
  // Deck gear: the windlass on the forecastle, mooring winches at the
  // houses' faces, bitts along the deck edges.
  const capstans: Placement[] = [];
  const bollards: Placement[] = [];
  for (const s of sides) {
    capstans.push({
      p: [stem - 4.6, s * 1.4, Fc(stem - 4.6)],
      yaw: 0,
      scale: 1.1,
    });
    capstans.push({
      p: [FC - 2.4, s * 6.5, Spar(FC - 2.4)],
      yaw: 0,
      scale: 1.0,
    });
    capstans.push({
      p: [AH - 4.6, s * 4.6, Spar(AH - 4.6)],
      yaw: 0,
      scale: 1.0,
    });
    capstans.push({
      p: [stern + 4.5, s * 3.2, Poop(stern + 4.5)],
      yaw: 0,
      scale: 0.9,
    });
    for (const x of [FC - 6, 30, -20, AH - 1.6])
      bollards.push({ p: [x, s * (edge(x) - 0.9), Spar(x)], yaw: 0, scale: 1 });
    bollards.push({
      p: [TX1 + 3.6, s * (edge(TX1 + 3.6) - 1.0), Fc(TX1 + 3.6)],
      yaw: 0,
      scale: 1,
    });
  }

  // -------------------------------------------------------------------------
  // Painted boxes: the hatch crane, the radars, the forward raft's
  // platform, the broken fence posts.
  const crane = { x: hatchX(21), z: Spar(hatchX(21)) + 0.4 };
  {
    const legH = 4.8;
    const zTop = crane.z + legH;
    for (const s of sides) {
      for (const dx of [-2.3, 2.3])
        boxes.push({
          c: [crane.x + dx, s * CRANE_Y, crane.z + legH / 2],
          size: [0.55, 0.7, legH],
          color: CREAM,
        });
      // The side frame along the rail, with its wheels' truck below.
      boxes.push({
        c: [crane.x, s * CRANE_Y, zTop + 0.35],
        size: [5.4, 0.7, 0.7],
        color: CREAM,
      });
      boxes.push({
        c: [crane.x, s * CRANE_Y, crane.z + 0.3],
        size: [5.6, 0.8, 0.55],
        color: CREAM,
      });
    }
    // Two girders across, the hoist's trolley, the operator's cab on the
    // starboard leg.
    for (const dx of [-2.3, 2.3])
      boxes.push({
        c: [crane.x + dx, 0, zTop + 0.4],
        size: [0.6, 2 * CRANE_Y + 0.7, 0.8],
        color: CREAM,
      });
    boxes.push({
      c: [crane.x, 1.5, zTop + 0.15],
      size: [2.2, 2.0, 0.9],
      color: CREAM,
    });
    boxes.push({
      c: [crane.x + 0.2, -(CRANE_Y - 1.35), zTop - 1.2],
      size: [1.9, 2.0, 2.1],
      color: CREAM,
    });
  }
  // The radar mast (photographs): four legs splayed from the pilothouse
  // roof to the pole, a railed platform with the second radar, the main
  // scanner on top.
  {
    const legTop = fore.baseZ + 3.3;
    for (const dx of [-1.1, 1.1])
      for (const dy of [-1.3, 1.3]) {
        const foot: V3 = [fore.x + dx, dy, fore.baseZ];
        const head: V3 = [fore.x + dx * 0.15, dy * 0.15, legTop];
        const ddx = head[0] - foot[0];
        const ddy = head[1] - foot[1];
        const ddz = head[2] - foot[2];
        boxes.push({
          c: [
            (foot[0] + head[0]) / 2,
            (foot[1] + head[1]) / 2,
            (foot[2] + head[2]) / 2,
          ],
          size: [Math.hypot(ddx, ddy, ddz), 0.12, 0.12],
          color: MAST,
          yaw: Math.atan2(ddy, ddx),
          pitch: Math.atan2(ddz, Math.hypot(ddx, ddy)),
        });
      }
  }
  // Radar: the main scanner atop the mast, the second on a platform.
  boxes.push({
    c: [fore.x, 0, fore.topZ + 0.3],
    size: [0.55, 5.2, 0.32],
    color: RADAR,
  });
  boxes.push({
    c: [fore.x, 0, fore.topZ - 0.05],
    size: [0.4, 0.4, 0.4],
    color: RADAR,
  });
  boxes.push({
    c: [fore.x - 0.2, 0, fore.baseZ + 3.4],
    size: [1.8, 2.2, 0.12],
    color: MAST,
  });
  boxes.push({
    c: [fore.x + 0.45, 0, fore.baseZ + 3.7],
    size: [0.3, 0.3, 0.5],
    color: RADAR,
  });
  boxes.push({
    c: [fore.x + 0.45, 0, fore.baseZ + 4.05],
    size: [0.42, 3.4, 0.26],
    color: RADAR,
  });
  // The forward raft's platform off the texas deck's after end, on posts.
  {
    const x = boats[2]?.x ?? TX0 - 2;
    const z = Texas(x) - 0.1;
    boxes.push({
      c: [x + 0.2, raftPlatformY, z],
      size: [3.4, 2.6, 0.2],
      color: CREAM,
    });
    for (const dy of [-1.1, 1.1]) {
      const px = x - 1.2;
      boxes.push({
        c: [px, raftPlatformY + dy, (Spar(px) + z) / 2],
        size: [0.16, 0.16, z - Spar(px)],
        color: CREAM,
      });
    }
  }
  // The fence rail's posts where it went down: bent flat or broken short.
  for (
    let x = FENCE_GAP[0] + 1.5, i = 0;
    x < FENCE_GAP[1] - 0.5;
    x += 3, i += 1
  ) {
    const y = -(edge(x) - 0.12);
    const bent = hash01(i, 33) < 0.5;
    boxes.push(
      bent
        ? {
            c: [x, y + 0.35, Spar(x) + 0.08],
            size: [0.06, 0.8, 0.06],
            color: STEEL,
            yaw: 0.3 * (hash01(i, 34) - 0.5),
          }
        : { c: [x, y, Spar(x) + 0.13], size: [0.06, 0.06, 0.26], color: STEEL }
    );
  }

  // -------------------------------------------------------------------------
  // Railings: the wire fence rail along the spar deck's edges (down to
  // starboard over the gap), the forecastle's, the houses' roofs.
  const rails: RailRun[] = [];
  function run(
    x0: number,
    x1: number,
    y: (x: number) => number,
    z: (x: number) => number,
    step: number,
    color?: number
  ): void {
    const pts: V3[] = [];
    const n = Math.max(2, Math.ceil((x1 - x0) / step));
    for (let i = 0; i <= n; i += 1) {
      const x = x0 + ((x1 - x0) * i) / n;
      pts.push([x, y(x), z(x)]);
    }
    rails.push(color === undefined ? { points: pts } : { points: pts, color });
  }
  const atEdge = (s: number, inset: number) => (x: number) =>
    s * Math.max(0, edge(x) - inset);
  function across(x: number, z: number, hw: number): void {
    const pts: V3[] = [];
    const n = Math.ceil((2 * hw) / 1.6);
    for (let i = 0; i <= n; i += 1) pts.push([x, -hw + (2 * hw * i) / n, z]);
    rails.push({ points: pts });
  }
  // The fence rail (posts every 10 ft).
  run(AH + 0.3, FC - 0.3, atEdge(1, 0.12), Spar, 3.05, FENCE_WIRE);
  run(AH + 0.3, FENCE_GAP[0], atEdge(-1, 0.12), Spar, 3.05, FENCE_WIRE);
  run(FENCE_GAP[1], FC - 0.3, atEdge(-1, 0.12), Spar, 3.05, FENCE_WIRE);
  for (const s of sides) {
    run(FC + 0.2, TX1, atEdge(s, 0.1), Fc, 1.6);
    run(TX0 + 0.2, TX1 - 4.5, atEdge(s, TEXAS_INSET + 0.1), Texas, 1.6);
    run(stern + 0.6, AH - 0.2, atEdge(s, 0.1), Poop, 1.6);
    run(AT0 + 0.2, AT1 - 0.2, atEdge(s, AFTER_INSET + 0.1), Top, 1.6);
  }
  across(FC + 0.15, Fc(FC + 0.15), edge(FC) - 0.1);
  across(AH - 0.15, Poop(AH - 0.15), edge(AH) - 0.1);
  across(TX0 + 0.15, Texas(TX0 + 0.15), edge(TX0) - TEXAS_INSET - 0.1);
  across(AT1 - 0.15, Top(AT1 - 0.15), edge(AT1) - AFTER_INSET - 0.1);
  across(AT0 + 0.15, Top(AT0 + 0.15), edge(AT0) - AFTER_INSET - 0.1);
  {
    // The rail round the radar platform.
    const z = fore.baseZ + 3.46;
    const [x0, x1, y0] = [fore.x - 1.05, fore.x + 0.65, 1.05];
    rails.push({
      points: [
        [x0, -y0, z],
        [x1, -y0, z],
        [x1, y0, z],
        [x0, y0, z],
        [x0, -y0, z],
      ],
      color: MAST,
    });
  }

  // -------------------------------------------------------------------------
  // Rigging: stays on both masts, the funnel's guys.
  const wires: Wire[] = [];
  for (const s of sides) {
    wires.push({
      a: [main.x, 0, main.topZ - 1.5],
      b: [AT0 + 0.6, s * (edge(AT0) - AFTER_INSET - 0.3), Top(AT0) + 0.2],
      kind: "rig",
    });
    wires.push({
      a: [main.x, 0, main.topZ - 1.5],
      b: [stern + 1.5, s * 2.2, Poop(stern + 1.5) + 0.2],
      kind: "rig",
    });
    wires.push({
      a: [fore.x, 0, fore.topZ - 1.2],
      b: [PH0 + 0.4, s * (PILOT_HW - 0.4), pilotRoof(PH0) + 0.2],
      kind: "rig",
    });
  }
  const funnelGuys: Wire[][] = funnels.map((f) => {
    const zBand = f.baseZ + (f.topZ - f.baseZ) * 0.72;
    const guys: Wire[] = [];
    for (const s of sides)
      for (const dx of [-3.2, 3.2]) {
        const x = f.x + dx;
        guys.push({
          a: [
            f.x - Math.tan(f.rake) * (zBand - f.baseZ),
            s * f.semiB * 0.92,
            zBand,
          ],
          b: [x, s * (edge(x) - AFTER_INSET - 0.3), Top(x) + 0.2],
          kind: "rig",
        });
      }
    return guys;
  });

  // -------------------------------------------------------------------------
  // Under water: one four-bladed propeller 19.5 ft across in the aperture
  // between the sternpost and the rudder post, the rudder hung on its
  // stock at the after perpendicular, under the counter, its heel on the
  // sole piece that closes the aperture below (a laker's stern,
  // photographs).
  const prop: Propeller = {
    hub: [AP + APERTURE.fwd - 0.7, 0, 3.5],
    radius: (19.5 * FT) / 2,
    blades: 4,
    phase: Math.PI / 4,
  };
  const lead = AP - 0.1;
  const chord = 2.6;
  const trail = lead - chord;
  const corner = (
    cx: number,
    cz: number,
    rr: number,
    a0: number,
    a1: number
  ): [number, number][] =>
    [0, 0.25, 0.5, 0.75, 1].map((t) => {
      const a = a0 + (a1 - a0) * t;
      return [cx + rr * Math.cos(a), cz + rr * Math.sin(a)];
    });
  const rudder: ShipRecipe["rudder"] = {
    outline: [
      [lead, 0.55],
      ...corner(trail + 0.8, 1.15, 0.8, -Math.PI / 2, -Math.PI),
      ...corner(trail + 0.9, 6.9, 0.9, Math.PI, Math.PI / 2),
      [lead, 7.8],
    ],
    thickness: 0.5,
    taper: { lead: 0.5, trail: 0.14 },
    centre: [lead - chord / 2, 0, 4.0],
    stock: { x: lead, z0: 0.45, z1: 10.4, r: 0.28 },
    // The sole piece: the keel carried aft under the aperture to the
    // rudder's heel.
    posts: [
      {
        c: [(AP + APERTURE.fwd + lead - 0.4) / 2, 0, 0.24],
        size: [AP + APERTURE.fwd - (lead - 0.4), 0.55, 0.48],
      },
    ],
  };

  // Anchors housed in square pockets halfway down the bow between the
  // water and the deck, near the stem (photographs).
  const anchors = (["port", "starboard"] as const).map((side) => {
    const s = side === "port" ? 1 : -1;
    const x = stem - 7.2;
    const z = (spec.draught + spec.sheerZ(x)) / 2 + 0.45;
    return {
      p: [x, s * hull.halfBreadth(x, z), z] as V3,
      side,
      pocket: { w: 2.0, h: 1.9 },
    };
  });

  // Her name on the forecastle's white plating and the after house's
  // sides in black, and on the counter in white over MILWAUKEE.
  const names: NameBoard[] = [
    ...(["port", "starboard"] as const).flatMap((side) => [
      {
        where: "bow" as const,
        x: nameX,
        z: Spar(nameX) + 0.8,
        side,
        width: 12.5,
        height: 1.3,
      },
      {
        where: "bow" as const,
        x: AT0 + 18,
        z: Spar(AT0 + 18) + 0.85,
        side,
        width: 10.5,
        height: 0.95,
      },
    ]),
    // On the counter's flat middle, clear of the crease low down where it
    // turns to her quarters: there the far end's first letters turned
    // 50° away and were hidden behind its curve (the test: no letter on a
    // surface turned over 30° from aft).
    {
      where: "stern",
      x: stern,
      z: spec.sheerZ(stern) - 0.95,
      side: "aft",
      width: 6.6,
      rows: 6,
      height: 1.6,
    },
  ];

  // The steering pole at the bow, leaning forward over the stem; the
  // ensign staff at the stern.
  const pole: V3 = [TX1 + 0.8, 0, Fc(TX1 + 0.8)];
  const ensign: V3 = [stern + 0.9, 0, Poop(stern + 0.9)];
  const staffs = [
    { foot: pole, top: [stem - 0.6, 0, pole[2] + 7.2] as V3 },
    { foot: ensign, top: [ensign[0] - 0.6, 0, ensign[2] + 6.5] as V3 },
  ];

  // Her bell on the pilothouse roof, forward (where the 1995 dive found
  // it).
  const bellX = PH1 - 1.4;
  const bells = [
    {
      p: [bellX, 0, pilotRoof(bellX) + 0.16 + 0.75] as V3,
      r: 0.24,
      footZ: pilotRoof(bellX) + 0.16,
    },
  ];

  return {
    spec,
    hull,
    layout,
    deckIndex,
    deckZ,
    houses: [],
    domes: [],
    funnels,
    masts,
    boats,
    davits,
    lights,
    vents,
    benches: [],
    bollards,
    capstans,
    cranes: [],
    hatches,
    rails,
    wires,
    funnelGuys,
    propellers: [prop],
    rudder,
    bossings: [],
    anchors,
    names,
    paint: PAINT,
    blocks,
    boxes,
    drums,
    ledgeDecks: ["Spar", "Tank top"],
    // No line under the sheer: the red runs to the deck edge.
    sheerLineZ: () => 1000,
    staffs,
    bells,
  };
}
