import {
  balustrade,
  cagedBulb,
  ceilingLamp,
  cherubLamp,
  clockPanel,
  dome,
  Layers,
  newel,
  porthole,
  rope,
  sconce,
  shutDoor,
  TILE,
  FURNITURE,
  doorFrame,
  liftGate,
  pipes,
  fireBuckets,
  hoseReel,
  type Lamp,
} from "../pieces";
import { PIECE_FOOTPRINT, pieceFootprint } from "@/lib/shipwreck/interior/kit";
import { roomFloorZ, type PieceId, type Room } from "@/lib/shipwreck/interior";
import { CONCORDIA_INTERIOR } from "@/lib/shipwreck/interior/concordia";
import { concordia } from "@/lib/shipwreck/ships/concordia";
import { addPiece } from "../kit";
import { ModernLayers } from "../modernPieces";

/**
 * The kit's pieces: each builds finite, non-degenerate geometry within a
 * small triangle count, normals of unit length, glass that glows only
 * where it should, and lamps (for the baked light) where it hangs.
 */

type Build = (L: Layers) => Lamp[];
const AT = [10, -2, 5] as const;

const PIECES: [string, Build, number][] = [
  ["sconce", (L) => sconce(L, AT, 0.3), 120],
  ["caged bulb", (L) => cagedBulb(L, AT), 120],
  ["ceiling lamp", (L) => ceilingLamp(L, AT), 120],
  ["dome", (L) => dome(L, AT), 800],
  ["newel", (L) => newel(L, AT, 0), 80],
  ["cherub lamp", (L) => cherubLamp(L, AT, 0), 220],
  ["clock panel", (L) => clockPanel(L, AT, Math.PI), 400],
  ["rope", (L) => rope(L, AT, 0), 220],
  ["porthole", (L) => porthole(L, AT, 1), 80],
  ["oak door", (L) => shutDoor(L, AT, 0, "oak"), 120],
  ["white door", (L) => shutDoor(L, AT, 0, "white"), 120],
  ["steel door", (L) => shutDoor(L, AT, 0, "steel"), 80],
  ["balustrade (4 m)", (L) => balustrade(L, [0, 0, 1], [4, 0, 2], 0.06), 400],
  ["door frame (oak)", (L) => doorFrame(L, AT, 0.4, 1.2, "oak"), 40],
  ["door frame (steel)", (L) => doorFrame(L, AT, 0.4, 1.4, "steel"), 40],
  ["lift gate", (L) => liftGate(L, AT, 0.4, 1.2), 400],
  ["pipes (8 m)", (L) => pipes(L, AT, 0.4, 2.4), 260],
  ["fire buckets", (L) => fireBuckets(L, AT, 0.4), 260],
  ["hose reel", (L) => hoseReel(L, AT, 0.4), 260],
  // The rooms' furniture (blocking pieces: centred on their footprint).
  ...(
    [
      ["bed", 600],
      ["single-bed", 500],
      ["bunk", 600],
      ["wardrobe", 260],
      ["washstand", 300],
      ["washbasin", 260],
      ["sofa", 360],
      ["table", 300],
      ["chair", 200],
    ] as const
  ).map(([id, n]): [string, Build, number] => [
    id,
    (L) => FURNITURE[id]!(L, AT, 0.4),
    n,
  ]),
];

describe("the kit's pieces", () => {
  for (const [name, build, maxTris] of PIECES)
    it(`${name}: finite, unit normals, at most ${maxTris} triangles`, () => {
      const L = new Layers();
      L.room(3);
      const lamps = build(L);
      expect(L.triangles).toBeGreaterThan(0);
      expect(L.triangles).toBeLessThanOrEqual(maxTris);
      for (const b of L.all) {
        const n = b.pos.length / 3;
        expect(b.nrm.length).toBe(n * 3);
        expect(b.col.length).toBe(n * 3);
        expect(b.uv.length).toBe(n * 2);
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
      // Only glass glows.
      for (const b of [L.shell, L.wood, L.metal])
        expect(b.glow.every((g) => g === 0)).toBe(true);
      for (const l of lamps) {
        expect(l.p.every(Number.isFinite)).toBe(true);
        expect(l.intensity).toBeGreaterThan(0);
        expect(l.radius).toBeGreaterThan(0);
      }
      // Placed: every vertex near where it was put (three axes x, z, −y).
      const b = L.all.find((x) => x.pos.length > 0)!;
      if (name.startsWith("balustrade")) return;
      expect(Math.abs(b.pos[0] - AT[0])).toBeLessThan(4);
      expect(Math.abs(-b.pos[2] - AT[1])).toBeLessThan(4);
    });

  it("lamps glow over bloom's threshold and give light; the dome's panes and the porthole are tagged", () => {
    const L = new Layers();
    expect(sconce(L, AT, 0)).toHaveLength(1);
    expect(cagedBulb(L, AT)).toHaveLength(1);
    expect(cherubLamp(L, AT, 0)).toHaveLength(1);
    expect(dome(L, AT).length).toBeGreaterThanOrEqual(1);
    porthole(L, AT, 0);
    const g = L.glass;
    let hdr = 0;
    for (let i = 0; i < g.glow.length; i += 1)
      if (g.glow[i] * g.col[i * 3] > 1) hdr += 1;
    expect(hdr).toBeGreaterThan(20);
    expect(g.tile.filter((t) => t === TILE.dome).length).toBeGreaterThan(100);
    expect(g.tile.filter((t) => t === TILE.porthole).length).toBeGreaterThan(
      10
    );
    // The dome's lattice uvs: one per pane round, one per ring up.
    const us: number[] = [];
    g.tile.forEach((t, i) => {
      if (t === TILE.dome) us.push(g.uv[i * 2]);
    });
    expect(Math.max(...us) - Math.min(...us)).toBeGreaterThan(20);
  });

  it("every blocking piece stays inside its footprint (the walker's blocker), front to +x", () => {
    for (const id of Object.keys(PIECE_FOOTPRINT) as PieceId[]) {
      const build = FURNITURE[id];
      expect([id, !!build]).toEqual([id, true]);
      if (!build) continue;
      const fp = PIECE_FOOTPRINT[id]!;
      const L = new Layers();
      build(L, [0, 0, 0], 0);
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      let top = 0;
      for (const b of L.all)
        for (let i = 0; i < b.pos.length; i += 3) {
          x0 = Math.min(x0, b.pos[i]);
          x1 = Math.max(x1, b.pos[i]);
          y0 = Math.min(y0, -b.pos[i + 2]);
          y1 = Math.max(y1, -b.pos[i + 2]);
          top = Math.max(top, b.pos[i + 1]);
        }
      const slack = 0.03;
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
      // Under the eyes and the ceiling (2.3 m).
      expect([id, top > 0.3 && top < 2.2]).toEqual([id, true]);
    }
  });

  it("a balustrade's balusters stand between its rails, on the floor line", () => {
    const L = new Layers();
    balustrade(L, [0, 0, 1], [4, 0, 1], 0.06);
    const m = L.metal;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 1; i < m.pos.length; i += 3) {
      lo = Math.min(lo, m.pos[i]);
      hi = Math.max(hi, m.pos[i]);
    }
    expect(lo).toBeGreaterThan(1.05);
    expect(hi).toBeLessThan(2.0);
    // Inset into the room (left of 0 → 4 is +y, three z −y < 0).
    expect(Math.max(...L.wood.pos.filter((_, i) => i % 3 === 2))).toBeLessThan(
      0
    );
  });
});

// --- 1.17: her pool hall's pieces (the art lane's builders, by id) ---------------

describe("her pool hall's pieces, placed by the kit", () => {
  const HALL: Room = CONCORDIA_INTERIOR.rooms[0];
  const PIECES_1_17: [PieceId, number][] = [
    ["pool-edge", 400],
    ["lounger", 220],
    ["exit-sign", 60],
  ];
  for (const [piece, maxTris] of PIECES_1_17)
    it(`${piece}: finite, unit normals, at most ${maxTris} triangles, on her floor`, () => {
      const L = new ModernLayers();
      L.room(2);
      const at: [number, number] = [12, -6];
      addPiece(L, { room: HALL.id, piece, at, yaw: 0 }, HALL, concordia);
      expect(L.triangles).toBeGreaterThan(0);
      expect(L.triangles).toBeLessThanOrEqual(maxTris);
      if (process.env.SHIPWRECK_PRINT_TRIANGLES)
        console.log(`${piece}: ${L.triangles} triangles`);
      const deck = roomFloorZ(HALL, at[0], at[1], concordia);
      for (const b of L.all) {
        const n = b.pos.length / 3;
        expect(b.room.every((r) => r === 2)).toBe(true);
        expect(
          [...b.pos, ...b.nrm, ...b.col, ...b.uv].every(Number.isFinite)
        ).toBe(true);
        for (let i = 0; i < n; i += 1) {
          const l = Math.hypot(
            b.nrm[i * 3],
            b.nrm[i * 3 + 1],
            b.nrm[i * 3 + 2]
          );
          expect(Math.abs(l - 1)).toBeLessThan(1e-6);
          // Near where it was put (the pool's basin goes 1.4 m down).
          expect(Math.abs(b.pos[i * 3] - at[0])).toBeLessThan(6);
          expect(b.pos[i * 3 + 1]).toBeGreaterThan(deck - 1.5);
          expect(b.pos[i * 3 + 1]).toBeLessThan(deck + 2.5);
        }
      }
    });

  it("a lounger stays inside its footprint; the pool's basin (not its coping) is its footprint", () => {
    const extent = (piece: PieceId) => {
      const L = new ModernLayers();
      addPiece(
        L,
        { room: HALL.id, piece, at: [0, 0], yaw: 0 },
        HALL,
        concordia
      );
      const deck = roomFloorZ(HALL, 0, 0, concordia);
      let x = 0;
      let y = 0;
      let below = 0;
      for (const b of L.all)
        for (let i = 0; i < b.pos.length; i += 3) {
          // Under the floor: the basin's walls and floor.
          if (b.pos[i + 1] < deck - 0.1) {
            below = Math.max(below, Math.abs(b.pos[i]), Math.abs(b.pos[i + 2]));
            continue;
          }
          x = Math.max(x, Math.abs(b.pos[i]));
          y = Math.max(y, Math.abs(b.pos[i + 2]));
        }
      return { x, y, below };
    };
    const fl = pieceFootprint("lounger")!;
    const l = extent("lounger");
    expect(l.x).toBeLessThanOrEqual(fl.lx / 2 + 0.03);
    expect(l.y).toBeLessThanOrEqual(fl.ly / 2 + 0.03);
    const fp = pieceFootprint("pool-edge")!;
    const p = extent("pool-edge");
    // Under the floor: within the basin's footprint (the walker's blocker).
    expect(p.below).toBeLessThanOrEqual(fp.lx / 2 + 1e-6);
    // Over it: the coping, walkable, round the basin.
    expect(p.x).toBeGreaterThan(fp.lx / 2);
  });
});

// --- 1.18: her pieces placed where their mount says --------------------------------

describe("her pieces, placed by their mount (1.18)", () => {
  const room = (id: string) =>
    CONCORDIA_INTERIOR.rooms.find((r) => r.id === id)!;
  /** The placed piece's height range over its floor (ship z), and its y extent. */
  function place(
    piece: PieceId,
    roomId: string,
    at: [number, number],
    yaw = 0
  ) {
    const r = room(roomId);
    const L = new ModernLayers();
    const lamps = addPiece(L, { room: r.id, piece, at, yaw }, r, concordia);
    const floor = roomFloorZ(r, at[0], at[1], concordia);
    let lo = Infinity;
    let hi = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const b of L.all)
      for (let i = 0; i < b.pos.length; i += 3) {
        lo = Math.min(lo, b.pos[i + 1] - floor);
        hi = Math.max(hi, b.pos[i + 1] - floor);
        y0 = Math.min(y0, -b.pos[i + 2]);
        y1 = Math.max(y1, -b.pos[i + 2]);
      }
    return { L, lamps, lo, hi, y0, y1, r };
  }

  it("hangs the stage lights from the stage's ceiling, lighting the stage", () => {
    const { lo, hi, lamps, r } = place(
      "stage-lights",
      "stage",
      [103.5, 0],
      Math.PI
    );
    expect(hi).toBeCloseTo(r.ceilingM, 1);
    expect(lo).toBeGreaterThan(r.ceilingM - 2);
    expect(lamps.length).toBeGreaterThan(0);
  });

  it("spans the curtain across the stage, inside its side walls and under its ceiling", () => {
    const { y0, y1, hi, r } = place(
      "stage-curtain",
      "stage",
      [107, 0],
      Math.PI
    );
    const ys = r.outline.map((p) => p[1]);
    expect(y0).toBeGreaterThanOrEqual(Math.min(...ys) - 1e-6);
    expect(y1).toBeLessThanOrEqual(Math.max(...ys) + 1e-6);
    expect(y1 - y0).toBeGreaterThan(12);
    expect(hi).toBeLessThan(r.ceilingM);
  });

  it("keeps an exit sign under a low ceiling and draws no glass lift car (the lift's)", () => {
    const { hi, r } = place("exit-sign", "corridor-1", [30, -9.9]);
    expect(hi).toBeLessThan(r.ceilingM - 0.14);
    const car = place("glass-lift-car", "atrium-3", [65, 0]);
    expect(car.L.triangles).toBe(0);
  });

  it("sizes a seat row by its seats", () => {
    const six = place("theatre-seat-row", "theatre", [95, 5.85]);
    const r = room("theatre");
    const L = new ModernLayers();
    addPiece(
      L,
      {
        room: r.id,
        piece: "theatre-seat-row",
        at: [95, 5.85],
        yaw: 0,
        seats: 6,
      },
      r,
      concordia
    );
    let w = 0;
    for (const b of L.all)
      for (let i = 0; i < b.pos.length; i += 3)
        w = Math.max(w, Math.abs(-b.pos[i + 2] - 5.85));
    expect(w).toBeLessThanOrEqual(3 * 0.55 + 0.02);
    expect(six.y1 - six.y0).toBeGreaterThan(5);
  });
});
