import { FLOOR_DEPTH } from "@/lib/ship-builder/sim/descent";
import {
  createBodyPoint,
  descentBodies,
  isFloorNeeded,
  landings,
  siltGrain,
  SILT_SECONDS,
  trailIntensity,
  underwaterBlend,
  type Landing,
} from "../descentEffects";
import { createDroplet } from "../trialEffects";
import type { TrialPlayback } from "../trialPlayback";

function playback(overrides: Partial<TrialPlayback> = {}): TrialPlayback {
  return {
    roll: 0,
    pitch: 0,
    sink: 0,
    phase: "sailing",
    time: 0,
    capsizedAt: null,
    sinkingAt: null,
    doneAt: null,
    strain: 0,
    power: "on",
    breakup: null,
    halves: null,
    events: [],
    speed: 1,
    scrubbing: false,
    ...overrides,
  };
}

const LENGTH = 20;

describe("isFloorNeeded", () => {
  it("is free while building and floating", () => {
    expect(isFloorNeeded(playback())).toBe(false);
    expect(isFloorNeeded(playback({ sink: 3 }))).toBe(false);
  });

  it("shows once sunk past half the plunge or descending", () => {
    expect(isFloorNeeded(playback({ sink: 7 }))).toBe(true);
    expect(isFloorNeeded(playback({ phase: "descending" }))).toBe(true);
  });

  it("looks at the deepest half when she has broken", () => {
    const half = { roll: 0, pitch: 0, pivotX: 10, driftX: 0 };
    const halves = {
      bow: { ...half, sink: 1 },
      stern: { ...half, sink: 8 },
    };
    expect(isFloorNeeded(playback({ halves }))).toBe(true);
  });
});

describe("descentBodies", () => {
  it("follows the whole ship's sink", () => {
    const bodies = [createBodyPoint(), createBodyPoint()];
    const count = descentBodies(playback({ sink: 20 }), LENGTH, bodies);
    expect(count).toBe(1);
    expect(bodies[0].y).toBe(-20);
    expect(bodies[0].x).toBe(0);
  });

  it("places each half by the contract and follows its sink", () => {
    const bodies = [createBodyPoint(), createBodyPoint()];
    const breakup = { at: 5, atX: 10, angle: 0.3 };
    const halves = {
      bow: { roll: 0, pitch: 0, sink: 30, pivotX: 10, driftX: 2 },
      stern: { roll: 0, pitch: 0, sink: 25, pivotX: 10, driftX: -1 },
    };
    const count = descentBodies(
      playback({ breakup, halves, sink: 0 }),
      LENGTH,
      bodies
    );
    expect(count).toBe(2);
    // Level halves: mid cell x plus drift, at the half's own depth.
    expect(bodies[0].x).toBeCloseTo(LENGTH / 2 - 5 + 2);
    expect(bodies[0].y).toBeCloseTo(-30);
    expect(bodies[1].x).toBeCloseTo(-5 - 1);
    expect(bodies[1].y).toBeCloseTo(-25);
  });

  it("lifts a pitched bow half's middle above its pivot", () => {
    const bodies = [createBodyPoint(), createBodyPoint()];
    const breakup = { at: 5, atX: 10, angle: 0.3 };
    const half = { roll: 0, sink: 10, pivotX: 10, driftX: 0 };
    descentBodies(
      playback({
        breakup,
        halves: {
          bow: { ...half, pitch: 0.5 },
          stern: { ...half, pitch: 0 },
        },
      }),
      LENGTH,
      bodies
    );
    expect(bodies[0].y).toBeGreaterThan(-10);
  });
});

describe("trailIntensity", () => {
  it("fades as the body settles on the sand", () => {
    const falling = { ...createBodyPoint(), y: -20 };
    const landed = { ...createBodyPoint(), y: -FLOOR_DEPTH + 0.2 };
    expect(trailIntensity(falling)).toBe(1);
    expect(trailIntensity(landed)).toBe(0);
  });
});

describe("siltGrain", () => {
  const out = createDroplet();
  const distance = (t: number) => {
    siltGrain(3, t, 5, out);
    return Math.hypot(out.x - 5, out.z);
  };

  it("is invisible before the touch and after it settles", () => {
    expect(siltGrain(3, -0.5, 5, out).alpha).toBe(0);
    expect(siltGrain(3, SILT_SECONDS + 0.5, 5, out).alpha).toBe(0);
  });

  it("spreads outward then fades", () => {
    expect(distance(1)).toBeGreaterThan(distance(0.2));
    expect(distance(2.5)).toBeGreaterThan(distance(1));
    const early = siltGrain(3, 0.5, 5, out).alpha;
    const late = siltGrain(3, 2.7, 5, out).alpha;
    expect(early).toBeGreaterThan(late);
    expect(late).toBeGreaterThan(0);
  });

  it("stays on the sand around the landing x", () => {
    siltGrain(3, 1, 5, out);
    expect(out.y).toBeGreaterThan(-FLOOR_DEPTH);
    expect(out.y).toBeLessThan(-FLOOR_DEPTH + 2);
  });
});

describe("landings", () => {
  it("lists only touches that have happened, bow first", () => {
    const bodies = [
      { x: 8, y: -45, halfSpan: 5 },
      { x: -6, y: -45, halfSpan: 5 },
    ];
    const out: Landing[] = [
      { at: 0, x: 0 },
      { at: 0, x: 0 },
    ];
    const events = [
      { at: 40, kind: "touched-bottom" as const },
      { at: 44, kind: "touched-bottom" as const },
    ];
    expect(landings(playback({ events, time: 42 }), bodies, 2, out)).toBe(1);
    expect(out[0]).toEqual({ at: 40, x: 8 });
    expect(landings(playback({ events, time: 50 }), bodies, 2, out)).toBe(2);
    expect(out[1]).toEqual({ at: 44, x: -6 });
  });
});

describe("underwaterBlend", () => {
  it("is 0 above water and 1 at the floor", () => {
    expect(underwaterBlend(5)).toBe(0);
    expect(underwaterBlend(-FLOOR_DEPTH / 2)).toBeCloseTo(0.5);
    expect(underwaterBlend(-FLOOR_DEPTH * 2)).toBe(1);
  });
});
