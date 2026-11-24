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
  torpedoInView,
  trackSpeedAt,
  underwaterView,
  CARPATHIA_HULL_BOXES,
  CONCORDIA_HULL_BOXES,
  POSEIDON_HULL_BOXES,
  clampAboveGround,
  groundFor,
  type ShotContext,
  type ShotId,
} from "../cameraMath";
import { carpathia } from "@/lib/shipwreck/ships/carpathia";
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { britannic } from "@/lib/shipwreck/ships/britannic";
import { concordia } from "@/lib/shipwreck/ships/concordia";
import { poseidon } from "@/lib/shipwreck/ships/poseidon";
import {
  orbitOnceCapsized,
  poseidonShot,
  poseidonView,
  POSEIDON_SHOTS,
} from "../poseidonShots";
import { floorAt } from "@/lib/shipwreck/sim/seabed";
import { simulate, torpedoHits, whatIfRealIds } from "@/lib/shipwreck/sim/run";
import { sampleTrack, type SimTrack } from "@/lib/shipwreck/sim/track";
// The Concordia's to-sea run takes ~8 s: its saved summary, a frame every
// 60 s (concordiaToSeaFixture, checked against the sim in the sims lane).
import toSea from "@/lib/shipwreck/sim/__tests__/fixtures/concordiaToSea.json";
import { trackSideY } from "../Torpedo";
import { BRITANNIC_HULL_BOXES } from "../cameraMath";

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

describe("the Carpathia's camera (Task 6)", () => {
  const SEA = carpathia.seaDepthM; // 150 m
  const track = simulate(carpathia, carpathia.realNight);
  const real = torpedoHits(carpathia, whatIfRealIds(carpathia));
  const eventT = (kind: string) => track.events.find((e) => e.kind === kind)!.t;

  it("sizes her hull boxes from her data: 170 m, her beam, her houses", () => {
    expect(hullBoxesFor("carpathia")).toBe(CARPATHIA_HULL_BOXES);
    const [hull, ...houses] = CARPATHIA_HULL_BOXES;
    expect(hull.x[0]).toBeCloseTo(-87, 0);
    expect(hull.x[1]).toBeCloseTo(83.5, 0);
    expect(hull.y[1]).toBeCloseTo(carpathia.beam / 2 + 0.1, 6);
    expect(houses).toHaveLength(carpathia.superstructure.length);
    // The stern deckhouse inboard of its walkways.
    expect(houses[0].y[1]).toBeCloseTo(4.6, 6);
  });

  it("follows her morning: two hits, the boats, the 10:50 AM torpedo, her way down", () => {
    const at = (t: number) => cinematicShot(track, t, "carpathia");
    expect(at(-40)).toBe("run-in");
    expect(at(0)).toBe("hit");
    expect(at(20)).toBe("hit");
    expect(at(300)).toBe("list");
    expect(at(700)).toBe("boats");
    expect(at(900)).toBe("port-boats");
    expect(at(1200)).toBe("boats");
    // Her boats all away: settled by the head, the boats clear of her.
    expect(at(3000)).toBe("list");
    // The U-boat's torpedo: its run-in, its hit.
    expect(at(5700 - 30)).toBe("run-in");
    expect(at(5700)).toBe("hit");
    expect(at(5730)).toBe("hit");
    expect(at(5800)).toBe("list");
    const bowUnder = eventT("bow-under");
    const sternUnder = eventT("stern-under");
    const sternLands = eventT("stern-lands");
    expect(at(bowUnder)).toBe("bow-down");
    expect(at(sternUnder - 10)).toBe("grounded");
    // Her way down (R22) is watched under water, then the wreck circled.
    expect(at(sternUnder + 5)).toBe("grounded-below");
    expect(at(sternLands + 4)).toBe("grounded-below");
    expect(at(sternLands + 10)).toBe("on-floor");
    // The title: her morning, wide.
    expect(cinematicShot(track, 0, "carpathia", false)).toBe("afternoon");
    // The shots aim at the torpedo whose run-in has begun.
    expect(torpedoInView(real, -40)).toBe(0);
    expect(torpedoInView(real, 3000)).toBe(1);
    expect(torpedoInView(real, 5700 - 40)).toBe(2);
  });

  it("frames the run-in on her port side, the wake's far end near the camera", () => {
    const h = real[0];
    const body = sampleTrack(track, 0).bodies[0];
    const hitAt = shipToThree(body, [h.x, trackSideY(carpathia, "port"), 9]);
    const v = shotView("run-in", {
      t: -20,
      wall: 0,
      bodies: [body],
      breakX: null,
      seaDepthM: SEA,
      ship: "carpathia",
      hitX: h.x,
      hitT: h.t,
      hitAt,
    });
    // Port is three -z: the camera stands out there, beyond most of the
    // 700 m track, looking in at the hit.
    expect(v.pos[2]).toBeLessThan(hitAt[2] - 400);
    expect(v.target[2]).toBeLessThan(hitAt[2]);
    expect(v.target[2]).toBeGreaterThan(v.pos[2]);
    expect(v.pos[1]).toBeGreaterThan(20);
  });

  it("keeps every camera above her 150 m floor and outside her, all morning", () => {
    const ts: number[] = [];
    for (let t = 0; t < track.endT; t += 97) ts.push(t);
    const su = eventT("stern-under");
    for (let t = su - 40; t <= track.endT; t += 1.5) ts.push(t);
    const boxes = hullBoxesFor("carpathia");
    for (const t of ts) {
      const frame = sampleTrack(track, t);
      const k = torpedoInView(real, t);
      const hitBody = sampleTrack(track, real[k].t).bodies[0];
      const ctx: ShotContext = {
        t,
        wall: 0,
        bodies: frame.bodies,
        breakX: track.breakX,
        seaDepthM: SEA,
        ship: "carpathia",
        hitX: real[k].x,
        hitT: real[k].t,
        hitAt: shipToThree(hitBody, [real[k].x, 9.9, 9]),
      };
      for (const wall of [0, 40, 200]) {
        const c = { ...ctx, wall };
        const shot = cinematicShot(track, t, "carpathia");
        for (const v of [
          shotView(shot, c),
          underwaterView(c),
          lifeboatView(c),
        ]) {
          expect(v.pos[1]).toBeGreaterThanOrEqual(-SEA + 2);
          expect(v.target[1]).toBeGreaterThanOrEqual(-SEA);
          for (const body of frame.bodies) {
            const local = inShipFrame(body, v.pos);
            expect(pushOutOfHull(local, 0, boxes)).toEqual(local);
          }
        }
        // Under water once she is down; over it before.
        if (shot === "grounded-below" || shot === "on-floor")
          expect(shotView(shot, c).pos[1]).toBeLessThan(-3);
        else expect(shotView(shot, c).pos[1]).toBeGreaterThan(2);
      }
    }
  });
});

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

describe("the Britannic's camera (1.4)", () => {
  const SEA = britannic.seaDepthM; // 120 m
  const boxes = hullBoxesFor("britannic");
  const deg = Math.PI / 180;
  const track = simulate(britannic, britannic.realNight, {
    portholesOpen: true,
  });
  const ev = (k: string) => track.events.find((e) => e.kind === k)!.t;

  it("sizes her hull boxes to her 94 ft beam", () => {
    expect(boxes).toBe(BRITANNIC_HULL_BOXES);
    const ys = boxes.flatMap((b) => b.y);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(britannic.beam / 2);
    expect(Math.max(...ys)).toBeLessThan(britannic.beam / 2 + 0.6);
  });

  it("clamps the camera above her 120 m floor", () => {
    expect(clampAboveFloor([0, -200, 0], SEA, 3)[1]).toBe(-117);
  });

  it("never pushes the camera out of her hull, on her side and turned, through the floor", () => {
    // Her wreck as the sim leaves it: on her starboard side, 70° turned.
    const last = track.frames[track.frames.length - 1].bodies[0];
    expect(Math.abs(last.roll)).toBeGreaterThan(80 * deg);
    expect(last.yaw).toBeCloseTo(-70 * deg, 3);
    for (const inside of [
      [0, -13, 16],
      [60, -5, 4],
      [-100, 10, 25],
    ] as [number, number, number][]) {
      const out = keepClear(inside, last, SEA, boxes, 0.6, 3);
      expect(pushOutOfHull(out, 0.6, boxes)).toEqual(out);
      expect(shipToThree(last, out)[1]).toBeGreaterThanOrEqual(-SEA + 3);
    }
  });

  it("follows her morning: the mine, the turn, the boats, the bow on the floor, her side", () => {
    const at = (t: number) => cinematicShot(track, t, "britannic");
    expect(at(0)).toBe("hit");
    expect(at(30)).toBe("hit");
    expect(at(120)).toBe("turn");
    expect(at(400)).toBe("list");
    expect(at(ev("boat-lowered") + 60)).toBe("boats");
    expect(at(ev("forecastle-under") + 60)).toBe("bow-down");
    expect(at(ev("bow-lands") + 5)).toBe("grounded");
    expect(at(ev("stern-under") - 5)).toBe("grounded-below");
    expect(at(ev("stern-under") + 60)).toBe("on-floor");
    expect(cinematicShot(track, 0, "britannic", false)).toBe("morning");
  });

  it("frames every shot of her real morning above her floor and outside her turning hull", () => {
    const end = track.frames[track.frames.length - 1].t;
    for (let t = 0; t <= end + 120; t += 15) {
      const f = sampleTrack(track, t);
      const shot = cinematicShot(track, t, "britannic");
      for (const wall of [0, 90]) {
        const ctx: ShotContext = {
          t,
          wall,
          bodies: f.bodies,
          breakX: track.breakX,
          seaDepthM: SEA,
          ship: "britannic",
          hitX: britannic.realNight[0].x,
        };
        for (const v of [shotView(shot, ctx), underwaterView(ctx)]) {
          expect(v.pos[1]).toBeGreaterThanOrEqual(-SEA + 2);
          const local = inShipFrame(f.bodies[0], v.pos);
          expect(pushOutOfHull(local, 0, boxes)).toEqual(local);
        }
      }
    }
  });
});

describe("the Concordia's camera (Task 6)", () => {
  const boxes = hullBoxesFor("concordia");
  const deg = Math.PI / 180;
  const ground = groundFor("concordia")!;
  const track = simulate(concordia, concordia.realNight, {
    portholesOpen: true,
  });
  const ev = (k: string) => track.events.find((e) => e.kind === k)!.t;
  const rest = track.frames[track.frames.length - 1].bodies[0];
  const insideAny = (l: readonly number[]) =>
    boxes.some(
      (b) =>
        l[0] > b.x[0] &&
        l[0] < b.x[1] &&
        l[1] > b.y[0] &&
        l[1] < b.y[1] &&
        l[2] > b.z[0] &&
        l[2] < b.z[1]
    );

  it("sizes her hull boxes from her data: 290 m, her beam, her decks", () => {
    expect(boxes).toBe(CONCORDIA_HULL_BOXES);
    const ys = boxes.flatMap((b) => b.y);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(concordia.beam / 2);
    expect(Math.max(...ys)).toBeLessThan(concordia.beam / 2 + 0.6);
    const zs = boxes.flatMap((b) => b.z);
    expect(Math.max(...zs)).toBeGreaterThan(50); // deck 14
  });

  it("keeps the ground as the sim's floor offshore and the island's land inland", () => {
    // Three z is −earth y.
    expect(ground(1015, -564)).toBeCloseTo(floorAt(concordia, 1015, 564), 6);
    expect(ground(-33.8, -17.75)).toBeCloseTo(
      floorAt(concordia, -33.8, 17.75),
      6
    );
    expect(ground(1581, -2235)).toBeGreaterThan(300); // Giglio Castello
    expect(groundFor("titanic")).toBeUndefined();
  });

  it("never puts an orbiting camera under her floor, in the island or inside her at her rest at 65°", () => {
    expect(Math.abs(rest.roll)).toBeGreaterThan(60 * deg);
    const c = shipToThree(rest, [0, 0, 10]);
    let checked = 0;
    for (let a = 0; a < 360; a += 15)
      for (const el of [-40, -15, 0, 10, 30, 60])
        for (const r of [8, 25, 60, 150, 400]) {
          const p: [number, number, number] = [
            c[0] + Math.cos(a * deg) * Math.cos(el * deg) * r,
            c[1] + Math.sin(el * deg) * r,
            c[2] + Math.sin(a * deg) * Math.cos(el * deg) * r,
          ];
          // The rig: over the ground, then out of her (never through it).
          const g = clampAboveGround(p, ground, 3);
          const local = inShipFrame(rest, g);
          const out = keepClear(
            local,
            rest,
            concordia.seaDepthM,
            boxes,
            0.6,
            3,
            ground
          );
          const w = shipToThree(rest, out);
          checked += 1;
          expect(w[1]).toBeGreaterThanOrEqual(ground(w[0], w[2]) + 3 - 1e-6);
          expect(insideAny(out)).toBe(false);
        }
    expect(checked).toBe(720);
  });

  it("follows her night: past the island, the strike, the drift, the boats, her rest", () => {
    const at = (t: number) => cinematicShot(track, t, "concordia");
    expect(at(-20)).toBe("giglio");
    expect(at(5)).toBe("giglio-strike");
    expect(at(600)).toBe("giglio-drift");
    expect(at(ev("stern-lands"))).toBe("giglio-drift");
    expect(at(ev("boat-lowered") + 30)).toBe("giglio-boats");
    expect(at(ev("floating-steady"))).toBe("giglio-aground");
    expect(cinematicShot(track, 0, "concordia", false)).toBe("giglio");
  });

  it("frames every shot of her night over the ground and outside her", () => {
    const end = track.frames[track.frames.length - 1].t;
    for (let t = -40; t <= end + 60; t += 10) {
      const f = sampleTrack(track, Math.max(0, t));
      const shot = cinematicShot(track, t, "concordia");
      for (const wall of [0, 70]) {
        const ctx: ShotContext = {
          t,
          wall,
          bodies: f.bodies,
          breakX: null,
          seaDepthM: concordia.seaDepthM,
          ship: "concordia",
        };
        for (const v of [
          shotView(shot, ctx),
          underwaterView(ctx),
          lifeboatView(ctx),
        ]) {
          expect(v.pos[1]).toBeGreaterThanOrEqual(
            ground(v.pos[0], v.pos[2]) + 2
          );
          expect(insideAny(inShipFrame(f.bodies[0], v.pos))).toBe(false);
        }
        // Under water is under water.
        expect(underwaterView(ctx).pos[1]).toBeLessThan(-2);
      }
    }
  });

  it("blown out to sea: deep water under her, every shot over the floor", () => {
    const sea = toSea.whatIf as SimTrack;
    const last = sea.frames[sea.frames.length - 1].bodies[0];
    // The island's shelf is nowhere near: the floor under her is the
    // profile's deep water (no island floor drawn under her).
    expect(ground(last.x, -last.y)).toBeLessThan(-120);
    const end = sea.frames[sea.frames.length - 1].t;
    for (let t = 0; t <= end; t += 60) {
      const f = sampleTrack(sea, t);
      const ctx: ShotContext = {
        t,
        wall: 0,
        bodies: f.bodies,
        breakX: null,
        seaDepthM: concordia.seaDepthM,
        ship: "concordia",
      };
      const v = shotView(cinematicShot(sea, t, "concordia"), ctx);
      expect(v.pos[1]).toBeGreaterThanOrEqual(ground(v.pos[0], v.pos[2]) + 2);
    }
  });
});

describe("the Poseidon's camera (Task 9)", () => {
  const boxes = hullBoxesFor("poseidon");
  const deg = Math.PI / 180;
  const SEA = poseidon.seaDepthM;
  const track = simulate(poseidon, poseidon.realNight);
  const ev = (k: string) => track.events.find((e) => e.kind === k)!.t;
  const insideAny = (l: readonly number[]) =>
    boxes.some(
      (b) =>
        l[0] > b.x[0] &&
        l[0] < b.x[1] &&
        l[1] > b.y[0] &&
        l[1] < b.y[1] &&
        l[2] > b.z[0] &&
        l[2] < b.z[1]
    );

  it("sizes her hull boxes from her data: her hull, her tiers, the ballroom and its dome", () => {
    expect(boxes).toBe(POSEIDON_HULL_BOXES);
    const ys = boxes.flatMap((b) => b.y);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(poseidon.beam / 2);
    expect(Math.max(...ys)).toBeLessThan(poseidon.beam / 2 + 0.6);
    const xs = boxes.flatMap((b) => b.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(300);
    // The dome's crown, 9 m over deck 14.
    const zs = boxes.flatMap((b) => b.z);
    expect(Math.max(...zs)).toBeGreaterThanOrEqual(poseidon.decks[0].z + 9);
  });

  for (const rollDeg of [0, 90, 180])
    it(`never leaves an orbiting camera inside her or under the floor at ${rollDeg}°`, () => {
      // Afloat (keel at the sea's level) and on the floor, rolled so.
      for (const z of [-8, 12 - SEA + 30]) {
        const pose: BodyPose = {
          part: "whole",
          x: 0,
          y: 0,
          z,
          roll: rollDeg * deg,
          pitch: 0,
          yaw: 0,
        };
        const c = shipToThree(pose, [0, 0, 25]);
        let checked = 0;
        for (let a = 0; a < 360; a += 20)
          for (const el of [-50, -20, 0, 15, 40, 70])
            for (const r of [6, 20, 45, 120, 300]) {
              const p: [number, number, number] = [
                c[0] + Math.cos(a * deg) * Math.cos(el * deg) * r,
                c[1] + Math.sin(el * deg) * r,
                c[2] + Math.sin(a * deg) * Math.cos(el * deg) * r,
              ];
              // The rig: over the floor, then out of her.
              const g = clampAboveFloor(p, SEA, 3);
              const local = inShipFrame(pose, g);
              const out = keepClear(local, pose, SEA, boxes, 0.6, 3);
              const w = shipToThree(pose, out);
              checked += 1;
              expect(insideAny(out)).toBe(false);
              expect(w[1]).toBeGreaterThanOrEqual(-SEA + 3 - 1e-6);
            }
        expect(checked).toBe(540);
      }
    });

  it("follows her night: the party, the wave, the roll, keel up, the dome, the dive, the floor", () => {
    const at = (t: number) => cinematicShot(track, t, "poseidon");
    expect(at(-50)).toBe("poseidon-party");
    expect(at(-10)).toBe("poseidon-wave");
    expect(at(10)).toBe("poseidon-roll");
    expect(at(ev("capsized") + 10)).toBe("poseidon-keel");
    expect(at(ev("capsized") + 200)).toBe("poseidon-dome");
    expect(at(ev("bow-under"))).toBe("poseidon-dive");
    expect(at(ev("bow-lands") + 10)).toBe("poseidon-floor");
    // The title's calm ship.
    expect(cinematicShot(track, 0, "poseidon", false)).toBe("poseidon-party");
    expect(poseidonShot(track, -50)).toBe("poseidon-party");
  });

  it("frames every shot of her night above the floor, the under-water ones under the sea", () => {
    const end = track.frames[track.frames.length - 1].t;
    for (let t = -60; t <= end + 30; t += 5) {
      const f = sampleTrack(track, t);
      const ctx: ShotContext = {
        t,
        wall: t,
        bodies: f.bodies,
        breakX: null,
        seaDepthM: SEA,
        ship: "poseidon",
      };
      const shot = cinematicShot(track, t, "poseidon");
      const v = shotView(shot, ctx);
      for (const n of [...v.pos, ...v.target])
        expect(Number.isFinite(n)).toBe(true);
      expect(v.pos[1]).toBeGreaterThan(-SEA + 2);
      if (shot === "poseidon-dome" || shot === "poseidon-dive")
        expect(v.pos[1]).toBeLessThan(0);
      // Never inside her.
      expect(insideAny(inShipFrame(f.bodies[0], v.pos))).toBe(false);
    }
    // Every shot has a view (and the under-water camera follows her).
    const f = sampleTrack(track, ev("capsized") + 100);
    const ctx: ShotContext = {
      t: 0,
      wall: 0,
      bodies: f.bodies,
      breakX: null,
      seaDepthM: SEA,
      ship: "poseidon",
    };
    for (const shot of POSEIDON_SHOTS)
      expect(poseidonView(shot, ctx).pos).toHaveLength(3);
    expect(underwaterView(ctx).pos[1]).toBeLessThan(0);
  });

  it("hands the bridge, stern and lifeboat cameras to the orbit once she is keel up", () => {
    const cap = ev("capsized");
    for (const cam of ["bridge", "lifeboat", "stern"] as const) {
      expect(orbitOnceCapsized(cam, track.events, cap - 1)).toBe(false);
      expect(orbitOnceCapsized(cam, track.events, cap)).toBe(true);
      expect(orbitOnceCapsized(cam, track.events, cap + 300)).toBe(true);
    }
    expect(orbitOnceCapsized("cinematic", track.events, cap + 10)).toBe(false);
    expect(orbitOnceCapsized("underwater", track.events, cap + 10)).toBe(false);
    // A run that never rolls over (the smaller wave) keeps its camera.
    const small = simulate(poseidon, poseidon.realNight, { wave: "smaller" });
    expect(small.events.some((e) => e.kind === "capsized")).toBe(false);
    expect(orbitOnceCapsized("bridge", small.events, 600)).toBe(false);
  });
});
