import { concordia } from "../../ships";
import {
  CONCORDIA_FIXES,
  DECK0_Z,
  DECK3_Z,
  concordiaEarth,
} from "../../ships/concordia";
import { type Body, earthOf } from "../body";
import { END_T } from "../constants";
import { buildHull, hullHalfBreadth, hullSlice } from "../geometry";
import { R_SIZE, R_VOL, integrateSlice } from "../hydrostatics";
import { simulate } from "../run";
import { floorAt } from "../seabed";
import type { SimTrack } from "../track";

/**
 * The Costa Concordia's real night (spec "Pass criteria"): the gash, the
 * blackout, the port list then the starboard one, down by the stern, her
 * stern touching the rocks about 22:39, the rest aground at 65° by the
 * harbour. One run, shared by every test.
 */

const DEG = Math.PI / 180;
const MIN = 60;
const ids = concordia.compartments.map((c) => c.id);
const hull = buildHull(concordia);
const clock = (realT: number) => concordia.clockStartS + realT;
const HOUR = 3600;

/** Each compartment's volume under deck 0 over its whole volume. */
const underDeck0 = concordia.compartments.map((c) => {
  const v = (z: number) => {
    const o = new Float64Array(R_SIZE);
    integrateSlice(hullSlice(hull, c.fromX, c.toX), 0, 0, 1, -z, o);
    return o[R_VOL];
  };
  return v(DECK0_Z) / v(100);
});

let track: SimTrack;
/**
 * When each compartment was "full" (s, before she grounds shown = real):
 * its water level with the sea outside (within 0.25 m), or 95% of its
 * volume under deck 0, whichever came first. README: the spec's "95%
 * under deck 0" alone is reached only once the sea outside is over deck 0
 * there.
 */
const full: Record<string, number> = {};
let touch: { t: number; x: number; depth: number; list: number } | null = null;
let last: Body | null = null;
let lowestAtRest = 0;

/** The ship-frame hull vertex deepest into the floor now: where she bears. */
function bearingVertex(b: Body): [number, number, number] {
  let best = -Infinity;
  let at: [number, number, number] = [0, 0, 0];
  const p = b.floorPts;
  for (let k = 0; k < p.length; k += 4) {
    const e = earthOf(b, p[k], p[k + 1], p[k + 2]);
    const into = floorAt(concordia, e[0], e[1]) - e[2];
    if (into > best) {
      best = into;
      at = [p[k], p[k + 1], p[k + 2]];
    }
  }
  return at;
}

beforeAll(() => {
  track = simulate(concordia, concordia.realNight, {
    probe: (p) => {
      const b = p.bodies[0];
      if (!b) return;
      last = b;
      lowestAtRest = p.lowestZ;
      b.cells.forEach((c, i) => {
        const id = ids[i];
        if (full[id] !== undefined || c.water <= 0) return;
        const deck0 = c.water / c.cap / underDeck0[i];
        if ((c.water < c.cap && c.level >= -0.25) || deck0 >= 0.95)
          full[id] = p.t;
      });
      if (!touch && b.grounded) {
        const v = bearingVertex(b);
        const e = earthOf(b, v[0], v[1], v[2]);
        touch = {
          t: p.t,
          x: v[0],
          depth: -floorAt(concordia, e[0], e[1]),
          list: b.roll / DEG,
        };
      }
    },
  });
}, 60_000);

const at = (realT: number) =>
  track.frames.find((f) => f.realT >= realT - 1e-6)!;
const eventAt = (kind: string) => track.events.find((e) => e.kind === kind);

describe("the Costa Concordia's real night", () => {
  it("strikes at t = 0 and floods WTC 5, 6, 4 and 7 as the report has it", () => {
    expect(track.events[0]).toMatchObject({ t: 0, kind: "collision" });
    const fill = (id: string) => full[id] / MIN;
    expect(fill("wtc5")).toBeGreaterThanOrEqual(2);
    expect(fill("wtc5")).toBeLessThanOrEqual(6);
    expect(fill("wtc6")).toBeGreaterThanOrEqual(4);
    expect(fill("wtc6")).toBeLessThanOrEqual(12);
    for (const id of ["wtc4", "wtc7"]) {
      expect(fill(id)).toBeGreaterThanOrEqual(30);
      expect(fill(id)).toBeLessThanOrEqual(50);
    }
  });

  it("loses her lights in 30–90 s, to her emergency lighting, never dark (R7)", () => {
    const out = eventAt("lights-out")!;
    expect(out).toBeDefined();
    expect(out.t).toBeGreaterThanOrEqual(30);
    expect(out.t).toBeLessThanOrEqual(90);
    const light = concordia.blackout!.emergencyLight;
    expect(light).toBeGreaterThan(0);
    for (const f of track.frames)
      if (f.t > out.t + 1) expect(f.power).toBe(light);
  });

  it("lists a little to port first, then to starboard by 22:20 and never back", () => {
    const early = track.frames.filter((f) => f.realT <= 20 * MIN);
    expect(early.some((f) => f.listDeg < -0.5)).toBe(true);
    for (const f of track.frames) expect(f.listDeg).toBeGreaterThanOrEqual(-5);
    for (const f of track.frames)
      if (f.realT >= 35 * MIN) expect(f.listDeg).toBeGreaterThan(0);
    // 10° ± 4 at 22:30 [MIT §1].
    expect(Math.abs(at(45 * MIN).listDeg - 10)).toBeLessThanOrEqual(4);
  });

  it("is down by the stern from 10 minutes on", () => {
    for (const f of track.frames)
      if (f.realT >= 10 * MIN) expect(f.trimDeg).toBeLessThan(0);
  });

  it("first touches the rocks aft of midships at 48–62 min, 12–35 m down, listed 12°–25°", () => {
    expect(touch).not.toBeNull();
    const first = touch!;
    expect(first.t / MIN).toBeGreaterThanOrEqual(48);
    expect(first.t / MIN).toBeLessThanOrEqual(62);
    expect(first.x).toBeLessThan(0);
    expect(first.depth).toBeGreaterThanOrEqual(12);
    expect(first.depth).toBeLessThanOrEqual(35);
    expect(first.list).toBeGreaterThanOrEqual(12);
    expect(first.list).toBeLessThanOrEqual(25);
    // Afloat when she touched: her stern lands, not her bow.
    const lands = eventAt("stern-lands")!;
    expect(lands).toBeDefined();
    expect(Math.abs(lands.t - first.t)).toBeLessThanOrEqual(1.5);
    expect(eventAt("bow-lands")).toBeUndefined();
  });

  it("rests aground on her starboard side at 65° by the 22:58 fix (R11, R12)", () => {
    const ag = eventAt("aground")!;
    expect(ag).toBeDefined();
    const rest = eventAt("floating-steady")!;
    expect(rest).toBeDefined();
    expect(rest.t - ag.t).toBeLessThanOrEqual(25 * MIN);
    expect(clock(rest.realT)).toBeGreaterThanOrEqual(24 * HOUR + 30 * MIN);
    expect(clock(rest.realT)).toBeLessThanOrEqual(25 * HOUR);
    const f = track.frames[track.frames.length - 1];
    expect(Math.abs(f.listDeg - 65)).toBeLessThanOrEqual(2);
    const b = f.bodies[0];
    const heading = (((350 - b.yaw / DEG) % 360) + 360) % 360;
    expect(heading).toBeGreaterThanOrEqual(180);
    expect(heading).toBeLessThanOrEqual(220);
    const fin = CONCORDIA_FIXES.final;
    const [fx, fy] = concordiaEarth(fin.lat, fin.lon);
    expect(Math.hypot(b.x - fx, b.y - fy)).toBeLessThanOrEqual(150);
    // Her lowest point on the floor (README: the rule seats it where she
    // first touched).
    expect(-lowestAtRest).toBeGreaterThanOrEqual(12);
    expect(-lowestAtRest).toBeLessThanOrEqual(32);
  });

  it("lies with her port side shell and a third of her superstructure out of the sea", () => {
    const b = last!;
    expect(b.aground?.done).toBe(true);
    // The port shell: every station's side from the bilge to deck 3.
    for (let x = hull.xMin + 2; x <= hull.xMax - 2; x += 4)
      for (let z = 1; z <= DECK3_Z; z += 2) {
        const y = hullHalfBreadth(hull, x, z);
        if (y <= 0.5) continue;
        expect(earthOf(b, x, y, z)[2]).toBeGreaterThan(0);
      }
    // The superstructure: a third of it (by volume, sampled) above the sea.
    let above = 0;
    let all = 0;
    for (const s of concordia.superstructure)
      for (let x = s.fromX + 1; x < s.toX; x += 4) {
        const hb = Math.min(
          hullHalfBreadth(hull, x, DECK3_Z - 0.01),
          s.halfBreadthM ?? Infinity
        );
        for (let z = DECK3_Z + 1; z < s.topZ; z += 2)
          for (let y = -hb; y <= hb; y += 3) {
            all += 1;
            if (earthOf(b, x, y, z)[2] > 0) above += 1;
          }
      }
    expect(above / all).toBeGreaterThanOrEqual(1 / 3);
  });

  it("neither breaks nor sinks: outcome aground, inside endT, finite", () => {
    const kinds = track.events.map((e) => e.kind);
    expect(kinds).not.toContain("breakup");
    expect(kinds).not.toContain("stern-under");
    expect(track.outcome).toBe("aground");
    expect(track.endT).toBeLessThanOrEqual(END_T + 1e-6);
    expect(track.frames[track.frames.length - 1].t).toBeLessThanOrEqual(
      track.endT + 1e-6
    );
    for (const f of track.frames)
      for (const p of f.bodies)
        for (const v of [p.x, p.y, p.z, p.pitch, p.roll, p.yaw])
          expect(Number.isFinite(v)).toBe(true);
  });

  it("is deterministic", () => {
    const again = simulate(concordia, concordia.realNight);
    expect(again.events).toEqual(track.events);
    const a = again.frames[again.frames.length - 1];
    const b = track.frames[track.frames.length - 1];
    expect(a).toEqual(b);
  }, 60_000);
});
