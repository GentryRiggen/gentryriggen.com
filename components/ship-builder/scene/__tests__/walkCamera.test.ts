import { gridPart, testShip } from "@/lib/ship-builder/testing";
import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import type { WalkState } from "@/lib/ship-builder/walk";
import { DECK_Y, LEVEL_HEIGHT, modelToWorld } from "../coords";
import {
  EYE_HEIGHT,
  floorHeight,
  LOOK_DISTANCE,
  swayShare,
  WALK_SWAY_SHARE,
  walkCamera,
} from "../walkCamera";

const ship = testShip();
const state = (over: Partial<WalkState> = {}): WalkState => ({
  x: 10,
  z: 2,
  yaw: 0,
  level: 0,
  time: 0,
  ...over,
});

describe("walkCamera", () => {
  it("puts the eye at the model position in the world frame, at eye height", () => {
    const { eye } = walkCamera(state(), ship);
    const [x, , z] = modelToWorld(gridLength(ship), beamOf(ship), {
      x: 10,
      y: 0,
      z: 2,
    });
    expect(eye[0]).toBeCloseTo(x);
    expect(eye[2]).toBeCloseTo(z);
    expect(eye[1]).toBeCloseTo(DECK_Y + EYE_HEIGHT);
  });

  it("stands higher on a higher level", () => {
    const { eye } = walkCamera(state({ level: 2 }), ship);
    expect(eye[1]).toBeCloseTo(DECK_Y + 2 * LEVEL_HEIGHT + EYE_HEIGHT);
  });

  it("looks at the bow at yaw 0 and to starboard at PI / 2, level", () => {
    const bow = walkCamera(state(), ship);
    expect(bow.target[0] - bow.eye[0]).toBeCloseTo(LOOK_DISTANCE);
    expect(bow.target[2] - bow.eye[2]).toBeCloseTo(0);
    expect(bow.target[1]).toBe(bow.eye[1]);
    const side = walkCamera(state({ yaw: Math.PI / 2 }), ship);
    expect(side.target[0] - side.eye[0]).toBeCloseTo(0);
    expect(side.target[2] - side.eye[2]).toBeCloseTo(LOOK_DISTANCE);
  });

  it("walking toward the bow moves the eye toward +X", () => {
    const a = walkCamera(state({ x: 10 }), ship).eye[0];
    const b = walkCamera(state({ x: 9 }), ship).eye[0];
    expect(b).toBeGreaterThan(a);
  });

  it("is finite for any input", () => {
    const bad = [NaN, Infinity, -Infinity, 1e300];
    for (const value of bad) {
      const pose = walkCamera(
        state({ x: value, z: value, yaw: value, level: value }),
        ship
      );
      for (const n of [...pose.eye, ...pose.target]) {
        expect(Number.isFinite(n)).toBe(true);
      }
    }
  });
});

describe("floorHeight on stairs", () => {
  // Stairs in cell x = 4 climb toward the stern (+x) onto a deck at x = 5.
  const stairShip = testShip([
    gridPart("d", "deck-1x1", 0, 5, 1),
    gridPart("s", "stairs", 0, 4, 1, 0),
  ]);
  const onStairs = (x: number, level = 0) => state({ x, z: 1.5, level });

  it("is the plain level away from the stairs", () => {
    expect(floorHeight(onStairs(2.5), stairShip)).toBe(0);
    expect(floorHeight(onStairs(5.5, 1), stairShip)).toBe(1);
  });

  it("rises from the back of the flight to its top", () => {
    const foot = floorHeight(onStairs(4.05), stairShip);
    const middle = floorHeight(onStairs(4.5), stairShip);
    const top = floorHeight(onStairs(4.99), stairShip);
    expect(foot).toBeCloseTo(0, 1);
    expect(middle).toBeCloseTo(0.5, 1);
    expect(top).toBeCloseTo(1, 1);
  });

  it("climbs the other way when the stairs face the bow", () => {
    const bowShip = testShip([
      gridPart("d", "deck-1x1", 0, 3, 1),
      gridPart("s", "stairs", 0, 4, 1, 180),
    ]);
    expect(floorHeight(onStairs(4.96), bowShip)).toBeCloseTo(0, 1);
    expect(floorHeight(onStairs(4.04), bowShip)).toBeCloseTo(1, 1);
  });

  it("lifts the eye with the stairs", () => {
    const low = walkCamera(onStairs(4.05), stairShip).eye[1];
    const high = walkCamera(onStairs(4.95), stairShip).eye[1];
    expect(high - low).toBeGreaterThan(0.8);
  });
});

describe("floorHeight on a bridge roof", () => {
  const bridgeShip = testShip([
    gridPart("b", "bridge-3", 0, 5, 1),
    gridPart("s", "stairs", 0, 4, 1, 0),
  ]);

  it("stands a little under a whole level, as the bridge is a lower block", () => {
    expect(floorHeight(state({ x: 5.5, z: 1.5, level: 1 }), bridgeShip)).toBe(
      0.8
    );
  });

  it("climbs the stairs to that lower roof", () => {
    const top = floorHeight(state({ x: 4.99, z: 1.5, level: 0 }), bridgeShip);
    expect(top).toBeCloseTo(0.8, 1);
  });
});

describe("swayShare", () => {
  it("is the calm share with no trial pose and the whole motion at full blend", () => {
    expect(swayShare(0)).toBe(WALK_SWAY_SHARE);
    expect(swayShare(1)).toBe(1);
    expect(swayShare(0.5)).toBeCloseTo((WALK_SWAY_SHARE + 1) / 2);
  });

  it("holds out-of-range and non-finite blends to the ends", () => {
    expect(swayShare(-3)).toBe(WALK_SWAY_SHARE);
    expect(swayShare(4)).toBe(1);
    expect(swayShare(Number.NaN)).toBe(WALK_SWAY_SHARE);
  });
});
