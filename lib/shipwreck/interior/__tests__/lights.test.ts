import { TITANIC_INTERIOR } from "../titanic";
import {
  EMERGENCY_DIP_MIN,
  emergencyFlicker,
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

describe("emergencyFlicker", () => {
  const EL = 0.25;
  /** Samples at 100 Hz: the dips (runs under 0.95) and the least seen. */
  function dips(heel: number, seconds: number, from = 0) {
    let n = 0;
    let least = 1;
    let inDip = false;
    const starts: number[] = [];
    for (let i = 0; i < seconds * 100; i += 1) {
      const t = from + i / 100;
      const v = emergencyFlicker(0.25, EL, t, heel);
      least = Math.min(least, v);
      const under = v < 0.95;
      if (under && !inDip) {
        n += 1;
        starts.push(t);
      }
      inDip = under;
    }
    return { n, least, starts };
  }

  it("returns the power itself above the emergency level", () => {
    for (const p of [1, 0.8, 0.5, 0.27])
      expect(emergencyFlicker(p, EL, 12.3, 30)).toBe(p);
  });

  it("does not dip under 10° of heel", () => {
    for (const heel of [0, 5, 9.99, -9.99]) expect(dips(heel, 60).n).toBe(0);
  });

  it("dips about once a second at 30° (either way) and less at 20°", () => {
    for (const heel of [30, -30]) {
      const { n } = dips(heel, 200);
      expect(n / 200).toBeGreaterThan(0.9);
      expect(n / 200).toBeLessThan(1.1);
    }
    const mid = dips(20, 400).n / 400;
    expect(mid).toBeGreaterThan(0.35);
    expect(mid).toBeLessThan(0.65);
  });

  it("never goes under 0.1 and is deterministic", () => {
    const { least } = dips(40, 120);
    expect(least).toBeGreaterThanOrEqual(EMERGENCY_DIP_MIN);
    expect(least).toBeLessThan(0.6);
    for (let t = 0; t < 30; t += 0.37)
      expect(emergencyFlicker(0.25, EL, t, 30)).toBe(
        emergencyFlicker(0.25, EL, t, 30)
      );
  });

  it("never flashes faster than about 3 Hz: dips start at least 0.4 s apart", () => {
    const { starts } = dips(30, 300);
    for (let i = 1; i < starts.length; i += 1)
      expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(0.39);
  });
});

describe("roomPower's soft flicker (hers)", () => {
  it("changes at most about 2.5 times a second at a steady depth, and not at all dry", () => {
    expect(roomPower(0.25, 0.1, 5, true)).toBe(0.25);
    let changes = 0;
    let last = roomPower(1, 0.4, 0, true);
    for (let i = 1; i < 2000; i += 1) {
      const v = roomPower(1, 0.4, i / 100, true);
      if (v !== last) changes += 1;
      last = v;
    }
    expect(changes / 20).toBeLessThanOrEqual(2.6);
    expect(roomPower(1, 0.7, 3, true)).toBe(0);
  });

  it("leaves the Titanic's flicker as it was", () => {
    expect(roomPower(1, 0.4, 3.3)).toBe(roomPower(1, 0.4, 3.3, false));
  });
});
