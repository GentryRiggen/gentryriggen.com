import { CONCORDIA_BOATS } from "@/lib/shipwreck/ships/concordia";
import {
  CONCORDIA_AFT_GLASS,
  CONCORDIA_BOAT,
  CONCORDIA_CASING,
  CONCORDIA_DECK11_AFT,
  CONCORDIA_FUNNEL_OVAL,
  CONCORDIA_LIDO_AFT,
  CONCORDIA_LIDO_FWD,
  CONCORDIA_LIFERAFT_RACKS,
  CONCORDIA_MAST_X,
  CONCORDIA_POOL_GLASS,
  CONCORDIA_POOLS,
  CONCORDIA_RADOMES,
  CONCORDIA_RAILS,
  CONCORDIA_RECESS,
  CONCORDIA_RECESS_INSET,
  CONCORDIA_SLIDE,
  CONCORDIA_SPA,
  CONCORDIA_SPORTS_DECK,
} from "@/lib/shipwreck/ships/concordiaLayout";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import {
  SIDES,
  balconyFronts,
  balconyTiers,
  boatDavits,
  bowAnchors,
  bridgeWings,
  createPanes,
  cruiseFrame,
  emergencyMask,
  flushTier,
  liferaftRacks,
  lowerTiers,
  nameBoards,
  ovalFunnels,
  radarMast,
  radarMastBoxes,
  railKit,
  recessBoats,
  staffs as staffPair,
  twinScrews,
  waterSlide,
} from "./cruiseKit";
import {
  type Block,
  type BoxPart,
  type MastRecipe,
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
/** The boat recess's wall, in from her side (deepened in 1.17 so a
 *  promenade runs inboard of the boats: `ships/concordiaLayout.ts`). */
const RECESS_INSET = CONCORDIA_RECESS_INSET;
/** The balconies' depth (their back wall in from her side). */
const BALCONY_DEPTH = 1.8;
/** The balcony zone and the boat recess, fore and aft (README). */
const BALCONY: [number, number] = [-100, 96];
const RECESS = CONCORDIA_RECESS;
/** 150-person lifeboats, about 10.8 by 3.9 m (README). */
const BOAT = CONCORDIA_BOAT;
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
const SPA = CONCORDIA_SPA;

export function concordiaRecipe(
  spec: ShipSpec,
  // One real paint (her fun paints are painted over it by `recipeFor`).
  _livery: string = "costa-2012"
): ShipRecipe {
  void _livery;
  const frame = cruiseFrame(spec);
  const { hull, deckIndex, deckZ, Z, edge } = frame;
  const paint = CONCORDIA_PAINT;
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
  const tierPaint = { wall: WHITE, roof: DECK_TOP };
  const flush = (
    id: string,
    deck: string,
    x0: number,
    x1: number,
    h: number,
    extra: Partial<Block> = {}
  ): Block => flushTier(tierPaint, id, deck, x0, x1, h, extra);
  const blocks: Block[] = [
    ...lowerTiers({
      paint: tierPaint,
      stern,
      stem,
      tier: TIER,
      base: { deck: "3", x0: stern + 1.2, h: TIER },
      bowPlating: { x: BOW_PLATING_X, h: 2 * TIER },
      foredeck: "5",
      recess: {
        deck: "4",
        span: RECESS,
        inset: RECESS_INSET,
        wall: RECESS_SHADE,
        aftX0: stern + 2,
        tiers: 2,
      },
      over: { deck: "6", x0: stern + 3, x1: DECK6_FWD, roundFwd: 16 },
    }),
    ...balconyTiers({
      paint: tierPaint,
      decks: CONCORDIA_BALCONY_DECKS,
      aftEnd: AFT_END,
      fwdEnd: FWD_END,
      span: BALCONY,
      depth: BALCONY_DEPTH,
      shade: SHADE,
      tier: TIER,
      bridgeDeck: "8",
      roundFwd: 16,
    }),
  ];
  blocks.push(
    flush("deck-11", "11", CONCORDIA_DECK11_AFT, DECK11_FWD, TIER, {
      roundFwd: 16,
      under: true,
    }),
    // The top: her pool decks either side of the glass-roofed pool.
    flush(
      "deck-12-aft",
      "12",
      CONCORDIA_LIDO_AFT.x0,
      CONCORDIA_LIDO_AFT.x1,
      TIER,
      {
        halfWidth: CONCORDIA_LIDO_AFT.halfWidth,
        roof: "pine",
      }
    ),
    {
      id: "pool-glass",
      x0: CONCORDIA_POOL_GLASS.x0,
      x1: CONCORDIA_POOL_GLASS.x1,
      deck: "12",
      h: TIER,
      halfWidth: CONCORDIA_POOL_GLASS.halfWidth,
      wall: "white",
      wallColor: GLASS_DARK,
      roof: "paint",
      roofColor: GLASS_DARK,
    },
    flush(
      "deck-12-fwd",
      "12",
      CONCORDIA_LIDO_FWD.x0,
      CONCORDIA_LIDO_FWD.x1,
      TIER,
      { halfWidth: CONCORDIA_LIDO_FWD.halfWidth, roof: "pine" }
    ),
    // The spa, two decks over the bridge, its front rounded.
    flush("spa", "12", SPA[0], SPA[1], 2 * TIER, { inset: 1.5, roundFwd: 16 }),
    flush(
      "sports-deck",
      "14",
      CONCORDIA_SPORTS_DECK.x0,
      CONCORDIA_SPORTS_DECK.x1,
      CONCORDIA_SPORTS_DECK.h,
      {
        inset: CONCORDIA_SPORTS_DECK.inset,
        roofColor: COURT,
        roundFwd: 6,
      }
    ),
    // The aft pool's glass house, fore and aft of the funnel: low glass
    // walls under a glass vault.
    ...CONCORDIA_AFT_GLASS.spans.map(([a, b], i): Block => ({
      id: `aft-pool-glass-${i}`,
      x0: funnelX + a,
      x1: funnelX + b,
      deck: "13",
      h: CONCORDIA_AFT_GLASS.h,
      halfWidth: CONCORDIA_AFT_GLASS.halfWidth,
      wall: "white",
      wallColor: GLASS_SIDE,
      // A glass vault catching the sky.
      roof: "paint",
      roofColor: GLASS_ROOF,
      camber: 1.6,
    })),
    flush(
      "funnel-casing",
      "13",
      funnelX - CONCORDIA_CASING.halfLength,
      funnelX + CONCORDIA_CASING.halfLength,
      CONCORDIA_CASING.h,
      { halfWidth: CONCORDIA_CASING.halfWidth }
    )
  );

  // -------------------------------------------------------------------------
  // The funnel: one, an upright oval about 15 m long and 9 m wide (the
  // scale model, the bow-on photographs), Costa yellow with a black top,
  // the blue "C" on both sides (her real paint only).
  const funnels = ovalFunnels(spec, {
    semiA: CONCORDIA_FUNNEL_OVAL.semiA,
    semiB: CONCORDIA_FUNNEL_OVAL.semiB,
    // The black top: about 30 % of what shows (the scale model).
    blackTop: 5.8,
    // Midway up the yellow, 2.8 m to the middle of its stroke (the scale
    // model: the C half as tall as the yellow).
    emblem: { atZ: 54.4, r: 2.8, star: paint.funnel, letter: 0x1d4596 },
  });

  // -------------------------------------------------------------------------
  // The radar mast on the sports deck over the spa (the photographs: a
  // white lattice mast with its scanners and yards).
  const mastX = CONCORDIA_MAST_X;
  const masts: MastRecipe[] = [radarMast(mastX, Z("14") + 0.35, 68)];

  // -------------------------------------------------------------------------
  // Boats: her data's 26, in the recess on deck 4 at her side, each in a
  // pair of davits.
  const boats = recessBoats(frame, CONCORDIA_BOATS, { deck: "4", boat: BOAT });
  const davits = boatDavits(boats);
  // Liferaft canisters in two racks at each end of the boat rows.
  const canisters = liferaftRacks(frame, {
    fromX: CONCORDIA_LIFERAFT_RACKS.fromX,
    count: CONCORDIA_LIFERAFT_RACKS.count,
    z: Z("4"),
  });

  // -------------------------------------------------------------------------
  // Lights: every window a pane that lights at night.
  const panes = createPanes(frame, 2012);
  const { lights, sideLight, row, frontLights } = panes;
  const nameX = 60;
  const bowNameX = 126;
  for (const s of SIDES) {
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
    panes.aftFace(x0, Z(deck), deck);
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
  emergencyMask(lights);

  // -------------------------------------------------------------------------
  // Painted boxes: the balconies' glass fronts and partitions, the bridge
  // wings, the radar mast's platforms and scanners, the slide's tower, the
  // pools, the glass roof over the aft pool either side of the funnel, the
  // propeller shafts' struts.
  const boxes: BoxPart[] = [
    ...balconyFronts(frame, {
      decks: CONCORDIA_BALCONY_DECKS,
      span: BALCONY,
      depth: BALCONY_DEPTH,
      runs: 16,
      pitch: 3.6,
      glass: GLASS_BLUE,
      partition: WHITE,
    }),
    // The bridge wings on deck 8, out to her full beam over her sides
    // (the bow photographs), a cab at each end.
    ...bridgeWings(frame, {
      x: FWD_END["8"] - 6,
      z: Z("8") + 1.4,
      inset: 3,
      length: 4.2,
      h: TIER,
      color: WHITE,
    }),
    // The radar mast: its legs, platforms and scanners.
    ...radarMastBoxes(mastX, Z("14") + 0.35, {
      white: WHITE,
      scanner: 0x2a2b2e,
    }),
  ];
  // The water slide's tower.
  const slideC = CONCORDIA_SLIDE.c;
  boxes.push({
    c: [slideC[0], slideC[1], Z("13") + CONCORDIA_SLIDE.h / 2],
    size: [CONCORDIA_SLIDE.size, CONCORDIA_SLIDE.size, CONCORDIA_SLIDE.h],
    color: WHITE,
  });
  // Pools: the aft one in the open, one forward by the slide.
  for (const p of CONCORDIA_POOLS)
    boxes.push({
      c: [p.c[0], p.c[1], Z("13") + 0.06],
      size: [p.size[0], p.size[1], 0.12],
      color: POOL,
    });

  // -------------------------------------------------------------------------
  // The water slide: yellow, coiling down from its tower (README).
  const slidePts = waterSlide(slideC, Z("13"));

  // White radar domes (the photographs): two forward, two aft, one on the
  // spa.
  const radomes = CONCORDIA_RADOMES.map((d) => ({
    p: [d.x, d.y, Z(d.deck) + d.dz] as V3,
    r: d.r,
  }));

  // -------------------------------------------------------------------------
  // Rails: deck 4's promenade under the boats, the open decks on top, the
  // terraces aft.
  const { rails, edgeRun, acrossRun } = railKit();
  edgeRun(RECESS[0] + 0.3, RECESS[1] - 0.3, Z("4"), (x) => edge(x) - 0.1);
  const R = CONCORDIA_RAILS;
  edgeRun(R.lidoAftX, CONCORDIA_LIDO_AFT.x1, Z("13"), () => R.lidoHalfWidth);
  edgeRun(
    CONCORDIA_LIDO_FWD.x0,
    CONCORDIA_LIDO_FWD.x1,
    Z("13"),
    () => R.lidoHalfWidth
  );
  acrossRun(R.lidoAftX, Z("13"), 15.3);
  edgeRun(R.terraceAftX, CONCORDIA_LIDO_AFT.x0, Z("12"), (x) => edge(x) - 0.1);
  acrossRun(R.terraceAftX, Z("12"), edge(R.terraceAftX) - 0.1);
  edgeRun(
    R.sportsX[0],
    R.sportsX[1],
    Z("14") + CONCORDIA_SPORTS_DECK.h,
    (x) => edge(x) - R.sportsInset
  );
  edgeRun(DECK6_FWD - 4, stem - 3, Z("5"), (x) => Math.max(0.3, edge(x) - 0.1));

  // -------------------------------------------------------------------------
  // Under water: two propellers on open shafts with their struts, two
  // rudders behind them, the thruster tunnels.
  // Her screws are about 5.4 m across (a 21 MW motor's fixed-pitch screw:
  // assumed, README), as far aft as her run leaves room over them, on open
  // shafts with an A-bracket just ahead of each and a strut further
  // forward; each rudder right behind its screw, about as tall as it, from
  // the hull down to the screw's lower third.
  const { propellers, bossings, brackets, rudder } = twinScrews(hull, {
    hubX: -123,
    hubY: 7.2,
    hubZ: 2.95,
    radius: 2.7,
    blades: 5,
    phases: [0.3, 0.9],
    bracketColor: ANTIFOULING,
  });
  boxes.push(...brackets);
  const thrusters = [
    { x: 112, z: 4.2, r: 1.15 },
    { x: 116.5, z: 4.2, r: 1.15 },
    { x: 121, z: 4.2, r: 1.15 },
    { x: -112, z: 5.7, r: 1.0 },
    { x: -115.5, z: 5.7, r: 1.0 },
  ];

  const anchorX = stem - 14;
  const anchors = bowAnchors(hull, anchorX, 15.5, 3.2);

  // Her name on both bows, along both sides over the boats, and across the
  // stern over "GENOVA" (the photographs).
  const names = nameBoards({
    bow: { x: bowNameX, z: 17.6, width: 15, height: 1.3 },
    side: { x: nameX, z: Z("6") + 1.45, width: 26, height: 2.0 },
    stern: { x: stern, z: 16.6, width: 15, height: 1.8, rows: 3 },
  });

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
  const staffs = staffPair(jack, ensign);

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
