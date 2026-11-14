import { cellsWithin, gridFromLuminance } from "../population";
import { uvToDir } from "../sphere";

describe("gridFromLuminance", () => {
  it("sums to 1 and weights bright pixels more", () => {
    const w = 8;
    const h = 4;
    const lum = new Array(w * h).fill(0);
    lum[5] = 1;
    const g = gridFromLuminance(lum, w, h);
    let sum = 0;
    for (const x of g.weights) sum += x;
    expect(sum).toBeCloseTo(1, 6);
    expect(g.weights[5]).toBeGreaterThan(g.weights[6]);
    expect(g.weights[6]).toBeGreaterThan(0);
  });
});

describe("cellsWithin", () => {
  const grid = { w: 256, h: 128 };

  it("wraps across the seam", () => {
    const cols = new Set(
      cellsWithin(grid, uvToDir(0.998, 0.5), 0.05).map((c) => c % grid.w)
    );
    expect(cols.has(0)).toBe(true);
    expect(cols.has(grid.w - 1)).toBe(true);
  });

  it("covers the whole top row at the pole and nothing deep", () => {
    const cells = cellsWithin(grid, uvToDir(0.3, 1), 0.1);
    const rows = cells.map((c) => Math.floor(c / grid.w));
    for (let col = 0; col < grid.w; col++) expect(cells).toContain(col);
    expect(Math.max(...rows)).toBeLessThan(6);
  });

  it("always includes the centre cell", () => {
    expect(cellsWithin(grid, uvToDir(0.5, 0.5), 0).length).toBeGreaterThan(0);
  });
});
