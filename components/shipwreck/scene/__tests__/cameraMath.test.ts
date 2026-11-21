import { Group, Vector3 } from "three";
import { applyBodyPose } from "@/components/shipwreck/model/pose";
import type { BodyPose } from "@/lib/shipwreck/sim/track";
import { earthZ } from "@/lib/shipwreck/xray";
import {
  cinematicShot,
  clampAboveFloor,
  dampSpring,
  nearFor,
  portraitPullBack,
  pushOutOfHull,
  shipToThree,
} from "../cameraMath";

const pose = (p: Partial<BodyPose> = {}): BodyPose => ({
  part: "whole",
  x: 0,
  y: 0,
  z: -9.8,
  pitch: 0,
  roll: 0,
  yaw: 0,
  ...p,
});

describe("shipToThree", () => {
  it("matches applyBodyPose for any pose", () => {
    const cases = [
      pose({ pitch: 0.2, roll: -0.05, yaw: 0.3, x: 5, y: -3, z: -12 }),
      pose({ pitch: -1.2, roll: 0.4, yaw: 2.1 }),
      pose({ pitch: 1.5, roll: 0, yaw: 0 }),
    ];
    for (const c of cases) {
      const g = new Group();
      applyBodyPose(g, c);
      g.updateMatrixWorld();
      const p = [40, -6, 18];
      const viaThree = new Vector3(p[0], p[2], -p[1]).applyMatrix4(
        g.matrixWorld
      );
      const mine = shipToThree(c, p);
      expect(mine[0]).toBeCloseTo(viaThree.x, 6);
      expect(mine[1]).toBeCloseTo(viaThree.y, 6);
      expect(mine[2]).toBeCloseTo(viaThree.z, 6);
      // and the x-ray's earth height agrees
      expect(earthZ(c, p[0], p[1], p[2])).toBeCloseTo(viaThree.y, 6);
    }
  });

  it("bow down puts the bow lower; starboard is +z", () => {
    const p = pose({ pitch: 0.1 });
    expect(shipToThree(p, [100, 0, 10])[1]).toBeLessThan(
      shipToThree(p, [-100, 0, 10])[1]
    );
    expect(shipToThree(pose(), [0, -10, 0])[2]).toBeCloseTo(10);
  });
});

describe("dampSpring", () => {
  it("settles on the target without overshoot", () => {
    const pos = [0];
    const vel = [0];
    let max = 0;
    for (let i = 0; i < 600; i += 1) {
      dampSpring(pos, vel, [10], 3, 1 / 60);
      max = Math.max(max, pos[0]);
    }
    expect(pos[0]).toBeCloseTo(10, 3);
    expect(max).toBeLessThanOrEqual(10.0001);
  });
});

describe("camera bounds", () => {
  it("pushes a point inside the hull out through the nearest face", () => {
    const out = pushOutOfHull([0, 12, 10]);
    expect(out[1]).toBeGreaterThan(14.2);
    expect(out[0]).toBe(0);
    const above = pushOutOfHull([0, 0, 29]);
    expect(above[2]).toBeGreaterThan(29.3);
  });

  it("leaves points outside alone", () => {
    expect(pushOutOfHull([0, 40, 10])).toEqual([0, 40, 10]);
    expect(pushOutOfHull([200, 0, 10])).toEqual([200, 0, 10]);
  });

  it("keeps the camera above the sea floor", () => {
    expect(clampAboveFloor([0, -4000, 0], 3800, 2)[1]).toBe(-3798);
    expect(clampAboveFloor([0, 10, 0], 3800)[1]).toBe(10);
  });

  it("portrait screens stand further back, landscape not at all", () => {
    expect(portraitPullBack(1133 / 744)).toBe(1);
    expect(portraitPullBack(744 / 1133)).toBeCloseTo(1.83, 2);
    expect(portraitPullBack(0.3)).toBe(1.9);
  });

  it("the near plane grows with distance, within limits", () => {
    expect(nearFor(3)).toBeCloseTo(0.1);
    expect(nearFor(100)).toBeCloseTo(2);
    expect(nearFor(3000)).toBe(4);
  });
});

describe("cinematicShot", () => {
  const track = {
    brokeAtT: 9241,
    sankAtT: 9352,
    events: [
      { kind: "rocket" as const, t: 3900, realT: 3900 },
      { kind: "last-boat" as const, t: 8700, realT: 8700 },
      { kind: "bow-lands" as const, t: 9389, realT: 9600 },
    ],
  };
  it("follows the night's events", () => {
    expect(cinematicShot(track, 100)).toBe("establishing");
    expect(cinematicShot(track, 2000)).toBe("along-hull");
    expect(cinematicShot(track, 4000)).toBe("lifeboat");
    expect(cinematicShot(track, 8800)).toBe("wide-starboard");
    expect(cinematicShot(track, 9200)).toBe("break");
    expect(cinematicShot(track, 9330)).toBe("plunge");
    expect(cinematicShot(track, 9370)).toBe("follow-bow");
    expect(cinematicShot(track, 9400)).toBe("wreck");
  });
});
