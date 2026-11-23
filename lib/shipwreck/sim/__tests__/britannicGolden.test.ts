import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { britannic } from "../../ships";
import { type SimOptions, simulate } from "../run";
import type { SimTrack } from "../track";

/**
 * The Britannic's tracks are exactly the 1.8 ones: her real morning and
 * one What-if (her real mine hole with every watertight door shut), against
 * a fixture the 1.8 sim wrote (`UPDATE_GOLDEN=1 npx jest britannicGolden`
 * rewrites it; only do that for a change meant to move her). It pins her
 * through the sim's shared code (the Concordia's seabed, drift path, heel
 * moments, blackout and rest aground must leave her alone).
 *
 * Every event, the outcome, and every 50th frame (and the last) to 1e-9.
 * One fixture per CPU architecture, as `lusitaniaGolden`: Math's last bits
 * differ between arm64 (Macs) and x64 (CI), so each is written by the 1.8
 * sim on its own architecture (rewrite both with `UPDATE_GOLDEN=1` on each
 * when she is meant to move). The x64 one was written in a linux/amd64
 * node:24 container on a Mac, which reproduces the Fitzgerald's CI-written
 * x64 fixture to the last bit.
 */

const FIXTURE = join(
  __dirname,
  "fixtures",
  `britannicGolden.${process.arch}.json`
);
const EPS = 1e-9;

const RUNS: Record<string, SimOptions> = {
  realMorning: {},
  doorsClosed: { doorsClosed: true },
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
  return simulate(britannic, britannic.realNight, RUNS[name]);
}

/** The first place `now` differs from `then` by more than EPS, or null. */
function firstDiff(now: unknown, then: unknown, at: string): string | null {
  if (typeof then === "number" && typeof now === "number")
    return Math.abs(now - then) <= EPS ||
      (Number.isNaN(now) && Number.isNaN(then))
      ? null
      : `${at}: ${now} (1.8: ${then})`;
  if (then === null || typeof then !== "object")
    return now === then
      ? null
      : `${at}: ${JSON.stringify(now)} (1.8: ${JSON.stringify(then)})`;
  if (now === null || typeof now !== "object")
    return `${at}: ${JSON.stringify(now)} (1.8: an object)`;
  if (Array.isArray(then)) {
    if (!Array.isArray(now) || now.length !== then.length)
      return `${at}: length ${(now as unknown[]).length} (1.8: ${then.length})`;
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

describe("the Britannic's tracks are the 1.8 tracks", () => {
  const stored: Record<string, Golden> = update
    ? {}
    : JSON.parse(readFileSync(FIXTURE, "utf8"));

  for (const name of Object.keys(RUNS)) {
    it(`${name} matches the 1.8 sim`, () => {
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
      // Pretty (one value a line) so a rewrite diffs readably; the
      // committed fixture is compared as data, not as text.
      writeFileSync(FIXTURE, `${JSON.stringify(stored, null, 2)}\n`);
    });
});
