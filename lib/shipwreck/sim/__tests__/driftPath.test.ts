import type { Opening, ShipSpec } from "../../ships/types";
import { simulate } from "../run";
import { type SimTrack, sampleTrack } from "../track";
import { threeShip } from "./testShips";

/**
 * A scripted drift (`headway.path`, a rule like the Britannic's turn): her
 * origin follows [shown s, earth x, earth y, heading°] and her heading
 * turns with it, while pitch, roll, heave and the flooding never see it.
 * Her way is lost at the first floor touch (her position frozen there);
 * `toSea` follows `pathToSea` instead.
 */

const DEG = Math.PI / 180;
const PATH = [
  [0, 0, 0, 0],
  [600, 4000, 0, 0],
  [1200, 4000, -1500, -120],
] as const;

const aftHole: Opening = {
  compartmentId: "A",
  areaM2: 0.3,
  zLow: 1,
  zHigh: 2,
  x: -40,
  side: "starboard",
};

function withPath(spec: ShipSpec, more: object = {}): ShipSpec {
  return { ...spec, headway: { startMs: 0, path: PATH, ...more } };
}

/** The shortest angle from a to b (radians). */
function angleDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

describe("a drift path", () => {
  let plain: SimTrack;
  let drifting: SimTrack;
  beforeAll(() => {
    plain = simulate(threeShip(), [aftHole], { endT: 1800 });
    drifting = simulate(withPath(threeShip()), [aftHole], { endT: 1800 });
  });

  it("carries her origin through each point at its time", () => {
    for (const [t, x, y] of PATH) {
      const b = sampleTrack(drifting, t).bodies[0];
      expect(Math.hypot(b.x - x, b.y - y)).toBeLessThan(1);
    }
  });

  it("turns her to the path's heading", () => {
    const b = sampleTrack(drifting, 1200).bodies[0];
    expect(Math.abs(angleDiff(b.yaw, -120 * DEG))).toBeLessThan(1e-6);
    // Held past its end.
    const end = drifting.frames[drifting.frames.length - 1].bodies[0];
    expect(Math.abs(angleDiff(end.yaw, -120 * DEG))).toBeLessThan(1e-6);
    expect(Math.hypot(end.x - 4000, end.y + 1500)).toBeLessThan(1);
  });

  it("pitch, roll, heave and flooding are the same as without it", () => {
    expect(drifting.frames.length).toBe(plain.frames.length);
    expect(drifting.events).toEqual(plain.events);
    drifting.frames.forEach((f, i) => {
      const g = plain.frames[i];
      expect(f.t).toBe(g.t);
      const a = f.bodies[0];
      const b = g.bodies[0];
      expect(Math.abs(a.z - b.z)).toBeLessThan(1e-9);
      expect(Math.abs(a.pitch - b.pitch)).toBeLessThan(1e-9);
      expect(Math.abs(a.roll - b.roll)).toBeLessThan(1e-9);
      f.water.forEach((w, k) =>
        expect(Math.abs(w - g.water[k])).toBeLessThan(1e-9)
      );
    });
  });

  it("loses her way for good at the first floor touch", () => {
    // 8 m of sea: her flooded stern finds the floor.
    const spec = withPath(threeShip({ seaDepthM: 8 }));
    const track = simulate(spec, [{ ...aftHole, areaM2: 1 }], { endT: 1500 });
    const lands = track.events.find((e) => e.kind === "stern-lands");
    expect(lands).toBeDefined();
    expect(lands!.t).toBeLessThan(600);
    const at = sampleTrack(track, lands!.t + 1).bodies[0];
    for (const f of track.frames) {
      if (f.t <= lands!.t + 1) continue;
      const b = f.bodies[0];
      expect(Math.hypot(b.x - at.x, b.y - at.y)).toBeLessThanOrEqual(0.1);
      expect(b.yaw).toBe(at.yaw);
    }
    expect(at.x).toBeLessThan(4000);
  });

  it("toSea follows pathToSea", () => {
    // A shared point at 300 s: the curve to it has only shared neighbours.
    const spec = withPath(threeShip(), {
      path: [[0, 0, 0, 0], [300, 2000, 0, 0], ...PATH.slice(1)],
      pathToSea: [
        [0, 0, 0, 0],
        [300, 2000, 0, 0],
        [600, 4000, 0, 0],
        [1200, 4000, 2000, 90],
      ],
    });
    const land = simulate(spec, [], { endT: 1300 });
    const sea = simulate(spec, [], { endT: 1300, toSea: true });
    const a = sampleTrack(land, 1200).bodies[0];
    const b = sampleTrack(sea, 1200).bodies[0];
    expect(Math.hypot(a.x - 4000, a.y + 1500)).toBeLessThan(1);
    expect(Math.hypot(b.x - 4000, b.y - 2000)).toBeLessThan(1);
    expect(Math.abs(angleDiff(b.yaw, 90 * DEG))).toBeLessThan(1e-6);
    // The same until they part.
    const a3 = sampleTrack(land, 200).bodies[0];
    const b3 = sampleTrack(sea, 200).bodies[0];
    expect(b3.x).toBe(a3.x);
    expect(b3.y).toBe(a3.y);
  });
});
