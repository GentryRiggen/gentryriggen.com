import { eventsBetween, sampleTrack } from "../track";
import type { BodyPose, SimFrame, SimTrack } from "../track";

function pose(part: BodyPose["part"], z: number, yaw = 0): BodyPose {
  return { part, x: 0, y: 0, z, pitch: z / 100, roll: 0, yaw };
}

function frame(t: number, bodies: BodyPose[], water = 0): SimFrame {
  return {
    t,
    realT: t,
    bodies,
    water: [water, water / 2],
    waterAboardT: water * 1000,
    trimDeg: t,
    listDeg: 0,
    power: 1,
    groundedParts: [],
  };
}

const track: SimTrack = {
  frames: [
    frame(0, [pose("whole", -10)], 0),
    frame(1, [pose("whole", -12, 3)], 1),
    frame(2, [pose("stern", -14, -3), pose("bow", -20)], 1),
    frame(3, [pose("stern", -16, -3), pose("bow", -30)], 1),
  ],
  events: [
    { t: 0, realT: 0, kind: "collision" },
    { t: 1, realT: 1, kind: "rocket", index: 0 },
    { t: 2, realT: 2, kind: "breakup" },
    { t: 2, realT: 2, kind: "lights-out" },
  ],
  outcome: "sank",
  sankAtT: 3,
  brokeAtT: 2,
  breakX: -27,
  endT: 3,
};

describe("sampleTrack", () => {
  it("returns the frames themselves at their times", () => {
    expect(sampleTrack(track, 1)).toBe(track.frames[1]);
    expect(sampleTrack(track, 3)).toBe(track.frames[3]);
  });

  it("clamps before the start and after the end", () => {
    expect(sampleTrack(track, -5)).toBe(track.frames[0]);
    expect(sampleTrack(track, 99)).toBe(track.frames[3]);
  });

  it("interpolates positions, water and HUD values", () => {
    const f = sampleTrack(track, 0.25);
    expect(f.t).toBe(0.25);
    expect(f.bodies[0].z).toBeCloseTo(-10.5, 9);
    expect(f.bodies[0].pitch).toBeCloseTo(-0.105, 9);
    expect(f.water).toEqual([0.25, 0.125]);
    expect(f.waterAboardT).toBeCloseTo(250, 9);
    expect(f.trimDeg).toBeCloseTo(0.25, 9);
  });

  it("turns angles the short way round", () => {
    // yaw 3 -> -3 rad is 0.28 rad through ±π, not 6 rad back through 0.
    const f = sampleTrack(track, 1.5);
    expect(f.bodies).toBe(track.frames[2].bodies); // parts changed: no blend
    const g = sampleTrack(track, 2.5);
    expect(g.bodies[0].yaw).toBeCloseTo(-3, 9);
    const twoWay: SimTrack = {
      ...track,
      frames: [
        frame(0, [pose("whole", 0, 3)]),
        frame(1, [pose("whole", 0, -3)]),
      ],
    };
    const mid = sampleTrack(twoWay, 0.5).bodies[0].yaw;
    expect(Math.abs(Math.abs(mid) - Math.PI)).toBeLessThan(1e-9);
  });

  it("takes the nearer frame's bodies when the parts change", () => {
    expect(sampleTrack(track, 1.2).bodies).toBe(track.frames[1].bodies);
    expect(sampleTrack(track, 1.8).bodies).toBe(track.frames[2].bodies);
  });
});

it("refuses a track with no frames", () => {
  expect(() => sampleTrack({ ...track, frames: [] }, 0)).toThrow(/no frames/);
});

describe("eventsBetween", () => {
  it("is (t0, t1]: after t0, up to and including t1", () => {
    expect(eventsBetween(track, -1, 0).map((e) => e.kind)).toEqual([
      "collision",
    ]);
    expect(eventsBetween(track, 0, 1).map((e) => e.kind)).toEqual(["rocket"]);
    expect(eventsBetween(track, 1, 2).map((e) => e.kind)).toEqual([
      "breakup",
      "lights-out",
    ]);
    expect(eventsBetween(track, 2, 3)).toEqual([]);
  });

  it("is empty for an empty or backward window", () => {
    expect(eventsBetween(track, 1, 1)).toEqual([]);
    expect(eventsBetween(track, 2, 0)).toEqual([]);
  });

  it("covers everything across consecutive windows exactly once", () => {
    const seen = [
      ...eventsBetween(track, -1, 0.5),
      ...eventsBetween(track, 0.5, 2),
      ...eventsBetween(track, 2, 10),
    ];
    expect(seen).toEqual(track.events);
  });
});
