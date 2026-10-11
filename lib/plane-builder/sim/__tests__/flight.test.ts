// lib/plane-builder/sim/__tests__/flight.test.ts
import { RUNOUT } from "../../levels/generate";
import { CORRIDOR_TURN } from "../constants";
import {
  launch,
  runFlight,
  step,
  type FlightEvent,
  type StickInput,
} from "../flight";
import { GLIDER, POWERED, flatLevel } from "./fixtures";

const AIM = { pitch: 0.3, yaw: 0, power: 1 };
const HANDS_OFF: StickInput = { pitch: 0, bank: 0, boost: false };
const handsOff = () => HANDS_OFF;

describe("flight sim", () => {
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
});
