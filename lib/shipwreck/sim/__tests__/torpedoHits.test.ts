import { lusitania } from "../../ships";
import { hullOpenings } from "../../ships/types";
import { END_T } from "../constants";
import {
  HIT_STAGGER_S,
  hitTimeS,
  simulate,
  torpedoHitXs,
  whatIfOpenings,
  whatIfRealIds,
} from "../run";
import type { SimTrack } from "../track";

/**
 * More than one torpedo (1.3: What if is multi-select for every ship).
 * Each chosen spot gets the real hit moved there; two or three hits must
 * run to an end like one, and sink her no slower.
 */

const ONE = ["br1"];
const TWO = ["br1", "br3"];
const THREE = ["br1", "br3", "turbine"];

function finite(track: SimTrack) {
  const last = track.frames[track.frames.length - 1];
  expect(last.t).toBeLessThanOrEqual(END_T);
  expect(track.endT).toBeLessThanOrEqual(END_T);
  for (const f of track.frames)
    for (const b of f.bodies)
      for (const v of [b.x, b.y, b.z, b.pitch, b.roll, b.yaw])
        expect(Number.isFinite(v)).toBe(true);
}

describe("torpedo hits", () => {
  const runs = new Map<number, SimTrack>();
  beforeAll(() => {
    for (const ids of [ONE, TWO, THREE])
      runs.set(ids.length, simulate(lusitania, whatIfOpenings(lusitania, ids)));
  });

  it("two and three hits end inside endT with finite poses", () => {
    for (const n of [2, 3]) finite(runs.get(n)!);
  });

  it("more hits never sink her slower than one", () => {
    const at = (n: number) => runs.get(n)!.sankAtT ?? Infinity;
    expect(at(1)).toBeLessThan(Infinity);
    expect(at(2)).toBeLessThanOrEqual(at(1));
    expect(at(3)).toBeLessThanOrEqual(at(1));
  });

  it("finds where each torpedo strikes, aft first; the real spot is the real hit", () => {
    const real = lusitania.realNight.find(
      (o) => o.side === "starboard" && (o.t ?? 0) === 0
    )!;
    expect(torpedoHitXs(lusitania, whatIfRealIds(lusitania))).toEqual([real.x]);
    const three = torpedoHitXs(lusitania, ["br1", "turbine", "br3"]);
    expect(three).toHaveLength(3);
    expect([...three].sort((a, b) => a - b)).toEqual(three);
    expect(three[2]).toBe(real.x);
    expect(torpedoHitXs(lusitania, [])).toEqual([]);
  });

  it("opens hit k of n k·HIT_STAGGER_S after the first, which lands at the hit", () => {
    expect([0, 1, 2].map((k) => hitTimeS(k, 3))).toEqual([
      0,
      HIT_STAGGER_S,
      2 * HIT_STAGGER_S,
    ]);
    expect(hitTimeS(0, 1)).toBe(0);
    const xs = torpedoHitXs(lusitania, THREE);
    const open = hullOpenings(whatIfOpenings(lusitania, THREE));
    const real = lusitania.realNight;
    for (let k = 0; k < xs.length; k += 1) {
      // Hit k's own hole in her side, and every later opening of it,
      // k staggers after the real one's time.
      const hole = open.find((o) => o.x === xs[k] && o.side === "starboard");
      expect(hole?.t ?? 0).toBe(hitTimeS(k, xs.length));
    }
    const times = open.map((o) => o.t ?? 0).sort((a, b) => a - b);
    const realTimes = real.map((o) => o.t ?? 0);
    expect(times[0]).toBe(0);
    expect(times.at(-1)).toBe(
      Math.max(...realTimes) + hitTimeS(xs.length - 1, xs.length)
    );
    // One hit is the real afternoon's openings, untouched.
    expect(whatIfOpenings(lusitania, whatIfRealIds(lusitania))).toEqual(real);
  });
});
