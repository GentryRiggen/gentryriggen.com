import { Vector3 } from "three";
import { moonNearCamera, moonPosition } from "../Moon";

describe("moonNearCamera", () => {
  it("hides the Moon inside 1.5 units of the camera", () => {
    const cam = new Vector3(0, 0.3, 4.7);
    expect(moonNearCamera(new Vector3(0, 0.3, 3.5), cam)).toBe(true);
    expect(moonNearCamera(new Vector3(0, 0.3, 2.9), cam)).toBe(false);
  });

  it("hides the Moon for only a short part of its lap", () => {
    const cam = new Vector3(0, 0.3, 4.7);
    const p = new Vector3();
    let hidden = 0;
    for (let t = 0; t < 60; t += 0.25) {
      if (moonNearCamera(moonPosition(t, p), cam)) hidden++;
    }
    expect(hidden).toBeGreaterThan(0);
    expect(hidden / 240).toBeLessThan(0.15);
  });
});
