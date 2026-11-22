import { titanic } from "../../ships/titanic";
import type { BodyPose } from "../../sim/track";
import { shipToEarth } from "../slope";
import {
  partFor,
  stepWalker,
  type StepContext,
  type StepResult,
  type WalkerState,
  type WalkInput,
} from "../step";
import {
  floorZ,
  pointInPolygon,
  TITANIC_WALK,
  WALK_RADIUS_M,
  WALK_SPEED_MS,
  type WalkMap,
} from "..";

const DEG = Math.PI / 180;
const map = TITANIC_WALK;
const spec = titanic;
const DRY = () => -1000;

function pose(p: Partial<BodyPose> = {}): BodyPose {
  return {
    part: "whole",
    x: 0,
    y: 0,
    z: -9.83,
    pitch: 0,
    roll: 0,
    yaw: 0,
    ...p,
  };
}

function ctx(p: Partial<StepContext> = {}): StepContext {
  return { map, spec, pose: pose(), breakX: null, seaZ: DRY, ...p };
}

function walker(p: Partial<WalkerState> = {}): WalkerState {
  return {
    part: "whole",
    area: map.spawn.area,
    x: map.spawn.at[0],
    y: map.spawn.at[1],
    yaw: map.spawn.yaw,
    ...p,
  };
}

const STILL: WalkInput = { forward: 0, strafe: 0, lookDx: 0, lookDy: 0 };
const FORWARD: WalkInput = { ...STILL, forward: 1 };

/** Steps `seconds` at 60 Hz, stopping early once in the water. */
function run(
  s: WalkerState,
  input: WalkInput,
  c: StepContext,
  seconds: number,
  each?: (r: StepResult) => void
): StepResult {
  let r: StepResult = { state: s, inWater: null, depthM: 0, slopeDeg: 0 };
  for (let i = 0; i < Math.round(seconds * 60); i += 1) {
    r = stepWalker(r.state, input, c, 1 / 60);
    each?.(r);
    if (r.inWater) break;
  }
  return r;
}

function outline(m: WalkMap, id: string) {
  const a = m.areas.find((x) => x.id === id);
  if (!a) throw new Error(id);
  return a.outline;
}

/** The sea `depth` m over the feet at the spawn under pose p. */
function seaOver(p: BodyPose, depth: number): () => number {
  const [x, y] = map.spawn.at;
  const feet = shipToEarth(p, [x, y, floorZ(map, map.spawn.area, x, spec)]);
  return () => feet[2] + depth;
}

it("walks forward at WALK_SPEED_MS", () => {
  expect(WALK_SPEED_MS).toBe(4);
  const r = run(walker(), FORWARD, ctx(), 0.5);
  expect(Math.abs(r.state.x - map.spawn.at[0] - 2)).toBeLessThan(0.05);
  expect(r.state.y).toBeCloseTo(map.spawn.at[1], 6);
});

it("turns with the look drag and walks the way it faces", () => {
  const r = stepWalker(walker(), { ...STILL, lookDx: -100 }, ctx(), 1 / 60);
  expect(r.state.yaw).toBeCloseTo(0.5, 9);
  const s = run(walker({ yaw: Math.PI / 2 }), FORWARD, ctx(), 0.25).state;
  expect(s.y - map.spawn.at[1]).toBeCloseTo(1, 1);
});

describe("blockers", () => {
  const square: WalkMap = {
    ship: "titanic",
    areas: [
      {
        id: "boat-deck",
        deck: "Boat",
        outline: [
          [-20, -20],
          [20, -20],
          [20, 20],
          [-20, 20],
        ],
      },
    ],
    blockers: [{ kind: "circle", area: "boat-deck", at: [0, 0], r: 3 }],
    stairs: [],
    spawn: { area: "boat-deck", at: [-10, 0], yaw: 0 },
  };

  it("stops at a funnel and slides round its edge", () => {
    const c = ctx({ map: square });
    let minD = Infinity;
    const r = run(walker({ x: -10, y: 1 }), FORWARD, c, 12, (q) => {
      minD = Math.min(minD, Math.hypot(q.state.x, q.state.y));
    });
    expect(minD).toBeGreaterThanOrEqual(3 + WALK_RADIUS_M - 1e-6);
    // Slid round it to the far side rather than sticking.
    expect(r.state.x).toBeGreaterThan(3);
  });

  it("never walks into the Titanic's funnel casing", () => {
    const f = spec.funnels[1];
    let minD = Infinity;
    const r = run(
      walker({ x: f.x - 0.3, y: -9, yaw: Math.PI / 2 - 0.3 }),
      FORWARD,
      ctx(),
      2,
      (q) => {
        minD = Math.min(minD, Math.hypot(q.state.x - f.x, q.state.y));
      }
    );
    expect(minD).toBeGreaterThanOrEqual((24.5 * 0.3048) / 2);
    // Pressed against the casing's side (y = −4.3), moved along it.
    expect(r.state.y).toBeLessThanOrEqual(-4.3 - WALK_RADIUS_M + 1e-6);
    expect(r.state.y).toBeGreaterThan(-4.3 - WALK_RADIUS_M - 0.05);
    expect(r.state.x).toBeGreaterThan(f.x + 1);
  });
});

describe("railings", () => {
  const inside = (q: StepResult) =>
    pointInPolygon([q.state.x, q.state.y], outline(map, q.state.area));

  it("always hold, however steep she lists", () => {
    for (const roll of [15, 25, 45, -60]) {
      const c = ctx({ pose: pose({ roll: roll * DEG }) });
      const r = run(walker(), { ...STILL, strafe: 1 }, c, 8, (q) => {
        expect(inside(q)).toBe(true);
        expect(q.inWater).toBeNull();
      });
      expect(r.slopeDeg).toBeCloseTo(Math.abs(roll), 6);
    }
  });

  it("hold with the sea knee deep over them", () => {
    const p = pose();
    const c = ctx({ pose: p, seaZ: seaOver(p, 0.6) });
    const r = run(walker(), { ...STILL, strafe: 1 }, c, 15, (q) => {
      expect(inside(q)).toBe(true);
    });
    expect(r.inWater).toBeNull();
  });

  it("does not cross a railing at ×100", () => {
    let s = walker({ x: -5, y: -13.5 });
    for (let i = 0; i < 200; i += 1) {
      const r = stepWalker(
        s,
        { ...STILL, strafe: i % 3 === 0 ? 1 : -1 },
        ctx({ pose: pose({ roll: ((i % 40) - 20) * DEG }) }),
        0.25
      );
      expect(r.inWater).toBeNull();
      expect(inside(r)).toBe(true);
      s = r.state;
    }
  });
});

describe("slopes", () => {
  it("never push you: standing still stays put at any tilt", () => {
    for (const [pitch, roll] of [
      [22, 0],
      [45, 30],
      [-30, -60],
    ]) {
      const c = ctx({ pose: pose({ pitch: pitch * DEG, roll: roll * DEG }) });
      const r = run(walker(), STILL, c, 3);
      expect(r.state.x).toBeCloseTo(map.spawn.at[0], 9);
      expect(r.state.y).toBeCloseTo(map.spawn.at[1], 9);
    }
  });

  it("walks uphill at full speed", () => {
    const c = ctx({ pose: pose({ pitch: -30 * DEG }) });
    // Bow up: forward is uphill.
    const r = run(walker(), FORWARD, c, 0.5);
    expect(Math.abs(r.state.x - map.spawn.at[0] - 2)).toBeLessThan(0.05);
  });
});

describe("water", () => {
  it("wades a little slower at knee depth", () => {
    const p = pose();
    const r = run(walker(), FORWARD, ctx({ seaZ: seaOver(p, 0.5) }), 0.5);
    // 0.8 of full speed at half the waist depth.
    expect(Math.abs(r.state.x - map.spawn.at[0] - 1.6)).toBeLessThan(0.1);
    expect(r.depthM).toBeCloseTo(0.5, 1);
    expect(r.inWater).toBeNull();
  });

  it("does not push you downhill", () => {
    const p = pose({ pitch: 5 * DEG });
    const r = run(walker(), STILL, ctx({ pose: p, seaZ: seaOver(p, 0.5) }), 3);
    expect(r.state.x).toBeCloseTo(map.spawn.at[0], 9);
    expect(r.inWater).toBeNull();
  });

  it("is in the water at waist depth", () => {
    const p = pose();
    const r = stepWalker(
      walker(),
      STILL,
      ctx({ seaZ: seaOver(p, 1.0) }),
      1 / 60
    );
    expect(r.inWater).toBe("deep");
    const knee = stepWalker(
      walker(),
      STILL,
      ctx({ seaZ: seaOver(p, 0.9) }),
      1 / 60
    );
    expect(knee.inWater).toBeNull();
  });
});

describe("the break", () => {
  it("holds you on the bow", () => {
    const c = ctx({ breakX: 10 });
    const r = run(
      walker({ part: "bow", x: 11, yaw: Math.PI }),
      FORWARD,
      c,
      3,
      (q) => expect(q.state.x).toBeGreaterThanOrEqual(10)
    );
    expect(r.inWater).toBeNull();
  });

  it("holds you on the stern", () => {
    const c = ctx({ breakX: 10 });
    const r = run(walker({ part: "stern", x: 9, yaw: 0 }), FORWARD, c, 3, (q) =>
      expect(q.state.x).toBeLessThan(10)
    );
    expect(r.inWater).toBeNull();
  });

  it("puts a walker at breakX on the part on their side", () => {
    expect(partFor(10, 10, true)).toBe("bow");
    expect(partFor(9.99, 10, true)).toBe("stern");
    expect(partFor(42, null, false)).toBe("whole");
    expect(partFor(42, 10, false)).toBe("whole");
  });
});

describe("stairs", () => {
  it("takes the stairs", () => {
    const stair = map.stairs.find((s) => s.from.area === "forecastle");
    if (!stair) throw new Error("no forecastle ladder");
    const [x, y] = stair.from.at;
    let arrived: WalkerState | null = null;
    const start = walker({ area: "forecastle", x: x + 2, y, yaw: Math.PI });
    const r = run(start, FORWARD, ctx(), 3, (q) => {
      if (!arrived && q.state.area !== "forecastle") arrived = q.state;
    });
    expect(r.state.area).toBe(stair.to.area);
    expect(arrived).toMatchObject({
      area: stair.to.area,
      x: stair.to.at[0],
      y: stair.to.at[1],
    });
  });

  it("takes them back up the other way", () => {
    const stair = map.stairs.find((s) => s.from.area === "forecastle");
    if (!stair) throw new Error("no forecastle ladder");
    const [x, y] = stair.to.at;
    const r = run(
      walker({ area: stair.to.area, x: x - 2, y, yaw: 0 }),
      FORWARD,
      ctx(),
      2.5
    );
    expect(r.state.area).toBe("forecastle");
  });

  it("does not bounce straight back on arrival", () => {
    const stair = map.stairs[0];
    const at = walker({
      area: stair.to.area,
      x: stair.to.at[0],
      y: stair.to.at[1],
    });
    const r = run(at, STILL, ctx(), 1);
    expect(r.state.area).toBe(stair.to.area);
  });
});

it("clamps a long frame to 0.25 s", () => {
  const r = stepWalker(walker(), FORWARD, ctx(), 5);
  expect(r.state.x - map.spawn.at[0]).toBeCloseTo(1, 6);
});
