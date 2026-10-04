import { spinRevPerSec } from "../spin";

describe("spinRevPerSec", () => {
  it("stands still at 0 kn", () => {
    expect(spinRevPerSec(0)).toBe(0);
  });

  it("spins at 0.5 rev/s at 8 kn and 3 rev/s at 30 kn", () => {
    expect(spinRevPerSec(8)).toBeCloseTo(0.5);
    expect(spinRevPerSec(30)).toBeCloseTo(3);
  });

  it("is proportional to speed in between", () => {
    expect(spinRevPerSec(19)).toBeCloseTo(1.75);
  });

  it("clamps outside the 8 to 30 kn range", () => {
    expect(spinRevPerSec(3)).toBeCloseTo(0.5);
    expect(spinRevPerSec(60)).toBeCloseTo(3);
  });
});
