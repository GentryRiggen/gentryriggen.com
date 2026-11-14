import type { BoatLaunch } from "../../crowd/evacuation";
import { LOWER_S, RAFT_DROP_S } from "../../crowd/evacuation";
import { LEVEL_HEIGHT, DECK_Y } from "../../model/worldFrame";
import {
  BOARD_RADIUS,
  boardableBoat,
  boardWindow,
  endingOf,
  type EscapePhase,
  type HullBox,
  isOnWater,
  KICK_S,
  KICK_SPEED,
  lookAround,
  pickupBoat,
  rewindEscape,
  startSwimming,
  stepSwimmer,
  SWIM_SPEED,
  type Swimmer,
  walkerRestPoint,
  WARMTH_S,
} from "../escape";
import { TURN_RATE, WALKER_RADIUS } from "../types";

function launch(over: Partial<BoatLaunch> = {}): BoatLaunch {
  return {
    boatId: "b1",
    kind: "davit",
    at: 10,
    ready: 10,
    departs: 10,
    origin: { x: 0, y: 2, z: 3 },
    roll: 0,
    pitch: 0,
    outward: 1,
    riders: [],
    spot: { x: 1, y: 2, z: 3 },
    half: null,
    ...over,
  };
}

const raft = (over: Partial<BoatLaunch> = {}) =>
  launch({ kind: "raft", at: 10, ready: 12, departs: 14, ...over });

const near = { x: 1.5, y: 2, z: 3 };

describe("walkerRestPoint", () => {
  it("maps model cells to the resting world frame", () => {
    expect(walkerRestPoint({ x: 2, z: 1, level: 1 }, 10, 4)).toEqual({
      x: 3,
      y: DECK_Y + LEVEL_HEIGHT,
      z: 1,
    });
  });
});

describe("boardWindow", () => {
  it("is open until the davit boat lowers", () => {
    expect(boardWindow(launch())).toEqual({ from: -Infinity, to: 10 });
  });
  it("opens a raft when ready, for at least 4 s", () => {
    expect(boardWindow(raft())).toEqual({ from: 12, to: 16 });
    expect(boardWindow(raft({ departs: 20 }))).toEqual({ from: 12, to: 20 });
  });
});

describe("boardableBoat", () => {
  it("returns a davit boat in reach before it lowers", () => {
    const l = launch();
    expect(boardableBoat([l], near, 9, null)).toBe(l);
  });
  it("is null at or after lowering", () => {
    expect(boardableBoat([launch()], near, 10, null)).toBeNull();
  });
  it("is null out of reach in xz or y", () => {
    const l = launch();
    expect(
      boardableBoat([l], { ...near, x: 1 + BOARD_RADIUS + 0.1 }, 9, null)
    ).toBeNull();
    expect(
      boardableBoat([l], { ...near, y: 2 + LEVEL_HEIGHT }, 9, null)
    ).toBeNull();
  });
  it("skips the other half, boats with no spot, and an unready raft", () => {
    expect(
      boardableBoat([launch({ half: "bow" })], near, 9, "stern")
    ).toBeNull();
    expect(boardableBoat([launch({ half: "bow" })], near, 9, "bow")).not.toBe(
      null
    );
    expect(boardableBoat([launch({ spot: null })], near, 9, null)).toBeNull();
    expect(boardableBoat([raft()], near, 11, null)).toBeNull();
    expect(boardableBoat([raft()], near, 12, null)).not.toBeNull();
  });
  it("prefers the nearest", () => {
    const far = launch({ boatId: "far", spot: { x: 1, y: 2, z: 3.8 } });
    const close = launch({ boatId: "close", spot: { x: 1.4, y: 2, z: 3 } });
    expect(boardableBoat([far, close], near, 9, null)?.boatId).toBe("close");
  });
});

describe("isOnWater", () => {
  it("davit boats from at + LOWER_S", () => {
    expect(isOnWater(launch(), 10 + LOWER_S - 0.01)).toBe(false);
    expect(isOnWater(launch(), 10 + LOWER_S)).toBe(true);
  });
  it("rafts from at + RAFT_DROP_S", () => {
    expect(isOnWater(raft(), 10 + RAFT_DROP_S - 0.01)).toBe(false);
    expect(isOnWater(raft(), 10 + RAFT_DROP_S)).toBe(true);
  });
});

describe("pickupBoat", () => {
  const l = launch();
  const plan = {
    launches: [l],
    boatPoseAt: () => ({
      position: { x: 5, y: 0, z: 5 },
      rotation: { x: 0, y: 0, z: 0 },
    }),
  };
  const swimmer = (dx: number): Swimmer => ({
    x: 5 + dx,
    z: 5,
    yaw: 0,
    warmth: 1,
    kick: 0,
  });
  it("finds a boat on the water within 1 unit", () => {
    expect(pickupBoat(plan, swimmer(0.9), 10 + LOWER_S)).toBe(l);
    expect(pickupBoat(plan, swimmer(1.1), 10 + LOWER_S)).toBeNull();
  });
  it("ignores a boat not yet on the water", () => {
    expect(pickupBoat(plan, swimmer(0), 12)).toBeNull();
  });
});

describe("stepSwimmer", () => {
  const hull: HullBox = { cx: 0, halfLength: 5, halfBeam: 2, radius: 30 };
  const still = { forward: 0, strafe: 0, turn: 0 };
  const start = (over: Partial<Swimmer> = {}): Swimmer => ({
    x: 10,
    z: 0,
    yaw: 0,
    warmth: 1,
    kick: 0,
    ...over,
  });

  it("swims forward at SWIM_SPEED and loses warmth", () => {
    const s = stepSwimmer(start(), { ...still, forward: 1 }, 1, hull);
    expect(s.x).toBeCloseTo(10 + SWIM_SPEED);
    expect(s.warmth).toBeCloseTo(1 - 1 / WARMTH_S);
  });
  it("strafes right toward +z at yaw 0", () => {
    const s = stepSwimmer(start(), { ...still, strafe: 1 }, 1, hull);
    expect(s.z).toBeCloseTo(SWIM_SPEED);
  });
  it("kicks a burst forward on jump", () => {
    const s = stepSwimmer(start(), { ...still, jump: true }, 0.1, hull);
    expect(s.kick).toBe(KICK_S);
    expect(s.x).toBeCloseTo(10 + KICK_SPEED * 0.1);
    const later = stepSwimmer(s, still, 0.1, hull);
    expect(later.kick).toBeCloseTo(KICK_S - 0.1);
    expect(later.x).toBeGreaterThan(s.x);
  });
  it("stays outside the hull box and slides along it", () => {
    const edge = 5 + WALKER_RADIUS;
    const s = stepSwimmer(
      start({ x: edge + 0.1, z: 1, yaw: Math.PI }),
      { ...still, forward: 1, strafe: 1 },
      1,
      hull
    );
    expect(s.x).toBeGreaterThanOrEqual(edge - 1e-9);
    expect(s.z).not.toBeCloseTo(1);
  });
  it("stays within the swim radius", () => {
    const s = stepSwimmer(
      start({ x: 29.9 }),
      { ...still, forward: 1 },
      5,
      hull
    );
    expect(Math.hypot(s.x - hull.cx, s.z)).toBeLessThanOrEqual(30 + 1e-9);
  });
  it("clamps warmth at 0", () => {
    const s = stepSwimmer(start({ warmth: 0.001 }), still, 5, hull);
    expect(s.warmth).toBe(0);
  });
});

describe("startSwimming", () => {
  it("starts warm", () => {
    const p = startSwimming({ x: 1, z: 2 }, 0.5, 7);
    expect(p).toEqual({
      kind: "swimming",
      since: 7,
      swimmer: { x: 1, z: 2, yaw: 0.5, warmth: 1, kick: 0 },
      warned: false,
    });
  });
});

describe("endingOf and rewindEscape", () => {
  const swimmer: Swimmer = { x: 0, z: 0, yaw: 0, warmth: 1, kick: 0 };
  const phases: Record<string, EscapePhase> = {
    aboard: { kind: "aboard" },
    jumping: {
      kind: "jumping",
      boatId: "b",
      since: 5,
      from: { x: 0, y: 0, z: 0 },
    },
    deck: { kind: "in-boat", boatId: "b", since: 5, fromWater: false },
    swim: { kind: "in-boat", boatId: "b", since: 5, fromWater: true },
    swimming: { kind: "swimming", since: 5, swimmer, warned: false },
    frozen: { kind: "frozen", since: 5, x: 0, z: 0 },
  };
  it("names the ending", () => {
    expect(endingOf(phases.aboard)).toBeNull();
    expect(endingOf(phases.jumping)).toBeNull();
    expect(endingOf(phases.swimming)).toBeNull();
    expect(endingOf(phases.deck)).toBe("deck");
    expect(endingOf(phases.swim)).toBe("swim");
    expect(endingOf(phases.frozen)).toBe("frozen");
  });
  it("rewinds to aboard before since, else unchanged", () => {
    for (const p of Object.values(phases)) {
      if (p.kind === "aboard") continue;
      expect(rewindEscape(p, 4)).toEqual({ kind: "aboard" });
      expect(rewindEscape(p, 5)).toBe(p);
    }
    expect(rewindEscape(phases.aboard, 0)).toBe(phases.aboard);
  });
});

describe("lookAround", () => {
  it("turns at the walk's rate and wraps", () => {
    expect(lookAround(0, 1, 0.5)).toBeCloseTo(TURN_RATE * 0.5);
    expect(lookAround(Math.PI - 0.01, 1, 0.1)).toBeLessThan(0);
  });

  it("ignores a turn that is not a number", () => {
    expect(lookAround(1, Number.NaN, 0.5)).toBe(1);
  });
});
