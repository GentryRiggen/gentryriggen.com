import type { ShipSpec } from "../ships/types";
import { DECK_SAMPLE_S, GRAV } from "./constants";
import { type Cell, type DeckSea, headLevel, orifice } from "./flooding";
import { type HullModel, hullHalfBreadth } from "./geometry";
import { boardingElevation, boardingRow } from "./waves";

// Local bindings: global lookups are slow inside test sandboxes (vm).
const { abs, max, min, pow, round, sqrt } = Math;

/**
 * Green water on her deck (1.2). A laker's spar deck has open rails and
 * no bulwark, so a sea that tops her deck edge does not just touch the
 * openings it stands over: it pours onto the deck, spreads, stands round
 * the hatch coamings and the vents for a few seconds and runs back off
 * over the edges. Here the open deck between her houses is a row of bays
 * (`ShipSpec.openDeck`: one a hatch, 24 ft), each holding a volume of
 * water under a level surface on her cambered deck, tilted with her list,
 * trim and ride.
 *
 * - Onto the deck: the sea over an edge (its relative height: the
 *   second-order sea `boardingElevation` less the edge riding with her)
 *   flows on as a dam break, q = (8/27)·√g·h^1.5 per metre of edge, h the
 *   sea's height over the edge (Ritter's dam-break discharge at the dam;
 *   the flow-onto-deck model of Goda, Miyamoto & Yamamoto, Rep. Port and
 *   Harbour Res. Inst. 15(3), 1976; Zhou, De Kat & Buchner, "A nonlinear
 *   3-D approach to simulate green water dynamics on deck", 7th Int.
 *   Conf. Numer. Ship Hydrodyn., 1999; Buchner, "Green water on ship-type
 *   offshore structures", PhD thesis, TU Delft, 2002).
 * - Off the deck: water standing over an edge runs off at critical depth,
 *   q = √g·(2h/3)^1.5 per metre (a broad-crested weir, free overfall).
 *   Both are drowned (Villemonte, (1 − (h₂/h₁)^1.5)^0.385) by the water on
 *   the other side.
 * - Along the deck: between neighbouring bays the same weir, its crest
 *   the low deck edge at their boundary, the breadth the upper bay's
 *   wetted breadth: water runs down her trim.
 * - Into her: every hatch-cover gap and vent standing in it sees the deck
 *   water's head (the larger of that and a crest standing over it), and
 *   what flows in leaves the bay.
 *
 * The deck water's weight is left out of her trim and list (the body sums
 * the water in its cells): in the real storm it averages 27–43 m³ from
 * 6:00 to 7:10 PM (the deck wet 48–65% of the time), and leaving it out
 * omits about 0.2° of heel.
 * The hatch coamings' footprint (11 ft of 75 ft across) is not taken out
 * of a bay's area.
 */

/** Onto the deck (dam break): (8/27)·√g. */
export const DECK_ON_CW = (8 / 27) * sqrt(GRAV);
/** Off the deck (critical flow over the edge): √g·(2/3)^1.5. */
export const DECK_OFF_CW = sqrt(GRAV) * pow(2 / 3, 1.5);

export interface DeckWater {
  n: number;
  /** Each bay's ends and its sample point (ship x), aft to forward. */
  x0: Float64Array;
  x1: Float64Array;
  xm: Float64Array;
  /** Spacing of the sample points (uniform). */
  step: number;
  /** Half-breadth of the deck at side and its height (ship frame). */
  hb: Float64Array;
  zEdge: Float64Array;
  camber: number;
  /** Water on each bay (m³) and its surface (earth z; −∞ dry). */
  vol: Float64Array;
  level: Float64Array;
  /** This sample: the deck's earth z at each edge and the centre line,
   *  the sea over the edges and the centre line, and the changes. */
  zs: Float64Array;
  zp: Float64Array;
  zc: Float64Array;
  seaS: Float64Array;
  seaP: Float64Array;
  seaC: Float64Array;
  scratch: Float64Array;
  dv: Float64Array;
}

/** Her open deck as bays, or null without one. */
export function makeDeckWater(
  spec: ShipSpec,
  hull: HullModel
): DeckWater | null {
  const d = spec.openDeck;
  if (!d || d.bayX.length < 1) return null;
  const n = d.bayX.length;
  const f = (k: number) => new Float64Array(k);
  const w: DeckWater = {
    n,
    x0: f(n),
    x1: f(n),
    xm: f(n),
    step: n > 1 ? (d.bayX[n - 1] - d.bayX[0]) / (n - 1) : 1,
    hb: f(n),
    zEdge: f(n),
    camber: d.camberM,
    vol: f(n),
    level: f(n).fill(-Infinity),
    zs: f(n),
    zp: f(n),
    zc: f(n),
    seaS: f(n),
    seaP: f(n),
    seaC: f(n),
    scratch: f(n),
    dv: f(n),
  };
  for (let i = 0; i < n; i += 1) {
    const x = d.bayX[i];
    if (i > 0 && abs(x - d.bayX[i - 1] - w.step) > 0.02)
      throw new Error("openDeck.bayX must be evenly spaced, aft to forward");
    w.xm[i] = x;
    w.x0[i] = i === 0 ? d.fromX : (d.bayX[i - 1] + x) / 2;
    w.x1[i] = i === n - 1 ? d.toX : (x + d.bayX[i + 1]) / 2;
    const top = spec.sheerZ(x);
    w.zEdge[i] = top;
    w.hb[i] = hullHalfBreadth(hull, x, top - 0.05);
  }
  return w;
}

/** Wetted cross-section (m²) of a straight deck strip under level L. */
function stripArea(L: number, z0: number, z1: number, wd: number): number {
  const lo = min(z0, z1);
  const hi = max(z0, z1);
  if (L <= lo) return 0;
  if (L >= hi) return wd * (L - (z0 + z1) / 2);
  return ((L - lo) * (L - lo) * wd) / (2 * (hi - lo));
}

function stripWidth(L: number, z0: number, z1: number, wd: number): number {
  const lo = min(z0, z1);
  const hi = max(z0, z1);
  if (L <= lo) return 0;
  if (L >= hi) return wd;
  return (wd * (L - lo)) / (hi - lo);
}

/** Wetted breadth of bay i under level L. */
function bayWidth(w: DeckWater, i: number, L: number): number {
  return (
    stripWidth(L, w.zs[i], w.zc[i], w.hb[i]) +
    stripWidth(L, w.zc[i], w.zp[i], w.hb[i])
  );
}

/** The level (earth z) that holds `area` m² over bay i's section. */
function levelFor(w: DeckWater, i: number, area: number): number {
  return deckLevel(w.zs[i], w.zc[i], w.zp[i], w.hb[i], area);
}

/**
 * The level (earth z) that holds `area` m² of water across a bay's deck
 * section: its starboard edge at earth z `zs`, its centre line at `zc`,
 * its port edge at `zp`, `hb` its half-breadth (the scene draws the deck
 * water at it).
 */
export function deckLevel(
  zs: number,
  zc: number,
  zp: number,
  hb: number,
  area: number
): number {
  const zmin = min(zs, zp, zc);
  const zmax = max(zs, zp, zc);
  let lo = zmin;
  let hi = zmax + area / max(1e-6, 2 * hb);
  for (let k = 0; k < 40; k += 1) {
    const mid = (lo + hi) / 2;
    if (stripArea(mid, zs, zc, hb) + stripArea(mid, zc, zp, hb) < area)
      lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Villemonte's drowned-weir factor. */
function drown(h1: number, h2: number): number {
  if (h2 <= 0) return 1;
  return pow(max(0, 1 - pow(h2 / h1, 1.5)), 0.385);
}

/**
 * Flow onto the deck (m³/s, + on) over an edge `len` m long at earth z
 * `e`, the sea at `sea` and the deck water at `level`.
 */
function edgeFlow(sea: number, level: number, e: number, len: number): number {
  const hs = sea - e;
  const hd = level - e;
  if (hs <= 0 && hd <= 0) return 0;
  if (hs >= hd) return DECK_ON_CW * len * pow(hs, 1.5) * drown(hs, hd);
  return -DECK_OFF_CW * len * pow(hd, 1.5) * drown(hd, hs);
}

/** Total water on her deck (m³). */
export function deckWaterVolume(w: DeckWater | null): number {
  if (!w) return 0;
  let v = 0;
  for (let i = 0; i < w.n; i += 1) v += w.vol[i];
  return v;
}

/**
 * One deck sample of length h at real time ts: the deck's earth heights
 * (her pose plus ride), the sea along both edges and the centre line, the
 * water's levels, and the flows over the edges and between bays into
 * `dv` (m³; applied by `applyDeck` after the openings draw on it).
 */
function sampleDeck(
  w: DeckWater,
  bx: number,
  by: number,
  bz: number,
  cp: number,
  sp: number,
  cr: number,
  sr: number,
  rh: number,
  rp: number,
  rr: number,
  sea: DeckSea,
  ts: number,
  h: number
): void {
  const n = w.n;
  for (let i = 0; i < n; i += 1) {
    const x = w.xm[i];
    const y = w.hb[i];
    const ze = w.zEdge[i];
    const base = bz - sp * x + cp * cr * ze + rh - x * rp;
    w.zs[i] = base - cp * sr * y - y * rr;
    w.zp[i] = base + cp * sr * y + y * rr;
    w.zc[i] = base + cp * cr * w.camber;
    w.dv[i] = 0;
  }
  const storm = sea.storm;
  if (storm) {
    const x0 = w.xm[0];
    const y0 = w.hb[0];
    const z0 = w.zEdge[0];
    const dx = cp * w.step;
    boardingRow(
      storm,
      bx + cp * x0 - sp * sr * y0 + sp * cr * z0,
      by - cr * y0 - sr * z0,
      dx,
      0,
      n,
      ts,
      sea.scale,
      w.seaS,
      w.scratch
    );
    boardingRow(
      storm,
      bx + cp * x0 + sp * sr * y0 + sp * cr * z0,
      by + cr * y0 - sr * z0,
      dx,
      0,
      n,
      ts,
      sea.scale,
      w.seaP,
      w.scratch
    );
    boardingRow(
      storm,
      bx + cp * x0 + sp * cr * z0,
      by - sr * z0,
      dx,
      0,
      n,
      ts,
      sea.scale,
      w.seaC,
      w.scratch
    );
  } else
    for (let i = 0; i < n; i += 1) {
      w.seaS[i] = 0;
      w.seaP[i] = 0;
      w.seaC[i] = 0;
    }
  for (let i = 0; i < n; i += 1) {
    const len = w.x1[i] - w.x0[i];
    w.level[i] = w.vol[i] > 1e-9 ? levelFor(w, i, w.vol[i] / len) : -Infinity;
    let q =
      edgeFlow(w.seaS[i], w.level[i], w.zs[i], len) +
      edgeFlow(w.seaP[i], w.level[i], w.zp[i], len);
    if (q < 0) q = max(q, -w.vol[i] / h);
    w.dv[i] += q * h;
  }
  // Along the deck, down her trim: bay i and i + 1 over their boundary.
  for (let i = 0; i < n - 1; i += 1) {
    const a = w.level[i];
    const b = w.level[i + 1];
    if (a === -Infinity && b === -Infinity) continue;
    const crest = (min(w.zs[i], w.zp[i]) + min(w.zs[i + 1], w.zp[i + 1])) / 2;
    const up = a >= b ? i : i + 1;
    const down = up === i ? i + 1 : i;
    const h1 = w.level[up] - crest;
    if (h1 <= 0) continue;
    const h2 = w.level[down] - crest;
    let q =
      DECK_OFF_CW * bayWidth(w, up, w.level[up]) * pow(h1, 1.5) * drown(h1, h2);
    // One sample may not more than half-equalise the two bays.
    const limit = max(0, (w.vol[up] - w.vol[down]) / 2);
    q = min(q * h, limit, w.vol[up]);
    w.dv[up] -= q;
    w.dv[down] += q;
  }
}

/**
 * Flow in (m³/s, + in; out where the water inside stands higher) through
 * every cell's deck openings over a step of dt, at the pose (origin bx, by,
 * bz; cos and sin of pitch and roll), into `out` (by index in `cells`).
 * Each opening's lip is placed in the earth frame from the pose and her
 * ride (`sea.ride`: heave − x·pitch + y·roll at each sample), the sea
 * (`boardingElevation`) sampled over it every DECK_SAMPLE_S through the
 * step. Its head is the larger of the sea standing over its lip and, on
 * deck, the green water standing round it (`deck`, stepped at the same
 * samples); the water's inside is its level less the lip (the water
 * inside rides with her); q = Cd·A·√(2g·Δh). A cover with a failure head
 * gives way at the first sample with that much water over it, and its
 * failed area opens from the next. The mean over the samples is
 * returned.
 */
export function deckFlows(
  cells: readonly Cell[],
  deck: DeckWater | null,
  bx: number,
  by: number,
  bz: number,
  cp: number,
  sp: number,
  cr: number,
  sr: number,
  sea: DeckSea,
  dt: number,
  out: Float64Array
): void {
  const n = max(1, round(dt / DECK_SAMPLE_S));
  const h = dt / n;
  const storm = sea.storm;
  const ride = sea.rideN === n ? sea.ride : undefined;
  for (let ci = 0; ci < cells.length; ci += 1) out[ci] = 0;
  for (let j = 0; j < n; j += 1) {
    const ts = sea.t + ((j + 0.5) * dt) / n;
    const rh = ride ? ride[3 * j] : 0;
    const rp = ride ? ride[3 * j + 1] : 0;
    const rr = ride ? ride[3 * j + 2] : 0;
    if (deck)
      sampleDeck(deck, bx, by, bz, cp, sp, cr, sr, rh, rp, rr, sea, ts, h);
    for (let ci = 0; ci < cells.length; ci += 1) {
      const c = cells[ci];
      if (c.deck.length === 0) continue;
      const full = c.water >= c.cap;
      const inside = full ? headLevel(c) : c.water > 0 ? c.level : -Infinity;
      for (const o of c.deck) {
        if (ts < o.openT) continue;
        const ez =
          bz -
          sp * o.x +
          cp * sr * o.y +
          cp * cr * o.z +
          rh -
          o.x * rp +
          o.y * rr;
        const bay = deck && o.bay !== undefined ? o.bay : -1;
        let eta: number;
        if (bay >= 0 && o.row) eta = (deck as DeckWater).seaC[bay];
        else if (storm)
          eta = boardingElevation(
            storm,
            bx + cp * o.x + sp * sr * o.y + sp * cr * o.z,
            by + cr * o.y - sr * o.z,
            ts,
            sea.scale
          );
        else eta = 0;
        const crest = eta - ez;
        const pool =
          bay >= 0 && o.onDeck !== false && (deck as DeckWater).vol[bay] > 0
            ? (deck as DeckWater).level[bay] - ez
            : -Infinity;
        const hs = max(0, crest, pool);
        if (!o.failed && hs >= o.failHead) {
          o.failed = true;
          o.area = o.failedArea;
          continue;
        }
        const hi = max(0, inside - ez);
        if ((hs <= 0 && hi <= 0) || o.area <= 0) continue;
        const q = orifice(o.area, hs - hi);
        out[ci] += q;
        // Water drawn from the deck leaves its bay.
        if (q > 0 && pool > crest) (deck as DeckWater).dv[bay] -= q * h;
      }
    }
    // Two negligible leaks in the deck water's mass, kept for simplicity:
    // this clamp makes up any draw past what a bay held in a sample, and
    // the body's cap (body.ts, "one step may fill the cell") drops deck
    // water a full cell cannot take after its bay has given it up. Both
    // are a sample's flow at most, a fraction of a cubic metre.
    if (deck)
      for (let i = 0; i < deck.n; i += 1)
        deck.vol[i] = max(0, deck.vol[i] + deck.dv[i]);
  }
  for (let ci = 0; ci < cells.length; ci += 1) out[ci] /= n;
}
