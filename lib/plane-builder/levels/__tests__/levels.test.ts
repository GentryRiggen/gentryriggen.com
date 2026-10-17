// lib/plane-builder/levels/__tests__/levels.test.ts
import { buildLevel, RING_CHAIN_GAP } from "../generate";
import { LEVELS, LEVEL_ORDER } from "../index";
import { CANYON_SPEC } from "../canyon";
import { MEADOW_SPEC } from "../meadow";
import { MOUNTAINS_SPEC } from "../mountains";
import { terrainHeight } from "../terrain";

describe("levels", () => {
  it("are in order with growing finish lines", () => {
    expect(LEVEL_ORDER).toEqual(["meadow", "canyon", "mountains"]);
    expect(LEVEL_ORDER.map((id) => LEVELS[id].finishDistance)).toEqual([
      2000, 4000, 6000,
    ]);
  });

  it("build the same every time", () => {
    expect(buildLevel(MEADOW_SPEC)).toEqual(buildLevel(MEADOW_SPEC));
  });

  it.each(LEVEL_ORDER)("%s keeps the launch area clear", (id) => {
    const level = LEVELS[id];
    for (const o of level.obstacles.filter((o) => o.hard)) {
      expect(o.center.x - o.half.x).toBeGreaterThan(80);
    }
  });

  it.each(LEVEL_ORDER)("%s sits obstacles on the ground", (id) => {
    const level = LEVELS[id];
    for (const o of level.obstacles) {
      const ground = terrainHeight(level.terrain, o.center.x, o.center.z);
      expect(o.center.y - o.half.y).toBeGreaterThanOrEqual(ground - 0.01);
    }
  });

  it.each(LEVEL_ORDER)("%s has coins and rings", (id) => {
    expect(LEVELS[id].coins.length).toBeGreaterThan(20);
    expect(LEVELS[id].rings.length).toBeGreaterThan(3);
  });
});

describe("terrainHeight", () => {
  const terrain = {
    seed: 7,
    amplitude: 30,
    wavelength: 120,
    flatUntil: 100,
  };
  it("is flat at the slingshot", () => {
    expect(terrainHeight(terrain, 50, 10)).toBe(0);
  });
  it("is never below zero", () => {
    for (let x = 0; x < 3000; x += 37) {
      expect(terrainHeight(terrain, x, (x % 90) - 45)).toBeGreaterThanOrEqual(
        0
      );
    }
  });
});

describe("1.2 level content", () => {
  it.each(LEVEL_ORDER)(
    "%s ring chains stay in the corridor, 12-40 m up",
    (id) => {
      const level = LEVELS[id];
      for (const r of level.rings) {
        const ground = terrainHeight(level.terrain, r.center.x, r.center.z);
        expect(Math.abs(r.center.z)).toBeLessThanOrEqual(
          level.corridorHalfWidth
        );
        expect(r.center.y - ground).toBeGreaterThanOrEqual(11.99);
        expect(r.center.y - ground).toBeLessThanOrEqual(40.01);
      }
    }
  );

  it.each(LEVEL_ORDER)("%s has rings in chains of 3+", (id) => {
    const xs = LEVELS[id].rings.map((r) => r.center.x).sort((a, b) => a - b);
    const close = xs.filter(
      (x, i) => i > 0 && x - xs[i - 1] <= RING_CHAIN_GAP + 0.01
    );
    expect(close.length).toBeGreaterThanOrEqual(xs.length * 0.6);
  });

  it.each(LEVEL_ORDER)("%s has fuel cans from 300 m, 12-40 m up", (id) => {
    const level = LEVELS[id];
    expect(level.fuelCans.length).toBeGreaterThan(2);
    for (const c of level.fuelCans) {
      expect(c.x).toBeGreaterThanOrEqual(300);
      const h = c.y - terrainHeight(level.terrain, c.x, c.z);
      expect(h).toBeGreaterThanOrEqual(11.99);
      expect(h).toBeLessThanOrEqual(40.01);
    }
  });

  it.each([MEADOW_SPEC, CANYON_SPEC, MOUNTAINS_SPEC])(
    "$id keeps set-piece windows free of generated hard obstacles",
    (spec) => {
      const plain = buildLevel({ ...spec, setPieces: [] });
      const level = buildLevel(spec);
      const placed = new Set(
        spec.setPieces.flatMap((p) =>
          (p.obstacles ?? []).map((o) => `${o.x},${o.z}`)
        )
      );
      for (const piece of spec.setPieces) {
        const generated = level.obstacles.filter(
          (o) =>
            o.hard &&
            !placed.has(`${o.center.x},${o.center.z}`) &&
            o.center.x + o.half.x >= piece.fromX &&
            o.center.x - o.half.x <= piece.toX
        );
        expect(generated).toEqual([]);
      }
      expect(plain.obstacles.length).toBeGreaterThan(0);
    }
  );

  it("ramps hard obstacles: sparser in the first quarter than the last", () => {
    const level = LEVELS.canyon;
    const hard = level.obstacles.filter((o) => o.hard && o.kind === "wall");
    const q = level.finishDistance / 4;
    const first = hard.filter((o) => o.center.x < q).length;
    const last = hard.filter(
      (o) => o.center.x >= 3 * q && o.center.x < 4 * q
    ).length;
    expect(first).toBeLessThan(last);
  });

  it("gives the meadow updrafts and the mountains one before the pass", () => {
    expect(LEVELS.meadow.winds.filter((w) => w.lift > 0)).toHaveLength(3);
    expect(
      LEVELS.mountains.winds.some(
        (w) => w.lift > 0 && w.fromX <= 5300 && w.toX >= 5300
      )
    ).toBe(true);
  });

  it.each(LEVEL_ORDER)("%s keeps pickups out of hard obstacles", (id) => {
    const level = LEVELS[id];
    const inside = (p: { x: number; y: number; z: number }) =>
      level.obstacles.some(
        (o) =>
          o.hard &&
          Math.abs(p.x - o.center.x) <= o.half.x &&
          Math.abs(p.y - o.center.y) <= o.half.y &&
          Math.abs(p.z - o.center.z) <= o.half.z
      );
    expect(level.coins.filter(inside)).toEqual([]);
    expect(level.rings.map((r) => r.center).filter(inside)).toEqual([]);
    expect(level.fuelCans.filter(inside)).toEqual([]);
  });
});
