import type { Opening, ShipSpec } from "../../ships/types";
import { simulate } from "../run";
import type { SimTrack } from "../track";
import { towerShip } from "./testShips";

/**
 * The rest aground (`ShipSpec.aground`, a rule, not physics, like `wreck`):
 * the tower ship, listed a little to starboard and flooded aft, finds a
 * 25 m floor with her stern at about 15°; from there her roll follows the
 * pace to her rest, never back, her lowest point on the floor every step;
 * `aground` once, then `floating-steady`, outcome "aground". Shown time
 * runs `agroundTimeScale` slower after it. Listed less than `minListDeg`,
 * or never touching: no rule; no `aground`: no change.
 */

const FLOOR = 25;
/** Past the 828 s her stern touches the 25 m floor, when a rule would begin. */
const PAST_TOUCH_S = 1200;
const aftHoles: Opening[] = [0, 1, 2].map((i) => ({
  compartmentId: `h${i}`,
  areaM2: 1.5,
  zLow: 1,
  zHigh: 3,
  x: -90 + 20 * i,
  side: "port",
}));
const RULE: NonNullable<ShipSpec["aground"]> = {
  restDeg: 65,
  minListDeg: 10,
  pace: [
    [0, 0],
    [1200, 30],
    [1800, 40],
    [3600, 65],
  ],
};

function ship(more: Partial<ShipSpec> = {}, seaDepthM = FLOOR): ShipSpec {
  return { ...towerShip({ tcg: -0.3, seaDepthM }), aground: RULE, ...more };
}

interface Run {
  track: SimTrack;
  lowest: { t: number; z: number }[];
}

/** `endT`: long enough for her rest (3,600 s); a run that never rests
 *  (no rule, or never touching) needs only to pass her touch at 828 s. */
function run(spec: ShipSpec, endT = 7200): Run {
  const lowest: Run["lowest"] = [];
  const track = simulate(spec, aftHoles, {
    endT,
    probe: (p) => lowest.push({ t: p.t, z: p.lowestZ }),
  });
  return { track, lowest };
}

function eventsOf(track: SimTrack, kind: string) {
  return track.events.filter((e) => e.kind === kind);
}

describe("the rest aground", () => {
  let real: Run;
  beforeAll(() => {
    real = run(ship());
  });

  it("begins once, when she touches listed past minListDeg", () => {
    const [a, ...more] = eventsOf(real.track, "aground");
    expect(a).toBeDefined();
    expect(more).toHaveLength(0);
    const lands = eventsOf(real.track, "stern-lands")[0];
    expect(lands).toBeDefined();
    expect(a.t).toBeGreaterThanOrEqual(lands.t);
    const at = real.track.frames.find((f) => f.t >= a.t)!;
    expect(at.listDeg).toBeGreaterThan(12);
    expect(at.listDeg).toBeLessThan(20);
  });

  it("eases to her rest along the pace, never back", () => {
    const a = eventsOf(real.track, "aground")[0];
    // From the step it began (its event carries that step's start).
    const after = real.track.frames.filter((f) => f.t > a.t);
    for (let i = 1; i < after.length; i += 1)
      expect(after[i].listDeg).toBeGreaterThanOrEqual(after[i - 1].listDeg);
    const last = after[after.length - 1];
    expect(last.listDeg).toBeCloseTo(65, 6);
    // Along the report's pace: 40° at 1,800 s real.
    const mid = after.find((f) => f.realT >= 1800)!;
    expect(mid.listDeg).toBeCloseTo(40, 0);
    expect(last.realT).toBeCloseTo(3600, -1);
  });

  it("keeps her lowest point on the floor every step", () => {
    const a = eventsOf(real.track, "aground")[0];
    for (const s of real.lowest)
      if (s.t > a.t) expect(Math.abs(s.z + FLOOR)).toBeLessThanOrEqual(0.3);
  });

  it("logs floating-steady at rest and ends aground", () => {
    const a = eventsOf(real.track, "aground")[0];
    const steady = eventsOf(real.track, "floating-steady");
    expect(steady).toHaveLength(1);
    expect(steady[0].t).toBeGreaterThan(a.t);
    expect(real.track.outcome).toBe("aground");
    expect(eventsOf(real.track, "stern-under")).toHaveLength(0);
  });

  it("with agroundTimeScale, shown time runs slower after it", () => {
    const fast = run(ship({ agroundTimeScale: 6 })).track;
    const a = eventsOf(fast, "aground")[0];
    const before = fast.frames.filter((f) => f.t <= a.t);
    for (const f of before) expect(f.realT).toBeCloseTo(f.t, 6);
    const after = fast.frames.filter((f) => f.t > a.t + 1);
    expect(after.length).toBeGreaterThan(100);
    const first = after[0];
    for (const f of after)
      expect(f.realT - first.realT).toBeCloseTo(6 * (f.t - first.t), 6);
    const last = fast.frames[fast.frames.length - 1];
    expect(last.listDeg).toBeCloseTo(65, 6);
    expect(fast.outcome).toBe("aground");
  });

  it("a pace that stops short of restDeg rests where it ends", () => {
    const short = {
      ...RULE,
      pace: [
        [0, 0],
        [1200, 30],
        [1800, 40],
      ] as const,
    };
    const track = run(ship({ aground: short })).track;
    expect(eventsOf(track, "floating-steady")).toHaveLength(1);
    expect(track.outcome).toBe("aground");
    const last = track.frames[track.frames.length - 1];
    expect(last.realT).toBeLessThanOrEqual(1800 + 1);
    expect(last.listDeg).toBeCloseTo(40, 0);
  });

  it("listed less than minListDeg: no rule", () => {
    const track = run(
      ship({ aground: { ...RULE, minListDeg: 25 } }),
      PAST_TOUCH_S
    ).track;
    expect(eventsOf(track, "aground")).toHaveLength(0);
    expect(track.outcome).not.toBe("aground");
  });

  it("never touching, or no aground field: no change", () => {
    const deep = run(ship({}, 3000), PAST_TOUCH_S).track;
    expect(eventsOf(deep, "aground")).toHaveLength(0);
    expect(deep).toEqual(
      run(ship({ aground: undefined }, 3000), PAST_TOUCH_S).track
    );
    const none = run(ship({ aground: undefined }), PAST_TOUCH_S).track;
    expect(eventsOf(none, "aground")).toHaveLength(0);
    expect(none.outcome).toBe("floated");
  });
});
