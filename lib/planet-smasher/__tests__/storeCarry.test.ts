import { POP_H, POP_W, gridFromLuminance } from "../population";
import { useGameStore } from "../store";

jest.mock("../damage", () => {
  const actual = jest.requireActual("../damage");
  return {
    ...actual,
    applyHit: jest.fn(() => ({
      peopleLost: 1,
      healthLost: 0,
      points: 0,
      rawPoints: 0.4,
      ending: null,
    })),
  };
});

const grid = gridFromLuminance(new Array(POP_W * POP_H).fill(1), POP_W, POP_H);

describe("fractional points", () => {
  it("keeps the sub-point part of each hit", () => {
    window.localStorage.clear();
    useGameStore.getState().init(grid);
    for (let i = 0; i < 20; i++)
      // Spaced past the combo window, so no combo bonus muddies the carry.
      useGameStore.getState().hit("asteroid", 0.5, 0.5, i * 5000);
    expect(useGameStore.getState().progress.points).toBe(8);
  });
});
