import type { Blocker, Seam, V2 } from "../walk/types";
import {
  MODERN_PIECE_FOOTPRINT,
  seatRowFootprint,
  type ModernPieceId,
} from "./modernPieces";
import type { Furniture, PieceId } from "./types";

/**
 * The room kit's helpers: they build outlines so a ship's data stays short
 * and correct (see README.md). Pure; every helper returns new arrays.
 */

/** Doorways are at least this wide (m): real ones were about 0.75 m. */
export const DOOR_MIN_M = 1.1;
/** Reflex corners are cut back this far along each edge (m). */
export const CHAMFER_M = 0.15;
/** How near two points count as the same (m), as the walker's seams. */
const TOL = 1e-3;

/** A room's shape before its look: what the helpers build. */
export interface RoomShape {
  id: string;
  outline: readonly V2[];
  axis?: readonly [V2, V2];
  ramp?: { from: V2; to: V2; dropM: number };
}

/** Twice-halved shoelace: positive for a counter-clockwise outline. */
export function signedArea(poly: readonly V2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

/** The box `width` wide round from → to, counter-clockwise. */
function strip(from: V2, to: V2, width: number): V2[] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  if (!(len > 0) || !(width > 0)) throw new Error("strip: empty");
  // Half the width along the left normal.
  const nx = (-dy / len) * (width / 2);
  const ny = (dx / len) * (width / 2);
  return [
    [from[0] - nx, from[1] - ny],
    [to[0] - nx, to[1] - ny],
    [to[0] + nx, to[1] + ny],
    [from[0] + nx, from[1] + ny],
  ];
}

/** A corridor `width` wide along from → to (its axis). */
export function corridor(
  id: string,
  from: V2,
  to: V2,
  width: number
): RoomShape {
  return { id, outline: strip(from, to, width), axis: [from, to] };
}

/** A box room between two corners. */
export function cabin(id: string, min: V2, max: V2): RoomShape {
  if (!(max[0] > min[0] && max[1] > min[1])) throw new Error(`cabin ${id}`);
  return {
    id,
    outline: [
      [min[0], min[1]],
      [max[0], min[1]],
      [max[0], max[1]],
      [min[0], max[1]],
    ],
  };
}

/**
 * A flight of stairs `width` wide from its top (centre of the top step)
 * to its bottom, falling dropM: a ramp, with the centre line as its axis.
 */
export function flight(
  id: string,
  top: V2,
  bottom: V2,
  width: number,
  dropM: number
): RoomShape {
  return {
    id,
    outline: strip(top, bottom, width),
    axis: [top, bottom],
    ramp: { from: top, to: bottom, dropM },
  };
}

/** Where `at` falls along a→b (0..1), and how far off the line it is. */
function along(p: V2, a: V2, b: V2): { u: number; off: number; len: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const u = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (len * len);
  const off = Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len;
  return { u, off, len };
}

function same(p: V2, q: V2): boolean {
  return Math.abs(p[0] - q[0]) <= TOL && Math.abs(p[1] - q[1]) <= TOL;
}

/** The edge of `poly` holding the whole segment p–q, or -1. */
function edgeHolding(poly: readonly V2[], p: V2, q: V2): number {
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const P = along(p, a, b);
    const Q = along(q, a, b);
    const slack = TOL / P.len;
    if (P.off > TOL || Q.off > TOL) continue;
    if (P.u < -slack || P.u > 1 + slack || Q.u < -slack || Q.u > 1 + slack)
      continue;
    return i;
  }
  return -1;
}

/** Inserts p and q into edge i (in the edge's order), snapping to corners. */
function cut(poly: readonly V2[], i: number, p: V2, q: V2): V2[] {
  const a = poly[i];
  const b = poly[(i + 1) % poly.length];
  const [first, second] =
    along(p, a, b).u <= along(q, a, b).u ? [p, q] : [q, p];
  const add = [first, second].filter((v) => !same(v, a) && !same(v, b));
  return [...poly.slice(0, i + 1), ...add, ...poly.slice(i + 1)];
}

/** Snaps a point to a corner of either outline when within TOL. */
function snap(v: V2, polys: readonly (readonly V2[])[]): V2 {
  for (const poly of polys) for (const c of poly) if (same(v, c)) return c;
  return v;
}

/**
 * A doorway `width` wide (at least DOOR_MIN_M) centred on `at`, on the wall
 * rooms a and b share: cuts the opening into both outlines (as matching
 * edges) and returns the seam. Throws when the rooms share no wall there or
 * the opening is wider than it. The opening may be a whole edge (a flight
 * opening onto a landing): corners are reused, never doubled.
 */
export function doorway<A extends RoomShape, B extends RoomShape>(
  a: A,
  b: B,
  at: V2,
  width: number
): { a: A; b: B; seam: Seam } {
  const w = Math.max(width, DOOR_MIN_M);
  // The wall's direction: the edge of a under `at`.
  for (let i = 0; i < a.outline.length; i += 1) {
    const e0 = a.outline[i];
    const e1 = a.outline[(i + 1) % a.outline.length];
    const { u, off, len } = along(at, e0, e1);
    if (off > TOL || u < 0 || u > 1) continue;
    const ux = (e1[0] - e0[0]) / len;
    const uy = (e1[1] - e0[1]) / len;
    const p = snap(
      [at[0] - (ux * w) / 2, at[1] - (uy * w) / 2],
      [a.outline, b.outline]
    );
    const q = snap(
      [at[0] + (ux * w) / 2, at[1] + (uy * w) / 2],
      [a.outline, b.outline]
    );
    if (edgeHolding(a.outline, p, q) !== i) continue;
    const j = edgeHolding(b.outline, p, q);
    if (j < 0) continue;
    return {
      a: { ...a, outline: cut(a.outline, i, p, q) },
      b: { ...b, outline: cut(b.outline, j, p, q) },
      seam: { a: a.id, b: b.id, at: [p, q] },
    };
  }
  throw new Error(
    `doorway ${a.id}↔${b.id} at ${at.join(", ")}: no shared wall ${w} m wide`
  );
}

/**
 * Cuts every reflex corner of a counter-clockwise outline back by `cut`
 * along both its edges (so no corner can hold the walker), except corners
 * listed in `keep` (a seam's ends: the seam must still match). Convex and
 * straight corners are left alone. Throws when a cut would run past the
 * next corner.
 */
export function chamferReflex(
  outline: readonly V2[],
  keep: readonly V2[] = [],
  cut = CHAMFER_M
): V2[] {
  const n = outline.length;
  const reflex = outline.map((c, i) => {
    const p = outline[(i + n - 1) % n];
    const q = outline[(i + 1) % n];
    const turn = (c[0] - p[0]) * (q[1] - c[1]) - (c[1] - p[1]) * (q[0] - c[0]);
    return turn < -1e-9 && !keep.some((k) => same(k, c));
  });
  for (let i = 0; i < n; i += 1) {
    const a = outline[i];
    const b = outline[(i + 1) % n];
    const need = cut * (Number(reflex[i]) + Number(reflex[(i + 1) % n]));
    if (need > 0 && Math.hypot(b[0] - a[0], b[1] - a[1]) <= need + 1e-6)
      throw new Error(`chamferReflex: edge ${i} is shorter than its cut`);
  }
  const out: V2[] = [];
  for (let i = 0; i < n; i += 1) {
    const c = outline[i];
    if (!reflex[i]) {
      out.push(c);
      continue;
    }
    for (const o of [outline[(i + n - 1) % n], outline[(i + 1) % n]]) {
      const len = Math.hypot(o[0] - c[0], o[1] - c[1]);
      out.push([
        c[0] + ((o[0] - c[0]) / len) * cut,
        c[1] + ((o[1] - c[1]) / len) * cut,
      ]);
    }
  }
  return out;
}

/**
 * The floor footprint of each piece that can block the walker (m): its
 * extent along x and y at yaw 0; a quarter turn swaps them. A piece is
 * centred on its footprint, its back (the wall side) to −x and its front
 * to +x; a bed's (or a bunk's) yaw points from its head to its foot, and a
 * bunk's ladder is on its right (−y), away from the wall on its left.
 */
export const PIECE_FOOTPRINT: Partial<
  Record<PieceId, { lx: number; ly: number }>
> = {
  bed: { lx: 2.0, ly: 1.5 },
  "single-bed": { lx: 2.0, ly: 0.95 },
  bunk: { lx: 1.9, ly: 0.8 },
  wardrobe: { lx: 0.6, ly: 1.2 },
  washstand: { lx: 0.5, ly: 0.9 },
  washbasin: { lx: 0.45, ly: 0.6 },
  sofa: { lx: 0.8, ly: 1.9 },
  table: { lx: 1.0, ly: 1.0 },
};

/**
 * A piece's footprint: the Edwardian table's, else the modern one's
 * (`MODERN_PIECE_FOOTPRINT`: the pool's basin, a lounger), or undefined.
 */
export function pieceFootprint(
  piece: PieceId
): { lx: number; ly: number } | undefined {
  return (
    PIECE_FOOTPRINT[piece] ??
    (
      MODERN_PIECE_FOOTPRINT as Partial<
        Record<string, { lx: number; ly: number }>
      >
    )[piece as ModernPieceId]
  );
}

/**
 * A placed piece's footprint: its piece's, except a theatre seat row of
 * `seats` seats (`seatRowFootprint`), or undefined.
 */
export function furnitureFootprint(
  f: Pick<Furniture, "piece" | "seats">
): { lx: number; ly: number } | undefined {
  if (f.piece === "theatre-seat-row" && f.seats !== undefined)
    return seatRowFootprint(f.seats);
  return pieceFootprint(f.piece);
}

/** A blocking piece's blocker (a box in its room), or null. */
export function pieceBlocker(f: Furniture): Blocker | null {
  if (!f.blocks) return null;
  const fp = furnitureFootprint(f);
  if (!fp) throw new Error(`piece ${f.piece} has no footprint to block with`);
  const quarter = Math.round(f.yaw / (Math.PI / 2));
  const turned = Math.abs(quarter) % 2 === 1;
  const hx = (turned ? fp.ly : fp.lx) / 2;
  const hy = (turned ? fp.lx : fp.ly) / 2;
  return {
    kind: "box",
    area: f.room,
    min: [f.at[0] - hx, f.at[1] - hy],
    max: [f.at[0] + hx, f.at[1] + hy],
  };
}
