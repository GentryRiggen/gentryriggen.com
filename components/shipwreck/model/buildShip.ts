import { TEAR_AMPLITUDE, isInPart, tearX, type ShipPart } from "./breakCut";
import {
  GeoBuffer,
  add,
  basis,
  box,
  cross,
  cylinder,
  dome,
  polygon,
  quad,
  rgb,
  scale,
  sub,
  tube,
  type RGB,
} from "./geoBuffer";
import { HULL_FRACTIONS } from "./hullSurface";
import type {
  Block,
  GantryRecipe,
  House,
  LightSpot,
  Placement,
  ShipRecipe,
  V3,
  Wire,
} from "./titanicRecipe";

/**
 * Turns the recipe into geometry: one merged triangle list per material
 * (hull, paint, deck, bronze, decal), instance lists (lights and small
 * fittings) and line lists (rails and rigging). Built for the whole ship, or
 * for the bow or stern half once she breaks at `breakX`: every long surface
 * runs in columns about a metre apart and the column at the break follows
 * the jagged tear (`breakCut.ts`), so any `breakX` works.
 */

export type ModelQuality = "high" | "medium" | "low";

export interface QualitySettings {
  /** Spacing of the long surfaces' columns, m. */
  colStep: number;
  /** Each step between the hull's offset levels is split this many times. */
  hullSub: number;
  funnelSeg: number;
  cylSeg: number;
  /** Benches, bollards and railing posts. */
  smallFittings: boolean;
  vents: boolean;
  rails: boolean;
  rigging: boolean;
  /** The plating's rivet and seam normal map. */
  rivets: boolean;
}

export const QUALITY: Record<ModelQuality, QualitySettings> = {
  high: {
    colStep: 1.2,
    hullSub: 3,
    funnelSeg: 40,
    cylSeg: 12,
    smallFittings: true,
    vents: true,
    rails: true,
    rigging: true,
    rivets: true,
  },
  medium: {
    colStep: 1.8,
    hullSub: 2,
    funnelSeg: 28,
    cylSeg: 8,
    smallFittings: false,
    vents: true,
    rails: false,
    rigging: false,
    rivets: false,
  },
  low: {
    colStep: 2.8,
    hullSub: 1,
    funnelSeg: 18,
    cylSeg: 6,
    smallFittings: false,
    vents: false,
    rails: false,
    rigging: false,
    rivets: false,
  },
};

/** Paint and materials (sRGB). */
export const COLORS = {
  white: 0xe8e4d8,
  roof: 0xb4b2aa,
  skylight: 0x7d8c92,
  glass: 0x6c8089,
  black: 0x18191c,
  buff: 0xbb7f3a,
  mast: 0x8f5f38,
  wood: 0x6f4a2c,
  dark: 0x1f1f22,
  interior: 0x0c0a09,
  ledge: 0x14120f,
  tarp: 0x4c5249,
  pine: 0xd2bd96,
  pitchPine: 0xbfa274,
  rail: 0xe0ddd3,
  rig: 0x56524c,
  brass: 0xb38f4f,
  /** A wall inside a promenade, out of the sun. */
  shade: 0xd4d0c5,
} as const;

/** Plate tile: two 30 ft plates by two 6 ft strakes. */
export const PLATE_TILE_X = 2 * 30 * 0.3048;
export const PLATE_TILE_Y = 2 * 6 * 0.3048;
/** Plank tile size, m (deck uv is metres over this). */
export const PLANK_TILE = 4.096;

export interface LineList {
  /** three.js positions and linear colours, two vertices per segment. */
  pos: number[];
  col: number[];
}

export interface ShipPartData {
  part: ShipPart;
  hull: GeoBuffer;
  paint: GeoBuffer;
  deck: GeoBuffer;
  bronze: GeoBuffer;
  decal: GeoBuffer;
  portholes: LightSpot[];
  windows: LightSpot[];
  vents: Placement[];
  /** Drum ventilators (the Lusitania's). */
  drums: Placement[];
  benches: Placement[];
  bollards: Placement[];
  /** Railing posts' feet. */
  posts: V3[];
  lines: LineList;
  /** Indices of the funnels and boats that ride on this part. */
  funnels: number[];
  boats: number[];
}

interface Column {
  p: V3[];
  color?: RGB[];
  uv?: [number, number][];
  uv1?: [number, number][];
  extra?: number[];
}

interface Ctx {
  r: ShipRecipe;
  part: ShipPart;
  breakX: number | null;
  q: QualitySettings;
  cols: number[];
  d: ShipPartData;
}

/** The long surfaces' column positions: even, and denser at the ends. */
export function columnStations(r: ShipRecipe, step: number): number[] {
  const out: number[] = [];
  const { xMin, xMax } = r.hull;
  const fine = 16;
  let x = xMin;
  while (x < xMax) {
    out.push(x);
    const nearEnd = x < xMin + fine || x > xMax - fine;
    x += nearEnd ? step / 3 : step;
  }
  out.push(xMax);
  return out;
}

/** Whether `p` is drawn in this part. */
function inPart(ctx: Ctx, p: V3): boolean {
  return isInPart(ctx.part, ctx.breakX, p[0], p[1], p[2]);
}

type CutEnd = "lo" | "hi" | null;

/**
 * The columns of a surface from x0 to x1 in this part, NaN marking the
 * column on the tear. Null when the surface is wholly in the other half.
 */
function columns(
  ctx: Ctx,
  x0: number,
  x1: number
): { xs: number[]; cut: CutEnd } | null {
  const inner = ctx.cols.filter((x) => x > x0 + 0.05 && x < x1 - 0.05);
  const all = [x0, ...inner, x1];
  const b = ctx.breakX;
  if (ctx.part === "whole" || b === null) return { xs: all, cut: null };
  const A = TEAR_AMPLITUDE;
  if (ctx.part === "bow") {
    if (x1 <= b - A) return null;
    if (x0 >= b + A) return { xs: all, cut: null };
    const rest = all.filter((x) => x > b + A);
    if (rest.length === 0) rest.push(x1);
    return { xs: [NaN, ...rest], cut: "lo" };
  }
  if (x0 >= b + A) return null;
  if (x1 <= b - A) return { xs: all, cut: null };
  const rest = all.filter((x) => x < b - A);
  if (rest.length === 0) rest.push(x0);
  return { xs: [...rest, NaN], cut: "hi" };
}

/** The column on the tear: each row at its own tear x. */
function cutColumn(
  ctx: Ctx,
  x0: number,
  x1: number,
  column: (x: number) => Column
): Column {
  const b = Math.min(x1, Math.max(x0, ctx.breakX ?? 0));
  const base = column(b);
  const out: Column = { p: [] };
  if (base.color) out.color = [];
  if (base.uv) out.uv = [];
  if (base.uv1) out.uv1 = [];
  if (base.extra) out.extra = [];
  const memo = new Map<number, Column>();
  base.p.forEach((p, i) => {
    const t = Math.min(x1, Math.max(x0, tearX(ctx.breakX ?? 0, p[1], p[2])));
    let c = memo.get(t);
    if (!c) {
      c = column(t);
      memo.set(t, c);
    }
    out.p.push(c.p[i]);
    out.color?.push(c.color![i]);
    out.uv?.push(c.uv![i]);
    out.uv1?.push(c.uv1![i]);
    out.extra?.push(c.extra![i]);
  });
  return out;
}

interface GridResult {
  cut: CutEnd;
  /** The tear column's points, when cut. */
  cutPts: V3[] | null;
  first: V3[];
  last: V3[];
}

/**
 * A surface swept along x: `column(x)` gives its rows at x. Faces point
 * along (row direction) × (+x): rows climbing a port wall face to port.
 */
function grid(
  ctx: Ctx,
  buf: GeoBuffer,
  x0: number,
  x1: number,
  column: (x: number) => Column
): GridResult | null {
  const cols = columns(ctx, x0, x1);
  if (!cols) return null;
  const data = cols.xs.map((x) =>
    Number.isNaN(x) ? cutColumn(ctx, x0, x1, column) : column(x)
  );
  const rows = data[0].p.length;
  const ids: number[][] = data.map((c) =>
    c.p.map((p, i) =>
      buf.vertex(p, c.color?.[i], c.uv?.[i], c.uv1?.[i], c.extra?.[i])
    )
  );
  for (let j = 0; j < data.length - 1; j += 1)
    for (let i = 0; i < rows - 1; i += 1) {
      const a = ids[j][i];
      const b = ids[j + 1][i];
      const c = ids[j + 1][i + 1];
      const d = ids[j][i + 1];
      buf.tri(a, d, c);
      buf.tri(a, c, b);
    }
  const cutIndex =
    cols.cut === "lo" ? 0 : cols.cut === "hi" ? data.length - 1 : -1;
  return {
    cut: cols.cut,
    cutPts: cutIndex >= 0 ? data[cutIndex].p : null,
    first: data[0].p,
    last: data[data.length - 1].p,
  };
}

/** The normal a cap on the tear should face (out of this half). */
function capFacing(ctx: Ctx): V3 {
  return ctx.part === "bow" ? [-1, 0, 0] : [1, 0, 0];
}

function repeat<T>(v: T, n: number): T[] {
  return Array.from({ length: n }, () => v);
}

// ---------------------------------------------------------------------------
// The hull.

function hullUs(sub: number): number[] {
  const us: number[] = [];
  for (let j = 0; j < HULL_FRACTIONS.length - 1; j += 1)
    for (let k = 0; k < sub; k += 1)
      us.push(
        HULL_FRACTIONS[j] +
          ((HULL_FRACTIONS[j + 1] - HULL_FRACTIONS[j]) * k) / sub
      );
  us.push(1);
  return us;
}

function buildHull(ctx: Ctx): void {
  const { r } = ctx;
  const { hull } = r;
  const us = hullUs(ctx.q.hullSub);
  const span = hull.xMax - hull.xMin;
  const column = (x: number): Column => {
    const s = hull.section(x);
    const half: V3[] = us.map((u) => [
      x,
      hull.halfBreadthU(s, u),
      hull.zAtU(s, u),
    ]);
    // Starboard top to bottom, the keel, port bottom to top.
    const p: V3[] = [];
    for (let i = half.length - 1; i >= 0; i -= 1)
      p.push([x, -half[i][1], half[i][2]]);
    p.push([x, 0, hull.zAtU(s, 0)]);
    for (const h of half) p.push(h);
    // Girth from the deck edge down, the same on both sides.
    const girthHalf: number[] = [0];
    for (let i = half.length - 1; i > 0; i -= 1) {
      const a = half[i];
      const b = half[i - 1];
      girthHalf.push(
        girthHalf[girthHalf.length - 1] + Math.hypot(a[1] - b[1], a[2] - b[2])
      );
    }
    const keelGirth = girthHalf[girthHalf.length - 1] + half[0][1];
    const g = [...girthHalf, keelGirth, ...girthHalf.slice().reverse()];
    const sheer = r.spec.sheerZ(x);
    return {
      p,
      uv: g.map((v) => [x / PLATE_TILE_X, v / PLATE_TILE_Y]),
      uv1: g.map((v) => [(x - hull.xMin) / span, v / 40]),
      extra: repeat(r.sheerLineZ?.(x) ?? sheer, p.length),
    };
  };
  const res = grid(ctx, ctx.d.hull, hull.xMin, hull.xMax, column);
  if (!res || !res.cut || ctx.breakX === null) return;

  // The break: the hull is left open (drawn double-sided, dark inside),
  // with torn deck ledges and a dark bulkhead a few metres in.
  const inward = ctx.part === "bow" ? 1 : -1;
  const capX = ctx.breakX + inward * (TEAR_AMPLITUDE + 2.2);
  const cap = column(capX).p;
  polygon(ctx.d.paint, cap, capFacing(ctx), rgb(COLORS.interior));
  const ledge = rgb(COLORS.ledge);
  const x0 = ctx.breakX - TEAR_AMPLITUDE - 2.2;
  const x1 = ctx.breakX + TEAR_AMPLITUDE + 2.2;
  for (const deck of r.ledgeDecks ?? ["C", "D", "E", "F", "G", "Orlop"]) {
    const plate = (x: number, down: boolean): Column => {
      const z = r.deckZ(deck, x);
      const w = Math.max(
        0,
        hull.halfBreadth(x, Math.min(z, hull.zTop(x) - 0.01)) - 0.08
      );
      const p: V3[] = [];
      for (let k = 0; k <= 4; k += 1) {
        const y = w * (1 - (2 * k) / 4);
        p.push([x, down ? -y : y, down ? z - 0.25 : z]);
      }
      return { p, color: repeat(ledge, p.length) };
    };
    grid(ctx, ctx.d.paint, x0, x1, (x) => plate(x, false));
    grid(ctx, ctx.d.paint, x0, x1, (x) => plate(x, true));
  }
}

// ---------------------------------------------------------------------------
// Superstructure.

interface BandSpec {
  x0: number;
  x1: number;
  zb: (x: number) => number;
  h: number;
  /** y extent at x: [starboard, port]. */
  yr: (x: number) => [number, number];
  wall: RGB;
  roof: "deck" | "paint" | "skylight" | "none";
  roofColor?: RGB;
  ends: boolean;
  /** Underside (a slab seen from below). */
  under?: boolean;
  /** A deck or painted roof this much higher on the centre line. */
  camber?: number;
}

function band(ctx: Ctx, o: BandSpec): void {
  const paint = ctx.d.paint;
  const rowsWall = [0, 0.5, 1];
  const port = grid(ctx, paint, o.x0, o.x1, (x) => ({
    p: rowsWall.map((k): V3 => [x, o.yr(x)[1], o.zb(x) + o.h * k]),
    color: repeat(o.wall, 3),
  }));
  if (!port) return;
  const stbd = grid(ctx, paint, o.x0, o.x1, (x) => ({
    p: rowsWall.map((k): V3 => [x, o.yr(x)[0], o.zb(x) + o.h * (1 - k)]),
    color: repeat(o.wall, 3),
  }));
  const across = (x: number, z: number, n: number, down = false): V3[] => {
    const [lo, hi] = o.yr(x);
    const out: V3[] = [];
    for (let k = 0; k <= n; k += 1) {
      const t = k / n;
      out.push([x, down ? lo + (hi - lo) * t : hi + (lo - hi) * t, z]);
    }
    return out;
  };
  /** The roof's row across at x, cambered when asked. */
  const roofRow = (x: number): V3[] => {
    const camber = o.camber;
    if (!camber) return across(x, o.zb(x) + o.h, 4);
    const [lo, hi] = o.yr(x);
    const mid = (lo + hi) / 2;
    const half = Math.max(1e-6, (hi - lo) / 2);
    return across(x, o.zb(x) + o.h, 8).map(([px, py, pz]): V3 => {
      const t = (py - mid) / half;
      return [px, py, pz + camber * (1 - t * t)];
    });
  };
  let roof: GridResult | null = null;
  if (o.roof === "deck") {
    roof = grid(ctx, ctx.d.deck, o.x0, o.x1, (x) => {
      const p = roofRow(x);
      return {
        p,
        color: repeat(o.roofColor ?? [1, 1, 1], p.length),
        uv: p.map((v) => [v[0] / PLANK_TILE, v[1] / PLANK_TILE]),
      };
    });
  } else if (o.roof === "paint") {
    roof = grid(ctx, paint, o.x0, o.x1, (x) => {
      const p = roofRow(x);
      return { p, color: repeat(o.roofColor ?? rgb(COLORS.roof), p.length) };
    });
  } else if (o.roof === "skylight") {
    roof = grid(ctx, paint, o.x0, o.x1, (x) => {
      const [lo, hi] = o.yr(x);
      const z = o.zb(x) + o.h;
      const p: V3[] = [
        [x, hi, z],
        [x, (hi + lo) / 2, z + Math.min(0.9, (hi - lo) * 0.16)],
        [x, lo, z],
      ];
      return { p, color: repeat(o.roofColor ?? rgb(COLORS.skylight), 3) };
    });
  }
  if (o.under) {
    grid(ctx, paint, o.x0, o.x1, (x) => {
      const p = across(x, o.zb(x), 4, true);
      return { p, color: repeat(o.wall, p.length) };
    });
  }
  const endWall = (x: number, facing: V3) => {
    const [lo, hi] = o.yr(x);
    const z = o.zb(x);
    if (hi - lo < 0.05) return;
    quad(
      paint,
      [
        [x, lo, z],
        [x, hi, z],
        [x, hi, z + o.h],
        [x, lo, z + o.h],
      ],
      facing,
      o.wall
    );
  };
  if (port.cut && port.cutPts && stbd?.cutPts) {
    // Close the torn end: walls and roof outline, dark inside.
    const outline: V3[] = [...port.cutPts];
    if (roof?.cutPts) outline.push(...roof.cutPts.slice(1, -1));
    outline.push(...stbd.cutPts);
    polygon(paint, outline, capFacing(ctx), rgb(COLORS.interior));
  }
  if (o.ends) {
    if (port.cut !== "lo") endWall(o.x0, [-1, 0, 0]);
    if (port.cut !== "hi") endWall(o.x1, [1, 0, 0]);
  }
}

function buildSuperstructure(ctx: Ctx): void {
  const { r } = ctx;
  if (r.blocks) {
    buildBlocks(ctx, r.blocks);
    return;
  }
  const L = r.layout;
  const edge = (x: number) => r.hull.topHalfBreadth(x);
  const full =
    (inset: number) =>
    (x: number): [number, number] => {
      const e = Math.max(0, edge(x) - inset);
      return [-e, e];
    };
  const white = rgb(COLORS.white);
  const pine = rgb(COLORS.pine);
  const pitch = rgb(COLORS.pitchPine);
  const C = (x: number) => r.deckZ("C", x);
  const B = (x: number) => r.deckZ("B", x);
  const A = (x: number) => r.deckZ("A", x);
  const Boat = (x: number) => r.deckZ("Boat", x);
  const hCB = r.deckZ("B", 0) - r.deckZ("C", 0);
  const hBA = r.deckZ("A", 0) - r.deckZ("B", 0);
  const hABoat = r.deckZ("Boat", 0) - r.deckZ("A", 0);

  // C deck to B: the forecastle, the bridge deck and the poop, flush with
  // the hull (white above the black).
  band(ctx, {
    x0: L.forecastleFrom,
    x1: L.stemX - 0.02,
    zb: C,
    h: hCB,
    yr: full(0),
    wall: white,
    roof: "deck",
    roofColor: pitch,
    ends: true,
  });
  band(ctx, {
    x0: L.bridgeDeckFrom,
    x1: L.bridgeDeckTo,
    zb: C,
    h: hCB,
    yr: full(0),
    wall: white,
    roof: "deck",
    roofColor: pine,
    ends: true,
  });
  band(ctx, {
    x0: L.sternX + 0.02,
    x1: L.poopTo,
    zb: C,
    h: hCB,
    yr: full(0),
    wall: white,
    roof: "deck",
    roofColor: pitch,
    ends: true,
  });
  // The well decks.
  for (const [x0, x1] of [
    [L.bridgeDeckTo, L.forecastleFrom],
    [L.poopTo, L.bridgeDeckFrom],
  ]) {
    grid(ctx, ctx.d.deck, x0, x1, (x) => {
      const e = edge(x) - 0.02;
      const p: V3[] = [0, 1, 2, 3, 4].map((k) => [x, e * (1 - k / 2), C(x)]);
      return {
        p,
        color: repeat(pitch, 5),
        uv: p.map((v) => [v[0] / PLANK_TILE, v[1] / PLANK_TILE]),
      };
    });
  }
  // B deck to A: the B deck house, flush; its roof is the A deck.
  band(ctx, {
    x0: L.boatDeckFrom,
    x1: L.bridgeDeckTo,
    zb: B,
    h: hBA,
    yr: full(0),
    wall: white,
    roof: "deck",
    roofColor: pine,
    ends: true,
  });
  // A deck: the house inside the promenade, the screen along the enclosed
  // forward promenade, stanchions along the open after one.
  const slab = 0.32;
  band(ctx, {
    x0: L.boatDeckFrom,
    x1: L.boatDeckTo,
    zb: A,
    h: hABoat - slab,
    yr: full(L.aHouseInset),
    wall: white,
    roof: "none",
    ends: true,
  });
  band(ctx, {
    x0: L.promenadeEnclosedFrom,
    x1: L.boatDeckTo,
    zb: A,
    h: hABoat - slab,
    yr: full(0.05),
    wall: white,
    roof: "none",
    ends: false,
  });
  for (const s of [1, -1]) {
    // The promenade's forward end screen, beside the house front.
    const x = L.boatDeckTo;
    const e = edge(x);
    const p0: V3 = [x, s * (e - L.aHouseInset), A(x)];
    const p1: V3 = [x, s * e, A(x)];
    const pts: V3[] = [
      p0,
      p1,
      [p1[0], p1[1], p1[2] + hABoat - slab],
      [p0[0], p0[1], p0[2] + hABoat - slab],
    ];
    if (inPart(ctx, pts[0]))
      quad(ctx.d.paint, pts as [V3, V3, V3, V3], [1, 0, 0], white);
  }
  for (let x = L.boatDeckFrom + 1.2; x < L.promenadeEnclosedFrom; x += 3.05)
    for (const s of [1, -1]) {
      const c: V3 = [x, s * (edge(x) - 0.16), A(x) + (hABoat - slab) / 2];
      if (inPart(ctx, c))
        box(ctx.d.paint, c, [0.22, 0.22, hABoat - slab], white);
    }
  // The boat deck: a planked slab, white beneath.
  band(ctx, {
    x0: L.boatDeckFrom,
    x1: L.boatDeckTo,
    zb: (x) => Boat(x) - slab,
    h: slab,
    yr: full(0.02),
    wall: white,
    roof: "deck",
    roofColor: pine,
    ends: true,
    under: true,
  });

  // Boat deck houses.
  for (const h of r.houses) buildHouse(ctx, h);
  for (const d of r.domes) {
    const c: V3 = [d.x, 0, d.z];
    if (!inPart(ctx, c)) continue;
    dome(ctx.d.paint, c, d.a, d.b, d.c, 20, 6, rgb(COLORS.glass));
    cylinder(
      ctx.d.paint,
      [d.x, 0, d.z - 0.25],
      [d.x, 0, d.z + 0.05],
      1,
      1,
      24,
      white,
      { start: false, end: false },
      [d.a + 0.15, d.b + 0.15]
    );
  }
  // The navigating bridge's windbreak across the ship.
  {
    const x = L.boatDeckTo - 0.1;
    const e = edge(x);
    const c: V3 = [x, 0, Boat(x) + 0.6];
    if (inPart(ctx, c)) box(ctx.d.paint, c, [0.2, 2 * e, 1.2], white);
  }
  // Docking bridge across the after end of the poop.
  {
    const x = -127.4;
    const z = B(x) + 2.7;
    const e = edge(x) + 0.5;
    const c: V3 = [x, 0, z];
    if (inPart(ctx, c)) {
      box(ctx.d.paint, c, [1.6, 2 * e, 0.22], white);
      box(ctx.d.paint, [x, 0, z + 1.2], [2.4, 3.2, 2.2], white);
      box(ctx.d.paint, [x, 0, z + 2.35], [2.6, 3.4, 0.12], rgb(COLORS.roof));
      for (const s of [1, -1])
        for (const y of [e - 0.4, 2.0])
          box(
            ctx.d.paint,
            [x, s * y, (B(x) + z) / 2],
            [0.18, 0.18, z - B(x)],
            white
          );
      if (ctx.q.rails) {
        for (const dx of [-0.75, 0.75]) {
          addLine(
            ctx,
            [x + dx, -e, z + 1.0],
            [x + dx, e, z + 1.0],
            COLORS.rail
          );
          addLine(
            ctx,
            [x + dx, -e, z + 0.5],
            [x + dx, e, z + 0.5],
            COLORS.rail
          );
        }
      }
    }
  }
}

/**
 * Superstructure from the recipe's tiers (the Lusitania's): each a band
 * following the sheer, flush with the side or set in, a strip (a
 * bulwark), or the hull's own plating carried up (a raised foredeck);
 * then the houses and domes on top.
 */
function buildBlocks(ctx: Ctx, blocks: Block[]): void {
  const { r } = ctx;
  // Every tier samples the deck edge at the same columns: sample it once.
  const edges = new Map<number, number>();
  const edge = (x: number): number => {
    let e = edges.get(x);
    if (e === undefined) {
      e = r.hull.topHalfBreadth(x);
      edges.set(x, e);
    }
    return e;
  };
  for (const b of blocks) {
    const zb = (x: number) => r.deckZ(b.deck, x) + (b.dz ?? 0);
    const R = b.roundFwd ?? 0;
    const hw = (x: number): number => {
      const w = b.halfWidth ?? Math.max(0, edge(x) - (b.inset ?? 0));
      if (R <= 0 || x <= b.x1 - R) return w;
      const t = Math.min(1, (x - (b.x1 - R)) / R);
      return w * Math.sqrt(Math.max(0, 1 - t * t));
    };
    if (b.wall === "plating") {
      platingBlock(ctx, b, zb, hw);
      continue;
    }
    const roof: BandSpec["roof"] =
      b.roof === "pine" || b.roof === "pitch" ? "deck" : b.roof;
    const o: Omit<BandSpec, "yr"> = {
      x0: b.x0,
      x1: b.x1,
      zb,
      h: b.h,
      wall: rgb(
        b.wallColor ?? (b.wall === "shade" ? COLORS.shade : COLORS.white)
      ),
      roof,
      roofColor:
        b.roofColor !== undefined
          ? rgb(b.roofColor)
          : b.roof === "pitch"
            ? rgb(COLORS.pitchPine)
            : b.roof === "pine"
              ? rgb(COLORS.pine)
              : undefined,
      ends: b.ends ?? true,
      under: b.under,
      camber: b.camber,
    };
    const strip = b.strip;
    if (strip) {
      band(ctx, { ...o, yr: (x) => [hw(x) - strip, hw(x)] });
      band(ctx, { ...o, yr: (x) => [-hw(x), -hw(x) + strip] });
    } else {
      band(ctx, { ...o, yr: (x) => [-hw(x), hw(x)] });
    }
  }
  for (const h of r.houses) buildHouse(ctx, h);
  for (const d of r.domes) {
    const c: V3 = [d.x, 0, d.z];
    if (!inPart(ctx, c)) continue;
    dome(ctx.d.paint, c, d.a, d.b, d.c, 20, 6, rgb(COLORS.glass));
    cylinder(
      ctx.d.paint,
      [d.x, 0, d.z - 0.25],
      [d.x, 0, d.z + 0.05],
      1,
      1,
      24,
      rgb(COLORS.white),
      { start: false, end: false },
      [d.a + 0.15, d.b + 0.15]
    );
  }
}

/**
 * The hull's plating carried above the sheer (the hull material, so the
 * plates, rivets and paint run on unbroken), with a planked deck on top.
 */
function platingBlock(
  ctx: Ctx,
  b: Block,
  zb: (x: number) => number,
  hw: (x: number) => number
): void {
  const { r } = ctx;
  const span = r.hull.xMax - r.hull.xMin;
  const rows = [0, 0.5, 1];
  const wall = (x: number, s: 1 | -1): Column => {
    const sheer = r.spec.sheerZ(x);
    const p = rows.map((k): V3 => [
      x,
      s * hw(x),
      zb(x) + b.h * (s > 0 ? k : 1 - k),
    ]);
    // Girth runs down from the deck edge, so it is negative up here.
    const g = p.map((q) => sheer - q[2]);
    return {
      p,
      uv: g.map((v) => [x / PLATE_TILE_X, v / PLATE_TILE_Y]),
      uv1: g.map((v) => [(x - r.hull.xMin) / span, v / 40]),
      extra: repeat(r.sheerLineZ?.(x) ?? sheer, p.length),
    };
  };
  const port = grid(ctx, ctx.d.hull, b.x0, b.x1, (x) => wall(x, 1));
  if (!port) return;
  const stbd = grid(ctx, ctx.d.hull, b.x0, b.x1, (x) => wall(x, -1));
  if (b.roof === "pine" || b.roof === "pitch") {
    const color = rgb(b.roof === "pitch" ? COLORS.pitchPine : COLORS.pine);
    grid(ctx, ctx.d.deck, b.x0, b.x1, (x) => {
      const w = hw(x);
      const p: V3[] = [0, 1, 2, 3, 4].map((k) => [
        x,
        w * (1 - k / 2),
        zb(x) + b.h,
      ]);
      return {
        p,
        color: repeat(color, p.length),
        uv: p.map((v) => [v[0] / PLANK_TILE, v[1] / PLANK_TILE]),
      };
    });
  }
  if (port.cut && port.cutPts && stbd?.cutPts)
    polygon(
      ctx.d.paint,
      [...port.cutPts, ...stbd.cutPts],
      capFacing(ctx),
      rgb(COLORS.interior)
    );
}

function buildHouse(ctx: Ctx, h: House): void {
  const white = rgb(COLORS.white);
  const z = (x: number) => h.z0 + ((h.z1 - h.z0) * (x - h.x0)) / (h.x1 - h.x0);
  band(ctx, {
    x0: h.x0,
    x1: h.x1,
    zb: z,
    h: h.h,
    yr: () => [h.y0, h.y1],
    wall: white,
    roof: h.roof === "skylight" ? "skylight" : "paint",
    ends: true,
  });
}

// ---------------------------------------------------------------------------
// Masts, davits, cranes and deck fittings (all in the paint list).

function buildFittings(ctx: Ctx): void {
  const { r, q } = ctx;
  const paint = ctx.d.paint;
  const white = rgb(COLORS.white);
  const dark = rgb(COLORS.dark);
  const seg = q.cylSeg;

  for (const m of r.masts) {
    const base: V3 = [m.x, 0, m.baseZ];
    if (!inPart(ctx, base)) continue;
    const lean = Math.tan(m.rake);
    const at = (z: number): V3 => [m.x - lean * (z - m.baseZ), 0, z];
    const color = rgb(r.paint?.mast ?? COLORS.mast);
    cylinder(paint, at(m.baseZ - 0.2), at(m.topZ), m.r0, m.r1, seg, color);
    cylinder(
      paint,
      at(m.baseZ),
      at(m.baseZ + 1.0),
      m.r0 + 0.25,
      m.r0 + 0.1,
      seg,
      white
    );
    // Spreaders for the wireless aerial.
    if (m.yard !== false) box(paint, at(m.topZ - 0.6), [0.25, 3.6, 0.2], color);
    if (m.crowsNest) {
      const n = m.crowsNest;
      cylinder(paint, at(n.z), at(n.z + n.h), n.r, n.r, seg + 4, white);
      cylinder(
        paint,
        at(n.z - 0.15),
        at(n.z),
        n.r + 0.15,
        n.r + 0.15,
        seg + 4,
        color
      );
    }
  }

  for (const d of r.davits) {
    const foot: V3 = [d.x, d.footY, d.z];
    if (!inPart(ctx, foot)) continue;
    const s = Math.sign(d.footY);
    box(paint, [d.x, d.footY, d.z + 0.2], [0.6, 0.6, 0.4], white);
    box(paint, [d.x, d.footY - s * 0.35, d.z + 0.75], [0.14, 0.9, 0.9], white);
    tube(
      paint,
      [
        [d.x, d.footY, d.z + 0.3],
        [d.x, d.footY, d.z + 2.9],
        [d.x, d.footY + (d.headY - d.footY) * 0.4, d.z + 4.2],
        [d.x, d.headY, d.z + 4.5],
        [d.x, d.headY, d.z + 4.0],
      ],
      0.13,
      Math.max(5, seg - 4),
      white
    );
  }

  for (const g of r.gantries ?? []) gantry(ctx, g);

  for (const c of r.cranes) {
    if (!inPart(ctx, c.p)) continue;
    const [x, y, z] = c.p;
    const s = c.scale;
    cylinder(
      paint,
      [x, y, z],
      [x, y, z + 2.1 * s],
      0.55 * s,
      0.45 * s,
      seg,
      white
    );
    box(paint, [x, y, z + 2.9 * s], [2.2 * s, 1.7 * s, 1.5 * s], white, c.yaw);
    box(
      paint,
      [x, y, z + 3.7 * s],
      [2.3 * s, 1.8 * s, 0.12],
      rgb(COLORS.roof),
      c.yaw
    );
    // Jibs topped up at rest; the small anchor crane's lies forward.
    const pitch = s < 0.8 ? 0.25 : 0.95;
    const len = 8.2 * s;
    const ox = Math.cos(c.yaw);
    const oy = Math.sin(c.yaw);
    const mid: V3 = [
      x + ox * (0.9 + (len / 2) * Math.cos(pitch)),
      y + oy * (0.9 + (len / 2) * Math.cos(pitch)),
      z + 3.0 * s + (len / 2) * Math.sin(pitch),
    ];
    box(paint, mid, [len, 0.24 * s, 0.3 * s], white, c.yaw, pitch);
  }

  for (const c of r.capstans) {
    if (!inPart(ctx, c.p)) continue;
    const [x, y, z] = c.p;
    const s = c.scale;
    cylinder(
      paint,
      [x, y, z],
      [x, y, z + 0.75 * s],
      0.42 * s,
      0.36 * s,
      seg,
      dark
    );
    cylinder(
      paint,
      [x, y, z + 0.75 * s],
      [x, y, z + 0.9 * s],
      0.5 * s,
      0.5 * s,
      seg,
      dark
    );
  }

  const tarp = rgb(COLORS.tarp);
  for (const h of r.hatches) {
    if (h.coaming) {
      hatchOnCoaming(ctx, h, h.coaming);
      continue;
    }
    const c: V3 = [(h.x0 + h.x1) / 2, 0, h.z + h.h / 2];
    if (!inPart(ctx, c)) continue;
    box(paint, c, [h.x1 - h.x0, 2 * h.hw, h.h], h.color ? rgb(h.color) : tarp);
  }

  for (const b of r.boxes ?? []) {
    if (!inPart(ctx, b.c)) continue;
    box(paint, b.c, b.size, rgb(b.color), b.yaw ?? 0, b.pitch ?? 0);
  }

  // Bow and stern staffs.
  const wood = rgb(COLORS.wood);
  const L = r.layout;
  if (r.staffs) {
    for (const st of r.staffs)
      if (inPart(ctx, st.foot))
        cylinder(paint, st.foot, st.top, 0.1, 0.05, 6, wood);
  } else {
    const jack: V3 = [L.stemX - 0.5, 0, r.deckZ("B", L.stemX - 0.5)];
    if (inPart(ctx, jack))
      cylinder(paint, jack, add(jack, [0.5, 0, 6.5]), 0.09, 0.05, 6, wood);
    const ensign: V3 = [L.sternX + 0.6, 0, r.deckZ("B", L.sternX + 0.6)];
    if (inPart(ctx, ensign))
      cylinder(paint, ensign, add(ensign, [-0.8, 0, 7.5]), 0.1, 0.05, 6, wood);
  }

  // Anchors in their recesses.
  for (const a of r.anchors) {
    if (!inPart(ctx, a.p)) continue;
    if (a.pocket) {
      anchorInPocket(ctx, a.p, a.side, a.pocket);
      continue;
    }
    if (a.hawse) {
      anchorAtHawse(ctx, a.p, a.side);
      continue;
    }
    const s = a.side === "port" ? 1 : -1;
    const [x, , z] = a.p;
    const on = (dx: number, dz: number, out: number): V3 => {
      const hb = r.hull.halfBreadth(x + dx, z + dz);
      return [x + dx, s * (hb + out), z + dz];
    };
    quad(
      paint,
      [
        on(-1.3, -2.1, 0.03),
        on(1.3, -2.1, 0.03),
        on(1.3, 1.6, 0.03),
        on(-1.3, 1.6, 0.03),
      ],
      [0, s, 0],
      rgb(COLORS.interior)
    );
    const anchor = rgb(0x26272a);
    const shankTop = on(0, 1.0, 0.25);
    const shankBot = on(0, -1.6, 0.25);
    box(paint, scale(add(shankTop, shankBot), 0.5), [0.34, 0.3, 2.7], anchor);
    box(paint, add(shankBot, [0, 0, -0.1]), [1.9, 0.38, 0.36], anchor);
    for (const dx of [-0.85, 0.85])
      box(
        paint,
        add(shankBot, [dx, 0, 0.45]),
        [0.42, 0.34, 1.0],
        anchor,
        0,
        dx > 0 ? 0.35 : -0.35
      );
    cylinder(
      paint,
      add(shankTop, [0, 0, 0.1]),
      add(shankTop, [0, 0, 0.45]),
      0.3,
      0.3,
      8,
      anchor
    );
  }
}

/**
 * A stockless bower anchor housed in its hawse pipe against plating
 * that is not black (the Britannic's white bows): the pipe's dark mouth,
 * the shank running down out of it, the crown across the bottom and the
 * two flukes turned up beside the shank, about 4.4 m from the pipe to the
 * crown (a 7¾-ton side anchor; README). No dark recess round it.
 */
function anchorAtHawse(ctx: Ctx, p: V3, side: "port" | "starboard"): void {
  const { r } = ctx;
  const paint = ctx.d.paint;
  const s = side === "port" ? 1 : -1;
  const [x, , z] = p;
  const on = (dx: number, dz: number, out: number): V3 => {
    const hb = r.hull.halfBreadth(x + dx, z + dz);
    return [x + dx, s * (hb + out), z + dz];
  };
  const iron = rgb(0x1b1c1e);
  // The hawse pipe's mouth: a dark ring and the hole.
  const mouth = on(0, 1.4, 0.04);
  const [u, v] = basis([0, s, 0]);
  const ring = (rad: number, off: number): V3[] => {
    const pts: V3[] = [];
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      pts.push(
        add(
          add(mouth, [0, s * off, 0]),
          add(scale(u, Math.cos(a) * rad), scale(v, Math.sin(a) * rad))
        )
      );
    }
    return pts;
  };
  polygon(paint, ring(0.62, 0), [0, s, 0], rgb(0x3a3631));
  polygon(paint, ring(0.45, 0.02), [0, s, 0], rgb(COLORS.interior));
  const shankTop = on(0, 1.2, 0.28);
  const crown = on(0, -2.6, 0.32);
  box(paint, scale(add(shankTop, crown), 0.5), [0.42, 0.36, 3.8], iron);
  box(paint, add(crown, [0, 0, -0.05]), [2.5, 0.46, 0.5], iron);
  for (const dx of [-1.05, 1.05])
    box(
      paint,
      add(crown, [dx * 0.95, 0, 0.75]),
      [0.62, 0.4, 1.6],
      iron,
      0,
      dx > 0 ? 0.38 : -0.38
    );
}

/**
 * A set of gantry davits (the Britannic's): each arm a tapering plate
 * girder from a white pedestal at the deck edge, leaning inboard over the
 * stowed boats, its head curled outboard; a spar joins the two heads.
 */
function gantry(ctx: Ctx, g: GantryRecipe): void {
  const { r, q } = ctx;
  const paint = ctx.d.paint;
  const white = rgb(COLORS.white);
  const arm = rgb(g.color);
  const s = Math.sign(g.footY);
  const seg = Math.max(5, q.cylSeg - 4);
  const [x0, x1] = g.arms;
  if (!inPart(ctx, [g.x, g.footY, g.deckZ])) return;
  const fy = (x: number) => s * (r.hull.topHalfBreadth(x) - 0.5);
  const z0 = (x: number) => r.deckZ("Boat", x);
  const inY = (x: number) => fy(x) - s * g.reach;
  for (const ax of [x0, x1]) {
    box(paint, [ax, fy(ax), z0(ax) + 0.55], [1.1, 1.3, 1.1], white);
    // The girder: a square section, deep at the pivot, leaning inboard.
    cylinder(
      paint,
      [ax, fy(ax), z0(ax) + 1.0],
      [ax, inY(ax), z0(ax) + g.height],
      0.55,
      0.36,
      4,
      arm
    );
  }
  // The head: the arms' tops bend over into a beam fore and aft between
  // them (the falls' runway), its corners rounded.
  const top = (x: number) => z0(x) + g.height;
  const path: V3[] = [
    [x0, inY(x0), top(x0)],
    [x0 + 0.35, inY(x0), top(x0) + 0.75],
    [x0 + 1.2, inY(x0), top(x0) + 1.05],
    [x1 - 1.2, inY(x1), top(x1) + 1.05],
    [x1 - 0.35, inY(x1), top(x1) + 0.75],
    [x1, inY(x1), top(x1)],
  ];
  tube(paint, path, 0.3, seg, arm);
}

/** An open porthole: a dark hole in the plating, its glass swung in. */
function openPort(ctx: Ctx, l: LightSpot): void {
  const [u, v] = basis(l.n);
  const r = Math.min(l.w, l.h) / 2;
  const c = add(l.p, scale(l.n, 0.012));
  const pts: V3[] = [];
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    pts.push(add(c, add(scale(u, Math.cos(a) * r), scale(v, Math.sin(a) * r))));
  }
  polygon(ctx.d.paint, pts, l.n, rgb(COLORS.interior));
}

/**
 * A steel hatch cover on its coaming: the coaming from the deck at side up
 * to the cover, the cover over it, both cut by the tear like the deck.
 */
function hatchOnCoaming(
  ctx: Ctx,
  h: ShipRecipe["hatches"][number],
  coaming: NonNullable<ShipRecipe["hatches"][number]["coaming"]>
): void {
  const mid = (h.x0 + h.x1) / 2;
  const sheer = (x: number) => ctx.r.spec.sheerZ(x) - ctx.r.spec.sheerZ(mid);
  const base = ctx.r.spec.sheerZ(mid);
  band(ctx, {
    x0: mid - coaming.hx,
    x1: mid + coaming.hx,
    zb: (x) => base + sheer(x),
    h: h.z - base,
    yr: () => [-coaming.hw, coaming.hw],
    wall: rgb(coaming.color),
    roof: "none",
    ends: true,
  });
  band(ctx, {
    x0: h.x0,
    x1: h.x1,
    zb: (x) => h.z + sheer(x),
    h: h.h,
    yr: () => [-h.hw, h.hw],
    wall: rgb(h.color ?? COLORS.tarp),
    roof: "paint",
    roofColor: rgb(h.color ?? COLORS.tarp),
    ends: true,
    under: true,
  });
}

/** Bells (the Fitzgerald's on her pilothouse roof), in bronze. */
function buildBells(ctx: Ctx): void {
  for (const b of ctx.r.bells ?? []) {
    if (!inPart(ctx, b.p)) continue;
    const [x, y, z] = b.p;
    const seg = ctx.q.cylSeg + 4;
    const buf = ctx.d.bronze;
    cylinder(
      buf,
      [x, y, z],
      [x, y, z + 0.32],
      b.r,
      b.r * 0.72,
      seg,
      undefined,
      {
        start: false,
        end: false,
      }
    );
    cylinder(
      buf,
      [x, y, z + 0.32],
      [x, y, z + 0.5],
      b.r * 0.72,
      b.r * 0.35,
      seg
    );
    // The yoke it hangs from.
    box(ctx.d.paint, [x, y, z + 0.62], [0.12, 0.5, 0.12], rgb(COLORS.dark));
    const top = z + 0.62;
    for (const dy of [-0.22, 0.22])
      box(
        ctx.d.paint,
        [x, y + dy, (top + b.footZ) / 2],
        [0.08, 0.06, Math.max(0.1, top - b.footZ)],
        rgb(COLORS.dark)
      );
  }
}

/**
 * A laker's anchor pocket: a dark square recess in the bow plating, the
 * stockless anchor housed in it, its shank up into the hawse pipe.
 */
function anchorInPocket(
  ctx: Ctx,
  p: V3,
  side: "port" | "starboard",
  pocket: { w: number; h: number }
): void {
  const { r } = ctx;
  const paint = ctx.d.paint;
  const s = side === "port" ? 1 : -1;
  const [x, , z] = p;
  const on = (dx: number, dz: number, out: number): V3 => {
    const hb = r.hull.halfBreadth(x + dx, z + dz);
    return [x + dx, s * (hb + out), z + dz];
  };
  const W = pocket.w / 2;
  const H = pocket.h / 2;
  // The recess follows the bow's curve in small quads (a flat one would
  // sink into it).
  const n = 4;
  const dark = rgb(COLORS.interior);
  for (let i = 0; i < n; i += 1)
    for (let j = 0; j < n; j += 1) {
      const u0 = -W + (2 * W * i) / n;
      const u1 = -W + (2 * W * (i + 1)) / n;
      const v0 = -H + (2 * H * j) / n;
      const v1 = -H + (2 * H * (j + 1)) / n;
      quad(
        paint,
        [
          on(u0, v0, 0.04),
          on(u1, v0, 0.04),
          on(u1, v1, 0.04),
          on(u0, v1, 0.04),
        ],
        [0, s, 0],
        dark
      );
    }
  // A rim of plating round the pocket.
  const rim = rgb(0x2a1414);
  for (const [a, b] of [
    [on(-W, -H, 0.06), on(W, -H, 0.06)],
    [on(-W, H, 0.06), on(W, H, 0.06)],
  ] as [V3, V3][])
    box(paint, scale(add(a, b), 0.5), [2 * W, 0.12, 0.12], rim);
  const k = pocket.h / 3.2;
  const anchor = rgb(0x26272a);
  const shankTop = on(0, H - 0.15, 0.2);
  const shankBot = on(0, -H + 0.5 * k, 0.2);
  box(
    paint,
    scale(add(shankTop, shankBot), 0.5),
    [0.3 * k, 0.28, shankTop[2] - shankBot[2]],
    anchor
  );
  box(
    paint,
    add(shankBot, [0, 0, -0.12 * k]),
    [1.5 * k, 0.34, 0.32 * k],
    anchor
  );
  for (const dx of [-0.65, 0.65])
    box(
      paint,
      add(shankBot, [dx * k, 0, 0.35 * k]),
      [0.36 * k, 0.3, 0.85 * k],
      anchor,
      0,
      dx > 0 ? 0.35 : -0.35
    );
}

// ---------------------------------------------------------------------------
// Under water: rudder, bossings, propellers.

function buildUnderwater(ctx: Ctx): void {
  const { r, q } = ctx;
  const hullBuf = ctx.d.hull;
  const sheer = (x: number) => r.spec.sheerZ(x);
  const v = (p: V3) =>
    hullBuf.vertex(p, undefined, [0, 0], [0, 0], sheer(p[0]));
  const rudderCentre: V3 = r.rudder.centre ?? [-134, 0, 6];
  if (inPart(ctx, rudderCentre)) {
    const out = r.rudder.outline;
    // Half-thickness at x: even, or tapering from the stock aft.
    const xs = out.map(([x]) => x);
    const xLead = Math.max(...xs);
    const xTrail = Math.min(...xs);
    const taper = r.rudder.taper;
    const t = (x: number): number => {
      if (!taper) return r.rudder.thickness / 2;
      const k = (xLead - x) / Math.max(1e-6, xLead - xTrail);
      return (taper.lead + (taper.trail - taper.lead) * k) / 2;
    };
    const facePort = out.map(([x, z]): V3 => [x, t(x), z]);
    const faceStbd = out.map(([x, z]): V3 => [x, -t(x), z]);
    const flat = (pts: V3[], want: V3) => {
      // Fan from the centroid with the hull's attributes.
      const c = pts.reduce((acc, p) => add(acc, scale(p, 1 / pts.length)), [
        0, 0, 0,
      ] as V3);
      const n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
      const flip = n[1] * want[1] < 0;
      const ci = v(c);
      const ids = pts.map(v);
      for (let i = 0; i < ids.length; i += 1) {
        const a = ids[i];
        const b = ids[(i + 1) % ids.length];
        if (flip) hullBuf.tri(ci, b, a);
        else hullBuf.tri(ci, a, b);
      }
    };
    flat(facePort, [0, 1, 0]);
    flat(faceStbd, [0, -1, 0]);
    for (let i = 0; i < out.length; i += 1) {
      const j = (i + 1) % out.length;
      const a = facePort[i];
      const b = facePort[j];
      const c = faceStbd[j];
      const d = faceStbd[i];
      const mid = scale(add(add(a, b), add(c, d)), 0.25);
      const outward = sub(mid, rudderCentre);
      const n = cross(sub(b, a), sub(d, a));
      const ids = [a, b, c, d].map(v);
      if (n[0] * outward[0] + n[2] * outward[2] >= 0) {
        hullBuf.tri(ids[0], ids[1], ids[2]);
        hullBuf.tri(ids[0], ids[2], ids[3]);
      } else {
        hullBuf.tri(ids[0], ids[2], ids[1]);
        hullBuf.tri(ids[0], ids[3], ids[2]);
      }
    }
    // Rudder post and the sole piece under the propeller aperture.
    const post = new GeoBuffer({ uv: true, uv1: true, extra: "aSheer" });
    const stock = r.rudder.stock;
    if (stock)
      cylinder(
        post,
        [stock.x, 0, stock.z0],
        [stock.x, 0, stock.z1],
        stock.r,
        stock.r,
        q.cylSeg + 4
      );
    if (r.rudder.posts) {
      for (const p of r.rudder.posts) box(post, p.c, p.size);
    } else if (!stock) {
      box(post, [-131.9, 0, 6.6], [0.55, 0.62, 12.2]);
      box(post, [-130.9, 0, 0.35], [2.6, 0.62, 0.7]);
    }
    mergeInto(hullBuf, post, sheer);
  }
  for (const b of r.bossings) {
    if (!inPart(ctx, b.to)) continue;
    // A break across a bossing leaves it with the propeller, torn short.
    let from = b.from;
    if (ctx.part === "stern" && ctx.breakX !== null)
      from = [Math.min(from[0], ctx.breakX - TEAR_AMPLITUDE), from[1], from[2]];
    if (from[0] <= b.to[0] + 1) continue;
    const tmp = new GeoBuffer({ uv: true, uv1: true, extra: "aSheer" });
    cylinder(tmp, from, b.to, b.r0, b.r1, q.cylSeg + 4, undefined, {
      start: false,
      end: true,
    });
    mergeInto(hullBuf, tmp, sheer);
  }
  for (const p of r.propellers) {
    if (!inPart(ctx, p.hub)) continue;
    buildPropeller(ctx.d.bronze, p.hub, p.radius, p.blades, p.phase, q.cylSeg);
  }
}

/** Copies a buffer's triangles into the hull list (zero uvs, own sheer). */
function mergeInto(
  dst: GeoBuffer,
  src: GeoBuffer,
  sheer: (x: number) => number
): void {
  const base = dst.vertexCount;
  for (let i = 0; i < src.vertexCount; i += 1) {
    const x = src.pos[i * 3];
    const yThree = src.pos[i * 3 + 1];
    const zThree = src.pos[i * 3 + 2];
    dst.vertex([x, -zThree, yThree], undefined, [0, 0], [0, 0], sheer(x));
  }
  for (const i of src.idx) dst.idx.push(base + i);
}

function buildPropeller(
  buf: GeoBuffer,
  hub: V3,
  radius: number,
  blades: number,
  phase: number,
  seg: number
): void {
  cylinder(
    buf,
    add(hub, [0.75, 0, 0]),
    add(hub, [-0.55, 0, 0]),
    0.42,
    0.55,
    seg
  );
  cylinder(
    buf,
    add(hub, [-0.55, 0, 0]),
    add(hub, [-1.5, 0, 0]),
    0.55,
    0.12,
    seg,
    undefined,
    { start: false, end: true }
  );
  const pitchLen = 1.15 * 2 * radius;
  const spans = 7;
  for (let k = 0; k < blades; k += 1) {
    const th = phase + (k / blades) * Math.PI * 2;
    const ids: number[][] = [];
    for (let i = 0; i <= spans; i += 1) {
      const t = i / spans;
      const rr = 0.5 + (radius - 0.5) * t;
      const chord =
        radius *
        (0.32 + 0.5 * Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.05)) ** 0.7) *
        (1 - 0.65 * t * t * t);
      const phi = Math.atan2(pitchLen, 2 * Math.PI * rr);
      const skew = 0.35 * radius * t * t;
      const radial: V3 = [0, Math.cos(th), Math.sin(th)];
      const tangent: V3 = [0, -Math.sin(th), Math.cos(th)];
      const c = add(add(hub, scale(radial, rr)), scale(tangent, -skew));
      // The blade's chord: mostly round the hub, leaning along the shaft.
      const dir = add(
        scale(tangent, Math.cos(phi)),
        scale([1, 0, 0], -Math.sin(phi))
      );
      const half = (chord / 2) * (t > 0.97 ? 0.4 : 1);
      ids.push([
        buf.vertex(add(c, scale(dir, half))),
        buf.vertex(add(c, scale(dir, -half))),
      ]);
    }
    for (let i = 0; i < spans; i += 1) {
      buf.tri(ids[i][0], ids[i + 1][0], ids[i + 1][1]);
      buf.tri(ids[i][0], ids[i + 1][1], ids[i][1]);
    }
  }
}

// ---------------------------------------------------------------------------
// Names on the bow and the counter.

function buildNames(ctx: Ctx): void {
  const { r } = ctx;
  const buf = ctx.d.decal;
  for (const n of r.names) {
    const centre: V3 = n.where === "bow" ? [n.x, 0, n.z] : [n.x + 2, 0, n.z];
    if (!inPart(ctx, centre)) continue;
    const cols = 16;
    const pts: V3[][] = [];
    const uvs: [number, number][][] = [];
    // Bow names use the top half of the texture, the stern the bottom half.
    const v0 = n.where === "bow" ? 0.5 : 0;
    // Rows up the board: its two edges, or more where it curves in height.
    const ks = n.rows
      ? Array.from({ length: n.rows + 1 }, (_, j) => j / n.rows!)
      : [0, 1];
    for (let i = 0; i <= cols; i += 1) {
      const u = i / cols;
      const row: V3[] = [];
      const rowUv: [number, number][] = [];
      for (const k of ks) {
        const z = n.z + (k - 0.5) * n.height;
        if (n.side === "aft") {
          // Round the counter: port on the left as you look forward. Stand
          // off along the surface's normal (not just aft), or the letters
          // sink into the hull where the counter curves round to the sides.
          const y = (0.5 - u) * n.width;
          const e = 0.05;
          const slope =
            (counterX(r, y + e, z) - counterX(r, y - e, z)) / (2 * e);
          const len = Math.hypot(1, slope);
          const off = 0.07;
          row.push([counterX(r, y, z) - off / len, y + (off * slope) / len, z]);
        } else {
          const s = n.side === "port" ? 1 : -1;
          // Read left to right from outboard: aft-to-fore to starboard.
          const x = n.x + (n.side === "port" ? 0.5 - u : u - 0.5) * n.width;
          // Above the sheer (a raised foredeck's plating) the side is
          // upright at the deck edge's breadth.
          const hb =
            z > r.hull.zTop(x)
              ? r.hull.topHalfBreadth(x)
              : r.hull.halfBreadth(x, z);
          row.push([x, s * (hb + 0.035), z]);
        }
        rowUv.push([u, v0 + k * 0.5]);
      }
      pts.push(row);
      uvs.push(rowUv);
    }
    const want: V3 =
      n.side === "aft"
        ? [-1, 0, 0]
        : n.side === "port"
          ? [0, 1, 0]
          : [0, -1, 0];
    const normal = cross(sub(pts[1][0], pts[0][0]), sub(pts[0][1], pts[0][0]));
    const flip = normal[0] * want[0] + normal[1] * want[1] < 0;
    const ids = pts.map((row, i) =>
      row.map((p, k) => buf.vertex(p, undefined, uvs[i][k]))
    );
    for (let i = 0; i < cols; i += 1)
      for (let j = 0; j < ks.length - 1; j += 1) {
        const a = ids[i][j];
        const b = ids[i + 1][j];
        const c = ids[i + 1][j + 1];
        const d = ids[i][j + 1];
        if (flip) {
          buf.tri(a, c, b);
          buf.tri(a, d, c);
        } else {
          buf.tri(a, b, c);
          buf.tri(a, c, d);
        }
      }
  }
}

/**
 * The counter's surface x at (y, z), by bisection near the stern. On the
 * centre line it is where the hull starts at that height (any breadth at
 * all), not the counter's tip below or above it.
 */
export function counterX(r: ShipRecipe, y: number, z: number): number {
  let lo = r.hull.xMin;
  let hi = r.hull.xMin + 30;
  const target = Math.max(Math.abs(y), 0.05);
  for (let i = 0; i < 30; i += 1) {
    const mid = (lo + hi) / 2;
    if (r.hull.halfBreadth(mid, z) >= target) hi = mid;
    else lo = mid;
  }
  return hi;
}

// ---------------------------------------------------------------------------
// Lines and instances.

function addLine(ctx: Ctx, a: V3, b: V3, hex: number): void {
  if (!inPart(ctx, a) || !inPart(ctx, b)) return;
  const c = rgb(hex);
  ctx.d.lines.pos.push(a[0], a[2], -a[1], b[0], b[2], -b[1]);
  ctx.d.lines.col.push(...c, ...c);
}

function buildLinesAndInstances(ctx: Ctx): void {
  const { r, q } = ctx;
  if (q.rails) {
    for (const run of r.rails) {
      const pts = run.points;
      for (let i = 0; i < pts.length - 1; i += 1)
        for (const hgt of [1.05, 0.55])
          addLine(
            ctx,
            add(pts[i], [0, 0, hgt]),
            add(pts[i + 1], [0, 0, hgt]),
            run.color ?? COLORS.rail
          );
    }
  }
  if (q.smallFittings) {
    for (const run of r.rails)
      for (const p of run.points) if (inPart(ctx, p)) ctx.d.posts.push(p);
    ctx.d.benches = r.benches.filter((b) => inPart(ctx, b.p));
    ctx.d.bollards = r.bollards.filter((b) => inPart(ctx, b.p));
  }
  if (q.vents) {
    ctx.d.vents = r.vents.filter((v) => inPart(ctx, v.p));
    ctx.d.drums = (r.drums ?? []).filter((v) => inPart(ctx, v.p));
  }
  if (q.rigging) {
    for (const w of r.wires)
      addLine(ctx, w.a, w.b, w.kind === "aerial" ? COLORS.rig : COLORS.rig);
  }
  for (const l of r.lights) {
    if (!inPart(ctx, l.p)) continue;
    if (l.open) openPort(ctx, l);
    else (l.kind === "porthole" ? ctx.d.portholes : ctx.d.windows).push(l);
  }
  r.funnels.forEach((f, i) => {
    if (inPart(ctx, [f.x, 0, f.baseZ])) ctx.d.funnels.push(i);
  });
  r.boats.forEach((b, i) => {
    if (inPart(ctx, [b.x, b.y, b.z])) ctx.d.boats.push(i);
  });
}

/** Wires of one funnel's guys as a line list (three.js frame). */
export function guyLines(wires: Wire[]): LineList {
  const c = rgb(COLORS.rig);
  const out: LineList = { pos: [], col: [] };
  for (const w of wires) {
    out.pos.push(w.a[0], w.a[2], -w.a[1], w.b[0], w.b[2], -w.b[1]);
    out.col.push(...c, ...c);
  }
  return out;
}

// ---------------------------------------------------------------------------

export function buildShipPart(
  r: ShipRecipe,
  part: ShipPart,
  breakX: number | null,
  quality: ModelQuality
): ShipPartData {
  const q = QUALITY[quality];
  const d: ShipPartData = {
    part,
    hull: new GeoBuffer({ uv: true, uv1: true, extra: "aSheer" }),
    paint: new GeoBuffer({ color: true }),
    deck: new GeoBuffer({ color: true, uv: true }),
    bronze: new GeoBuffer(),
    decal: new GeoBuffer({ uv: true }),
    portholes: [],
    windows: [],
    vents: [],
    drums: [],
    benches: [],
    bollards: [],
    posts: [],
    lines: { pos: [], col: [] },
    funnels: [],
    boats: [],
  };
  const ctx: Ctx = {
    r,
    part,
    breakX: part === "whole" ? null : breakX,
    q,
    cols: columnStations(r, q.colStep),
    d,
  };
  buildHull(ctx);
  buildSuperstructure(ctx);
  buildFittings(ctx);
  buildUnderwater(ctx);
  buildBells(ctx);
  buildNames(ctx);
  buildLinesAndInstances(ctx);
  return d;
}

// ---------------------------------------------------------------------------
// The hinge (a bow that bends: `ShipRecipe.hinge`).

/** The triangles of `src` whose middles lie forward of x (or aft). */
function splitBuffer(src: GeoBuffer, x: number, fwd: boolean): GeoBuffer {
  const out = new GeoBuffer(src.opts);
  const map = new Map<number, number>();
  const { pos, col, uv, uv1, extra, idx } = src;
  const copy = (i: number): number => {
    let j = map.get(i);
    if (j !== undefined) return j;
    j = out.vertexCount;
    out.pos.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    if (src.opts.color)
      out.col.push(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]);
    if (src.opts.uv) out.uv.push(uv[i * 2], uv[i * 2 + 1]);
    if (src.opts.uv1) out.uv1.push(uv1[i * 2], uv1[i * 2 + 1]);
    if (src.opts.extra) out.extra.push(extra[i]);
    map.set(i, j);
    return j;
  };
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t];
    const b = idx[t + 1];
    const c = idx[t + 2];
    const mid = (pos[a * 3] + pos[b * 3] + pos[c * 3]) / 3;
    if (mid > x !== fwd) continue;
    out.idx.push(copy(a), copy(b), copy(c));
  }
  return out;
}

/**
 * The whole ship's part data cut at x into what stays (aft) and the bow
 * that bends (forward): every triangle, light, fitting and line goes by
 * where its middle is. The bow keeps no funnels or boats (none stand
 * forward of a hinge in the well deck).
 */
export function splitAtHinge(
  d: ShipPartData,
  x: number
): { aft: ShipPartData; fwd: ShipPartData } {
  const half = (fwd: boolean): ShipPartData => {
    const keep = (p: V3) => p[0] > x === fwd;
    const lines: LineList = { pos: [], col: [] };
    for (let i = 0; i < d.lines.pos.length; i += 6) {
      const mid = (d.lines.pos[i] + d.lines.pos[i + 3]) / 2;
      if (mid > x !== fwd) continue;
      lines.pos.push(...d.lines.pos.slice(i, i + 6));
      lines.col.push(...d.lines.col.slice(i, i + 6));
    }
    return {
      part: d.part,
      hull: splitBuffer(d.hull, x, fwd),
      paint: splitBuffer(d.paint, x, fwd),
      deck: splitBuffer(d.deck, x, fwd),
      bronze: splitBuffer(d.bronze, x, fwd),
      decal: splitBuffer(d.decal, x, fwd),
      portholes: d.portholes.filter((l) => keep(l.p)),
      windows: d.windows.filter((l) => keep(l.p)),
      vents: d.vents.filter((v) => keep(v.p)),
      drums: d.drums.filter((v) => keep(v.p)),
      benches: d.benches.filter((v) => keep(v.p)),
      bollards: d.bollards.filter((v) => keep(v.p)),
      posts: d.posts.filter(keep),
      lines,
      funnels: fwd ? [] : d.funnels,
      boats: fwd ? [] : d.boats,
    };
  };
  return { aft: half(false), fwd: half(true) };
}
