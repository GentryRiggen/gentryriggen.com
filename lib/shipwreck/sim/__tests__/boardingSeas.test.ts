import type { DeckOpening, Opening, ShipSpec } from "../../ships/types";
import { HATCH_TIGHT_FAIL_FACTOR } from "../events";
import { simulate } from "../run";
import type { SimTrack } from "../track";
import { boardingElevation, stormComponents } from "../waves";
import { TANK_Y, boxShip, compartment, longShip, stormShip } from "./testShips";

/**
 * Storms and boarding seas: fresh water, deck openings flooded by the
 * storm's own waves, hatch covers that give way, pumps, shelter and steady
 * headway, on a 200 m box laker with a hold, side tanks and three hatches.
 */

const STORM = {
  components: stormComponents({ hsM: 7.6, peakPeriodS: 9.5, dirDeg: 0 }),
  hsM: 7.6,
  windKn: 50,
};

function hatch(more: Partial<DeckOpening> = {}): DeckOpening {
  return {
    id: "h",
    compartmentId: "hold",
    kind: "hatch",
    x: 0,
    y: 0,
    z: 12.6,
    areaM2: 0.02,
    ...more,
  };
}

/** Water aboard (t) in the frame at or after shown time t. */
function aboardAt(track: SimTrack, t: number): number {
  return (track.frames.find((f) => f.t >= t) ?? track.frames.at(-1)!)
    .waterAboardT;
}

/** Fill (0..1) of a compartment at or after shown time t. */
function fillAt(track: SimTrack, spec: ShipSpec, id: string, t: number) {
  const i = spec.compartments.findIndex((c) => c.id === id);
  return (track.frames.find((f) => f.t >= t) ?? track.frames.at(-1)!).water[i];
}

describe("boarding seas", () => {
  it("fresh water floats her deeper", () => {
    // The same box at the same mass, in sea water and in fresh water.
    const salt = boxShip({
      length: 200,
      beam: 24,
      depth: 12,
      draught: 8,
      kg: 8,
      compartments: [compartment("hold", -100, 100, 12)],
    });
    const fresh: ShipSpec = { ...salt, waterDensity: 1000 };
    const draughtOf = (s: ShipSpec) =>
      -simulate(s, [], { endT: 1 }).frames[0].bodies[0].z;
    const dSalt = draughtOf(salt);
    const dFresh = draughtOf(fresh);
    expect(dSalt).toBeCloseTo(8, 1);
    // A box: volume is draught, so 1025/1000 deeper.
    expect(dFresh / dSalt).toBeCloseTo(1025 / 1000, 3);
  });

  it("no storm, no water", () => {
    const track = simulate(stormShip(), [], { endT: 1800 });
    for (const f of track.frames) expect(f.waterAboardT).toBe(0);
    expect(track.events.some((e) => e.kind === "hatch-fails")).toBe(false);
  });

  it("a lower deck ships more water", () => {
    const at = (draught: number) =>
      aboardAt(
        simulate(stormShip({ draught, extra: { storm: STORM } }), [], {
          endT: 1800,
        }),
        1800
      );
    const light = at(8.5);
    const deep = at(9.3);
    expect(light).toBeGreaterThan(0);
    expect(deep).toBeGreaterThan(1.5 * light);
  });

  it("the storm's What-ifs: calmer ships less, worse more", () => {
    const ship = stormShip({ extra: { storm: STORM } });
    const of = (storm: "real" | "calmer" | "worse") =>
      aboardAt(simulate(ship, [], { endT: 1800, storm }), 1800);
    const real = of("real");
    expect(of("calmer")).toBeLessThan(0.5 * real);
    expect(of("worse")).toBeGreaterThan(1.5 * real);
  });

  it("water through a vent fills its tank and lists her", () => {
    const vent = (side: "port" | "starboard"): DeckOpening => ({
      id: "v",
      compartmentId: side === "port" ? "tank-p" : "tank-s",
      kind: "vent",
      // A vent pipe broken off at the deck.
      x: 30,
      y: (side === "port" ? 1 : -1) * 11,
      z: 12,
      areaM2: 0.3,
    });
    const ship = stormShip({
      extra: { storm: STORM, deckOpenings: [vent("starboard")] },
    });
    const track = simulate(ship, [], { endT: 3600 });
    expect(fillAt(track, ship, "tank-s", 3600)).toBeGreaterThan(0.01);
    expect(fillAt(track, ship, "tank-p", 3600)).toBe(0);
    expect(fillAt(track, ship, "hold", 3600)).toBe(0);
    // + is a list to starboard.
    expect(track.frames.at(-1)!.listDeg).toBeGreaterThan(0.4);
    // A port vent lists her the other way; with no topside damage, none.
    const port = stormShip({
      extra: { storm: STORM, deckOpenings: [vent("port")] },
    });
    expect(
      simulate(port, [], { endT: 3600 }).frames.at(-1)!.listDeg
    ).toBeLessThan(-0.4);
    const intact = simulate(ship, [], { endT: 3600, topsideDamage: false });
    expect(intact.frames.at(-1)!.waterAboardT).toBe(0);
    expect(TANK_Y).toBeLessThan(11);
  });

  it("a hatch gives way under enough green water", () => {
    const withCovers = (failHeadM?: number) =>
      stormShip({
        extra: {
          storm: STORM,
          deckOpenings: [
            hatch({ id: "h1", x: 60, failHeadM, failedAreaM2: 4 }),
            hatch({ id: "h2", x: 0 }),
          ],
        },
      });
    // The most water a wave (to second order, as the deck sees it) stands
    // over hatch 1's lip in the hour (she
    // floats at 8.5 m, the lip 4.1 m up, drifting to port at 0.02 m/s):
    // a cover that gives way at 0.55 of it fails, a tight one (twice that)
    // never does.
    let most = 0;
    for (let t = 0; t < 3600; t += 0.25)
      most = Math.max(most, boardingElevation(STORM, 60, 0.02 * t, t) - 4.1);
    expect(most).toBeGreaterThan(1);
    const ship = withCovers(0.55 * most);
    const track = simulate(ship, [], { endT: 3600 });
    const fails = track.events.filter((e) => e.kind === "hatch-fails");
    expect(fails).toHaveLength(1);
    // No. 1, the forward hatch (spec order).
    expect(fails[0].index).toBe(1);
    const tf = fails[0].t;
    expect(tf).toBeGreaterThan(0);
    expect(tf).toBeLessThan(3000);
    // Until then, the same as covers that never give way.
    const holding = simulate(withCovers(undefined), [], { endT: 3600 });
    expect(holding.events.some((e) => e.kind === "hatch-fails")).toBe(false);
    expect(aboardAt(track, tf - 1)).toBe(aboardAt(holding, tf - 1));
    // From then the hold floods much faster.
    const rate = (tr: SimTrack) =>
      (aboardAt(tr, 3600) - aboardAt(tr, tf)) / (3600 - tf);
    expect(rate(track)).toBeGreaterThan(5 * rate(holding));
    expect(fillAt(track, ship, "hold", 3600)).toBeGreaterThan(
      10 * fillAt(holding, ship, "hold", 3600)
    );
    // Tight covers hold twice the head: the same storm does not break
    // them, and they leak nothing.
    expect(HATCH_TIGHT_FAIL_FACTOR).toBe(2);
    const tight = simulate(ship, [], { endT: 3600, hatchesTight: true });
    expect(tight.events.some((e) => e.kind === "hatch-fails")).toBe(false);
    expect(tight.frames.at(-1)!.waterAboardT).toBe(0);
  });

  it("a deck opening with a time leaks only from then", () => {
    const late = stormShip({
      extra: {
        storm: STORM,
        deckOpenings: [hatch({ areaM2: 0.5, t: 1200 })],
      },
    });
    const track = simulate(late, [], { endT: 2400 });
    expect(aboardAt(track, 1199)).toBe(0);
    expect(aboardAt(track, 2400)).toBeGreaterThan(0);
  });

  it("the shoal What-if adds her grounding damage", () => {
    const rake: Opening[] = [
      {
        compartmentId: "tank-s",
        areaM2: 0.05,
        zLow: 0.2,
        zHigh: 0.6,
        x: 60,
        side: "starboard",
      },
    ];
    const ship = stormShip({ extra: { shoalOpenings: rake } });
    const off = simulate(ship, [], { endT: 1200 });
    expect(aboardAt(off, 1200)).toBe(0);
    const on = simulate(ship, [], { endT: 1200, shoal: true });
    expect(fillAt(on, ship, "tank-s", 1200)).toBeGreaterThan(0);
    expect(on.frames.at(-1)!.listDeg).toBeGreaterThan(0);
  });

  it("pumps hold off a small leak", () => {
    // About 0.034 m³/s through a hole low in the hold.
    const leak: Opening[] = [
      {
        compartmentId: "hold",
        areaM2: 0.005,
        zLow: 1.9,
        zHigh: 2.1,
        x: 0,
        side: "starboard",
      },
    ];
    const noPumps = simulate(stormShip(), leak, { endT: 3600 });
    const pumped = simulate(stormShip({ extra: { pumpsM3s: 0.1 } }), leak, {
      endT: 3600,
    });
    expect(aboardAt(noPumps, 3600)).toBeGreaterThan(50);
    // Never more than a step's leak aboard.
    for (const f of pumped.frames) expect(f.waterAboardT).toBeLessThan(0.1);
  });

  it("she reaches shelter", () => {
    const ship = stormShip({
      extra: {
        storm: STORM,
        deckOpenings: [],
        shelter: { t: 3600, name: "the bay" },
      },
    });
    const track = simulate(ship, []);
    expect(track.outcome).toBe("floated");
    expect(track.endT).toBeGreaterThanOrEqual(3600);
    expect(track.endT).toBeLessThan(3601);
    expect(track.frames.at(-1)!.t).toBe(track.endT);
    const e = track.events.at(-1)!;
    expect(e.kind).toBe("sheltered");
    expect(e.t).toBe(track.endT);
  });

  it("steady way", () => {
    // Afloat all the way: she keeps her speed.
    const way = { startMs: 7 };
    const ship = stormShip();
    const still = simulate(ship, [], { endT: 3000 });
    const moving = simulate({ ...ship, headway: way }, [], { endT: 3000 });
    for (const s of [600, 1800, 3000]) {
      const k = moving.frames.findIndex((f) => f.t >= s);
      const f = moving.frames[k];
      expect(f.bodies[0].x - still.frames[k].bodies[0].x).toBeCloseTo(
        7 * f.realT,
        6
      );
    }
    // Sinking (deep sea, holed at the bow): steady until the bow goes
    // under, then her way goes (it halves in HEADWAY_LOST_HALF_LIFE_S).
    const holes: Opening[] = [
      {
        compartmentId: "h9",
        areaM2: 1.5,
        zLow: 1,
        zHigh: 4,
        x: 90,
        side: "starboard",
      },
      {
        compartmentId: "h8",
        areaM2: 1,
        zLow: 1,
        zHigh: 4,
        x: 70,
        side: "starboard",
      },
    ];
    const long = longShip();
    const sinkStill = simulate(long, holes);
    const sinkMoving = simulate({ ...long, headway: way }, holes);
    // Flooding is untouched by it.
    expect(sinkMoving.events.map((e) => [e.kind, e.t])).toEqual(
      sinkStill.events.map((e) => [e.kind, e.t])
    );
    const under = sinkMoving.events.find((e) => e.kind === "bow-under")!;
    const offset = (t: number) => {
      const k = sinkMoving.frames.findIndex((f) => f.t >= t);
      const a = sinkMoving.frames[k].bodies[0];
      const b = sinkStill.frames[k].bodies[0];
      return { d: a.x - b.x, realT: sinkMoving.frames[k].realT };
    };
    const before = offset(under.t - 60);
    expect(before.d).toBeCloseTo(7 * before.realT, 4);
    // Long after: no more than 7 m/s × 45 s / ln 2 beyond the way at bow-under.
    const end = offset(sinkMoving.frames.at(-1)!.t);
    const atUnder = offset(under.t);
    expect(end.d - atUnder.d).toBeLessThan((7 * 45) / Math.LN2 + 10);
    expect(end.d - atUnder.d).toBeGreaterThan(0);
  });
});
