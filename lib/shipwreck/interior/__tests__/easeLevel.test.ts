import { easeLevel, LEVEL_EASE_M_PER_S } from "../easeLevel";

/**
 * The shown water level in a room eases toward its target at most 0.5 m
 * per real second, so a room never pops full; a dry room (−Infinity) or a
 * first sight snaps.
 */

describe("easeLevel", () => {
  it("moves toward the target at most 0.5 m per real second by default", () => {
    expect(LEVEL_EASE_M_PER_S).toBe(0.5);
    expect(easeLevel(0, 10, 1)).toBeCloseTo(0.5);
    expect(easeLevel(0, -10, 0.5)).toBeCloseTo(-0.25);
    expect(easeLevel(2, 2.1, 1)).toBe(2.1);
    expect(easeLevel(2, 1.9, 1)).toBe(1.9);
    expect(easeLevel(0, 10, 1, 2)).toBeCloseTo(2);
  });

  it("reaches the target exactly and stays there", () => {
    let shown = 0;
    for (let i = 0; i < 300; i += 1) shown = easeLevel(shown, 1, 1 / 60);
    expect(shown).toBe(1);
    expect(easeLevel(1, 1, 1 / 60)).toBe(1);
  });

  it("snaps to or from a dry room (±Infinity) without NaN", () => {
    expect(easeLevel(-Infinity, 3, 1 / 60)).toBe(3);
    expect(easeLevel(3, -Infinity, 1 / 60)).toBe(-Infinity);
    expect(easeLevel(-Infinity, -Infinity, 1 / 60)).toBe(-Infinity);
    expect(easeLevel(Infinity, 3, 1 / 60)).toBe(3);
    expect(easeLevel(3, Infinity, 1 / 60)).toBe(Infinity);
    expect(easeLevel(NaN, 3, 1 / 60)).toBe(3);
  });

  it("never moves backward in time or on a bad step", () => {
    expect(easeLevel(1, 5, -1)).toBe(1);
    expect(easeLevel(1, 5, NaN)).toBe(1);
    expect(easeLevel(1, NaN, 1)).toBe(1);
    expect(easeLevel(1, 5, Infinity)).toBe(5);
  });
});
