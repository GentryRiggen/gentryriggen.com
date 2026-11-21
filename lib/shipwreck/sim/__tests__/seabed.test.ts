import { titanic } from "../../ships";
import type { Opening, ShipSpec } from "../../ships/types";
import { BOW_PLOUGH_M, END_T } from "../constants";
import { simulate } from "../run";
import type { BodyPose, SimTrack } from "../track";
import { longShip } from "./testShips";

/**
 * The sea floor under a ship still afloat: a 200 m box flooded at the bow
 * in 60 m of sea grounds its bow while its stern still floats (the
 * Lusitania in 93 m), settles about it, and comes to rest. And headway.
 */

const SEA = 60;
const bowHoles: Opening[] = [
  {
    compartmentId: "h9",
    areaM2: 1.5,
    zLow: 1,
    zHigh: 4,
    x: 90,
    side: "starboard",
  },
  {
    compartmentId: "h8",
    areaM2: 1,
    zLow: 1,
    zHigh: 4,
    x: 70,
    side: "starboard",
  },
];

/** Earth z of a ship-frame point for a pose (Rz·Ry·Rx; z needs no yaw). */
function earthZ(p: BodyPose, x: number, y: number, z: number): number {
  const cp = Math.cos(p.pitch);
  return (
    p.z -
    Math.sin(p.pitch) * x +
    cp * Math.sin(p.roll) * y +
    cp * Math.cos(p.roll) * z
  );
}

function run(spec: ShipSpec): { track: SimTrack; lowest: number } {
  let lowest = Infinity;
  const track = simulate(spec, bowHoles, {
    probe: (p) => {
      lowest = Math.min(lowest, p.lowestZ);
    },
  });
  return { track, lowest };
}

function eventT(track: SimTrack, kind: string): number | undefined {
  return track.events.find((e) => e.kind === kind)?.t;
}

describe("the sea floor under a ship afloat", () => {
  const upright = longShip({ seaDepthM: SEA });
  let level: { track: SimTrack; lowest: number };
  beforeAll(() => {
    level = run(upright);
  });

  it("the bow grounds while the stern still floats", () => {
    const { track } = level;
    const landsT = eventT(track, "bow-lands");
    expect(landsT).toBeDefined();
    const underT = eventT(track, "stern-under");
    expect(underT === undefined || underT > landsT!).toBe(true);
    // Events carry the time at the start of their step; the first frame
    // after it shows the contact.
    const f = track.frames.find((fr) => fr.t > landsT!)!;
    expect(f.groundedParts).toContain("whole");
    const pose = f.bodies[0];
    expect(pose.part).toBe("whole");
    // The stern's deck is still in the air.
    const sternDeck = earthZ(pose, -upright.lbp / 2, 0, upright.depth);
    expect(sternDeck).toBeGreaterThan(0);
    // Nothing touched before the bow did.
    const before = track.frames.filter((fr) => fr.t <= landsT!);
    expect(before.every((fr) => fr.groundedParts.length === 0)).toBe(true);
  });

  it("nothing goes through the floor", () => {
    expect(level.lowest).toBeGreaterThanOrEqual(-SEA - BOW_PLOUGH_M - 0.5);
    // Afloat, the mud only gives a few metres.
    const { track } = level;
    expect(track.frames.length).toBeGreaterThan(100);
  });

  it("a grounded hull comes to rest", () => {
    const { track } = level;
    expect(["sank", "floated"]).toContain(track.outcome);
    expect(track.endT).toBeLessThanOrEqual(END_T);
    for (const f of track.frames)
      for (const b of f.bodies)
        for (const v of [b.x, b.y, b.z, b.pitch, b.roll, b.yaw])
          expect(Number.isFinite(v)).toBe(true);
    const end = track.frames[track.frames.length - 1];
    expect(end.groundedParts).toContain("whole");
    // Upright before the floor: upright on it.
    expect(Math.abs(end.listDeg)).toBeLessThan(5);
  });

  it("a listed hull lies over on its low side", () => {
    // Weight off to starboard: about 20° of list by the time she grounds.
    const { track, lowest } = run(
      longShip({ seaDepthM: SEA, depth: 16, tcg: -0.2 })
    );
    const landsT = eventT(track, "bow-lands")!;
    const atGround = track.frames.find((f) => f.t > landsT)!;
    expect(atGround.listDeg).toBeGreaterThan(15);
    expect(atGround.listDeg).toBeLessThan(35);
    const rest = track.frames[track.frames.length - 1];
    expect(track.outcome).toBe("sank");
    expect(rest.bodies[0].roll).toBeGreaterThan(0);
    expect(rest.listDeg).toBeGreaterThan(atGround.listDeg + 20);
    expect(lowest).toBeGreaterThanOrEqual(-SEA - BOW_PLOUGH_M - 0.5);
  });
});

describe("headway", () => {
  it("headway moves her forward and decays", () => {
    const way = { startMs: 9, halfLifeS: 120 };
    const still = level0();
    const moving = simulate(
      { ...longShip({ seaDepthM: SEA }), headway: way },
      bowHoles
    );
    const expected = (way.startMs * way.halfLifeS) / Math.LN2;
    const last = (t: SimTrack) => t.frames[t.frames.length - 1].bodies[0].x;
    const run = last(moving) - last(still);
    expect(run).toBeGreaterThan(expected * 0.9);
    expect(run).toBeLessThan(expected * 1.1);
    // Most of it in the first few half-lives.
    const at = (t: SimTrack, s: number) =>
      t.frames.find((f) => f.t >= s)!.bodies[0].x;
    expect(at(moving, 240) - at(still, 240)).toBeGreaterThan(expected * 0.7);
    // Flooding is untouched by it.
    expect(moving.events.map((e) => [e.kind, e.t])).toEqual(
      still.events.map((e) => [e.kind, e.t])
    );
  });

  it("the Titanic has none", () => {
    expect(titanic.headway).toBeUndefined();
  });
});

function level0(): SimTrack {
  return simulate(longShip({ seaDepthM: SEA }), bowHoles);
}
