import { Group, Vector3 } from "three";
import { britannic } from "@/lib/shipwreck/ships/britannic";
import { simulate } from "@/lib/shipwreck/sim/run";
import { sampleTrack, type SimTrack } from "@/lib/shipwreck/sim/track";
import { earthZ } from "@/lib/shipwreck/xray";
import {
  BOW_BEND_EASE_S,
  BOW_BEND_REST,
  applyBowBend,
  applyBowBendAbout,
  bendShipPoint,
  bendShipPointAbout,
  bowBend,
  hardLandingAt,
} from "../bowBend";
import { britannicRecipe } from "../britannicRecipe";
import { toThree } from "../shipModel";
import type { V3 } from "../titanicRecipe";

const r = britannicRecipe(britannic);
const hinge = r.hinge!;

describe("bowBend (R12)", () => {
  it("is 0 until a hard landing, then eases to its rest bend", () => {
    expect(bowBend(100, null)).toBe(0);
    expect(bowBend(99.9, 100)).toBe(0);
    expect(bowBend(100, 100)).toBe(0);
    let last = 0;
    for (let t = 100; t <= 100 + BOW_BEND_EASE_S * 2; t += 0.5) {
      const b = bowBend(t, 100);
      expect(b).toBeGreaterThanOrEqual(last);
      expect(b).toBeLessThanOrEqual(BOW_BEND_REST);
      last = b;
    }
    expect(bowBend(100 + BOW_BEND_EASE_S, 100)).toBeCloseTo(BOW_BEND_REST, 9);
    expect(bowBend(1e6, 100)).toBe(BOW_BEND_REST);
    // Up and to port, a modest bend (the wreck's bow is bent, not gone).
    expect(BOW_BEND_REST).toBeGreaterThan(0.1);
    expect(BOW_BEND_REST).toBeLessThan(0.35);
  });

  it("bends the bow up and to port about the C deck at the hinge", () => {
    const stem: V3 = [r.layout.stemX, 0, 2];
    const bent = bendShipPoint(stem, BOW_BEND_REST, hinge);
    expect(bent[2]).toBeGreaterThan(stem[2] + 3);
    expect(bent[1]).toBeGreaterThan(0.5);
    // The hinge itself stays put; aft of it nothing moves.
    expect(bendShipPoint([hinge.x, 0, hinge.z], 0.2, hinge)).toEqual([
      hinge.x,
      0,
      hinge.z,
    ]);
    // The bottom at the hinge opens forward (the hole under the well deck).
    expect(
      bendShipPoint([hinge.x + 0.1, 0, 0.5], 0.2, hinge)[0]
    ).toBeGreaterThan(hinge.x + 2);
  });

  it("moves the model's bow group as bendShipPoint moves a point", () => {
    const g = new Group();
    applyBowBend(g, 0.21, hinge);
    g.updateMatrixWorld();
    for (const p of [
      [120, 3, 10],
      [hinge.x + 1, -12, 18],
      [r.layout.stemX, 0, 22],
    ] as V3[]) {
      const viaGroup = toThree(p).applyMatrix4(g.matrixWorld);
      const want = toThree(bendShipPoint(p, 0.21, hinge), new Vector3());
      expect(viaGroup.distanceTo(want)).toBeLessThan(1e-9);
    }
    applyBowBend(g, 0, hinge);
    g.updateMatrixWorld();
    expect(
      toThree([120, 3, 10])
        .applyMatrix4(g.matrixWorld)
        .distanceTo(toThree([120, 3, 10]))
    ).toBeLessThan(1e-9);
  });

  describe("on her real morning", () => {
    let track: SimTrack;
    beforeAll(() => {
      track = simulate(britannic, britannic.realNight);
    });

    it("lands hard: the bow on the floor with the stern still up", () => {
      const at = hardLandingAt(track);
      expect(at).not.toBeNull();
      expect(at!).toBeLessThan(track.sankAtT!);
      // No other ship's track bends (none lands hard, or none has a hinge).
      expect(hardLandingAt({ ...track, events: [] })).toBeNull();
    });

    it("never bends the bow below the floor", () => {
      const at = hardLandingAt(track)!;
      const floor = -britannic.seaDepthM!;
      // Points round the bow forward of the hinge: keel, bilges, deck edge.
      const pts: V3[] = [];
      for (let x = hinge.x + 0.5; x <= r.layout.stemX; x += 4)
        for (const z of [0.3, 4, 10, hinge.z])
          for (const s of [1, -1]) {
            const y =
              s * r.hull.halfBreadth(x, Math.min(z, r.hull.zTop(x) - 0.05));
            pts.push([x, y, z]);
          }
      for (let t = at; t <= track.endT; t += 5) {
        const pose = sampleTrack(track, t).bodies[0];
        const b = bowBend(t, at);
        let lowBent = Infinity;
        let lowStraight = Infinity;
        for (const p of pts) {
          const q = bendShipPoint(p, b, hinge);
          lowBent = Math.min(lowBent, earthZ(pose, q[0], q[1], q[2]));
          lowStraight = Math.min(lowStraight, earthZ(pose, p[0], p[1], p[2]));
        }
        expect(lowBent).toBeGreaterThanOrEqual(
          Math.min(floor, lowStraight) - 0.05
        );
      }
    });

    it("in the scene, sits the bent bow on the floor: not through it, not floating", () => {
      const at = hardLandingAt(track)!;
      const floor = -britannic.seaDepthM!;
      const pts: V3[] = [];
      for (let x = hinge.x + 0.5; x <= r.layout.stemX; x += 4)
        for (const z of [0.3, 4, 10, hinge.z])
          for (const s of [1, -1]) {
            const y =
              s * r.hull.halfBreadth(x, Math.min(z, r.hull.zTop(x) - 0.05));
            pts.push([x, y, z]);
          }
      let worst = 0;
      for (let t = at; t <= track.endT; t += 5) {
        const pose = sampleTrack(track, t).bodies[0];
        const b = bowBend(t, at);
        let lowBent = Infinity;
        let lowStraight = Infinity;
        for (const p of pts) {
          const q = bendShipPointAbout(p, b, hinge, pose.roll, pose.pitch);
          lowBent = Math.min(lowBent, earthZ(pose, q[0], q[1], q[2]));
          lowStraight = Math.min(lowStraight, earthZ(pose, p[0], p[1], p[2]));
        }
        // Where the sim lays the bow on the floor, the bent bow lies there too.
        if (lowStraight < floor + 1) {
          expect(lowBent).toBeGreaterThanOrEqual(
            Math.min(floor, lowStraight) - 0.3
          );
          expect(lowBent).toBeLessThanOrEqual(floor + 1);
        }
        worst = Math.max(worst, Math.abs(lowBent - lowStraight));
      }
      // And at rest it is still bent (the stem off her keel line).
      const rest = bendShipPointAbout(
        [r.layout.stemX, 0, 2],
        BOW_BEND_REST,
        hinge,
        Math.PI / 2
      );
      expect(rest[2]).toBeGreaterThan(5);
      expect(worst).toBeLessThan(0.5);
    });

    it("moves the bow group as bendShipPointAbout moves a point", () => {
      const g = new Group();
      for (const [roll, pitch] of [
        [0, 0],
        [0.5, 0.6],
        [Math.PI / 2, -0.1],
      ]) {
        applyBowBendAbout(g, 0.2, hinge, roll, pitch);
        g.updateMatrixWorld();
        for (const p of [
          [120, 3, 10],
          [r.layout.stemX, -4, 22],
        ] as V3[]) {
          const viaGroup = toThree(p).applyMatrix4(g.matrixWorld);
          const want = toThree(
            bendShipPointAbout(p, 0.2, hinge, roll, pitch),
            new Vector3()
          );
          expect(viaGroup.distanceTo(want)).toBeLessThan(1e-9);
        }
      }
    });
  });
});
