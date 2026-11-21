import { titanic } from "../../ships";
import { simulate, whatIfOpenings } from "../run";
import type { SimTrack } from "../track";

/**
 * Whatever the player opens, a run ends one of two honest ways: afloat and
 * steady at 6:00 AM, or sunk with every part resting on the floor. Never a
 * hull hanging in the water on trapped air.
 */
const ids = titanic.compartments.map((c) => c.id);
const DEG = Math.PI / 180;

function expectSettled(track: SimTrack) {
  const last = track.frames[track.frames.length - 1];
  if (track.outcome === "floated") {
    expect(last.bodies).toHaveLength(1);
    const b = last.bodies[0];
    expect(Math.abs(b.pitch)).toBeLessThan(10 * DEG);
    expect(Math.abs(b.roll)).toBeLessThan(10 * DEG);
    // Steady: no motion over the last ten minutes.
    const earlier = track.frames[track.frames.length - 601].bodies[0];
    expect(Math.abs(earlier.z - b.z)).toBeLessThan(0.05);
    expect(Math.abs(earlier.pitch - b.pitch)).toBeLessThan(0.002);
  } else {
    expect(track.sankAtT).not.toBeNull();
    // Every part that went down lands: an intact hull logs both.
    const kinds = track.events.map((e) => e.kind);
    expect(kinds).toContain("bow-lands");
    expect(kinds).toContain("stern-lands");
    for (const b of last.bodies) {
      expect(b.z).toBeLessThan(-titanic.seaDepthM + 40);
      expect(Math.abs(b.pitch)).toBeLessThan(10 * DEG);
    }
  }
}

const cases: [string, string[]][] = [
  ...ids.map((id): [string, string[]] => [id, [id]]),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((k): [string, string[]] => [
    `first ${k} forward`,
    ids.slice(-k),
  ]),
  ["hold 2, boiler room 4, engine room", ["hold2", "br4", "engine"]],
  [
    "front peak, boiler rooms 6 and 3, turbine, back tunnel",
    ["fore-peak", "br6", "br3", "turbine", "tunnel-2"],
  ],
  [
    "boiler rooms 1 and 2 and all three engine spaces",
    ["br1", "br2", "engine", "turbine", "dynamo"],
  ],
];

describe("every What-if ends settled", () => {
  it.each(cases)("%s", (_, open) => {
    expectSettled(simulate(titanic, whatIfOpenings(titanic, open)));
  });
});
