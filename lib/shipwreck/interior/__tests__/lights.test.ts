import { TITANIC_INTERIOR } from "../titanic";
import {
  LIGHT_SEGMENT_M,
  lightSegments,
  segmentAt,
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

describe("light segments (a long hall's lamps die by the water at each part)", () => {
  const sr = TITANIC_INTERIOR.rooms.find((r) => r.id === "scotland-road")!;

  it("cuts Scotland Road into about 8 m parts along its axis; short rooms are one", () => {
    expect(LIGHT_SEGMENT_M).toBe(8);
    const segs = lightSegments(sr);
    const [p, q] = sr.axis!;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    expect(segs.length).toBe(Math.ceil(len / LIGHT_SEGMENT_M));
    // End to end, in order from the axis's start, each mid on the axis.
    expect(segs[0].from).toBe(0);
    expect(segs[segs.length - 1].to).toBeCloseTo(len, 9);
    for (let i = 1; i < segs.length; i += 1)
      expect(segs[i].from).toBeCloseTo(segs[i - 1].to, 9);
    for (const s of segs) {
      expect(s.to - s.from).toBeLessThanOrEqual(LIGHT_SEGMENT_M + 1e-9);
      expect(s.mid[1]).toBeCloseTo(p[1], 9);
    }
    for (const r of TITANIC_INTERIOR.rooms) {
      if (r.id === "scotland-road") continue;
      // Only halls longer than LONG_ROOM_M are cut (no stair: its floor
      // is a ramp, its lamps at its head).
      const n = lightSegments(r).length;
      if (n > 0) {
        expect(r.ramp).toBeUndefined();
        expect(r.axis).toBeDefined();
      }
    }
    expect(
      lightSegments(TITANIC_INTERIOR.rooms.find((r) => r.id === "suite-1")!)
    ).toEqual([]);
  });

  it("finds the part a point is in, clamped to the ends", () => {
    const segs = lightSegments(sr);
    const [p, q] = sr.axis!;
    expect(segmentAt(sr, p[0], p[1])).toBe(0);
    expect(segmentAt(sr, q[0], q[1])).toBe(segs.length - 1);
    expect(segmentAt(sr, p[0] + 100, p[1])).toBe(0);
    expect(segmentAt(sr, q[0] - 100, q[1])).toBe(segs.length - 1);
    for (let i = 0; i < segs.length; i += 1)
      expect(segmentAt(sr, segs[i].mid[0], 4.3)).toBe(i);
  });

  it("puts the forward lamps out first as the water creeps aft", () => {
    // Water over each part's middle with her bow down: deeper forward.
    const segs = lightSegments(sr);
    const depth = (x: number) => 0.9 - (70 - x) * 0.02; // 0.9 m at x 70
    const lit = segs.map((s) => roomPower(1, depth(s.mid[0]), 0) > 0);
    // Out at the forward end, lit at the after end, one change between.
    expect(lit[0]).toBe(false);
    expect(lit[lit.length - 1]).toBe(true);
    let changes = 0;
    for (let i = 1; i < lit.length; i += 1)
      if (lit[i] !== lit[i - 1]) changes += 1;
    expect(changes).toBe(1);
  });
});
