import { titanic } from "../../ships";
import { hullOpenings } from "../../ships/types";
import { END_T } from "../constants";
import { simulate, whatIfOpenings } from "../run";
import type { SimTrack } from "../track";

const forward = (k: number) => titanic.compartments.slice(-k).map((c) => c.id);

function subsets<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let mask = 1; mask < 1 << items.length; mask += 1)
    out.push(items.filter((_, i) => mask & (1 << i)));
  return out;
}

function expectAfloat(track: SimTrack) {
  expect(track.outcome).toBe("floated");
  expect(track.brokeAtT).toBeNull();
  expect(track.sankAtT).toBeNull();
  expect(track.endT).toBeGreaterThanOrEqual(END_T);
  const last = track.frames[track.frames.length - 1];
  expect(last.bodies).toHaveLength(1);
  expect(last.bodies[0].part).toBe("whole");
}

describe("What if?", () => {
  it("uses the real damage where there was some, else a small hole", () => {
    const o = hullOpenings(whatIfOpenings(titanic, ["hold1", "br4"]));
    expect(o.filter((x) => x.compartmentId === "hold1")).toEqual(
      titanic.realNight.filter((x) => x.compartmentId === "hold1")
    );
    const hole = o.find((x) => x.compartmentId === "br4");
    expect(hole).toMatchObject({ areaM2: 0.2, side: "starboard" });
    expect(((hole?.zLow ?? 0) + (hole?.zHigh ?? 0)) / 2).toBeCloseTo(3, 5);
    expect(whatIfOpenings(titanic, ["nope"])).toEqual([]);
  });

  it.each(subsets(forward(4)).map((ids) => [ids.join(" + "), ids]))(
    "%s open: still afloat at 6:00 AM, in one piece",
    (_, ids) => {
      const track = simulate(titanic, whatIfOpenings(titanic, ids as string[]));
      expectAfloat(track);
      expect(track.events.some((e) => e.kind === "floating-steady")).toBe(true);
    }
  );

  it("five forward open: sinks later than the real night (or floats)", () => {
    const real = simulate(titanic, titanic.realNight);
    const five = simulate(titanic, whatIfOpenings(titanic, forward(5)));
    if (five.outcome === "sank")
      expect(five.sankAtT as number).toBeGreaterThan(real.sankAtT as number);
    else expectAfloat(five);
  });

  it("seven forward open: sinks sooner than the real night", () => {
    const real = simulate(titanic, titanic.realNight);
    const seven = simulate(titanic, whatIfOpenings(titanic, forward(7)));
    expect(seven.outcome).toBe("sank");
    expect(seven.sankAtT as number).toBeLessThan(real.sankAtT as number);
  });
});
