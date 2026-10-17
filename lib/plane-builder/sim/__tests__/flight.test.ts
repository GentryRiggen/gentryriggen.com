// lib/plane-builder/sim/__tests__/flight.test.ts
import { RUNOUT } from "../../levels/generate";
import {
  CEILING,
  CORRIDOR_TURN,
  FUEL_CAN_SHARE,
  MAX_SPEED,
  RING_BOOST,
} from "../constants";
import {
  launch,
  runFlight,
  step,
  type FlightEvent,
  type FlightState,
  type StickInput,
} from "../flight";
import { GLIDER, POWERED, flatLevel } from "./fixtures";

const AIM = { pitch: 0.3, yaw: 0, power: 1 };
const HANDS_OFF: StickInput = { pitch: 0, bank: 0, boost: false };
const handsOff = () => HANDS_OFF;

describe("flight sim", () => {
  it("launches faster with a timing boost, within limits", () => {
    const level = flatLevel();
    const plain = launch(level, POWERED, AIM).speed;
    expect(launch(level, POWERED, { ...AIM, boost: 1.25 }).speed).toBeCloseTo(
      plain * 1.25
    );
    expect(launch(level, POWERED, { ...AIM, boost: 9 }).speed).toBeCloseTo(
      plain * 1.5
    );
    expect(
      launch(level, POWERED, { ...AIM, boost: Number.NaN }).speed
    ).toBeCloseTo(plain);
  });

  it("is deterministic", () => {
    const level = flatLevel();
    const a = runFlight(level, POWERED, AIM, handsOff);
    const b = runFlight(level, POWERED, AIM, handsOff);
    expect(a.state).toEqual(b.state);
  });

  it("glides a short way and lands", () => {
    const { state } = runFlight(flatLevel(), GLIDER, AIM, handsOff);
    expect(state.endReason).toBe("landed");
    expect(state.maxX).toBeGreaterThan(30);
    expect(state.maxX).toBeLessThan(1000);
  });

  it("glides further with better wings", () => {
    const weak = runFlight(flatLevel(), GLIDER, AIM, handsOff).state.maxX;
    const strong = runFlight(
      flatLevel(),
      { ...GLIDER, lift: 0.12 },
      AIM,
      handsOff
    ).state.maxX;
    expect(strong).toBeGreaterThan(weak);
  });

  it("flies further with fuel, and boost burns it 3x faster", () => {
    const level = flatLevel();
    const dry = runFlight(level, { ...POWERED, fuel: 0 }, AIM, handsOff);
    const wet = runFlight(level, POWERED, AIM, handsOff);
    expect(wet.state.maxX).toBeGreaterThan(dry.state.maxX);

    const s = launch(level, POWERED, AIM);
    for (let i = 0; i < 60; i += 1)
      step(s, level, POWERED, { ...HANDS_OFF, boost: true });
    expect(s.fuel).toBeCloseTo(POWERED.fuel - 3, 1);
  });

  it("crashes into a hard obstacle without shields", () => {
    const level = flatLevel({
      obstacles: [
        {
          kind: "barn",
          hard: true,
          center: { x: 40, y: 10, z: 0 },
          half: { x: 3, y: 10, z: 20 },
        },
      ],
    });
    const { state, events } = runFlight(level, POWERED, AIM, handsOff);
    expect(state.endReason).toBe("crash");
    expect(events.some((e) => e.type === "crash")).toBe(true);
  });

  it("spends a shield on a hard hit and keeps flying", () => {
    const level = flatLevel({
      obstacles: [
        {
          kind: "barn",
          hard: true,
          center: { x: 40, y: 10, z: 0 },
          half: { x: 3, y: 10, z: 20 },
        },
      ],
    });
    const { state, events } = runFlight(
      level,
      { ...POWERED, shields: 1 },
      AIM,
      handsOff
    );
    expect(events.filter((e) => e.type === "shield")).toHaveLength(1);
    expect(state.shields).toBe(0);
    expect(state.maxX).toBeGreaterThan(50);
  });

  it("slows once on a soft obstacle", () => {
    const level = flatLevel({
      obstacles: [
        {
          kind: "tree",
          hard: false,
          center: { x: 30, y: 10, z: 0 },
          half: { x: 3, y: 10, z: 20 },
        },
      ],
    });
    const { events } = runFlight(level, POWERED, AIM, handsOff);
    expect(events.filter((e) => e.type === "bump")).toHaveLength(1);
    expect(events.some((e) => e.type === "crash")).toBe(false);
  });

  it("crashes on a steep dive into the ground", () => {
    const level = flatLevel();
    const dive: StickInput = { pitch: -1, bank: 0, boost: true };
    const { state } = runFlight(
      level,
      { ...POWERED, thrust: 20 },
      { pitch: 0.6, yaw: 0, power: 1 },
      (s) => (s.time > 2 ? dive : HANDS_OFF)
    );
    expect(state.endReason).toBe("crash");
  });

  it("collects coins and rings", () => {
    const level = flatLevel({
      coins: [{ x: 10, y: 5.5, z: 0 }],
      rings: [{ center: { x: 20, y: 7, z: 0 }, radius: 6 }],
    });
    const { state, events } = runFlight(level, POWERED, AIM, handsOff);
    expect(events.some((e) => e.type === "coin")).toBe(true);
    expect(events.some((e) => e.type === "ring")).toBe(true);
    expect(state.coins).toBe(11);
  });

  it("turns back toward the corridor past the edge", () => {
    const level = flatLevel();
    const s = launch(level, POWERED, AIM);
    s.z = level.corridorHalfWidth * 2;
    s.heading = 0;
    step(s, level, POWERED, HANDS_OFF);
    expect(s.heading).toBeLessThan(0);
    expect(-s.heading).toBeLessThanOrEqual(CORRIDOR_TURN / 60 + 1e-9);
  });

  it("fires finish once and ends at the runout", () => {
    const level = flatLevel({ finishDistance: 200 });
    const { state, events } = runFlight(
      level,
      { ...POWERED, fuel: 120 },
      AIM,
      () => ({ pitch: 0.2, bank: 0, boost: false })
    );
    expect(events.filter((e) => e.type === "finish")).toHaveLength(1);
    expect(state.finished).toBe(true);
    expect(state.endReason).toBe("runout");
    expect(state.maxX).toBeGreaterThanOrEqual(200 + RUNOUT);
  });

  it("ends as stalled with no forward progress", () => {
    const level = flatLevel();
    const s = launch(level, POWERED, AIM);
    const events: FlightEvent[] = [];
    // Pin the plane in place to simulate circling.
    for (let i = 0; i < 60 * 4 && s.phase !== "done"; i += 1) {
      s.x = 10;
      events.push(...step(s, level, POWERED, HANDS_OFF));
    }
    expect(s.endReason).toBe("stalled");
  });

  describe("swoop", () => {
    // Out of fuel at the ceiling over flat ground.
    const glide = (pilot: (s: FlightState, phase: { n: number }) => number) => {
      const level = flatLevel({ finishDistance: 100000 });
      const stats = { ...POWERED, fuel: 0, lift: 0.04, drag: 0.012 };
      const s = launch(level, stats, { pitch: 0, yaw: 0, power: 1 });
      s.y = CEILING;
      s.speed = 25;
      const phase = { n: 0 };
      while (s.phase !== "done" && s.time < 60)
        step(s, level, stats, { ...HANDS_OFF, pitch: pilot(s, phase) });
      return s;
    };
    // Dive to 25 m, pull up until the nose is above level, then a gentle hold.
    const swoop = (s: FlightState, phase: { n: number }) => {
      if (phase.n === 0 && s.y <= 25) phase.n = 1;
      if (phase.n === 1 && s.pitch > 0) phase.n = 2;
      return phase.n === 0 ? -1 : phase.n === 1 ? 1 : 0.05;
    };

    it("buys a little more distance than gliding hands-off", () => {
      const handsOff = glide(() => 0).maxX;
      const swooped = glide(swoop).maxX;
      expect(swooped).toBeGreaterThan(handsOff * 1.05);
      expect(swooped).toBeLessThan(handsOff * 1.6);
    });

    it("leaves hands-off and gentle gliding unchanged", () => {
      const level = flatLevel({ finishDistance: 100000 });
      const stats = { ...POWERED, fuel: 0 };
      const a = launch(level, stats, AIM);
      const b = launch(level, stats, AIM);
      a.y = b.y = CEILING;
      for (let i = 0; i < 120; i += 1) {
        step(a, level, stats, HANDS_OFF);
        step(b, level, stats, { ...HANDS_OFF, pitch: 0.001 });
      }
      expect(Math.abs(a.speed - b.speed)).toBeLessThan(0.5);
    });

    it("only tucks the wings once the fuel is gone", () => {
      const level = flatLevel();
      // No thrust either way, so only the fuel gauge differs.
      const fuelled = { ...POWERED, thrust: 0, fuel: 20 };
      const empty = { ...POWERED, thrust: 0, fuel: 0 };
      const a = launch(level, fuelled, AIM);
      const b = launch(level, empty, AIM);
      for (const s of [a, b]) {
        s.y = 40;
        s.speed = 60;
        s.pitch = 0;
      }
      step(a, level, fuelled, { ...HANDS_OFF, pitch: -1 });
      step(b, level, empty, { ...HANDS_OFF, pitch: -1 });
      expect(b.speed).toBeGreaterThan(a.speed);
    });
  });

  describe("ceiling", () => {
    const fullClimb = () => ({ ...HANDS_OFF, pitch: 1 });

    it("can't climb far above the ceiling, even with full power", () => {
      const level = flatLevel();
      const strong = { ...POWERED, thrust: 60, fuel: 60 };
      let top = 0;
      runFlight(level, strong, AIM, (s) => {
        top = Math.max(top, s.y);
        return fullClimb();
      });
      expect(top).toBeGreaterThan(CEILING * 0.8);
      expect(top).toBeLessThan(CEILING + 20);
    });

    it("glides back down to the ceiling from above it", () => {
      const level = flatLevel();
      const s = launch(level, POWERED, AIM);
      s.y = CEILING + 60;
      s.pitch = 0;
      for (let i = 0; i < 60 * 10; i += 1) step(s, level, POWERED, fullClimb());
      expect(s.y).toBeLessThan(CEILING + 10);
    });

    it("doesn't nose down onto a hard obstacle it is above", () => {
      const level = flatLevel({
        obstacles: [
          {
            kind: "peak",
            hard: true,
            center: { x: 400, y: 60, z: 0 },
            half: { x: 400, y: 60, z: 40 },
          },
        ],
      });
      const s = launch(level, POWERED, AIM);
      s.x = 50;
      s.y = 125;
      s.pitch = 0;
      for (let i = 0; i < 60 * 3; i += 1) step(s, level, POWERED, HANDS_OFF);
      expect(s.phase).toBe("flying");
      expect(s.pitch).toBeGreaterThanOrEqual(-0.01);
    });
  });

  describe("shields and obstacles", () => {
    const wideBox = {
      kind: "peak" as const,
      hard: true,
      center: { x: 60, y: 60, z: 0 },
      half: { x: 25, y: 60, z: 40 },
    };

    it("lifts the plane over a wide obstacle after a shield hit", () => {
      const level = flatLevel({ obstacles: [wideBox] });
      const { state, events } = runFlight(
        level,
        { ...POWERED, shields: 1 },
        AIM,
        handsOff
      );
      expect(events.filter((e) => e.type === "shield")).toHaveLength(1);
      expect(events.some((e) => e.type === "crash")).toBe(false);
      expect(state.maxX).toBeGreaterThan(wideBox.center.x + wideBox.half.x);
    });

    it("never leaves the plane underground during grace", () => {
      const level = flatLevel();
      const s = launch(level, POWERED, AIM);
      s.grace = 1;
      s.y = -5;
      s.pitch = -0.8;
      step(s, level, POWERED, HANDS_OFF);
      expect(s.y).toBeGreaterThanOrEqual(0);
    });

    it("bounces up when a shield is spent on the ground", () => {
      const level = flatLevel();
      const stats = { ...POWERED, shields: 1 };
      const s = launch(level, stats, AIM);
      s.y = -1;
      s.pitch = -1.1;
      const events = step(s, level, stats, HANDS_OFF);
      expect(events.some((e) => e.type === "shield")).toBe(true);
      expect(s.y).toBeGreaterThan(0);
    });
  });

  describe("sliding", () => {
    const slider = (level = flatLevel(), stats = POWERED) => {
      const s = launch(level, stats, AIM);
      s.phase = "sliding";
      s.x = 100;
      s.y = 0;
      s.speed = 30;
      return s;
    };
    const wall = {
      kind: "wall" as const,
      hard: true,
      center: { x: 110, y: 10, z: 0 },
      half: { x: 2, y: 10, z: 30 },
    };

    it("touches down shallow, slides on and lands", () => {
      const level = flatLevel();
      const s = launch(level, GLIDER, AIM);
      let slidStartX: number | null = null;
      const events: FlightEvent[] = [];
      while (s.phase !== "done") {
        events.push(...step(s, level, GLIDER, HANDS_OFF));
        if (s.phase === "sliding" && slidStartX === null) slidStartX = s.x;
      }
      expect(slidStartX).not.toBeNull();
      expect(s.x).toBeGreaterThan(slidStartX ?? Infinity);
      expect(events.some((e) => e.type === "landed")).toBe(true);
      expect(s.endReason).toBe("landed");
    });

    it("crashes sliding into a hard obstacle", () => {
      const level = flatLevel({ obstacles: [wall] });
      const s = slider(level);
      const events: FlightEvent[] = [];
      while (s.phase !== "done")
        events.push(...step(s, level, POWERED, HANDS_OFF));
      expect(s.endReason).toBe("crash");
    });

    it("spends a shield sliding into a hard obstacle", () => {
      const level = flatLevel({ obstacles: [wall] });
      const stats = { ...POWERED, shields: 1 };
      const s = slider(level, stats);
      const events: FlightEvent[] = [];
      for (let i = 0; i < 60 * 3 && s.phase !== "done"; i += 1)
        events.push(...step(s, level, stats, HANDS_OFF));
      expect(events.filter((e) => e.type === "shield")).toHaveLength(1);
      expect(s.endReason).not.toBe("crash");
    });

    it("slows sliding through a soft obstacle", () => {
      const level = flatLevel({ obstacles: [{ ...wall, hard: false }] });
      const s = slider(level);
      const events: FlightEvent[] = [];
      while (s.phase !== "done")
        events.push(...step(s, level, POWERED, HANDS_OFF));
      expect(events.filter((e) => e.type === "bump")).toHaveLength(1);
      expect(s.endReason).toBe("landed");
    });
  });

  describe("input guards", () => {
    it("treats a non-finite aim as zero", () => {
      const s = launch(flatLevel(), POWERED, {
        pitch: NaN,
        yaw: Infinity,
        power: NaN,
      });
      expect(Number.isFinite(s.pitch)).toBe(true);
      expect(Number.isFinite(s.heading)).toBe(true);
      expect(Number.isFinite(s.speed)).toBe(true);
    });

    it("treats non-finite stick input as zero", () => {
      const level = flatLevel();
      const s = launch(level, POWERED, AIM);
      step(s, level, POWERED, { pitch: NaN, bank: NaN, boost: false });
      for (const v of [s.x, s.y, s.z, s.speed, s.pitch, s.heading, s.bank])
        expect(Number.isFinite(v)).toBe(true);
    });
  });

  describe("world features", () => {
    it("lifts the plane in a wind zone", () => {
      const calm = flatLevel();
      const windy = flatLevel({
        winds: [{ fromX: 0, toX: 1000, lift: 6, push: 0 }],
      });
      const run = (level: ReturnType<typeof flatLevel>) => {
        const s = launch(level, POWERED, AIM);
        for (let i = 0; i < 60; i += 1) step(s, level, POWERED, HANDS_OFF);
        return s.y;
      };
      expect(run(windy)).toBeGreaterThan(run(calm) + 3);
    });

    it("misses a ring passed outside its radius", () => {
      const level = flatLevel({
        rings: [{ center: { x: 20, y: 60, z: 0 }, radius: 3 }],
      });
      const { state, events } = runFlight(level, POWERED, AIM, handsOff);
      expect(state.maxX).toBeGreaterThan(20);
      expect(events.some((e) => e.type === "ring")).toBe(false);
      expect(state.rings).toBe(0);
    });

    it("times out when it never stalls or ends", () => {
      const level = flatLevel({ finishDistance: 1e9 });
      const s = launch(level, POWERED, AIM);
      // Hold the plane aloft and creep forward so the stall check never fires.
      while (s.phase !== "done") {
        s.x = s.time * 0.6;
        s.y = 50;
        step(s, level, POWERED, HANDS_OFF);
      }
      expect(s.endReason).toBe("timeout");
    });
  });
});

describe("pickups and milestones", () => {
  it("speeds up through a ring, capped at MAX_SPEED", () => {
    const ring = { center: { x: 20, y: 3, z: 0 }, radius: 6 };
    const level = flatLevel({ rings: [ring] });
    const s = launch(level, GLIDER, { pitch: 0, yaw: 0, power: 1 });
    s.x = 19.9;
    s.y = 3;
    s.pitch = 0;
    const before = s.speed;
    const events = step(s, level, GLIDER, HANDS_OFF);
    expect(events.some((e) => e.type === "ring")).toBe(true);
    expect(s.speed).toBeGreaterThan(before + RING_BOOST - 1);

    const t = launch(level, GLIDER, { pitch: 0, yaw: 0, power: 1 });
    t.x = 19.9;
    t.y = 3;
    t.pitch = 0;
    t.speed = MAX_SPEED;
    step(t, level, GLIDER, HANDS_OFF);
    expect(t.speed).toBeLessThanOrEqual(MAX_SPEED);
  });

  it("adds a quarter tank from a fuel can, capped at full", () => {
    const level = flatLevel({ fuelCans: [{ x: 20, y: 3, z: 0 }] });
    const s = launch(level, POWERED, AIM);
    s.x = 19.5;
    s.y = 3;
    s.z = 0;
    s.fuel = 2;
    const events = step(s, level, POWERED, HANDS_OFF);
    expect(events).toContainEqual({ type: "fuel", index: 0 });
    expect(s.fuel).toBeCloseTo(2 - 1 / 60 + POWERED.fuel * FUEL_CAN_SHARE, 2);

    const full = launch(level, POWERED, AIM);
    full.x = 19.5;
    full.y = 3;
    full.z = 0;
    step(full, level, POWERED, HANDS_OFF);
    expect(full.fuel).toBeLessThanOrEqual(POWERED.fuel);
  });

  it("ignores fuel cans without an engine", () => {
    const level = flatLevel({ fuelCans: [{ x: 20, y: 3, z: 0 }] });
    const s = launch(level, GLIDER, AIM);
    s.x = 19.5;
    s.y = 3;
    s.z = 0;
    const events = step(s, level, GLIDER, HANDS_OFF);
    expect(events.some((e) => e.type === "fuel")).toBe(false);
    expect(s.canTaken[0]).toBe(0);
    expect(s.fuel).toBe(0);
  });

  it("fires each milestone once per flight", () => {
    const level = flatLevel({ finishDistance: 400 });
    const { events } = runFlight(
      level,
      { ...POWERED, fuel: 60 },
      AIM,
      handsOff
    );
    const shares = events
      .filter((e) => e.type === "milestone")
      .map((e) => (e as { share: number }).share);
    expect(shares).toEqual([0.25, 0.5, 0.75]);
  });

  it("does not repeat a milestone after being pushed back", () => {
    const level = flatLevel({ finishDistance: 400 });
    const s = launch(level, POWERED, AIM);
    s.x = 99.9;
    s.maxX = 99.9;
    s.y = 20;
    s.pitch = 0;
    const first = step(s, level, POWERED, HANDS_OFF);
    expect(first.filter((e) => e.type === "milestone")).toHaveLength(1);
    s.x = 90; // pushed back (shield bounce)
    for (let i = 0; i < 60; i += 1) step(s, level, POWERED, HANDS_OFF);
    expect(s.milestonesHit).toBe(1);
  });
});
