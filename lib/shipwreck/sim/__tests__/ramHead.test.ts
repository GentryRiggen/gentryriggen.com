import type { Opening, ShipSpec } from "../../ships/types";
import type { Body } from "../body";
import { GRAV } from "../constants";
import { simulate } from "../run";
import type { SimOptions } from "../run";
import { threeShip } from "./testShips";

/**
 * Ram head (1.4, the Britannic steaming on with her bow open): openings
 * at or forward of `ram.fromX` see the sea's head plus a dynamic head
 * Cp·u²/2g from her speed, so they flood as the orifice law gives for the
 * larger head.
 */

const CP = 0.8;
const FROM_X = 20;
/** Small and low, so the hold's water stays under it for the whole run
 *  and the flow is the sea's head (about 3.5 m) through the orifice. */
const BOW: Opening = {
  compartmentId: "C",
  areaM2: 0.01,
  zLow: 1,
  zHigh: 2,
  x: 50,
  side: "starboard",
};
const AFT: Opening = { ...BOW, compartmentId: "A", x: -40 };

const ship = (u: number): ShipSpec =>
  threeShip({
    extra: { headway: { startMs: u, ram: { cp: CP, fromX: FROM_X } } },
  });

/** Hold `i`'s inflow (m³/s) through the run, by shown time. */
function inflows(
  u: number,
  holes: Opening[],
  i: number,
  opts: SimOptions = {}
): Map<number, number> {
  const out = new Map<number, number>();
  const track = simulate(ship(u), holes, {
    endT: 1600,
    ...opts,
    probe: (p) => {
      const t = Math.round(p.t);
      if (Math.abs(p.t - t) < 1e-9)
        out.set(t, (p.bodies[0] as Body).cells[i].inflow);
    },
  });
  expect(track.endT).toBeGreaterThanOrEqual(1600);
  return out;
}

describe("ram head", () => {
  it("floods a bow opening faster at speed, by the orifice law", () => {
    const fast = inflows(10, [BOW], 2);
    const still = inflows(0, [BOW], 2);
    // The sea's head over the hole's middle: draught less 1.5 m.
    const h = 5 - 1.5;
    const want = Math.sqrt((h + (CP * 10 * 10) / (2 * GRAV)) / h);
    for (const t of [10, 60, 120]) {
      const ratio = (fast.get(t) as number) / (still.get(t) as number);
      expect(Math.abs(ratio / want - 1)).toBeLessThan(0.05);
    }
  });

  it("leaves an opening aft of fromX alone", () => {
    const fast = inflows(10, [AFT], 0);
    const still = inflows(0, [AFT], 0);
    for (const t of [10, 120, 1200])
      expect(fast.get(t)).toBeCloseTo(still.get(t) as number, 12);
  });

  it("enginesStopped: the gain goes once she has lost way", () => {
    const stopped = inflows(10, [BOW], 2, { enginesStopped: true });
    const still = inflows(0, [BOW], 2);
    // Still moving early on: a gain.
    expect(
      (stopped.get(10) as number) / (still.get(10) as number)
    ).toBeGreaterThan(1.2);
    // Ten half-lives on she has no way left: no gain.
    const late = (stopped.get(1500) as number) / (still.get(1500) as number);
    expect(Math.abs(late - 1)).toBeLessThan(0.01);
  });
});
