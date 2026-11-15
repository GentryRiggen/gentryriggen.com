import { angularDistance, uvToDir } from "@/lib/planet-smasher/sphere";
import { tsunamiHits } from "../Tsunami";

describe("tsunamiHits", () => {
  const hits = tsunamiHits(0.3, 0.5, 11);
  const origin = uvToDir(0.3, 0.5);
  const radius = (h: { u: number; v: number }) =>
    angularDistance(origin, uvToDir(h.u, h.v));

  it("has 16 finite points", () => {
    expect(hits).toHaveLength(16);
    for (const h of hits) {
      expect([h.u, h.v, h.t].every(Number.isFinite)).toBe(true);
      expect(h.u).toBeGreaterThanOrEqual(0);
      expect(h.u).toBeLessThan(1);
    }
  });

  it("hits strictly later and later within 0.4 to 3 s", () => {
    for (let i = 0; i < hits.length; i++) {
      expect(hits[i].t).toBeGreaterThanOrEqual(0.4);
      expect(hits[i].t).toBeLessThanOrEqual(3);
      if (i > 0) expect(hits[i].t).toBeGreaterThan(hits[i - 1].t);
    }
  });

  it("moves outward from 0.2 to 1.2 rad", () => {
    for (let i = 1; i < hits.length; i++) {
      expect(radius(hits[i])).toBeGreaterThanOrEqual(radius(hits[i - 1]));
    }
    expect(radius(hits[0])).toBeCloseTo(0.2, 2);
    expect(radius(hits[15])).toBeCloseTo(1.2, 2);
  });

  it("spreads the angles round the ring", () => {
    const dirs = new Set(hits.map((h) => h.u.toFixed(2)));
    expect(dirs.size).toBeGreaterThan(8);
  });
});
