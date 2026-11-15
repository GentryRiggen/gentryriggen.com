import { angularDistance, uvToDir } from "@/lib/planet-smasher/sphere";
import { monsterPath } from "../Monster";

describe("monsterPath", () => {
  it("has 4 finite stomp points, the first at the tap", () => {
    const p = monsterPath(0.3, 0.55, 7);
    expect(p).toHaveLength(4);
    for (const s of p) {
      expect(Number.isFinite(s.u)).toBe(true);
      expect(Number.isFinite(s.v)).toBe(true);
    }
    expect(p[0]).toEqual({ u: 0.3, v: 0.55 });
  });

  it("steps about 0.12 rad each time", () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = monsterPath(0.4, 0.5, seed);
      for (let i = 1; i < p.length; i++) {
        const d = angularDistance(
          uvToDir(p[i - 1].u, p[i - 1].v),
          uvToDir(p[i].u, p[i].v)
        );
        expect(Math.abs(d - 0.12)).toBeLessThan(0.03);
      }
    }
  });

  it("walks in one heading (nearly a straight line)", () => {
    const p = monsterPath(0.4, 0.5, 3);
    const total = angularDistance(
      uvToDir(p[0].u, p[0].v),
      uvToDir(p[3].u, p[3].v)
    );
    expect(total).toBeGreaterThan(0.3);
  });

  it("wraps u into [0,1) over the seam", () => {
    for (let seed = 0; seed < 40; seed++) {
      for (const u of [0, 0.001, 0.999]) {
        for (const s of monsterPath(u, 0.5, seed)) {
          expect(s.u).toBeGreaterThanOrEqual(0);
          expect(s.u).toBeLessThan(1);
          expect(s.v).toBeGreaterThanOrEqual(0);
          expect(s.v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("is the same for the same seed and survives the poles", () => {
    expect(monsterPath(0.2, 0.5, 5)).toEqual(monsterPath(0.2, 0.5, 5));
    for (const v of [0, 1]) {
      for (const s of monsterPath(0.5, v, 2)) {
        expect(Number.isFinite(s.u) && Number.isFinite(s.v)).toBe(true);
      }
    }
  });
});
