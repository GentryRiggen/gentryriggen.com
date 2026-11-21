import * as fs from "fs";
import * as path from "path";
import { titanic } from "../../ships";
import { simulate, whatIfOpenings } from "../run";
import type { SimTrack } from "../track";

/**
 * The Titanic's tracks, frozen. The fixture was written by the 1.0 sim
 * before any 1.1 change; every later change to the sim must leave these
 * numbers alone (to 1e-9). Regenerate only on purpose:
 * `UPDATE_GOLDEN=1 npx jest titanicGolden`.
 */

const FIXTURE = path.join(__dirname, "fixtures", "titanicGolden.json");
const TOL = 1e-9;
const EVERY = 50;

const RUNS: Record<string, () => SimTrack> = {
  realNight: () => simulate(titanic, titanic.realNight),
  hold1Br4: () => simulate(titanic, whatIfOpenings(titanic, ["hold1", "br4"])),
  firstFive: () =>
    simulate(
      titanic,
      whatIfOpenings(
        titanic,
        titanic.compartments.slice(-5).map((c) => c.id)
      )
    ),
};

interface Golden {
  frameCount: number;
  events: { kind: string; t: number; realT: number; index: number | null }[];
  outcome: string;
  sankAtT: number | null;
  brokeAtT: number | null;
  breakX: number | null;
  frames: {
    i: number;
    bodies: {
      part: string;
      x: number;
      y: number;
      z: number;
      pitch: number;
      roll: number;
      yaw: number;
    }[];
    water: number[];
    listDeg: number;
    trimDeg: number;
  }[];
}

function golden(track: SimTrack): Golden {
  const frames: Golden["frames"] = [];
  for (let i = 0; i < track.frames.length; i += EVERY) {
    const f = track.frames[i];
    frames.push({
      i,
      bodies: f.bodies.map((b) => ({
        part: b.part,
        x: b.x,
        y: b.y,
        z: b.z,
        pitch: b.pitch,
        roll: b.roll,
        yaw: b.yaw,
      })),
      water: f.water.slice(),
      listDeg: f.listDeg,
      trimDeg: f.trimDeg,
    });
  }
  return {
    frameCount: track.frames.length,
    events: track.events.map((e) => ({
      kind: e.kind,
      t: e.t,
      realT: e.realT,
      index: e.index ?? null,
    })),
    outcome: track.outcome,
    sankAtT: track.sankAtT,
    brokeAtT: track.brokeAtT,
    breakX: track.breakX,
    frames,
  };
}

function close(actual: number | null, expected: number | null, what: string) {
  if (expected === null || actual === null) {
    expect({ what, actual }).toEqual({ what, actual: expected });
    return;
  }
  if (Math.abs(actual - expected) > TOL)
    throw new Error(`${what}: ${actual} differs from golden ${expected}`);
}

describe("the Titanic's tracks are unchanged (golden)", () => {
  const update = process.env.UPDATE_GOLDEN === "1";
  const stored: Record<string, Golden> =
    !update && fs.existsSync(FIXTURE)
      ? JSON.parse(fs.readFileSync(FIXTURE, "utf8"))
      : {};
  const fresh: Record<string, Golden> = {};

  afterAll(() => {
    if (update) fs.writeFileSync(FIXTURE, JSON.stringify(fresh) + "\n");
  });

  for (const name of Object.keys(RUNS)) {
    it(`${name} matches the fixture`, () => {
      const g = golden(RUNS[name]());
      fresh[name] = g;
      if (update) return;
      const want = stored[name];
      expect(want).toBeDefined();
      expect(g.frameCount).toBe(want.frameCount);
      expect(g.outcome).toBe(want.outcome);
      expect(g.events.map((e) => [e.kind, e.index])).toEqual(
        want.events.map((e) => [e.kind, e.index])
      );
      g.events.forEach((e, k) => {
        close(e.t, want.events[k].t, `${name} event ${k} t`);
        close(e.realT, want.events[k].realT, `${name} event ${k} realT`);
      });
      close(g.sankAtT, want.sankAtT, `${name} sankAtT`);
      close(g.brokeAtT, want.brokeAtT, `${name} brokeAtT`);
      close(g.breakX, want.breakX, `${name} breakX`);
      expect(g.frames.length).toBe(want.frames.length);
      g.frames.forEach((f, k) => {
        const w = want.frames[k];
        const at = `${name} frame ${f.i}`;
        expect(f.bodies.map((b) => b.part)).toEqual(
          w.bodies.map((b) => b.part)
        );
        f.bodies.forEach((b, j) => {
          const wb = w.bodies[j];
          for (const key of ["x", "y", "z", "pitch", "roll", "yaw"] as const)
            close(b[key], wb[key], `${at} ${b.part}.${key}`);
        });
        expect(f.water.length).toBe(w.water.length);
        f.water.forEach((v, j) => close(v, w.water[j], `${at} water[${j}]`));
        close(f.listDeg, w.listDeg, `${at} listDeg`);
        close(f.trimDeg, w.trimDeg, `${at} trimDeg`);
      });
    });
  }
});
