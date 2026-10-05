import { SIM_STEP_S } from "../../sim/types";
import { handlingFromShip } from "../handling";
import { createSail, stepSail } from "../step";
import type { Obstacle, SailInput, SailShip, SailState } from "../types";

const ship: SailShip = {
  kind: "liner",
  length: 20,
  beam: 6,
  topSpeedKnots: 20,
  grossTonnage: 20000,
};
const handling = handlingFromShip(ship);

function runSail(
  state: SailState,
  input: SailInput,
  seconds: number,
  until?: (s: SailState) => boolean
): SailState {
  let s = state;
  const steps = Math.round(seconds / SIM_STEP_S);
  for (let i = 0; i < steps; i++) {
    s = stepSail(s, input, ship, handling);
    if (until?.(s)) break;
  }
  return s;
}

const obstacle = (o: Partial<Obstacle> & Pick<Obstacle, "kind">): Obstacle => ({
  id: "o1",
  x: 0,
  z: 0,
  radius: 2,
  sector: "0:0",
  ...o,
});

const FULL: SailInput = { throttle: 1, rudder: 0 };
const IDLE: SailInput = { throttle: 0, rudder: 0 };
const cruising = (obstacles: Obstacle[] = []): SailState => ({
  ...createSail(obstacles),
  speed: handling.topSpeed,
});

describe("throttle and speed", () => {
  it("starts at rest at the origin", () => {
    const s = createSail();
    expect(s).toMatchObject({
      time: 0,
      x: 0,
      z: 0,
      heading: 0,
      speed: 0,
      rudder: 0,
      bump: null,
      impact: null,
    });
  });

  it("rises steadily and reaches top speed in about accelSeconds", () => {
    let s = createSail();
    let last = 0;
    for (let t = 0; t < handling.accelSeconds / SIM_STEP_S - 1; t++) {
      s = stepSail(s, FULL, ship, handling);
      expect(s.speed).toBeGreaterThanOrEqual(last);
      expect(s.speed).toBeLessThanOrEqual(handling.topSpeed);
      last = s.speed;
    }
    expect(s.speed).toBeCloseTo(handling.topSpeed, 1);
    const half = runSail(createSail(), FULL, handling.accelSeconds / 2);
    expect(half.speed).toBeCloseTo(handling.topSpeed / 2, 1);
  });

  it("never exceeds top speed, even with an over-range throttle", () => {
    const s = runSail(createSail(), { throttle: 5, rudder: 0 }, 40);
    expect(s.speed).toBeCloseTo(handling.topSpeed);
  });

  it("comes to rest on zero throttle", () => {
    const s = runSail(cruising(), IDLE, 12);
    expect(s.speed).toBe(0);
  });

  it("slows faster than it speeds up", () => {
    const slowing = runSail(cruising(), IDLE, 2);
    const speeding = runSail(createSail(), FULL, 2);
    expect(handling.topSpeed - slowing.speed).toBeGreaterThan(speeding.speed);
  });

  it("reverses no faster than 0.3 x top speed", () => {
    const s = runSail(createSail(), { throttle: -1, rudder: 0 }, 40);
    expect(s.speed).toBeCloseTo(-0.3 * handling.topSpeed);
    expect(s.x).toBeLessThan(0);
  });

  it("moves along its heading", () => {
    const s = runSail({ ...cruising(), heading: Math.PI / 2 }, FULL, 1);
    expect(s.z).toBeCloseTo(handling.topSpeed, 1);
    expect(Math.abs(s.x)).toBeLessThan(1e-9);
  });
});

describe("steering", () => {
  it("does not turn at a standstill", () => {
    const s = runSail(createSail(), IDLE, 0.1);
    const turned = runSail(s, { throttle: 0, rudder: 1 }, 5);
    expect(turned.heading).toBe(0);
    expect(turned.rudder).toBe(1);
  });

  it("turns to starboard with positive rudder at speed", () => {
    const s = runSail(cruising(), { throttle: 1, rudder: 1 }, 2);
    expect(s.heading).toBeGreaterThan(0);
    expect(s.z).toBeGreaterThan(0);
  });

  it("turns port with negative rudder", () => {
    const s = runSail(cruising(), { throttle: 1, rudder: -1 }, 2);
    expect(s.heading).toBeLessThan(0);
  });

  it("eases the rudder in at rudderRate", () => {
    const s = runSail(cruising(), { throttle: 1, rudder: 1 }, 0.2);
    expect(s.rudder).toBeCloseTo(handling.rudderRate * 0.2, 2);
  });

  it("turns no faster than maxTurnRate", () => {
    const s = runSail(cruising(), { throttle: 1, rudder: 1 }, 10);
    expect(s.heading).toBeLessThanOrEqual(handling.maxTurnRate * 10 + 1e-9);
  });

  it("inverts the turn when reversing", () => {
    const reversing: SailState = { ...createSail(), speed: -1 };
    const s = runSail(reversing, { throttle: -0.3, rudder: 1 }, 2);
    expect(s.heading).toBeLessThan(0);
  });
});

describe("collisions", () => {
  it("records a hard bow hit and freezes", () => {
    const iceberg = obstacle({ kind: "iceberg", x: 16, radius: 4 });
    const hit = runSail(cruising([iceberg]), FULL, 5, (s) => s.impact !== null);
    expect(hit.impact).toMatchObject({
      obstacleId: "o1",
      kind: "iceberg",
      part: "bow",
    });
    expect(hit.impact?.impactX).toBeCloseTo(0);
    expect(hit.impact?.closingSpeed).toBeCloseTo(handling.topSpeed, 1);
    expect(stepSail(hit, FULL, ship, handling)).toBe(hit);
  });

  it("records a side hit amidships", () => {
    const rock = obstacle({ kind: "rock", x: 0, z: 4.5 });
    const hit = stepSail(createSail([rock]), IDLE, ship, handling);
    expect(hit.impact?.part).toBe("side");
    expect(hit.impact?.impactX).toBeCloseTo(10);
  });

  it("treats another ship as a hard obstacle", () => {
    const other = obstacle({
      kind: "ship",
      x: 0,
      z: 6,
      radius: 4,
      heading: 0,
      speed: 0,
    });
    const hit = stepSail(createSail([other]), IDLE, ship, handling);
    expect(hit.impact?.kind).toBe("ship");
  });

  it("does not hit a distant obstacle", () => {
    const rock = obstacle({ kind: "rock", x: 200 });
    const s = runSail(cruising([rock]), FULL, 2);
    expect(s.impact).toBeNull();
    expect(s.bump).toBeNull();
  });

  it("bumps a buoy softly: slows 20%, shoves it clear, no impact", () => {
    const buoy = obstacle({ kind: "buoy", x: 12, radius: 0.8 });
    const bumped = runSail(cruising([buoy]), FULL, 2, (s) => s.bump !== null);
    expect(bumped.impact).toBeNull();
    expect(bumped.bump?.id).toBe("o1");
    expect(bumped.speed).toBeCloseTo(handling.topSpeed * 0.8, 5);
    const pushed = bumped.obstacles[0];
    expect(Math.abs(pushed.z)).toBeGreaterThan(ship.beam / 2);
  });

  it("does not bump the same buoy again", () => {
    const buoy = obstacle({ kind: "buoy", x: 12, radius: 0.8 });
    const bumped = runSail(cruising([buoy]), FULL, 2, (s) => s.bump !== null);
    const later = runSail(bumped, FULL, 3);
    expect(later.bump).toEqual(bumped.bump);
    expect(later.impact).toBeNull();
    expect(later.speed).toBeGreaterThan(bumped.speed);
  });

  it("shoves a buoy that is beside the hull outward", () => {
    const buoy = obstacle({ kind: "buoy", x: 0, z: -3.5, radius: 0.8 });
    const s = stepSail(createSail([buoy]), IDLE, ship, handling);
    expect(s.bump).not.toBeNull();
    expect(s.obstacles[0].z).toBeLessThan(-3.8);
  });
});

describe("other ships and determinism", () => {
  it("moves other ships along their heading", () => {
    const other = obstacle({
      kind: "ship",
      x: 100,
      z: 100,
      heading: Math.PI / 2,
      speed: 2,
    });
    const s = runSail(createSail([other]), IDLE, 1);
    expect(s.obstacles[0].z).toBeCloseTo(102, 1);
    expect(s.obstacles[0].x).toBeCloseTo(100, 5);
  });

  it("leaves static obstacles where they are", () => {
    const iceberg = obstacle({ kind: "iceberg", x: 100, z: 100 });
    const s = runSail(createSail([iceberg]), IDLE, 1);
    expect(s.obstacles[0]).toMatchObject({ x: 100, z: 100 });
  });

  it("does not mutate the state it is given", () => {
    const other = obstacle({ kind: "ship", x: 50, heading: 0, speed: 2 });
    const before = createSail([other]);
    const snapshot = JSON.stringify(before);
    stepSail(before, FULL, ship, handling);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("is deterministic", () => {
    const other = obstacle({ kind: "ship", x: 50, heading: 1, speed: 2 });
    const input = { throttle: 0.7, rudder: -0.4 };
    const a = runSail(createSail([other]), input, 5);
    const b = runSail(createSail([other]), input, 5);
    expect(a).toEqual(b);
  });
});
