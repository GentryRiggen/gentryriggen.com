import { titanic } from "../../ships";
import { simulate, whatIfOpenings } from "../run";
import type { SimTrack } from "../track";
import { titanic as titanic1 } from "./v1_0/ships";
import {
  simulate as simulate1,
  whatIfOpenings as whatIfOpenings1,
} from "./v1_0/sim/run";
import type { SimTrack as SimTrack1 } from "./v1_0/sim/track";

/**
 * The Titanic's tracks are exactly the 1.0 ones. `v1_0/` is a frozen copy of
 * the 1.0 sim and Titanic (commit e5fd6da4); each run goes through both it
 * and the current sim on the same machine, and every frame must match to the
 * last bit.
 *
 * Comparing live, not against stored numbers: Math and trig results differ in
 * the last bit across V8 versions and OSes, and the sim is chaotic enough
 * near the break that a stored track only matches on the machine that wrote
 * it.
 *
 * After the real night and the first What-ifs come the most listed runs a
 * search of 1.0 What-ifs found (up to 19° before she goes; one breaks, one
 * sinks whole, one floats) and boiler room 5 alone, whose pump keeps it from
 * ever settling in 1.0. They hold the 1.1 rest, floor and steady rules off
 * the Titanic's paths.
 */

const LISTED_BREAK = [
  "tunnel-2",
  "tunnel-1",
  "dynamo",
  "turbine",
  "engine",
  "br4",
  "br5",
  "br6",
];
const LISTED_SINK = [
  "tunnel-2",
  "tunnel-1",
  "dynamo",
  "turbine",
  "engine",
  "br1",
  "br2",
  "br3",
  "br4",
  "br5",
  "br6",
  "hold2",
];

/** Each run: the real night, or the compartments a What-if opens. */
const RUNS: Record<string, "realNight" | readonly string[]> = {
  realNight: "realNight",
  hold1Br4: ["hold1", "br4"],
  firstFive: titanic1.compartments.slice(-5).map((c) => c.id),
  br5: ["br5"],
  listedFloat: ["engine", "br1", "br2"],
  listedBreak: LISTED_BREAK,
  listedSink: LISTED_SINK,
};

function runNow(run: "realNight" | readonly string[]): SimTrack {
  return simulate(
    titanic,
    run === "realNight" ? titanic.realNight : whatIfOpenings(titanic, run)
  );
}

function run1(run: "realNight" | readonly string[]): SimTrack1 {
  return simulate1(
    titanic1,
    run === "realNight" ? titanic1.realNight : whatIfOpenings1(titanic1, run)
  );
}

/**
 * The first place `now` differs from `then`, compared on `then`'s fields
 * (anything the current sim adds is ignored), or null. Numbers must be
 * identical (Object.is), not close.
 */
function firstDiff(now: unknown, then: unknown, at: string): string | null {
  if (typeof then === "number" || typeof now === "number")
    return Object.is(now, then) ? null : `${at}: ${now} (1.0: ${then})`;
  if (then === null || typeof then !== "object")
    return now === then
      ? null
      : `${at}: ${JSON.stringify(now)} (1.0: ${JSON.stringify(then)})`;
  if (now === null || typeof now !== "object")
    return `${at}: ${JSON.stringify(now)} (1.0: an object)`;
  if (Array.isArray(then)) {
    if (!Array.isArray(now) || now.length !== then.length)
      return `${at}: length ${(now as unknown[]).length} (1.0: ${then.length})`;
    for (let i = 0; i < then.length; i++) {
      const d = firstDiff(now[i], then[i], `${at}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  const n = now as Record<string, unknown>;
  for (const [k, v] of Object.entries(then as Record<string, unknown>)) {
    const d = firstDiff(n[k], v, `${at}.${k}`);
    if (d) return d;
  }
  return null;
}

describe("the Titanic's tracks are the 1.0 tracks", () => {
  it("the frozen 1.0 Titanic has the same compartments", () => {
    expect(titanic.compartments.map((c) => c.id)).toEqual(
      titanic1.compartments.map((c) => c.id)
    );
  });

  for (const [name, run] of Object.entries(RUNS)) {
    it(`${name} matches the 1.0 sim exactly`, () => {
      const then = run1(run);
      const now = runNow(run);
      // The headline first, so a failure says what changed.
      expect({
        frames: now.frames.length,
        outcome: now.outcome,
        events: now.events.map((e) => [e.kind, e.index ?? null]),
      }).toEqual({
        frames: then.frames.length,
        outcome: then.outcome,
        events: then.events.map((e) => [e.kind, e.index ?? null]),
      });
      expect(firstDiff(now, then, name)).toBeNull();
    });
  }
});
