import {
  BALLROOM,
  POSEIDON_BOATS,
  poseidonBox,
} from "@/lib/shipwreck/ships/poseidon";
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
  glassDome,
  liferaftRacks,
  lowerTiers,
  nameBoards,
  radarMast,
  radarMastBoxes,
  railKit,
  rakedFunnel,
  recessBoats,
  staffs as staffPair,
  twinScrews,
} from "./cruiseKit";
import {
  normalize,
  type Block,
  type BoxPart,
  type ShipLayout,
  type ShipPaint,
  type ShipRecipe,
  type V3,
} from "./titanicRecipe";

/**
 * The Poseidon's details: a made-up modern cruise ship of our own design
 * (README, "The Poseidon": her look notes, each feature checked against
 * photographs of real cruise ships of 2000–2010 [CR]/[WC], never the
 * film's art). Built from the cruise kit (`cruiseKit.ts`) on her data
 * (`poseidon.ts`): her hull, decks, superstructure boxes, funnel and boats.
 * Her own silhouette: longer and sleeker than the Concordia, a deep stepped
 * front with the bridge on deck 9, balconies decks 7–11, the boat recess on
 * deck 4, one tall raked, tapering funnel aft with a fin across its top,
 * and on top amidships the ballroom: a round drum of tall windows under a
 * ribbed glass dome.
 *
 * Ship frame: metres, x forward, y to port, z up from the keel. Her decks
 * are "14" down to "0"; her hull's top is deck 1.
 */

/** Her balcony decks (README). */
export const POSEIDON_BALCONY_DECKS = ["7", "8", "9", "10", "11"] as const;

// Paint (sRGB), all ours (R6).
const WHITE = 0xf4f4f0;
const SHADE = 0xdbdbd5;
const RECESS_SHADE = 0xb6b6b0;
const DECK_TOP = 0xd4d3cc;
/** Her balconies' glass: a sea-green blue. */
const GLASS_BALCONY = 0x355f7c;
/** The ballroom's glass, and the drum's piers and the dome's ribs. */
const GLASS_DOME = 0x5f8299;
const DOME_RIB = 0xe8e8e2;
const POOL = 0x3e8fb8;
const ANTIFOULING = 0x6e2620;
const DEEP_BLUE = 0x1c3f73;
/** The sea-blue line along her hull's top. */
const SEA_BLUE = 0x1f5f94;
const GOLD = 0xc9a03a;

/** Her one real paint (`poseidon`, ours: R6). */
export const POSEIDON_PAINT: ShipPaint = {
  funnel: 0xf4f4f0,
  funnelTop: DEEP_BLUE,
  sheerLine: SEA_BLUE,
  name: "POSEIDON",
  // No port of registry: she is made up.
  port: "",
  letters: { bow: DEEP_BLUE, stern: DEEP_BLUE, font: "sans" },
  mast: WHITE,
  hull: {
    topsides: 0xf1f1ec,
    bottom: ANTIFOULING,
    boot: DEEP_BLUE,
    relief: 0.25,
  },
  boat: { hull: 0xe8801f, bottom: 0xf1efe8, cover: 0xe8801f },
  fittings: WHITE,
  vent: WHITE,
};

/** Her gold wave stripe (her real paint only). */
export const POSEIDON_WAVE_GOLD = GOLD;

/** A tier's height (her deck step, `poseidon.ts`). */
const TIER = 2.8;
const RECESS_INSET = 4.8;
const BALCONY_DEPTH = 1.8;
/** The balcony zone and the boat recess (ours). */
const BALCONY: [number, number] = [-110, 90];
const RECESS: [number, number] = [-104, 104];
/** 150-person lifeboats, as the Concordia's. */
const BOAT = { length: 10.8, beam: 3.9, depth: 2.0 };
/** The bow's plating and the lower tiers' forward end: her boxes' end. */
const BOW_X = 128;
/** Each balcony tier's after end (the terraces) and forward end (the
 *  stepped front, the bridge on deck 9). */
const AFT_END: Record<string, number> = {
  "7": -136,
  "8": -134,
  "9": -131,
  "10": -127,
  "11": -122,
};
const FWD_END: Record<string, number> = {
  "7": 118,
  "8": 116,
  "9": 114,
  "10": 109,
  "11": 103,
};
/** The ballroom's dome rises about 9 m over deck 14 (`poseidon.ts`). */
const DOME_H = 9;

export function poseidonRecipe(
  spec: ShipSpec,
  // One real paint (her fun paints are painted over it by `recipeFor`).
  _livery: string = "poseidon"
): ShipRecipe {
  void _livery;
  const frame = cruiseFrame(spec);
  const { hull, deckIndex, deckZ, Z, edge } = frame;
  const paint = POSEIDON_PAINT;
  const stern = hull.xMin;
  const stem = hull.xMax;
  const funnelX = spec.funnels[0].x;
  const topAft = poseidonBox("top-aft");
  const topHW = topAft.halfBreadthM ?? 14;

  const layout: ShipLayout = {
    sternX: stern,
    stemX: stem,
    forecastleFrom: BOW_X,
    poopTo: stern,
    bridgeDeckFrom: AFT_END["9"],
    bridgeDeckTo: FWD_END["9"],
    boatDeckFrom: RECESS[0],
    boatDeckTo: RECESS[1],
    promenadeEnclosedFrom: RECESS[1],
    aHouseInset: RECESS_INSET,
    // The red to just under her 8.4 m waterline, the blue boot-top across.
    loadWaterline: 7.9,
    bootTop: 1.4,
  };

  // -------------------------------------------------------------------------
  // Tiers: decks 1–3 flush with her side, the bow's plating to deck 3 with
  // the mooring deck on it, decks 4–5 set in over the boats, deck 6 flush
  // over them; decks 7–11 with balconies, each ending shorter aft (the
  // terraces) and forward (the stepped front), the open deck 12 over them;
  // the pool deck's house aft (decks 12–13, the sun deck on it).
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
      base: { deck: "1", x0: stern + 1.2, h: 3 * TIER },
      bowPlating: { x: BOW_X, h: 2 * TIER },
      foredeck: "3",
      recess: {
        deck: "4",
        span: RECESS,
        inset: RECESS_INSET,
        wall: RECESS_SHADE,
        aftX0: stern + 2,
        tiers: 2,
      },
      over: { deck: "6", x0: stern + 3, x1: BOW_X, roundFwd: 18 },
    }),
    ...balconyTiers({
      paint: tierPaint,
      decks: POSEIDON_BALCONY_DECKS,
      aftEnd: AFT_END,
      fwdEnd: FWD_END,
      span: BALCONY,
      depth: BALCONY_DEPTH,
      shade: SHADE,
      tier: TIER,
      bridgeDeck: "9",
      roundFwd: 18,
    }),
    // The open deck over the balconies (deck 12).
    flush("balcony-roof", "12", BALCONY[0], BALCONY[1], 0.3, {
      dz: -0.3,
      under: true,
      ends: false,
    }),
    // The pool deck's house aft round the funnel's foot, the sun deck on it.
    flush("deck-12-aft", "12", topAft.fromX, topAft.toX, 2 * TIER, {
      halfWidth: topHW,
      roof: "pine",
    }),
  ];

  // -------------------------------------------------------------------------
  // The funnel: one, tall, raked back 15°, tapering to 70 % at the top,
  // with a fin across its top; white under a deep blue top, the gold wave
  // round it in her real paint only.
  const funnels = rakedFunnel(spec, {
    semiA: 8,
    semiB: 4.4,
    rakeDeg: 15,
    taper: 0.7,
    blackTop: 4.2,
    wing: { span: 3.2, chord: 7, thick: 0.6 },
    wave: { z: 0.58, height: 1.0, amp: 0.55, color: GOLD },
  });

  // -------------------------------------------------------------------------
  // The ballroom: a round drum two decks tall (12–13) of tall windows under
  // a ribbed glass dome, inside her `ballroom` box.
  const ballX = (BALLROOM.fromX + BALLROOM.toX) / 2;
  const ballR =
    Math.min(BALLROOM.halfBreadthM, (BALLROOM.toX - BALLROOM.fromX) / 2) - 0.6;
  const ballroom = glassDome({
    x: ballX,
    z: BALLROOM.baseZ,
    radius: ballR,
    drumH: Z("14") - BALLROOM.baseZ - 0.5,
    domeH: DOME_H,
    rows: 6,
    cols: 24,
    glass: GLASS_DOME,
    rib: DOME_RIB,
    drum: WHITE,
  });

  // -------------------------------------------------------------------------
  // The radar mast over the bridge, on deck 12.
  const mastX = 96;
  const masts = [radarMast(mastX, Z("12"), Z("12") + 15)];

  // -------------------------------------------------------------------------
  // Boats: her data's 24, in the recess on deck 4.
  const boats = recessBoats(frame, POSEIDON_BOATS, { deck: "4", boat: BOAT });
  const davits = boatDavits(boats);
  const canisters = liferaftRacks(frame, {
    fromX: [94.5, -102],
    count: 4,
    z: Z("4"),
  });

  // -------------------------------------------------------------------------
  // Lights: every window a pane (a party night: all lit until lights-out).
  const panes = createPanes(frame, 2006);
  const { lights, push, sideLight, row, frontLights } = panes;
  const bowNameX = 140;
  for (const s of SIDES) {
    const k = s > 0 ? 0 : 1;
    // Cabin windows in her hull (deck 0) and decks 1–3: small and square.
    for (const [deck, id] of [
      ["0", 31],
      ["1", 33],
      ["2", 35],
      ["3", 37],
    ] as const)
      row(-138, 126, 3.0, 0.1, id + k, (x) => {
        if (deck !== "0" && x < -120) return;
        if (Math.abs(x - bowNameX) < 10) return;
        sideLight(x, Z(deck) + 1.4, s, 0, 0.75, 0.75, deck);
      });
    // Her restaurants aft, decks 1–3: big windows.
    for (const deck of ["1", "2", "3"])
      row(-144, -121, 3.2, 0, 39 + k, (x) =>
        sideLight(x, Z(deck) + 1.5, s, 0, 2.6, 1.8, deck)
      );
    // The promenade behind the boats, decks 4–5, and its ends.
    for (const deck of ["4", "5"]) {
      row(RECESS[0] + 2, RECESS[1] - 2, 4.0, 0, 41 + k, (x) =>
        sideLight(x, Z(deck) + 1.5, s, RECESS_INSET, 2.4, 1.6, deck)
      );
      row(stern + 4, RECESS[0] - 1.5, 3.2, 0, 43 + k, (x) =>
        sideLight(x, Z(deck) + 1.5, s, 0, 2.2, 1.6, deck)
      );
      row(RECESS[1] + 1.5, BOW_X - 3, 3.2, 0, 45 + k, (x) =>
        sideLight(x, Z(deck) + 1.5, s, 0, 2.2, 1.6, deck)
      );
    }
    // Deck 6 over the boats: windows in threes.
    row(-140, BOW_X - 8, 7.5, 0, 47 + k, (x) => {
      for (const dx of [-1.4, 0, 1.4])
        sideLight(x + dx, Z("6") + 1.45, s, 0, 1.0, 1.25, "6");
    });
    // Her balcony doors, decks 7–11, one a cabin.
    for (const deck of POSEIDON_BALCONY_DECKS)
      row(BALCONY[0] + 1.8, BALCONY[1] - 1.8, 3.6, 0, 49 + k, (x) =>
        sideLight(x, Z(deck) + 1.2, s, BALCONY_DEPTH, 1.5, 2.1, deck)
      );
    // The ends of decks 7–11: cabin windows.
    for (const deck of POSEIDON_BALCONY_DECKS) {
      row(AFT_END[deck] + 1.5, BALCONY[0] - 1, 2.8, 0, 51 + k, (x) =>
        sideLight(x, Z(deck) + 1.45, s, 0, 1.4, 1.3, deck)
      );
      row(BALCONY[1] + 1.5, FWD_END[deck] - 8, 2.8, 0, 53 + k, (x) =>
        sideLight(x, Z(deck) + 1.45, s, 0, 1.4, 1.3, deck)
      );
    }
    // The pool deck's house: big windows on decks 12 and 13, either side
    // of the funnel's foot.
    for (const deck of ["12", "13"])
      row(topAft.fromX + 2, topAft.toX - 2, 3.2, 0, 55 + k, (x) => {
        if (Math.abs(x - funnelX) < 10) return;
        push([x, s * topHW, Z(deck) + 1.4], [0, s, 0], 2.6, 1.9, deck);
      });
  }
  // Her stern's terraces: windows across their after faces.
  for (const [deck, x0] of [
    ["1", stern + 1.2],
    ["4", stern + 2],
    ["6", stern + 3],
    ["7", AFT_END["7"]],
    ["8", AFT_END["8"]],
    ["9", AFT_END["9"]],
    ["10", AFT_END["10"]],
    ["11", AFT_END["11"]],
  ] as const)
    panes.aftFace(x0, Z(deck), deck);
  // The stepped front, deck by deck, and the bridge's wide band.
  frontLights(
    BOW_X,
    18,
    edge(BOW_X - 18) - 0.2,
    Z("6") + 1.45,
    9,
    [1.6, 1.3],
    "6"
  );
  for (const deck of ["7", "8", "10", "11"] as const)
    frontLights(
      FWD_END[deck],
      18,
      edge(FWD_END[deck] - 18) - 0.2,
      Z(deck) + 1.45,
      11,
      [1.6, 1.3],
      deck
    );
  frontLights(
    FWD_END["9"],
    18,
    edge(FWD_END["9"] - 18) - 0.2,
    Z("9") + 1.6,
    18,
    [2.1, 1.8],
    "9"
  );
  // The ballroom: its drum's tall windows and the dome's panes, lit warm
  // from inside (the scene's pane material).
  {
    const b = ballroom;
    const top = b.z + b.drumH;
    const R = b.radius + 0.05;
    const w = ((2 * Math.PI * b.radius) / b.cols) * 0.72;
    for (let i = 0; i < b.cols; i += 1) {
      const t = (i / b.cols) * Math.PI * 2;
      const n: V3 = [Math.cos(t), Math.sin(t), 0];
      push(
        [b.x + R * n[0], R * n[1], (b.z + top) / 2],
        n,
        w,
        b.drumH - 1.0,
        "12"
      );
    }
    for (let r = 0; r < b.rows - 1; r += 1) {
      const el0 = (r / b.rows) * (Math.PI / 2);
      const el1 = ((r + 1) / b.rows) * (Math.PI / 2);
      const el = (el0 + el1) / 2;
      const ring = (2 * Math.PI * b.radius * Math.cos(el)) / b.cols;
      const tall = Math.hypot(
        b.radius * (Math.cos(el0) - Math.cos(el1)),
        b.domeH * (Math.sin(el1) - Math.sin(el0))
      );
      for (let i = 0; i < b.cols; i += 1) {
        const t = ((i + 0.5) / b.cols) * Math.PI * 2;
        const n = normalize([
          (Math.cos(el) * Math.cos(t)) / b.radius,
          (Math.cos(el) * Math.sin(t)) / b.radius,
          Math.sin(el) / b.domeH,
        ]);
        // On the shell's flat facet: the mean of its four corners.
        const t0 = (i / b.cols) * Math.PI * 2;
        const t1 = ((i + 1) / b.cols) * Math.PI * 2;
        const p: V3 = [0, 0, 0];
        for (const e of [el0, el1])
          for (const tt of [t0, t1]) {
            p[0] += (b.x + b.radius * Math.cos(e) * Math.cos(tt)) / 4;
            p[1] += (b.radius * Math.cos(e) * Math.sin(tt)) / 4;
            p[2] += (top + 0.5 + b.domeH * Math.sin(e)) / 4;
          }
        push(
          [p[0] + n[0] * 0.05, p[1] + n[1] * 0.05, p[2] + n[2] * 0.05],
          n,
          ring * 0.7,
          tall * 0.7,
          "14"
        );
      }
    }
  }
  // Her emergency lights after the blackout (R7): the kit's sparse mask.
  emergencyMask(lights, 0.07, 7006);

  // -------------------------------------------------------------------------
  // Painted boxes: the balconies' glass and partitions, the bridge wings,
  // the radar mast, the pool on the sun deck, the shafts' brackets.
  const boxes: BoxPart[] = [
    ...balconyFronts(frame, {
      decks: POSEIDON_BALCONY_DECKS,
      span: BALCONY,
      depth: BALCONY_DEPTH,
      runs: 16,
      pitch: 3.6,
      glass: GLASS_BALCONY,
      partition: WHITE,
    }),
    // The bridge wings on deck 9, out to her full beam.
    ...bridgeWings(frame, {
      x: FWD_END["9"] - 8,
      z: Z("9") + 1.4,
      inset: 3,
      length: 4.2,
      h: TIER,
      color: WHITE,
    }),
    ...radarMastBoxes(mastX, Z("12"), { white: WHITE, scanner: 0x2a2b2e }),
    // The pool on the sun deck aft of the funnel, and a smaller one.
    { c: [-98, 0, Z("14") + 0.06], size: [12, 8, 0.12], color: POOL },
    { c: [-40, 6, Z("14") + 0.06], size: [6, 4, 0.12], color: POOL },
  ];
  const radomes = [
    { p: [102, 5, Z("12") + 2.4] as V3, r: 2.0 },
    { p: [102, -5, Z("12") + 2.4] as V3, r: 2.0 },
    { p: [86, 0, Z("12") + 2.6] as V3, r: 2.2 },
  ];

  // -------------------------------------------------------------------------
  // Rails: the promenade under the boats, the open deck 12, the sun deck,
  // the mooring deck at the bow.
  const { rails, edgeRun, acrossRun } = railKit();
  edgeRun(RECESS[0] + 0.3, RECESS[1] - 0.3, Z("4"), (x) => edge(x) - 0.1);
  edgeRun(-120, 100, Z("12"), (x) => edge(x) - 0.1);
  edgeRun(topAft.fromX + 0.2, topAft.toX - 0.2, Z("14"), () => topHW - 0.1);
  acrossRun(topAft.fromX + 0.2, Z("14"), topHW - 0.1);
  edgeRun(BOW_X + 1, stem - 3, Z("3"), (x) => Math.max(0.3, edge(x) - 0.1));

  // -------------------------------------------------------------------------
  // Under water: two propellers on open shafts, A-brackets and struts, two
  // rudders (seen in the air keel up), the thruster tunnels. Her run lifts
  // to the transom: the screws as far aft as it leaves room over them.
  const { propellers, bossings, brackets, rudder } = twinScrews(hull, {
    hubX: -134,
    hubY: 7.5,
    hubZ: 3.1,
    radius: 2.8,
    blades: 5,
    phases: [0.3, 0.9],
    bracketColor: ANTIFOULING,
  });
  boxes.push(...brackets);
  const thrusters = [
    { x: 118, z: 4.2, r: 1.15 },
    { x: 122.5, z: 4.2, r: 1.15 },
    { x: 127, z: 4.2, r: 1.15 },
    { x: -116, z: 6.4, r: 1.0 },
    { x: -119.5, z: 6.4, r: 1.0 },
  ];
  const anchors = bowAnchors(hull, stem - 16, 15.0, 3.2);

  // "POSEIDON" on both bows and across her stern, our own lettering.
  const names = nameBoards({
    bow: { x: bowNameX, z: 15.9, width: 16, height: 1.6 },
    stern: { x: stern, z: 15.6, width: 16, height: 1.8, rows: 3 },
  });

  const jack: V3 = [stem - 2.5, 0, Z("3")];
  const ensign: V3 = [stern + 3.5, 0, Z("7")];
  const staffs = staffPair(jack, ensign);

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
    ledgeDecks: ["0"],
    staffs,
    radomes,
    canisters,
    thrusters,
    ballrooms: [ballroom],
  };
}
