import { type Body, staticForces } from "../body";
import { BOX_PERMEABILITY, GRAV, RHO } from "../constants";
import { createSimRunner } from "../run";
import { TOWER, towerShip } from "./testShips";

/**
 * Her superstructure is most of a cruise ship's height, so the righting
 * lever past the deck edge is the deckhouse's as much as the hull's. The
 * tower ship (a 14 m box hull with a 30 m deckhouse box along her whole
 * length, so every section is the same and the curve is two-dimensional)
 * at 0–90° in 10° steps, against the analytic GZ of its section clipped by
 * the sea: the dry deckhouse buoyant, and flooded to the sea's level (its
 * water where it came in), buoyant only by what water cannot fill.
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
 * The analytic GZ (m, + righting) at heel `roll` (+ to starboard, as the
 * sim's): find the heave whose displaced area (the deckhouse's counted
 * `house` times) floats her, then the lever between B and G across the
 * earth. Earth z of a section point is heave + sin(roll)·y + cos(roll)·z.
 */
function analyticGz(roll: number, kg: number, house: number): number {
  const area0 = TOWER.beam * TOWER.draught;
  const sub = (h: number) => {
    const f = ([y, z]: P) => h + Math.sin(roll) * y + Math.cos(roll) * z;
    const a = clip(HULL, f);
    const b = clip(HOUSE, f);
    const area = a.area + house * b.area;
    return {
      area,
      cy: (a.area * a.cy + house * b.area * b.cy) / area,
      cz: (a.area * a.cz + house * b.area * b.cz) / area,
    };
  };
  let lo = -80;
  let hi = 20;
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

/** The tower ship's body as the sim builds it (after settling). */
function towerBody(): Body {
  let body: Body | null = null;
  const runner = createSimRunner(towerShip(), [], {
    endT: 1,
    probe: (p) => {
      body = body ?? (p.bodies[0] as Body);
    },
  });
  runner.advance(Infinity);
  if (!body) throw new Error("no body");
  return body;
}

/**
 * The sim's GZ at heel `roll`: the heave where her buoyancy carries her
 * weight (`staticForces`, the floating step's own sums), then the lever
 * from its roll moment over her weight. Flooded: the deckhouse holds water to the sea's
 * level (its permeable share of what is under).
 */
function simGz(b: Body, roll: number, flooded: boolean): number {
  const box = b.boxes[0];
  b.pitch = 0;
  b.roll = roll;
  const at = (z: number) => {
    b.z = z;
    box.water = 0;
    let f = staticForces(b);
    if (flooded) {
      box.water = box.perm * box.seaVol;
      f = staticForces(b);
    }
    return f;
  };
  let lo = -80;
  let hi = 20;
  for (let k = 0; k < 200; k += 1) {
    const mid = (lo + hi) / 2;
    const f = at(mid);
    if (f.fb > f.weight) lo = mid;
    else hi = mid;
  }
  const f = at((lo + hi) / 2);
  // The moment over her own weight: water in the flooded deckhouse is the
  // sea's, not part of her.
  return -f.tauR / (b.lightMass * GRAV);
}

describe("the righting lever of a hull with a tall deckhouse", () => {
  const b = towerBody();
  const kg = towerShip().kg;

  it("the tower ship floats at her draught upright", () => {
    expect(b.mass).toBeCloseTo(
      TOWER.length * TOWER.beam * TOWER.draught * RHO,
      -3
    );
  });

  for (const flooded of [false, true]) {
    const house = flooded ? 1 - BOX_PERMEABILITY : 1;
    for (let deg = 0; deg <= 90; deg += 10) {
      it(`${flooded ? "flooded" : "dry"} deckhouse at ${deg}°`, () => {
        const want = analyticGz(deg * DEG, kg, house);
        const got = simGz(b, deg * DEG, flooded);
        // 3% of the lever, or 3 cm where it crosses zero.
        expect(Math.abs(got - want)).toBeLessThanOrEqual(
          0.03 * Math.abs(want) + 0.03
        );
      });
    }
  }

  it("the dry deckhouse holds her up past the deck edge; flooded it does not", () => {
    const dry = analyticGz(60 * DEG, kg, 1);
    const wet = analyticGz(60 * DEG, kg, 1 - BOX_PERMEABILITY);
    expect(dry).toBeGreaterThan(1);
    expect(wet).toBeLessThan(0);
  });
});
