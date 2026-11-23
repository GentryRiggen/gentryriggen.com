import {
  BRITANNIC_BOAT,
  BRITANNIC_BOATS,
  BRITANNIC_FUNNEL_PAINTS,
  BRITANNIC_GANTRY_ARM_DX,
  BRITANNIC_GANTRY_REACH,
  BRITANNIC_GANTRY_ROW_GAP,
  BRITANNIC_GANTRY_SETS,
  BRITANNIC_PAINT,
} from "@/lib/shipwreck/ships/britannic";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import {
  hash01,
  hullPortAt,
  normalize,
  titanicRecipe,
  type BoatRecipe,
  type BoxPart,
  type DavitRecipe,
  type GantryRecipe,
  type HullBand,
  type LightSpot,
  type ShipPaint,
  type ShipRecipe,
  type V3,
} from "./titanicRecipe";

/**
 * HMHS Britannic as she was on the morning of 21 November 1916: her
 * sister's recipe (`titanicRecipe`: the same frames, decks, houses,
 * funnels, masts, propellers and rudder, here on her 94 ft hull) with what
 * her photographs show was hers: the hospital ship's paint, five sets of
 * gantry davits and Welin davits for the rest of her 48 boats, A deck
 * enclosed aft and cabins forward, big screens at the forward ends of A
 * and B decks, "G.618" on the bridge front, and the hinge her bow bends
 * at on a hard landing (R12). Her second look (R23) is the White Star
 * liner she was built to be: the same ship under black, white and buff.
 * README.md, "The Britannic", has every source.
 */

/** Her paint: the hospital ship (default) or the liner she never was. */
export type BritannicPaint = typeof BRITANNIC_PAINT;

/** Her transport number on the bridge front, October 1916 (R13). */
export const BRIDGE_NUMBER = "G.618";

/** White Star buff: her funnels, masts (and, in photographs, no black tops). */
const BUFF = BRITANNIC_FUNNEL_PAINTS.hospital.funnel;
const WHITE = 0xe8e4d8;
const BLACK_BOARD = 0x141414;
const LETTER_WHITE = 0xf2f0ea;
/** The gantry arms: buff, a shade deeper than the funnels in photographs. */
const GANTRY_BUFF = 0x8a6d4a;
const HOSPITAL_GREEN = 0x2d6a3c;
const RED_CROSS = 0xb3261e;
/** The liner's gold line under the sheer (her sister's gilt line). */
const GOLD_LINE = 0xc9a03a;
/**
 * The liner's paint line: the red antifouling to her 34 ft 7 in load line,
 * as her sisters were finished (the hospital ship's stood higher).
 */
const LINER_LOAD_LINE = 10.54;

const BOAT = BRITANNIC_BOAT;
const ARM_DX = BRITANNIC_GANTRY_ARM_DX;
/** Gantry boats: two rows across, three tiers up. */
const TIER_DZ = 1.45;
const ROW_GAP = BRITANNIC_GANTRY_ROW_GAP;

/** The forward screens of A and B decks start here (to the house front). */
const FWD_SCREEN_FROM = 65.5;
/** A deck: the enclosed promenade's big windows aft of here. */
const A_PROMENADE_TO = -4;

/** Boat deck crosses: x of each, both sides. */
const DECK_CROSS_X = [35, -24];

/**
 * The hinge of the bent bow (R12): under the forward well deck, between
 * its hatch and the forecastle front, at the C deck (the wreck's bow is
 * "attached to the rest of the hull only by some pieces of C deck" [WP]).
 */
const HINGE_X = 87;
/** Her hawse pipes' mouths over her sister's anchor points (m). */
const HAWSE_LIFT = 1.4;

/**
 * Where a hospital band paints the hull at (x, z): "red" on a cross,
 * "green" on the band, null for the white topsides. The hull's shader
 * (`materials.ts`) draws the same rule.
 */
export function bandPaintAt(
  band: HullBand,
  x: number,
  z: number,
  sheerAtX: number,
  sheerAt0: number
): "red" | "green" | null {
  const dz = z - (band.z + band.follow * (sheerAtX - sheerAt0));
  let inGap = false;
  for (const cx of band.crosses) {
    const dx = Math.abs(x - cx);
    const adz = Math.abs(dz);
    const half = band.crossSize / 2;
    const arm = band.crossArm / 2;
    if ((dx < arm && adz < half) || (adz < arm && dx < half)) return "red";
    if (dx < band.gap / 2) inGap = true;
  }
  return !inGap && Math.abs(dz) < band.height / 2 ? "green" : null;
}

/** "G.618" in block strokes: [y, z, width, height] per stroke, per char. */
function strokeText(text: string, w: number, h: number, t: number): number[][] {
  // Seven segments: a top, b upper right, c lower right, d bottom, e lower
  // left, f upper left, g middle (right is +y: read from ahead).
  const seg: Record<string, number[]> = {
    a: [0, h / 2, w, t],
    b: [w / 2, h / 4, t, h / 2],
    c: [w / 2, -h / 4, t, h / 2],
    d: [0, -h / 2, w, t],
    e: [-w / 2, -h / 4, t, h / 2],
    f: [-w / 2, h / 4, t, h / 2],
    g: [0, 0, w, t],
    gR: [w / 4, 0, w / 2, t],
    b1: [0, h / 4, t, h / 2],
    c1: [0, -h / 4, t, h / 2],
  };
  const glyph: Record<string, string[]> = {
    G: ["a", "f", "e", "d", "c", "gR"],
    "6": ["a", "f", "g", "e", "d", "c"],
    "1": ["b1", "c1"],
    "8": ["a", "b", "c", "d", "e", "f", "g"],
  };
  const advance = w * 1.5;
  const dot = t * 1.6;
  const widths = Array.from(text).map((ch) =>
    ch === "." ? dot * 2 : ch === "1" ? advance * 0.6 : advance
  );
  const total = widths.reduce((a, b) => a + b, 0);
  const out: number[][] = [];
  let at = -total / 2;
  Array.from(text).forEach((ch, i) => {
    const cy = at + widths[i] / 2;
    at += widths[i];
    if (ch === ".") {
      out.push([cy, -h / 2, dot, dot]);
      return;
    }
    for (const k of glyph[ch] ?? []) {
      const [y, z, sw, sh] = seg[k];
      out.push([cy + y, z, sw + (sw === t ? 0 : t), sh + (sh === t ? 0 : t)]);
    }
  });
  return out;
}

/** The Britannic's detail recipe. Build once per spec (it samples the hull). */
export function britannicRecipe(
  spec: ShipSpec,
  look: BritannicPaint = BRITANNIC_PAINT
): ShipRecipe {
  const base = titanicRecipe(spec);
  const liner = look === "liner";
  const { hull, deckZ, deckIndex } = base;
  const edge = (x: number): number => hull.topHalfBreadth(x);
  const boatZ = (x: number): number => deckZ("Boat", x);
  // A deck is enclosed end to end: no open promenade aft. Her paint line
  // stands a little above her load line: red boot-topping (photographs).
  // As a liner, red straight up to the load line under the black (no white
  // boot-top line shows in her sisters' photographs).
  const layout = {
    ...base.layout,
    promenadeEnclosedFrom: base.layout.boatDeckFrom,
    loadWaterline: liner ? LINER_LOAD_LINE : 10.9,
    bootTop: 0,
  };
  const L = layout;

  const band: HullBand = {
    color: HOSPITAL_GREEN,
    crossColor: RED_CROSS,
    z: spec.sheerZ(0) - 3.5,
    follow: 1,
    height: 1.7,
    crosses: [84, -12, -114],
    crossSize: 6.0,
    crossArm: 1.9,
    gap: 8.4,
  };
  const hospitalPaint: ShipPaint = {
    funnel: BRITANNIC_FUNNEL_PAINTS.hospital.funnel,
    funnelTop: BRITANNIC_FUNNEL_PAINTS.hospital.top,
    sheerLine: null,
    name: "BRITANNIC",
    mast: BUFF,
    port: "LIVERPOOL",
    letters: { bow: 0x1d1d1f, stern: 0x1d1d1f, font: "serif" },
    hull: { topsides: 0xd9d5c9, bottom: 0x6a2419 },
    band,
  };
  // The liner (R23): black topsides over red (the defaults), the gold line,
  // gilt names, buff funnels with black tops, buff masts.
  const linerPaint: ShipPaint = {
    funnel: BRITANNIC_FUNNEL_PAINTS.liner.funnel,
    funnelTop: BRITANNIC_FUNNEL_PAINTS.liner.top,
    sheerLine: GOLD_LINE,
    name: "BRITANNIC",
    mast: BUFF,
    port: "LIVERPOOL",
  };
  const paint = liner ? linerPaint : hospitalPaint;

  // -------------------------------------------------------------------------
  // Funnels: her sister's, plain buff (a sooty lip, the guy bands); as a
  // liner, her sister's black tops.
  const funnels = liner
    ? base.funnels.map((f) => ({ ...f }))
    : base.funnels.map((f) => ({ ...f, blackTop: 0.45 }));

  // -------------------------------------------------------------------------
  // Gantry davits and boats (BRITANNIC_GANTRY_SETS, BRITANNIC_BOATS).
  const gantries: GantryRecipe[] = BRITANNIC_GANTRY_SETS.map((set) => {
    const s = set.side === "port" ? 1 : -1;
    return {
      x: set.x,
      arms: [set.x - ARM_DX, set.x + ARM_DX],
      side: set.side,
      footY: s * (edge(set.x) - 0.5),
      deckZ: boatZ(set.x),
      height: 9.6,
      reach: BRITANNIC_GANTRY_REACH,
      color: GANTRY_BUFF,
    };
  });
  const inSet = new Map<number, number>();
  const seenWelin = new Set<string>();
  const boats: BoatRecipe[] = BRITANNIC_BOATS.map((d) => {
    const s = d.side === "port" ? 1 : -1;
    const e = edge(d.x);
    const common = {
      index: d.index,
      label: String(d.index + 1),
      kind: "lifeboat" as const,
      side: d.side,
      x: d.x,
      length: BOAT.length,
      beam: BOAT.beam,
      depth: BOAT.depth,
      edgeY: s * (e - 0.35),
      deckZ: boatZ(d.x),
    };
    if (d.kind === "gantry") {
      const set = BRITANNIC_GANTRY_SETS.findIndex(
        (g) => g.x === d.x && g.side === d.side
      );
      const k = inSet.get(set) ?? 0;
      inSet.set(set, k + 1);
      const row = Math.floor(k / 3);
      const tier = k % 3;
      return {
        ...common,
        y: s * (e - 0.9 - BOAT.beam / 2 - row * (BOAT.beam + ROW_GAP)),
        z: boatZ(d.x) + 0.45 + tier * TIER_DZ,
        hasDavits: false,
        gantry: set,
      } satisfies BoatRecipe;
    }
    // Welin: the first boat at a davit pair outboard, the second inboard.
    const key = `${d.side}:${d.x}`;
    const outboard = !seenWelin.has(key);
    seenWelin.add(key);
    return {
      ...common,
      y: s * (e - 2.1 - (outboard ? 0 : BOAT.beam + 0.4)),
      z: boatZ(d.x) + 0.45,
      hasDavits: outboard,
    } satisfies BoatRecipe;
  });
  const davits: DavitRecipe[] = [];
  for (const b of boats) {
    if (!b.hasDavits) continue;
    for (const dx of [-1, 1]) {
      const x = b.x + dx * (b.length / 2 - 0.45);
      davits.push({
        boat: b.index,
        x,
        footY: b.edgeY,
        headY: b.y,
        z: boatZ(x),
      });
    }
  }
  /** Inside a boat's or a gantry pedestal's footprint (plan, padded). */
  const blocked = (p: V3, pad: number): boolean =>
    boats.some(
      (b) =>
        Math.abs(p[0] - b.x) < b.length / 2 + pad &&
        Math.abs(p[1] - b.y) < b.beam / 2 + pad
    ) ||
    gantries.some(
      (g) =>
        g.arms.some((x) => Math.abs(p[0] - x) < 1.2) &&
        Math.sign(p[1]) === Math.sign(g.footY) &&
        Math.abs(p[1]) > Math.abs(g.footY) - g.reach - 1
    );
  const benches = base.benches.filter((b) => !blocked(b.p, 0.6));
  const vents = base.vents.filter((v) => !blocked(v.p, 0.6));

  // -------------------------------------------------------------------------
  // Lights: her sister's, but A deck's sides, B deck's forward end and the
  // hull's rows the sim opens are hers.
  const A = deckIndex("A");
  const B = deckIndex("B");
  const rows = (spec.portholes ?? []).map((row) => {
    const mid = (row.fromX + row.toX) / 2;
    const s: 1 | -1 = row.side === "port" ? 1 : -1;
    return {
      row,
      s,
      mid,
      z: (x: number) =>
        row.followsSheer ? row.z + spec.sheerZ(x) - spec.sheerZ(mid) : row.z,
    };
  });
  const inOpenRow = (l: LightSpot): boolean =>
    l.kind === "porthole" &&
    rows.some(
      (r) =>
        Math.sign(l.p[1]) === r.s &&
        l.p[0] >= r.row.fromX - 0.6 &&
        l.p[0] <= r.row.toX + 0.6 &&
        Math.abs(l.p[2] - r.z(l.p[0])) < 0.8
    );
  const sideFacing = (l: LightSpot) => Math.abs(l.n[1]) > 0.5;
  const onCross = (l: LightSpot): boolean =>
    l.kind === "porthole" &&
    bandPaintAt(band, l.p[0], l.p[2], spec.sheerZ(l.p[0]), spec.sheerZ(0)) ===
      "red";
  const lights: LightSpot[] = base.lights.filter((l) => {
    if (onCross(l)) return false;
    if (l.deck === A && l.kind === "window" && sideFacing(l)) return false;
    if (l.deck === B && sideFacing(l) && l.p[0] > FWD_SCREEN_FROM - 0.6)
      return false;
    return !inOpenRow(l);
  });
  let serial = 0;
  const seed = () => hash01(serial++, 7927);
  /** A light on a wall flush with the deck edge (inset), facing out. */
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
  function run(
    x0: number,
    x1: number,
    step: number,
    gap: number,
    id: number,
    at: (x: number, i: number) => void
  ): void {
    const n = Math.floor((x1 - x0) / step);
    for (let i = 0; i <= n; i += 1)
      if (hash01(i, id) >= gap) at(x0 + i * step, i);
  }
  const sides: (1 | -1)[] = [1, -1];
  const Az = (x: number) => deckZ("A", x);
  const Bz = (x: number) => deckZ("B", x);
  for (const s of sides) {
    const k = s > 0 ? 0 : 1;
    // A deck: the enclosed promenade aft (big windows), cabins forward,
    // the forward screen's big openings.
    run(L.boatDeckFrom + 1, A_PROMENADE_TO, 1.84, 0, 600 + k, (x) =>
      edgeLight("window", x, Az(x) + 1.6, s, 0.05, 1.45, 1.2, A)
    );
    run(A_PROMENADE_TO + 2, FWD_SCREEN_FROM - 1.5, 1.6, 0.1, 602 + k, (x) =>
      edgeLight("window", x, Az(x) + 1.45, s, 0.05, 0.62, 0.75, A)
    );
    run(FWD_SCREEN_FROM, L.boatDeckTo - 1, 2.3, 0, 604 + k, (x) =>
      edgeLight("window", x, Az(x) + 1.55, s, 0.05, 1.9, 1.4, A)
    );
    // B deck's forward end: the same big openings.
    run(FWD_SCREEN_FROM, L.bridgeDeckTo - 1, 2.3, 0, 606 + k, (x) =>
      edgeLight("window", x, Bz(x) + 1.5, s, 0, 1.9, 1.3, B)
    );
  }
  // The hull's rows the sim opens (spec.portholes): her sister's spacing,
  // about half of them swung open (the data's area), the rest shut.
  rows.forEach((r, ri) => {
    const deck =
      r.z(r.mid) < deckZ("E", r.mid) ? deckIndex("F") : deckIndex("E");
    run(r.row.fromX, r.row.toX, 1.08, 0.08, 700 + ri, (x, i) => {
      const at = hullPortAt(hull, x, r.z(x), r.s);
      if (!at) return;
      lights.push({
        kind: "porthole",
        ...at,
        w: 0.42,
        h: 0.42,
        deck,
        seed: seed(),
        ...(hash01(i, 800 + ri) < 0.55 ? { open: true } : {}),
      });
    });
  });

  // -------------------------------------------------------------------------
  // Rails: no open A deck promenade (it is enclosed).
  const onA = (p: V3) => Math.abs(p[2] - deckZ("A", p[0])) < 1e-6;
  const rails = base.rails.filter((run) => !run.points.every(onA));

  // -------------------------------------------------------------------------
  // Painted boxes: the boat deck's red crosses on white boards at the deck
  // edge, and the transport number on the bridge front (the hospital
  // ship's only).
  const boxes: BoxPart[] = liner ? [] : hospitalMarks(base);

  return {
    ...base,
    layout,
    funnels,
    boats,
    davits,
    lights,
    vents,
    benches,
    rails,
    boxes,
    gantries,
    // Her sister's hawse pipes (the same frames): on her white bows the
    // anchors hang dark from the pipes' mouths, 1.4 m over her sister's
    // anchor point, no dark recess round them; 4 m from the lip to the
    // crown (a 7¾-ton side bower, README).
    anchors: base.anchors.map((a) => ({
      ...a,
      p: [a.p[0], a.p[1], a.p[2] + HAWSE_LIFT] as V3,
      stockless: { size: 4.0 },
    })),
    hinge: { x: HINGE_X, z: deckZ("C", HINGE_X) },
    paint,
  };
}

/**
 * The hospital ship's painted boxes: two red crosses a side on white
 * boards at the boat deck's edge, and "G.618" on a black board on the
 * bridge front. The liner has none; the model draws them as their own
 * mesh so a paint swap can hide them (`britannicLivery.ts`).
 */
function hospitalMarks(base: ShipRecipe): BoxPart[] {
  const { hull, deckZ } = base;
  const edge = (x: number): number => hull.topHalfBreadth(x);
  const boatZ = (x: number): number => deckZ("Boat", x);
  const L = base.layout;
  const sides: (1 | -1)[] = [1, -1];
  const boxes: BoxPart[] = [];
  for (const x of DECK_CROSS_X)
    for (const s of sides) {
      const y = s * (edge(x) - 0.45);
      const z = boatZ(x) + 0.3 + 1.6;
      boxes.push({ c: [x, y, z], size: [3.2, 0.1, 3.2], color: WHITE });
      const out = y + s * 0.07;
      boxes.push({ c: [x, out, z], size: [0.95, 0.04, 2.8], color: RED_CROSS });
      boxes.push({ c: [x, out, z], size: [2.8, 0.04, 0.95], color: RED_CROSS });
    }
  {
    const x = L.boatDeckTo;
    const z = boatZ(x) + 0.62;
    boxes.push({
      c: [x + 0.04, 0, z],
      size: [0.06, 3.0, 0.95],
      color: BLACK_BOARD,
    });
    for (const [y, dz, w, h] of strokeText(BRIDGE_NUMBER, 0.36, 0.6, 0.085))
      boxes.push({
        c: [x + 0.085, y, z + dz],
        size: [0.03, w, h],
        color: LETTER_WHITE,
      });
  }
  return boxes;
}
