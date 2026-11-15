import { createPlanetState } from "../damage";
import { POP_H, POP_W, gridFromLuminance } from "../population";
import { pickTargets } from "../targets";
import { uvToDir } from "../sphere";
import { cellsWithin } from "../population";

const grid = gridFromLuminance(new Array(POP_W * POP_H).fill(1), POP_W, POP_H);

describe("pickTargets", () => {
  it("puts the hottest cell first", () => {
    const s = createPlanetState("earth", grid);
    const cells = cellsWithin(s, uvToDir(0.5, 0.5), 0.1);
    s.remaining.fill(1);
    const hot = cells[Math.floor(cells.length / 2)];
    s.remaining[hot] = 1000;
    const out = pickTargets(s, 0.5, 0.5, 0.1, 4);
    const col = hot % POP_W;
    const row = Math.floor(hot / POP_W);
    expect(out[0].u).toBeCloseTo((col + 0.5) / POP_W, 6);
    expect(out[0].v).toBeCloseTo(1 - (row + 0.5) / POP_H, 6);
    expect(out).toHaveLength(4);
  });

  it("falls back to a ring on an empty grid", () => {
    const s = createPlanetState("earth", grid);
    s.remaining.fill(0);
    const out = pickTargets(s, 0.5, 0.5, 0.1, 12);
    expect(out).toHaveLength(12);
    for (const p of out) {
      expect(Number.isFinite(p.u)).toBe(true);
      expect(Number.isFinite(p.v)).toBe(true);
    }
  });

  it("wraps u into [0,1)", () => {
    const s = createPlanetState("earth", grid);
    for (const fill of [1, 0]) {
      s.remaining.fill(fill);
      for (const p of pickTargets(s, 0.995, 0.5, 0.1, 12)) {
        expect(p.u).toBeGreaterThanOrEqual(0);
        expect(p.u).toBeLessThan(1);
      }
    }
  });

  it("returns distinct cells", () => {
    const s = createPlanetState("earth", grid);
    const out = pickTargets(s, 0.3, 0.6, 0.1, 12);
    expect(new Set(out.map((p) => `${p.u}|${p.v}`)).size).toBe(12);
  });
});
