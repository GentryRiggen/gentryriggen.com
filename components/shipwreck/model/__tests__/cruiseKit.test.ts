import type { HullStation, ShipSpec } from "@/lib/shipwreck/ships/types";
import {
  balconyFronts,
  balconyTiers,
  boatDavits,
  bridgeWings,
  createPanes,
  cruiseFrame,
  emergencyMask,
  liferaftRacks,
  lowerTiers,
  nameBoards,
  ovalFunnels,
  railKit,
  recessBoats,
  twinScrews,
} from "../cruiseKit";

/**
 * The cruise kit's builders on a small made-up ship: a 100 m box-ish hull,
 * 20 m wide, its deck edge 10 m over the keel, decks "1" to "6" every 3 m
 * over it. (The real test of the lift is the Concordia's recipe snapshot.)
 */
function station(x: number): HullStation {
  const bilge = Math.abs(x) > 40 ? 6 : 10;
  return {
    x,
    offsets: [
      [0, 2],
      [2, bilge * 0.9],
      [10, bilge],
    ],
  };
}
const SPEC = {
  id: "poseidon",
  beam: 20,
  depth: 10,
  stations: [-50, -40, -20, 0, 20, 40, 50].map(station),
  sheerZ: () => 10,
  decks: ["6", "5", "4", "3", "2", "1"].map((name) => ({
    name,
    z: 10 + 3 * Number(name),
  })),
  funnels: [{ x: -20, baseZ: 28, topZ: 40, dummy: false, falls: false }],
} as unknown as ShipSpec;
const frame = cruiseFrame(SPEC);
const paint = { wall: 0xffffff, roof: 0xcccccc };

describe("the cruise kit", () => {
  it("reads her decks and deck edge", () => {
    expect(frame.Z("3")).toBe(19);
    expect(frame.edge(0)).toBeCloseTo(10, 6);
    expect(() => frame.Z("99")).toThrow();
  });

  it("builds lower and balcony tiers inside the given ends", () => {
    const lower = lowerTiers({
      paint,
      stern: -50,
      stem: 50,
      tier: 3,
      base: { deck: "1", x0: -49, h: 3 },
      bowPlating: { x: 40, h: 6 },
      foredeck: "3",
      recess: {
        deck: "2",
        span: [-30, 30],
        inset: 3,
        wall: 0x999999,
        aftX0: -48,
        tiers: 2,
      },
      over: { deck: "4", x0: -47, x1: 42, roundFwd: 8 },
    });
    expect(lower.map((b) => b.id)).toEqual([
      "deck-1",
      "bow-plating",
      "foredeck",
      "deck-2-aft",
      "boat-recess",
      "deck-2-fwd",
      "deck-4",
    ]);
    const decks = ["5", "6"];
    const upper = balconyTiers({
      paint,
      decks,
      aftEnd: { "5": -45, "6": -42 },
      fwdEnd: { "5": 44, "6": 40 },
      span: [-30, 30],
      depth: 1.5,
      shade: 0x888888,
      tier: 3,
      bridgeDeck: "6",
      roundFwd: 8,
    });
    // An after and a forward end per deck, a floor over all but the
    // lowest, one back wall.
    expect(upper).toHaveLength(2 * decks.length + decks.length - 1 + 1);
    expect(upper.map((b) => b.id)).toContain("bridge");
    for (const b of [...lower, ...upper]) {
      expect(b.x0).toBeLessThan(b.x1);
      expect(b.x0).toBeGreaterThanOrEqual(-50);
      expect(b.x1).toBeLessThanOrEqual(50);
    }
    const wall = upper.find((b) => b.id === "balcony-wall")!;
    expect(wall.h).toBe(6);
    expect(wall.inset).toBe(1.5);
  });

  it("gives a glass run per panel and a partition per pitch on each balcony deck", () => {
    const boxes = balconyFronts(frame, {
      decks: ["5", "6"],
      span: [-30, 30],
      depth: 1.5,
      runs: 6,
      pitch: 3,
      glass: 0x2f5a85,
      partition: 0xffffff,
    });
    const glass = boxes.filter((b) => b.color === 0x2f5a85);
    // 6 runs, two sides, two decks.
    expect(glass).toHaveLength(24);
    // Partitions every 3 m from −27 to 27 (19), two sides, two decks.
    expect(boxes.length - glass.length).toBe(4 * 19);
    for (const b of boxes) {
      expect(Math.abs(b.c[0])).toBeLessThanOrEqual(30);
      expect(Math.abs(b.c[1])).toBeLessThanOrEqual(frame.edge(b.c[0]) + 0.01);
    }
    const wings = bridgeWings(frame, {
      x: 20,
      z: 30,
      inset: 3,
      length: 4,
      h: 3,
      color: 1,
    });
    expect(wings).toHaveLength(2);
    for (const w of wings)
      expect(Math.abs(w.c[1]) + w.size[1] / 2).toBeCloseTo(10.3, 6);
  });

  it("puts each data boat in the recess, two davits each, rafts at the racks", () => {
    const data = [
      { index: 0, side: "starboard" as const, x: -10 },
      { index: 1, side: "starboard" as const, x: 10 },
      { index: 2, side: "port" as const, x: -10 },
      { index: 3, side: "port" as const, x: 10 },
    ];
    const boats = recessBoats(frame, data, {
      deck: "2",
      boat: { length: 8, beam: 3, depth: 1.8 },
    });
    expect(boats.map((b) => b.label)).toEqual(["S1", "S2", "P1", "P2"]);
    for (const b of boats) {
      expect(Math.abs(b.y) + b.beam / 2).toBeLessThan(frame.edge(b.x));
      expect(b.deckZ).toBe(frame.Z("2"));
    }
    const davits = boatDavits(boats);
    expect(davits).toHaveLength(8);
    for (const d of davits)
      expect(Math.abs(d.x - boats[d.boat].x)).toBeLessThan(4);
    const rafts = liferaftRacks(frame, { fromX: [30, -35], count: 3, z: 16 });
    expect(rafts).toHaveLength(2 * 2 * 3 * 2);
  });

  it("lights panes only on window faces, a sparse emergency share", () => {
    const panes = createPanes(frame, 99);
    for (const s of [1, -1] as const)
      panes.row(-30, 30, 2, 0, 1, (x) =>
        panes.sideLight(x, frame.Z("5") + 1.4, s, 1.5, 1.4, 2, "5")
      );
    panes.frontLights(44, 8, 8, frame.Z("5") + 1.4, 7, [1.5, 1.3], "5");
    panes.aftFace(-45, frame.Z("5"), "5");
    const { lights } = panes;
    expect(lights.length).toBe(
      2 * 31 + 7 + lights.filter((l) => l.n[0] === -1).length
    );
    for (const l of lights) {
      expect(l.kind).toBe("window");
      // On a face: its normal points out of her side, forward or aft.
      expect(Math.hypot(...l.n)).toBeCloseTo(1, 6);
      if (Math.abs(l.n[1]) > 0.9) {
        expect(Math.sign(l.p[1])).toBe(Math.sign(l.n[1]));
        expect(Math.abs(l.p[1])).toBeCloseTo(
          frame.edge(l.p[0]) - 1.5 + 0.03 * Math.abs(l.n[1]),
          1
        );
      }
      expect(l.p[2]).toBeGreaterThan(frame.Z("5"));
      expect(l.p[2]).toBeLessThan(frame.Z("6"));
    }
    emergencyMask(lights, 0.2);
    const lit = lights.filter((l) => l.emergency).length;
    expect(lit).toBeGreaterThan(0);
    expect(lit).toBeLessThan(lights.length / 2);
  });

  it("runs rails along both edges and across", () => {
    const k = railKit();
    k.edgeRun(-30, 30, 20, () => 9);
    k.acrossRun(-30, 20, 9);
    expect(k.rails).toHaveLength(3);
    for (const p of k.rails.flatMap((r) => r.points)) {
      expect(Math.abs(p[0])).toBeLessThanOrEqual(30);
      expect(Math.abs(p[1])).toBeLessThanOrEqual(9 + 1e-9);
    }
  });

  it("makes her funnel, twin screws and rudders, and her names", () => {
    const [f] = ovalFunnels(SPEC, { semiA: 4, semiB: 2.5, blackTop: 2 });
    expect(f).toMatchObject({ x: -20, baseZ: 28, topZ: 40, rake: 0 });
    expect(f.emblem).toBeUndefined();
    const u = twinScrews(frame.hull, {
      hubX: -45,
      hubY: 4,
      hubZ: 1.5,
      radius: 1,
      blades: 4,
      phases: [0, 1],
      bracketColor: 0x7a2a22,
    });
    expect(u.propellers).toHaveLength(2);
    expect(u.bossings).toHaveLength(2);
    expect(u.rudder.ys).toEqual([4, -4]);
    expect(u.brackets).toHaveLength(6);
    const names = nameBoards({
      bow: { x: 40, z: 8, width: 8, height: 1 },
      stern: { x: -50, z: 8, width: 8, height: 1 },
    });
    expect(names.map((n) => n.side)).toEqual(["port", "starboard", "aft"]);
  });
});
