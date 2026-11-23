import { Group, Vector3 } from "three";
import { applyBodyPose } from "@/components/shipwreck/model/pose";
import { britannic } from "@/lib/shipwreck/ships/britannic";
import { simulate } from "@/lib/shipwreck/sim/run";
import type { BodyPose } from "@/lib/shipwreck/sim/track";
import { BRITANNIC_HULL_BOXES, pushOutOfHull } from "../cameraMath";
import { FUNNEL_LIFT_M, funnelFloorSpot, layFunnel } from "../funnelWreck";

function inShipFrame(p: BodyPose, w: readonly number[]) {
  const g = new Group();
  applyBodyPose(g, p);
  g.updateMatrixWorld();
  const l = g.worldToLocal(new Vector3(w[0], w[1], w[2]));
  return [l.x, -l.z, l.y] as [number, number, number];
}

describe("the Britannic's fallen funnels [WP]", () => {
  const track = simulate(britannic, britannic.realNight, {
    portholesOpen: true,
  });
  const wreck = track.frames[track.frames.length - 1].bodies[0];
  const sternX = Math.min(...britannic.stations.map((s) => s.x));
  const boat = britannic.decks.find((d) => d.name === "Boat")!.z;

  it("lie on the floor beside her: funnel 1 by the boat deck, 2–4 off her stern", () => {
    for (let i = 0; i < 4; i += 1) {
      const s = funnelFloorSpot(britannic, wreck, i);
      expect(s.centre[1]).toBeCloseTo(-britannic.seaDepthM + FUNNEL_LIFT_M, 6);
      expect(Math.hypot(s.dir[0], s.dir[2])).toBeCloseTo(1, 9);
      // Not inside her, at either end of the funnel.
      for (const k of [-9, 0, 9]) {
        const p = [
          s.centre[0] + s.dir[0] * k,
          s.centre[1],
          s.centre[2] + s.dir[2] * k,
        ];
        const local = inShipFrame(wreck, p);
        expect(pushOutOfHull(local, 0, BRITANNIC_HULL_BOXES)).toEqual(local);
      }
      const local = inShipFrame(wreck, s.centre);
      if (i === 0) {
        // A few metres out from her boat deck, by its own place.
        expect(local[2]).toBeGreaterThan(boat + 4);
        expect(local[2]).toBeLessThan(boat + 35);
        expect(Math.abs(local[0] - britannic.funnels[0].x)).toBeLessThan(20);
      } else expect(local[0]).toBeLessThan(sternX - 20);
    }
  });

  it("moves a funnel group onto its spot, level, from its parent's frame", () => {
    const hull = new Group();
    applyBodyPose(hull, wreck);
    const f = new Group();
    hull.add(f);
    layFunnel(f, 19, britannic, wreck, 2, 1);
    f.updateMatrixWorld();
    const s = funnelFloorSpot(britannic, wreck, 2);
    const foot = new Vector3().setFromMatrixPosition(f.matrixWorld);
    const tip = new Vector3(0, 19, 0).applyMatrix4(f.matrixWorld);
    const mid = foot.clone().add(tip).multiplyScalar(0.5);
    expect(mid.distanceTo(new Vector3(...s.centre))).toBeLessThan(1e-6);
    expect(Math.abs(tip.y - foot.y)).toBeLessThan(1e-6);
  });
});
