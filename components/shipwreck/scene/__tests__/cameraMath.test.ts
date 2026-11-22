import { Group, Vector3 } from "three";
import { applyBodyPose } from "@/components/shipwreck/model/pose";
import type { BodyPose } from "@/lib/shipwreck/sim/track";
import { earthZ } from "@/lib/shipwreck/xray";
import {
  aboveWaves,
  cinematicHit,
  cinematicShot,
  fitAcross,
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
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
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

describe("the Fitzgerald's camera", () => {
  const SEA = fitzgerald.seaDepthM; // 162 m
  const boxes = hullBoxesFor("fitzgerald");
  const deg = Math.PI / 180;

  it("sizes her hull boxes from her data: hull, after house, forecastle", () => {
    const xs = boxes.flatMap((b) => b.x);
    const stations = fitzgerald.stations.map((st) => st.x);
    expect(Math.min(...xs)).toBeLessThanOrEqual(Math.min(...stations));
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(Math.max(...stations));
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(fitzgerald.loa + 3);
    const ys = boxes.flatMap((b) => b.y);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(fitzgerald.beam / 2);
    expect(Math.max(...ys)).toBeLessThan(fitzgerald.beam / 2 + 1);
    // Her houses stand above the spar deck at her ends, not amidships.
    const tall = boxes.filter((b) => b.z[1] > fitzgerald.depth + 1);
    expect(tall.length).toBeGreaterThanOrEqual(2);
    for (const b of tall) expect(b.x[0] > 60 || b.x[1] < -60).toBe(true);
  });

  it("keeps the camera clear of the local wave surface, either side of it", () => {
    // Meant above the sea (y ≥ 0): over the crest under it.
    expect(aboveWaves(3, 4.5, 1.5)).toBe(6);
    expect(aboveWaves(12, 4.5, 1.5)).toBe(12);
    expect(aboveWaves(0.5, -3, 1.5)).toBe(0.5);
    // Meant under it: below the trough over it.
    expect(aboveWaves(-2, -3.5, 1.5)).toBe(-5);
    expect(aboveWaves(-40, 2, 1.5)).toBe(-40);
    // And never under her 162 m floor.
    expect(clampAboveFloor([0, -170, 0], SEA, 2)[1]).toBe(-160);
  });

  const pm = (h: number, m: number) => (h + 12 - 15) * 3600 + (m - 30) * 60;
  const track = {
    brokeAtT: 13363.7,
    sankAtT: 13365.2,
    events: [
      { kind: "collision" as const, t: 0, realT: 0 },
      { kind: "radio" as const, t: 2400, realT: 2400, index: 0 },
      { kind: "hatch-fails" as const, t: 13297, realT: 13297, index: 15 },
      { kind: "bow-under" as const, t: 13323, realT: 13323 },
      { kind: "bow-lands" as const, t: 13363.5, realT: 13363.5 },
      { kind: "breakup" as const, t: 13363.7, realT: 13363.7 },
      { kind: "stern-under" as const, t: 13365.2, realT: 13365.2 },
      { kind: "stern-lands" as const, t: 13370, realT: 13370 },
    ],
  };

  it("follows her storm: from astern, on the deck, the big seas, the dive, the floor", () => {
    const at = (t: number) => cinematicShot(track, t, "fitzgerald");
    expect(cinematicShot(track, 0, "fitzgerald", false)).toBe("storm");
    expect(at(0)).toBe("storm");
    const early = new Set([0, 900, 1800, 2700, 3600, 4500, 5400, 7200].map(at));
    expect(early).toEqual(new Set(["storm", "storm-beam", "deck"]));
    expect(at(pm(5, 30))).toBe("deck");
    // Aft at the Anderson's lights when the snow thins in the dark.
    expect(at(pm(5, 55))).toBe("astern");
    expect(at(pm(6, 36))).toBe("astern");
    expect(at(pm(6, 20))).not.toBe("astern");
    expect(at(pm(7, 5))).toBe("sisters");
    expect(at(13323 - 10)).toBe("going");
    expect(at(13323 + 12)).toBe("dive");
    expect(at(13363.5)).toBe("strike");
    expect(at(13366)).toBe("stern-roll");
    expect(at(13380)).toBe("parts");
    // The others' shots are as they were.
    expect(cinematicShot(track, 100)).toBe("establishing");
  });

  it("frames every shot above her floor, outside her hull, clear of the seas", () => {
    const breakX = 17.9;
    const whole = (p: Partial<BodyPose>) => [pose({ z: -8.3, ...p })];
    const parts = (bow: Partial<BodyPose>, stern: Partial<BodyPose>) => [
      pose({ part: "stern", ...stern }),
      pose({ part: "bow", ...bow }),
    ];
    const cases: [ShotId, BodyPose[]][] = [
      ["storm", whole({})],
      ["astern", whole({ x: 52000, roll: 5 * deg, z: -9.2 })],
      ["storm-beam", whole({ x: 20000, roll: 2 * deg })],
      ["deck", whole({ x: 41000, roll: 5 * deg, z: -9 })],
      ["sisters", whole({ x: 72000, roll: 7 * deg, z: -9.5 })],
      ["going", whole({ x: 76100, roll: 8 * deg, pitch: 6 * deg, z: -14 })],
      ["dive", whole({ x: 76250, pitch: 25 * deg, z: -70 })],
      [
        "strike",
        parts(
          { x: 76420, z: -150, pitch: 30 * deg },
          { x: 76430, z: -60, pitch: 30 * deg, roll: 40 * deg }
        ),
      ],
      [
        "stern-roll",
        parts(
          { x: 76428, z: -164 },
          { x: 76440, z: -110, pitch: 10 * deg, roll: 120 * deg }
        ),
      ],
      [
        "parts",
        parts(
          { x: 76428, y: 268, z: -164 },
          { x: 76443, y: 267, z: -151, roll: Math.PI }
        ),
      ],
    ];
    for (const [shot, bodies] of cases) {
      for (const wall of [0, 40, 200]) {
        const ctx: ShotContext = {
          t: 6000,
          wall,
          bodies,
          breakX: bodies.length > 1 ? breakX : null,
          seaDepthM: SEA,
          ship: "fitzgerald",
        };
        const v = shotView(shot, ctx);
        expect(v.pos[1]).toBeGreaterThanOrEqual(-SEA + 2);
        expect(v.target[1]).toBeGreaterThanOrEqual(-SEA);
        for (const b of bodies) {
          const local = inShipFrame(b, v.pos);
          expect(pushOutOfHull(local, 0, boxes)).toEqual(local);
        }
        // Above the seas (her crests reach about 8 m, the three sisters'
        // a few more), or well under them and close enough to see in
        // the dark water (60–100 m: drift audit B).
        if (["dive", "strike", "stern-roll", "parts"].includes(shot)) {
          expect(v.pos[1]).toBeLessThan(-12);
          const d = Math.hypot(
            v.pos[0] - v.target[0],
            v.pos[1] - v.target[1],
            v.pos[2] - v.target[2]
          );
          expect(d).toBeGreaterThan(45);
          expect(d).toBeLessThan(100);
        } else expect(v.pos[1]).toBeGreaterThan(14);
      }
    }
    // Her presets: the underwater and boat cameras.
    const ctx: ShotContext = {
      t: 13380,
      wall: 10,
      bodies: cases[8][1],
      breakX,
      seaDepthM: SEA,
      ship: "fitzgerald",
    };
    const u = underwaterView(ctx).pos[1];
    expect(u).toBeGreaterThanOrEqual(-SEA + 2);
    expect(u).toBeLessThan(-12);
    expect(lifeboatView({ ...ctx, bodies: whole({}) }).pos[1]).toBeGreaterThan(
      14
    );
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

describe("fitting her across a narrow screen", () => {
  it("pulls a wide shot back until 1.15 × her length fits across", () => {
    // Landscape (1133 × 744) at 360 m: she fits already.
    expect(fitAcross(1133 / 744, 42, 360, 1.15 * fitzgerald.loa)).toBe(1);
    // Portrait (744 × 1133) at 175 m (her beam shot): about 2.9×.
    const k = fitAcross(744 / 1133, 42, 175, 1.15 * fitzgerald.loa);
    const halfW = Math.tan((21 * Math.PI) / 180) * (744 / 1133) * 175 * k;
    expect(2 * halfW).toBeCloseTo(1.15 * fitzgerald.loa, 6);
    expect(k).toBeGreaterThan(2.5);
  });
});

describe("cinematicHit", () => {
  it("a storm run follows her story even with no hull openings", () => {
    expect(cinematicHit(0, "storm", false)).toBe(true);
    expect(cinematicHit(2, "storm", false)).toBe(true);
  });
  it("the title's calm stage and a hole-less other ship stay calm", () => {
    expect(cinematicHit(0, "storm", true)).toBe(false);
    expect(cinematicHit(0, "torpedo", false)).toBe(false);
    expect(cinematicHit(0, "iceberg", false)).toBe(false);
    expect(cinematicHit(1, "torpedo", false)).toBe(true);
  });
});
