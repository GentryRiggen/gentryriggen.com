import { CARPATHIA_HIT_T, carpathia } from "../../ships";
import { BOW_PLOUGH_M, END_T } from "../constants";
import { FINISHER_SPOT, simulate, whatIfOpenings, whatIfSpots } from "../run";
import type { BodyPose, SimTrack } from "../track";

/**
 * RMS Carpathia's last morning, 17 July 1918: two torpedoes into her port
 * side 8 s apart at 9:15 AM, a slow settle by the head with a slight list
 * to port, still afloat when U-55's third torpedo strikes aft at 10:50 AM,
 * then gone within minutes, bow first (the sinking photograph), upright
 * on a 150 m floor. All from the
 * physics: the scripted events are only the steam, the rockets and the
 * boats. `listDeg` is + to starboard, so her port list is negative.
 *
 * The What-if matrix (every single spot, every pair, all nine, each with
 * and without the U-boat's return) is `carpathiaWhatIf.test.ts`, in the
 * sims lane; this file keeps the real run and a fast sample.
 */

const DEG = Math.PI / 180;
const { second: SECOND_T, third: THIRD_T } = CARPATHIA_HIT_T;

/** Earth z of a ship-frame point for a pose (Rz·Ry·Rx; z needs no yaw). */
function earthZ(p: BodyPose, x: number, y: number, z: number): number {
  const cp = Math.cos(p.pitch);
  return (
    p.z -
    Math.sin(p.pitch) * x +
    cp * Math.sin(p.roll) * y +
    cp * Math.cos(p.roll) * z
  );
}

function eventT(track: SimTrack, kind: string): number | undefined {
  return track.events.find((e) => e.kind === kind)?.t;
}

function finite(track: SimTrack): boolean {
  return track.frames.every((f) =>
    f.bodies.every((b) =>
      [b.x, b.y, b.z, b.pitch, b.roll, b.yaw].every(Number.isFinite)
    )
  );
}

/** The track ends inside END_T: afloat and steady, or every part at rest. */
function endsWell(track: SimTrack): void {
  expect(finite(track)).toBe(true);
  expect(track.endT).toBeLessThanOrEqual(END_T + 1e-6);
  const last = track.frames[track.frames.length - 1];
  if (track.outcome === "sank")
    expect(last.groundedParts).toEqual(last.bodies.map((b) => b.part));
}

const sank = (track: SimTrack) => track.sankAtT ?? Infinity;

describe("the real morning", () => {
  let track: SimTrack;
  beforeAll(() => {
    track = simulate(carpathia, carpathia.realNight);
  });

  it("is hit at 9:15, 8 s later, and at 10:50 AM, and logs the later torpedoes", () => {
    const times = [...new Set(carpathia.realNight.map((o) => o.t ?? 0))];
    expect(times.sort((a, b) => a - b)).toEqual([0, SECOND_T, THIRD_T]);
    expect(SECOND_T).toBe(8);
    expect(THIRD_T).toBe(5700);
    const hits = track.events.filter((e) => e.kind === "torpedo-hit");
    expect(hits.map((e) => [e.index, e.t])).toEqual([
      [2, SECOND_T],
      [3, THIRD_T],
    ]);
    expect(eventT(track, "collision")).toBe(0);
  });

  it("lists to port: 0.5–10° at 9:25, never past 15° before the third torpedo", () => {
    const at600 = track.frames.find((f) => f.t >= 600)!;
    expect(at600.listDeg).toBeLessThanOrEqual(-0.5);
    expect(at600.listDeg).toBeGreaterThanOrEqual(-10);
    for (const f of track.frames.filter((fr) => fr.t < THIRD_T))
      expect(f.listDeg).toBeGreaterThanOrEqual(-15);
  });

  it("is down by the head from 9:25 until the third torpedo", () => {
    for (const f of track.frames.filter((fr) => fr.t >= 600 && fr.t <= THIRD_T))
      expect(f.trimDeg).toBeGreaterThan(0);
  });

  it("goes down by the head: the bow first, the stern the last part under (the sinking photograph)", () => {
    const under = track.sankAtT as number;
    expect(eventT(track, "bow-under")!).toBeLessThan(under);
    expect(eventT(track, "forecastle-under")!).toBeLessThan(under);
    // Her bow is down as the stern goes under (by the head, not past
    // the vertical).
    const f = track.frames.find((fr) => fr.t >= under)!;
    expect(f.trimDeg).toBeGreaterThan(0);
    expect(f.trimDeg).toBeLessThan(90);
    // Her last three minutes afloat are all by the head.
    for (const fr of track.frames.filter(
      (x) => x.t >= under - 180 && x.t <= under
    ))
      expect(fr.trimDeg).toBeGreaterThan(0);
  });

  it("settles nearly level as No. 5 hold fills (never 1° by the stern)", () => {
    // The third torpedo's water aft brings her briefly to about 0.8° by
    // the stern before her forward holds take her down (README, "Known
    // limits"); the photograph shows her by the head.
    for (const f of track.frames.filter(
      (fr) => fr.t >= THIRD_T && fr.t <= (track.sankAtT as number)
    ))
      expect(f.trimDeg).toBeGreaterThan(-1);
  });

  // Spec ruling R20 (a brief stern dip): after the third torpedo she may
  // lie up to 1° by the stern for at most 10 minutes, in one stretch, while
  // No. 5 hold fills; then she is by the head again until her stern goes.
  it("dips by the stern once, briefly, after the third torpedo (ruling R20)", () => {
    const under = track.sankAtT as number;
    const after = track.frames.filter((fr) => fr.t >= THIRD_T && fr.t <= under);
    for (const f of after) expect(f.trimDeg).toBeGreaterThanOrEqual(-1);
    let byStern = 0;
    for (let i = 1; i < after.length; i += 1)
      if (after[i - 1].trimDeg <= 0) byStern += after[i].t - after[i - 1].t;
    expect(byStern).toBeLessThanOrEqual(600);
    // One dip: from the first frame back by the head to stern-under, every
    // frame is by the head.
    const start = after.findIndex((f) => f.trimDeg <= 0);
    if (start < 0) return;
    const end = after.findIndex((f, i) => i > start && f.trimDeg > 0);
    expect(end).toBeGreaterThan(start);
    for (const f of after.slice(end)) expect(f.trimDeg).toBeGreaterThan(0);
  });

  it("is still afloat at 10:50 AM, her forecastle deck edge out of the water", () => {
    for (const kind of ["bow-under", "stern-under", "forecastle-under"])
      expect(eventT(track, kind) ?? Infinity).toBeGreaterThan(THIRD_T);
    const f = track.frames.find((fr) => fr.t >= THIRD_T)!;
    expect(f.bodies).toHaveLength(1);
    const pose = f.bodies[0];
    // The highest forward point of her hull: the stem station's top, both
    // sides (the forecastle deck edge).
    const stem = carpathia.stations[carpathia.stations.length - 1];
    const [z, hb] = stem.offsets[stem.offsets.length - 1];
    expect(earthZ(pose, stem.x, hb, z)).toBeGreaterThan(0);
    expect(earthZ(pose, stem.x, -hb, z)).toBeGreaterThan(0);
  });

  it("is gone between 10:55 and 11:50 AM (Wikipedia 11:00, GOL about 11:45)", () => {
    expect(track.outcome).toBe("sank");
    expect(track.sankAtT).toBe(eventT(track, "stern-under"));
    expect(track.sankAtT).toBeGreaterThanOrEqual(6000);
    expect(track.sankAtT).toBeLessThanOrEqual(9300);
  });

  it("does not break up before she is wholly under", () => {
    const broke = eventT(track, "breakup");
    expect(broke === undefined || broke >= (track.sankAtT as number)).toBe(
      true
    );
  });

  it("comes to rest upright on the floor, listed a little to port", () => {
    const last = track.frames[track.frames.length - 1];
    expect(last.groundedParts).toEqual(last.bodies.map((b) => b.part));
    for (const b of last.bodies) {
      expect(Math.abs(b.roll / DEG)).toBeLessThanOrEqual(15);
      expect(b.roll).toBeLessThan(0);
      expect(b.z).toBeLessThan(-carpathia.seaDepthM + 30);
    }
  });

  it("comes to rest along the floor, her stem no deeper in the mud than the plough rule", () => {
    let lowest = Infinity;
    simulate(carpathia, carpathia.realNight, {
      probe: (p) => {
        if (!p.bodies.some((b) => b.mode === "float"))
          lowest = Math.min(lowest, p.lowestZ);
      },
    });
    // Bow first: her stem ploughs into the mud (the 1.0 rule).
    expect(lowest).toBeGreaterThanOrEqual(
      -carpathia.seaDepthM - BOW_PLOUGH_M - 3
    );
    const last = track.frames[track.frames.length - 1];
    // Along the floor, a little bow down (her stem bedded in the mud).
    expect(last.bodies[0].pitch / DEG).toBeGreaterThanOrEqual(0);
    expect(last.bodies[0].pitch / DEG).toBeLessThan(8);
  });

  // Ruling R22: a 170 m hull in 150 m of water lands her bow as her stern
  // goes under; the stern then comes down at the rate the water allows
  // (descent.ts, `pivotRate`), in real time.
  describe("her way down is seen (R22)", () => {
    /** Earth z of her stern's top (the counter at the upper deck). */
    const sternTop = (p: BodyPose) =>
      earthZ(
        p,
        carpathia.stations[0].x,
        0,
        carpathia.sheerZ(carpathia.stations[0].x)
      );

    it("takes at least 20 s from stern-under to rest, shown in real time", () => {
      expect(carpathia.descentTimeScale).toBe(1);
      const under = track.sankAtT as number;
      expect(track.endT - under).toBeGreaterThanOrEqual(20);
      const after = track.frames.filter((f) => f.t >= under);
      for (let i = 1; i < after.length; i += 1)
        expect(after[i].t - after[i - 1].t).toBeCloseTo(
          after[i].realT - after[i - 1].realT,
          6
        );
    });

    // The drag balance (R22) gives about 13.7 m/s for her; 12.2 m/s is
    // measured. 15 m/s leaves room for an honest retune, not a door swing.
    it("lowers her stern no faster than 15 m/s (the water's limit, about 12 m/s at her steepest swing)", () => {
      const under = track.sankAtT as number;
      let prev: { realT: number; z: number } | null = null;
      let fastest = 0;
      for (const f of track.frames) {
        if (f.t < under) continue;
        const z = sternTop(f.bodies[0]);
        if (prev && f.realT > prev.realT)
          fastest = Math.max(
            fastest,
            Math.abs(z - prev.z) / (f.realT - prev.realT)
          );
        prev = { realT: f.realT, z };
      }
      expect(fastest).toBeGreaterThan(3);
      expect(fastest).toBeLessThanOrEqual(15);
    });

    it("lands her bow first and her stern at least 10 s later", () => {
      const bow = eventT(track, "bow-lands")!;
      const stern = eventT(track, "stern-lands")!;
      expect(bow).toBeGreaterThanOrEqual(track.sankAtT as number);
      expect(stern - bow).toBeGreaterThanOrEqual(10);
      expect(stern).toBeLessThanOrEqual(track.endT);
    });

    it("ends inside END_T with finite poses", () => {
      endsWell(track);
    });
  });

  it("has steam, rockets and eleven boats while she floats, and no wireless", () => {
    const on = eventT(track, "steam-start")!;
    const off = eventT(track, "steam-stop")!;
    expect(on).toBeGreaterThan(SECOND_T);
    expect(off).toBeGreaterThan(on);
    const rockets = track.events.filter((e) => e.kind === "rocket");
    expect(rockets.length).toBeGreaterThanOrEqual(3);
    for (const r of rockets) expect(r.t).toBeLessThanOrEqual(20 * 60);
    const boats = track.events.filter((e) => e.kind === "boat-lowered");
    expect(boats).toHaveLength(11);
    expect(eventT(track, "last-boat")).toBe(boats[10].t);
    expect(eventT(track, "radio")).toBeUndefined();
  });

  it("is deterministic", () => {
    expect(simulate(carpathia, carpathia.realNight)).toEqual(track);
  });

  describe("What if? (a fast sample; the whole matrix is in the sims lane)", () => {
    it("without the U-boat's return she sinks no earlier (the physics: later, by the head)", () => {
      const ids = carpathia.torpedo!.realSpots.filter(
        (id) => id !== FINISHER_SPOT
      );
      const run = simulate(carpathia, whatIfOpenings(carpathia, ids));
      endsWell(run);
      expect(sank(run)).toBeGreaterThanOrEqual(sank(track));
    });

    it("one torpedo at the boiler room floats, or sinks no earlier", () => {
      const run = simulate(carpathia, whatIfOpenings(carpathia, ["boiler"]));
      endsWell(run);
      expect(sank(run)).toBeGreaterThanOrEqual(sank(track));
    });

    it("every spot at once, with the U-boat's return: finite, sunk quickly", () => {
      const run = simulate(
        carpathia,
        whatIfOpenings(carpathia, whatIfSpots(carpathia))
      );
      endsWell(run);
      expect(run.outcome).toBe("sank");
      expect(sank(run)).toBeLessThan(sank(track));
    });

    it("the U-boat's torpedo alone: a quiet morning, then hit at 10:50 AM", () => {
      const openings = whatIfOpenings(carpathia, [FINISHER_SPOT]);
      expect(openings.every((o) => "t" in o && o.t === THIRD_T)).toBe(true);
      const run = simulate(carpathia, openings);
      endsWell(run);
      const hits = run.events.filter((e) => e.kind === "torpedo-hit");
      expect(hits.map((e) => [e.index, e.t])).toEqual([[1, THIRD_T]]);
      // Her hold took its water: she did not freeze as steady before it came.
      const after = run.frames.find((f) => f.t >= THIRD_T + 120)!;
      expect(after.waterAboardT).toBeGreaterThan(1000);
    });

    it("the U-boat's torpedo alone: no rockets, steam or boats before it hits", () => {
      const run = simulate(
        carpathia,
        whatIfOpenings(carpathia, [FINISHER_SPOT])
      );
      const scripted = run.events.filter((e) =>
        [
          "rocket",
          "steam-start",
          "steam-stop",
          "boat-lowered",
          "last-boat",
        ].includes(e.kind)
      );
      expect(scripted.length).toBeGreaterThan(0);
      for (const e of scripted) expect(e.t).toBeGreaterThan(THIRD_T);
      // Each as long after her first hit as in the real morning.
      const real = track.events.filter((e) => e.kind === "rocket");
      const late = run.events.filter((e) => e.kind === "rocket");
      expect(late.map((e) => e.t - THIRD_T)).toEqual(
        real.slice(0, late.length).map((e) => e.t)
      );
    });
  });
});
