import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import { createHullSurface, type HullSurface } from "./hullSurface";
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
  type ShipRecipe,
  type V3,
} from "./titanicRecipe";

/**
 * The cruise kit: a modern cruise ship's parts, lifted out of the Costa
 * Concordia's recipe (1.10) and parametrised, so the Poseidon is built from
 * the same builders (README, "The cruise kit"). Pure builders: each takes
 * the layout numbers a recipe used to hard-code (tier ends, balcony and
 * recess spans, boat size and places, deck heights, the funnel's shape)
 * and returns recipe parts. The Concordia's recipe is rebuilt on it and
 * deep-equals its 1.10 snapshot (`concordiaRecipeSnapshot.test.ts`), so
 * every builder keeps her arithmetic exactly as it was (the same sums in
 * the same order).
 *
 * Ship frame: metres, x forward, y to port, z up from the keel.
 */

/** Both sides: port (+1), then starboard (−1), as every builder walks. */
export const SIDES: readonly (1 | -1)[] = [1, -1];

/** What every builder reads off the ship: her hull, decks and deck edge. */
export interface CruiseFrame {
  spec: ShipSpec;
  hull: HullSurface;
  deckIndex(name: string): number;
  /** A deck's height at x (following the sheer). */
  deckZ(name: string, x: number): number;
  /** A deck's height amidships. */
  Z(name: string): number;
  /** The deck edge's half-breadth at x. */
  edge(x: number): number;
}

export function cruiseFrame(spec: ShipSpec): CruiseFrame {
  const hull = createHullSurface(spec);
  const deckByName = new Map(spec.decks.map((d, i) => [d.name, i]));
  const deckIndex = (name: string): number => {
    const i = deckByName.get(name);
    if (i === undefined) throw new Error(`no deck ${name}`);
    return i;
  };
  const deckZ = (name: string, x: number): number =>
    spec.decks[deckIndex(name)].z + (spec.sheerZ(x) - spec.depth);
  return {
    spec,
    hull,
    deckIndex,
    deckZ,
    Z: (name) => deckZ(name, 0),
    edge: (x) => hull.topHalfBreadth(x),
  };
}

// ---------------------------------------------------------------------------
// Tiers.

/** A tier's walls and painted roof. */
export interface TierPaint {
  wall: number;
  roof: number;
}

/** A tier flush with her side (or set in by `extra`), white, roof painted. */
export function flushTier(
  paint: TierPaint,
  id: string,
  deck: string,
  x0: number,
  x1: number,
  h: number,
  extra: Partial<Block> = {}
): Block {
  return {
    id,
    x0,
    x1,
    deck,
    h,
    wall: "white",
    wallColor: paint.wall,
    roof: "paint",
    roofColor: paint.roof,
    ...extra,
  };
}

export interface LowerTiersOptions {
  paint: TierPaint;
  /** Her stern and stem (the hull's ends). */
  stern: number;
  stem: number;
  tier: number;
  /** The tiers flush with her side from her hull's top: deck, after end, height. */
  base: { deck: string; x0: number; h: number };
  /** The bow's plating carried up over the base from here forward, `h` tall. */
  bowPlating: { x: number; h: number };
  /** The foredeck on the bow plating (a painted deck). */
  foredeck: string;
  /** The boat recess: its deck, span, wall inset, wall colour, its after tier's after end. */
  recess: {
    deck: string;
    span: [number, number];
    inset: number;
    wall: number;
    aftX0: number;
    tiers: number;
  };
  /** The flush tier over the boats: its deck, ends and rounded front. */
  over: { deck: string; x0: number; x1: number; roundFwd: number };
}

/**
 * Her lower tiers: the base flush with her side, the bow's plating with the
 * foredeck on it, the boat recess between flush ends, the flush tier over
 * the boats.
 */
export function lowerTiers(o: LowerTiersOptions): Block[] {
  const flush = (
    id: string,
    deck: string,
    x0: number,
    x1: number,
    h: number,
    extra: Partial<Block> = {}
  ) => flushTier(o.paint, id, deck, x0, x1, h, extra);
  const { recess: r } = o;
  return [
    flush(
      `deck-${o.base.deck}`,
      o.base.deck,
      o.base.x0,
      o.bowPlating.x,
      o.base.h,
      {
        roof: "pine",
      }
    ),
    {
      id: "bow-plating",
      x0: o.bowPlating.x,
      x1: o.stem - 0.05,
      deck: o.base.deck,
      h: o.bowPlating.h,
      wall: "plating",
      roof: "none",
    },
    flush("foredeck", o.foredeck, o.bowPlating.x, o.stem - 0.6, 0.02, {
      dz: -0.02,
      ends: false,
    }),
    flush(`deck-${r.deck}-aft`, r.deck, r.aftX0, r.span[0], r.tiers * o.tier, {
      roof: "none",
    }),
    {
      id: "boat-recess",
      x0: r.span[0],
      x1: r.span[1],
      deck: r.deck,
      h: r.tiers * o.tier,
      inset: r.inset,
      wall: "shade",
      wallColor: r.wall,
      roof: "none",
      ends: false,
    },
    flush(
      `deck-${r.deck}-fwd`,
      r.deck,
      r.span[1],
      o.bowPlating.x,
      r.tiers * o.tier
    ),
    flush(`deck-${o.over.deck}`, o.over.deck, o.over.x0, o.over.x1, o.tier, {
      roundFwd: o.over.roundFwd,
      under: true,
    }),
  ];
}

export interface BalconyTiersOptions {
  paint: TierPaint;
  /** Balcony decks, bottom up. */
  decks: readonly string[];
  /** Each tier's after and forward end (the stepped terraces and front). */
  aftEnd: Record<string, number>;
  fwdEnd: Record<string, number>;
  /** The balcony zone, aft to forward. */
  span: [number, number];
  /** The balconies' depth (their back wall in from her side). */
  depth: number;
  /** The back wall's colour. */
  shade: number;
  tier: number;
  /** The deck whose forward tier is the bridge. */
  bridgeDeck: string;
  /** Round the forward tiers' fronts over this length. */
  roundFwd: number;
}

/**
 * Her balcony tiers: on each deck a flush after end and a forward end (the
 * bridge on its deck), a thin floor over the balconies (but the lowest's),
 * then the shaded back wall up all of them.
 */
export function balconyTiers(o: BalconyTiersOptions): Block[] {
  const flush = (
    id: string,
    deck: string,
    x0: number,
    x1: number,
    h: number,
    extra: Partial<Block> = {}
  ) => flushTier(o.paint, id, deck, x0, x1, h, extra);
  const blocks: Block[] = [];
  for (const deck of o.decks) {
    blocks.push(
      flush(`deck-${deck}-aft`, deck, o.aftEnd[deck], o.span[0], o.tier, {
        roof: "pine",
      }),
      flush(
        deck === o.bridgeDeck ? "bridge" : `deck-${deck}-fwd`,
        deck,
        o.span[1],
        o.fwdEnd[deck],
        o.tier,
        { roundFwd: o.roundFwd, under: true }
      )
    );
    if (deck !== o.decks[0])
      blocks.push({
        id: `balcony-floor-${deck}`,
        x0: o.span[0],
        x1: o.span[1],
        deck,
        dz: -0.3,
        h: 0.3,
        wall: "white",
        wallColor: o.paint.wall,
        roof: "paint",
        roofColor: o.paint.roof,
        under: true,
        ends: false,
      });
  }
  blocks.push({
    id: "balcony-wall",
    x0: o.span[0],
    x1: o.span[1],
    deck: o.decks[0],
    h: o.decks.length * o.tier,
    inset: o.depth,
    wall: "shade",
    wallColor: o.shade,
    roof: "none",
    ends: false,
  });
  return blocks;
}

/**
 * Glass fronts (`runs` straight runs following her side) and partitions
 * every `pitch` m on each balcony deck, both sides.
 */
export function balconyFronts(
  f: Pick<CruiseFrame, "Z" | "edge">,
  o: {
    decks: readonly string[];
    span: [number, number];
    depth: number;
    runs: number;
    pitch: number;
    glass: number;
    partition: number;
  }
): BoxPart[] {
  const { edge } = f;
  const boxes: BoxPart[] = [];
  for (const deck of o.decks) {
    const z = f.Z(deck);
    for (const s of SIDES) {
      const runs = o.runs;
      const len = (o.span[1] - o.span[0]) / runs;
      for (let i = 0; i < runs; i += 1) {
        const xa = o.span[0] + i * len;
        const xb = xa + len;
        const ya = edge(xa) - 0.08;
        const yb = edge(xb) - 0.08;
        boxes.push({
          c: [(xa + xb) / 2, (s * (ya + yb)) / 2, z + 0.55],
          size: [Math.hypot(len, yb - ya), 0.08, 1.1],
          color: o.glass,
          yaw: s * Math.atan2(yb - ya, len),
        });
      }
      for (let x = o.span[0] + o.pitch; x < o.span[1] - 0.5; x += o.pitch)
        boxes.push({
          c: [x, s * (edge(x) - o.depth / 2), z + 1.25],
          size: [0.14, o.depth, 2.5],
          color: o.partition,
        });
    }
  }
  return boxes;
}

/** The bridge wings: out from `inset` in from her side to her beam, both sides. */
export function bridgeWings(
  f: Pick<CruiseFrame, "edge" | "spec">,
  o: {
    x: number;
    z: number;
    inset: number;
    length: number;
    h: number;
    color: number;
  }
): BoxPart[] {
  const inner = f.edge(o.x) - o.inset;
  const outer = f.spec.beam / 2 + 0.3;
  return SIDES.map((s) => ({
    c: [o.x, (s * (inner + outer)) / 2, o.z],
    size: [o.length, outer - inner, o.h],
    color: o.color,
  }));
}

// ---------------------------------------------------------------------------
// The funnel and the mast.

/**
 * Her funnels as upright (or raked) ovals: `semiA` fore and aft by `semiB`
 * across, a dark top `blackTop` m tall; a letter on both sides centred at
 * `emblem.atZ` (her real paint only).
 */
export function ovalFunnels(
  spec: Pick<ShipSpec, "funnels">,
  o: {
    semiA: number;
    semiB: number;
    rake?: number;
    blackTop: number;
    emblem?: { atZ: number; r: number; star: number; letter: number };
  }
): FunnelRecipe[] {
  return spec.funnels.map((f, i) => {
    const H = f.topZ - f.baseZ;
    const e = o.emblem;
    return {
      index: i,
      x: f.x,
      baseZ: f.baseZ,
      topZ: f.topZ,
      dummy: f.dummy,
      semiA: o.semiA,
      semiB: o.semiB,
      rake: o.rake ?? 0,
      blackTop: o.blackTop,
      bands: [],
      pipes: [],
      hasWhistle: false,
      ...(e && {
        emblem: {
          z: (e.atZ - f.baseZ) / H,
          r: e.r,
          star: e.star,
          letter: e.letter,
          letterOnly: true as const,
          realOnly: true as const,
        },
      }),
    };
  });
}

/**
 * One tall raked funnel (the Poseidon's): an oval section swept back along
 * a raked axis (`rakeDeg` aft), narrowing to `taper` of its foot's size at
 * the top, under a dark top, with a wing-like fin across its top
 * (`wing`: span either side and chord, fractions of the foot's half-axes),
 * and a wave stripe in her real paint only.
 */
export function rakedFunnel(
  spec: Pick<ShipSpec, "funnels">,
  o: {
    semiA: number;
    semiB: number;
    rakeDeg: number;
    taper: number;
    blackTop: number;
    wing: { span: number; chord: number; thick: number };
    wave?: { z: number; height: number; amp: number; color: number };
  }
): FunnelRecipe[] {
  return spec.funnels.map((f, i) => ({
    index: i,
    x: f.x,
    baseZ: f.baseZ,
    topZ: f.topZ,
    dummy: f.dummy,
    semiA: o.semiA,
    semiB: o.semiB,
    rake: (o.rakeDeg * Math.PI) / 180,
    blackTop: o.blackTop,
    bands: [],
    pipes: [],
    hasWhistle: false,
    taper: o.taper,
    wing: o.wing,
    ...(o.wave && { wave: { ...o.wave, realOnly: true as const } }),
  }));
}

/** A radar mast at x: its pole (`r0` to `r1`) with a yard. */
export function radarMast(x: number, baseZ: number, topZ: number): MastRecipe {
  return {
    id: "fore",
    x,
    baseZ,
    topZ,
    r0: 0.55,
    r1: 0.18,
    rake: 0,
    yard: true,
  };
}

/** The radar mast's lattice legs, platforms and scanners (z0 its foot). */
export function radarMastBoxes(
  x: number,
  z0: number,
  o: { white: number; scanner: number }
): BoxPart[] {
  const boxes: BoxPart[] = [];
  for (const s of SIDES)
    boxes.push({
      c: [x, s * 1.6, z0 + 5.5],
      size: [0.35, 0.35, 11],
      color: o.white,
    });
  for (const [z, w] of [
    [z0 + 5, 6],
    [z0 + 10.5, 4.5],
  ] as const) {
    boxes.push({ c: [x, 0, z], size: [2.6, w, 0.3], color: o.white });
    boxes.push({
      c: [x + 0.6, 0, z + 0.7],
      size: [0.45, w + 1.2, 0.35],
      color: o.scanner,
    });
  }
  return boxes;
}

// ---------------------------------------------------------------------------
// The glass-domed ballroom (the Poseidon's).

/**
 * A round room under a glass dome: the drum (a ring of tall windows between
 * white piers, `radius` m, `drumH` tall, its floor at `z`) and over it a
 * lat-long dome of `rows` × `cols` panes, `domeH` high, ribbed along every
 * meridian and parallel. All one recipe part; `buildShip.ts` draws the
 * glass in one list, the ribs in another (dropped on the low tiers).
 */
export function glassDome(o: {
  x: number;
  z: number;
  radius: number;
  drumH: number;
  domeH: number;
  rows: number;
  cols: number;
  glass: number;
  rib: number;
  drum: number;
}): NonNullable<ShipRecipe["ballrooms"]>[number] {
  return { ...o };
}

// ---------------------------------------------------------------------------
// Boats, davits and liferafts.

/** Her data's boats in the recess on `deck` at her side, each in a pair of davits. */
export function recessBoats(
  f: Pick<CruiseFrame, "Z" | "edge">,
  data: readonly { index: number; side: "port" | "starboard"; x: number }[],
  o: { deck: string; boat: { length: number; beam: number; depth: number } }
): BoatRecipe[] {
  const firstPort = data.filter((b) => b.side === "starboard").length;
  return data.map((b) => {
    const s = b.side === "port" ? 1 : -1;
    const e = f.edge(b.x);
    const deck = f.Z(o.deck);
    const k = b.side === "port" ? b.index - firstPort : b.index;
    return {
      index: b.index,
      label: `${b.side === "port" ? "P" : "S"}${k + 1}`,
      kind: "lifeboat",
      side: b.side,
      x: b.x,
      y: s * (e - o.boat.beam / 2 - 0.35),
      z: deck + 0.9,
      ...o.boat,
      hasDavits: true,
      edgeY: s * (e - 0.15),
      deckZ: deck,
      recess: true,
    } satisfies BoatRecipe;
  });
}

/** Two davits a boat, 0.8 m in from its ends. */
export function boatDavits(boats: readonly BoatRecipe[]): DavitRecipe[] {
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
  return davits;
}

/** Liferaft canisters in racks of `count` (two high) from each `fromX`, both sides. */
export function liferaftRacks(
  f: Pick<CruiseFrame, "edge">,
  o: { fromX: readonly number[]; count: number; z: number }
): { c: V3; r: number; len: number }[] {
  const out: { c: V3; r: number; len: number }[] = [];
  for (const s of SIDES)
    for (const x0 of o.fromX)
      for (let i = 0; i < o.count; i += 1)
        for (const dz of [0.45, 1.25]) {
          const x = x0 + i * 1.9;
          out.push({
            c: [x, s * (f.edge(x) - 1.1), o.z + dz],
            r: 0.36,
            len: 1.5,
          });
        }
  return out;
}

// ---------------------------------------------------------------------------
// Lights.

/** Her lit panes, drawn as she goes: windows, rows of them, curved fronts. */
export interface Panes {
  lights: LightSpot[];
  push(p: V3, n: V3, w: number, h: number, deck: string): void;
  /** A window in her side `inset` in from her deck edge (or in her hull). */
  sideLight(
    x: number,
    z: number,
    s: 1 | -1,
    inset: number,
    w: number,
    h: number,
    deck: string
  ): void;
  /** A row from x0 to x1 every `step`, a share `gap` left out. */
  row(
    x0: number,
    x1: number,
    step: number,
    gap: number,
    rowId: number,
    at: (x: number) => void
  ): void;
  /** Windows round a tier's rounded front (`R` long, `w` half-wide). */
  frontLights(
    x1: number,
    R: number,
    w: number,
    z: number,
    count: number,
    size: [number, number],
    deck: string
  ): void;
  /** Windows across an after face at `x0` (`deckZ` its floor). */
  aftFace(x0: number, deckZ: number, deck: string): void;
}

/** A pane list; `salt` seeds each pane's bulb. */
export function createPanes(
  f: Pick<CruiseFrame, "hull" | "edge" | "deckIndex">,
  salt: number
): Panes {
  const { hull, edge } = f;
  const lights: LightSpot[] = [];
  let serial = 0;
  const seed = () => hash01(serial++, salt);
  const push: Panes["push"] = (p, n, w, h, deck) =>
    lights.push({
      kind: "window",
      p: [p[0] + n[0] * 0.03, p[1] + n[1] * 0.03, p[2] + n[2] * 0.03],
      n,
      w,
      h,
      deck: f.deckIndex(deck),
      seed: seed(),
    });
  return {
    lights,
    push,
    sideLight(x, z, s, inset, w, h, deck) {
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
    },
    row(x0, x1, step, gap, rowId, at) {
      const n = Math.floor((x1 - x0) / step);
      for (let i = 0; i <= n; i += 1) {
        if (hash01(i, rowId) < gap) continue;
        at(x0 + i * step);
      }
    },
    frontLights(x1, R, w, z, count, size, deck) {
      for (let i = 0; i < count; i += 1) {
        const phi = -1.25 + (2.5 * (i + 0.5)) / count;
        const x = x1 - R + R * Math.cos(phi) - 0.05;
        const y = w * Math.sin(phi);
        const n = normalize([Math.cos(phi) / R, Math.sin(phi) / w, 0]);
        push([x, y, z], n, size[0], size[1], deck);
      }
    },
    aftFace(x0, deckZ, deck) {
      const w = edge(x0) - 1.5;
      for (let y = -w + 1.2; y <= w - 1.2; y += 2.6)
        push([x0, y, deckZ + 1.5], [-1, 0, 0], 2.0, 1.8, deck);
    },
  };
}

/**
 * The emergency mask (R7): a sparse fixed share of her panes stays lit on
 * her emergency power after the blackout (the scene reads it).
 */
export function emergencyMask(
  lights: LightSpot[],
  share = 0.07,
  salt = 7012
): void {
  lights.forEach((l, i) => {
    if (hash01(i, salt) < share) l.emergency = true;
  });
}

// ---------------------------------------------------------------------------
// Rails.

/** Rail runs along her edges and across her decks. */
export function railKit(): {
  rails: RailRun[];
  edgeRun(x0: number, x1: number, z: number, hw: (x: number) => number): void;
  acrossRun(x: number, z: number, halfWidth: number): void;
} {
  const rails: RailRun[] = [];
  return {
    rails,
    edgeRun(x0, x1, z, hw) {
      for (const s of SIDES) {
        const pts: V3[] = [];
        const count = Math.max(2, Math.ceil((x1 - x0) / 1.6));
        for (let i = 0; i <= count; i += 1) {
          const x = x0 + ((x1 - x0) * i) / count;
          pts.push([x, s * hw(x), z]);
        }
        rails.push({ points: pts });
      }
    },
    acrossRun(x, z, halfWidth) {
      const pts: V3[] = [];
      const count = Math.ceil((2 * halfWidth) / 1.6);
      for (let i = 0; i <= count; i += 1)
        pts.push([x, -halfWidth + (2 * halfWidth * i) / count, z]);
      rails.push({ points: pts });
    },
  };
}

// ---------------------------------------------------------------------------
// The open decks' fittings.

/** A water slide coiling down `turns` times from its tower at `c`. */
export function waterSlide(c: [number, number], z: number): V3[] {
  const pts: V3[] = [];
  const turns = 2.25;
  const n = 36;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const a = t * turns * Math.PI * 2;
    pts.push([
      c[0] + 3.4 * Math.cos(a),
      c[1] + 3.4 * Math.sin(a),
      z + 8.2 - 7.4 * t,
    ]);
  }
  pts.push([c[0] - 6, c[1] + 3, z + 0.6]);
  return pts;
}

// ---------------------------------------------------------------------------
// Under water: twin screws on open shafts, A-brackets and struts, twin
// rudders.

export function twinScrews(
  hull: HullSurface,
  o: {
    hubX: number;
    hubY: number;
    hubZ: number;
    radius: number;
    blades: number;
    phases: [number, number];
    bracketColor: number;
  }
): {
  propellers: Propeller[];
  bossings: ShipRecipe["bossings"];
  brackets: BoxPart[];
  rudder: ShipRecipe["rudder"];
} {
  const { hubX, hubY, hubZ } = o;
  const propR = o.radius;
  const propellers: Propeller[] = [
    {
      hub: [hubX, hubY, hubZ],
      radius: propR,
      blades: o.blades,
      phase: o.phases[0],
    },
    {
      hub: [hubX, -hubY, hubZ],
      radius: propR,
      blades: o.blades,
      phase: o.phases[1],
    },
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
  const brackets: BoxPart[] = [];
  for (const s of SIDES) {
    const ax = hubX + 3.2;
    const top = hull.zBottom(ax) + 0.5;
    const h = top - hubZ;
    for (const out of [-2.2, 2.2]) {
      const len = Math.hypot(out, h);
      brackets.push({
        c: [ax, s * hubY + out / 2, (hubZ + top) / 2],
        size: [len, 0.9, 0.35],
        color: o.bracketColor,
        yaw: (Math.sign(out) * Math.PI) / 2,
        pitch: Math.atan2(h, Math.abs(out)),
      });
    }
    const fx = hubX + 13;
    const ftop = hull.zBottom(fx) + 0.5;
    brackets.push({
      c: [fx, s * hubY, (hubZ + ftop) / 2],
      size: [0.9, 0.35, ftop - hubZ],
      color: o.bracketColor,
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
  return { propellers, bossings, brackets, rudder };
}

/** Stockless anchors in both bows at (x, z). */
export function bowAnchors(
  hull: HullSurface,
  x: number,
  z: number,
  size: number
): ShipRecipe["anchors"] {
  return (["port", "starboard"] as const).map((side) => {
    const s = side === "port" ? 1 : -1;
    return {
      p: [x, s * hull.halfBreadth(x, z), z] as V3,
      side,
      stockless: { size },
    };
  });
}

// ---------------------------------------------------------------------------
// Names and staffs.

type Board = Pick<NameBoard, "x" | "z" | "width" | "height">;

/**
 * Her name on both bows (and, with `side`, along both sides), then across
 * the stern.
 */
export function nameBoards(o: {
  bow: Board;
  side?: Board;
  stern: Board & { rows?: number };
}): NameBoard[] {
  return [
    ...(["port", "starboard"] as const).flatMap((side) => [
      { where: "bow" as const, ...o.bow, side },
      ...(o.side ? [{ where: "bow" as const, ...o.side, side }] : []),
    ]),
    { where: "stern" as const, ...o.stern, side: "aft" as const },
  ].map((n) => ({
    where: n.where,
    x: n.x,
    z: n.z,
    side: n.side,
    width: n.width,
    height: n.height,
    ...("rows" in n && n.rows !== undefined ? { rows: n.rows } : {}),
  }));
}

/** The jack staff at the stem and the ensign staff at the stern. */
export function staffs(jack: V3, ensign: V3): { foot: V3; top: V3 }[] {
  return [
    { foot: jack, top: [jack[0] + 0.3, 0, jack[2] + 6] },
    { foot: ensign, top: [ensign[0] - 0.5, 0, ensign[2] + 7] },
  ];
}
