import type { Opening, SeabedSpec, ShipSpec } from "../../ships/types";
import { type Body, earthOf } from "../body";
import { simulate } from "../run";
import { floorAt } from "../seabed";
import type { SimTrack } from "../track";
import { boxShip, compartment, towerShip } from "./testShips";

/**
 * A floor that varies with position (`ShipSpec.seabed`): `floorAt` is the
 * flat floor at `seaDepthM` without one; with a straight shore and a
 * profile it is the profile's depth at the distance offshore, lifted by a
 * rock bump inside its radius. The sim's floor contact reads it under each
 * hull point: a ship drifting toward the shelf touches first where her
 * hull is deepest (her flooded stern), at the floor under that point, and
 * holds there; one sinking past the shelf lands on the deep floor under it.
 */

/** A straight shore along earth x at y = `y`, the sea at smaller y. */
function shore(y: number, more: Partial<SeabedSpec> = {}): SeabedSpec {
  return {
    shore: [
      [-5000, y],
      [5000, y],
    ],
    seaSide: -1,
    profile: [
      [0, 0],
      [100, 25],
      [300, 100],
    ],
    ...more,
  };
}

/** Earth position of the body's lowest hull point. */
function lowest(b: Body): [number, number, number] {
  const p = b.floorPts;
  let best: [number, number, number] = [0, 0, Infinity];
  for (let k = 0; k < p.length; k += 4) {
    const e = earthOf(b, p[k], p[k + 1], p[k + 2]);
    if (e[2] < best[2]) best = e;
  }
  return best;
}

/**
 * The body's hull point deepest into the floor (earth position and how far
 * in, m): where a sloping floor touches it, not always its lowest point.
 */
function touching(
  b: Body,
  spec: ShipSpec
): { at: [number, number, number]; depth: number } {
  const p = b.floorPts;
  let best = { at: [0, 0, 0] as [number, number, number], depth: -Infinity };
  for (let k = 0; k < p.length; k += 4) {
    const e = earthOf(b, p[k], p[k + 1], p[k + 2]);
    const d = floorAt(spec, e[0], e[1]) - e[2];
    if (d > best.depth) best = { at: e, depth: d };
  }
  return best;
}

function eventT(track: SimTrack, kind: string): number | undefined {
  return track.events.find((e) => e.kind === kind)?.t;
}

describe("floorAt", () => {
  const flat = boxShip({
    length: 100,
    beam: 20,
    depth: 10,
    draught: 5,
    kg: 6,
    seaDepthM: 1234,
    compartments: [compartment("a", -50, 50, 10)],
  });

  it("is the flat floor at seaDepthM everywhere without a seabed", () => {
    for (const [x, y] of [
      [0, 0],
      [5000, -3000],
      [-1e6, 1e6],
    ])
      expect(floorAt(flat, x, y)).toBe(-1234);
  });

  it("follows the profile offshore of a straight shore", () => {
    const spec: ShipSpec = { ...flat, seabed: shore(500) };
    expect(floorAt(spec, 0, 400)).toBeCloseTo(-25, 9);
    expect(floorAt(spec, 1234, 300)).toBeCloseTo(-62.5, 9);
    expect(floorAt(spec, 0, 450)).toBeCloseTo(-12.5, 9);
    expect(floorAt(spec, 0, -1000)).toBeCloseTo(-100, 9);
    // Ashore: the profile's first depth.
    expect(floorAt(spec, 0, 600)).toBeCloseTo(0, 9);
  });

  it("a rock bump lifts the floor inside its radius only", () => {
    const spec: ShipSpec = {
      ...flat,
      seabed: shore(500, {
        rocks: [{ x: 0, y: 300, radiusM: 20, topDepthM: 5 }],
      }),
    };
    expect(floorAt(spec, 0, 300)).toBeCloseTo(-5, 9);
    // Half way out: a quarter of the way from its top to the profile.
    const half = floorAt(spec, 10, 300);
    expect(half).toBeCloseTo(-(5 + 0.25 * (62.5 - 5)), 9);
    expect(floorAt(spec, 25, 300)).toBeCloseTo(-62.5, 9);
    expect(floorAt(spec, 0, 270)).toBeCloseTo(floorAt(spec, 1000, 270), 9);
  });
});

describe("the sim on a sloping floor", () => {
  // The tower ship, flooded aft, drifting sideways toward a shore 700 m
  // to port: the floor rises under her as she goes.
  const aftHoles: Opening[] = [
    {
      compartmentId: "h0",
      areaM2: 2,
      zLow: 1,
      zHigh: 3,
      x: -90,
      side: "port",
    },
    {
      compartmentId: "h1",
      areaM2: 2,
      zLow: 1,
      zHigh: 3,
      x: -70,
      side: "port",
    },
  ];
  const drifting = towerShip({
    extra: {
      seabed: shore(700),
      headway: {
        startMs: 0,
        path: [
          [0, 0, 0, 0],
          [1800, 0, 660, 0],
        ],
      },
    },
  });
  let track: SimTrack;
  const contact: {
    t: number;
    touch: ReturnType<typeof touching>;
  }[] = [];
  const poses: { t: number; x: number; y: number }[] = [];
  beforeAll(() => {
    track = simulate(drifting, aftHoles, {
      // She lands at about 1,600 s; 600 s held still after it, and a margin.
      endT: 2400,
      probe: (p) => {
        const b = p.bodies[0] as Body;
        poses.push({ t: p.t, x: b.x, y: b.y });
        // Only the first contact is read (each costs a pass over her hull).
        if (b.grounded && contact.length === 0)
          contact.push({ t: p.t, touch: touching(b, drifting) });
      },
    });
  });

  it("touches first at her stern, at the floor under that point", () => {
    const lands = eventT(track, "stern-lands");
    expect(lands).toBeDefined();
    expect(eventT(track, "bow-lands")).toBeUndefined();
    const first = contact[0];
    // Events carry the time at the start of their step; probes its end.
    expect(first.t).toBeGreaterThan(lands as number);
    expect(first.t).toBeLessThanOrEqual((lands as number) + 1);
    const [x, y, z] = first.touch.at;
    expect(x).toBeLessThan(0);
    const floor = floorAt(drifting, x, y);
    // On the slope, not the 3,000 m of the flat floor; just into it.
    expect(floor).toBeGreaterThan(-100);
    expect(floor).toBeLessThan(-7);
    expect(first.touch.depth).toBeGreaterThan(0);
    expect(first.touch.depth).toBeLessThan(0.5);
    expect(Math.abs(z - floor)).toBeLessThan(0.5);
  });

  it("loses her way there and holds still on the contact", () => {
    const lands = eventT(track, "stern-lands") as number;
    const at = poses.find((p) => p.t >= lands + 1) as (typeof poses)[number];
    const later = poses.filter((p) => p.t > at.t && p.t <= at.t + 600);
    expect(later.length).toBeGreaterThan(100);
    for (const p of later)
      expect(Math.hypot(p.x - at.x, p.y - at.y)).toBeLessThanOrEqual(0.1);
    // Short of where the path would have taken her.
    expect(at.y).toBeLessThan(660 - 10);
  });

  it("sinking past the shelf, a ship lands on the deep floor under it", () => {
    // Every hold open: she goes under 400 m off, over the 100 m deep.
    const box = boxShip({
      length: 100,
      beam: 16,
      depth: 10,
      draught: 5,
      kg: 6,
      compartments: Array.from({ length: 5 }, (_, i) =>
        compartment(`s${i}`, -50 + 20 * i, -30 + 20 * i, 10)
      ),
      extra: { seabed: shore(400) },
    });
    const holes: Opening[] = box.compartments.map((c) => ({
      compartmentId: c.id,
      areaM2: 3,
      zLow: 0.5,
      zHigh: 2,
      x: (c.fromX + c.toX) / 2,
      side: "starboard",
    }));
    let low: [number, number, number] = [0, 0, 0];
    const run = simulate(box, holes, {
      probe: (p) => {
        low = lowest(p.bodies[0] as Body);
      },
    });
    expect(run.outcome).toBe("sank");
    expect(floorAt(box, low[0], low[1])).toBeCloseTo(-100, 6);
    // As deep in the mud as on a flat floor 100 m down (its bow ploughs in).
    let flatLow = 0;
    simulate({ ...box, seabed: undefined, seaDepthM: 100 }, holes, {
      probe: (p) => {
        flatLow = p.lowestZ;
      },
    });
    expect(low[2]).toBeCloseTo(flatLow, 6);
    expect(low[2]).toBeLessThan(-100);
  });
});
