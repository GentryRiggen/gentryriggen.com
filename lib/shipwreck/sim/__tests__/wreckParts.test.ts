import type { Opening, ShipSpec } from "../../ships/types";
import { BOW_PLOUGH_M } from "../constants";
import { simulate } from "../run";
import type { BodyPose, SimTrack } from "../track";
import { longShip } from "./testShips";

/**
 * A wreck in two parts lying differently (`wreckParts`): a 200 m box in
 * 120 m of sea, flooded at the bow, dives, strikes the floor with her
 * stern still up and breaks; the bow rests upright, the stern (with the
 * capsize rule) upside down.
 */

const SEA = 120;
const L = 200;
const DEG = 180 / Math.PI;
const bowHoles: Opening[] = [
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
/** Strong enough afloat (peak about 3.6 GN·m), not with her bow on the floor. */
const GIRDER = { hogMaxNm: 3.75e9, sagMaxNm: 3.75e9 };
/** The stern capsizes; the bow keeps the 1.0 rest (upright). */
const CAPSIZE: ShipSpec["wreckParts"] = {
  stern: { capsize: true, restDeg: 180 },
};

interface Run {
  track: SimTrack;
  lowest: number;
  finite: boolean;
}

function run(sea: number, extra: Partial<ShipSpec>): Run {
  let lowest = Infinity;
  let finite = true;
  const track = simulate(
    longShip({ seaDepthM: sea, extra: { girder: GIRDER, ...extra } }),
    bowHoles,
    {
      probe: (p) => {
        lowest = Math.min(lowest, p.lowestZ);
        for (const b of p.bodies)
          for (const v of [b.x, b.y, b.z, b.pitch, b.roll, b.yaw])
            if (!Number.isFinite(v)) finite = false;
      },
    }
  );
  return { track, lowest, finite };
}

function eventT(track: SimTrack, kind: string): number {
  const e = track.events.find((x) => x.kind === kind);
  expect(e).toBeDefined();
  return e!.t;
}

function rest(track: SimTrack, part: BodyPose["part"]): BodyPose {
  const end = track.frames[track.frames.length - 1];
  const p = end.bodies.find((b) => b.part === part);
  expect(p).toBeDefined();
  return p!;
}

describe("a wreck in two parts", () => {
  let capsized: Run;
  let plain: Run;
  beforeAll(() => {
    capsized = run(SEA, { wreckParts: CAPSIZE });
    plain = run(SEA, {});
  });

  it("dives, strikes the floor with her stern up, and breaks", () => {
    const { track } = capsized;
    expect(track.outcome).toBe("sank");
    const lands = eventT(track, "bow-lands");
    const breaks = eventT(track, "breakup");
    expect(breaks).toBeGreaterThan(lands);
    expect(breaks).toBeLessThanOrEqual(eventT(track, "stern-lands"));
    // The same physics with or without the rule, up to the break.
    expect(plain.track.brokeAtT).toBe(track.brokeAtT);
    expect(plain.track.breakX).toBe(track.breakX);
  });

  it("the bow rests upright, the stern upside down", () => {
    const bow = rest(capsized.track, "bow");
    expect(Math.abs(bow.roll * DEG)).toBeLessThan(20);
    const stern = rest(capsized.track, "stern");
    expect(Math.abs(stern.roll * DEG)).toBeGreaterThanOrEqual(150);
  });

  it("nothing goes through the floor", () => {
    for (const r of [capsized, plain]) {
      expect(r.finite).toBe(true);
      expect(r.lowest).toBeGreaterThanOrEqual(-SEA - BOW_PLOUGH_M - 0.5);
    }
    // Upside down, the stern's deck lies on the floor, not in it: it is
    // re-seated as it rolls, at no more than its crush.
    const stern = rest(capsized.track, "stern");
    const deckZ = stern.z + Math.cos(stern.pitch) * Math.cos(stern.roll) * 14;
    expect(deckZ).toBeGreaterThanOrEqual(-SEA - 6);
    expect(deckZ).toBeLessThanOrEqual(-SEA + 0.5);
  });

  it("the parts lie less than her length apart", () => {
    for (const r of [capsized, plain]) {
      const bow = rest(r.track, "bow");
      const stern = rest(r.track, "stern");
      expect(Math.abs(bow.x - stern.x)).toBeLessThan(L);
    }
  });

  it("without wreckParts, the 1.0 rest", () => {
    // Both upright (the goldens hold the Titanic and the Lusitania).
    expect(Math.abs(rest(plain.track, "bow").roll * DEG)).toBeLessThan(5);
    expect(Math.abs(rest(plain.track, "stern").roll * DEG)).toBeLessThan(10);
  });

  it("the stern's rule wins over the ship's wreck", () => {
    // spec.wreck alone: each part keeps the list it lands with (level
    // here); with wreckParts.stern the stern still capsizes, and the bow,
    // with no rule of its own, keeps spec.wreck's.
    const wreck = { restDeg: 75, minListDeg: 10 };
    const byWreck = run(SEA, { wreck });
    expect(Math.abs(rest(byWreck.track, "stern").roll * DEG)).toBeLessThan(10);
    const both = run(SEA, { wreck, wreckParts: CAPSIZE });
    expect(
      Math.abs(rest(both.track, "stern").roll * DEG)
    ).toBeGreaterThanOrEqual(150);
    expect(rest(both.track, "bow").roll).toBe(rest(byWreck.track, "bow").roll);
  });

  it("a stern that falls rolls over on the way down", () => {
    // Deep sea and a weaker girder: she breaks afloat, and the stern
    // falls 1,000 m, rolling at STERN_CAPSIZE_DEG_S: over when it lands.
    let finite = true;
    const track = simulate(
      longShip({
        seaDepthM: 1000,
        extra: {
          girder: { hogMaxNm: 3e9, sagMaxNm: 3e9 },
          wreckParts: CAPSIZE,
        },
      }),
      bowHoles,
      {
        probe: (p) => {
          for (const b of p.bodies)
            if (![b.x, b.z, b.roll].every(Number.isFinite)) finite = false;
        },
      }
    );
    expect(finite).toBe(true);
    const under = eventT(track, "stern-under");
    const lands = eventT(track, "stern-lands");
    expect(lands).toBeGreaterThan(under);
    const at = track.frames.find((f) => f.t > lands)!;
    const stern = at.bodies.find((b) => b.part === "stern")!;
    expect(Math.abs(stern.roll * DEG)).toBeGreaterThanOrEqual(150);
    // It went under upright.
    const before = track.frames.find((f) => f.t >= under)!;
    const s0 = before.bodies.find((b) => b.part === "stern")!;
    expect(Math.abs(s0.roll * DEG)).toBeLessThan(20);
  });
});
