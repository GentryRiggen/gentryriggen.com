import { NANOBOT_TICKS, NanobotSchedule, nanobotTick } from "../nanobotSpread";

const dist = (k: number, seed: number) => {
  const { du, dv } = nanobotTick(k, seed);
  return Math.hypot(du, dv);
};
const mean = (k: number) =>
  Array.from({ length: 50 }, (_, s) => dist(k, s + 1)).reduce(
    (a, b) => a + b,
    0
  ) / 50;

describe("nanobotTick", () => {
  it("is deterministic per seed", () => {
    for (let k = 0; k < NANOBOT_TICKS; k++) {
      expect(nanobotTick(k, 7)).toEqual(nanobotTick(k, 7));
    }
    expect(nanobotTick(20, 7)).not.toEqual(nanobotTick(20, 8));
  });

  it("spreads outward, roughly with the square root of the tick", () => {
    expect(mean(39)).toBeGreaterThan(mean(9));
    expect(mean(39)).toBeGreaterThan(0.25);
    expect(mean(39)).toBeLessThan(0.55);
  });

  it("starts at the tap and stays finite", () => {
    expect(nanobotTick(0, 3)).toEqual({ du: 0, dv: 0 });
    for (let s = 0; s < 50; s++) {
      for (let k = 0; k < NANOBOT_TICKS; k++) {
        const { du, dv } = nanobotTick(k, s);
        expect(Number.isFinite(du)).toBe(true);
        expect(Number.isFinite(dv)).toBe(true);
      }
    }
  });
});

describe("NanobotSchedule", () => {
  it("fires a tick every 250 ms after the droplet lands, 40 in all", () => {
    const s = new NanobotSchedule();
    let all: number[] = [];
    for (let i = 0; i < 1100; i++) all = all.concat(s.step(0.01, true));
    expect(all).toEqual(Array.from({ length: NANOBOT_TICKS }, (_, i) => i));
    expect(s.finished).toBe(true);
  });

  it("does nothing during the droplet's fall", () => {
    const s = new NanobotSchedule();
    expect(s.step(0.1, true)).toEqual([]);
  });

  it("stops for good once the phase leaves playing", () => {
    const s = new NanobotSchedule();
    s.step(1, true);
    const before = s.next;
    expect(before).toBeGreaterThan(0);
    expect(s.step(1, false)).toEqual([]);
    expect(s.stopped).toBe(true);
    // Even if the phase came back, nothing more fires.
    expect(s.step(5, true)).toEqual([]);
    expect(s.next).toBe(before);
  });
});
