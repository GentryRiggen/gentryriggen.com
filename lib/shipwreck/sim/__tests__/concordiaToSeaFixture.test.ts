import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { concordia } from "../../ships/concordia";
import { simulate, whatIfOpenings, whatIfRealIds } from "../run";
import { sampleTrack, type SimFrame, type SimTrack } from "../track";

/**
 * The Costa Concordia blown out to sea (her "to sea" What if) takes about
 * 8 s to play, too slow for the fast lane's word and camera tests. They
 * read a saved summary of it instead (`fixtures/concordiaToSea.json`):
 *
 * - `night`: her real night's holes with the wind out to sea (the words:
 *   `concordiaStory`, `EndCard`): every event, the outcome, the first and
 *   last frames.
 * - `whatIf`: her real spots chosen in the What if, to sea, portholes open
 *   (the cameras: `cameraMath`): every event, the outcome, a frame every
 *   60 s and the last.
 *
 * This test (the sims lane) checks the summary still matches the sim, to
 * a tolerance that holds on arm64 and x64 alike; `UPDATE_FIXTURE=1 npm run
 * test:sims -- concordiaToSeaFixture` rewrites it after a change meant to
 * move her.
 */

const FIXTURE = join(__dirname, "fixtures", "concordiaToSea.json");
const STEP_S = 60;

type Summary = Pick<
  SimTrack,
  "frames" | "events" | "outcome" | "sankAtT" | "brokeAtT" | "breakX" | "endT"
>;

const round = (v: number) => Math.round(v * 1e6) / 1e6;

function frameOf(f: SimFrame, t = f.t): SimFrame {
  return {
    t: round(t),
    realT: round(f.realT),
    bodies: f.bodies.map((b) => ({
      part: b.part,
      x: round(b.x),
      y: round(b.y),
      z: round(b.z),
      pitch: round(b.pitch),
      roll: round(b.roll),
      yaw: round(b.yaw),
    })),
    water: f.water.map(round),
    waterAboardT: round(f.waterAboardT),
    trimDeg: round(f.trimDeg),
    listDeg: round(f.listDeg),
    power: round(f.power),
    groundedParts: [...f.groundedParts],
  };
}

function summary(track: SimTrack, everyS: number | null): Summary {
  const first = track.frames[0];
  const last = track.frames[track.frames.length - 1];
  const frames: SimFrame[] = [frameOf(first)];
  if (everyS !== null)
    for (let t = everyS; t < last.t; t += everyS)
      frames.push(frameOf(sampleTrack(track, t), t));
  frames.push(frameOf(last));
  return {
    frames,
    events: track.events.map((e) => ({
      ...e,
      t: round(e.t),
      realT: round(e.realT),
    })),
    outcome: track.outcome,
    sankAtT: track.sankAtT === null ? null : round(track.sankAtT),
    brokeAtT: track.brokeAtT === null ? null : round(track.brokeAtT),
    breakX: track.breakX,
    endT: round(track.endT),
  };
}

function fresh(): Record<"night" | "whatIf", Summary> {
  return {
    night: summary(
      simulate(concordia, concordia.realNight, { toSea: true }),
      null
    ),
    whatIf: summary(
      simulate(concordia, whatIfOpenings(concordia, whatIfRealIds(concordia)), {
        toSea: true,
        portholesOpen: true,
      }),
      STEP_S
    ),
  };
}

describe("the Concordia's to-sea fixture", () => {
  it("matches the sim (events, outcome and frames, to a tolerance)", () => {
    const now = fresh();
    if (process.env.UPDATE_FIXTURE === "1") {
      writeFileSync(FIXTURE, `${JSON.stringify(now)}\n`);
      return;
    }
    const saved = JSON.parse(readFileSync(FIXTURE, "utf8")) as typeof now;
    for (const k of ["night", "whatIf"] as const) {
      const a = now[k];
      const b = saved[k];
      expect(a.outcome).toBe(b.outcome);
      expect(a.events.map((e) => [e.kind, e.index])).toEqual(
        b.events.map((e) => [e.kind, e.index])
      );
      a.events.forEach((e, i) => {
        expect(Math.abs(e.t - b.events[i].t)).toBeLessThan(2);
        expect(Math.abs(e.realT - b.events[i].realT)).toBeLessThan(2);
      });
      expect(Math.abs(a.endT - b.endT)).toBeLessThan(2);
      expect(a.frames).toHaveLength(b.frames.length);
      a.frames.forEach((f, i) => {
        const g = b.frames[i];
        expect(Math.abs(f.t - g.t)).toBeLessThan(2);
        expect(Math.abs(f.listDeg - g.listDeg)).toBeLessThan(0.5);
        expect(f.bodies.map((p) => p.part)).toEqual(
          g.bodies.map((p) => p.part)
        );
        f.bodies.forEach((p, j) => {
          const q = g.bodies[j];
          expect(Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)).toBeLessThan(1);
        });
      });
    }
  });
});
