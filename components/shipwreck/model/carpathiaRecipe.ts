import {
  CARPATHIA_AFTER_DECK,
  CARPATHIA_BOAT_DECK,
  CARPATHIA_BOAT_PLATFORM,
  CARPATHIA_BOATS,
  CARPATHIA_BRIDGE_DECK,
  CARPATHIA_BRIDGE_HOUSE,
  CARPATHIA_FUNNEL_PAINTS,
  CARPATHIA_MASTS,
  CARPATHIA_STERN_HOUSE,
  CARPATHIA_WELLS,
} from "@/lib/shipwreck/ships/carpathia";
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
  type Hatch,
  type House,
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
 * RMS Carpathia's details as on 17 July 1918, from her photographs (1903–
 * 1914) and her data (README, "The Carpathia"): the forecastle, the
 * forward well with the foremast, the 290 ft bridge deck house with the
 * bridge deck promenade and the boat deck on it, one tall funnel, and the
 * open after deck (no raised poop, R21) with the jigger, a boat platform
 * on stanchions and the stern deckhouse with its gun. Pure data and
 * placement maths, like `titanicRecipe.ts`; `buildShip.ts` turns it into
 * geometry.
 *
 * Ship frame: metres, x forward, y to port, z up from the keel at
 * midships. Her decks (`spec.decks`): Boat, Bridge (with the Forecastle
 * at the same height), Upper (the top of the hull, the well and the
 * after deck), Main, Lower, Fourth, Orlop, Tank top.
 *
 * The house ends, wells, masts, funnel and boats stand where her data puts
 * them (`CARPATHIA_*` in lib/shipwreck/ships/carpathia.ts), so the model
 * moves with the data; the rest is measured off the photographs.
 */

/**
 * Her paint: 1918 dazzle (her default livery, `dazzle-1918`), plain battle
 * grey (`grey-1918`, a recipe option the game does not offer), or 1912
 * Cunard (`cunard-1912`). Paint only: her shape is the 1918 ship's in
 * every livery (davits swung out, the stern gun), so a livery is switched
 * live without rebuilding her (README, "Liveries").
 */
export type CarpathiaPaint = "dazzle" | "grey" | "cunard";

/** Her livery ids and the paint each is. */
export const CARPATHIA_LIVERY_PAINT: Readonly<Record<string, CarpathiaPaint>> =
  {
    "dazzle-1918": "dazzle",
    "grey-1918": "grey",
    "cunard-1912": "cunard",
  };

const FT = 0.3048;
const TO_RAD = Math.PI / 180;

// Paint (sRGB). Sources: README.
const WHITE = 0xe8e4d8;
/** 1918 battle grey (the funnel's, from her data). */
const GREY = CARPATHIA_FUNNEL_PAINTS.grey.funnel;
/** A lighter grey for war-painted fittings and rails. */
const LIGHT_GREY = 0x9a9fa5;
/** Cunard's masts and derricks: buff (the 1912 colour postcard). */
const BUFF = 0xa9835a;
/** Wartime antifouling, dark red-brown (an assumption, README). */
const WAR_BOTTOM = 0x4a2a24;
/**
 * The war paint's boot-top: dark grey along the waterline, the dazzle
 * down to it (the usual finish of 1918 dazzle ships, README).
 */
const WAR_BOOT = 0x2c2f33;
/** Dazzle walls: the texture's own colours (white multiplies to itself). */
const DAZZLE_WALL = 0xffffff;
const DAZZLE_SHADE = 0xd2d2d2;

const PAINTS: Record<CarpathiaPaint, ShipPaint> = {
  dazzle: {
    funnel: CARPATHIA_FUNNEL_PAINTS.dazzle.funnel,
    funnelTop: CARPATHIA_FUNNEL_PAINTS.dazzle.top,
    sheerLine: null,
    name: "CARPATHIA",
    mast: GREY,
    ventLining: 0x2a2b2d,
    hull: { topsides: GREY, bottom: WAR_BOTTOM, boot: WAR_BOOT },
    boat: { hull: LIGHT_GREY, bottom: GREY },
    dazzle: true,
    fittings: LIGHT_GREY,
    vent: GREY,
  },
  grey: {
    funnel: CARPATHIA_FUNNEL_PAINTS.grey.funnel,
    funnelTop: CARPATHIA_FUNNEL_PAINTS.grey.top,
    sheerLine: null,
    name: "CARPATHIA",
    mast: GREY,
    ventLining: 0x2a2b2d,
    hull: { topsides: GREY, bottom: WAR_BOTTOM, boot: WAR_BOOT },
    boat: { hull: LIGHT_GREY, bottom: GREY },
    fittings: LIGHT_GREY,
    vent: GREY,
  },
  cunard: {
    funnel: CARPATHIA_FUNNEL_PAINTS.cunard.funnel,
    funnelTop: CARPATHIA_FUNNEL_PAINTS.cunard.top,
    sheerLine: null,
    name: "CARPATHIA",
    mast: BUFF,
    ventLining: 0x5a241c,
  },
};

/**
 * Paint for a wall in this look (white, grey, or in the dazzle). Every
 * look draws the walls into the dazzle list (`dazzle: true`), so the
 * geometry is the same in each and the dazzle is a switch in its material.
 */
function wallPaint(
  paint: CarpathiaPaint,
  shade = false
): Pick<Block, "wallColor" | "dazzle"> {
  if (paint === "dazzle")
    return { wallColor: shade ? DAZZLE_SHADE : DAZZLE_WALL, dazzle: true };
  if (paint === "grey")
    return { wallColor: shade ? 0x6f747a : GREY, dazzle: true };
  return { dazzle: true };
}

/** The tier height (the data's deck step). */
const TIER = 2.6;
/** The bridge deck promenade's inner wall, in from the side. */
const PROM_INSET = 2.4;
/** The forward deckhouse on the bridge deck (feet aft of the stem head). */
const FWD_HOUSE_FT: [number, number] = [148, 192];
/** Its walls in from the side. */
const FWD_HOUSE_INSET = 2.2;
/** Her lifeboats: about 20 ft (README: the data's 6.5 m spacing). */
const BOAT = { length: 6.2, beam: 2.0, depth: 0.85 };

/**
 * Her 1912 funnel, measured off P1 (README): over the boat deck the black
 * top is about a fifth of the funnel, and three narrow black rings follow
 * it down at about a fifth of its height apart (39, 59 and 79 % of the way
 * down), as titanicinquiry's "3 narrow black rings".
 */
const FUNNEL_1912 = { blackTop: 4.2, bands: [0.21, 0.41, 0.61] };

export function carpathiaRecipe(
  spec: ShipSpec,
  livery: string = "dazzle-1918"
): ShipRecipe {
  const look: CarpathiaPaint = CARPATHIA_LIVERY_PAINT[livery] ?? "dazzle";
  // Her counter: a broad ellipse in plan above the sternpost (the
  // photographs); the offsets' run comes to a point up there.
  const hull = createHullSurface(spec, {
    fromX: -58,
    exponent: 2.5,
    zFrom: 9.5,
    zTo: 13,
  });
  const paint = PAINTS[look];
  const war = look !== "cunard";
  const deckByName = new Map(spec.decks.map((d, i) => [d.name, i]));
  const deckIndex = (name: string): number => {
    const i = deckByName.get(name);
    if (i === undefined) throw new Error(`no deck ${name}`);
    return i;
  };
  const deckZ = (name: string, x: number): number =>
    spec.decks[deckIndex(name)].z + (spec.sheerZ(x) - spec.depth);
  const edge = (x: number): number => hull.topHalfBreadth(x);
  const Up = (x: number) => deckZ("Upper", x);
  const Br = (x: number) => deckZ("Bridge", x);
  const Boat = (x: number) => deckZ("Boat", x);
  const sides: (1 | -1)[] = [1, -1];
  const slab = 0.3;

  const stem = hull.xMax;
  const stern = hull.xMin;
  const fromStem = (ft: number) => stem - ft * FT;
  /** The forecastle's after end, the bridge deck house's ends. */
  const FC = CARPATHIA_WELLS.forward.toX;
  const HF = CARPATHIA_BRIDGE_DECK.toX;
  const HA = CARPATHIA_BRIDGE_DECK.fromX;
  /** The stern deckhouse and the boat platform on the after deck. */
  const SH = CARPATHIA_STERN_HOUSE;
  const PF = CARPATHIA_BOAT_PLATFORM;
  /** The navigating bridge: the boat deck's front. */
  const F = CARPATHIA_BOAT_DECK.toX;
  const A = CARPATHIA_BOAT_DECK.fromX;
  const [foreX, mainX, mizzenX, jiggerX] = CARPATHIA_MASTS;
  const funnelX = spec.funnels[0].x;
  const FH0 = fromStem(FWD_HOUSE_FT[1]);
  const FH1 = fromStem(FWD_HOUSE_FT[0]);
  /** The bridge house on the boat deck, its roof the navigating bridge. */
  const BH0 = CARPATHIA_BRIDGE_HOUSE.fromX;
  const BH1 = F - 0.4;
  const bridgeRoof = (x: number) => Boat(x) + TIER;
  const anchorX = stem - 7.5;
  const nameX = stem - 16;

  const layout: ShipLayout = {
    sternX: stern,
    stemX: stem,
    forecastleFrom: FC,
    // No poop (R21): the after deck runs open to the stern.
    poopTo: CARPATHIA_AFTER_DECK.fromX,
    bridgeDeckFrom: HA,
    bridgeDeckTo: HF,
    boatDeckFrom: A,
    boatDeckTo: F,
    promenadeEnclosedFrom: F - 5,
    aHouseInset: PROM_INSET,
    // 1912: the paint line at her 34 ft 7 in load draught (Wikipedia),
    // a white boot-top over it (the photographs). 1918: a dark grey
    // boot-top along her ballast waterline (spec.draught 8.0 m), the
    // dazzle down to it (README).
    loadWaterline: war ? 7.5 : 10.54,
    bootTop: war ? 1.1 : 0.22,
  };

  const walls = wallPaint(look);
  const shade = wallPaint(look, true);
  /** The hull's colour, for the wells' bulwarks. */
  const sideColor = war ? GREY : 0x121315;

  // -------------------------------------------------------------------------
  // Tiers: the forecastle is her hull's plating carried up a tier; the
  // forward well is the upper deck behind bulwarks; abaft the bridge deck
  // house the upper deck runs open to the stern behind rails (R21: no
  // poop; the black hull stops at it, the Malta photograph); the bridge
  // deck house is flush with her sides (white in 1912, its portholes in a
  // row), the bridge deck promenade over it under the boat deck, closed at
  // the bridge and aft.
  const blocks: Block[] = [
    {
      id: "forecastle",
      x0: FC,
      x1: stem - 0.02,
      deck: "Upper",
      h: TIER,
      wall: "plating",
      roof: "pitch",
    },
    ...(
      [
        ["forward-well", HF, FC, true],
        ["after-deck", stern + 0.02, HA, false],
      ] as const
    ).flatMap(([id, x0, x1, bulwark]): Block[] => [
      {
        id: `${id}-deck`,
        x0,
        x1,
        deck: "Upper",
        h: 0.02,
        wall: "white",
        wallColor: sideColor,
        roof: "pitch",
        ends: false,
      },
      ...(bulwark
        ? [
            {
              id: `${id}-bulwark`,
              x0,
              x1,
              deck: "Upper",
              h: 1.15,
              strip: 0.2,
              wall: "white",
              wallColor: look === "dazzle" ? DAZZLE_WALL : sideColor,
              dazzle: true,
              roof: "paint",
              roofColor: war ? LIGHT_GREY : 0x2a2a2c,
              ends: false,
            } satisfies Block,
          ]
        : []),
    ]),
    {
      id: "bridge-deck-house",
      x0: HA,
      x1: HF,
      deck: "Upper",
      h: TIER,
      wall: "white",
      ...walls,
      roof: "pine",
    },
    // The promenade: closed ends, open between, the boat deck over it.
    {
      id: "prom-aft",
      x0: A,
      x1: A + 4,
      deck: "Bridge",
      h: TIER - slab,
      wall: "white",
      ...walls,
      roof: "none",
    },
    {
      id: "prom-house",
      x0: A + 4,
      x1: F - 5,
      deck: "Bridge",
      h: TIER - slab,
      inset: PROM_INSET,
      wall: "shade",
      ...shade,
      roof: "none",
      ends: false,
    },
    {
      id: "prom-front",
      x0: F - 5,
      x1: F,
      deck: "Bridge",
      h: TIER - slab,
      roundFwd: 3,
      wall: "white",
      ...walls,
      roof: "none",
    },
    {
      id: "boat-deck",
      x0: A,
      x1: F,
      deck: "Boat",
      dz: -slab,
      h: slab,
      inset: 0.02,
      roundFwd: 3,
      wall: "white",
      ...walls,
      roof: "pine",
      under: true,
    },
    // The forward deckhouse on the bridge deck (the officers' rooms,
    // Wikipedia), a pair of boats on its roof.
    {
      id: "forward-house",
      x0: FH0,
      x1: FH1,
      deck: "Bridge",
      h: TIER,
      inset: FWD_HOUSE_INSET,
      roundFwd: 2,
      wall: "white",
      ...walls,
      roof: "paint",
    },
  ];

  // -------------------------------------------------------------------------
  // Houses on the boat deck and the after deck.
  function house(
    id: string,
    x0: number,
    x1: number,
    hw: number,
    h: number,
    base: (x: number) => number,
    roof: House["roof"] = "flat"
  ): House {
    return {
      id,
      x0,
      x1,
      y0: -hw,
      y1: hw,
      z0: base(x0),
      z1: base(x1),
      h,
      roof,
      ...walls,
    };
  }
  const houses: House[] = [
    // The bridge house (chart room, officers), the navigating bridge on
    // its roof, the wheelhouse on that.
    house("bridge-house", BH0, BH1, 5.4, TIER, Boat),
    house("wheelhouse", F - 3.6, F - 1.0, 2.6, 2.3, bridgeRoof),
    // The funnel's casing.
    house("funnel-casing", funnelX - 3.6, funnelX + 3.6, 3.6, 0.8, Boat),
    // The long deckhouse abaft the funnel (the smoke room's skylight on it).
    house("smoke-room", -27.4, funnelX - 4.9, 4.2, 2.4, Boat),
    house(
      "smoke-room-skylight",
      funnelX - 15,
      funnelX - 9,
      2.2,
      0.8,
      (x) => Boat(x) + 2.4,
      "skylight"
    ),
    // The after deckhouse on the boat deck.
    house("after-house", A + 1.6, A + 10.5, 4.0, 2.4, Boat),
    // The stern deckhouse on the after deck (the steering gear and the
    // gunners' rooms), white with a walkway outside it (R21, the Malta
    // photograph), its tenth pair of boats and the gun on its roof.
    house("stern-house", SH.fromX, SH.toX, SH.halfBreadth, TIER, Up),
  ];

  // -------------------------------------------------------------------------
  // The funnel: one, tall, slender and nearly round (about 19½ by 18½
  // ft, some 3.4 times as tall over the boat deck as it is wide), raked a
  // little aft (the photographs). Cunard red with a black top and two
  // thin black bands (the 1912 colour postcard, the profile drawing); in
  // 1918 battle grey all over (Wikipedia).
  const funnels: FunnelRecipe[] = spec.funnels.map((f, i) => ({
    index: i,
    x: f.x,
    baseZ: f.baseZ,
    topZ: f.topZ,
    dummy: f.dummy,
    semiA: (19.5 * FT) / 2,
    semiB: (18.5 * FT) / 2,
    rake: 4 * TO_RAD,
    blackTop: war ? 0.7 : FUNNEL_1912.blackTop,
    // titanicinquiry: "red; black top; 3 narrow black rings" (P1 shows
    // three).
    bands: war ? [] : [...FUNNEL_1912.bands],
    pipes: [
      { y: -0.55, r: 0.17 },
      { y: 0.55, r: 0.17 },
    ],
    hasWhistle: true,
  }));

  // -------------------------------------------------------------------------
  // Masts: four, at the data's places, nearly upright, the main and mizzen
  // tallest with the wireless aerial between them; a crow's nest on the
  // foremast; the jigger on the after deck about 493 ft from the stem (the
  // photographs).
  const mast = (
    id: MastRecipe["id"],
    x: number,
    baseZ: number,
    topZ: number,
    yard: boolean
  ): MastRecipe => ({
    id,
    x,
    baseZ,
    topZ,
    r0: 0.42,
    r1: 0.14,
    rake: 3 * TO_RAD,
    yard,
  });
  const masts: MastRecipe[] = [
    {
      ...mast("fore", foreX, Up(foreX), 52, false),
      crowsNest: { z: Up(foreX) + 17, r: 0.8, h: 1.4 },
    },
    mast("main", mainX, Br(mainX), 54, true),
    mast("mizzen", mizzenX, Boat(mizzenX), 52, true),
    mast("jigger", jiggerX, Up(jiggerX), 45, false),
  ];
  const mastAt = (m: MastRecipe, z: number): V3 => [
    m.x - Math.tan(m.rake) * (z - m.baseZ),
    0,
    z,
  ];

  // -------------------------------------------------------------------------
  // Boats: the data's twenty, in its order, each in chocks inboard of its
  // pair of davits on the deck's (or the forward house's, the platform's or
  // the stern house's) edge; the davits swung out (1918, the war zone's
  // practice) in every livery: a livery is paint only.
  const boatEdge = (b: (typeof CARPATHIA_BOATS)[number]): number =>
    b.x > F && b.x < HF
      ? edge(b.x) - FWD_HOUSE_INSET
      : b.x > SH.fromX && b.x < SH.toX
        ? SH.halfBreadth
        : edge(b.x);
  const chock = 0.3;
  const boats: BoatRecipe[] = CARPATHIA_BOATS.map((b) => {
    const s = b.side === "port" ? 1 : -1;
    const e = boatEdge(b);
    const deck = b.z - 1;
    return {
      index: b.index,
      label: b.label,
      kind: "lifeboat",
      side: b.side,
      x: b.x,
      y: s * (e - 1.4),
      z: deck + chock,
      ...BOAT,
      hasDavits: true,
      edgeY: s * (e - 0.15),
      deckZ: deck,
      ...(b.wreckedAtT !== undefined ? { wreckedAtT: b.wreckedAtT } : {}),
    } satisfies BoatRecipe;
  });
  const davits: DavitRecipe[] = [];
  for (const b of boats)
    for (const dx of [-1, 1]) {
      const x = b.x + dx * (b.length / 2 - 0.35);
      davits.push({
        boat: b.index,
        x,
        footY: b.edgeY,
        headY: swungOutY(b),
        z: b.deckZ,
      });
    }

  // -------------------------------------------------------------------------
  // Lights: two rows of portholes in her hull (the 'tween decks), a row
  // in the bridge deck house and the forecastle; windows in the
  // promenade's inner wall and the deckhouses.
  const lights: LightSpot[] = [];
  let serial = 0;
  const seed = () => hash01(serial++, 1918);
  const dBoat = deckIndex("Boat");
  const dBridge = deckIndex("Bridge");
  const dUpper = deckIndex("Upper");
  const dMain = deckIndex("Main");
  const dLower = deckIndex("Lower");

  function hullPort(x: number, z: number, s: 1 | -1, deck: number): void {
    const hb = hull.halfBreadth(x, z);
    if (hb < 1.5) return;
    const d = 0.25;
    const hx =
      (hull.halfBreadth(x + d, z) - hull.halfBreadth(x - d, z)) / (2 * d);
    const hz =
      (hull.halfBreadth(x, z + d) - hull.halfBreadth(x, z - d)) / (2 * d);
    const n = normalize([-hx, s, -hz]);
    lights.push({
      kind: "porthole",
      p: [x + n[0] * 0.03, s * hb + n[1] * 0.03, z + n[2] * 0.03],
      n,
      w: 0.4,
      h: 0.4,
      deck,
      seed: seed(),
    });
  }
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
    const n = normalize([-slope, s, 0]);
    lights.push({
      kind,
      p: [x + n[0] * 0.03, s * e + n[1] * 0.03, z],
      n,
      w,
      h,
      deck,
      seed: seed(),
    });
  }
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
  for (const s of sides) {
    const k = s > 0 ? 0 : 1;
    // The 'tween decks under the upper deck and under the main deck.
    row(-74, 74, 1.7, 0.12, 1 + k, (x) => {
      if (Math.abs(x - anchorX) < 3) return;
      hullPort(x, deckZ("Main", x) + 1.35, s, dMain);
    });
    row(-70, 70, 1.7, 0.18, 3 + k, (x) =>
      hullPort(x, deckZ("Lower", x) + 1.35, s, dLower)
    );
    // The bridge deck house, flush with her side.
    row(HA + 0.8, HF - 0.8, 1.6, 0.1, 5 + k, (x) =>
      edgeLight("porthole", x, Up(x) + 1.35, s, 0, 0.4, 0.4, dUpper)
    );
    // The forecastle.
    row(FC + 1, stem - 9, 1.6, 0.15, 7 + k, (x) => {
      if (Math.abs(x - nameX) < 4.5) return;
      edgeLight("porthole", x, Up(x) + 1.35, s, 0, 0.4, 0.4, dUpper);
    });
    // The promenade's inner wall: windows.
    row(A + 4.6, F - 5.6, 2.0, 0.08, 11 + k, (x) =>
      edgeLight("window", x, Br(x) + 1.3, s, PROM_INSET, 0.8, 0.95, dBridge)
    );
    // Its closed ends and the forward house: portholes.
    for (const [x0, x1] of [
      [A + 0.6, A + 3.4],
      [F - 4.6, F - 3],
    ])
      row(x0, x1, 1.2, 0, 13 + k, (x) =>
        edgeLight("porthole", x, Br(x) + 1.3, s, 0, 0.4, 0.4, dBridge)
      );
    row(FH0 + 0.8, FH1 - 2.2, 1.5, 0.1, 15 + k, (x) =>
      edgeLight(
        "window",
        x,
        Br(x) + 1.35,
        s,
        FWD_HOUSE_INSET,
        0.7,
        0.8,
        dBridge
      )
    );
  }
  // The deckhouses: windows along both sides; the wheelhouse front.
  for (const h of houses) {
    if (h.id === "funnel-casing" || h.id === "wheelhouse") continue;
    const sky = h.roof === "skylight";
    const step = sky ? 1.5 : 1.8;
    const w = sky ? 1.0 : 0.7;
    const ht = sky ? 0.4 : 0.8;
    const zOff = sky ? h.h - 0.45 : 1.4;
    const deck = h.id === "stern-house" ? dUpper : dBoat;
    for (const [y, ny] of [
      [h.y1, 1],
      [h.y0, -1],
    ] as const) {
      const n = Math.floor((h.x1 - h.x0 - 1) / step);
      for (let i = 0; i <= n; i += 1) {
        const x = h.x0 + 0.5 + (h.x1 - h.x0 - 1 - n * step) / 2 + i * step;
        const z = h.z0 + ((h.z1 - h.z0) * (x - h.x0)) / (h.x1 - h.x0) + zOff;
        wallLight("window", [x, y, z], [0, ny, 0], w, ht, deck);
      }
    }
  }
  for (let y = -2.1; y <= 2.11; y += 0.84)
    wallLight(
      "window",
      [F - 1.0, y, bridgeRoof(F - 1) + 1.55],
      [1, 0, 0],
      0.6,
      0.7,
      dBoat
    );
  // The bridge house's front, under the navigating bridge.
  for (let y = -4.2; y <= 4.21; y += 1.4)
    wallLight("window", [BH1, y, Boat(BH1) + 1.4], [1, 0, 0], 0.7, 0.8, dBoat);

  // -------------------------------------------------------------------------
  // Ventilators: big cowls beside the funnel (the photographs show four
  // tall ones there) and in the gap before it, smaller ones in the well,
  // on the forecastle, the boat deck aft, the after deck and the stern
  // house.
  const vents: Placement[] = [];
  const vent = (
    x: number,
    y: number,
    z: number,
    scale: number,
    turn: number,
    s: 1 | -1
  ) => vents.push({ p: [x, y, z], yaw: s * turn * Math.PI, scale });
  for (const s of sides) {
    vent(funnelX + 2.6, s * 5.1, Boat(funnelX + 2.6), 1.5, 0, s);
    vent(funnelX - 2.4, s * 5.1, Boat(funnelX - 2.4), 1.45, 1, s);
    vent(funnelX + 6.4, s * 3.0, Boat(funnelX + 6.4), 1.2, 0, s);
    vent(-30.2, s * 3.2, Boat(-30.2), 1.1, 0.25, s);
    vent(A + 0.9, s * 3.0, Boat(A + 0.9), 1.0, 1, s);
    vent(HF + 1.6, s * 4.6, Up(HF + 1.6), 1.0, 0.75, s);
    vent(FC - 1.5, s * 3.4, Up(FC - 1.5), 0.9, 0, s);
    vent(HA - 1.6, s * 4.4, Up(HA - 1.6), 1.0, 0.25, s);
    vent(SH.toX + 1.6, s * 3.4, Up(SH.toX + 1.6), 0.9, 1, s);
    vent(FC + 3, s * 2.6, deckZ("Forecastle", FC + 3), 0.8, 0.5, s);
    vent(SH.toX - 1.2, s * 1.0, Up(SH.toX - 1.2) + TIER, 0.7, 0.5, s);
  }

  // Bitts along the forecastle, the well and the after deck.
  const bollards: Placement[] = [];
  for (const s of sides) {
    for (const x of [stem - 6, stem - 11, FC + 1.5])
      bollards.push({
        p: [x, s * (edge(x) - 0.9), deckZ("Forecastle", x)],
        yaw: 0,
        scale: 1,
      });
    for (const x of [stern + 1.8, stern + 4.6])
      bollards.push({
        p: [x, s * (edge(x) - 0.9), Up(x)],
        yaw: 0,
        scale: 1,
      });
    for (const x of [HF + 3.5, FC - 3.5, SH.toX + 2.8, HA - 2.5])
      bollards.push({ p: [x, s * (edge(x) - 1.0), Up(x)], yaw: 0, scale: 1 });
  }

  // The windlass and capstans on the forecastle, the stern capstans.
  const capstans: Placement[] = [];
  for (const s of sides) {
    capstans.push({
      p: [stem - 8.5, s * 1.5, deckZ("Forecastle", stem - 8.5)],
      yaw: 0,
      scale: 1.1,
    });
    capstans.push({
      p: [stern + 3.2, s * 1.5, Up(stern + 3.2)],
      yaw: 0,
      scale: 0.85,
    });
  }

  // Hatches: Nos. 1 and 2 either side of the foremast in the forward well,
  // No. 3 on the bridge deck between the bridge and the mainmast, No. 5 on
  // the after deck just forward of the boat platform (her data's No. 5
  // hatch, x −57).
  const hatches: Hatch[] = [
    { x0: foreX + 3.4, x1: foreX + 8.4, hw: 2.4, z: Up(foreX + 6), h: 0.9 },
    { x0: foreX - 9.4, x1: foreX - 3.4, hw: 2.4, z: Up(foreX - 6), h: 0.9 },
    { x0: F + 0.5, x1: mainX - 2.4, hw: 2.0, z: Br(F + 1.5), h: 0.8 },
    {
      x0: PF.toX + 0.45,
      x1: PF.toX + 4.65,
      hw: 2.3,
      z: Up(PF.toX + 2.5),
      h: 0.9,
    },
  ];
  if (war)
    for (const h of hatches) {
      h.color = 0x3f4441;
    }

  // -------------------------------------------------------------------------
  // Painted boxes: the promenade's stanchions, the navigating bridge's
  // wings, the boat platform on its stanchions, the derricks at every mast;
  // and (1918 only, its own list) the stern gun.
  const boxes: BoxPart[] = [];
  const variantBoxes: BoxPart[] = [];
  const mastColor = paint.mast ?? BUFF;
  {
    const n = Math.max(1, Math.round((F - 5 - (A + 4)) / 3.0));
    for (let i = 0; i <= n; i += 1) {
      const x = A + 4 + ((F - 5 - (A + 4)) * i) / n;
      for (const s of sides)
        boxes.push({
          c: [x, s * (edge(x) - 0.12), (Br(x) + Boat(x) - slab) / 2],
          size: [0.18, 0.18, Boat(x) - slab - Br(x)],
          color: war ? LIGHT_GREY : WHITE,
        });
    }
  }
  {
    // The navigating bridge on the bridge house's roof, its wings out to
    // the ship's sides, a cab at each end.
    const x = F - 2.2;
    const z = bridgeRoof(x);
    const e = edge(x) + 0.4;
    const deckColor = war ? LIGHT_GREY : WHITE;
    boxes.push({
      c: [x, 0, z - 0.1],
      size: [2.2, 2 * e, 0.2],
      color: deckColor,
    });
    boxes.push({
      c: [x + 1.0, 0, z + 0.55],
      size: [0.16, 2 * e, 1.1],
      color: deckColor,
    });
    for (const s of sides) {
      boxes.push({
        c: [x - 0.2, s * (e - 0.9), z + 1.1],
        size: [1.7, 1.6, 2.0],
        color: deckColor,
      });
      boxes.push({
        c: [x, s * (e - 0.5), (Boat(x) + z) / 2],
        size: [0.18, 0.18, z - Boat(x)],
        color: deckColor,
      });
    }
  }
  {
    // The boat platform forward of the jigger (the Malta photograph): a
    // deck a tier over the after deck along each side, on stanchions, a
    // boat in chocks on each.
    const deckColor = war ? LIGHT_GREY : WHITE;
    const x = (PF.fromX + PF.toX) / 2;
    const len = PF.toX - PF.fromX;
    const z = Up(x) + TIER;
    for (const s of sides) {
      const e = edge(x);
      boxes.push({
        c: [x, s * (e - 1.6), z - 0.12],
        size: [len, 3.2, 0.24],
        color: deckColor,
      });
      for (const dx of [-1, 1])
        for (const dy of [0.3, 2.9])
          boxes.push({
            c: [x + dx * (len / 2 - 0.3), s * (e - dy), (Up(x) + z) / 2],
            size: [0.16, 0.16, TIER - 0.24],
            color: deckColor,
          });
    }
  }
  /** A derrick: heel at the mast, `len` long, toward `dir`, raised `pitch`. */
  const derrickHeads: { mast: MastRecipe; head: V3 }[] = [];
  function derrick(
    m: MastRecipe,
    dir: 1 | -1,
    len: number,
    pitchDeg: number
  ): void {
    const heel: V3 = [m.x + dir * 0.5, 0, m.baseZ + 1.6];
    const p = pitchDeg * TO_RAD;
    const head: V3 = [
      heel[0] + dir * len * Math.cos(p),
      0,
      heel[2] + len * Math.sin(p),
    ];
    boxes.push({
      c: [(heel[0] + head[0]) / 2, 0, (heel[2] + head[2]) / 2],
      size: [len, 0.32, 0.32],
      color: mastColor,
      yaw: dir > 0 ? 0 : Math.PI,
      pitch: p,
    });
    derrickHeads.push({ mast: m, head });
  }
  const [fore, main, mizzen, jigger] = masts;
  // Forward to the hatches they work; topped up where nothing is below.
  derrick(fore, 1, 10, 40);
  derrick(fore, -1, 10, 40);
  derrick(main, 1, 9, 62);
  derrick(main, -1, 7, 70);
  derrick(mizzen, 1, 9, 70);
  derrick(mizzen, -1, 9, 70);
  // The jigger's topped steeply clear of the boat platform and the house.
  derrick(jigger, 1, 9, 76);
  derrick(jigger, -1, 8, 62);
  // Winches at the derricks' heels.
  for (const m of masts)
    for (const dir of [1, -1])
      boxes.push({
        c: [m.x + dir * 1.6, 0, m.baseZ + 0.45],
        size: [1.2, 1.6, 0.9],
        color: 0x2b2c2e,
      });
  {
    // The stern gun on its platform on the stern house's roof, aft (README:
    // her gunners are in the accounts; the gun and its place are ours).
    // The 1918 looks only: the 1912 ship had none, so in her Cunard
    // colours its own small list is empty and its mesh hidden.
    const gx = SH.fromX + 1.9;
    const gz = Up(gx) + TIER;
    if (war) {
      variantBoxes.push({
        c: [gx, 0, gz + 0.4],
        size: [3.4, 3.4, 0.8],
        color: GREY,
      });
      variantBoxes.push({
        c: [gx, 0, gz + 1.3],
        size: [1.4, 1.2, 1.0],
        color: 0x5c6167,
      });
      variantBoxes.push({
        c: [gx + 0.4, 0, gz + 2.1],
        size: [0.2, 2.4, 1.6],
        color: 0x5c6167,
      });
      variantBoxes.push({
        c: [gx - 1.4, 0, gz + 1.5],
        size: [3.6, 0.22, 0.22],
        color: 0x3a3e42,
        pitch: -6 * TO_RAD,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Railings along every open deck edge.
  const rails: RailRun[] = [];
  const railColor = war ? LIGHT_GREY : undefined;
  function edgeRun(
    x0: number,
    x1: number,
    z: (x: number) => number,
    inset: number
  ): void {
    for (const s of sides) {
      const pts: V3[] = [];
      const n = Math.max(2, Math.ceil((x1 - x0) / 1.6));
      for (let i = 0; i <= n; i += 1) {
        const x = x0 + ((x1 - x0) * i) / n;
        pts.push([x, s * Math.max(0, edge(x) - inset), z(x)]);
      }
      rails.push({ points: pts, ...(railColor ? { color: railColor } : {}) });
    }
  }
  function acrossRun(x: number, z: number, halfWidth: number): void {
    const pts: V3[] = [];
    const n = Math.ceil((2 * halfWidth) / 1.6);
    for (let i = 0; i <= n; i += 1)
      pts.push([x, -halfWidth + (2 * halfWidth * i) / n, z]);
    rails.push({ points: pts, ...(railColor ? { color: railColor } : {}) });
  }
  const Fc = (x: number) => deckZ("Forecastle", x);
  edgeRun(FC + 0.1, stem - 0.6, Fc, 0.08);
  acrossRun(FC + 0.1, Fc(FC), edge(FC) - 0.1);
  // The after deck's open rails, stern to house (R21).
  edgeRun(stern + 0.6, HA - 0.1, Up, 0.08);
  edgeRun(F + 0.2, HF - 0.1, Br, 0.08);
  acrossRun(HF - 0.1, Br(HF), edge(HF) - 0.1);
  edgeRun(A + 0.1, F - 3, Boat, 0.1);
  acrossRun(A + 0.1, Boat(A), edge(A) - 0.1);
  edgeRun(FH0 + 0.2, FH1 - 2, (x) => Br(x) + TIER, FWD_HOUSE_INSET + 0.1);
  acrossRun(FH0 + 0.1, Br(FH0) + TIER, edge(FH0) - FWD_HOUSE_INSET - 0.1);

  // -------------------------------------------------------------------------
  // Rigging: stays and shrouds, topping lifts to the derricks, the
  // wireless aerial between the main and mizzen mastheads, the funnel's
  // guys.
  const wires: Wire[] = [];
  const top = (m: MastRecipe, below = 0.6) => mastAt(m, m.topZ - below);
  wires.push({
    a: top(fore, 3),
    b: [stem - 0.6, 0, Fc(stem - 0.6) + 1],
    kind: "rig",
  });
  // Each mast's own stays to the deck fore and aft of it on the centre
  // line (the photographs and the profile drawing): no stays from
  // masthead to masthead but the aerial.
  for (const [m, deck, fwd, aft] of [
    [main, Br, 13, 0],
    [mizzen, Boat, 0, 14],
  ] as const) {
    if (fwd > 0)
      wires.push({
        a: top(m, 3),
        b: [m.x + fwd, 0, deck(m.x + fwd) + 0.4],
        kind: "rig",
      });
    if (aft > 0)
      wires.push({
        a: top(m, 3),
        b: [m.x - aft, 0, deck(m.x - aft) + 0.4],
        kind: "rig",
      });
  }
  wires.push({
    a: top(jigger, 3),
    b: [stern + 1.2, 0, Up(stern + 1.2) + 1],
    kind: "rig",
  });
  const shroudDeck: Record<MastRecipe["id"], (x: number) => number> = {
    fore: Up,
    main: Br,
    mizzen: Boat,
    jigger: Up,
  };
  for (const m of masts) {
    const deck = shroudDeck[m.id];
    for (const s of sides)
      for (const dx of [-1.2, -2.6, -4.0]) {
        const x = m.x + dx;
        wires.push({
          a: mastAt(m, m.baseZ + (m.topZ - m.baseZ) * 0.62),
          b: [x, s * (edge(x) - 0.2), deck(x) + 0.9],
          kind: "rig",
        });
      }
  }
  for (const { mast: m, head } of derrickHeads)
    wires.push({ a: mastAt(m, m.baseZ + 13), b: head, kind: "rig" });
  {
    const a = top(main);
    const b = top(mizzen);
    const sag = 1.8;
    const at = (t: number, y: number): V3 => [
      a[0] + (b[0] - a[0]) * t,
      y,
      a[2] + (b[2] - a[2]) * t - sag * 4 * t * (1 - t),
    ];
    for (const y of [-1.2, -0.4, 0.4, 1.2])
      for (let i = 0; i < 10; i += 1)
        wires.push({
          a: at(i / 10, y),
          b: at((i + 1) / 10, y),
          kind: "aerial",
        });
    // The lead down to the wireless room, on the long deckhouse's after
    // end (its place is ours).
    const leadX = -25;
    const t = (a[0] - leadX) / (a[0] - b[0]);
    wires.push({
      a: at(t, 0),
      b: [leadX, 0, Boat(leadX) + 2.4],
      kind: "aerial",
    });
  }
  const funnelGuys: Wire[][] = funnels.map((f) => {
    const guys: Wire[] = [];
    const zBand = f.baseZ + (f.topZ - f.baseZ) * 0.62;
    const lean = Math.tan(f.rake);
    for (const s of sides)
      for (const [ang, dx] of [
        [0.4, 6.0],
        [Math.PI / 2, -0.5],
        [Math.PI - 0.4, -7.0],
      ] as const) {
        const ax = f.x - lean * (zBand - f.baseZ) + f.semiA * Math.cos(ang);
        const ay = s * f.semiB * Math.sin(ang);
        const x = f.x + dx;
        guys.push({
          a: [ax, ay, zBand],
          b: [x, s * (edge(x) - 2.9), Boat(x) + 0.2],
          kind: "rig",
        });
      }
    return guys;
  });

  // -------------------------------------------------------------------------
  // Under water: twin screws (titanicinquiry: "twin screws"), three-bladed
  // (thegreatoceanliners.com: "two three-bladed"), on short bossings either
  // side of the sternpost; one rudder hung on the sternpost under the
  // counter.
  const AP = -spec.lbp / 2;
  const hubX = AP + 3.6;
  const hubZ = 3.5;
  const propR = 2.3;
  const hubY = Math.max(3.6, hull.halfBreadth(hubX, hubZ) + propR + 0.35);
  const propellers: Propeller[] = [
    { hub: [hubX, hubY, hubZ], radius: propR, blades: 3, phase: 0.4 },
    { hub: [hubX, -hubY, hubZ], radius: propR, blades: 3, phase: 1.1 },
  ];
  function bossing(y: number, z: number, toX: number, r0: number, r1: number) {
    const inside = (x: number) =>
      [0, 0.7, -0.7].every(
        (k) =>
          hull.halfBreadth(x, z + k * r0) >=
          Math.abs(y) + r0 * Math.sqrt(1 - k * k) + 0.2
      );
    let x = toX;
    while (!inside(x) && x < 0) x += 0.5;
    return { from: [x, y, z] as V3, to: [toX, y, z] as V3, r0, r1 };
  }
  const bossings = [1, -1].map((s) =>
    bossing(s * hubY, hubZ, hubX + 0.6, 1.3, 0.5)
  );
  const lead = AP - 0.25;
  const chord = 3.6;
  const trail = lead - chord;
  const corner = (
    cx: number,
    cz: number,
    r: number,
    a0: number,
    a1: number
  ): [number, number][] =>
    [0, 0.25, 0.5, 0.75, 1].map((t) => {
      const a = a0 + (a1 - a0) * t;
      return [cx + r * Math.cos(a), cz + r * Math.sin(a)];
    });
  const rudder: ShipRecipe["rudder"] = {
    outline: [
      [lead, 0.7],
      ...corner(trail + 1.0, 1.7, 1.0, -Math.PI / 2, -Math.PI),
      ...corner(trail + 1.2, 7.4, 1.2, Math.PI, Math.PI / 2),
      [lead, 8.6],
    ],
    thickness: 0.5,
    taper: { lead: 0.5, trail: 0.14 },
    centre: [lead - chord / 2, 0, 4.6],
    stock: { x: lead, z0: 0.5, z1: 10.4, r: 0.28 },
  };

  const anchors = (["port", "starboard"] as const).map((side) => {
    const s = side === "port" ? 1 : -1;
    const z = spec.sheerZ(anchorX) - 1.0;
    return {
      p: [anchorX, s * hull.halfBreadth(anchorX, z), z] as V3,
      side,
      // About 3 m from the hawse to the crown: a 7 t stockless anchor,
      // the photographs' shape (README).
      stockless: { size: 3.0 },
    };
  });

  // Her name on the forecastle's plating and on the counter with her port
  // (1912); painted out in the war (an assumption, README).
  const names: NameBoard[] = war
    ? []
    : [
        ...(["port", "starboard"] as const).map((side) => ({
          where: "bow" as const,
          x: nameX,
          z: spec.sheerZ(nameX) + 1.3,
          side,
          width: 7.4,
          height: 0.8,
        })),
        {
          where: "stern" as const,
          x: stern,
          z: spec.sheerZ(stern) - 1.5,
          side: "aft" as const,
          width: 6.2,
          height: 1.3,
        },
      ];

  const jack: V3 = [stem - 0.5, 0, Fc(stem - 0.5)];
  const ensign: V3 = [stern + 0.9, 0, Up(stern + 0.9)];
  const staffs = [
    { foot: jack, top: [jack[0] + 0.4, 0, jack[2] + 6] as V3 },
    { foot: ensign, top: [ensign[0] - 0.7, 0, ensign[2] + 7] as V3 },
  ];

  return {
    spec,
    hull,
    layout,
    deckIndex,
    deckZ,
    houses,
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
    propellers,
    rudder,
    bossings,
    anchors,
    names,
    paint,
    blocks,
    boxes,
    variantBoxes,
    drums: [],
    ledgeDecks: ["Upper", "Main", "Lower", "Fourth", "Orlop"],
    staffs,
  };
}
