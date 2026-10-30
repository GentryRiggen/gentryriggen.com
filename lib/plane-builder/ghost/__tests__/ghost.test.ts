import { LEVELS } from "../../levels";
import { planeStats } from "../../plane/stats";
import { STARTER_TIERS } from "../../plane/catalog";
import { launch, step, type FlightState } from "../../sim/flight";
import {
  GHOST_INTERVAL,
  MAX_GHOST_SAMPLES,
  createGhostRecorder,
  decodeGhost,
  encodeGhost,
  isGhost,
  poseAt,
  secondsAheadOfGhost,
  type GhostPose,
} from "../ghost";

const straight = (count: number): GhostPose[] =>
  Array.from({ length: count }, (_, i) => ({
    x: i * 6,
    y: 10 + i * 0.5,
    z: -i * 0.3,
    heading: 0.05 * (i % 5),
    pitch: -0.1,
    bank: 0.2,
  }));

describe("encodeGhost and decodeGhost", () => {
  it("round-trips poses to the stored precision", () => {
    const poses = straight(20);
    const out = decodeGhost(encodeGhost(2, poses));
    expect(out).toHaveLength(20);
    out.forEach((pose, i) => {
      expect(pose.x).toBeCloseTo(poses[i].x, 1);
      expect(pose.y).toBeCloseTo(poses[i].y, 1);
      expect(pose.z).toBeCloseTo(poses[i].z, 1);
      expect(pose.heading).toBeCloseTo(poses[i].heading, 2);
      expect(pose.pitch).toBeCloseTo(poses[i].pitch, 2);
    });
  });

  it("stores deltas so later numbers are small", () => {
    const { data } = encodeGhost(2, straight(20));
    expect(Math.max(...data.slice(6).map(Math.abs))).toBeLessThan(100);
  });

  it("caps the length", () => {
    const { data } = encodeGhost(130, straight(MAX_GHOST_SAMPLES + 50));
    expect(data).toHaveLength(MAX_GHOST_SAMPLES * 6);
  });
});

describe("poseAt", () => {
  const poses = decodeGhost(encodeGhost(1, straight(11)));
  it("interpolates between samples", () => {
    expect(poseAt(poses, GHOST_INTERVAL * 2.5).x).toBeCloseTo(15, 0);
  });
  it("holds the last pose after the end and the first before", () => {
    expect(poseAt(poses, 99).x).toBeCloseTo(60, 0);
    expect(poseAt(poses, -1).x).toBe(0);
  });
});

describe("secondsAheadOfGhost", () => {
  // 60 m/s, so the ghost is at x = 60 * t.
  const ghost = encodeGhost(
    1,
    Array.from({ length: 11 }, (_, i) => ({
      x: i * 6,
      y: 5,
      z: 0,
      heading: 0,
      pitch: 0,
      bank: 0,
    }))
  );
  it("is positive when the player got there sooner", () => {
    expect(secondsAheadOfGhost(ghost, 30, 0.3)).toBeCloseTo(0.2, 1);
  });
  it("is negative when the player is later", () => {
    expect(secondsAheadOfGhost(ghost, 30, 0.8)).toBeCloseTo(-0.3, 1);
  });
  it("compares to the ghost's finish time once past its last sample", () => {
    expect(secondsAheadOfGhost(ghost, 500, 0.9)).toBeCloseTo(0.1, 5);
  });
  it("is null for an empty ghost", () => {
    expect(secondsAheadOfGhost({ time: 1, data: [] }, 1, 1)).toBeNull();
  });
});

describe("isGhost", () => {
  it("accepts an encoded ghost", () => {
    expect(isGhost(encodeGhost(2, straight(5)))).toBe(true);
  });
  it.each([
    null,
    {},
    { time: 0, data: new Array(12).fill(0) },
    { time: 2, data: [1, 2, 3] },
    { time: 2, data: new Array(12).fill(0.5) },
    { time: 2, data: new Array(6 * (MAX_GHOST_SAMPLES + 1)).fill(0) },
  ])("rejects %j", (value) => {
    expect(isGhost(value)).toBe(false);
  });
});

describe("createGhostRecorder", () => {
  const level = { ...LEVELS.meadow, finishDistance: 100 };
  const stats = planeStats(level.plane, { ...STARTER_TIERS, launcher: 8 });
  const fly = (state: FlightState, until: (s: FlightState) => boolean) => {
    const recorder = createGhostRecorder(state);
    while (state.phase !== "done" && !until(state)) {
      step(state, level, stats, { pitch: 0, bank: 0, boost: false });
      recorder.record(state);
    }
    return recorder;
  };

  it("makes no ghost for a flight that never finished", () => {
    const state = launch(level, stats, { pitch: 0.2, yaw: 0, power: 0.3 });
    expect(fly(state, (s) => s.time > 2).finish()).toBeNull();
  });

  it("records about ten poses a second and closes at the finish", () => {
    const state = launch(level, stats, { pitch: 0.3, yaw: 0, power: 1 });
    state.speed = 120;
    const recorder = fly(state, (s) => s.finished);
    const ghost = recorder.finish();
    expect(state.finished).toBe(true);
    expect(ghost).not.toBeNull();
    const poses = decodeGhost(ghost!);
    expect(ghost!.time).toBe(state.finishTime);
    expect(poses.length).toBeGreaterThanOrEqual(
      Math.floor(ghost!.time / GHOST_INTERVAL) + 1
    );
    expect(poses.length).toBeLessThanOrEqual(
      Math.ceil(ghost!.time / GHOST_INTERVAL) + 3
    );
    expect(poses[poses.length - 1].x).toBeGreaterThanOrEqual(
      level.finishDistance - 0.1
    );
    expect(isGhost(ghost)).toBe(true);
  });
});
