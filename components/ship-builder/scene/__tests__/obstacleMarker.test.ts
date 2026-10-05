import { markerColor, markerRadius } from "../obstacleMarker";

describe("markerColor", () => {
  it("is soft for buoys and a warning for the rest", () => {
    expect(markerColor("buoy")).not.toBe(markerColor("iceberg"));
    expect(markerColor("iceberg")).toBe(markerColor("rock"));
    expect(markerColor("ship")).not.toBe(markerColor("rock"));
  });
});

describe("markerRadius", () => {
  it("rings the obstacle just outside its edge", () => {
    expect(markerRadius(10, 20)).toBeGreaterThan(10);
  });

  it("keeps small things visible from a high camera", () => {
    expect(markerRadius(0.5, 100)).toBeGreaterThanOrEqual(3);
    expect(markerRadius(0.5, 200)).toBeGreaterThan(markerRadius(0.5, 100));
  });

  it("is finite and positive for any input", () => {
    for (const radius of [0, -1, NaN, Infinity]) {
      for (const height of [0, -1, NaN, Infinity]) {
        const value = markerRadius(radius, height);
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
    }
  });
});
