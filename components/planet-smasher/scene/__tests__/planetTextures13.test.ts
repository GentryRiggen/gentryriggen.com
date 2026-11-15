import {
  POP_H,
  POP_W,
  gridFromLuminance,
} from "@/lib/planet-smasher/population";
import { worldPixels } from "../planetTextures";

const WORLDS = ["lava", "candy", "ocean"] as const;
const SIZE: [number, number] = [128, 64];

const pixel = (data: Uint8ClampedArray, w: number, x: number, y: number) => {
  const i = (y * w + x) * 4;
  return [data[i], data[i + 1], data[i + 2]];
};

describe.each(WORLDS)("%s world", (id) => {
  it("is deterministic", () => {
    const a = worldPixels(id, ...SIZE);
    const b = worldPixels(id, ...SIZE);
    for (const [x, y] of [
      [0, 0],
      [17, 40],
      [64, 32],
      [100, 9],
      [127, 63],
    ]) {
      expect(pixel(a.day, SIZE[0], x, y)).toEqual(pixel(b.day, SIZE[0], x, y));
      expect(pixel(a.night, SIZE[0], x, y)).toEqual(
        pixel(b.night, SIZE[0], x, y)
      );
    }
    expect(Array.from(a.lum)).toEqual(Array.from(b.lum));
  });

  it("has population weights that sum to 1", () => {
    const { lum } = worldPixels(id, ...SIZE);
    const g = gridFromLuminance(lum, POP_W, POP_H);
    const sum = Array.from(g.weights).reduce((n, w) => n + w, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("paints every pixel opaque", () => {
    const { day } = worldPixels(id, ...SIZE);
    for (let i = 3; i < day.length; i += 4) expect(day[i]).toBe(255);
  });
});

describe("Aquaria", () => {
  it("keeps most of its people on a small share of the map", () => {
    const { lum } = worldPixels("ocean", ...SIZE);
    const { weights } = gridFromLuminance(lum, POP_W, POP_H);
    const sorted = Array.from(weights).sort((a, b) => b - a);
    const top = Math.floor(sorted.length * 0.2);
    const share = sorted.slice(0, top).reduce((n, w) => n + w, 0);
    expect(share).toBeGreaterThan(0.7);
  });
});

describe("Magmar", () => {
  it("has bright lava on a dark crust", () => {
    const { day } = worldPixels("lava", ...SIZE);
    let bright = 0;
    let dark = 0;
    for (let i = 0; i < day.length; i += 4) {
      const lum = (day[i] + day[i + 1] + day[i + 2]) / 3;
      if (lum > 140) bright++;
      if (lum < 60) dark++;
    }
    const n = day.length / 4;
    expect(bright / n).toBeGreaterThan(0.03);
    expect(dark / n).toBeGreaterThan(0.3);
  });
});
