// lib/plane-builder/sim/__tests__/nearMiss.test.ts
import type { LevelDef, Obstacle } from "../../levels/types";
import {
  COMBO_WINDOW,
  MAX_COMBO_MULTIPLIER,
  NEAR_MISS_COIN_CAP,
  NEAR_MISS_MARGIN,
  PLANE_RADIUS,
} from "../constants";
import {
  comboMultiplier,
  flightResult,
  launch,
  step,
  type FlightEvent,
  type FlightState,
  type StickInput,
} from "../flight";
import { POWERED, flatLevel } from "./fixtures";

const STICK: StickInput = { pitch: 0, bank: 0, boost: false };
const AIM = { pitch: 0, yaw: 0, power: 1 };
const HALF = { x: 2, y: 10, z: 2 };
/** Sideways distance from an obstacle's middle at which the plane just touches. */
const TOUCH = HALF.z + PLANE_RADIUS;
const SPEED = 40;

function wall(x: number, overrides: Partial<Obstacle> = {}): Obstacle {
  return {
    kind: "wall",
    center: { x, y: 10, z: 0 },
    half: HALF,
    hard: true,
    ...overrides,
  };
}

interface Flown {
  state: FlightState;
  events: FlightEvent[];
  nearMisses: Extract<FlightEvent, { type: "nearMiss" }>[];
}

/**
 * Flies a steady straight line down +x at sideways offset `lanes[i]` for the
 * pass that starts after obstacle i-1, so a test chooses each pass's gap.
 * `lane(x)` gives the plane's z at forward position x.
 */
function fly(
  level: LevelDef,
  lane: (x: number) => number,
  stats = POWERED
): Flown {
  const state = launch(level, stats, AIM);
  const events: FlightEvent[] = [];
  const end =
    Math.max(...level.obstacles.map((o) => o.center.x + o.half.x)) + 10;
  while (state.x < end && state.phase !== "done") {
    state.y = 10;
    state.pitch = 0;
    state.speed = SPEED;
    state.heading = 0;
    state.z = lane(state.x);
    state.fuel = 100;
    events.push(...step(state, level, stats, STICK));
  }
  return {
    state,
    events,
    nearMisses: events.filter(
      (e): e is Extract<FlightEvent, { type: "nearMiss" }> =>
        e.type === "nearMiss"
    ),
  };
}

const single = (gap: number, overrides: Partial<Obstacle> = {}) =>
  fly(flatLevel({ obstacles: [wall(100, overrides)] }), () => TOUCH + gap);

describe("near-miss detection", () => {
  it("counts a graze", () => {
    const { nearMisses, state } = single(1);
    expect(nearMisses).toHaveLength(1);
    expect(state.nearMisses).toBe(1);
    expect(state.endReason).toBeNull();
  });

  it("counts a graze on the other side", () => {
    const level = flatLevel({ obstacles: [wall(100)] });
    expect(fly(level, () => -(TOUCH + 1)).nearMisses).toHaveLength(1);
  });

  it("counts a graze over the top", () => {
    const level = flatLevel({ obstacles: [wall(100)] });
    const state = launch(level, POWERED, AIM);
    const events: FlightEvent[] = [];
    while (state.x < 110) {
      state.y = 10 + HALF.y + PLANE_RADIUS + 1;
      state.pitch = 0;
      state.speed = SPEED;
      state.heading = 0;
      state.z = 0;
      state.fuel = 100;
      events.push(...step(state, level, POWERED, STICK));
    }
    expect(events.filter((e) => e.type === "nearMiss")).toHaveLength(1);
  });

  it("ignores a plane that passes far away", () => {
    const { nearMisses, state } = single(NEAR_MISS_MARGIN + 5);
    expect(nearMisses).toHaveLength(0);
    expect(state.nearMissCoins).toBe(0);
  });

  it("counts a gap exactly at the margin but not just beyond it", () => {
    expect(single(NEAR_MISS_MARGIN).nearMisses).toHaveLength(1);
    expect(single(NEAR_MISS_MARGIN + 0.25).nearMisses).toHaveLength(0);
  });

  it("does not count touching the box, which is a hit", () => {
    const { nearMisses, state } = single(-0.5);
    expect(nearMisses).toHaveLength(0);
    expect(state.endReason).toBe("crash");
  });

  it("does not count an obstacle that was hit and survived on a shield", () => {
    const level = flatLevel({ obstacles: [wall(100)] });
    const shielded = { ...POWERED, shields: 1 };
    const { nearMisses, state } = fly(level, () => 0, shielded);
    expect(state.shields).toBe(0);
    expect(nearMisses).toHaveLength(0);
  });

  it("does not count soft obstacles", () => {
    expect(single(1, { hard: false }).nearMisses).toHaveLength(0);
  });

  it("counts each obstacle once, however long the plane stays alongside", () => {
    const level = flatLevel({
      obstacles: [wall(100, { half: { x: 30, y: 10, z: 2 } })],
    });
    const { nearMisses } = fly(level, () => TOUCH + 1);
    expect(nearMisses).toHaveLength(1);
  });

  it("does not count before the plane is past the obstacle", () => {
    const level = flatLevel({ obstacles: [wall(100)] });
    const { nearMisses } = fly(level, () => TOUCH + 1);
    expect(nearMisses[0]).toBeDefined();
    const state = launch(level, POWERED, AIM);
    state.x = 99;
    state.z = TOUCH + 1;
    state.y = 10;
    expect(step(state, level, POWERED, STICK)).toEqual([]);
  });

  it("uses the closest approach, not the exit position", () => {
    // Close in the middle of the pass, far away by the time it leaves.
    const level = flatLevel({ obstacles: [wall(100)] });
    const { nearMisses } = fly(level, (x) =>
      x < 100 ? TOUCH + 1 : TOUCH + 20
    );
    expect(nearMisses).toHaveLength(1);
  });
});

describe("near-miss combo", () => {
  const lane = () => TOUCH + 1;

  it("starts at x1 and pays the base coins", () => {
    const { nearMisses, state } = single(1);
    expect(nearMisses[0]).toMatchObject({ combo: 1, multiplier: 1, coins: 1 });
    expect(state.nearMissCoins).toBe(1);
  });

  it("raises the multiplier for consecutive near misses", () => {
    const level = flatLevel({ obstacles: [wall(100), wall(140), wall(180)] });
    const { nearMisses, state } = fly(level, lane);
    expect(nearMisses.map((e) => e.multiplier)).toEqual([1, 2, 3]);
    expect(nearMisses.map((e) => e.coins)).toEqual([1, 2, 3]);
    expect(state.nearMissCoins).toBe(6);
    expect(state.bestCombo).toBe(3);
  });

  it("caps the multiplier", () => {
    const obstacles = Array.from({ length: 8 }, (_, i) => wall(100 + i * 40));
    const { nearMisses } = fly(flatLevel({ obstacles }), lane);
    expect(Math.max(...nearMisses.map((e) => e.multiplier))).toBe(
      MAX_COMBO_MULTIPLIER
    );
    expect(nearMisses).toHaveLength(8);
  });

  it("caps the coins one flight can earn", () => {
    const obstacles = Array.from({ length: 20 }, (_, i) => wall(100 + i * 40));
    const { state, nearMisses } = fly(flatLevel({ obstacles }), lane);
    expect(state.nearMissCoins).toBe(NEAR_MISS_COIN_CAP);
    expect(nearMisses.reduce((sum, e) => sum + e.coins, 0)).toBe(
      NEAR_MISS_COIN_CAP
    );
    expect(state.bestCombo).toBe(20);
  });

  it("restarts after the window passes", () => {
    const gap = Math.ceil(SPEED * (COMBO_WINDOW + 1));
    const level = flatLevel({ obstacles: [wall(100), wall(100 + gap)] });
    const { nearMisses } = fly(level, lane);
    expect(nearMisses.map((e) => e.combo)).toEqual([1, 1]);
  });

  it("chains misses just inside the window", () => {
    const gap = Math.floor(SPEED * (COMBO_WINDOW - 1));
    const level = flatLevel({ obstacles: [wall(100), wall(100 + gap)] });
    const { nearMisses } = fly(level, lane);
    expect(nearMisses.map((e) => e.combo)).toEqual([1, 2]);
  });

  it("is broken by hitting something", () => {
    const level = flatLevel({
      obstacles: [wall(100), wall(140), wall(180), wall(220)],
    });
    // Skim, skim, straight into a shielded hit, skim again.
    const shielded = { ...POWERED, shields: 1 };
    const { nearMisses, state } = fly(
      level,
      (x) => (x > 160 && x < 200 ? 0 : TOUCH + 1),
      shielded
    );
    expect(nearMisses.map((e) => e.combo)).toEqual([1, 2, 1]);
    expect(state.bestCombo).toBe(2);
  });

  it("is broken by a soft bump", () => {
    const level = flatLevel({
      obstacles: [wall(100), wall(140, { hard: false }), wall(180)],
    });
    const { nearMisses } = fly(level, (x) =>
      x > 120 && x < 160 ? 0 : TOUCH + 1
    );
    expect(nearMisses.map((e) => e.combo)).toEqual([1, 1]);
  });

  it("reports totals in the flight result", () => {
    const level = flatLevel({ obstacles: [wall(100), wall(140)] });
    const { state } = fly(level, lane);
    expect(flightResult(state, level)).toMatchObject({
      nearMisses: 2,
      nearMissCoins: 3,
      bestCombo: 2,
    });
  });

  it("maps combo to a multiplier of at least 1 and at most the cap", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(1)).toBe(1);
    expect(comboMultiplier(3)).toBe(3);
    expect(comboMultiplier(99)).toBe(MAX_COMBO_MULTIPLIER);
  });
});
