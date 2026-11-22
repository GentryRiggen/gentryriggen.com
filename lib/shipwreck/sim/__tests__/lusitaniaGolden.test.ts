import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { lusitania } from "../../ships";
import { simulate, whatIfOpenings } from "../run";
import type { SimTrack } from "../track";

/**
 * The Lusitania's tracks are exactly the 1.1 ones: the real afternoon and
 * two What-ifs (the hit moved aft to the turbine room with her portholes
 * shut, and the real spot with them shut), against a fixture the 1.1 sim
 * wrote (`UPDATE_GOLDEN=1 npx jest lusitaniaGolden` rewrites it; only do
 * that for a change meant to move her).
 *
 * Every event, the outcome, and every 50th frame (and the last) to 1e-9:
 * stored numbers, so a little room for Math's last bit across machines.
 */

const FIXTURE = join(__dirname, "fixtures", "lusitaniaGolden.json");
const EPS = 1e-9;

const RUNS: Record<
  string,
  { spots: readonly string[] | null; portholesOpen: boolean }
> = {
  realAfternoon: { spots: null, portholesOpen: true },
  turbineShut: { spots: ["turbine"], portholesOpen: false },
  realSpotShut: { spots: ["br1"], portholesOpen: false },
};

interface Golden {
  frames: number;
  outcome: SimTrack["outcome"];
  sankAtT: number | null;
  brokeAtT: number | null;
  endT: number;
  events: { kind: string; index: number | null; t: number; realT: number }[];
  sampled: {
    i: number;
    t: number;
    poses: number[][];
    water: number[];
    trimDeg: number;
    listDeg: number;
    waterAboardT: number;
  }[];
}

function golden(track: SimTrack): Golden {
  const n = track.frames.length;
  const idx: number[] = [];
  for (let i = 0; i < n; i += 50) idx.push(i);
  if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
  return {
    frames: n,
    outcome: track.outcome,
    sankAtT: track.sankAtT,
    brokeAtT: track.brokeAtT,
    endT: track.endT,
    events: track.events.map((e) => ({
      kind: e.kind,
      index: e.index ?? null,
      t: e.t,
      realT: e.realT,
    })),
    sampled: idx.map((i) => {
      const f = track.frames[i];
      return {
        i,
        t: f.t,
        poses: f.bodies.map((b) => [b.x, b.y, b.z, b.pitch, b.roll, b.yaw]),
        water: f.water,
        trimDeg: f.trimDeg,
        listDeg: f.listDeg,
        waterAboardT: f.waterAboardT,
      };
    }),
  };
}

function runOf(name: string): SimTrack {
  const r = RUNS[name];
  return simulate(
    lusitania,
    r.spots ? whatIfOpenings(lusitania, r.spots) : lusitania.realNight,
    { portholesOpen: r.portholesOpen }
  );
}

/** The first place `now` differs from `then` by more than EPS, or null. */
function firstDiff(now: unknown, then: unknown, at: string): string | null {
  if (typeof then === "number" && typeof now === "number")
    return Math.abs(now - then) <= EPS ||
      (Number.isNaN(now) && Number.isNaN(then))
      ? null
      : `${at}: ${now} (1.1: ${then})`;
  if (then === null || typeof then !== "object")
    return now === then
      ? null
      : `${at}: ${JSON.stringify(now)} (1.1: ${JSON.stringify(then)})`;
  if (now === null || typeof now !== "object")
    return `${at}: ${JSON.stringify(now)} (1.1: an object)`;
  if (Array.isArray(then)) {
    if (!Array.isArray(now) || now.length !== then.length)
      return `${at}: length ${(now as unknown[]).length} (1.1: ${then.length})`;
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

const update = process.env.UPDATE_GOLDEN === "1";

describe("the Lusitania's tracks are the 1.1 tracks", () => {
  const stored: Record<string, Golden> = update
    ? {}
    : JSON.parse(readFileSync(FIXTURE, "utf8"));

  for (const name of Object.keys(RUNS)) {
    it(`${name} matches the 1.1 sim`, () => {
      const now = golden(runOf(name));
      if (update) {
        stored[name] = now;
        return;
      }
      const then = stored[name];
      expect(then).toBeDefined();
      // The headline first, so a failure says what changed.
      expect({
        frames: now.frames,
        outcome: now.outcome,
        events: now.events.map((e) => [e.kind, e.index]),
      }).toEqual({
        frames: then.frames,
        outcome: then.outcome,
        events: then.events.map((e) => [e.kind, e.index]),
      });
      expect(firstDiff(now, then, name)).toBeNull();
    });
  }

  if (update)
    afterAll(() => {
      writeFileSync(FIXTURE, `${JSON.stringify(stored)}\n`);
    });
});
