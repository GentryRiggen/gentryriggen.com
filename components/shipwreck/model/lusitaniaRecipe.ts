import {
  LUSITANIA_BOATS,
  LUSITANIA_FUNNEL_PAINT,
  LUSITANIA_PEACETIME_PAINT,
} from "@/lib/shipwreck/ships/lusitania";
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
  type Dome,
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
 * RMS Lusitania's details as on 7 May 1915, from her general arrangement
 * (profile and deck plans, Wikimedia "RMS Lusitania deck plans") and
 * photographs (README, "The Lusitania"): where every tier, house, funnel
 * fitting, ventilator, boat, mast and wire goes. Pure data and placement
 * maths, like `titanicRecipe.ts`; `buildShip.ts` turns it into geometry.
 *
 * Ship frame: metres, x forward, y to port, z up from the keel at
 * midships. Her decks (`spec.decks`): Boat, B (Promenade), C (Shelter, the
 * top of the hull), D (Upper), E (Main), F (Lower).
 *
 * Funnels and boats stand where the ship data puts them (`spec.funnels`,
 * `LUSITANIA_BOATS`) and every tier's ends are the data's superstructure
 * boxes, so the model moves with the data. The few positions the data has
 * no field for (the foremast, the mainmast's gap, the foredeck's
 * fittings) are measured off her 1907 profile and plans from the stem or
 * the forward perpendicular.
 */

/**
 * The paint switch, kept with her data (`LUSITANIA_PEACETIME_PAINT` in
 * lib/shipwreck/ships/lusitania.ts, which also holds the funnel colours the
 * hull diagram reads). false: as she was on 7 May 1915 (funnels painted out
 * dark, the gilt band round the base of the superstructure, her name in
 * gilt letters). true: her peacetime Cunard colours (red funnels with
 * black tops and three thin black bands, no gilt band).
 */
export const PEACETIME_PAINT = LUSITANIA_PEACETIME_PAINT;

const FT = 0.3048;
/** Paint (sRGB), as `COLORS` in buildShip.ts (kept free of three.js here). */
const WHITE = 0xe8e4d8;
const ROOF = 0xb4b2aa;
/**
 * Her masts and derricks: buff (period practice for Cunard's masts; no
 * source gives the shade: an assumption, README).
 */
const MAST = 0xa9835a;
/**
 * The cowls' mouths: dark red-brown lining (period practice was red lead
 * or red inside cowls; no source for hers: an assumption, README).
 */
const VENT_LINING = 0x5a241c;
const TO_RAD = Math.PI / 180;

/** 7 May 1915 (README: "Her paint in May 1915"). */
const WAR_PAINT: ShipPaint = {
  funnel: LUSITANIA_FUNNEL_PAINT.war.funnel,
  funnelTop: LUSITANIA_FUNNEL_PAINT.war.top,
  sheerLine: 0xb8913f,
  name: "LUSITANIA",
  mast: MAST,
  ventLining: VENT_LINING,
};
/** 1907–1914: Cunard red, black tops and bands. */
const CUNARD_PAINT: ShipPaint = {
  funnel: LUSITANIA_FUNNEL_PAINT.cunard.funnel,
  funnelTop: LUSITANIA_FUNNEL_PAINT.cunard.top,
  sheerLine: null,
  name: "LUSITANIA",
  mast: MAST,
  ventLining: VENT_LINING,
};

/**
 * The gap between the boat deck and the 2nd class house, the mainmast in
 * it (her boat deck plan). The data's boxes run the two together.
 */
const MAST_GAP = 1.2;
/** The foremast's foot, 100 ft abaft the forward perpendicular (profile). */
const FOREMAST_FROM_FP = 100 * FT;
/** Its crow's nest, 42 ft over the foredeck (profile). */
const CROWS_NEST_UP = 42 * FT;
const HOUSE_INSET = 3.6;
const HOUSE_H = 2.6;

export function lusitaniaRecipe(spec: ShipSpec): ShipRecipe {
  // Her counter is a broad ellipse in plan above the sternpost; the
  // offsets' run comes to a point up there (fine for the sim's volumes).
  const hull = createHullSurface(spec, {
    fromX: -85,
    exponent: 2.4,
    zFrom: 10.5,
    zTo: 17,
  });
  const paint = PEACETIME_PAINT ? CUNARD_PAINT : WAR_PAINT;
  const deckByName = new Map(spec.decks.map((d, i) => [d.name, i]));
  const deckIndex = (name: string): number => {
    const i = deckByName.get(name);
    if (i === undefined) throw new Error(`no deck ${name}`);
    return i;
  };
  const deckZ = (name: string, x: number): number =>
    spec.decks[deckIndex(name)].z + (spec.sheerZ(x) - spec.depth);
  const edge = (x: number): number => hull.topHalfBreadth(x);
  const C = (x: number) => deckZ("C", x);
  const B = (x: number) => deckZ("B", x);
  const Boat = (x: number) => deckZ("Boat", x);
  const hCB = B(0) - C(0);
  const hBBoat = Boat(0) - B(0);
  const slab = 0.32;
  const roofZ = (x: number) => Boat(x) + HOUSE_H;
  const sides: (1 | -1)[] = [1, -1];

  const fx = spec.funnels.map((f) => f.x);
  // The data's boxes: [0] the 2nd class house, [2] the long house under
  // the boat deck (its front is the bridge's).
  const [aftBox, , longBox] = spec.superstructure;
  /** The bridge front (the rounded front of the boat deck). */
  const F = longBox.toX;
  /** The boat deck's after end. */
  const A = longBox.fromX;
  /** The 2nd class house, its forward end short of the mainmast's gap. */
  const X0 = aftBox.fromX;
  const X1 = Math.min(aftBox.toX, A) - MAST_GAP;
  const mainX = (A + X1) / 2;
  /** The stem head and the forward perpendicular. */
  const stem = hull.xMax;
  const FP = spec.lbp / 2;
  const foreX = FP - FOREMAST_FROM_FP;
  /** The hawse pipes 28 ft, the name's middle 73 ft, from the stem. */
  const anchorX = stem - 28 * FT;
  const nameX = stem - 73 * FT;

  const layout: ShipLayout = {
    sternX: hull.xMin,
    stemX: hull.xMax,
    forecastleFrom: F,
    poopTo: X0,
    bridgeDeckFrom: X0,
    bridgeDeckTo: F,
    boatDeckFrom: A,
    boatDeckTo: F,
    promenadeEnclosedFrom: F - 6,
    aHouseInset: HOUSE_INSET,
    // Paint line at her 33 ft 6 in load draught; she floated 0.85 m
    // higher on 7 May with her coal burnt (spec.draught).
    loadWaterline: 33.5 * FT,
    bootTop: 0.2,
  };

  // -------------------------------------------------------------------------
  // Tiers. Forward of the bridge the black plating runs up to the
  // Promenade (B) deck, the long foredeck; abaft it, white: the Shelter
  // deck promenade (C to B, open between stanchions), the Promenade deck
  // (a white bulwark, open above), the boat deck, and the long house on it.
  // The 2nd class house aft, the mainmast in the gap, the open stern deck.
  const blocks: Block[] = [
    {
      id: "foredeck",
      x0: F,
      x1: hull.xMax,
      deck: "C",
      h: hCB,
      wall: "plating",
      roof: "pitch",
      ends: false,
    },
    {
      id: "stern-deck",
      x0: hull.xMin + 0.02,
      x1: X0,
      deck: "C",
      h: 0.02,
      wall: "white",
      roof: "pitch",
      ends: false,
    },
    {
      id: "mast-gap-deck",
      x0: X1,
      x1: A,
      deck: "C",
      h: 0.02,
      wall: "white",
      roof: "pitch",
      ends: false,
    },
    // Shelter deck: closed ends, the promenade between.
    {
      id: "c-front",
      x0: F - 7,
      x1: F,
      deck: "C",
      h: hCB,
      wall: "white",
      roof: "none",
    },
    {
      id: "c-aft",
      x0: A,
      x1: A + 5,
      deck: "C",
      h: hCB,
      wall: "white",
      roof: "none",
    },
    {
      id: "c-house",
      x0: A + 5,
      x1: F - 7,
      deck: "C",
      h: hCB,
      inset: 2.3,
      wall: "shade",
      roof: "none",
      ends: false,
    },
    {
      id: "c-promenade",
      x0: A + 5,
      x1: F - 7,
      deck: "C",
      h: 0.02,
      wall: "white",
      roof: "pitch",
      ends: false,
    },
    // Promenade deck: its slab, the bulwark, the house, the round front.
    {
      id: "b-slab",
      x0: A,
      x1: F,
      deck: "B",
      dz: -slab,
      h: slab,
      inset: 0.02,
      wall: "white",
      roof: "pine",
      under: true,
    },
    {
      id: "b-bulwark",
      x0: A + 0.6,
      x1: F - 6,
      deck: "B",
      dz: -slab,
      h: slab + 1.05,
      strip: 0.22,
      wall: "white",
      roof: "paint",
    },
    {
      id: "b-house",
      x0: A + 1,
      x1: F - 6,
      deck: "B",
      h: hBBoat - slab,
      inset: 2.6,
      wall: "shade",
      roof: "none",
    },
    {
      id: "b-front",
      x0: F - 6,
      x1: F,
      deck: "B",
      h: hBBoat - slab,
      roundFwd: 4,
      wall: "white",
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
      roundFwd: 4,
      wall: "white",
      roof: "pine",
      under: true,
    },
    {
      id: "boat-house",
      x0: A + 3,
      x1: F - 3,
      deck: "Boat",
      h: HOUSE_H,
      inset: HOUSE_INSET,
      roundFwd: 6,
      wall: "white",
      roof: "paint",
    },
    // The 2nd class house aft: flush to B, a promenade round its B deck
    // house, its own boat deck on top.
    {
      id: "aft-c",
      x0: X0,
      x1: X1,
      deck: "C",
      h: hCB,
      wall: "white",
      roof: "none",
    },
    {
      id: "aft-b-slab",
      x0: X0,
      x1: X1,
      deck: "B",
      dz: -slab,
      h: slab,
      inset: 0.02,
      wall: "white",
      roof: "pine",
      under: true,
    },
    {
      id: "aft-b-bulwark",
      x0: X0 + 0.3,
      x1: X1 - 0.3,
      deck: "B",
      dz: -slab,
      h: slab + 1.05,
      strip: 0.22,
      wall: "white",
      roof: "paint",
    },
    {
      id: "aft-b-house",
      x0: X0 + 1.5,
      x1: X1 - 1.5,
      deck: "B",
      h: hBBoat - slab,
      inset: 2.6,
      wall: "shade",
      roof: "none",
    },
    {
      id: "aft-boat-deck",
      x0: X0,
      x1: X1,
      deck: "Boat",
      dz: -slab,
      h: slab,
      inset: 0.02,
      wall: "white",
      roof: "pine",
      under: true,
    },
  ];

  // -------------------------------------------------------------------------
  // Houses on the boat deck house's roof and the after deck.
  function house(
    id: string,
    x0: number,
    x1: number,
    hw: number,
    h: number,
    base: (x: number) => number,
    roof: House["roof"] = "flat"
  ): House {
    return { id, x0, x1, y0: -hw, y1: hw, z0: base(x0), z1: base(x1), h, roof };
  }
  const houses: House[] = [
    // The officers' house on the navigating bridge, the wheelhouse.
    house("officers-house", F - 15, F - 4.6, 6.0, 2.4, roofZ),
    house("wheelhouse", F - 4.6, F - 2.7, 3.4, 2.5, roofZ),
    // Skylights: the 1st class smoke room, lounge and writing room.
    house("smoke-room-skylight", A + 5, fx[3] - 8, 5.0, 1.3, roofZ, "skylight"),
    house("lounge-skylight", fx[3] + 6, fx[2] - 6, 5.4, 1.4, roofZ, "skylight"),
    house(
      "writing-room-skylight",
      fx[2] + 9.5,
      fx[1] - 7,
      4.2,
      1.0,
      roofZ,
      "skylight"
    ),
    // The 2nd class lounge on the after house.
    house("second-class-lounge", -96, -80, 5.2, 2.4, Boat, "skylight"),
    house(
      "docking-bridge-cab",
      X0 + 0.4,
      X0 + 2.6,
      1.5,
      2.0,
      (x) => Boat(x) + 2.5
    ),
  ];
  fx.forEach((x, i) =>
    houses.push(house(`funnel-casing-${i}`, x - 5, x + 5, 4.6, 1.0, roofZ))
  );
  // The main companionway's dome, just forward of the third funnel.
  const domes: Dome[] = [
    { x: fx[2] + 7.2, z: roofZ(fx[2] + 7.2), a: 2.6, b: 2.4, c: 1.3 },
  ];

  // -------------------------------------------------------------------------
  // Funnels: four working funnels, 25 by 21 ft, raked aft about 7.5°
  // (her profile and photographs), steam pipes up the forward face.
  const funnels: FunnelRecipe[] = spec.funnels.map((f, i) => ({
    index: i,
    x: f.x,
    baseZ: f.baseZ,
    topZ: f.topZ,
    dummy: f.dummy,
    semiA: (25 * FT) / 2,
    semiB: (21 * FT) / 2,
    rake: 7.5 * TO_RAD,
    blackTop: 4.4,
    bands: [0.36, 0.52, 0.68],
    pipes: [
      { y: -0.65, r: 0.2 },
      { y: 0.65, r: 0.2 },
    ],
    hasWhistle: i < 2,
  }));

  // -------------------------------------------------------------------------
  // Masts: the foremast on the foredeck 100 ft abaft the forward
  // perpendicular, its crow's nest 42 ft up (her profile); the mainmast in
  // the gap between the boat deck and the 2nd class house; aerials 165 ft
  // over the water (her plans), raked like the funnels.
  const masts: MastRecipe[] = [
    {
      id: "fore",
      x: foreX,
      baseZ: B(foreX),
      topZ: 60,
      r0: 0.55,
      r1: 0.17,
      rake: 7.5 * TO_RAD,
      crowsNest: { z: B(foreX) + CROWS_NEST_UP, r: 0.95, h: 1.6 },
    },
    {
      id: "main",
      x: mainX,
      baseZ: C(mainX),
      topZ: 59,
      r0: 0.52,
      r1: 0.17,
      rake: 7.5 * TO_RAD,
    },
  ];
  const mastAt = (m: MastRecipe, z: number): V3 => [
    m.x - Math.tan(m.rake) * (z - m.baseZ),
    0,
    z,
  ];

  // -------------------------------------------------------------------------
  // Boats (LUSITANIA_BOATS order): 22 wooden lifeboats in radial davits
  // along the boat deck's edges, each over a collapsible; eight more
  // collapsibles on the after house's deck, two rows a side.
  const W = { length: 30 * FT, beam: 9 * FT, depth: 4 * FT };
  const K = { length: 27 * FT, beam: 8 * FT, depth: 2.5 * FT };
  const KAft = { length: 23 * FT, beam: 8 * FT, depth: 2.5 * FT };
  const chock = 0.25;
  const boats: BoatRecipe[] = LUSITANIA_BOATS.map((b) => {
    const s = b.side === "port" ? 1 : -1;
    const e = edge(b.x);
    const deck = Boat(b.x);
    const base = {
      index: b.index,
      label: b.label,
      side: b.side,
      x: b.x,
      edgeY: s * (e - 0.15),
      deckZ: deck,
    };
    if (b.kind === "wooden")
      return {
        ...base,
        kind: "lifeboat",
        y: s * (e - 1.45),
        // On top of the collapsible stowed under it.
        z: deck + chock + K.depth * 1.08 + 0.12,
        ...W,
        hasDavits: true,
      } satisfies BoatRecipe;
    const aft = b.x < A;
    if (!aft)
      return {
        ...base,
        kind: "collapsible",
        y: s * (e - 1.45),
        z: deck + chock,
        ...K,
        hasDavits: false,
      } satisfies BoatRecipe;
    // Aft: two rows a side, outboard and inboard, alternating so the
    // boats clear each other (the deck narrows aft: rows set from its
    // narrowest point).
    const k = Number(b.label.slice(1)) - 1;
    const outboard = edge(-80) - 1.5;
    return {
      ...base,
      kind: "collapsible",
      y: s * (k % 2 === 0 ? outboard : outboard - 2.8),
      z: deck + chock,
      ...KAft,
      hasDavits: false,
    } satisfies BoatRecipe;
  });
  const davits: DavitRecipe[] = [];
  for (const b of boats) {
    if (!b.hasDavits) continue;
    for (const dx of [-1, 1]) {
      const x = b.x + dx * (b.length / 2 - 0.45);
      // Swung out (Turner had the boats swung out the day before).
      davits.push({
        boat: b.index,
        x,
        footY: b.edgeY,
        headY: swungOutY(b),
        z: Boat(x),
      });
    }
  }

  // -------------------------------------------------------------------------
  // Lights.
  const lights: LightSpot[] = [];
  let serial = 0;
  const seed = () => hash01(serial++, 1915);
  const dBoat = deckIndex("Boat");
  const dB = deckIndex("B");
  const dC = deckIndex("C");
  const dD = deckIndex("D");
  const dE = deckIndex("E");
  const dF = deckIndex("F");

  function hullPort(x: number, z: number, s: 1 | -1, deck: number): void {
    const hb = hull.halfBreadth(x, z);
    if (hb < 1.2) return;
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
      w: 0.42,
      h: 0.42,
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
  /** Windows round a block's rounded front (the curve's own normals). */
  function roundFront(
    x1: number,
    R: number,
    inset: number,
    z: number,
    w: number,
    h: number,
    deck: number
  ): void {
    const hw = (x: number) => {
      const t = Math.min(1, (x - (x1 - R)) / R);
      return Math.max(0, edge(x) - inset) * Math.sqrt(Math.max(0, 1 - t * t));
    };
    for (const t of [0.12, 0.38, 0.6, 0.78, 0.92])
      for (const s of sides) {
        const x = x1 - R + R * t;
        const d = 0.05;
        const slope = (hw(x + d) - hw(x - d)) / (2 * d);
        wallLight(
          "window",
          [x, s * hw(x), z],
          normalize([-slope, s, 0]),
          w,
          h,
          deck
        );
      }
    wallLight("window", [x1, 0, z], [1, 0, 0], w, h, deck);
  }

  // The hull's portholes: the Upper (D) deck end to end, and the Main (E)
  // and Lower (F) deck rows exactly where the sim's open-porthole rows are
  // (spec.portholes), following the sheer from each row's middle.
  for (const s of sides)
    row(-118, 112, 1.45, 0.12, s > 0 ? 1 : 2, (x) => {
      if (Math.abs(x - anchorX) < 3.5) return; // the anchors
      hullPort(x, deckZ("D", x) + 1.3, s, dD);
    });
  (spec.portholes ?? []).forEach((r, ri) => {
    const s = r.side === "port" ? 1 : -1;
    const mid = (r.fromX + r.toX) / 2;
    const deck = r.z < deckZ("E", mid) ? dF : dE;
    row(r.fromX, r.toX, 1.6, 0, 10 + ri, (x) =>
      hullPort(x, r.z + spec.sheerZ(x) - spec.sheerZ(mid), s, deck)
    );
  });

  // The foredeck's plating: portholes between the Shelter and Promenade
  // decks, clear of the name and the anchors.
  for (const s of sides)
    row(F + 1.2, 110, 1.5, 0.15, 20 + (s > 0 ? 0 : 1), (x) => {
      if (Math.abs(x - nameX) < 5.5) return;
      if (x > anchorX - 3.5) return;
      edgeLight("porthole", x, C(x) + 1.35, s, 0, 0.42, 0.42, dC);
    });

  // The Shelter deck: windows in the promenade's inner wall, portholes in
  // the closed ends and the after house.
  for (const s of sides) {
    row(A + 5.8, F - 7.6, 2.0, 0.1, 30 + (s > 0 ? 0 : 1), (x) =>
      edgeLight("window", x, C(x) + 1.45, s, 2.3, 0.8, 1.0, dC)
    );
    for (const [x0, x1] of [
      [A + 0.8, A + 4.6],
      [F - 6.6, F - 0.6],
      [X0 + 0.8, X1 - 0.8],
    ])
      row(x0, x1, 1.25, 0.12, 32 + (s > 0 ? 0 : 1), (x) =>
        edgeLight("porthole", x, C(x) + 1.4, s, 0, 0.42, 0.42, dC)
      );
  }
  // The Promenade deck: the house's windows, the round front's.
  for (const s of sides) {
    row(A + 1.6, F - 6.8, 1.9, 0.08, 40 + (s > 0 ? 0 : 1), (x) =>
      edgeLight("window", x, B(x) + 1.45, s, 2.6, 0.9, 1.1, dB)
    );
    row(X0 + 2.2, X1 - 2.2, 2.0, 0.1, 42 + (s > 0 ? 0 : 1), (x) =>
      edgeLight("window", x, B(x) + 1.45, s, 2.6, 0.8, 1.0, dB)
    );
  }
  roundFront(F, 4, 0, B(F) + 1.45, 1.0, 1.15, dB);
  // The boat deck house: cabin windows along both sides, its round front.
  for (const s of sides)
    row(A + 3.8, F - 9.2, 2.1, 0.12, 50 + (s > 0 ? 0 : 1), (x) =>
      edgeLight("window", x, Boat(x) + 1.45, s, HOUSE_INSET, 0.7, 0.85, dBoat)
    );
  roundFront(F - 3, 6, HOUSE_INSET, Boat(F - 3) + 1.45, 0.75, 0.9, dBoat);
  // Houses on the roof: cabin windows, the skylights' clerestories, the
  // wheelhouse front.
  for (const h of houses) {
    if (h.id.startsWith("funnel-casing") || h.id === "docking-bridge-cab")
      continue;
    const sky = h.roof === "skylight";
    const step = sky ? 1.6 : 1.9;
    const w = sky ? 1.1 : 0.7;
    const ht = sky ? 0.5 : 0.8;
    const zOff = sky ? h.h - 0.55 : 1.45;
    for (const [y, ny] of [
      [h.y1, 1],
      [h.y0, -1],
    ] as const) {
      const n = Math.floor((h.x1 - h.x0 - 1) / step);
      for (let i = 0; i <= n; i += 1) {
        const x = h.x0 + 0.5 + (h.x1 - h.x0 - 1 - n * step) / 2 + i * step;
        const z = h.z0 + ((h.z1 - h.z0) * (x - h.x0)) / (h.x1 - h.x0) + zOff;
        wallLight("window", [x, y, z], [0, ny, 0], w, ht, dBoat);
      }
    }
  }
  for (let y = -2.7; y <= 2.71; y += 0.9)
    wallLight(
      "window",
      [F - 2.7, y, roofZ(F - 2.7) + 1.7],
      [1, 0, 0],
      0.62,
      0.75,
      dBoat
    );
  // Faces over the open decks: the after house's ends.
  for (let y = -9; y <= 9.01; y += 2.25) {
    wallLight(
      "porthole",
      [X0, y * 0.75, C(X0) + 1.4],
      [-1, 0, 0],
      0.42,
      0.42,
      dC
    );
    wallLight("porthole", [X1, y, C(X1) + 1.4], [1, 0, 0], 0.42, 0.42, dC);
  }
  for (const d of domes)
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      const el = 0.55;
      const n = normalize([
        (Math.cos(a) * Math.cos(el)) / d.a,
        (Math.sin(a) * Math.cos(el)) / d.b,
        Math.sin(el) / d.c,
      ]);
      wallLight(
        "window",
        [
          d.x + d.a * Math.cos(a) * Math.cos(el),
          d.b * Math.sin(a) * Math.cos(el),
          d.z + d.c * Math.sin(el),
        ],
        n,
        0.9,
        0.55,
        dBoat
      );
    }

  // -------------------------------------------------------------------------
  // Ventilators: the forest of tall cowls round the funnels on the house
  // roof (mouths forward to draw air in, aft to let it out), the flat
  // drum-shaped ones beside the casings, more on the foredeck and aft.
  const vents: Placement[] = [];
  const drums: Placement[] = [];
  /**
   * A cowl, its mouth turned `turn` (0 forward, 1 aft, 0.5 outboard, 0.25
   * forward and outboard…) on side `s`: trimmed to the wind, as in her
   * photographs, not all square fore and aft.
   */
  const vent = (
    x: number,
    y: number,
    z: number,
    scale: number,
    turn: number,
    s: 1 | -1
  ) => vents.push({ p: [x, y, z], yaw: s * turn * Math.PI, scale });
  fx.forEach((x, i) => {
    const odd = i % 2;
    for (const s of sides) {
      vent(x + 6.4, s * 2.9, roofZ(x + 6.4), 1.6, 0, s);
      vent(x - 6.4, s * 2.9, roofZ(x - 6.4), 1.55, 1, s);
      vent(x + 1.6, s * 6.3, roofZ(x + 1.6), 1.3, odd ? 0.5 : 0.25, s);
      vent(x - 3.4, s * 7.2, roofZ(x - 3.4), 1.15, odd ? 0.75 : 0.5, s);
      drums.push({ p: [x + 4.6, s * 7.3, roofZ(x + 4.6)], yaw: 0, scale: 1 });
    }
  });
  for (const s of sides) {
    vent(F - 18, s * 7.4, roofZ(F - 18), 1.2, 0.25, s);
    vent(A + 4.2, s * 3.6, roofZ(A + 4.2), 1.3, 1, s);
    vent(F + 3, s * 6.0, B(F + 3), 1.25, 0.75, s);
    vent(stem - 60 * FT, s * 3.4, B(stem - 60 * FT), 1.0, 0, s);
    vent(X1 - 3, s * 7.8, Boat(X1 - 3), 1.2, 0.5, s);
    vent(X0 + 6, s * 4.4, Boat(X0 + 6), 1.1, 1, s);
    vent(X0 - 6, s * 4.2, C(X0 - 6), 0.95, 0.75, s);
    drums.push({
      p: [X0 + 5, s * 7.4, Boat(X0 + 5)],
      yaw: 0,
      scale: 0.8,
    });
  }

  // Benches on the 2nd class boat deck aft.
  const benches: Placement[] = [];
  for (const s of sides)
    for (const x of [X0 + 3.3, X0 + 5.7])
      benches.push({
        p: [x, s * 6.6, Boat(x)],
        yaw: s > 0 ? Math.PI : 0,
        scale: 1,
      });

  const bollards: Placement[] = [];
  for (const s of sides) {
    for (const ft of [100, 64, 34])
      bollards.push({
        p: [
          stem - ft * FT,
          s * (edge(stem - ft * FT) - 1.0),
          B(stem - ft * FT),
        ],
        yaw: 0,
        scale: 1,
      });
    for (const x of [X0 - 4, X0 - 10, X0 - 15])
      bollards.push({ p: [x, s * (edge(x) - 1.0), C(x)], yaw: 0, scale: 1 });
  }
  // Capstans and the two windlasses on the foredeck, the hatch and the
  // anchor crane (her Promenade deck plan, feet from the stem); the stern
  // capstans and hatch.
  const fwd = (ft: number) => stem - ft * FT;
  const capstans: Placement[] = [];
  for (const s of sides) {
    capstans.push({ p: [fwd(108), s * 4.4, B(fwd(108))], yaw: 0, scale: 0.85 });
    capstans.push({ p: [fwd(80), s * 3.4, B(fwd(80))], yaw: 0, scale: 0.85 });
    capstans.push({ p: [fwd(94), s * 1.6, B(fwd(94))], yaw: 0, scale: 1.15 });
    capstans.push({
      p: [X0 - 12.2, s * 2.6, C(X0 - 12.2)],
      yaw: 0,
      scale: 0.85,
    });
  }
  // The anchor crane at the stem, its jib laid aft along the deck.
  const cranes: Placement[] = [
    { p: [fwd(16), 0, B(fwd(16))], yaw: Math.PI, scale: 0.7 },
  ];
  const hatches: Hatch[] = [
    { x0: fwd(69), x1: fwd(59), hw: 1.8, z: B(fwd(64)), h: 0.7 },
    { x0: X0 - 8.7, x1: X0 - 6.1, hw: 1.6, z: C(X0 - 7.4), h: 0.6 },
  ];

  // -------------------------------------------------------------------------
  // Painted boxes: stanchions along the open promenades, the navigating
  // bridge's wings, the foredeck's breakwater, the docking bridge, the
  // foremast's derricks.
  const boxes: BoxPart[] = [];
  const white = WHITE;
  function stanchions(
    x0: number,
    x1: number,
    z0: (x: number) => number,
    z1: (x: number) => number
  ): void {
    const n = Math.max(1, Math.round((x1 - x0) / 3.05));
    for (let i = 0; i <= n; i += 1) {
      const x = x0 + ((x1 - x0) * i) / n;
      for (const s of sides)
        boxes.push({
          c: [x, s * (edge(x) - 0.12), (z0(x) + z1(x)) / 2],
          size: [0.2, 0.2, z1(x) - z0(x)],
          color: white,
        });
    }
  }
  stanchions(A + 5, F - 7, C, (x) => B(x) - slab);
  stanchions(
    A + 0.6,
    F - 6,
    (x) => B(x) + 1.05,
    (x) => Boat(x) - slab
  );
  stanchions(
    X0 + 0.3,
    X1 - 0.3,
    (x) => B(x) + 1.05,
    (x) => Boat(x) - slab
  );
  {
    // Bridge wings out to the ship's sides, a windbreak, the wing cabs.
    const x = F - 2.9;
    const z = roofZ(x);
    const e = edge(x) + 0.5;
    boxes.push({ c: [x, 0, z + 0.12], size: [1.4, 2 * e, 0.24], color: white });
    boxes.push({
      c: [x + 0.6, 0, z + 0.8],
      size: [0.18, 2 * e, 1.1],
      color: white,
    });
    for (const s of sides) {
      boxes.push({
        c: [x - 0.2, s * (e - 0.95), z + 1.35],
        size: [1.8, 1.8, 2.2],
        color: white,
      });
      boxes.push({
        c: [x - 0.2, s * (e - 0.95), z + 2.5],
        size: [2.0, 2.0, 0.12],
        color: ROOF,
      });
      // The wing's strut down to the boat deck's edge.
      boxes.push({
        c: [x, s * (e - 0.6), (Boat(x) + z) / 2],
        size: [0.2, 0.2, z - Boat(x)],
        color: white,
      });
    }
  }
  {
    // The foredeck's V breakwater, ahead of the bridge, abaft the mast.
    const apex = F + 8;
    const back = F + 5;
    const hw = edge(back) - 1.2;
    const len = Math.hypot(apex - back, hw);
    for (const s of sides)
      boxes.push({
        c: [(apex + back) / 2, (s * hw) / 2, B((apex + back) / 2) + 0.6],
        size: [len, 0.18, 1.2],
        color: white,
        yaw: Math.atan2(s * hw, back - apex),
      });
  }
  {
    // The docking bridge across the after end of the after house.
    const x = X0 + 1.5;
    const z = Boat(x) + 2.4;
    const e = edge(x) + 0.4;
    boxes.push({ c: [x, 0, z], size: [1.6, 2 * e, 0.22], color: white });
    for (const s of sides)
      for (const y of [e - 0.4, 2.0])
        boxes.push({
          c: [x, s * y, (Boat(x) + z) / 2],
          size: [0.18, 0.18, z - Boat(x)],
          color: white,
        });
  }
  for (const s of sides) {
    // Derricks: heel at the foremast, head forward in a crutch.
    const heel: V3 = [foreX + 0.6, s * 0.5, B(foreX + 0.6) + 1.6];
    const head: V3 = [foreX + 11.2, s * 2.3, B(foreX + 11.2) + 2.9];
    const dx = head[0] - heel[0];
    const dy = head[1] - heel[1];
    const dz = head[2] - heel[2];
    const len = Math.hypot(dx, dy, dz);
    boxes.push({
      c: [
        (heel[0] + head[0]) / 2,
        (heel[1] + head[1]) / 2,
        (heel[2] + head[2]) / 2,
      ],
      size: [len, 0.3, 0.3],
      color: MAST,
      yaw: Math.atan2(dy, dx),
      pitch: Math.atan2(dz, Math.hypot(dx, dy)),
    });
    boxes.push({
      c: [foreX + 11.4, s * 2.3, B(foreX + 11.4) + 1.35],
      size: [0.2, 0.2, 2.7],
      color: MAST,
    });
  }

  // -------------------------------------------------------------------------
  // Railings along every open deck edge.
  const rails: RailRun[] = [];
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
      rails.push({ points: pts });
    }
  }
  function acrossRun(x: number, z: number, halfWidth: number): void {
    const pts: V3[] = [];
    const n = Math.ceil((2 * halfWidth) / 1.6);
    for (let i = 0; i <= n; i += 1)
      pts.push([x, -halfWidth + (2 * halfWidth * i) / n, z]);
    rails.push({ points: pts });
  }
  edgeRun(F + 0.2, hull.xMax - 0.4, B, 0.08);
  edgeRun(A, F - 4, Boat, 0.1);
  acrossRun(A + 0.1, Boat(A), edge(A) - 0.1);
  edgeRun(X0, X1, Boat, 0.1);
  acrossRun(X1 - 0.1, Boat(X1), edge(X1) - 0.1);
  edgeRun(hull.xMin + 0.4, X0, C, 0.08);
  edgeRun(X1, A, C, 0.08);
  acrossRun(X0 + 1.5, Boat(X0 + 1.5) + 2.4, edge(X0 + 1.5) + 0.3);
  // Round the roof of the boat deck house, at the bridge.
  acrossRun(F - 15.2, roofZ(F - 15.2), edge(F - 15.2) - HOUSE_INSET - 0.1);

  // -------------------------------------------------------------------------
  // Rigging: the forestay and shrouds, the backstays, the wireless aerial
  // between the mastheads and its lead to the Marconi room, the funnels'
  // guys to the house roof's edges.
  const wires: Wire[] = [];
  const [fore, main] = masts;
  const foreTop = mastAt(fore, fore.topZ - 0.6);
  const mainTop = mastAt(main, main.topZ - 0.6);
  wires.push({
    a: mastAt(fore, fore.topZ - 3),
    b: [hull.xMax - 0.6, 0, B(hull.xMax - 0.6) + 1],
    kind: "rig",
  });
  for (const s of sides) {
    for (const dx of [-1.8, -3.6, -5.4]) {
      const x = fore.x + dx;
      wires.push({
        a: mastAt(fore, 40),
        b: [x, s * (edge(x) - 0.15), B(x) + 0.9],
        kind: "rig",
      });
    }
    wires.push({
      a: mastAt(fore, fore.topZ - 4),
      b: [fore.x - 8, s * (edge(fore.x - 8) - 0.15), B(fore.x - 8) + 0.9],
      kind: "rig",
    });
    for (const x of [X1 - 1.2, X1 - 3.0, X1 - 4.8])
      wires.push({
        a: mastAt(main, 40),
        b: [x, s * (edge(x) - 0.15), Boat(x) + 0.9],
        kind: "rig",
      });
    for (const x of [X0 - 6, X0 - 12])
      wires.push({
        a: mastAt(main, main.topZ - 4),
        b: [x, s * (edge(x) - 0.15), C(x) + 0.9],
        kind: "rig",
      });
    // Signal halyards to the bridge wings.
    wires.push({
      a: mastAt(fore, 44),
      b: [F - 3.1, s * (edge(F - 3) + 0.2), roofZ(F - 3) + 2.6],
      kind: "rig",
    });
  }
  const sag = 2.6;
  const aerialAt = (t: number, y: number): V3 => [
    foreTop[0] + (mainTop[0] - foreTop[0]) * t,
    y,
    foreTop[2] + (mainTop[2] - foreTop[2]) * t - sag * 4 * t * (1 - t),
  ];
  for (const y of [-1.5, -0.5, 0.5, 1.5])
    for (let i = 0; i < 12; i += 1)
      wires.push({
        a: aerialAt(i / 12, y),
        b: aerialAt((i + 1) / 12, y),
        kind: "aerial",
      });
  const leadT = (foreTop[0] - (A + 12)) / (foreTop[0] - mainTop[0]);
  wires.push({
    a: aerialAt(leadT, 0),
    b: [A + 12, 0, roofZ(A + 12) + 1.3],
    kind: "aerial",
  });

  const funnelGuys: Wire[][] = funnels.map((f) => {
    const guys: Wire[] = [];
    const zBand = f.baseZ + (f.topZ - f.baseZ) * f.bands[1];
    const lean = Math.tan(f.rake);
    for (const s of sides)
      for (const [ang, dx] of [
        [0.35, 7.0],
        [0.95, 2.4],
        [Math.PI - 0.95, -2.4],
        [Math.PI - 0.35, -7.0],
      ] as const) {
        const ax = f.x - lean * (zBand - f.baseZ) + f.semiA * Math.cos(ang);
        const ay = s * f.semiB * Math.sin(ang);
        const x = f.x + dx;
        guys.push({
          a: [ax, ay, zBand],
          b: [x, s * (edge(x) - HOUSE_INSET - 0.3), roofZ(x) + 0.2],
          kind: "rig",
        });
      }
    return guys;
  });

  // -------------------------------------------------------------------------
  // Under water: four four-bladed propellers (four-bladed from 1909), the
  // inner pair just forward of the rudder, the outer pair further forward
  // on long bossings; the rudder under the counter, aft of the sternpost.
  // From the after perpendicular (the sternpost).
  const AP = -spec.lbp / 2;
  const propellers: Propeller[] = [
    { hub: [AP + 5.8, 3.6, 4.2], radius: 2.35, blades: 4, phase: 0.3 },
    { hub: [AP + 5.8, -3.6, 4.2], radius: 2.35, blades: 4, phase: 1.0 },
    { hub: [AP + 19.8, 7.4, 4.6], radius: 2.35, blades: 4, phase: 0.6 },
    { hub: [AP + 19.8, -7.4, 4.6], radius: 2.35, blades: 4, phase: 1.3 },
  ];
  // Bossings along each shaft's line: long cones whose fat roots start
  // where the whole root lies inside the hull, so each swells gently out
  // of the run as it narrows (faired, not a tube laid against it).
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
  const bossings = [1, -1].flatMap((s) => [
    bossing(s * 3.6, 4.2, AP + 6.5, 1.6, 0.55),
    bossing(s * 7.4, 4.6, AP + 20.5, 2.0, 0.6),
  ]);
  // The rudder: a round stock on the sternpost, the blade tapering from
  // it to a thin trailing edge, its after corners rounded.
  const lead = AP - 0.25;
  const chord = 4.6;
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
  const trail = lead - chord;
  const rudder: ShipRecipe["rudder"] = {
    outline: [
      [lead, 0.8],
      ...corner(trail + 1.2, 2.0, 1.2, -Math.PI / 2, -Math.PI),
      ...corner(trail + 1.4, 7.3, 1.4, Math.PI, Math.PI / 2),
      [lead, 8.7],
    ],
    thickness: 0.55,
    taper: { lead: 0.55, trail: 0.15 },
    centre: [lead - chord / 2, 0, 4.7],
    stock: { x: lead, z0: 0.6, z1: 9.6, r: 0.3 },
  };

  const anchors = (["port", "starboard"] as const).map((side) => {
    const s = side === "port" ? 1 : -1;
    const x = anchorX;
    const z = spec.sheerZ(x) - 1.8;
    return { p: [x, s * hull.halfBreadth(x, z), z] as V3, side };
  });

  // Her name on the foredeck's plating (gilt letters, visible from U-20)
  // and on the counter with her port.
  const names: NameBoard[] = [
    ...(["port", "starboard"] as const).map((side) => ({
      where: "bow" as const,
      x: nameX,
      z: spec.sheerZ(nameX) + 0.95,
      side,
      width: 8.6,
      height: 0.86,
    })),
    {
      where: "stern",
      x: hull.xMin,
      z: spec.sheerZ(hull.xMin) - 1.7,
      side: "aft",
      width: 7.6,
      height: 1.5,
    },
  ];

  // Jack staff at the stem (on the foredeck), ensign staff at the stern
  // (on the Shelter deck).
  const jack: V3 = [hull.xMax - 0.5, 0, B(hull.xMax - 0.5)];
  const ensign: V3 = [hull.xMin + 0.8, 0, C(hull.xMin + 0.8)];
  const staffs = [
    { foot: jack, top: [jack[0] + 0.5, 0, jack[2] + 6.5] as V3 },
    { foot: ensign, top: [ensign[0] - 0.8, 0, ensign[2] + 7.5] as V3 },
  ];

  return {
    spec,
    hull,
    layout,
    deckIndex,
    deckZ,
    houses,
    domes,
    funnels,
    masts,
    boats,
    davits,
    lights,
    vents,
    benches,
    bollards,
    capstans,
    cranes,
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
    drums,
    ledgeDecks: ["C", "D", "E", "F", "Orlop"],
    // The gilt band runs round the base of the superstructure: it stops at
    // the house front, where the black plating rises to the foredeck.
    sheerLineZ: (x) => (x > F ? 1000 : spec.sheerZ(x)),
    staffs,
  };
}
