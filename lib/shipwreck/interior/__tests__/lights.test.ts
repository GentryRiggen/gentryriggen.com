import {
  ROOM_DARK_AT_M,
  ROOM_FLICKER_FROM_M,
  TORCH_BELOW,
  roomPower,
  torchOn,
} from "../lights";

describe("roomPower", () => {
  it("is the ship's power while the water is under 0.3 m", () => {
    expect(ROOM_FLICKER_FROM_M).toBe(0.3);
    for (const d of [-Infinity, -2, 0, 0.1, 0.29])
      for (const p of [1, 0.6, 0]) expect(roomPower(p, d)).toBe(p);
    expect(roomPower(0.8, NaN)).toBe(0.8);
  });

  it("is out from 0.6 m (the water reached the wiring)", () => {
    expect(ROOM_DARK_AT_M).toBe(0.6);
    for (const d of [0.6, 0.8, 3, Infinity])
      expect(roomPower(1, d, 12.3)).toBe(0);
  });

  it("flickers between 0.3 and 0.6 m, deterministically", () => {
    const seen: number[] = [];
    for (let i = 0; i < 300; i += 1) {
      const t = i * 0.05;
      const d = 0.3 + (i % 30) * 0.01;
      const v = roomPower(1, d, t);
      expect(v).toBeGreaterThanOrEqual(0.15);
      expect(v).toBeLessThanOrEqual(1);
      expect(roomPower(1, d, t)).toBe(v);
      expect(roomPower(0.5, d, t)).toBeCloseTo(v * 0.5, 12);
      seen.push(v);
    }
    // Some dips, some near full.
    expect(seen.some((v) => v < 0.5)).toBe(true);
    expect(seen.some((v) => v > 0.85)).toBe(true);
  });
});

describe("torchOn", () => {
  it("comes on under 0.35", () => {
    expect(TORCH_BELOW).toBe(0.35);
    expect(torchOn(0)).toBe(true);
    expect(torchOn(0.34)).toBe(true);
    expect(torchOn(0.35)).toBe(false);
    expect(torchOn(1)).toBe(false);
  });
});
