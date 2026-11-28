import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { concordia } from "../../ships/concordia";
import { simulate } from "../../sim";
import type { SimFrame } from "../../sim/track";

/**
 * The Concordia's real night takes about 2 s to play, too slow for the
 * fast lane's seep timeline (`concordiaWater.test.ts`), which reads a
 * saved copy of her poses instead (`fixtures/concordiaPoses.json`: a frame
 * every 10 s to 3700 s, her list, her power and her pose). This test (the
 * sims lane) checks the copy still matches the sim; `UPDATE_FIXTURE=1 npx
 * jest -c jest.sims.js concordiaPosesFixture` rewrites it after a change
 * meant to move her.
 */

const FILE = join(__dirname, "fixtures", "concordiaPoses.json");
const STEP_S = 10;
const END_S = 3700;
const round = (v: number) => Math.round(v * 1e5) / 1e5;

function pick(frames: readonly SimFrame[]) {
  const out: {
    t: number;
    listDeg: number;
    power: number;
    pose: number[];
  }[] = [];
  let next = 0;
  for (const f of frames) {
    if (f.t < next) continue;
    if (f.t > END_S) break;
    next = f.t + STEP_S;
    const b = f.bodies[0];
    out.push({
      t: round(f.t),
      listDeg: round(f.listDeg),
      power: round(f.power),
      pose: [b.x, b.y, b.z, b.pitch, b.roll, b.yaw].map(round),
    });
  }
  return out;
}

describe("her saved poses", () => {
  it("match her real night (to a tolerance for arm64 and x64)", () => {
    const now = pick(simulate(concordia, concordia.realNight).frames);
    if (process.env.UPDATE_FIXTURE) {
      writeFileSync(FILE, JSON.stringify(now) + "\n");
      return;
    }
    const saved = JSON.parse(readFileSync(FILE, "utf8")) as typeof now;
    expect(saved.length).toBe(now.length);
    saved.forEach((s, i) => {
      expect(s.t).toBeCloseTo(now[i].t, 3);
      expect(s.listDeg).toBeCloseTo(now[i].listDeg, 2);
      expect(s.power).toBeCloseTo(now[i].power, 3);
      s.pose.forEach((v, k) => expect(v).toBeCloseTo(now[i].pose[k], 2));
    });
  }, 60_000);
});
