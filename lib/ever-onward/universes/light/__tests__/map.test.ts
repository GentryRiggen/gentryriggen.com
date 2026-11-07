import { playRoute } from "../../../engine/mapPacing";
import { lightUniverse } from "..";
import { lightBots } from "../bots";
import { LIGHT_ARTIFACTS, LIGHT_MAP } from "../map";

describe("Light's sea chart", () => {
  it("is 8 x 8 with a change per column and row, the first changing nothing", () => {
    expect(LIGHT_MAP.cols).toBe(8);
    expect(LIGHT_MAP.rows).toBe(8);
    expect(LIGHT_MAP.columns).toHaveLength(8);
    expect(LIGHT_MAP.rowChanges).toHaveLength(8);
    expect(LIGHT_MAP.columns[0]).toEqual({ text: "" });
    expect(LIGHT_MAP.rowChanges[0]).toEqual({ text: "" });
  });

  it("has 14 artifacts on unique squares, none on the first or last", () => {
    expect(LIGHT_ARTIFACTS).toHaveLength(14);
    const squares = LIGHT_ARTIFACTS.map((a) => `${a.x},${a.y}`);
    expect(new Set(squares).size).toBe(14);
    expect(squares).not.toContain("0,0");
    expect(squares).not.toContain("7,7");
    for (const a of LIGHT_ARTIFACTS) {
      expect(a.x).toBeLessThan(8);
      expect(a.y).toBeLessThan(8);
    }
    expect(new Set(LIGHT_ARTIFACTS.map((a) => a.id)).size).toBe(14);
    const tiers = LIGHT_ARTIFACTS.map((a) => a.tier);
    expect(tiers.filter((t) => t === "big")).toHaveLength(3);
  });

  it("draws every glyph 12 x 12 from its own palette", () => {
    for (const art of [...LIGHT_ARTIFACTS, LIGHT_MAP.keepsake]) {
      expect(art.glyph).toHaveLength(12);
      for (const row of art.glyph) {
        expect(row).toHaveLength(12);
        for (const ch of row)
          if (ch !== ".") expect(art.palette[ch]).toBeDefined();
      }
    }
  });

  it("artifacts with a catch say what they do and what they cost", () => {
    for (const a of LIGHT_ARTIFACTS) {
      expect(a.effect.length).toBeGreaterThan(10);
      if (a.catch !== undefined) expect(a.catch.length).toBeGreaterThan(10);
    }
    expect(LIGHT_ARTIFACTS.filter((a) => a.catch)).toHaveLength(4);
  });
});

describe("Light map pacing (route bot)", () => {
  const tapper = lightBots().tapper;
  const route = playRoute(lightUniverse, tapper, 40);
  const first = route[0].finishTime;
  const ratio = (i: number) => route[i].finishTime / first;

  it("finishes every run on the route", () => {
    for (const r of route) expect(Number.isFinite(r.finishTime)).toBe(true);
  });

  it("run 2 is about run 1 (nothing is found until a run ends)", () => {
    expect(ratio(1)).toBeGreaterThanOrEqual(0.9);
    expect(ratio(1)).toBeLessThanOrEqual(1.05);
  });

  it("run 10 is 65-80% of run 1", () => {
    expect(ratio(9)).toBeGreaterThanOrEqual(0.65);
    expect(ratio(9)).toBeLessThanOrEqual(0.8);
  });

  it("finds all 14 artifacts within 40 runs, and no run drops under 40%", () => {
    expect(route.at(-1)!.found).toBe(14);
    for (let i = 0; i < route.length; i += 1)
      expect(ratio(i)).toBeGreaterThanOrEqual(0.4);
  });

  it("with every artifact on, a run is 45-55% of run 1", () => {
    const [all] = playRoute(lightUniverse, tapper, 1, { allOn: true });
    const r = all.finishTime / first;
    expect(r).toBeGreaterThanOrEqual(0.45);
    expect(r).toBeLessThanOrEqual(0.55);
  });
});
