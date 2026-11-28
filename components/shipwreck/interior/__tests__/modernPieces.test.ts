import {
  MODERN_PIECE_FOOTPRINT,
  MODERN_PIECE_IDS,
  MODERN_PIECE_MOUNT,
  POOL_COPING_M,
  seatRowFootprint,
  type ModernPieceId,
} from "@/lib/shipwreck/interior/modernPieces";
import { PIECE_FOOTPRINT } from "@/lib/shipwreck/interior/kit";
import { FURNITURE, TILE, type Lamp, type P3 } from "../pieces";
import { MODERN_TILE } from "../modernTextures";
import {
  atriumStair,
  chandelier,
  downlight,
  emergencyLamp,
  exitSign,
  glassLiftCar,
  glassRail,
  glassRailRun,
  liftShaft,
  MODERN_PIECES,
  ModernLayers,
  stageCurtain,
  stageLights,
  stripLight,
  theatreSeatRow,
  balconyRail,
} from "../modernPieces";

/**
 * The modern cruise-ship pieces (the Concordia, 1.18): each builds finite,
 * non-degenerate geometry within a small triangle count, unit normals,
 * glass that glows only where it should (emergency glass tagged), panes
 * with both faces; blocking pieces stay inside their footprints; and a
 * dressing of each of her zones (the spec's room table) leaves room for
 * the rooms themselves within the zone budgets (counts printed with
 * SHIPWRECK_PRINT_TRIANGLES=1).
 */

type Build = (L: ModernLayers) => Lamp[];
const AT = [10, -2, 5] as const;

/** Each piece at its default and its triangle cap. */
const CAPS: Record<ModernPieceId, number> = {
  "glass-lift-car": 700,
  "lift-shaft": 420,
  "glass-rail": 160,
  "theatre-seat-row": 380,
  "stage-curtain": 340,
  "stage-lights": 700,
  "pool-edge": 600,
  lounger: 220,
  "cabin-bed": 120,
  "cabin-sofa": 120,
  desk: 220,
  tv: 40,
  "balcony-door": 200,
  "balcony-rail": 200,
  "balcony-chair": 160,
  "cabin-door": 120,
  "bar-counter": 360,
  "bar-stool": 140,
  "atrium-stair": 420,
  "pirate-ship": 600,
  "castle-tower": 320,
  beanbag: 120,
  "kids-table": 270,
  "toy-shelf": 260,
  "soft-play": 120,
  "exit-sign": 60,
  "emergency-lamp": 40,
};

const EXTRA: [string, Build, number][] = [
  ["downlight", (L) => downlight(L, AT), 30],
  ["strip light (6 m)", (L) => stripLight(L, AT, 0.3, 6), 40],
  ["chandelier", (L) => chandelier(L, AT), 1400],
  ["ceiling emergency strip", (L) => emergencyLamp(L, AT, 0.3, 3, 2.3), 20],
  [
    "glass rail (sloping, 4 m)",
    (L) => {
      glassRailRun(L, [0, 0, 1], [4, 0, 2]);
      return [];
    },
    200,
  ],
];

const ALL: [string, Build, number][] = [
  ...MODERN_PIECE_IDS.map((id): [string, Build, number] => [
    id,
    (L) => MODERN_PIECES[id](L, AT, 0.4),
    CAPS[id],
  ]),
  ...EXTRA,
];

/** A builder's extent in the ship frame (three axes back to x, y, z). */
function extent(L: ModernLayers) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  let top = -Infinity;
  for (const b of L.all)
    for (let i = 0; i < b.pos.length; i += 3) {
      x0 = Math.min(x0, b.pos[i]);
      x1 = Math.max(x1, b.pos[i]);
      y0 = Math.min(y0, -b.pos[i + 2]);
      y1 = Math.max(y1, -b.pos[i + 2]);
      top = Math.max(top, b.pos[i + 1]);
    }
  return { x0, x1, y0, y1, top };
}

describe("the modern pieces", () => {
  it("every id has a builder and a mount, and none is an Edwardian id", () => {
    const edwardian = new Set([
      ...Object.keys(PIECE_FOOTPRINT),
      ...Object.keys(FURNITURE),
    ]);
    for (const id of MODERN_PIECE_IDS) {
      expect([id, typeof MODERN_PIECES[id]]).toEqual([id, "function"]);
      expect(MODERN_PIECE_MOUNT[id]).toBeDefined();
      expect(edwardian.has(id)).toBe(false);
    }
    expect(new Set(MODERN_PIECE_IDS).size).toBe(MODERN_PIECE_IDS.length);
  });

  for (const [name, build, maxTris] of ALL)
    it(`${name}: finite, unit normals, at most ${maxTris} triangles`, () => {
      const L = new ModernLayers();
      L.room(3);
      const lamps = build(L);
      expect(L.triangles).toBeGreaterThan(0);
      expect(L.triangles).toBeLessThanOrEqual(maxTris);
      for (const b of L.all) {
        const n = b.pos.length / 3;
        expect(b.nrm.length).toBe(n * 3);
        expect(b.col.length).toBe(n * 3);
        expect(b.uv.length).toBe(n * 2);
        expect(b.tile.length).toBe(n);
        expect(b.room.every((r) => r === 3)).toBe(true);
        const all = [...b.pos, ...b.nrm, ...b.col, ...b.uv];
        expect(all.every(Number.isFinite)).toBe(true);
        for (let i = 0; i < n; i += 1) {
          const l = Math.hypot(
            b.nrm[i * 3],
            b.nrm[i * 3 + 1],
            b.nrm[i * 3 + 2]
          );
          expect(Math.abs(l - 1)).toBeLessThan(1e-6);
        }
      }
      // Only glass glows; panes never.
      for (const b of [L.shell, L.wood, L.metal, L.pane])
        expect(b.glow.every((g) => g === 0)).toBe(true);
      expect(L.pane.tile.every((t) => t === MODERN_TILE.pane)).toBe(true);
      // Emergency glass only in the emergency pieces.
      const emergency = L.glass.tile.some((t) => t === MODERN_TILE.emergency);
      expect([name, emergency]).toEqual([
        name,
        name === "exit-sign" || name.includes("emergency"),
      ]);
      for (const l of lamps) {
        expect(l.p.every(Number.isFinite)).toBe(true);
        expect(l.intensity).toBeGreaterThan(0);
        expect(l.radius).toBeGreaterThan(0);
      }
      // Placed: near where it was put (three axes x, z, −y).
      if (name.startsWith("glass rail (sloping")) return;
      const e = extent(L);
      const r = name === "pool-edge" ? 6 : name === "atrium-stair" ? 5 : 8;
      expect(Math.abs((e.x0 + e.x1) / 2 - AT[0])).toBeLessThan(r);
      expect(Math.abs((e.y0 + e.y1) / 2 - AT[1])).toBeLessThan(r);
    });

  it("panes have both faces (seen from either side)", () => {
    const L = new ModernLayers();
    glassLiftCar(L, AT, 0.4);
    liftShaft(L, AT, 0.4);
    glassRail(L, AT, 0.4);
    const p = L.pane;
    expect(p.triangles).toBeGreaterThan(10);
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (let i = 0; i < p.nrm.length; i += 3) {
      sx += p.nrm[i];
      sy += p.nrm[i + 1];
      sz += p.nrm[i + 2];
    }
    expect(Math.hypot(sx, sy, sz)).toBeLessThan(1e-6);
  });

  it("emergency lamps and exit signs glow over bloom's threshold", () => {
    const L = new ModernLayers();
    exitSign(L, AT, 0);
    emergencyLamp(L, AT, 0, 3);
    emergencyLamp(L, AT, 0, 3, 2.3);
    const g = L.glass;
    let hdr = 0;
    for (let i = 0; i < g.glow.length; i += 1) {
      expect(g.tile[i]).toBe(MODERN_TILE.emergency);
      const c = Math.max(g.col[i * 3], g.col[i * 3 + 1], g.col[i * 3 + 2]);
      if (g.glow[i] * c > 1) hdr += 1;
    }
    expect(hdr).toBe(g.glow.length);
    // The exit sign is green, its figure white.
    const greens = g.col.filter((_, i) => i % 3 === 1);
    expect(Math.max(...greens)).toBeGreaterThan(0.6);
  });

  it("lamps that light the room: downlights, strips, the chandelier, the stage", () => {
    const L = new ModernLayers();
    expect(downlight(L, AT)).toHaveLength(1);
    expect(stripLight(L, AT, 0, 7.5)).toHaveLength(3);
    expect(chandelier(L, AT)[0].radius).toBeGreaterThan(5);
    expect(stageLights(L, AT, 0)).toHaveLength(3);
    expect(glassLiftCar(L, AT, 0)).toHaveLength(1);
    // Lamps hang under the ceiling point they were put at.
    for (const l of downlight(L, AT)) expect(l.p[2]).toBeLessThan(AT[2]);
  });

  it("every blocking piece stays inside its footprint, front to +x", () => {
    for (const id of Object.keys(MODERN_PIECE_FOOTPRINT) as ModernPieceId[]) {
      const fp = MODERN_PIECE_FOOTPRINT[id]!;
      expect([id, MODERN_PIECE_MOUNT[id]]).toEqual([id, "floor"]);
      const L = new ModernLayers();
      MODERN_PIECES[id](L, [0, 0, 0], 0);
      const { x0, x1, y0, y1, top } = extent(L);
      // The pool blocks its basin; its coping (and the ladder's top on
      // it) is walkable, outside the footprint.
      const slack = id === "pool-edge" ? 0.03 + POOL_COPING_M : 0.03;
      expect([id, x0 >= -fp.lx / 2 - slack, x1 <= fp.lx / 2 + slack]).toEqual([
        id,
        true,
        true,
      ]);
      expect([id, y0 >= -fp.ly / 2 - slack, y1 <= fp.ly / 2 + slack]).toEqual([
        id,
        true,
        true,
      ]);
      // It fills most of it (no blocker much bigger than what you see).
      expect([id, x1 - x0 > fp.lx * 0.8, y1 - y0 > fp.ly * 0.8]).toEqual([
        id,
        true,
        true,
      ]);
      // Under the eyes and the ceiling.
      expect([id, top > 0.3 && top < 2.2]).toEqual([id, true]);
    }
  });

  it("the theatre's seat rows fit seatRowFootprint(n) for any n; the curtain spans the stage", () => {
    expect(MODERN_PIECE_FOOTPRINT["theatre-seat-row"]).toEqual(
      seatRowFootprint(10)
    );
    expect(() => seatRowFootprint(0)).toThrow();
    expect(() => seatRowFootprint(2.5)).toThrow();
    for (const n of [1, 4, 6, 10, 13]) {
      const L = new ModernLayers();
      theatreSeatRow(L, [0, 0, 0], 0, n);
      const e = extent(L);
      const fp = seatRowFootprint(n);
      expect(e.y0).toBeGreaterThanOrEqual(-fp.ly / 2 - 0.01);
      expect(e.y1).toBeLessThanOrEqual(fp.ly / 2 + 0.01);
      expect(e.y1 - e.y0).toBeGreaterThan(fp.ly - 0.05);
      expect(e.x0).toBeGreaterThanOrEqual(-fp.lx / 2 - 0.03);
      expect(e.x1).toBeLessThanOrEqual(fp.lx / 2 + 0.03);
    }
    const C = new ModernLayers();
    stageCurtain(C, [0, 0, 0], 0, 16, 7);
    const c = extent(C);
    expect(c.y1 - c.y0).toBeGreaterThan(16);
    expect(c.top).toBeGreaterThan(7);
  });

  it("the pool's footprint is its basin: the walls on its edge, the coping outside", () => {
    const fp = MODERN_PIECE_FOOTPRINT["pool-edge"]!;
    const L = new ModernLayers();
    MODERN_PIECES["pool-edge"](L, [0, 0, 0], 0);
    // The basin's walls (under the deck) are on the footprint's edge.
    let wx = 0;
    let wy = 0;
    const s = L.shell;
    for (let i = 0; i < s.pos.length; i += 3)
      if (s.pos[i + 1] < -0.5) {
        wx = Math.max(wx, Math.abs(s.pos[i]));
        wy = Math.max(wy, Math.abs(s.pos[i + 2]));
      }
    expect(wx).toBeCloseTo(fp.lx / 2, 3);
    expect(wy).toBeCloseTo(fp.ly / 2, 3);
    const e = extent(L);
    expect(e.x1).toBeCloseTo(fp.lx / 2 + POOL_COPING_M, 2);
  });

  it("a stair's rails stand either side of the flight, on its floor line", () => {
    const L = new ModernLayers();
    atriumStair(L, [0, 0, 3], [4, 0, 0], 2);
    const m = L.metal;
    let ys = 0;
    for (let i = 0; i < m.pos.length; i += 3) ys = Math.max(ys, -m.pos[i + 2]);
    expect(ys).toBeGreaterThan(0.9);
    expect(ys).toBeLessThan(1.05);
    // The rails' tops follow the slope: higher at the top of the flight.
    let hiTop = 0;
    let hiBottom = 0;
    for (let i = 0; i < m.pos.length; i += 3) {
      if (m.pos[i] < 0.2) hiTop = Math.max(hiTop, m.pos[i + 1]);
      if (m.pos[i] > 3.8) hiBottom = Math.max(hiBottom, m.pos[i + 1]);
    }
    expect(hiTop).toBeGreaterThan(3.9);
    expect(hiBottom).toBeLessThan(1.3);
  });
});

// --- Her zones, dressed --------------------------------------------------------------

/** Her zone budgets (the spec): atrium 50k, others 40k, the pool hall 25k. */
const ZONE_BUDGET: Record<string, number> = {
  atrium: 50_000,
  "low-cabins": 40_000,
  stateroom: 40_000,
  theatre: 40_000,
  squok: 40_000,
  "pool-hall": 25_000,
};
/** Her whole interior. */
const INTERIOR_BUDGET = 140_000;
/** The pieces' share: the rest is the rooms (walls, floors, lamps' bake). */
const DRESSING_SHARE = 0.6;

type Dress = (L: ModernLayers) => void;
const times = (n: number, f: (i: number) => void) => {
  for (let i = 0; i < n; i += 1) f(i);
};
const O: P3 = [0, 0, 0];
const lowStrips = (L: ModernLayers, m: number) =>
  times(Math.ceil(m / 3), () => emergencyLamp(L, O, 0, 3));
const highStrips = (L: ModernLayers, m: number) =>
  times(Math.ceil(m / 3), () => emergencyLamp(L, O, 0, 3, 2.3));

/** The spec's room table, furnished generously. */
const ZONES: Record<string, Dress> = {
  atrium: (L) => {
    times(2, () => glassLiftCar(L, O, 0));
    times(2 * 3, () => liftShaft(L, O, 0));
    // The galleries' rails round the 12 × 12 m well, decks 4 and 5.
    times(2 * 4, () => glassRail(L, O, 0, 12));
    atriumStair(L, [0, 0, 2.8], [4.5, 0, 0], 1.8);
    chandelier(L, [0, 0, 9]);
    MODERN_PIECES["bar-counter"](L, O, 0);
    times(6, () => MODERN_PIECES["bar-stool"](L, O, 0));
    times(40, () => downlight(L, O));
    times(4, () => exitSign(L, O, 0));
    lowStrips(L, 180);
    highStrips(L, 180);
  },
  "low-cabins": (L) => {
    times(2, () => liftShaft(L, O, 0));
    times(4, () => MODERN_PIECES["cabin-bed"](L, O, 0));
    times(1, () => MODERN_PIECES["cabin-sofa"](L, O, 0));
    times(2, () => MODERN_PIECES.desk(L, O, 0));
    times(2, () => MODERN_PIECES.tv(L, O, 0));
    times(16, () => MODERN_PIECES["cabin-door"](L, O, 0));
    times(20, () => downlight(L, O));
    times(3, () => exitSign(L, O, 0));
    lowStrips(L, 110);
    highStrips(L, 110);
  },
  stateroom: (L) => {
    times(2, () => liftShaft(L, O, 0));
    times(2, () => MODERN_PIECES["cabin-bed"](L, O, 0));
    MODERN_PIECES["cabin-sofa"](L, O, 0);
    MODERN_PIECES.desk(L, O, 0);
    MODERN_PIECES.tv(L, O, 0);
    MODERN_PIECES["balcony-door"](L, O, 0);
    balconyRail(L, O, 0);
    times(2, () => MODERN_PIECES["balcony-chair"](L, O, 0));
    times(9, () => MODERN_PIECES["cabin-door"](L, O, 0));
    times(14, () => downlight(L, O));
    times(2, () => exitSign(L, O, 0));
    lowStrips(L, 70);
    highStrips(L, 70);
  },
  theatre: (L) => {
    times(3 * 14, () => theatreSeatRow(L, O, 0));
    times(3 * 5, () => theatreSeatRow(L, O, 0));
    stageCurtain(L, O, 0, 16, 7);
    times(2, () => stageLights(L, [0, 0, 8], 0, 14));
    times(24, () => downlight(L, O));
    times(4, () => exitSign(L, O, 0));
    lowStrips(L, 100);
    highStrips(L, 100);
  },
  squok: (L) => {
    MODERN_PIECES["pirate-ship"](L, O, 0);
    MODERN_PIECES["castle-tower"](L, O, 0);
    times(8, () => MODERN_PIECES.beanbag(L, O, 0));
    times(3, () => MODERN_PIECES["kids-table"](L, O, 0));
    times(4, () => MODERN_PIECES["toy-shelf"](L, O, 0));
    times(3, () => MODERN_PIECES["soft-play"](L, O, 0));
    times(24, () => downlight(L, O));
    times(2, () => exitSign(L, O, 0));
    lowStrips(L, 92);
    highStrips(L, 92);
  },
  "pool-hall": (L) => {
    MODERN_PIECES["pool-edge"](L, O, 0);
    times(20, () => MODERN_PIECES.lounger(L, O, 0));
    times(2, () => exitSign(L, O, 0));
  },
};

describe("her zones, dressed", () => {
  it("leave the rooms room within the zone and interior budgets", () => {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const [zone, dress] of Object.entries(ZONES)) {
      const L = new ModernLayers();
      dress(L);
      counts[zone] = L.triangles;
      total += L.triangles;
      expect([zone, L.triangles <= ZONE_BUDGET[zone] * DRESSING_SHARE]).toEqual(
        [zone, true]
      );
    }
    expect(total).toBeLessThanOrEqual(INTERIOR_BUDGET * DRESSING_SHARE);
    if (process.env.SHIPWRECK_PRINT_TRIANGLES)
      console.log(
        `modern dressing triangles per zone: ${JSON.stringify(counts)} total ${total}`
      );
  });

  it("each piece's default triangles (printed for the report)", () => {
    const counts: Record<string, number> = {};
    for (const [name, build] of ALL) {
      const L = new ModernLayers();
      build(L);
      counts[name] = L.triangles;
    }
    expect(Object.keys(counts).length).toBe(ALL.length);
    if (process.env.SHIPWRECK_PRINT_TRIANGLES)
      console.log(`modern piece triangles: ${JSON.stringify(counts)}`);
  });
});

// The Edwardian tiles stay where they were (the modern ones carry on).
describe("tile ids", () => {
  it("modern tiles follow the Edwardian ones without a clash", () => {
    const old = new Set<number>(Object.values(TILE));
    for (const t of Object.values(MODERN_TILE)) expect(old.has(t)).toBe(false);
    expect(Math.min(...Object.values(MODERN_TILE))).toBeGreaterThan(
      Math.max(...old)
    );
  });
});
