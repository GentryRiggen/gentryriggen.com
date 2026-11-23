import { concordia } from "../../ships";
import { END_T } from "../constants";
import {
  type SimOptions,
  simulate,
  whatIfOpenings,
  whatIfRealIds,
  whatIfSpots,
} from "../run";
import type { SimTrack } from "../track";

/**
 * The Costa Concordia's What if (spec "What if", R15–R17): her watertight
 * compartments along her port side, the real five WTC 4–8, and "Blown out
 * to sea". Built for any two neighbouring compartments flooded [MIT
 * §4.7.8]; any three neighbouring among 4–8 she survives [MIT §4.7.10];
 * the real five in deep water capsize her [MIT §4.7.10].
 */

const spots = whatIfSpots(concordia);
const runs = new Map<string, SimTrack>();
function run(ids: readonly string[], opts: SimOptions = {}): SimTrack {
  const key = `${ids.join(",")}|${opts.toSea ? "sea" : ""}`;
  let t = runs.get(key);
  if (!t) {
    t = simulate(concordia, whatIfOpenings(concordia, ids), opts);
    runs.set(key, t);
  }
  return t;
}

function sound(t: SimTrack): void {
  expect(["floated", "sank", "aground"]).toContain(t.outcome);
  expect(t.endT).toBeLessThanOrEqual(END_T + 1e-6);
  const last = t.frames[t.frames.length - 1];
  expect(last.t).toBeLessThanOrEqual(t.endT + 1e-6);
  for (const f of t.frames)
    for (const p of f.bodies)
      for (const v of [p.x, p.y, p.z, p.pitch, p.roll, p.yaw])
        expect(Number.isFinite(v)).toBe(true);
}

const kinds = (t: SimTrack) => t.events.map((e) => e.kind);

describe("the Costa Concordia's What if", () => {
  it("offers her compartments, the real five WTC 4–8", () => {
    expect(spots).toEqual(concordia.compartments.map((c) => c.id));
    expect(whatIfRealIds(concordia).sort()).toEqual(
      ["wtc4", "wtc5", "wtc6", "wtc7", "wtc8"].sort()
    );
    // Her real five give exactly her real night.
    expect(whatIfOpenings(concordia, whatIfRealIds(concordia))).toEqual(
      expect.arrayContaining([...concordia.realNight])
    );
    // A compartment the real night did not tear gets her own gash, port.
    const [o] = whatIfOpenings(concordia, ["wtc12"]);
    expect(o).toMatchObject({
      compartmentId: "wtc12",
      side: "port",
      areaM2: concordia.gash!.areaM2,
    });
  });

  it.each(spots)("floats with %s alone", (id) => {
    const t = run([id]);
    sound(t);
    expect(t.outcome).toBe("floated");
  });

  it.each(spots.slice(0, -1).map((id, i) => [id, spots[i + 1]]))(
    "floats with %s and %s (built for two)",
    (a, b) => {
      const t = run([a, b]);
      sound(t);
      expect(t.outcome).toBe("floated");
    }
  );

  it.each([
    ["wtc4", "wtc5", "wtc6"],
    ["wtc5", "wtc6", "wtc7"],
    ["wtc6", "wtc7", "wtc8"],
  ])("floats with %s, %s and %s [MIT §4.7.10]", (a, b, c) => {
    const t = run([a, b, c]);
    sound(t);
    expect(t.outcome).toBe("floated");
  });

  it("blown out to sea with the real five, she sinks in deep water (R16)", () => {
    const t = run(whatIfRealIds(concordia), { toSea: true });
    sound(t);
    expect(t.outcome).toBe("sank");
    expect(kinds(t)).not.toContain("aground");
  });

  it("blown out to sea with two compartments, she floats", () => {
    const t = run(["wtc5", "wtc6"], { toSea: true });
    sound(t);
    expect(t.outcome).toBe("floated");
  });

  it("with no spots she misses the rocks: no water, no blackout, afloat", () => {
    expect(whatIfOpenings(concordia, [])).toEqual([]);
    const t = run([]);
    sound(t);
    expect(t.outcome).toBe("floated");
    expect(kinds(t)).not.toContain("lights-out");
    for (const f of t.frames) expect(f.waterAboardT).toBe(0);
    // No strike, no abandoning ship: she sails safely past.
    expect(kinds(t)).not.toContain("collision");
    expect(kinds(t)).not.toContain("boat-lowered");
    expect(kinds(t)).not.toContain("last-boat");
  });

  it("her real holes copied are her real night: the door opens", () => {
    // The door rule matches holes by compartment and x, not identity.
    const copied = concordia.realNight.map((o) => ({ ...o }));
    const endT = 1200;
    const real = simulate(concordia, concordia.realNight, { endT });
    expect(simulate(concordia, copied, { endT })).toEqual(real);
    // (The door matters by then: shut, the run differs.)
    expect(
      simulate(concordia, concordia.realNight, { endT, doorsClosed: true })
    ).not.toEqual(real);
  });

  it("keeps her lights and her way when WTC 5 and 6 stay whole", () => {
    const sets = [[], ["wtc4"], ["wtc7"], ["wtc7", "wtc8"], ["wtc3", "wtc4"]];
    for (const ids of sets) {
      const t = run(ids);
      expect(kinds(t)).not.toContain("lights-out");
      for (const f of t.frames) expect(f.power).toBe(1);
      // Her way: on north at her 15.5 kn, no drift back to the island.
      const at = (s: number) => t.frames.find((f) => f.t >= s)!.bodies[0];
      const kn = (at(1200).x - at(600).x) / 600 / (1852 / 3600);
      expect(kn).toBeGreaterThan(14);
      expect(Math.abs(at(1200).yaw)).toBeLessThan(1e-9);
      // Under her own power she does not abandon ship.
      expect(kinds(t)).not.toContain("boat-lowered");
      expect(kinds(t).includes("collision")).toBe(ids.length > 0);
    }
  });
});
