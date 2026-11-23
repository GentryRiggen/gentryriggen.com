import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { lusitania } from "../../ships";
import { type Opening, type ShipSpec, hullOpenings } from "../../ships/types";
import { SIM_STEP_S } from "../constants";
import {
  FINISHER_SPOT,
  hitTimeS,
  simulate,
  torpedoHitXs,
  torpedoHits,
  whatIfOpenings,
  whatIfRealIds,
  whatIfSpots,
} from "../run";
import type { SimTrack } from "../track";
import { TORPEDO_BULKHEADS, torpedoShip, torpedoWingShip } from "./testShips";

/**
 * Torpedo ships with their own hits (`spec.torpedo`, the Carpathia's
 * format): one hole per chosen compartment, on her own side, in her own
 * order and gap, a hole across a bulkhead opening both spaces, and a last
 * torpedo as its own spot. A ship without it keeps the Lusitania's rule.
 */

/** Every combination of `k` items, in their order. */
function combinations<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  const out: T[][] = [];
  items.forEach((item, i) => {
    for (const rest of combinations(items.slice(i + 1), k - 1))
      out.push([item, ...rest]);
  });
  return out;
}

function finite(track: SimTrack) {
  for (const f of track.frames)
    for (const b of f.bodies)
      for (const v of [b.x, b.y, b.z, b.pitch, b.roll, b.yaw])
        expect(Number.isFinite(v)).toBe(true);
}

const ship = torpedoShip();
const ids = Array.from({ length: 9 }, (_, i) => `c${i}`);
const middle = (i: number) =>
  (TORPEDO_BULKHEADS[i] + TORPEDO_BULKHEADS[i + 1]) / 2;
const hull = (spec: ShipSpec, spots: readonly string[]): Opening[] =>
  hullOpenings(whatIfOpenings(spec, spots));

describe("a torpedo ship's own hits", () => {
  it("spots are the compartments then the finisher", () => {
    expect(FINISHER_SPOT).toBe("finisher");
    expect(whatIfSpots(ship)).toEqual([...ids, FINISHER_SPOT]);
    const noFinisher = { ...ship.torpedo!, finisher: undefined };
    expect(whatIfSpots({ ...ship, torpedo: noFinisher })).toEqual(ids);
  });

  it("a hole across a bulkhead opens both spaces", () => {
    const open = hull(ship, ["c5"]);
    expect(open).toHaveLength(2);
    const c5 = open.find((o) => o.compartmentId === "c5")!;
    const c4 = open.find((o) => o.compartmentId === "c4")!;
    expect(c5.areaM2 + c4.areaM2).toBeCloseTo(6, 9);
    // 5 m of the 8 m hole is forward of the bulkhead, 3 m aft of it.
    expect(Math.abs(c5.areaM2 - 6 * (5 / 8))).toBeLessThan(1e-9);
    expect(Math.abs(c4.areaM2 - 6 * (3 / 8))).toBeLessThan(1e-9);
    for (const o of open) {
      expect(o.side).toBe("port");
      expect([o.zLow, o.zHigh]).toEqual([3, 7]);
      expect(o.t ?? 0).toBe(0);
    }
    // Each piece sits at least 0.5 m inside its own compartment.
    const bh = TORPEDO_BULKHEADS[5];
    expect(c5.x).toBeGreaterThanOrEqual(bh + 0.5);
    expect(c5.x).toBeLessThanOrEqual(bh + 5);
    expect(c4.x).toBeLessThanOrEqual(bh - 0.5);
    expect(c4.x).toBeGreaterThanOrEqual(bh - 3);
    // The hit itself is where the hole's middle is.
    expect(torpedoHits(ship, ["c5"])).toEqual([
      { x: bh + 1, t: 0, side: "port", finisher: false },
    ]);
    // A hit at a compartment's middle stays in it.
    expect(hull(ship, ["c4"])).toEqual([
      {
        compartmentId: "c4",
        areaM2: 6,
        zLow: 3,
        zHigh: 7,
        x: middle(4),
        side: "port",
      },
    ]);
  });

  it("hits land forward first, staggerS apart", () => {
    const open = hull(ship, ["c4", "c1", "c7"]);
    expect(open.map((o) => [o.compartmentId, o.t ?? 0])).toEqual([
      ["c7", 0],
      ["c4", 8],
      ["c1", 16],
    ]);
    expect(torpedoHits(ship, ["c4", "c1", "c7"])).toEqual([
      { x: middle(7), t: 0, side: "port", finisher: false },
      { x: middle(4), t: 8, side: "port", finisher: false },
      { x: middle(1), t: 16, side: "port", finisher: false },
    ]);
    // Aft first: the most aft at 0.
    const aftFirst: ShipSpec = {
      ...ship,
      torpedo: { ...ship.torpedo!, order: "aft-first" },
    };
    expect(
      hull(aftFirst, ["c4", "c1", "c7"]).map((o) => [o.compartmentId, o.t ?? 0])
    ).toEqual([
      ["c1", 0],
      ["c4", 8],
      ["c7", 16],
    ]);
    // Unknown spots and repeats add nothing.
    expect(hull(ship, ["c4", "c4", "nope"])).toEqual(hull(ship, ["c4"]));
    expect(whatIfOpenings(ship, [])).toEqual([]);
  });

  it("the finisher lands at its own time", () => {
    expect(hull(ship, [FINISHER_SPOT])).toEqual([
      {
        compartmentId: "c1",
        areaM2: 6,
        zLow: 3,
        zHigh: 7,
        x: middle(1),
        side: "port",
        t: 600,
      },
    ]);
    expect(torpedoHits(ship, [FINISHER_SPOT])).toEqual([
      { x: middle(1), t: 600, side: "port", finisher: true },
    ]);
    // After the others, whatever order the ids come in.
    expect(
      torpedoHits(ship, [FINISHER_SPOT, "c2", "c6"]).map((h) => [
        h.t,
        h.finisher,
      ])
    ).toEqual([
      [0, false],
      [8, false],
      [600, true],
    ]);
  });

  it("real ids give the real run", () => {
    const real = ship.torpedo!.realSpots;
    expect(whatIfRealIds(ship)).toEqual(real);
    const spec: ShipSpec = { ...ship, realNight: hull(ship, real) };
    expect(whatIfOpenings(spec, whatIfRealIds(spec))).toEqual(spec.realNight);
    expect(spec.realNight.map((o) => o.t ?? 0)).toEqual([0, 8, 8, 600]);
  });

  it("torpedoHitXs gives her hits' xs, aft first", () => {
    expect(torpedoHitXs(ship, ["c7", "c2", FINISHER_SPOT])).toEqual([
      middle(1),
      middle(2),
      middle(7),
    ]);
  });

  describe("in the sim", () => {
    let one: SimTrack;
    let three: SimTrack;
    beforeAll(() => {
      one = simulate(ship, whatIfOpenings(ship, ["c4"]), { endT: 1800 });
      three = simulate(
        ship,
        whatIfOpenings(ship, ["c4", "c7", FINISHER_SPOT]),
        {
          endT: 900,
        }
      );
    });

    it("a port hit lists her to port", () => {
      // A full-breadth hold floods level; a wing bunker on the struck side
      // takes the hole and lists her toward it (negative: to port).
      const wing = torpedoWingShip();
      const open = hull(wing, ["c4"]);
      expect(open.map((o) => [o.compartmentId, o.side])).toEqual([
        ["c4-port", "port"],
      ]);
      const port = simulate(wing, open, { endT: 1800 });
      const last = port.frames[port.frames.length - 1];
      expect(last.listDeg).toBeLessThan(-1);
      finite(port);
      finite(one);
      // The same hit on her starboard side: the mirror.
      const stbd: ShipSpec = {
        ...wing,
        torpedo: { ...wing.torpedo!, side: "starboard" },
      };
      const run = simulate(stbd, hull(stbd, ["c4"]), { endT: 1800 });
      expect(run.frames[run.frames.length - 1].listDeg).toBeCloseTo(
        -last.listDeg,
        6
      );
    });

    it("torpedo-hit events", () => {
      const hits = three.events.filter((e) => e.kind === "torpedo-hit");
      expect(hits.map((e) => e.index)).toEqual([2, 3]);
      // At the step the hit lands.
      for (const [e, t] of [
        [hits[0], 8],
        [hits[1], 600],
      ] as const) {
        expect(e.t).toBeGreaterThanOrEqual(t);
        expect(e.t).toBeLessThan(t + SIM_STEP_S);
      }
      finite(three);
      expect(one.events.some((e) => e.kind === "torpedo-hit")).toBe(false);
      // A ship without `torpedo` never has one, timed holes or not.
      const plain: ShipSpec = { ...ship, torpedo: undefined };
      const timed = hull(ship, ["c4", "c7"]);
      const run = simulate(plain, timed, { endT: 60 });
      expect(timed.some((o) => (o.t ?? 0) > 0)).toBe(true);
      expect(run.events.some((e) => e.kind === "torpedo-hit")).toBe(false);
    });

    it("a late torpedo still lands on a hull that has gone still", () => {
      // The finisher alone, an hour in: until then she floats undamaged
      // and still (steady is only tested after 30 minutes). She must not
      // freeze as steady before it comes.
      const base = torpedoShip();
      const late: ShipSpec = {
        ...base,
        torpedo: { ...base.torpedo!, finisher: { spotId: "c1", t: 3600 } },
      };
      const run = simulate(late, hull(late, [FINISHER_SPOT]));
      finite(run);
      const hits = run.events.filter((e) => e.kind === "torpedo-hit");
      expect(hits.map((e) => [e.index, Math.floor(e.t)])).toEqual([[1, 3600]]);
      const steady = run.events.find((e) => e.kind === "floating-steady");
      expect(steady === undefined || steady.t > 3600).toBe(true);
      const after = run.frames.find((f) => f.t >= 3600 + 300)!;
      expect(after.waterAboardT).toBeGreaterThan(100);
    });
  });
});

const LUSITANIA_FIXTURE = join(__dirname, "fixtures", "lusitaniaWhatIf.json");
const update = process.env.UPDATE_GOLDEN === "1";

describe("the Lusitania rule is untouched", () => {
  const spots = whatIfSpots(lusitania);
  const sets = [1, 2, 3].flatMap((k) => combinations(spots, k));

  it("gives the 1.3 openings for every set of one to three spots", () => {
    const now: Record<string, unknown> = {};
    for (const set of sets) now[set.join("+")] = whatIfOpenings(lusitania, set);
    if (update) {
      writeFileSync(LUSITANIA_FIXTURE, `${JSON.stringify(now)}\n`);
      return;
    }
    const then = JSON.parse(readFileSync(LUSITANIA_FIXTURE, "utf8"));
    expect(Object.keys(then)).toHaveLength(sets.length);
    expect(JSON.parse(JSON.stringify(now))).toEqual(then);
  });

  it("torpedoHits are her torpedoHitXs at hitTimeS", () => {
    expect(lusitania.torpedo).toBeUndefined();
    expect(spots).not.toContain(FINISHER_SPOT);
    for (const set of sets) {
      const xs = torpedoHitXs(lusitania, set);
      const hits = torpedoHits(lusitania, set);
      expect(hits.map((h) => h.x)).toEqual(xs);
      expect(hits.map((h) => h.t)).toEqual(
        xs.map((_, k) => hitTimeS(k, xs.length))
      );
      for (const h of hits) {
        expect(h.side).toBe("starboard");
        expect(h.finisher).toBe(false);
      }
    }
  });
});
