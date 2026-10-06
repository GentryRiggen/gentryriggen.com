import { testShip } from "@/lib/ship-builder/testing";
import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import type { WalkState } from "@/lib/ship-builder/walk";
import { DECK_Y, LEVEL_HEIGHT, modelToWorld } from "../coords";
import { EYE_HEIGHT, LOOK_DISTANCE, walkCamera } from "../walkCamera";

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
