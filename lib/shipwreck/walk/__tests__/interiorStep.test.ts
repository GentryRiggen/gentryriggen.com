import { liftRideS, liftRideZ } from "../../interior/lift";
import { deckZAt } from "../../places";
import { concordia } from "../../ships/concordia";
import { titanic } from "../../ships/titanic";
import type { BodyPose } from "../../sim/track";
import { shipToEarth } from "../slope";
import { walkMapFor } from "../registry";
import {
  stepWalker,
  walkerFloorZ,
  type StepContext,
  type StepResult,
  type WalkerState,
  type WalkInput,
} from "../step";
import {
  floorZ,
  insideBlocker,
  WALK_INSIDE_SPEED_MS,
  WALK_LIFT_MAX_DEPTH_M,
  WALK_KNEE_DEPTH_M,
  WALK_RADIUS_M,
  WALK_SPEED_MS,
  WALK_TURN_PER_PX,
  type WalkMap,
} from "..";

/**
 * Small synthetic maps (not the Titanic's rooms): a deck, two rooms joined
 * by a doorway seam, a ramp down to a lower room, a door link from the deck
 * and a lift link to a room far below.
 *
 *   deck (Boat)  | roomA (B) |seam| roomB (B) |seam| ramp (B→C) |seam| roomD (C)
 *   x −20..−10     0..10          10..20          20..30            30..40
 *
 * liftE (E) sits apart at x 50..54; a lift joins roomD to it.
 */
const spec = titanic;
const DROP_B_TO_C = deckZAt("B", 0, spec) - deckZAt("C", 0, spec);

const MAP: WalkMap = {
  ship: "titanic",
  areas: [
    {
      id: "deck",
      deck: "Boat",
      outline: [
        [-20, 0],
        [-10, 0],
        [-10, 4],
        [-20, 4],
      ],
    },
    {
      id: "roomA",
      deck: "B",
      interior: true,
      // Edge 2 ([10,1]→[10,3]) is the doorway into roomB.
      outline: [
        [0, 0],
        [10, 0],
        [10, 1],
        [10, 3],
        [10, 4],
        [0, 4],
      ],
    },
    {
      id: "roomB",
      deck: "B",
      interior: true,
      outline: [
        [10, 0],
        [20, 0],
        [20, 4],
        [10, 4],
        [10, 3],
        [10, 1],
      ],
    },
    {
      id: "ramp",
      deck: "B",
      interior: true,
      kind: "flight",
      ramp: { from: [20, 2], to: [30, 2], dropM: DROP_B_TO_C },
      outline: [
        [20, 0],
        [30, 0],
        [30, 4],
        [20, 4],
      ],
    },
    {
      id: "roomD",
      deck: "C",
      interior: true,
      outline: [
        [30, 0],
        [40, 0],
        [40, 4],
        [30, 4],
      ],
    },
    {
      id: "liftE",
      deck: "E",
      interior: true,
      outline: [
        [50, 0],
        [54, 0],
        [54, 4],
        [50, 4],
      ],
    },
  ],
  blockers: [
    { kind: "box", area: "roomA", min: [4, 1.5], max: [6, 2.5] },
    // Tagged roomA but standing where roomB is: roomB must not feel it.
    { kind: "circle", area: "roomA", at: [15, 2], r: 1 },
  ],
  seams: [
    {
      a: "roomA",
      b: "roomB",
      at: [
        [10, 3],
        [10, 1],
      ],
    },
    {
      a: "roomB",
      b: "ramp",
      at: [
        [20, 0],
        [20, 4],
      ],
    },
    {
      a: "ramp",
      b: "roomD",
      at: [
        [30, 4],
        [30, 0],
      ],
    },
  ],
  stairs: [
    {
      id: "door-a",
      kind: "door",
      from: { area: "deck", at: [-11, 2] },
      to: { area: "roomA", at: [1, 2] },
      widthM: 1,
    },
    {
      id: "lift",
      kind: "lift",
      from: { area: "roomD", at: [39, 2] },
      to: { area: "liftE", at: [52, 2] },
      widthM: 1,
    },
  ],
  spawn: { area: "deck", at: [-15, 2], yaw: 0 },
};

const DRY = () => -1000;
const POSE: BodyPose = {
  part: "whole",
  x: 0,
  y: 0,
  z: -9.83,
  pitch: 0,
  roll: 0,
  yaw: 0,
};

function ctx(p: Partial<StepContext> = {}): StepContext {
  return { map: MAP, spec, pose: POSE, breakX: null, seaZ: DRY, ...p };
}

function walker(area: string, x: number, y: number, yaw = 0): WalkerState {
  return { part: "whole", area, x, y, yaw };
}

const STILL: WalkInput = { forward: 0, strafe: 0, lookDx: 0, lookDy: 0 };
const FORWARD: WalkInput = { ...STILL, forward: 1 };

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

const floorOf = (st: WalkerState) => floorZ(MAP, st.area, st.x, spec, st.y);

describe("seams", () => {
  it("crossing a doorway changes area and keeps full speed", () => {
    const seen: string[] = [];
    let prevX = 8;
    const steps: number[] = [];
    run(walker("roomA", 8, 2), FORWARD, ctx(), 1.2, (r) => {
      if (seen[seen.length - 1] !== r.state.area) seen.push(r.state.area);
      steps.push(r.state.x - prevX);
      prevX = r.state.x;
    });
    expect(seen).toEqual(["roomA", "roomB"]);
    for (const d of steps) expect(d).toBeCloseTo(WALK_INSIDE_SPEED_MS / 60, 6);
  });

  it("walks the whole chain A → B → ramp → D with no jump in the floor", () => {
    const seen: string[] = [];
    let prev = floorOf(walker("roomA", 8, 2));
    let worst = 0;
    const r = run(walker("roomA", 8, 2), FORWARD, ctx(), 9, (res) => {
      if (seen[seen.length - 1] !== res.state.area) seen.push(res.state.area);
      const z = floorOf(res.state);
      worst = Math.max(worst, Math.abs(z - prev));
      prev = z;
    });
    expect(seen).toEqual(["roomA", "roomB", "ramp", "roomD"]);
    expect(r.state.area).toBe("roomD");
    // One substep at 3 m/s down a 2.74 m drop over 10 m: ~1.4 cm.
    expect(worst).toBeLessThan(0.02);
  });

  it("a wall edge still stops the walker; the seam beside it does not", () => {
    const r = run(walker("roomA", 8, 0.5), FORWARD, ctx(), 1);
    expect(r.state.area).toBe("roomA");
    expect(r.state.x).toBeCloseTo(10 - WALK_RADIUS_M, 3);
  });

  it("a wall still slides the walker along it", () => {
    // 60° off the bow: mostly into the y = 4 wall, partly along it.
    const r = run(walker("roomA", 2, 3, Math.PI / 3), FORWARD, ctx(), 0.5);
    expect(r.state.area).toBe("roomA");
    expect(r.state.y).toBeCloseTo(4 - WALK_RADIUS_M, 3);
    expect(r.state.x).toBeGreaterThan(2.5);
  });

  it("walking back crosses the other way", () => {
    const r = run(walker("roomB", 12, 2, Math.PI), FORWARD, ctx(), 1);
    expect(r.state.area).toBe("roomA");
    expect(r.state.x).toBeCloseTo(9, 3);
  });

  it("a shut seam (seamShut) is a wall until it opens, then crossed as before", () => {
    const asked: string[] = [];
    let shut = true;
    const c = ctx({
      seamShut: (from, to) => {
        asked.push(`${from}>${to}`);
        return shut && to === "roomB";
      },
    });
    const r = run(walker("roomA", 8, 2), FORWARD, c, 1.2);
    expect(r.state.area).toBe("roomA");
    expect(r.state.x).toBeCloseTo(10 - WALK_RADIUS_M, 3);
    expect(asked).toContain("roomA>roomB");
    // Pushed off it as off a wall, never standing over the line.
    expect(r.state.x + WALK_RADIUS_M).toBeLessThanOrEqual(10 + 1e-6);
    // Open: through at full speed.
    shut = false;
    const r2 = run(r.state, FORWARD, c, 1);
    expect(r2.state.area).toBe("roomB");
    // Only that way is shut: walking back from B crosses.
    shut = true;
    const back = run(walker("roomB", 12, 2, Math.PI), FORWARD, c, 1);
    expect(back.state.area).toBe("roomA");
  });
});

describe("ramps", () => {
  it("the floor falls linearly from `from` to `to`, clamped at the ends", () => {
    const top = deckZAt("B", 25, spec);
    expect(floorZ(MAP, "ramp", 25, spec, 2)).toBeCloseTo(
      top - DROP_B_TO_C / 2,
      9
    );
    expect(floorZ(MAP, "ramp", 20, spec, 0)).toBeCloseTo(
      deckZAt("B", 20, spec),
      9
    );
    expect(floorZ(MAP, "ramp", 30, spec, 4)).toBeCloseTo(
      deckZAt("C", 30, spec),
      9
    );
    // Beyond the ends (projection clamped).
    expect(floorZ(MAP, "ramp", 35, spec)).toBeCloseTo(
      deckZAt("C", 35, spec),
      9
    );
  });

  it("y defaults to 0 and a plain area ignores it", () => {
    expect(floorZ(MAP, "roomA", 5, spec)).toBe(deckZAt("B", 5, spec));
    expect(floorZ(MAP, "roomA", 5, spec, 3)).toBe(deckZAt("B", 5, spec));
  });

  it("walking down a ramp lowers the floor smoothly", () => {
    let prev = floorOf(walker("ramp", 21, 2));
    const r = run(walker("ramp", 21, 2), FORWARD, ctx(), 2, (res) => {
      const z = floorOf(res.state);
      expect(z).toBeLessThan(prev);
      expect(prev - z).toBeLessThan(0.1);
      prev = z;
    });
    expect(r.state.area).toBe("ramp");
    expect(floorOf(r.state)).toBeCloseTo(
      deckZAt("B", 27, spec) - 0.7 * DROP_B_TO_C,
      6
    );
  });
});

describe("links", () => {
  it("a door link moves the walker and reports via", () => {
    let via: StepResult["via"];
    const r = run(walker("deck", -13, 2), FORWARD, ctx(), 0.6, (res) => {
      via = via ?? res.via;
    });
    expect(r.state.area).toBe("roomA");
    expect(via).toEqual({ kind: "door", id: "door-a" });
  });

  it("a door does nothing while interiors are closed", () => {
    const r = run(
      walker("deck", -13, 2),
      FORWARD,
      ctx({ interiorsOpen: false }),
      2
    );
    expect(r.state.area).toBe("deck");
    expect(r.state.x).toBeCloseTo(-10 - WALK_RADIUS_M, 3);
  });

  it("a lift goes when the arrival is dry", () => {
    let via: StepResult["via"];
    const r = run(walker("roomD", 37, 2), FORWARD, ctx(), 1, (res) => {
      via = via ?? res.via;
    });
    expect(r.state.area).toBe("liftE");
    expect(via).toEqual({ kind: "lift", id: "lift" });
  });

  it("a lift stays put when the arrival is over knee deep", () => {
    expect(WALK_LIFT_MAX_DEPTH_M).toBe(WALK_KNEE_DEPTH_M);
    const feetZ = shipToEarth(POSE, [52, 2, floorZ(MAP, "liftE", 52, spec)])[2];
    const waterZ = (area: string) =>
      area === "liftE" ? feetZ + WALK_LIFT_MAX_DEPTH_M + 0.1 : -1000;
    const r = run(walker("roomD", 37, 2), FORWARD, ctx({ waterZ }), 1);
    expect(r.state.area).toBe("roomD");
    expect(r.via).toBeUndefined();
  });
});

describe("interior rules", () => {
  it("no jump starts inside; the deck still jumps", () => {
    const jump = { ...STILL, jump: true };
    const inside = stepWalker(walker("roomA", 2, 2), jump, ctx(), 1 / 60);
    expect(inside.state.jumpS ?? null).toBeNull();
    const deck = stepWalker(walker("deck", -15, 2), jump, ctx(), 1 / 60);
    expect(deck.state.jumpS).toBeGreaterThan(0);
  });

  it("a jump in progress lands inside (and never goes overboard)", () => {
    const s = {
      ...walker("roomA", 2, 2),
      jumpS: 0.3,
      jumpFrom: [2, 2] as const,
    };
    const r = run(s, FORWARD, ctx(), 0.5);
    expect(r.overboard).toBeUndefined();
    expect(r.state.jumpS ?? null).toBeNull();
  });

  it("inside speed is 3 m/s, deck speed 4 m/s", () => {
    expect(WALK_INSIDE_SPEED_MS).toBe(3);
    const inside = run(walker("roomB", 11, 2), FORWARD, ctx(), 0.5);
    expect(inside.state.x - 11).toBeCloseTo(WALK_INSIDE_SPEED_MS * 0.5, 6);
    const deck = run(walker("deck", -19, 2), FORWARD, ctx(), 0.5);
    expect(deck.state.x + 19).toBeCloseTo(WALK_SPEED_MS * 0.5, 6);
  });
});

describe("water", () => {
  it("waterZ drives depthM inside", () => {
    const feetZ = shipToEarth(POSE, [2, 2, floorZ(MAP, "roomA", 2, spec)])[2];
    const waterZ = (area: string) => (area === "roomA" ? feetZ + 0.3 : -1000);
    const r = stepWalker(walker("roomA", 2, 2), STILL, ctx({ waterZ }), 1 / 60);
    expect(r.depthM).toBeCloseTo(0.3, 9);
  });

  it("waterZ reads ramp floors with y", () => {
    const zFloor = floorZ(MAP, "ramp", 25, spec, 2);
    const feetZ = shipToEarth(POSE, [25, 2, zFloor])[2];
    const waterZ = () => feetZ + 0.2;
    const r = stepWalker(walker("ramp", 25, 2), STILL, ctx({ waterZ }), 1 / 60);
    expect(r.depthM).toBeCloseTo(0.2, 9);
  });

  it("without waterZ, depthM is the old sea maths", () => {
    const seaZ = (x: number, y: number) => -1 + 0.01 * x + 0.02 * y;
    const r = stepWalker(walker("roomA", 2, 2), STILL, ctx({ seaZ }), 1 / 60);
    const feet = shipToEarth(POSE, [2, 2, deckZAt("B", 2, spec)]);
    expect(r.depthM).toBe(seaZ(feet[0], feet[1]) - feet[2]);
  });
});

describe("blockers by area", () => {
  it("a blocker in room A stops a walker in room A", () => {
    const r = run(walker("roomA", 1, 2), FORWARD, ctx(), 2);
    expect(r.state.x).toBeCloseTo(4 - WALK_RADIUS_M, 3);
  });

  it("room A's blockers do not affect room B", () => {
    const r = run(walker("roomB", 11, 2), FORWARD, ctx(), 2);
    expect(r.state.x).toBeCloseTo(17, 3);
    expect(insideBlocker(MAP, "roomB", [15, 2], 0)).toBe(false);
    expect(insideBlocker(MAP, "roomA", [15, 2], 0)).toBe(true);
    expect(insideBlocker(MAP, "roomA", [5, 2], 0)).toBe(true);
  });
});

describe("her glass lifts (the ride)", () => {
  const DEG = Math.PI / 180;
  const her = walkMapFor("concordia")!;
  const liftA = her.lifts!.find((l) => l.id === "lift-a")!;
  const top = liftA.stops.length - 1;
  /** Keyed on heel: leaning 20° to starboard, where her drift is on. */
  const leaning: BodyPose = {
    part: "whole",
    x: 0,
    y: 0,
    z: -concordia.draught,
    pitch: 0,
    roll: 20 * DEG,
    yaw: 0,
  };
  const herCtx = (p: Partial<StepContext> = {}): StepContext => ({
    map: her,
    spec: concordia,
    pose: leaning,
    breakX: null,
    seaZ: () => -1000,
    waterZ: () => -1000,
    ...p,
  });
  const riding = (from: number, to: number, s = 0): WalkerState => ({
    part: "whole",
    area: `lift-a@${liftA.stops[from].deck}`,
    x: 63.1,
    y: 2.6,
    yaw: 0,
    ride: { lift: "lift-a", from, to, s },
  });

  it("merges no lift links for her shafts: the cars ride", () => {
    expect(her.stairs.some((s) => s.kind === "lift")).toBe(false);
    expect(her.lifts?.map((l) => l.id)).toEqual(["lift-a", "lift-b"]);
  });

  it("ignores the stick and her drift while riding, and still turns", () => {
    const c = herCtx();
    // Her lean drifts a standing walker (so the ride's stillness is real).
    const parked = run(
      { part: "whole", area: "lift-a@3", x: 63.1, y: 2.6, yaw: 0 },
      STILL,
      c,
      1
    );
    expect(
      Math.hypot(parked.state.x - 63.1, parked.state.y - 2.6)
    ).toBeGreaterThan(0.05);
    let s = riding(0, top);
    const turn: WalkInput = {
      forward: 1,
      strafe: 1,
      lookDx: -20,
      lookDy: 0,
      jump: true,
    };
    for (let i = 0; i < 120; i += 1) {
      const r = stepWalker(s, turn, c, 1 / 60);
      expect([r.state.x, r.state.y]).toEqual([63.1, 2.6]);
      expect(r.via).toBeUndefined();
      expect(r.state.jumpS ?? null).toBeNull();
      s = r.state;
    }
    expect(s.ride?.s).toBeCloseTo(2, 6);
    expect(s.area).toBe("lift-a@0");
    expect(s.yaw).toBeCloseTo(120 * 20 * WALK_TURN_PER_PX, 6);
  });

  it("ends in the arrival car, ride over, and the walker walks out through its seam", () => {
    const length = liftRideS(liftA, concordia, 0, top);
    let r: StepResult = {
      state: riding(0, top),
      inWater: null,
      depthM: 0,
      slopeDeg: 0,
    };
    let steps = 0;
    while (r.state.ride && steps < 2000) {
      r = stepWalker(r.state, STILL, herCtx(), 1 / 60);
      steps += 1;
    }
    expect(steps / 60).toBeCloseTo(length, 1);
    expect(r.state.area).toBe("lift-a@7");
    expect(r.state.ride).toBeUndefined();
    // The floor meets the arrival car's: no jump in the eyes.
    expect(walkerFloorZ(her, r.state, concordia)).toBeCloseTo(
      floorZ(her, "lift-a@7", 63.1, concordia, 2.6),
      9
    );
    // Out of the car aft through its door into the deck 7 lobby (level, so
    // only the stick moves them).
    const out = run(
      { ...r.state, yaw: Math.PI },
      FORWARD,
      herCtx({ pose: { ...leaning, roll: 0 } }),
      1
    );
    expect(out.state.area).toBe("lobby-7");
  });

  it("the floor under a rider follows liftRideZ, plus her sheer at the feet", () => {
    for (const s of [0, 1, 3.3, 7, 12]) {
      const w = riding(0, top, s);
      const z = walkerFloorZ(her, w, concordia);
      expect(z).toBeCloseTo(liftRideZ(liftA, concordia, 0, top, s), 1);
      // At the car's middle exactly liftRideZ.
      expect(walkerFloorZ(her, { ...w, x: 63.1 }, concordia)).toBeCloseTo(
        liftRideZ(liftA, concordia, 0, top, s),
        9
      );
    }
    // Not riding: the area's floor.
    const parked = { ...riding(1, 2), ride: undefined };
    expect(walkerFloorZ(her, parked, concordia)).toBe(
      floorZ(her, "lift-a@3", 63.1, concordia, 2.6)
    );
  });

  it("the depth while riding runs by the shaft's rule: the higher end's level", () => {
    // The low lobby's water 0.3 m over its floor; the rest dry.
    const lowFloor = shipToEarth(leaning, [
      63.1,
      2.6,
      floorZ(her, "lift-a@0", 63.1, concordia, 2.6),
    ])[2];
    const waterZ = (area: string) =>
      area === "lift-a@0" ? lowFloor + 0.3 : -1000;
    const c = herCtx({ waterZ });
    const start = stepWalker(riding(0, top), STILL, c, 1 / 60);
    expect(start.depthM).toBeCloseTo(0.3, 1);
    const later = stepWalker(riding(0, top, 5), STILL, c, 1 / 60);
    expect(later.depthM).toBeLessThan(0);
    // Riding down to it: deeper toward the end, never deeper than there.
    const down = stepWalker(riding(top, 0, 13.8), STILL, c, 1 / 60);
    expect(down.depthM).toBeLessThanOrEqual(0.3 + 1e-6);
  });

  it("a stop that floods mid-ride is never arrived at: the car turns back to the dry stop it left", () => {
    const flat: BodyPose = { ...leaning, roll: 0 };
    const floorEarth = (area: string) =>
      shipToEarth(flat, [
        63.1,
        2.6,
        floorZ(her, area, 63.1, concordia, 2.6),
      ])[2];
    let lowWet = false;
    const waterZ = (area: string) =>
      area === "lift-a@0" && lowWet ? floorEarth("lift-a@0") + 0.8 : -1000;
    const c = herCtx({ pose: flat, waterZ });
    let r: StepResult = {
      state: riding(top, 0),
      inWater: null,
      depthM: 0,
      slopeDeg: 0,
    };
    for (let i = 0; i < 300; i += 1) r = stepWalker(r.state, STILL, c, 1 / 60);
    expect(r.state.ride).toMatchObject({ from: top, to: 0 });
    const zBefore = walkerFloorZ(her, r.state, concordia);
    // The low lobby (and its car) floods to 0.8 m: over the knee.
    lowWet = true;
    r = stepWalker(r.state, STILL, c, 1 / 60);
    expect(r.state.ride).toMatchObject({ from: 0, to: top });
    // Turned where it was: the floor moves less than a step's worth.
    expect(
      Math.abs(walkerFloorZ(her, r.state, concordia) - zBefore)
    ).toBeLessThanOrEqual(1.5 / 60 + 1e-9);
    let steps = 0;
    while (r.state.ride && steps < 2000) {
      r = stepWalker(r.state, STILL, c, 1 / 60);
      expect(r.inWater).toBeNull();
      steps += 1;
    }
    // Back at the top, dry, the ride over.
    expect(r.state.area).toBe("lift-a@7");
    expect(r.state.ride).toBeUndefined();
    expect(r.depthM).toBeLessThan(0);
  });

  it("with both ends flooded it does not turn back (no turning back and forth)", () => {
    const flat: BodyPose = { ...leaning, roll: 0 };
    const floorEarth = (area: string) =>
      shipToEarth(flat, [
        63.1,
        2.6,
        floorZ(her, area, 63.1, concordia, 2.6),
      ])[2];
    // Both stop cars of a 3 → 4 ride over the knee.
    const waterZ = (area: string) =>
      area === "lift-a@3" || area === "lift-a@4"
        ? floorEarth(area) + 0.6
        : -1000;
    const r = stepWalker(
      riding(1, 2, 1),
      STILL,
      herCtx({ pose: flat, waterZ }),
      1 / 60
    );
    expect(r.state.ride).toMatchObject({ from: 1, to: 2 });
  });

  it("the Titanic's lift link still teleports, with via.kind lift", () => {
    const tmap = walkMapFor("titanic")!;
    const link = tmap.stairs.find((s) => s.kind === "lift")!;
    expect(tmap.lifts).toBeUndefined();
    const tctx: StepContext = {
      map: tmap,
      spec: titanic,
      pose: POSE,
      breakX: null,
      seaZ: DRY,
      waterZ: () => -1000,
    };
    let via: StepResult["via"];
    const r = run(
      walker(link.from.area, link.from.at[0] - 0.8, link.from.at[1], 0),
      FORWARD,
      tctx,
      1,
      (res) => {
        via = via ?? res.via;
      }
    );
    expect(r.state.area).toBe(link.to.area);
    expect(via).toEqual({ kind: "lift", id: link.id });
  });
});
