import { Group, Vector3 } from "three";
import { applyBodyPose } from "@/components/shipwreck/model/pose";
import type { BodyPose } from "@/lib/shipwreck/sim/track";
import { earthZ } from "@/lib/shipwreck/xray";
import {
  cinematicShot,
  clampAboveFloor,
  dampSpring,
  HULL_BOXES,
  hullBoxesFor,
  keepClear,
  lifeboatView,
  nearFor,
  portraitPullBack,
  pushOutOfHull,
  shipToThree,
  shipToThreeInto,
  shotView,
  trackSpeedAt,
  underwaterView,
  type ShotContext,
  type ShotId,
} from "../cameraMath";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";

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

describe("the Lusitania's camera", () => {
  const SEA = lusitania.seaDepthM; // 93 m
  const boxes = hullBoxesFor("lusitania");

  it("keeps the Titanic's hull boxes and sizes hers from her data", () => {
    expect(hullBoxesFor("titanic")).toBe(HULL_BOXES);
    const xs = boxes.flatMap((b) => b.x);
    expect(Math.min(...xs)).toBeLessThanOrEqual(-123.2);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(116.6);
    expect(Math.max(...xs)).toBeLessThan(125);
    const ys = boxes.flatMap((b) => b.y);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(lusitania.beam / 2);
    expect(Math.max(...ys)).toBeLessThan(14.2);
  });

  it("clamps the camera above her 93 m floor", () => {
    expect(clampAboveFloor([0, -200, 0], SEA, 2)[1]).toBe(-91);
    expect(clampAboveFloor([0, -60, 0], SEA, 2)[1]).toBe(-60);
  });

  it("never pushes the camera out of her hull through the sea floor", () => {
    // Her wreck: on her starboard side, the side dug a little into the floor.
    const wreck = pose({ x: 3790, y: 30, z: -82, roll: 75 * (Math.PI / 180) });
    const inside: [number, number, number] = [0, -13, 16];
    // The nearest face is her starboard side: under the floor now.
    const naive = pushOutOfHull(inside, 0.6, boxes);
    expect(shipToThree(wreck, naive)[1]).toBeLessThan(-SEA + 2);
    const out = keepClear(inside, wreck, SEA, boxes);
    expect(pushOutOfHull(out, 0.6, boxes)).toEqual(out);
    expect(shipToThree(wreck, out)[1]).toBeGreaterThanOrEqual(-SEA + 2);
    // Outside her already: unchanged.
    expect(keepClear([0, 60, 10], wreck, SEA, boxes)).toEqual([0, 60, 10]);
  });

  const track = {
    brokeAtT: null,
    sankAtT: 1085,
    events: [
      { kind: "collision" as const, t: 0, realT: 0 },
      { kind: "explosion" as const, t: 8, realT: 8 },
      { kind: "boat-lowered" as const, t: 300, realT: 300, index: 0 },
      { kind: "last-boat" as const, t: 840, realT: 840 },
      { kind: "forecastle-under" as const, t: 792, realT: 792 },
      { kind: "bow-lands" as const, t: 1045, realT: 1045 },
      { kind: "stern-under" as const, t: 1085, realT: 1085 },
    ],
  };

  it("follows her afternoon: the hit, the list, the boats, the bow on the floor, the wreck", () => {
    const at = (t: number) => cinematicShot(track, t, "lusitania");
    // The torpedo's run-in (the pre-roll), then the hit at 0.
    expect(at(-40)).toBe("run-in");
    expect(at(-0.5)).toBe("run-in");
    expect(at(0)).toBe("hit");
    expect(at(20)).toBe("hit");
    expect(at(120)).toBe("list");
    expect(at(360)).toBe("boats");
    expect(at(600)).toBe("port-boats");
    expect(at(720)).toBe("boats");
    expect(at(900)).toBe("bow-down");
    expect(at(1050)).toBe("grounded");
    expect(at(1075)).toBe("grounded-below");
    expect(at(1200)).toBe("on-floor");
    // Before any hit (the title's calm ship): her afternoon, wide.
    expect(cinematicShot(track, 0, "lusitania", false)).toBe("afternoon");
    expect(cinematicShot(track, 600, "lusitania", false)).toBe("afternoon");
    // The Titanic's shots are as they were.
    expect(cinematicShot(track, 100)).toBe("establishing");
  });

  it("frames the run-in: the hit ahead, the wake coming in from starboard", () => {
    const ctx: ShotContext = {
      t: -30,
      wall: 0,
      bodies: [pose({ x: -278, z: -9.35 })],
      breakX: null,
      seaDepthM: SEA,
      ship: "lusitania",
      hitX: 63.7,
      hitAt: [63.7, 0, 13.4],
    };
    const v = shotView("run-in", ctx);
    // On her starboard side (+z), ahead of her, looking back toward the hit.
    expect(v.pos[2]).toBeGreaterThan(100);
    expect(v.pos[0]).toBeGreaterThan(63.7);
    expect(v.pos[1]).toBeGreaterThan(5);
  });

  it("frames every shot above her floor and outside her hull", () => {
    const deg = Math.PI / 180;
    const cases: [ShotId, BodyPose][] = [
      ["afternoon", pose({ z: -9.35 })],
      ["run-in", pose({ x: -370, z: -9.35 })],
      ["run-in", pose({ x: -20, z: -9.35 })],
      ["hit", pose({ x: 40, z: -9.4, roll: 2 * deg })],
      ["list", pose({ x: 900, z: -10.4, roll: 18 * deg, pitch: 1.5 * deg })],
      ["boats", pose({ x: 2700, z: -12.2, roll: 24 * deg, pitch: 3 * deg })],
      ["port-boats", pose({ x: 3000, z: -13, roll: 25 * deg, pitch: 3 * deg })],
      ["bow-down", pose({ x: 3600, z: -18, roll: 20 * deg, pitch: 6 * deg })],
      ["grounded", pose({ x: 3790, z: -50, roll: 45 * deg, pitch: 22 * deg })],
      [
        "grounded-below",
        pose({ x: 3790, z: -55, roll: 50 * deg, pitch: 22 * deg }),
      ],
      [
        "on-floor",
        pose({ x: 3794, y: 30, z: -102, roll: 75 * deg, pitch: 3 * deg }),
      ],
    ];
    for (const [shot, body] of cases) {
      for (const wall of [0, 40, 200]) {
        const ctx: ShotContext = {
          t: 600,
          wall,
          bodies: [body],
          breakX: null,
          seaDepthM: SEA,
          ship: "lusitania",
          hitX: 63.7,
          hitAt: [63.7, 0, 13.4],
        };
        const v = shotView(shot, ctx);
        expect(v.pos[1]).toBeGreaterThanOrEqual(-SEA + 2);
        expect(v.target[1]).toBeGreaterThanOrEqual(-SEA);
        // Not inside her (her hull boxes, in her own frame).
        const local = inShipFrame(body, v.pos);
        expect(pushOutOfHull(local, 0, boxes)).toEqual(local);
        // Above-water shots stay above the water, under-water ones under.
        if (shot === "grounded-below" || shot === "on-floor")
          expect(v.pos[1]).toBeLessThan(-3);
        else expect(v.pos[1]).toBeGreaterThan(2);
      }
    }
    const ctx: ShotContext = {
      t: 1200,
      wall: 10,
      bodies: [cases[8][1]],
      breakX: null,
      seaDepthM: SEA,
      ship: "lusitania",
    };
    expect(underwaterView(ctx).pos[1]).toBeGreaterThanOrEqual(-SEA + 2);
    // Her boats got away from the starboard side: the boat camera is there.
    expect(lifeboatView({ ...ctx, bodies: [pose()] }).pos[2]).toBeGreaterThan(
      100
    );
    expect(
      lifeboatView({ ...ctx, ship: "titanic", bodies: [pose()] }).pos[2]
    ).toBeLessThan(-100);
  });
});

/** A three.js point in a pose's ship frame (the inverse of shipToThree). */
function inShipFrame(
  p: BodyPose,
  w: readonly number[]
): [number, number, number] {
  const g = new Group();
  applyBodyPose(g, p);
  g.updateMatrixWorld();
  const l = g.worldToLocal(new Vector3(w[0], w[1], w[2]));
  return [l.x, -l.z, l.y];
}

describe("no-allocation helpers", () => {
  it("shipToThreeInto writes what shipToThree returns", () => {
    const p = pose({ x: 5, pitch: 0.1, roll: 0.3, yaw: 0.2 });
    const out: [number, number, number] = [0, 0, 0];
    expect(shipToThreeInto(p, [40, -6, 18], out)).toBe(out);
    expect(out).toEqual(shipToThree(p, [40, -6, 18]));
  });

  it("reads her speed off the frames", () => {
    const frames = [0, 1, 2, 3, 4].map((t) => ({
      t,
      bodies: [pose({ x: t * 9 })],
    }));
    expect(trackSpeedAt(frames, 4, 2)).toBeCloseTo(9, 6);
    expect(trackSpeedAt(frames, 0, 2)).toBe(0);
    expect(trackSpeedAt([], 3)).toBe(0);
  });
});
