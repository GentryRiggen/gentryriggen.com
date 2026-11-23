import { carpathia } from "../../ships";
import { END_T } from "../constants";
import {
  FINISHER_SPOT,
  simulate,
  torpedoHits,
  whatIfOpenings,
  whatIfSpots,
} from "../run";
import type { SimTrack } from "../track";
import { storyEndT } from "../../story";

/** Shown seconds after 9:15 AM: 11:30 AM, and 2:30 PM for a run with the
 *  boiler room hit (her coal bunkers' doors pass water for hours). */
const STEADY_BY = 2 * 3600 + 15 * 60;
const BOILER_STEADY_BY = 5 * 3600 + 15 * 60;

/**
 * The Carpathia's What-if matrix (sims lane: about a minute of runs):
 * every single spot, every pair, all nine, each with and without the
 * U-boat's return, and the return alone. Every run is finite and ends
 * inside END_T, afloat and logged steady (by 11:30 AM, or 2:30 PM with the
 * boiler room hit) or with every part on the floor; no single torpedo
 * sinks her sooner than her real morning; three or more hits sink her no
 * later than the same set's first two.
 */

const spots = whatIfSpots(carpathia).filter((id) => id !== FINISHER_SPOT);

const sets: string[][] = [];
for (const a of spots) sets.push([a]);
for (let i = 0; i < spots.length; i += 1)
  for (let j = i + 1; j < spots.length; j += 1) sets.push([spots[i], spots[j]]);
sets.push([...spots]);
const cases: string[][] = [
  ...sets,
  ...sets.map((s) => [...s, FINISHER_SPOT]),
  [FINISHER_SPOT],
];

const runs = new Map<string, SimTrack>();
function run(ids: readonly string[]): SimTrack {
  const key = ids.join("+");
  let track = runs.get(key);
  if (!track) {
    track = simulate(carpathia, whatIfOpenings(carpathia, ids));
    runs.set(key, track);
  }
  return track;
}
const sank = (track: SimTrack) => track.sankAtT ?? Infinity;

/** The chosen compartment spots in the order her torpedoes land them. */
function landingOrder(ids: readonly string[]): string[] {
  const x = (id: string) => torpedoHits(carpathia, [id])[0].x;
  return ids
    .filter((id) => id !== FINISHER_SPOT)
    .slice()
    .sort((a, b) => x(b) - x(a));
}

describe("the Carpathia's What if?", () => {
  const real = simulate(carpathia, carpathia.realNight);

  it.each(cases.map((ids) => [ids.join(" + "), ids]))(
    "%s: finite, and the run ends inside END_T",
    (_, ids) => {
      const track = run(ids as string[]);
      expect(track.endT).toBeLessThanOrEqual(END_T + 1e-6);
      const bad = track.frames.find((f) =>
        f.bodies.some(
          (b) => ![b.x, b.y, b.z, b.pitch, b.roll, b.yaw].every(Number.isFinite)
        )
      );
      expect(bad).toBeUndefined();
      const last = track.frames[track.frames.length - 1];
      if (track.outcome === "floated") {
        // Afloat: every one reaches a clear end (README, "the steady
        // test"), the timeline stopping there, not at END_T.
        const steady = track.events.find((e) => e.kind === "floating-steady");
        expect(steady).toBeDefined();
        expect(steady!.t).toBeLessThan(
          ids.includes("boiler") ? BOILER_STEADY_BY : STEADY_BY
        );
        expect(storyEndT(track, true)).toBeLessThan(END_T);
      } else expect(last.groundedParts).toEqual(last.bodies.map((b) => b.part));
    },
    30000
  );

  it("without the U-boat's return she sinks no earlier than her real morning", () => {
    const ids = carpathia.torpedo!.realSpots.filter(
      (id) => id !== FINISHER_SPOT
    );
    expect(sank(run(ids))).toBeGreaterThanOrEqual(sank(real));
  });

  it("one torpedo anywhere floats, or sinks no earlier than her real morning", () => {
    for (const id of spots)
      expect([id, sank(run([id])) >= sank(real)]).toEqual([id, true]);
  });

  it("three or more hits sink her no later than the same set's first two", () => {
    for (const ids of cases) {
      const order = landingOrder(ids);
      if (order.length < 3) continue;
      const firstTwo = [
        ...order.slice(0, 2),
        ...ids.filter((id) => id === FINISHER_SPOT),
      ];
      expect(sank(run(ids))).toBeLessThanOrEqual(sank(run(firstTwo)));
    }
  });

  it("the U-boat's return after she has sunk adds nothing (and no NaN)", () => {
    for (const ids of sets) {
      const before = run(ids);
      if (sank(before) >= carpathia.torpedo!.finisher!.t) continue;
      const after = run([...ids, FINISHER_SPOT]);
      expect(after.sankAtT).toBe(before.sankAtT);
      expect(after.events.filter((e) => e.kind === "torpedo-hit")).toEqual(
        before.events.filter((e) => e.kind === "torpedo-hit")
      );
    }
  });
});
