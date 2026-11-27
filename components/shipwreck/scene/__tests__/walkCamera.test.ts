import type { BodyPose } from "@/lib/shipwreck/sim/track";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import {
  floorZ,
  TITANIC_WALK,
  type SwimmerState,
  type WalkerState,
} from "@/lib/shipwreck/walk";
import { shipToThree } from "../cameraMath";
import {
  bob,
  deckEyes,
  easeEyes,
  EYE_EASE_S,
  insideFov,
  WALK_INSIDE_FOV,
  WALK_OUTSIDE_FOV,
  followShipPitch,
  LOOK_UNDER_EYE_Y,
  LOOK_UNDER_MIN_POWER,
  lookUnderFog,
  walkAmbient,
  walkHullPower,
  lookUnderAmbient,
  lookUnderLamp,
  LOOK_UNDER_LAMP,
  LOOK_UNDER_NIGHT_AMBIENT,
  waterEyes,
} from "../walkCamera";

const DEG = Math.PI / 180;
const map = TITANIC_WALK;
const spec = titanic;

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

const walker: WalkerState = {
  part: "whole",
  area: map.spawn.area,
  x: map.spawn.at[0],
  y: map.spawn.at[1],
  yaw: 0.4,
};

describe("eyes on deck", () => {
  it("stands 1.6 m over the deck on a level ship", () => {
    const p = pose();
    const v = deckEyes(walker, p, spec, map, 0);
    const fz = floorZ(map, walker.area, walker.x, spec);
    const feet = shipToThree(p, [walker.x, walker.y, fz]);
    expect(v.pos[1]).toBeCloseTo(fz + 1.6 + p.z, 9);
    expect(v.pos[0]).toBeCloseTo(feet[0], 9);
    expect(v.pos[2]).toBeCloseTo(feet[2], 9);
  });

  it("stays level with the horizon when she rolls", () => {
    const p = pose({ roll: 20 * DEG, pitch: 5 * DEG, yaw: 0.3 });
    const v = deckEyes(walker, p, spec, map, -0.2);
    expect(Object.keys(v).sort()).toEqual(["pitch", "pos", "yaw"]);
    expect(v.pitch).toBe(-0.2);
    expect(v.yaw).toBeCloseTo(0.3 + 0.4, 9);
    // Straight up from the feet, not along her tilted mast.
    const fz = floorZ(map, walker.area, walker.x, spec);
    const feet = shipToThree(p, [walker.x, walker.y, fz]);
    expect(v.pos[0]).toBeCloseTo(feet[0], 9);
    expect(v.pos[1]).toBeCloseTo(feet[1] + 1.6, 9);
    expect(v.pos[2]).toBeCloseTo(feet[2], 9);
  });
});

describe("eyes in the water", () => {
  const s: SwimmerState = { x: 120, y: -40, yaw: 1 };

  it("floats 0.3 m over the sea, give or take the swell", () => {
    for (let t = 0; t < 14; t += 0.37) {
      const v = waterEyes(s, t, 0.1, false);
      expect(v.pos[1]).toBeGreaterThanOrEqual(0.3 - 0.25 - 1e-9);
      expect(v.pos[1]).toBeLessThanOrEqual(0.3 + 0.25 + 1e-9);
      expect(v.pos[0]).toBe(120);
      expect(v.pos[2]).toBe(40);
      expect(v.yaw).toBe(1);
      expect(v.pitch).toBe(0.1);
    }
  });

  it("dips 1 m under to look under", () => {
    expect(waterEyes(s, 3.3, 0, true).pos[1]).toBe(-1.0);
    expect(LOOK_UNDER_EYE_Y).toBe(-1.0);
  });

  it("bobs on a 7 s swell", () => {
    for (const t of [0, 1.2, 4.9]) expect(bob(t + 7)).toBeCloseTo(bob(t), 9);
    expect(bob(1.75)).toBeCloseTo(0.25, 9);
    expect(Math.abs(bob(3.5))).toBeLessThan(1e-9);
  });
});

describe("following her down", () => {
  it("tilts down at a ship 200 m below and ahead", () => {
    const p = followShipPitch([0, -1, 0], [150, -201, 0], -1.3);
    expect(p).toBeLessThan(0);
    expect(p).toBeCloseTo(-Math.atan2(200, 150), 9);
  });

  it("never tilts past the limit", () => {
    expect(followShipPitch([0, -1, 0], [1, -500, 0], -1.3)).toBe(-1.3);
  });
});

describe("look under helps", () => {
  it("keeps her hull lights faintly on", () => {
    expect(walkHullPower(0, false)).toBe(0);
    expect(walkHullPower(0, true)).toBe(LOOK_UNDER_MIN_POWER);
    expect(LOOK_UNDER_MIN_POWER).toBe(0.5);
    expect(walkHullPower(0.8, true)).toBe(0.8);
  });

  it("lights her with the lamp and the starlight only while looking under", () => {
    expect(lookUnderLamp("night", 8, false)).toBe(8);
    expect(lookUnderLamp("night", 8, true)).toBe(LOOK_UNDER_LAMP.night);
    expect(lookUnderLamp("afternoon", 0, true)).toBe(LOOK_UNDER_LAMP.afternoon);
    expect(lookUnderAmbient(0.25, false)).toBe(0.25);
    expect(lookUnderAmbient(0.25, true)).toBe(LOOK_UNDER_NIGHT_AMBIENT);
  });

  it("clears the water", () => {
    expect(lookUnderFog("night", 0.006, true)).toBe(0.0018);
    expect(lookUnderFog("afternoon", 0.01, true)).toBeCloseTo(0.0035, 12);
    expect(lookUnderFog("night", 0.006, false)).toBe(0.006);
    expect(lookUnderFog("afternoon", 0.01, false)).toBe(0.01);
  });

  it("lifts the ambient a little only while walking", () => {
    expect(walkAmbient(0.9, true)).toBeCloseTo(1.125, 12);
    expect(walkAmbient(0.9, false)).toBe(0.9);
  });
});

describe("inside her: the wider view and the step through a door", () => {
  it("eases the field of view to 65° inside and back to 42° outside", () => {
    expect(WALK_INSIDE_FOV).toBe(65);
    expect(WALK_OUTSIDE_FOV).toBe(42);
    // Settled: stays put.
    expect(insideFov(42, false, 1 / 60)).toBe(42);
    expect(insideFov(65, true, 1 / 60)).toBe(65);
    // Going in: rises, monotonically, never past 65, there in about 0.4 s.
    let fov = 42;
    let prev = fov;
    let t = 0;
    while (fov < 65 && t < 2) {
      fov = insideFov(fov, true, 1 / 60);
      expect(fov).toBeGreaterThan(prev);
      expect(fov).toBeLessThanOrEqual(65);
      prev = fov;
      t += 1 / 60;
    }
    expect(t).toBeGreaterThan(0.3);
    expect(t).toBeLessThan(0.5);
    // Coming out: back down to 42 the same way.
    for (let i = 0; i < 60; i += 1) fov = insideFov(fov, false, 1 / 60);
    expect(fov).toBe(42);
    // A stalled frame does not overshoot, nor does a bad dt move it.
    expect(insideFov(42, true, 10)).toBe(65);
    expect(insideFov(50, true, Number.NaN)).toBe(50);
  });

  it("the eyes ease over 0.12 s after a door, then follow exactly", () => {
    expect(EYE_EASE_S).toBeCloseTo(0.12, 9);
    const from: [number, number, number] = [0, 10, 0];
    const v = {
      pos: [1, 10.5, -0.7] as [number, number, number],
      yaw: 0,
      pitch: 0,
    };
    const at = (t: number) => {
      const w = { ...v, pos: [...v.pos] as [number, number, number] };
      easeEyes(w, from, t);
      return w.pos;
    };
    expect(at(0)).toEqual(from);
    expect(at(EYE_EASE_S)).toEqual(v.pos);
    expect(at(1)).toEqual(v.pos);
    // Monotonic along the way, never past the target.
    let prev = 0;
    for (let i = 1; i < 12; i += 1) {
      const x = at(i * 0.01)[0];
      expect(x).toBeGreaterThan(prev);
      expect(x).toBeLessThan(1);
      prev = x;
    }
  });
});
