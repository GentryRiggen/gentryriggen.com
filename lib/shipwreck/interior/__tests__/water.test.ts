import { titanic } from "../../ships/titanic";
import { simulate, type SimTrack } from "../../sim";
import { buildHull } from "../../sim/geometry";
import type { BodyPose } from "../../sim/track";
import type { V2 } from "../../walk/types";
import { compartmentSamples, earthZ, waterLevel } from "../../xray";
import { cabin } from "../kit";
import { TITANIC_INTERIOR } from "../titanic";
import {
  compartmentIndexOf,
  floodsFromSea,
  roomFloorZ,
  roomWaterTarget,
  roomWaterTargets,
} from "../water";
import type { Room } from "../types";

/**
 * The water inside on the real night: the sea's level over each room's
 * floor, against the spec's timeline ("Water inside"). Each check is the
 * spec's time −10 min to the brief's "by" time. One run of the sim (about
 * 0.8 s), shared.
 */

const spec = titanic;
const room = (id: string): Room => {
  const r = TITANIC_INTERIOR.rooms.find((x) => x.id === id);
  if (!r) throw new Error(`no room ${id}`);
  return r;
};

let track: SimTrack;
let brokeAtT: number;
beforeAll(() => {
  track = simulate(spec, spec.realNight);
  brokeAtT = track.brokeAtT as number;
});

/** Clock minutes after midnight (the collision is 11:40 PM). */
function clockMin(t: number): number {
  return (t + spec.clockStartS - 24 * 3600) / 60;
}
const at = (h: number, m: number) => h * 60 + m;

/** Depth of the room's water over its floor at (x, y) (m). */
function depth(r: Room, pose: BodyPose, p: V2): number {
  const level = roomWaterTarget(r, { spec, pose });
  return level - earthZ(pose, p[0], p[1], roomFloorZ(r, p[0], p[1], spec));
}

function centre(r: Room): V2 {
  const xs = r.outline.map((p) => p[0]);
  const ys = r.outline.map((p) => p[1]);
  return [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ];
}

/** Where to look for water in a room: its corners and its middle. */
function probes(r: Room): V2[] {
  return [...r.outline, centre(r)];
}

/** Clock minute the water first reaches `minM` at any of the points, or null. */
function firstWet(r: Room, points: V2[], minM = 0): number | null {
  for (const f of track.frames) {
    if (f.t > brokeAtT) break;
    const pose = f.bodies[0];
    if (points.some((p) => depth(r, pose, p) > minM)) return clockMin(f.t);
  }
  return null;
}

function expectWithin(
  name: string,
  got: number | null,
  specAt: number,
  by: number
) {
  expect([name, got !== null]).toEqual([name, true]);
  if (got === null) return;
  expect([name, got >= specAt - 10 && got <= by]).toEqual([name, true]);
}

describe("water inside on the real night", () => {
  it("breaks at 2:14", () => {
    expect(Math.floor(clockMin(brokeAtT))).toBe(at(2, 14));
  });

  it("wets the third-class cabin by 0:20, waist deep by 0:45", () => {
    const r = room("third-cabin");
    expectWithin(
      "third-cabin wet",
      firstWet(r, probes(r)),
      at(0, 15),
      at(0, 20)
    );
    expectWithin(
      "third-cabin waist",
      firstWet(r, [centre(r)], 1.0),
      at(0, 40),
      at(0, 45)
    );
  });

  it("comes down Scotland Road: forward by 0:25, midships by 1:15, the after end by 2:05", () => {
    const r = room("scotland-road");
    const xs = r.outline.map((p) => p[0]);
    const y = centre(r)[1];
    expectWithin(
      "scotland-road forward",
      firstWet(r, [[Math.max(...xs) - 0.5, y]]),
      at(0, 18),
      at(0, 25)
    );
    expectWithin(
      "scotland-road x 20",
      firstWet(r, [[20, y]]),
      at(1, 8),
      at(1, 15)
    );
    expectWithin(
      "scotland-road after end",
      firstWet(r, [[Math.min(...xs) + 0.5, y]]),
      at(1, 57),
      at(2, 5)
    );
  });

  it("climbs the Grand Staircase: C landing, then the B foyer by 2:12", () => {
    const c = room("gs-c");
    expectWithin("gs-c", firstWet(c, probes(c)), at(2, 5), at(2, 14));
    const b = room("gs-b");
    expectWithin("gs-b", firstWet(b, probes(b)), at(2, 10), at(2, 12));
    // The A foyer last, a moment before the break.
    const a = room("gs-a");
    expectWithin("gs-a", firstWet(a, probes(a)), at(2, 12), at(2, 14));
  });

  it("keeps the Boat deck entrance dry until the break", () => {
    const r = room("gs-boat");
    expect(firstWet(r, probes(r))).toBeNull();
  });
});

describe("a room inside the watertight envelope", () => {
  // Synthetic: the orlop in boiler room 6, well under the bulkhead tops.
  const br6Index = spec.compartments.findIndex((c) => c.id === "br6");
  const br6 = spec.compartments[br6Index];
  const r: Room = {
    ...cabin("orlop-br6", [58, -3], [66, 3]),
    kind: "passage",
    deck: "Orlop",
    ceilingM: 2.3,
    zone: "test",
    look: { finish: "steel", floor: "steel", lamp: "caged-bulb" },
  };
  const samples = compartmentSamples(buildHull(spec), br6);
  const pose = (p: Partial<BodyPose> = {}): BodyPose => ({
    part: "whole",
    x: 0,
    y: 0,
    z: -10,
    pitch: 0,
    roll: 0,
    yaw: 0,
    ...p,
  });

  it("does not flood from the sea, and knows its compartment", () => {
    expect(floodsFromSea(r, spec)).toBe(false);
    expect(compartmentIndexOf(r, spec)).toBe(br6Index);
    expect(floodsFromSea({ ...r, deck: "E" }, spec)).toBe(true);
  });

  it("holds its compartment's level, never above the sea", () => {
    const p = pose();
    const ctx = { spec, pose: p, samples, fill: 0.3 };
    expect(roomWaterTarget(r, ctx)).toBe(waterLevel(samples, p, 0.3));
    expect(roomWaterTarget(r, ctx)).toBeLessThan(0);
    // Dry, and full (her compartment's water stands at the sea outside).
    expect(roomWaterTarget(r, { ...ctx, fill: 0 })).toBe(-Infinity);
    expect(roomWaterTarget(r, { ...ctx, fill: 1 })).toBe(0);
    // Sunk deep: the compartment's level would be over the sea; the sea wins.
    const deep = pose({ z: 0 });
    expect(waterLevel(samples, deep, 0.95)).toBeGreaterThan(0);
    expect(roomWaterTarget(r, { spec, pose: deep, samples, fill: 0.95 })).toBe(
      0
    );
    expect(
      roomWaterTarget(r, { spec, pose: deep, samples, fill: 0.95, seaZ: 0.4 })
    ).toBe(0.4);
  });

  it("stands a sea room at the sea", () => {
    const sr = room("scotland-road");
    expect(roomWaterTarget(sr, { spec, pose: pose() })).toBe(0);
    expect(roomWaterTarget(sr, { spec, pose: pose(), seaZ: 0.25 })).toBe(0.25);
    // An explicit `water` overrides the bulkhead rule.
    expect(
      roomWaterTarget(
        { ...r, water: "sea" },
        { spec, pose: pose(), seaZ: -0.5 }
      )
    ).toBe(-0.5);
  });

  it("caches each compartment's samples for the scene (roomWaterTargets)", () => {
    const target = roomWaterTargets(spec);
    const fill = spec.compartments.map(() => 0);
    const p = pose();
    // A compartment room: its compartment's fill, from the frame's water.
    expect(target(r, p, fill)).toBe(-Infinity);
    fill[br6Index] = 0.3;
    expect(target(r, p, fill)).toBe(waterLevel(samples, p, 0.3));
    // A sea room: the sea, no samples needed.
    expect(target(room("scotland-road"), p, fill)).toBe(0);
    // A missing fill reads as dry, never throws.
    expect(target(r, p, [])).toBe(-Infinity);
  });
});
