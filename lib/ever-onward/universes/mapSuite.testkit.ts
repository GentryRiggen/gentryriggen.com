import { playRoute } from "../engine/mapPacing";
import type { Strategy } from "../engine/sim";
import type { UniverseDef } from "../engine/types";

/**
 * The checks every universe's map passes (shared by the per-universe map
 * tests): its shape, its art, and the route bot's pacing. Not a test file
 * itself; call it from one.
 */
export function describeMap(
  def: UniverseDef,
  tapper: () => Strategy,
  options: { maxRatioAtRun10?: number } = {}
): void {
  const maxRatioAtRun10 = options.maxRatioAtRun10 ?? 0.8;
  const map = def.map!;

  describe(`${def.title}: ${map.title}`, () => {
    it("is 8 x 8 with a change per column and row, the first changing nothing", () => {
      expect(map.cols).toBe(8);
      expect(map.rows).toBe(8);
      expect(map.columns).toHaveLength(8);
      expect(map.rowChanges).toHaveLength(8);
      expect(map.columns[0]).toEqual({ text: "" });
      expect(map.rowChanges[0]).toEqual({ text: "" });
    });

    it("has 14 artifacts on unique squares, none on the first or last", () => {
      const arts = map.artifacts;
      expect(arts).toHaveLength(14);
      const squares = arts.map((a) => `${a.x},${a.y}`);
      expect(new Set(squares).size).toBe(14);
      expect(squares).not.toContain("0,0");
      expect(squares).not.toContain("7,7");
      for (const a of arts) {
        expect(a.x).toBeLessThan(8);
        expect(a.y).toBeLessThan(8);
      }
      expect(new Set(arts.map((a) => a.id)).size).toBe(14);
      expect(arts.filter((a) => a.tier === "big")).toHaveLength(3);
      expect(arts.filter((a) => a.catch)).toHaveLength(4);
    });

    it("draws every glyph 12 x 12 from its own palette", () => {
      for (const art of [...map.artifacts, map.keepsake]) {
        expect(art.glyph).toHaveLength(12);
        for (const row of art.glyph) {
          expect(row).toHaveLength(12);
          for (const ch of row)
            if (ch !== ".") expect(art.palette[ch]).toBeDefined();
        }
      }
    });

    it("places every artifact inside the scene", () => {
      for (const a of map.artifacts) {
        expect(a.spot.x).toBeGreaterThanOrEqual(0);
        expect(a.spot.x + 12 * a.spot.scale).toBeLessThanOrEqual(400);
        expect(a.spot.y).toBeGreaterThanOrEqual(0);
        expect(a.spot.y + 12 * a.spot.scale).toBeLessThanOrEqual(300);
      }
    });

    describe("pacing (route bot)", () => {
      const route = playRoute(def, tapper(), 40);
      const first = route[0].finishTime;
      const ratio = (i: number) => route[i].finishTime / first;

      it("finishes every run on the route", () => {
        for (const r of route) expect(Number.isFinite(r.finishTime)).toBe(true);
      });

      it("run 2 is about run 1 (nothing is found until a run ends)", () => {
        expect(ratio(1)).toBeGreaterThanOrEqual(0.9);
        expect(ratio(1)).toBeLessThanOrEqual(1.05);
      });

      it(`run 10 is 65-${Math.round(maxRatioAtRun10 * 100)}% of run 1`, () => {
        expect(ratio(9)).toBeGreaterThanOrEqual(0.65);
        expect(ratio(9)).toBeLessThanOrEqual(maxRatioAtRun10);
      });

      it("finds all 14 within 40 runs, and no run drops under 40%", () => {
        expect(route.at(-1)!.found).toBe(14);
        for (let i = 0; i < route.length; i += 1)
          expect(ratio(i)).toBeGreaterThanOrEqual(0.4);
      });

      it("with every artifact on, a run is 45-55% of run 1", () => {
        const [all] = playRoute(def, tapper(), 1, { allOn: true });
        const r = all.finishTime / first;
        expect(r).toBeGreaterThanOrEqual(0.45);
        expect(r).toBeLessThanOrEqual(0.55);
      });
    });
  });
}
