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

  it("a listed hull grounds listed", () => {
    // Weight off to starboard: about 20° of list by the time she grounds.
    const { track, lowest } = run(
      longShip({ seaDepthM: SEA, depth: 16, tcg: -0.2 })
    );
    const landsT = eventT(track, "bow-lands")!;
    const atGround = track.frames.find((f) => f.t > landsT)!;
    expect(atGround.listDeg).toBeGreaterThan(15);
    expect(atGround.listDeg).toBeLessThan(35);
    expect(track.outcome).toBe("sank");
    expect(lowest).toBeGreaterThanOrEqual(-SEA - BOW_PLOUGH_M - 0.5);
  });

  it("keeps the list she lands with only if her wreck does", () => {
    // Deep enough that she sinks before she touches, and lands listed.
    const listed = (extra?: Partial<ShipSpec>) =>
      simulate(
        longShip({ seaDepthM: 300, depth: 16, tcg: -0.3, extra }),
        bowHoles
      );
    const onSide = listed({ wreckKeepsList: true });
    const landsT = eventT(onSide, "bow-lands")!;
    const atLanding = onSide.frames.filter((f) => f.t <= landsT).pop()!;
    expect(atLanding.listDeg).toBeGreaterThan(10);
    const rest = onSide.frames[onSide.frames.length - 1];
    expect(onSide.outcome).toBe("sank");
    expect(rest.bodies[0].roll).toBeGreaterThan(0);
    // (the last frame before the landing step, so within a step's turn)
    expect(Math.abs(rest.listDeg - atLanding.listDeg)).toBeLessThan(2);
    // Without the rule: the same fall, the 1.0 rest (upright).
    const upright = listed();
    expect(upright.events).toEqual(onSide.events);
    const end = upright.frames[upright.frames.length - 1];
    expect(Math.abs(end.listDeg)).toBeLessThan(1);
  });
});

describe("headway", () => {
  /** u₀T½/ln2 · (1 − 2^(−t/T½)): the way she carries in t real seconds. */
  const carried = (w: { startMs: number; halfLifeS: number }, t: number) =>
    ((w.startMs * w.halfLifeS) / Math.LN2) *
    (1 - Math.pow(2, -t / w.halfLifeS));

  it("headway moves her forward and decays", () => {
    // Deep sea: she never touches the floor while she has way.
    const way = { startMs: 9, halfLifeS: 120 };
    const deep = longShip();
    const still = simulate(deep, bowHoles);
    const moving = simulate({ ...deep, headway: way }, bowHoles);
    const x = (t: SimTrack, s: number) =>
      t.frames.find((f) => f.t >= s)!.bodies[0].x;
    for (const s of [60, 240, 600]) {
      const f = moving.frames.find((fr) => fr.t >= s)!;
      expect(x(moving, s) - x(still, s)).toBeCloseTo(carried(way, f.realT), 1);
    }
    // Flooding is untouched by it.
    expect(moving.events.map((e) => [e.kind, e.t])).toEqual(
      still.events.map((e) => [e.kind, e.t])
    );
  });

  it("stops for good at the first touch of the floor, through a break", () => {
    // Grounds at about 29 minutes, breaks at about 44 with way still on.
    const way = { startMs: 9, halfLifeS: 2000 };
    const ship = longShip({
      seaDepthM: SEA,
      extra: { girder: { hogMaxNm: 4e9, sagMaxNm: 4e9 } },
    });
    const still = simulate(ship, bowHoles);
    const moving = simulate({ ...ship, headway: way }, bowHoles);
    const lands = moving.events.find((e) => e.kind === "bow-lands")!;
    const broke = moving.events.find((e) => e.kind === "breakup")!;
    expect(broke.t).toBeGreaterThan(lands.t + 60);
    // The way she had until her first touch: the step that touched (it
    // starts at the event's time) still carried her.
    const k = moving.frames.findIndex((f) => f.t > lands.t);
    const at = moving.frames[k];
    const offset = at.bodies[0].x - still.frames[k].bodies[0].x;
    expect(Math.abs(offset - carried(way, at.realT))).toBeLessThan(1);
    // After it, every part keeps exactly that offset: no more way, and none
    // again after the break.
    let after = 0;
    for (let i = k; i < moving.frames.length; i += 1) {
      const m = moving.frames[i];
      const s = still.frames[i];
      expect(m.bodies.map((p) => p.part)).toEqual(s.bodies.map((p) => p.part));
      for (let j = 0; j < m.bodies.length; j += 1)
        if (Math.abs(m.bodies[j].x - s.bodies[j].x - offset) > 1e-6) after += 1;
    }
    expect(after).toBe(0);
    expect(moving.frames.length).toBe(still.frames.length);
  });

  it("the Titanic has none", () => {
    expect(titanic.headway).toBeUndefined();
  });
});
