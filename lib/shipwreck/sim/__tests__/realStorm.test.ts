import { fitzgerald } from "../../ships";
import type { ShipSpec } from "../../ships/types";
import { BREAK_DAMAGE_M, END_T } from "../constants";
import type { Body } from "../body";
import {
  type SimOptions,
  simulate,
  whatIfOpenings,
  whatIfRealIds,
} from "../run";
import type { BodyPose, SimTrack } from "../track";

/**
 * The Edmund Fitzgerald's last afternoon (10 November 1975, from her 3:30
 * PM report): the storm's own waves over her deck and her topside damage
 * flood her through the evening, the "three sisters" just after 7:10 PM
 * take her hatch covers, and she dives; the bow strikes the floor 162 m
 * down while her stern is still up, she breaks, and the stern lands
 * upside down. Then her What-if storms, covers, damage and shoal.
 */

const DEG = Math.PI / 180;
const T_530 = 2 * 3600; // 5:30 PM
const T_710 = 3 * 3600 + 40 * 60; // 7:10 PM
const T_725 = T_710 + 15 * 60; // 7:25 PM
const T_700 = 3 * 3600 + 30 * 60; // 7:00 PM
const T_900 = 5 * 3600 + 30 * 60; // 9:00 PM

function at(track: SimTrack, t: number) {
  return track.frames.find((f) => f.t >= t) ?? track.frames.at(-1)!;
}
function event(track: SimTrack, kind: string) {
  return track.events.find((e) => e.kind === kind);
}

/** Earth z of a ship-frame point (x, 0, z) of a body. */
function earthZ(b: BodyPose, x: number, z: number): number {
  return b.z - Math.sin(b.pitch) * x + Math.cos(b.pitch) * Math.cos(b.roll) * z;
}

/** The highest point of her hull and houses aft of x0 (earth z). */
function highestAft(spec: ShipSpec, b: BodyPose, x0: number): number {
  let top = -Infinity;
  for (const s of spec.stations)
    if (s.x <= x0) top = Math.max(top, earthZ(b, s.x, spec.sheerZ(s.x)));
  for (const box of spec.superstructure)
    for (const x of [box.fromX, box.toX])
      if (x <= x0) top = Math.max(top, earthZ(b, x, box.topZ));
  return top;
}

/** Earth (x, y) of a ship-frame point (x, 0, z) of a body. */
function earthXY(b: BodyPose, x: number): [number, number] {
  const c = Math.cos(b.pitch) * x;
  return [b.x + Math.cos(b.yaw) * c, b.y + Math.sin(b.yaw) * c];
}

describe("the Fitzgerald's last afternoon", () => {
  let track: SimTrack;
  /** Water let in by 7:00 PM (m³): through her deck openings, and the rest. */
  const by700 = { deck: 0, other: 0 };
  beforeAll(() => {
    let taken = false;
    track = simulate(fitzgerald, fitzgerald.realNight, {
      probe: (p) => {
        if (taken || p.t < T_700) return;
        taken = true;
        for (const b of p.bodies as Body[])
          for (const c of b.all) {
            by700.deck += c.deckIn;
            by700.other += c.seaIn;
          }
      },
    });
  });

  it("takes the storm's water over her deck and the graze's through her bottom", () => {
    // Ruling R14 (her real run reconstructs all the reported damage): by
    // 7:00 PM the storm's waves have let about 490 m³ in over her deck
    // (hatch covers, vents, the deck-edge split: all of her holds' water),
    // and the graze on Six Fathom Shoal floods her forward tanks faster
    // than her pumps clear them (about 12,700 m³ let in, most of it pumped
    // out again). R14 retires round 1's "60% through the deck" goal; the
    // storm is what sinks her (the still-water test below).
    expect(by700.deck).toBeGreaterThan(300);
    expect(by700.other).toBeGreaterThan(0);
    const f = at(track, T_700);
    const holds = fitzgerald.compartments
      .map((c, i) => (c.id.startsWith("hold") ? f.water[i] : 0))
      .reduce((a, v) => a + v, 0);
    expect(holds).toBeGreaterThan(0);
  });

  it("does not sink in still water: her damage alone is not enough", () => {
    // The storm taken away (no waves, no shelter to end the run): all of
    // her real damage (topside, the leaking covers, the graze) sinks
    // nothing before 9:00 PM. She lists about 6° and floats: the storm is
    // what sinks her.
    const calm = simulate(
      { ...fitzgerald, storm: undefined, shelter: undefined },
      fitzgerald.realNight,
      { endT: T_900 }
    );
    expect(calm.sankAtT).toBeNull();
    expect(calm.outcome).toBe("floated");
    expect(calm.events.some((e) => e.kind === "hatch-fails")).toBe(false);
  });

  it("keeps her funnel, and plays her dive in real time (R11)", () => {
    // Her welded stack does not fall (the liners' stays rule is theirs).
    expect(event(track, "funnel-falls")).toBeUndefined();
    // descentTimeScale 1: shown time is real time to the end.
    const last = track.frames.at(-1)!;
    expect(last.t).toBeCloseTo(last.realT, 6);
    // The track carries the storm and its scale (the scene's sea).
    expect(track.storm).toBeDefined();
    expect(track.stormScale).toBe(1);
  });

  it("lists to starboard (1–8°) by 5:30 PM", () => {
    // Rulings R13 and R14: her topside damage alone gives her no list
    // (riding the waves, the sea tops her deck edge too rarely for the
    // vents and the split to out-run her two pumps); the graze on Six
    // Fathom Shoal in her real run gives the list she reported.
    const list = at(track, T_530).listDeg;
    expect(list).toBeGreaterThan(1);
    expect(list).toBeLessThan(8);
    const topside = simulate(fitzgerald, [], { endT: T_530 + 60 });
    expect(Math.abs(at(topside, T_530).listDeg)).toBeLessThan(1);
  });

  it("takes on water through the evening, still afloat at 7:10", () => {
    const water = [3600, T_530, 3 * 3600, T_710].map(
      (t) => at(track, t).waterAboardT
    );
    for (let i = 1; i < water.length; i += 1)
      expect(water[i]).toBeGreaterThan(water[i - 1]);
    const f = at(track, T_710);
    expect(f.bodies).toHaveLength(1);
    // Her bow's deck (the spar deck at the stem) over the still water.
    const stem = fitzgerald.stations[fitzgerald.stations.length - 1].x;
    expect(earthZ(f.bodies[0], stem, fitzgerald.sheerZ(stem))).toBeGreaterThan(
      0
    );
    expect(event(track, "bow-under")!.t).toBeGreaterThan(T_710);
  });

  it("meets the three sisters where she is", () => {
    // The run re-locks the group on her real path (her surge and all), and
    // its biggest crest passes within a few metres of her midships.
    const g = track.storm!.groups![0];
    const f = at(track, g.t);
    expect(Math.abs(f.bodies[0].x - g.x!)).toBeLessThan(5);
    expect(Math.abs(f.bodies[0].y - g.y!)).toBeLessThan(1);
  });

  it("a hatch cover gives way, then the bow goes under (7:10–7:25)", () => {
    const under = event(track, "bow-under")!.t;
    expect(under).toBeGreaterThanOrEqual(T_710);
    expect(under).toBeLessThanOrEqual(T_725);
    const fails = track.events.filter((e) => e.kind === "hatch-fails");
    expect(fails.length).toBeGreaterThan(0);
    expect(fails[0].t).toBeLessThan(under);
  });

  it("strikes the floor bow first within 3 minutes, as her stern goes under", () => {
    const under = event(track, "bow-under")!.t;
    const lands = event(track, "bow-lands")!;
    expect(lands.t - under).toBeLessThanOrEqual(180);
    // Ruling R9 (the USCG: "the submerged stern section"): as the bow
    // strikes, her stern's top is at the surface or within 5 m of it, and
    // the last of her goes under within 5 s (shown). In the real run the
    // after house's top is 0.25 m above and the stern's hull 1.47 m under
    // the still water then, and she is wholly under 0.3 s later.
    const sternUnder = event(track, "stern-under")!.t;
    expect(Math.abs(sternUnder - lands.t)).toBeLessThanOrEqual(5);
    const f = at(track, lands.t);
    const stern = f.bodies.find((b) => b.part !== "bow")!;
    expect(highestAft(fitzgerald, stern, 0)).toBeGreaterThan(-5);
  });

  it("the stern rolls over in the water, not on the floor (R10)", () => {
    // From the break it rolls at its stated rate: at least 150° over as it
    // first touches, and at most 20° more on the floor.
    const lands = event(track, "stern-lands")!;
    const after = track.frames.filter((f) => f.t >= lands.t);
    const roll = (f: (typeof after)[number]) =>
      Math.abs(f.bodies.find((b) => b.part === "stern")!.roll);
    expect(roll(after[0])).toBeGreaterThanOrEqual(150 * DEG);
    for (const f of after)
      expect(Math.abs(roll(f) - roll(after[0]))).toBeLessThanOrEqual(20 * DEG);
  });

  it("breaks as the bow strikes, before the stern lands", () => {
    const brk = event(track, "breakup")!.t;
    expect(brk).toBeGreaterThanOrEqual(event(track, "bow-lands")!.t);
    expect(brk).toBeLessThan(event(track, "stern-lands")!.t);
    expect(track.outcome).toBe("sank");
  });

  it("rests as surveyed: the bow upright, the stern upside down, apart", () => {
    const last = track.frames.at(-1)!;
    const bow = last.bodies.find((b) => b.part === "bow")!;
    const stern = last.bodies.find((b) => b.part === "stern")!;
    expect(Math.abs(bow.roll)).toBeLessThan(20 * DEG);
    expect(Math.abs(stern.roll)).toBeGreaterThanOrEqual(150 * DEG);
    // Ruling R8: the survey measured 170 ft (52 m) section to section,
    // the broken-up middle between them; here each part's torn end
    // (BREAK_DAMAGE_M either side of the break) is that middle, so each
    // end is offset by it before measuring.
    const x = track.breakX!;
    const [bx, by] = earthXY(bow, x + BREAK_DAMAGE_M);
    const [sx, sy] = earthXY(stern, x - BREAK_DAMAGE_M);
    const apart = Math.hypot(bx - sx, by - sy);
    expect(apart).toBeGreaterThanOrEqual(25);
    expect(apart).toBeLessThanOrEqual(150);
    // Neither part in the floor nor floating.
    for (const b of last.bodies) expect(b.z).toBeLessThan(-140);
  });
});

describe("the three sisters, when the record puts them", () => {
  // Ruling R15: the outcome rides on the group's time (README, the
  // sensitivity table: 7:06, 7:10, 7:14 and 7:18 float). The record:
  // Captain Cooper of the Anderson reported two very large seas about
  // 6:30 PM, roughly 10 miles astern of her: about 30 minutes of group
  // travel to reach her. The re-locked group must sit in 7:00–7:15 PM.
  it("re-locks the group inside the Anderson's window", () => {
    const track = simulate(fitzgerald, fitzgerald.realNight, {
      endT: T_710 + 5 * 60,
    });
    const t = track.storm!.groups![0].t;
    expect(t).toBeGreaterThanOrEqual(T_700);
    expect(t).toBeLessThanOrEqual(T_710 + 5 * 60);
  });
});

describe("the Fitzgerald's What if, by spot", () => {
  it("her real spots are her real afternoon", () => {
    const ids = simulate(
      fitzgerald,
      whatIfOpenings(fitzgerald, whatIfRealIds(fitzgerald))
    );
    expect(ids).toEqual(simulate(fitzgerald, fitzgerald.realNight));
  });

  it("no spots in a calmer storm: she makes Whitefish Bay", () => {
    const track = simulate(fitzgerald, whatIfOpenings(fitzgerald, []), {
      storm: "calmer",
    });
    expect(track.outcome).toBe("floated");
    expect(event(track, "sheltered")?.t).toBe(fitzgerald.shelter?.t);
    expect(track.events.some((e) => e.kind === "hatch-fails")).toBe(false);
  });
});

describe("the Fitzgerald's What-if matrix", () => {
  type Storm = NonNullable<SimOptions["storm"]>;
  interface Run {
    storm: Storm;
    tight: boolean;
    damage: boolean;
    shoal: boolean;
    track: SimTrack;
  }
  const runs: Run[] = [];
  beforeAll(() => {
    for (const storm of ["calmer", "real", "worse"] as const)
      for (const tight of [true, false])
        for (const damage of [false, true])
          for (const shoal of [false, true])
            runs.push({
              storm,
              tight,
              damage,
              shoal,
              // "damage" is her topside damage; the graze is `shoal`.
              track: simulate(fitzgerald, [], {
                storm,
                hatchesTight: tight,
                topsideDamage: damage,
                shoal,
              }),
            });
  });
  const sank = (r: Run) => r.track.sankAtT ?? Infinity;

  it("runs all 24, every one finite and ending inside endT", () => {
    expect(runs).toHaveLength(24);
    for (const r of runs) {
      const last = r.track.frames.at(-1)!;
      expect(last.t).toBeLessThanOrEqual(END_T);
      for (const f of r.track.frames)
        for (const b of f.bodies)
          for (const v of [b.x, b.y, b.z, b.pitch, b.roll, b.yaw])
            expect(Number.isFinite(v)).toBe(true);
      // Afloat at the end only in shelter.
      if (r.track.outcome === "floated")
        expect(event(r.track, "sheltered")).toBeDefined();
    }
  });

  it("never drops her funnel, and records each run's storm scale", () => {
    const scale: Record<Storm, number> = { calmer: 0.6, real: 1, worse: 1.25 };
    for (const r of runs) {
      expect(event(r.track, "funnel-falls")).toBeUndefined();
      expect(r.track.stormScale).toBe(scale[r.storm]);
    }
  });

  it("tight covers, no damage, a calmer storm: she reaches shelter", () => {
    const r = runs.find(
      (k) => k.storm === "calmer" && k.tight && !k.damage && !k.shoal
    )!;
    expect(r.track.outcome).toBe("floated");
    expect(event(r.track, "sheltered")).toBeDefined();
  });

  it("more damage never sinks her later, all else equal", () => {
    const rank: Record<Storm, number> = { calmer: 0, real: 1, worse: 2 };
    for (const a of runs)
      for (const b of runs) {
        const worse =
          rank[b.storm] >= rank[a.storm] &&
          (b.tight ? 0 : 1) >= (a.tight ? 0 : 1) &&
          Number(b.damage) >= Number(a.damage) &&
          Number(b.shoal) >= Number(a.shoal);
        const oneStep =
          Number(rank[b.storm] !== rank[a.storm]) +
            Number(b.tight !== a.tight) +
            Number(b.damage !== a.damage) +
            Number(b.shoal !== a.shoal) ===
          1;
        if (worse && oneStep) expect(sank(b)).toBeLessThanOrEqual(sank(a));
      }
  });
});
