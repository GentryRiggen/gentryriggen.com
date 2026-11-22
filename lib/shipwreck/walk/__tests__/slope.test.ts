import type { BodyPose } from "../../sim/track";
import { deckSlope, earthToShip, gravityInShip, shipToEarth } from "../slope";

const DEG = Math.PI / 180;

function pose(p: Partial<BodyPose> = {}): BodyPose {
  return {
    part: "whole",
    x: 0,
    y: 0,
    z: -9.8,
    pitch: 0,
    roll: 0,
    yaw: 0,
    ...p,
  };
}

describe("deckSlope", () => {
  it("is flat on a level ship", () => {
    const s = deckSlope(pose());
    expect(s.deg).toBeCloseTo(0, 9);
    expect(gravityInShip(pose())).toEqual([0, -0, -1]);
  });

  it("runs downhill to the bow when she is down by the head", () => {
    const s = deckSlope(pose({ pitch: 15 * DEG }));
    expect(s.deg).toBeCloseTo(15, 6);
    expect(s.downhill[0]).toBeCloseTo(1, 9);
    expect(s.downhill[1]).toBeCloseTo(0, 9);
  });

  it("runs downhill to starboard when she lists to starboard", () => {
    const s = deckSlope(pose({ roll: 25 * DEG }));
    expect(s.deg).toBeCloseTo(25, 6);
    expect(s.downhill[0]).toBeCloseTo(0, 9);
    expect(s.downhill[1]).toBeCloseTo(-1, 9);
  });

  it("ignores her heading", () => {
    const a = deckSlope(pose({ pitch: 12 * DEG, roll: 7 * DEG }));
    const b = deckSlope(pose({ pitch: 12 * DEG, roll: 7 * DEG, yaw: 2 }));
    expect(b.deg).toBeCloseTo(a.deg, 9);
    expect(b.downhill[0]).toBeCloseTo(a.downhill[0], 9);
    expect(b.downhill[1]).toBeCloseTo(a.downhill[1], 9);
  });

  it("gives a unit gravity", () => {
    const g = gravityInShip(pose({ pitch: 0.4, roll: -0.9, yaw: 1 }));
    expect(Math.hypot(...g)).toBeCloseTo(1, 12);
  });
});

describe("shipToEarth", () => {
  it("lowers the bow when she pitches bow down and the port side when she lists to port", () => {
    const p = pose({ pitch: 10 * DEG });
    expect(shipToEarth(p, [100, 0, 0])[2]).toBeLessThan(p.z);
    const q = pose({ roll: -10 * DEG });
    expect(shipToEarth(q, [0, 10, 0])[2]).toBeLessThan(q.z);
  });

  it("is undone by earthToShip", () => {
    const p = pose({ x: 30, y: -12, z: -4, pitch: 0.3, roll: -0.7, yaw: 2.1 });
    const s = [42, -7, 25] as const;
    const back = earthToShip(p, shipToEarth(p, s));
    for (let i = 0; i < 3; i += 1) expect(back[i]).toBeCloseTo(s[i], 9);
  });
});
