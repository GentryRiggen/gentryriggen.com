import { type Body, staticForces, stepFloat } from "../body";
import { GRAV, SIM_STEP_S } from "../constants";
import { TOWER, bodyOf, towerSpacesShip } from "./testShips";

/**
 * Nothing had floated past 90° before the Poseidon. The box-on-box (the
 * tower ship: a 14 m box hull, a 30 m deckhouse along her whole length, as
 * two named spaces, with trapped air) at 0–180° in 10° steps against the
 * analytic GZ of its section clipped by the sea (as `superstructureGz`,
 * past the deck edge and on round to keel up), and keel up with the
 * deckhouse flooded and the hull's air sealed: stable, a nudge in roll and
 * pitch dies away.
 */

const DEG = Math.PI / 180;
type P = [number, number];

/** Clip a polygon (y, z) to f(p) < 0; its area and centroid. */
function clip(poly: P[], f: (p: P) => number) {
  const out: P[] = [];
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const fa = f(a);
    const fb = f(b);
    if (fa < 0) out.push(a);
    if (fa < 0 !== fb < 0) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  let a2 = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < out.length; i += 1) {
    const [y0, z0] = out[i];
    const [y1, z1] = out[(i + 1) % out.length];
    const cr = y0 * z1 - y1 * z0;
    a2 += cr;
    cy += (y0 + y1) * cr;
    cz += (z0 + z1) * cr;
  }
  const area = a2 / 2;
  return area > 1e-12
    ? { area, cy: cy / (6 * area), cz: cz / (6 * area) }
    : { area: 0, cy: 0, cz: 0 };
}

const hb = TOWER.beam / 2;
const hh = TOWER.houseHalfBreadth;
const HULL: P[] = [
  [-hb, 0],
  [hb, 0],
  [hb, TOWER.depth],
  [-hb, TOWER.depth],
];
const HOUSE: P[] = [
  [-hh, TOWER.depth],
  [hh, TOWER.depth],
  [hh, TOWER.houseTop],
  [-hh, TOWER.houseTop],
];

/**
 * The analytic GZ (m, + righting toward upright) at heel `roll` (+ to
 * starboard, as the sim's) with both spaces dry: the heave whose displaced
 * section floats her, then the lever between B and G across the earth.
 * Earth z of a section point: heave + sin(roll)·y + cos(roll)·z.
 */
function analyticGz(roll: number, kg: number): number {
  const area0 = TOWER.beam * TOWER.draught;
  const sub = (h: number) => {
    const f = ([y, z]: P) => h + Math.sin(roll) * y + Math.cos(roll) * z;
    const a = clip(HULL, f);
    const b = clip(HOUSE, f);
    const area = a.area + b.area;
    return {
      area,
      cy: (a.area * a.cy + b.area * b.cy) / area,
      cz: (a.area * a.cz + b.area * b.cz) / area,
    };
  };
  let lo = -80;
  let hi = 80;
  for (let k = 0; k < 200; k += 1) {
    const mid = (lo + hi) / 2;
    if (sub(mid).area > area0) lo = mid;
    else hi = mid;
  }
  const s = sub((lo + hi) / 2);
  // Earth y of a section point: cos(roll)·y − sin(roll)·z.
  const by = Math.cos(roll) * s.cy - Math.sin(roll) * s.cz;
  const gy = -Math.sin(roll) * kg;
  return -(by - gy);
}

/** The sim's GZ at heel `roll`, every space dry (`staticForces`). */
function simGz(b: Body, roll: number): number {
  b.pitch = 0;
  b.roll = roll;
  for (const c of b.all) c.water = 0;
  let lo = -80;
  let hi = 80;
  for (let k = 0; k < 200; k += 1) {
    const mid = (lo + hi) / 2;
    b.z = mid;
    const f = staticForces(b);
    if (f.fb > f.weight) lo = mid;
    else hi = mid;
  }
  b.z = (lo + hi) / 2;
  return -staticForces(b).tauR / (b.lightMass * GRAV);
}

describe("the box-on-box's righting lever to keel up", () => {
  const b = bodyOf(towerSpacesShip());
  const kg = towerSpacesShip().kg;
  for (let deg = 0; deg <= 180; deg += 10) {
    it(`at ${deg}°`, () => {
      const want = analyticGz(deg * DEG, kg);
      const got = simGz(b, deg * DEG);
      expect(Number.isFinite(got)).toBe(true);
      // 3% of the lever; 3 cm only near zero (|GZ| < 0.5 m), where 3% is
      // under the sections' resolution.
      const tol = Math.abs(want) < 0.5 ? 0.03 : 0.03 * Math.abs(want);
      expect(Math.abs(got - want)).toBeLessThanOrEqual(tol);
    });
  }
});

describe("keel up, the deckhouse flooded, the hull's air sealed", () => {
  const b = bodyOf(towerSpacesShip());
  // Keel up near where she floats; her deckhouse full of the sea.
  b.roll = Math.PI;
  b.pitch = 0;
  b.z = 3;
  b.all.forEach((c, i) => {
    if (!c.box) return;
    c.water = c.cap;
    b.air!.mass[i] = 0;
  });
  let finite = true;
  const run = (s: number, each?: () => void) => {
    for (let k = 0; k < s / SIM_STEP_S; k += 1) {
      stepFloat(b, SIM_STEP_S, false, 0);
      finite &&= [b.z, b.roll, b.pitch, b.wr, b.wp].every(Number.isFinite);
      each?.();
    }
  };
  run(3000);
  const rest = { roll: b.roll, pitch: b.pitch, z: b.z };

  it("floats keel up on her hull's air", () => {
    expect(Math.abs(rest.roll - Math.PI)).toBeLessThan(0.5 * DEG);
    expect(Math.abs(rest.pitch)).toBeLessThan(0.5 * DEG);
    expect(b.cells.every((c, i) => b.air!.sealed[i] === 1)).toBe(true);
    // Her keel out of the sea: the hull holds air.
    expect(rest.z).toBeGreaterThan(0);
    expect(finite).toBe(true);
  });

  it("returns from 5° of roll and 2° of pitch within 120 s", () => {
    b.roll += 5 * DEG;
    b.pitch += 2 * DEG;
    let worst = 0;
    run(120, () => {
      worst = Math.max(worst, Math.abs(b.roll - rest.roll));
    });
    // It never ran away, and it is back.
    expect(worst).toBeLessThan(6 * DEG);
    expect(Math.abs(b.roll - rest.roll)).toBeLessThan(0.5 * DEG);
    expect(Math.abs(b.pitch - rest.pitch)).toBeLessThan(0.5 * DEG);
    expect(finite).toBe(true);
  });
});
