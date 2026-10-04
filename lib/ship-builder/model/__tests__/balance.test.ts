import { LIST, computeListAngle, computeStats } from "../stats";
import { TEMPLATES } from "../../templates";
import type { PlacedPart } from "../types";
import { gridPart, testShip } from "../../testing";

/** Deck blocks over `levels` levels on columns `zs`, along the whole hull. */
function column(zs: number[], levels: number, length = 8): PlacedPart[] {
  const parts: PlacedPart[] = [];
  for (let level = 0; level < levels; level++) {
    for (let x = 0; x < length; x++) {
      for (const z of zs) {
        parts.push(gridPart(`p-${level}-${x}-${z}`, "deck-1x1", level, x, z));
      }
    }
  }
  return parts;
}

describe("side-to-side balance", () => {
  it("reads exactly level for a bare hull", () => {
    const stats = computeStats(testShip());
    expect(stats.listAngle).toBe(0);
    expect(stats.balance).toBe("Level");
  });

  it("reads exactly level for a symmetric ship", () => {
    const stats = computeStats(testShip(column([0, 1, 2, 3], 2)));
    expect(stats.listAngle).toBe(0);
    expect(stats.balance).toBe("Level");
    expect(stats.checks.some((c) => c.code === "lopsided")).toBe(false);
  });

  it("leans to port when the weight is on the port side (high z)", () => {
    const stats = computeStats(testShip(column([2, 3], 2)));
    expect(stats.listAngle).toBeLessThan(0);
    expect(stats.balance).toBe("Leans to port");
  });

  it("leans to starboard when the weight is on the starboard side", () => {
    const stats = computeStats(testShip(column([0, 1], 2)));
    expect(stats.listAngle).toBeGreaterThan(0);
    expect(stats.balance).toBe("Leans to starboard");
  });

  it("mirrors exactly", () => {
    const port = computeStats(testShip(column([2, 3], 2)));
    const starboard = computeStats(testShip(column([0, 1], 2)));
    expect(port.listAngle).toBeCloseTo(-starboard.listAngle, 10);
  });

  it("leans further with more weight on one side", () => {
    const light = computeStats(testShip(column([0], 1)));
    const heavy = computeStats(testShip(column([0], 2)));
    expect(Math.abs(heavy.listAngle)).toBeGreaterThan(
      Math.abs(light.listAngle)
    );
  });

  it("caps the list", () => {
    expect(computeListAngle(-1.5, 4, 0.2)).toBe(LIST.maxAngle);
    expect(computeListAngle(1.5, 4, 0.2)).toBe(-LIST.maxAngle);
  });

  it("adds a failing Sits level check after Stays upright", () => {
    const stats = computeStats(testShip(column([2, 3], 2)));
    const codes = stats.checks.map((c) => c.code);
    expect(codes.indexOf("lopsided")).toBe(codes.indexOf("top-heavy") + 1);
    const check = stats.checks.find((c) => c.code === "lopsided");
    expect(check?.ok).toBe(false);
    expect(check?.detail).toMatch(/leans \d+° to port/);
    expect(stats.warnings.some((w) => w.code === "lopsided")).toBe(true);
  });

  it("leaves the check out for a slight, unnoticeable lean", () => {
    const stats = computeStats(testShip([gridPart("a", "deck-1x1", 0, 0, 0)]));
    expect(stats.checks.some((c) => c.code === "lopsided")).toBe(false);
  });

  it("every template sits level", () => {
    for (const template of Object.values(TEMPLATES).flat()) {
      const stats = computeStats(template.build());
      expect([template.id, stats.listAngle]).toEqual([template.id, 0]);
      expect(stats.balance).toBe("Level");
    }
  });
});
