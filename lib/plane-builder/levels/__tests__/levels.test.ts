// lib/plane-builder/levels/__tests__/levels.test.ts
import { buildLevel } from "../generate";
import { LEVELS, LEVEL_ORDER } from "../index";
import { MEADOW_SPEC } from "../meadow";
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
