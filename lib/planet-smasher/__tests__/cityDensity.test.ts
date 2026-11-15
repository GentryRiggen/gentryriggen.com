import { applyHit, createPlanetState } from "../damage";
import { POP_FLOOR, POP_H, POP_W, gridFromLuminance } from "../population";

describe("population density", () => {
  it("kills at least 50x more on a city than on an empty area", () => {
    const lum = new Float32Array(POP_W * POP_H);
    // One bright 12x8 city block around (u 0.25, v 0.5).
    for (let row = 60; row < 68; row++) {
      for (let col = 58; col < 70; col++) lum[row * POP_W + col] = 1;
    }
    const grid = gridFromLuminance(lum, POP_W, POP_H);
    expect(POP_FLOOR).toBe(0.001);

    const city = applyHit(
      createPlanetState("earth", grid),
      "asteroid",
      0.25,
      0.5
    );
    const ocean = applyHit(
      createPlanetState("earth", grid),
      "asteroid",
      0.75,
      0.5
    );

    expect(ocean.peopleLost).toBeGreaterThan(0);
    expect(city.peopleLost).toBeGreaterThanOrEqual(50 * ocean.peopleLost);
  });
});
