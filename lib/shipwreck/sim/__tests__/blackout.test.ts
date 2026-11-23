import type { Opening, ShipSpec } from "../../ships/types";
import type { Body } from "../body";
import { DYNAMO_FLOOD_M } from "../events";
import { simulate } from "../run";
import type { SimTrack } from "../track";
import { compartment, threeShip } from "./testShips";

/**
 * The blackout from the water (`ShipSpec.blackout`, a rule with a
 * calibrated threshold): the lights go out the step the named space's
 * water reaches `depthM`, then her power is her emergency lighting, never
 * 0, and her pumps stop. Without it the 1.0 dynamo rule stands.
 */

const holeB: Opening = {
  compartmentId: "B",
  areaM2: 1,
  zLow: 0.5,
  zHigh: 1.5,
  x: 0,
  side: "port",
};
/** A small leak aft the pumps keep down while they run. */
const leakA: Opening = {
  compartmentId: "A",
  areaM2: 0.01,
  zLow: 0.5,
  zHigh: 1,
  x: -40,
  side: "port",
};

const lit = (more: Partial<ShipSpec> = {}): ShipSpec => ({
  ...threeShip(),
  pumpsM3s: 0.5,
  blackout: { compartmentId: "B", depthM: 2, emergencyLight: 0.25 },
  ...more,
});

function eventT(track: SimTrack, kind: string): number | undefined {
  return track.events.find((e) => e.kind === kind)?.t;
}

describe("the blackout from the water", () => {
  let track: SimTrack;
  let reached: number | null = null;
  const waterA: { t: number; w: number }[] = [];
  beforeAll(() => {
    track = simulate(lit(), [holeB, leakA], {
      endT: 1800,
      probe: (p) => {
        const b = p.bodies[0] as Body;
        const c = b.cells[1];
        if (reached === null && c.water > 0 && c.level - c.zMin >= 2)
          reached = p.t;
        waterA.push({ t: p.t, w: b.cells[0].water });
      },
    });
  });

  it("goes out the step the space's water is that deep", () => {
    const out = eventT(track, "lights-out");
    expect(out).toBeDefined();
    expect(reached).not.toBeNull();
    expect(out).toBe(reached);
    expect(track.events.filter((e) => e.kind === "lights-out")).toHaveLength(1);
  });

  it("leaves her emergency lights on, never dark", () => {
    const out = eventT(track, "lights-out") as number;
    for (const f of track.frames) {
      if (f.t < out) expect(f.power).toBe(1);
      else if (f.t > out + 1) expect(f.power).toBe(0.25);
      expect(f.power).toBeGreaterThan(0);
    }
  });

  it("stops her pumps", () => {
    const out = eventT(track, "lights-out") as number;
    const before = waterA.filter((s) => s.t < out);
    const after = waterA.filter((s) => s.t > out + 300);
    expect(Math.max(...before.map((s) => s.w))).toBeLessThan(1);
    expect(after[after.length - 1].w).toBeGreaterThan(50);
  });

  it("replaces the dynamo rule; without it the dynamo rule stands", () => {
    // C is her engine room, flooded deep; B (named) stays dry.
    const comps = threeShip().compartments.map((c) =>
      c.id === "C" ? compartment("C", 20, 60, 12, { kind: "engine" }) : c
    );
    const holeC: Opening = { ...holeB, compartmentId: "C", x: 40 };
    const dynamo = simulate({ ...threeShip(), compartments: comps }, [holeC], {
      endT: 1200,
    });
    expect(eventT(dynamo, "lights-out")).toBeDefined();
    const deep = dynamo.frames.find((f) => f.power === 0);
    expect(deep).toBeDefined();
    expect(DYNAMO_FLOOD_M).toBe(4);
    const named = simulate(lit({ compartments: comps }), [holeC], {
      endT: 1200,
    });
    expect(eventT(named, "lights-out")).toBeUndefined();
    expect(named.frames.every((f) => f.power === 1)).toBe(true);
  });

  it("names a compartment she has, or the run refuses", () => {
    const wrong = lit();
    wrong.blackout = { ...wrong.blackout!, compartmentId: "nowhere" };
    expect(() => simulate(wrong, [holeB], { endT: 10 })).toThrow(/nowhere/);
  });
});
