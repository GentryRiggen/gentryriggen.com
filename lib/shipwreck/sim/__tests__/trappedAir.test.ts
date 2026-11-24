import type { Opening, ShipSpec } from "../../ships/types";
import { airHeadM, gasOutflow } from "../air";
import { type Body, stepFloat } from "../body";
import {
  AIR_DENSITY,
  CD_OPENING,
  GRAV,
  P_ATM,
  RHO,
  SIM_STEP_S,
} from "../constants";
import { simulate } from "../run";
import {
  bodyOf,
  boxShip,
  compartment,
  hold,
  longShip,
  threeShip,
} from "./testShips";

/**
 * Trapped air (`ShipSpec.trappedAir`, sim README "Trapped air") on box
 * test ships: a sealed space's water stands below the sea's level by its
 * air's Boyle head, a box ship keel up floats on her air, a stated leak
 * lets it out at the gas orifice rate, and air never comes back in under
 * water. Without `trappedAir` nothing changes (the goldens prove it for
 * every ship; here an upright box ship open to the air floods the same).
 */

/** The water's head of one atmosphere (m): p_atm / ρg. */
const P = P_ATM / (RHO * GRAV);
const AIR = { trappedAir: { leakM2: {} } } as const;

/** Bisection for f(u) = 0 on [lo, hi] (f changes sign). */
function root(f: (u: number) => number, lo: number, hi: number): number {
  let a = lo;
  let b = hi;
  const fa = f(a);
  for (let k = 0; k < 200; k += 1) {
    const m = (a + b) / 2;
    if (f(m) > 0 === fa > 0) a = m;
    else b = m;
  }
  return (a + b) / 2;
}

/** A 100 m × 20 m box of one hold, `depth` deep, with trapped air. */
function pocketShip(depth: number, leak = 0): ShipSpec {
  return boxShip({
    length: 100,
    beam: 20,
    depth,
    draught: depth / 2,
    kg: depth / 2,
    compartments: [compartment("hold", -50, 50, depth)],
    extra: { trappedAir: { leakM2: leak > 0 ? { hold: leak } : {} } },
  });
}

const totalAir = (b: Body) => b.air!.mass.reduce((s, m) => s + m, 0);

describe("a sealed space held upside down", () => {
  // 8 m deep, its open face (the deck, the downflooding edge) 10 m down,
  // its keel 2 m under the sea.
  const depth = 8;
  const b = bodyOf(pocketShip(depth));
  const c = b.cells[0];
  hold(b, -2, Math.PI, 4000);

  it("is sealed and holds its water below the sea by its air's head", () => {
    // Boyle: its air (its whole volume at the surface) fills the space
    // above a surface u down: (u − 2)·(1 + u/P) = 8; its head is u.
    const u = root((v) => (v - 2) * (1 + v / P) - depth, 2, 10);
    expect(b.air!.sealed[0]).toBe(1);
    expect(Math.abs(-c.level - u)).toBeLessThan(0.01 * u);
    expect(Math.abs(b.air!.head[0] - u)).toBeLessThan(0.01 * u);
    // Its air is all still there: none left by an opening.
    expect(b.air!.mass[0]).toBeCloseTo(c.cap, 6);
  });

  it("stays at rest there (no flow either way)", () => {
    const before = c.water;
    hold(b, -2, Math.PI, 100);
    expect(Math.abs(c.water - before)).toBeLessThan(1e-3 * c.cap);
  });
});

describe("a box ship turned keel up", () => {
  // 100 m × 20 m × 12 m, five holds; keel up at about her Boyle draught.
  const D = 12;
  const spec = boxShip({
    length: 100,
    beam: 20,
    depth: D,
    draught: 5,
    kg: 6,
    compartments: Array.from({ length: 5 }, (_, i) =>
      compartment(`h${i}`, -50 + 20 * i, -30 + 20 * i, D)
    ),
    extra: AIR,
  });
  const b = bodyOf(spec);
  const perm = b.cells[0].perm;
  const area = 100 * 20;
  const t0 = b.lightMass / (RHO * area);
  b.roll = Math.PI;
  b.pitch = 0;
  b.z = 3;
  const airs: number[] = [];
  let finite = true;
  for (let k = 0; k < 3000; k += 1) {
    stepFloat(b, SIM_STEP_S, false, 0);
    airs.push(totalAir(b));
    finite &&= [b.z, b.roll, b.pitch].every(Number.isFinite);
  }

  it("floats at the Boyle draught", () => {
    // Her deck d down, each hold's surface u down: she floats on her air,
    // d·A = T0·A + perm·A·(d − u), and the air (each hold full at the
    // surface) fills the hold above it: D = (D − d + u)·(1 + u/P).
    const dOf = (u: number) => (t0 - perm * u) / (1 - perm);
    const u = root((v) => (D - dOf(v) + v) * (1 + v / P) - D, 0, D);
    const d = dOf(u);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(D);
    // Earth z of her deck (ship z = D): b.z + cos(roll)·D.
    const deck = -(b.z + Math.cos(b.roll) * D);
    expect(Math.abs(deck - d)).toBeLessThan(0.02 * d);
    expect(Math.abs(b.roll - Math.PI)).toBeLessThan(0.5 * (Math.PI / 180));
    expect(finite).toBe(true);
  });

  it("every hold is sealed, and her air never grows", () => {
    expect(Array.from(b.air!.sealed)).toEqual([1, 1, 1, 1, 1]);
    for (let k = 1; k < airs.length; k += 1)
      expect(airs[k]).toBeLessThanOrEqual(airs[k - 1] + 1e-9);
  });
});

describe("a stated leak", () => {
  // 12 m deep, its deck 10 m down, its keel 2 m out of the sea: its air
  // at about 5.6 m of head, the leak venting it to the open air at the top.
  const leak = 0.01;
  const b = bodyOf(pocketShip(12, leak));
  const c = b.cells[0];
  hold(b, 2, Math.PI, 600);

  it("lets the air out at the gas orifice rate", () => {
    let checked = 0;
    for (let k = 0; k < 20; k += 1) {
      const m0 = b.air!.mass[0];
      const vol = c.cap - c.water;
      const h = airHeadM(m0, vol, RHO);
      hold(b, 2, Math.PI, 1);
      const got = (m0 - b.air!.mass[0]) / SIM_STEP_S;
      // Q = Cd·A·√(2Δp/ρ_air) at its pressure, counted at the surface.
      const pAbs = P_ATM + RHO * GRAV * h;
      const rhoAir = (AIR_DENSITY * pAbs) / P_ATM;
      const want =
        CD_OPENING *
        leak *
        Math.sqrt((2 * RHO * GRAV * h) / rhoAir) *
        (pAbs / P_ATM);
      if (k === 0) expect(h).toBeGreaterThan(5);
      expect(Math.abs(got - want)).toBeLessThan(0.05 * want);
      checked += 1;
      hold(b, 2, Math.PI, 300);
    }
    expect(checked).toBe(20);
  });

  it("empties the pocket down to the sea's level; above it, air", () => {
    hold(b, 2, Math.PI, 60000);
    const h = b.air!.head[0];
    // What is left is the air above the sea (keel 2 m out), at the
    // surface's pressure.
    expect(Math.abs(h)).toBeLessThan(0.05);
    expect(Math.abs(c.level)).toBeLessThan(0.1);
    expect(b.air!.mass[0]).toBeLessThan(1.01 * (c.cap - c.water));
  });
});

describe("air never comes back in under water", () => {
  it("rising and rolling with every way out under the sea", () => {
    const b = bodyOf(pocketShip(8));
    let last = Infinity;
    // Keel up, the deck from 30 m down rising to 9 m, rolling ±20°.
    for (let k = 0; k <= 400; k += 1) {
      const z = -22 + (k / 400) * 21;
      const roll = Math.PI + 0.35 * Math.sin(k / 20);
      hold(b, z, roll, 1);
      const m = b.air!.mass[0];
      expect(m).toBeLessThanOrEqual(last + 1e-9);
      last = m;
    }
  });

  it("the pure laws: no head without air beyond the sea's, no flow back", () => {
    expect(airHeadM(100, 100, RHO)).toBe(0);
    expect(airHeadM(200, 100, RHO)).toBeCloseTo(P, 9);
    expect(gasOutflow(1, 0, P_ATM)).toBe(0);
    expect(gasOutflow(1, -1000, P_ATM)).toBe(0);
    expect(gasOutflow(1, 1000, P_ATM)).toBeGreaterThan(0);
  });
});

describe("without trapped air", () => {
  it("a body carries none", () => {
    expect(bodyOf(threeShip()).air).toBeUndefined();
  });

  it("an upright ship open to the air floods as she did without it", () => {
    const hole: Opening[] = [
      {
        compartmentId: "A",
        areaM2: 0.4,
        zLow: 1,
        zHigh: 2,
        x: -40,
        side: "port",
      },
    ];
    const opts = { endT: 2400 };
    const plain = simulate(threeShip(), hole, opts);
    const withAir = simulate(threeShip({ extra: AIR }), hole, opts);
    expect(withAir.frames.length).toBe(plain.frames.length);
    expect(withAir.frames).toEqual(plain.frames);
    expect(withAir.events).toEqual(plain.events);
  });

  it("an upright ship holed past saving sinks as she did without it", () => {
    // Air in her holds' ceilings goes up through her deck as the sea pours
    // in: it holds nothing up (the ceiling's exchange).
    const holes: Opening[] = [0, 1, 2, 3].map((i) => ({
      compartmentId: `h${i}`,
      areaM2: 3,
      zLow: 1,
      zHigh: 3,
      x: -90 + 20 * i,
      side: "starboard",
    }));
    const plain = simulate(longShip(), holes);
    const withAir = simulate(longShip({ extra: AIR }), holes);
    expect(plain.outcome).toBe("sank");
    expect(withAir.outcome).toBe("sank");
    expect(withAir.sankAtT!).toBeLessThan(1.15 * plain.sankAtT!);
  });
});
