import type { ShipSpec } from "../../ships/types";
import type { Body } from "../body";
import { BOW_PLOUGH_M } from "../constants";
import { createSimRunner, whatIfOpenings, whatIfSpots } from "../run";
import type { SimTrack } from "../track";
import { keelUpShip } from "./testShips";

const DEG = Math.PI / 180;
const DEPTH = 600;

/** The keel-up box with leaking holds (she sinks keel up), on a 600 m floor. */
function sinker(extra: Partial<ShipSpec> = {}): ShipSpec {
  return keelUpShip(0.3, { extra: { seaDepthM: DEPTH, ...extra } });
}

/** A run with the whole hull's lowest box point at the end (the probe). */
function run(
  spec: ShipSpec,
  openings = whatIfOpenings(spec, whatIfSpots(spec))
) {
  let boxBottom = Infinity;
  const runner = createSimRunner(spec, openings, {
    endT: 3000,
    probe: (p) => {
      const b = p.bodies[0] as Body;
      boxBottom = Infinity;
      for (const c of b.boxes) boxBottom = Math.min(boxBottom, c.zMin);
    },
  });
  runner.advance(Infinity);
  return { track: runner.track(), boxBottom };
}

/** Frames from when she is wholly under to the end. */
function dive(track: SimTrack) {
  const under = track.events.find((e) => e.kind === "stern-under");
  if (!under) throw new Error("she never went under");
  return track.frames.filter((f) => f.t >= under.t);
}

const rollDeg = (track: SimTrack) =>
  dive(track).map((f) => f.bodies[0].roll / DEG);

describe("the dive keel up (a rule)", () => {
  const keelUp = run(sinker({ wreck: { restDeg: 180, minListDeg: 120 } }));

  it("sinks keel up and lands on the floor", () => {
    const t = keelUp.track;
    expect(t.outcome).toBe("sank");
    expect(t.events.map((e) => e.kind)).toEqual(
      expect.arrayContaining(["capsized", "bow-under", "stern-under"])
    );
  });

  it("keeps |roll| ≥ 150° all the way down and lands at 180 ± 10", () => {
    const rolls = rollDeg(keelUp.track);
    expect(rolls.length).toBeGreaterThan(20);
    for (const r of rolls) expect(Math.abs(r)).toBeGreaterThanOrEqual(150);
    expect(Math.abs(Math.abs(rolls[rolls.length - 1]) - 180)).toBeLessThan(10);
  });

  it("dives bow down as every ship does", () => {
    const pitches = dive(keelUp.track).map((f) => f.bodies[0].pitch / DEG);
    expect(Math.max(...pitches)).toBeGreaterThan(20);
  });

  it("meets the floor with her superstructure no deeper than a plough", () => {
    const spec = sinker({
      wreck: { restDeg: 180, minListDeg: 120 },
      superstructure: [{ fromX: -20, toX: 20, topZ: 16, id: "house" }],
      trappedAir: { leakM2: { hold: 0.3, box: 5 } },
    });
    const house = {
      compartmentId: "house",
      areaM2: 2,
      zLow: 12,
      zHigh: 13,
      x: 0,
      side: "port" as const,
      t: 30,
    };
    const r = run(spec, [...whatIfOpenings(spec, ["k2"]), house]);
    expect(r.track.outcome).toBe("sank");
    const rolls = rollDeg(r.track);
    for (const x of rolls) expect(Math.abs(x)).toBeGreaterThanOrEqual(150);
    expect(r.boxBottom).toBeGreaterThan(-DEPTH - BOW_PLOUGH_M - 1);
  });
});

/** Her list (degrees, 0..180) however far round she has rolled. */
const listDeg = (roll: number) =>
  Math.abs(Math.atan2(Math.sin(roll * DEG), Math.cos(roll * DEG))) / DEG;

describe("the 1.0 dive, unchanged without it", () => {
  // Her roll eases upright as she falls (the 1.0 dive); she lands with the
  // 1.0 rest (upright) or, with a wreck rule, the list she landed with.
  it.each([
    ["no wreck", {}, 10],
    ["restDeg under 150", { wreck: { restDeg: 120, minListDeg: 60 } }, 90],
  ] as const)("%s: she turns upright on the way down", (_, extra, most) => {
    const { track } = run(sinker(extra));
    expect(track.outcome).toBe("sank");
    const lists = rollDeg(track).map(listDeg);
    expect(lists[0]).toBeGreaterThan(150);
    expect(Math.min(...lists)).toBeLessThan(90);
    expect(lists[lists.length - 1]).toBeLessThan(most);
  });
});

describe("the keel-under rule (a rule)", () => {
  /** A run with when her keel went under (shown s), or -1. */
  function keelRun(extra: Partial<ShipSpec>) {
    const spec = sinker(extra);
    let latchT = -1;
    const runner = createSimRunner(
      spec,
      whatIfOpenings(spec, whatIfSpots(spec)),
      {
        endT: 3000,
        probe: (p) => {
          const b = p.bodies[0] as Body;
          if (latchT < 0 && b.keelUnder) latchT = p.t;
        },
      }
    );
    runner.advance(Infinity);
    return { track: runner.track(), latchT };
  }
  const lean = (deg: number) => {
    const l = ((deg % 360) + 360) % 360;
    return Math.min(l, 360 - l);
  };

  it("eases her keel up from when her keel goes under, listed as she is (tcg 2 m)", () => {
    const { track, latchT } = keelRun({
      wreck: { restDeg: 180, minListDeg: 120 },
      tcg: 2,
    });
    const cap = track.events.find((e) => e.kind === "capsized")!;
    const under = track.events.find((e) => e.kind === "stern-under")!;
    expect(latchT).toBeGreaterThan(cap.t);
    expect(latchT).toBeLessThan(under.t);
    const leans = track.frames
      .filter((f) => f.t >= cap.t)
      .map((f) => lean(f.listDeg));
    expect(Math.min(...leans)).toBeGreaterThanOrEqual(90);
    expect(leans[leans.length - 1]).toBeGreaterThan(170);
  });

  it("never applies to a wreck that rests other than keel up", () => {
    const { track, latchT } = keelRun({
      wreck: { restDeg: 120, minListDeg: 60 },
      tcg: 2,
    });
    expect(latchT).toBe(-1);
    expect(lean(track.frames[track.frames.length - 1].listDeg)).toBeLessThan(
      90
    );
  });
});
