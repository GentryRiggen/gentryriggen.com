import { CONCORDIA_BOATS } from "@/lib/shipwreck/ships/concordia";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import { createHullSurface } from "./hullSurface";
import {
  hash01,
  normalize,
  swungOutY,
  type Block,
  type BoatRecipe,
  type BoxPart,
  type DavitRecipe,
  type FunnelRecipe,
  type LightSpot,
  type MastRecipe,
  type NameBoard,
  type Propeller,
  type RailRun,
  type ShipLayout,
  type ShipPaint,
  type ShipRecipe,
  type V3,
} from "./titanicRecipe";

/**
 * The Costa Concordia's details as on 13 January 2012, from her
 * photographs on Wikimedia Commons and the builder's scale model aboard
 * her (README, "The Costa Concordia", has a source for every feature):
 * the white hull with the blue line at her waterline over the red bottom,
 * the boat recess on deck 4 with her 26 orange-canopied lifeboats, the
 * window rows of decks 1–6, the balcony rows of decks 7–10 with their blue
 * glass, the stepped terraces aft, the stepped front with the bridge and
 * its wings on deck 8, the spa over it, the pool decks with their glass
 * roofs, the yellow water slide, the radar mast and domes, and the one
 * yellow funnel with the blue "C". Pure data and placement maths, like
 * `titanicRecipe.ts`; `buildShip.ts` turns it into geometry.
 *
 * Ship frame: metres, x forward, y to port, z up from the keel at
 * midships. Her decks (`spec.decks`) are "14" down to "1", "0" (the
 * bulkhead deck), "A", "B" and "C"; her hull's top is deck 3's floor.
 */

/** The decks with balcony cabins (README). */
export const CONCORDIA_BALCONY_DECKS = ["7", "8", "9", "10"] as const;

// Paint (sRGB). Sources: README, "The Costa Concordia".
/** Her hull: white (not quite the superstructure's, so a fun paint can
 *  tell them apart). */
const HULL_WHITE = 0xeeeeea;
/** Her decks and houses: white. */
const WHITE = 0xf3f3ef;
/** A wall set back in shade (the boat recess, the balconies' back wall). */
const SHADE = 0xd9d9d3;
/** The boat recess's back wall, deeper in shadow. */
const RECESS_SHADE = 0xb4b4ad;
/** Grey-white painted deck tops. */
const DECK_TOP = 0xd4d3cc;
/** The blue-tinted glass of her balcony fronts. */
const GLASS_BLUE = 0x2f5a85;
/** Dark glass: the midships pool's sides and roof. */
const GLASS_DARK = 0x26333d;
/** The aft pool's glass: its sides, and its roof catching the sky. */
const GLASS_SIDE = 0x4d6577;
const GLASS_ROOF = 0x8ea7b8;
const POOL = 0x3e8fb8;
const SLIDE = 0xf0b81c;
const COURT = 0x3f6f8f;
const ANTIFOULING = 0x7a2a22;
const NAME_BLUE = 0x1d3f8c;

/** Her one real paint (`costa-2012`). */
export const CONCORDIA_PAINT: ShipPaint = {
  funnel: 0xf2c230,
  funnelTop: 0x1c1c1e,
  sheerLine: null,
  name: "COSTA CONCORDIA",
  port: "GENOVA",
  letters: { bow: NAME_BLUE, stern: NAME_BLUE, font: "serif" },
  mast: WHITE,
  hull: {
    topsides: HULL_WHITE,
    bottom: ANTIFOULING,
    boot: 0x1f3a8a,
    relief: 0.25,
  },
  // Orange upper hull and canopy over a white lower hull.
  boat: { hull: 0xe8801f, bottom: 0xf1efe8, cover: 0xe8801f },
  fittings: WHITE,
  vent: WHITE,
};

/** A tier's height (her deck step, `concordia.ts`). */
const TIER = 2.8;
/** The boat recess's wall, in from her side. */
const RECESS_INSET = 4.8;
/** The balconies' depth (their back wall in from her side). */
const BALCONY_DEPTH = 1.8;
/** The balcony zone and the boat recess, fore and aft (README). */
const BALCONY: [number, number] = [-100, 96];
const RECESS: [number, number] = [-101, 104];
/** 150-person lifeboats, about 10.8 by 3.9 m (README). */
const BOAT = { length: 10.8, beam: 3.9, depth: 2.0 };
/** Each tier's after end (the stepped terraces) and forward end. */
const AFT_END: Record<string, number> = {
  "7": -129,
  "8": -127,
  "9": -124,
  "10": -120,
};
const FWD_END: Record<string, number> = {
  "7": 136,
  "8": 132,
  "9": 128,
  "10": 124,
};
/** The bow's plating (to deck 5) from here forward; the tiers over it. */
const BOW_PLATING_X = 128;
const DECK6_FWD = 138;
const DECK11_FWD = 120;
const SPA: [number, number] = [58, 116];

export function concordiaRecipe(
  spec: ShipSpec,
  // One real paint (her fun paints are painted over it by `recipeFor`).
  _livery: string = "costa-2012"
): ShipRecipe {
  void _livery;
  const hull = createHullSurface(spec);
  const paint = CONCORDIA_PAINT;
  const deckByName = new Map(spec.decks.map((d, i) => [d.name, i]));
  const deckIndex = (name: string): number => {
    const i = deckByName.get(name);
    if (i === undefined) throw new Error(`no deck ${name}`);
    return i;
  };
  const deckZ = (name: string, x: number): number =>
    spec.decks[deckIndex(name)].z + (spec.sheerZ(x) - spec.depth);
  const Z = (name: string) => deckZ(name, 0);
  const edge = (x: number): number => hull.topHalfBreadth(x);
  const sides: (1 | -1)[] = [1, -1];
  const stern = hull.xMin;
  const stem = hull.xMax;
  const funnelX = spec.funnels[0].x;

  const layout: ShipLayout = {
    sternX: stern,
    stemX: stem,
    forecastleFrom: BOW_PLATING_X,
    poopTo: stern,
    bridgeDeckFrom: AFT_END["8"],
    bridgeDeckTo: FWD_END["8"],
    boatDeckFrom: RECESS[0],
    boatDeckTo: RECESS[1],
    promenadeEnclosedFrom: RECESS[1],
    aHouseInset: RECESS_INSET,
    // The red to just under her 8.12 m waterline, the blue line across it
    // (photographs; [MIT §4.7.2] "blue stripe").
    loadWaterline: 7.6,
    bootTop: 1.4,
  };

  // -------------------------------------------------------------------------
  // Tiers. Deck 3 flush with her side; decks 4–5 set in over the boats
  // between the ends; deck 6 flush over them; decks 7–10 with the balconies
  // set in amidships, each tier ending a little shorter aft (the terraces)
  // and forward (the stepped front, the bridge on deck 8); deck 11 flush;
  // then the narrower top: the pool decks, the glass roof, the spa forward
  // and the sports deck on it.
  const flush = (
    id: string,
    deck: string,
    x0: number,
    x1: number,
    h: number,
    extra: Partial<Block> = {}
  ): Block => ({
    id,
    x0,
    x1,
    deck,
    h,
    wall: "white",
    wallColor: WHITE,
    roof: "paint",
    roofColor: DECK_TOP,
    ...extra,
  });
  const blocks: Block[] = [
    flush("deck-3", "3", stern + 1.2, BOW_PLATING_X, TIER, { roof: "pine" }),
    // The bow's plating carried up to deck 5 (the mooring deck inside).
    {
      id: "bow-plating",
      x0: BOW_PLATING_X,
      x1: stem - 0.05,
      deck: "3",
      h: 2 * TIER,
      wall: "plating",
      roof: "none",
    },
    // Its deck, painted.
    flush("foredeck", "5", BOW_PLATING_X, stem - 0.6, 0.02, {
      dz: -0.02,
      ends: false,
    }),
    flush("deck-4-aft", "4", stern + 2, RECESS[0], 2 * TIER, { roof: "none" }),
    {
      id: "boat-recess",
      x0: RECESS[0],
      x1: RECESS[1],
      deck: "4",
      h: 2 * TIER,
      inset: RECESS_INSET,
      wall: "shade",
      wallColor: RECESS_SHADE,
      roof: "none",
      ends: false,
    },
    flush("deck-4-fwd", "4", RECESS[1], BOW_PLATING_X, 2 * TIER),
    flush("deck-6", "6", stern + 3, DECK6_FWD, TIER, {
      roundFwd: 16,
      under: true,
    }),
  ];
  for (const deck of CONCORDIA_BALCONY_DECKS) {
    blocks.push(
      flush(`deck-${deck}-aft`, deck, AFT_END[deck], BALCONY[0], TIER, {
        roof: "pine",
      }),
      flush(
        deck === "8" ? "bridge" : `deck-${deck}-fwd`,
        deck,
        BALCONY[1],
        FWD_END[deck],
        TIER,
        { roundFwd: 16, under: true }
      )
    );
    if (deck !== "7")
      blocks.push({
        id: `balcony-floor-${deck}`,
        x0: BALCONY[0],
        x1: BALCONY[1],
        deck,
        dz: -0.3,
        h: 0.3,
        wall: "white",
        wallColor: WHITE,
        roof: "paint",
        roofColor: DECK_TOP,
        under: true,
        ends: false,
      });
  }
  blocks.push(
    {
      id: "balcony-wall",
      x0: BALCONY[0],
      x1: BALCONY[1],
      deck: "7",
      h: 4 * TIER,
      inset: BALCONY_DEPTH,
      wall: "shade",
      wallColor: SHADE,
      roof: "none",
      ends: false,
    },
    flush("deck-11", "11", -115, DECK11_FWD, TIER, {
      roundFwd: 16,
      under: true,
    }),
    // The top: her pool decks either side of the glass-roofed pool.
    flush("deck-12-aft", "12", -97, -2, TIER, {
      halfWidth: 15.5,
      roof: "pine",
    }),
    {
      id: "pool-glass",
      x0: -2,
      x1: 34,
      deck: "12",
      h: TIER,
      halfWidth: 13.5,
      wall: "white",
      wallColor: GLASS_DARK,
      roof: "paint",
      roofColor: GLASS_DARK,
    },
    flush("deck-12-fwd", "12", 34, 58, TIER, { halfWidth: 15.5, roof: "pine" }),
    // The spa, two decks over the bridge, its front rounded.
    flush("spa", "12", SPA[0], SPA[1], 2 * TIER, { inset: 1.5, roundFwd: 16 }),
    flush("sports-deck", "14", SPA[0] + 0.5, SPA[1] - 8, 0.35, {
      inset: 4,
      roofColor: COURT,
      roundFwd: 6,
    }),
    // The aft pool's glass house, fore and aft of the funnel: low glass
    // walls under a glass vault.
    ...[
      [funnelX - 34, funnelX - 9],
      [funnelX + 9, funnelX + 34],
    ].map(([x0, x1], i): Block => ({
      id: `aft-pool-glass-${i}`,
      x0,
      x1,
      deck: "13",
      h: 2.4,
      halfWidth: 13,
      wall: "white",
      wallColor: GLASS_SIDE,
      // A glass vault catching the sky.
      roof: "paint",
      roofColor: GLASS_ROOF,
      camber: 1.6,
    })),
    flush("funnel-casing", "13", funnelX - 10, funnelX + 10, 1.4, {
      halfWidth: 6,
    })
  );

  // -------------------------------------------------------------------------
  // The funnel: one, an upright oval about 15 m long and 9 m wide (the
  // scale model, the bow-on photographs), Costa yellow with a black top,
  // the blue "C" on both sides (her real paint only).
  const funnels: FunnelRecipe[] = spec.funnels.map((f, i) => {
    const H = f.topZ - f.baseZ;
    return {
      index: i,
      x: f.x,
      baseZ: f.baseZ,
      topZ: f.topZ,
      dummy: f.dummy,
      semiA: 7.5,
      semiB: 4.6,
      rake: 0,
      // The black top: about 30 % of what shows (the scale model).
      blackTop: 5.8,
      bands: [],
      pipes: [],
      hasWhistle: false,
      emblem: {
        // Midway up the yellow, 2.8 m to the middle of its stroke (the
        // scale model: the C half as tall as the yellow).
        z: (54.4 - f.baseZ) / H,
        r: 2.8,
        star: paint.funnel,
        letter: 0x1d4596,
        letterOnly: true,
        realOnly: true,
      },
    };
  });

  // -------------------------------------------------------------------------
  // The radar mast on the sports deck over the spa (the photographs: a
  // white lattice mast with its scanners and yards).
  const mastX = 80;
  const masts: MastRecipe[] = [
    {
      id: "fore",
      x: mastX,
      baseZ: Z("14") + 0.35,
      topZ: 68,
      r0: 0.55,
      r1: 0.18,
      rake: 0,
      yard: true,
    },
  ];

  // -------------------------------------------------------------------------
  // Boats: her data's 26, in the recess on deck 4 at her side, each in a
  // pair of davits.
  const boats: BoatRecipe[] = CONCORDIA_BOATS.map((b) => {
    const s = b.side === "port" ? 1 : -1;
    const e = edge(b.x);
    const deck = Z("4");
    const k = b.side === "port" ? b.index - 13 : b.index;
    return {
      index: b.index,
      label: `${b.side === "port" ? "P" : "S"}${k + 1}`,
      kind: "lifeboat",
      side: b.side,
      x: b.x,
      y: s * (e - BOAT.beam / 2 - 0.35),
      z: deck + 0.9,
      ...BOAT,
      hasDavits: true,
      edgeY: s * (e - 0.15),
      deckZ: deck,
    } satisfies BoatRecipe;
  });
  const davits: DavitRecipe[] = [];
  for (const b of boats)
    for (const dx of [-1, 1])
      davits.push({
        boat: b.index,
        x: b.x + dx * (b.length / 2 - 0.8),
        footY: b.edgeY,
        headY: swungOutY(b),
        z: b.deckZ,
      });
  // Liferaft canisters in two racks at each end of the boat rows.
  const canisters: { c: V3; r: number; len: number }[] = [];
  for (const s of sides)
    for (const x0 of [91.5, -99])
      for (let i = 0; i < 5; i += 1)
        for (const dz of [0.45, 1.25]) {
          const x = x0 + i * 1.9;
          canisters.push({
            c: [x, s * (edge(x) - 1.1), Z("4") + dz],
            r: 0.36,
            len: 1.5,
          });
        }

  // -------------------------------------------------------------------------
  // Lights: every window a pane that lights at night.
  const lights: LightSpot[] = [];
  let serial = 0;
  const seed = () => hash01(serial++, 2012);
  const push = (p: V3, n: V3, w: number, h: number, deck: string) =>
    lights.push({
      kind: "window",
      p: [p[0] + n[0] * 0.03, p[1] + n[1] * 0.03, p[2] + n[2] * 0.03],
      n,
      w,
      h,
      deck: deckIndex(deck),
      seed: seed(),
    });
  /** A window in her side `inset` in from her deck edge (or her hull). */
  function sideLight(
    x: number,
    z: number,
    s: 1 | -1,
    inset: number,
    w: number,
    h: number,
    deck: string
  ): void {
    const inHull = z < hull.zTop(x);
    const at = (xx: number) =>
      inHull ? hull.halfBreadth(xx, z) : edge(xx) - inset;
    const e = at(x);
    if (e < 2) return;
    const d = 0.4;
    const slope = (at(x + d) - at(x - d)) / (2 * d);
    const nz = inHull
      ? -(hull.halfBreadth(x, z + d) - hull.halfBreadth(x, z - d)) / (2 * d)
      : 0;
    push([x, s * e, z], normalize([-slope, s, nz]), w, h, deck);
  }
  /** A row of windows from x0 to x1, a few left out (`gap`). */
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
  /** Windows round a tier's rounded front (`R` long, `w` half-wide). */
  function frontLights(
    x1: number,
    R: number,
    w: number,
    z: number,
    count: number,
    size: [number, number],
    deck: string
  ): void {
    for (let i = 0; i < count; i += 1) {
      const phi = -1.25 + (2.5 * (i + 0.5)) / count;
      const x = x1 - R + R * Math.cos(phi) - 0.05;
      const y = w * Math.sin(phi);
      // The ellipse's outward normal.
      const n = normalize([Math.cos(phi) / R, Math.sin(phi) / w, 0]);
      push([x, y, z], n, size[0], size[1], deck);
    }
  }
  const nameX = 60;
  const bowNameX = 126;
  for (const s of sides) {
    const k = s > 0 ? 0 : 1;
    // Cabin windows in her hull (decks 1, 2) and deck 3, small and square.
    for (const [deck, id] of [
      ["1", 1],
      ["2", 3],
      ["3", 5],
    ] as const)
      row(-127, 118, 3.0, 0.1, id + k, (x) => {
        if (deck === "3" && x < -104) return;
        if (Math.abs(x - bowNameX) < 9) return;
        sideLight(x, Z(deck) + 1.4, s, 0, 0.75, 0.75, deck);
      });
    // Her restaurants aft, decks 3–5: big windows (two dark bands).
    for (const deck of ["3", "4", "5"])
      row(-134, -105, 3.2, 0, 7 + k, (x) =>
        sideLight(x, Z(deck) + 1.5, s, 0, 2.6, 1.8, deck)
      );
    // Deck 6 over the boats: windows in threes.
    row(-98, 128, 7.5, 0, 9 + k, (x) => {
      if (Math.abs(x - nameX) < 16) return;
      for (const dx of [-1.4, 0, 1.4])
        sideLight(x + dx, Z("6") + 1.45, s, 0, 1.0, 1.25, "6");
    });
    // Her balcony doors, decks 7–10, one a cabin.
    for (const deck of CONCORDIA_BALCONY_DECKS)
      row(BALCONY[0] + 1.8, BALCONY[1] - 1.8, 3.6, 0, 11 + k, (x) =>
        sideLight(x, Z(deck) + 1.2, s, BALCONY_DEPTH, 1.5, 2.1, deck)
      );
    // The ends of decks 7–10 and deck 11: cabin windows.
    for (const deck of CONCORDIA_BALCONY_DECKS) {
      row(AFT_END[deck] + 1.5, BALCONY[0] - 1, 2.8, 0, 13 + k, (x) =>
        sideLight(x, Z(deck) + 1.45, s, 0, 1.4, 1.3, deck)
      );
      row(BALCONY[1] + 1.5, FWD_END[deck] - 6, 2.8, 0, 15 + k, (x) =>
        sideLight(x, Z(deck) + 1.45, s, 0, 1.4, 1.3, deck)
      );
    }
    row(-112, DECK11_FWD - 10, 2.4, 0.08, 17 + k, (x) =>
      sideLight(x, Z("11") + 1.45, s, 0, 1.8, 1.4, "11")
    );
    // The spa: big windows, two decks.
    for (const deck of ["12", "13"])
      row(SPA[0] + 3, SPA[1] - 18, 3, 0, 19 + k, (x) =>
        sideLight(x, Z(deck) + 1.4, s, 1.5, 2.6, 2.2, deck)
      );
  }
  // Her stern's terraces and restaurant: windows across their after faces.
  for (const [deck, x0] of [
    ["3", stern + 1.2],
    ["4", stern + 2],
    ["5", stern + 2],
    ["6", stern + 3],
    ["7", AFT_END["7"]],
    ["8", AFT_END["8"]],
    ["9", AFT_END["9"]],
    ["10", AFT_END["10"]],
  ] as const) {
    const w = edge(x0) - 1.5;
    for (let y = -w + 1.2; y <= w - 1.2; y += 2.6)
      push([x0, y, Z(deck) + 1.5], [-1, 0, 0], 2.0, 1.8, deck);
  }
  // The stepped front: decks 6–10 and the bridge's wide windows.
  for (const [deck, x1] of [
    ["6", DECK6_FWD],
    ["7", FWD_END["7"]],
    ["9", FWD_END["9"]],
    ["10", FWD_END["10"]],
  ] as const)
    frontLights(
      x1,
      10,
      edge(x1 - 10) - 0.2,
      Z(deck) + 1.45,
      9,
      [1.6, 1.3],
      deck
    );
  // The bridge: a band of big windows round its front.
  frontLights(
    FWD_END["8"],
    10,
    edge(FWD_END["8"] - 10) - 0.2,
    Z("8") + 1.6,
    16,
    [2.1, 1.8],
    "8"
  );
  frontLights(
    DECK11_FWD,
    10,
    edge(DECK11_FWD - 10) - 0.2,
    Z("11") + 1.45,
    9,
    [1.8, 1.4],
    "11"
  );
  // The spa's big curved front windows over the bridge.
  for (const deck of ["12", "13"])
    frontLights(
      SPA[1],
      14,
      edge(SPA[1] - 14) - 1.7,
      Z(deck) + 1.4,
      11,
      [2.6, 2.2],
      deck
    );
  // Her emergency lights after the blackout (R7): a sparse fixed pattern,
  // the stair towers and corridors' ends (the scene reads it).
  lights.forEach((l, i) => {
    if (hash01(i, 7012) < 0.07) l.emergency = true;
  });

  // -------------------------------------------------------------------------
  // Painted boxes: the balconies' glass fronts and partitions, the bridge
  // wings, the radar mast's platforms and scanners, the slide's tower, the
  // pools, the glass roof over the aft pool either side of the funnel, the
  // propeller shafts' struts.
  const boxes: BoxPart[] = [];
  for (const deck of CONCORDIA_BALCONY_DECKS) {
    const z = Z(deck);
    for (const s of sides) {
      // The glass fronts follow her side in 12 m runs.
      const runs = 16;
      const len = (BALCONY[1] - BALCONY[0]) / runs;
      for (let i = 0; i < runs; i += 1) {
        const xa = BALCONY[0] + i * len;
        const xb = xa + len;
        const ya = edge(xa) - 0.08;
        const yb = edge(xb) - 0.08;
        boxes.push({
          c: [(xa + xb) / 2, (s * (ya + yb)) / 2, z + 0.55],
          size: [Math.hypot(len, yb - ya), 0.08, 1.1],
          color: GLASS_BLUE,
          yaw: s * Math.atan2(yb - ya, len),
        });
      }
      // White partitions between the balconies.
      for (let x = BALCONY[0] + 3.6; x < BALCONY[1] - 0.5; x += 3.6)
        boxes.push({
          c: [x, s * (edge(x) - BALCONY_DEPTH / 2), z + 1.25],
          size: [0.14, BALCONY_DEPTH, 2.5],
          color: WHITE,
        });
    }
  }
  {
    // The bridge wings on deck 8, out to her full beam over her sides
    // (the bow photographs), a cab at each end.
    const x = FWD_END["8"] - 6;
    const inner = edge(x) - 3;
    const outer = spec.beam / 2 + 0.3;
    for (const s of sides)
      boxes.push({
        c: [x, (s * (inner + outer)) / 2, Z("8") + 1.4],
        size: [4.2, outer - inner, TIER],
        color: WHITE,
      });
  }
  {
    // The radar mast: its legs, platforms and scanners.
    const z0 = Z("14") + 0.35;
    for (const s of sides)
      boxes.push({
        c: [mastX, s * 1.6, z0 + 5.5],
        size: [0.35, 0.35, 11],
        color: WHITE,
      });
    for (const [z, w] of [
      [z0 + 5, 6],
      [z0 + 10.5, 4.5],
    ] as const) {
      boxes.push({ c: [mastX, 0, z], size: [2.6, w, 0.3], color: WHITE });
      boxes.push({
        c: [mastX + 0.6, 0, z + 0.7],
        size: [0.45, w + 1.2, 0.35],
        color: 0x2a2b2e,
      });
    }
  }
  // The water slide's tower.
  const slideC: [number, number] = [42, -8];
  boxes.push({
    c: [slideC[0], slideC[1], Z("13") + 4.2],
    size: [2.2, 2.2, 8.4],
    color: WHITE,
  });
  // Pools: the aft one in the open, one forward by the slide.
  boxes.push({ c: [-86, 0, Z("13") + 0.06], size: [10, 7, 0.12], color: POOL });
  boxes.push({ c: [50, 5, Z("13") + 0.06], size: [8, 6, 0.12], color: POOL });

  // -------------------------------------------------------------------------
  // The water slide: yellow, coiling down from its tower (README).
  const slidePts: V3[] = [];
  const turns = 2.25;
  const n = 36;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const a = t * turns * Math.PI * 2;
    slidePts.push([
      slideC[0] + 3.4 * Math.cos(a),
      slideC[1] + 3.4 * Math.sin(a),
      Z("13") + 8.2 - 7.4 * t,
    ]);
  }
  slidePts.push([slideC[0] - 6, slideC[1] + 3, Z("13") + 0.6]);

  // White radar domes (the photographs): two forward, two aft, one on the
  // spa.
  const radomes = [
    { p: [-75, 6, Z("13") + 2.4] as V3, r: 2.2 },
    { p: [-22, 0, Z("13") + 2.4] as V3, r: 2.2 },
    { p: [50, -6, Z("13") + 2.4] as V3, r: 2.0 },
    { p: [64, 6, Z("14") + 2.2] as V3, r: 2.0 },
    { p: [72, -5, Z("14") + 0.35 + 2.4] as V3, r: 2.2 },
  ];

  // -------------------------------------------------------------------------
  // Rails: deck 4's promenade under the boats, the open decks on top, the
  // terraces aft.
  const rails: RailRun[] = [];
  function edgeRun(
    x0: number,
    x1: number,
    z: number,
    hw: (x: number) => number
  ): void {
    for (const s of sides) {
      const pts: V3[] = [];
      const count = Math.max(2, Math.ceil((x1 - x0) / 1.6));
      for (let i = 0; i <= count; i += 1) {
        const x = x0 + ((x1 - x0) * i) / count;
        pts.push([x, s * hw(x), z]);
      }
      rails.push({ points: pts });
    }
  }
  function acrossRun(x: number, z: number, halfWidth: number): void {
    const pts: V3[] = [];
    const count = Math.ceil((2 * halfWidth) / 1.6);
    for (let i = 0; i <= count; i += 1)
      pts.push([x, -halfWidth + (2 * halfWidth * i) / count, z]);
    rails.push({ points: pts });
  }
  edgeRun(RECESS[0] + 0.3, RECESS[1] - 0.3, Z("4"), (x) => edge(x) - 0.1);
  edgeRun(-96.8, -2, Z("13"), () => 15.4);
  edgeRun(34, 58, Z("13"), () => 15.4);
  acrossRun(-96.8, Z("13"), 15.3);
  edgeRun(-114.8, -97, Z("12"), (x) => edge(x) - 0.1);
  acrossRun(-114.8, Z("12"), edge(-114.8) - 0.1);
  edgeRun(SPA[0] + 0.7, SPA[1] - 16, Z("14") + 0.35, (x) => edge(x) - 4.1);
  edgeRun(DECK6_FWD - 4, stem - 3, Z("5"), (x) => Math.max(0.3, edge(x) - 0.1));

  // -------------------------------------------------------------------------
  // Under water: two propellers on open shafts with their struts, two
  // rudders behind them, the thruster tunnels.
  // Her screws are about 5.4 m across (a 21 MW motor's fixed-pitch screw:
  // assumed, README), as far aft as her run leaves room over them, on open
  // shafts with an A-bracket just ahead of each and a strut further
  // forward; each rudder right behind its screw, about as tall as it, from
  // the hull down to the screw's lower third.
  const hubX = -123;
  const hubY = 7.2;
  const hubZ = 2.95;
  const propR = 2.7;
  const propellers: Propeller[] = [
    { hub: [hubX, hubY, hubZ], radius: propR, blades: 5, phase: 0.3 },
    { hub: [hubX, -hubY, hubZ], radius: propR, blades: 5, phase: 0.9 },
  ];
  function shaft(y: number) {
    const r0 = 0.8;
    const inside = (x: number) =>
      [0, 0.7, -0.7].every(
        (k) =>
          hull.halfBreadth(x, hubZ + k * r0) >=
          Math.abs(y) + r0 * Math.sqrt(1 - k * k) + 0.2
      );
    let x = hubX + 0.6;
    while (!inside(x) && x < 0) x += 0.5;
    return {
      from: [x, y, hubZ] as V3,
      to: [hubX + 0.6, y, hubZ] as V3,
      r0,
      r1: 0.62,
    };
  }
  const bossings = [hubY, -hubY].map(shaft);
  for (const s of sides) {
    // The A-bracket: two legs from the shaft up and out to the hull.
    const ax = hubX + 3.2;
    const top = hull.zBottom(ax) + 0.5;
    const h = top - hubZ;
    for (const out of [-2.2, 2.2]) {
      const len = Math.hypot(out, h);
      boxes.push({
        c: [ax, s * hubY + out / 2, (hubZ + top) / 2],
        size: [len, 0.9, 0.35],
        color: ANTIFOULING,
        yaw: (Math.sign(out) * Math.PI) / 2,
        pitch: Math.atan2(h, Math.abs(out)),
      });
    }
    // A strut further forward.
    const fx = hubX + 13;
    const ftop = hull.zBottom(fx) + 0.5;
    boxes.push({
      c: [fx, s * hubY, (hubZ + ftop) / 2],
      size: [0.9, 0.35, ftop - hubZ],
      color: ANTIFOULING,
    });
  }
  const lead = hubX - 2.3;
  const chord = 4.2;
  const trail = lead - chord;
  const rudderTop = hull.zBottom(lead - chord / 2) + 0.6;
  const rudderFoot = hubZ - propR * 0.55;
  const rudder: ShipRecipe["rudder"] = {
    outline: [
      [lead, rudderFoot + 0.5],
      [lead - 0.6, rudderFoot],
      [trail + 0.7, rudderFoot],
      [trail, rudderFoot + 0.7],
      [trail, rudderTop - 0.4],
      [lead, rudderTop],
    ],
    thickness: 0.8,
    taper: { lead: 0.8, trail: 0.2 },
    centre: [lead - chord / 2, 0, (rudderFoot + rudderTop) / 2],
    stock: { x: lead - 0.9, z0: rudderTop - 1.5, z1: rudderTop + 0.5, r: 0.38 },
    ys: [hubY, -hubY],
  };
  const thrusters = [
    { x: 112, z: 4.2, r: 1.15 },
    { x: 116.5, z: 4.2, r: 1.15 },
    { x: 121, z: 4.2, r: 1.15 },
    { x: -112, z: 5.7, r: 1.0 },
    { x: -115.5, z: 5.7, r: 1.0 },
  ];

  const anchorX = stem - 14;
  const anchors = (["port", "starboard"] as const).map((side) => {
    const s = side === "port" ? 1 : -1;
    const z = 15.5;
    return {
      p: [anchorX, s * hull.halfBreadth(anchorX, z), z] as V3,
      side,
      stockless: { size: 3.2 },
    };
  });

  // Her name on both bows, along both sides over the boats, and across the
  // stern over "GENOVA" (the photographs).
  const names: NameBoard[] = [
    ...(["port", "starboard"] as const).flatMap((side) => [
      {
        where: "bow" as const,
        x: bowNameX,
        z: 17.6,
        side,
        width: 15,
        height: 1.3,
      },
      {
        where: "bow" as const,
        x: nameX,
        z: Z("6") + 1.45,
        side,
        width: 26,
        height: 2.0,
      },
    ]),
    {
      where: "stern" as const,
      x: stern,
      z: 16.6,
      side: "aft" as const,
      width: 15,
      height: 1.8,
      rows: 3,
    },
  ];

  // The rock from Le Scole stuck in her port side at frame 52 (R21; the
  // well-known photograph), never before the gash reached it (7 s after
  // the strike: `concordia.ts`); the scene waits on until Le Scole's tip
  // is there along her side (`rockLodgedT`, giglio.ts).
  const rockX = spec.heel?.rock?.x ?? -86;
  const rockZ = 4;
  const rock = {
    p: [rockX, hull.halfBreadth(rockX, rockZ) + 0.6, rockZ] as V3,
    r: 2.05,
    fromT: 7,
    // Frames 52–60: the after end of the gash, where it stuck.
    compartmentId: "wtc4",
  };

  const jack: V3 = [stem - 2.5, 0, Z("5")];
  const ensign: V3 = [stern + 3.5, 0, Z("7")];
  const staffs = [
    { foot: jack, top: [jack[0] + 0.3, 0, jack[2] + 6] as V3 },
    { foot: ensign, top: [ensign[0] - 0.5, 0, ensign[2] + 7] as V3 },
  ];

  return {
    spec,
    hull,
    layout,
    deckIndex,
    deckZ,
    houses: [],
    // The glass roof over the main pool (a retractable "magrodome" [WPC]).
    domes: [{ x: 16, z: Z("13"), a: 17.5, b: 13, c: 3.6 }],
    funnels,
    masts,
    boats,
    davits,
    lights,
    vents: [],
    benches: [],
    bollards: [],
    capstans: [],
    cranes: [],
    hatches: [],
    rails,
    wires: [],
    funnelGuys: funnels.map(() => []),
    propellers,
    rudder,
    bossings,
    anchors,
    names,
    paint,
    blocks,
    boxes,
    drums: [],
    ledgeDecks: ["1", "0", "A", "B", "C"],
    staffs,
    slides: [{ points: slidePts, r: 0.55, color: SLIDE }],
    radomes,
    canisters,
    thrusters,
    // Her bulbous bow (the bow-on photographs show it red under the
    // water): drawn only; her data's stem has none.
    bulb: { x: 128.5, z: 4.2, a: 7.5, b: 2.4, c: 2.9 },
    rock,
  };
}
