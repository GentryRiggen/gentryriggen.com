import { eventTime, powerLevel } from "../powerFlicker";

const HZ = 120;

function sample(
  reducedMotion: boolean,
  seconds = 10,
  start = 2
): { time: number; level: number }[] {
  return Array.from({ length: seconds * HZ }, (_, i) => {
    const time = start + i / HZ;
    return {
      time,
      level: powerLevel("flickering", time, start, reducedMotion),
    };
  });
}

/** Times at which the level falls through 0.5. */
function fallingEdges(samples: { time: number; level: number }[]): number[] {
  const edges: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    if (samples[i - 1].level >= 0.5 && samples[i].level < 0.5) {
      edges.push(samples[i].time);
    }
  }
  return edges;
}

describe("powerLevel", () => {
  it("is full while the power is on", () => {
    expect(powerLevel("on", 12, null, false)).toBe(1);
  });

  it("is dark once the power is out, fading over a moment", () => {
    expect(powerLevel("out", 9, null, false)).toBe(0);
    expect(powerLevel("out", 9, null, false, 9)).toBeGreaterThan(0);
    expect(powerLevel("out", 9.5, null, false, 9)).toBe(0);
  });

  it("is deterministic", () => {
    expect(sample(false)).toEqual(sample(false));
  });

  it("stays between 0 and 1 and does dip while flickering", () => {
    const levels = sample(false).map((s) => s.level);
    expect(Math.min(...levels)).toBeLessThan(0.1);
    expect(Math.max(...levels)).toBeLessThanOrEqual(1);
    expect(Math.min(...levels)).toBeGreaterThanOrEqual(0);
  });

  it("never dips more than 3 times in any second", () => {
    const edges = fallingEdges(sample(false, 20));
    expect(edges.length).toBeGreaterThan(10);
    for (const edge of edges) {
      const inWindow = edges.filter((e) => e >= edge && e < edge + 1);
      expect(inWindow.length).toBeLessThanOrEqual(3);
    }
  });

  it("does not start before the flicker begins", () => {
    expect(powerLevel("flickering", 1, 2, false)).toBe(1);
  });

  it("dims smoothly without flashing under reduced motion", () => {
    const samples = sample(true);
    // One slow pass through 0.5 is a dimming, not a flash.
    expect(fallingEdges(samples)).toHaveLength(1);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].level).toBeLessThanOrEqual(samples[i - 1].level);
    }
    expect(samples[samples.length - 1].level).toBeCloseTo(0.4, 5);
  });
});

describe("eventTime", () => {
  it("finds the first event of a kind", () => {
    const events = [
      { at: 3, kind: "flooding" },
      { at: 5, kind: "power-flicker" },
    ] as const;
    expect(eventTime(events, "power-flicker")).toBe(5);
    expect(eventTime(events, "power-out")).toBeNull();
  });
});
