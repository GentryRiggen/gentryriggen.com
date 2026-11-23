import { titanic } from "../../ships";
import type { Opening, ShipSpec } from "../../ships/types";
import { BOW_PLOUGH_M, END_T, STERN_CRUSH_M } from "../constants";
import { simulate } from "../run";
import { type BodyPose, type SimTrack, sampleTrack } from "../track";
import { longShip } from "./testShips";

/**
 * The sea floor under a ship still afloat: a 200 m box flooded at the bow
 * in 60 m of sea grounds its bow while its stern still floats (the
 * Lusitania in 93 m), settles about it, and comes to rest. And headway.
 */

const SEA = 60;
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

function run(spec: ShipSpec): { track: SimTrack; lowest: number } {
  let lowest = Infinity;
  const track = simulate(spec, bowHoles, {
    probe: (p) => {
      lowest = Math.min(lowest, p.lowestZ);
    },
  });
  return { track, lowest };
}

function eventT(track: SimTrack, kind: string): number | undefined {
  return track.events.find((e) => e.kind === kind)?.t;
}

describe("the sea floor under a ship afloat", () => {
  const upright = longShip({ seaDepthM: SEA });
  let level: { track: SimTrack; lowest: number };
  beforeAll(() => {
    level = run(upright);
  });

  it("the bow grounds while the stern still floats", () => {
    const { track } = level;
    const landsT = eventT(track, "bow-lands");
    expect(landsT).toBeDefined();
    const underT = eventT(track, "stern-under");
    expect(underT === undefined || underT > landsT!).toBe(true);
    // Events carry the time at the start of their step; the first frame
    // after it shows the contact.
    const f = track.frames.find((fr) => fr.t > landsT!)!;
    expect(f.groundedParts).toContain("whole");
    const pose = f.bodies[0];
    expect(pose.part).toBe("whole");
    // The stern's deck is still in the air.
    const sternDeck = earthZ(pose, -upright.lbp / 2, 0, upright.depth);
    expect(sternDeck).toBeGreaterThan(0);
    // Nothing touched before the bow did.
    const before = track.frames.filter((fr) => fr.t <= landsT!);
    expect(before.every((fr) => fr.groundedParts.length === 0)).toBe(true);
  });

  it("nothing goes through the floor", () => {
    expect(level.lowest).toBeGreaterThanOrEqual(-SEA - BOW_PLOUGH_M - 0.5);
    // Afloat, the mud only gives a few metres.
    const { track } = level;
    expect(track.frames.length).toBeGreaterThan(100);
  });

  it("a grounded hull comes to rest", () => {
    const { track } = level;
    expect(["sank", "floated"]).toContain(track.outcome);
    expect(track.endT).toBeLessThanOrEqual(END_T);
    for (const f of track.frames)
      for (const b of f.bodies)
        for (const v of [b.x, b.y, b.z, b.pitch, b.roll, b.yaw])
          expect(Number.isFinite(v)).toBe(true);
    const end = track.frames[track.frames.length - 1];
    expect(end.groundedParts).toContain("whole");
    // Upright before the floor: upright on it.
    expect(Math.abs(end.listDeg)).toBeLessThan(5);
  });

  it("a listed hull grounds listed", () => {
    // Weight off to starboard: about 20° of list by the time she grounds.
    const { track, lowest } = run(
      longShip({ seaDepthM: SEA, depth: 16, tcg: -0.2 })
    );
    const landsT = eventT(track, "bow-lands")!;
    const atGround = track.frames.find((f) => f.t > landsT)!;
    expect(atGround.listDeg).toBeGreaterThan(15);
    expect(atGround.listDeg).toBeLessThan(35);
    expect(track.outcome).toBe("sank");
    expect(lowest).toBeGreaterThanOrEqual(-SEA - BOW_PLOUGH_M - 0.5);
  });

  it("lying over on the floor, she stays on it, not in it", () => {
    // Grounded afloat, then under: she lies over about her contact and is
    // re-seated so her lowest hull point stays as deep as it already was.
    let lowest = Infinity;
    let atUnder = Infinity;
    const track = simulate(
      longShip({
        seaDepthM: SEA,
        depth: 16,
        tcg: -0.2,
        extra: { wreck: { restDeg: 75, minListDeg: 0 } },
      }),
      bowHoles,
      {
        probe: (p) => {
          if (p.bodies.some((b) => b.mode === "float")) atUnder = p.lowestZ;
          else lowest = Math.min(lowest, p.lowestZ);
        },
      }
    );
    const rest = track.frames[track.frames.length - 1];
    expect(track.outcome).toBe("sank");
    expect(rest.listDeg).toBeGreaterThan(70);
    expect(lowest).toBeGreaterThanOrEqual(atUnder - 0.5);
    // (the mud under a box's flat bottom gives a few metres while afloat)
    expect(lowest).toBeGreaterThanOrEqual(-SEA - 6);
  });

  it("rests as her wreck does only if the ship says so (spec.wreck)", () => {
    // Deep enough that she sinks before she touches, and lands listed.
    const listed = (extra?: Partial<ShipSpec>) =>
      simulate(
        longShip({ seaDepthM: 300, depth: 16, tcg: -0.3, extra }),
        bowHoles
      );
    const onSide = listed({ wreck: { restDeg: 60, minListDeg: 10 } });
    const landsT = eventT(onSide, "bow-lands")!;
    const atLanding = onSide.frames.filter((f) => f.t <= landsT).pop()!;
    expect(atLanding.listDeg).toBeGreaterThan(10);
    const rest = onSide.frames[onSide.frames.length - 1];
    expect(onSide.outcome).toBe("sank");
    expect(rest.bodies[0].roll).toBeGreaterThan(0);
    expect(Math.abs(rest.listDeg - 60)).toBeLessThan(0.5);
    // Listed less than her wreck but more than that: she keeps her list.
    const keeps = listed({ wreck: { restDeg: 30, minListDeg: 10 } });
    const kept = keeps.frames[keeps.frames.length - 1];
    expect(Math.abs(kept.listDeg - atLanding.listDeg)).toBeLessThan(2);
    // Listed the other way from her wreck: she keeps her list too.
    const other = listed({ wreck: { restDeg: -60, minListDeg: 10 } });
    const end2 = other.frames[other.frames.length - 1];
    expect(Math.abs(end2.listDeg - atLanding.listDeg)).toBeLessThan(2);
    // Without the rule: the same fall, the 1.0 rest (upright).
    const upright = listed();
    expect(upright.events).toEqual(onSide.events);
    const end = upright.frames[upright.frames.length - 1];
    expect(Math.abs(end.listDeg)).toBeLessThan(1);
  });
});

describe("a whole hull that lands stern first", () => {
  it("lies along the floor, not nose down through it (the Carpathia's end)", () => {
    // Flooded aft, the 200 m box plunges stern first and falls through
    // 250 m of sea onto its after end.
    const sea = 250;
    const spec = longShip({ seaDepthM: sea });
    const [h0, h1] = spec.compartments;
    const aftHoles: Opening[] = [
      { ...bowHoles[0], compartmentId: h0.id, x: h0.fromX + 5 },
      { ...bowHoles[1], compartmentId: h1.id, x: (h1.fromX + h1.toX) / 2 },
    ];
    let lowest = Infinity;
    const track = simulate(spec, aftHoles, {
      probe: (p) => {
        if (!p.bodies.some((b) => b.mode === "float"))
          lowest = Math.min(lowest, p.lowestZ);
      },
    });
    expect(track.outcome).toBe("sank");
    // It fell (no end touched while it floated), stern down.
    const lands = eventT(track, "stern-lands") as number;
    expect(lands).toBeGreaterThanOrEqual(track.sankAtT as number);
    expect(sampleTrack(track, track.sankAtT as number).trimDeg).toBeLessThan(
      -20
    );
    const last = track.frames[track.frames.length - 1];
    expect(Math.abs(last.bodies[0].pitch) / (Math.PI / 180)).toBeLessThan(2);
    expect(lowest).toBeGreaterThanOrEqual(-sea - STERN_CRUSH_M - 1);
  });
});

/** The fastest the after end's top moves up or down (m per real second). */
function sternSpeed(track: SimTrack, spec: ShipSpec, from: number): number {
  const x = spec.stations[0].x;
  let fastest = 0;
  let prev: { realT: number; z: number } | null = null;
  for (const f of track.frames) {
    if (f.t < from) continue;
    const z = earthZ(f.bodies[0], x, 0, spec.depth);
    if (prev && f.realT > prev.realT)
      fastest = Math.max(
        fastest,
        Math.abs(z - prev.z) / (f.realT - prev.realT)
      );
    prev = { realT: f.realT, z };
  }
  return fastest;
}

describe("a whole hull that swings down about its bow on the floor (pivotDrag, R22)", () => {
  // The 200 m box flooded forward in 150 m of sea: her bow on the floor
  // while her stern still floats, her stern under at about 46° by the head.
  const sea = 150;
  const plain = longShip({ seaDepthM: sea });
  const ruled = longShip({
    seaDepthM: sea,
    extra: { pivotDrag: true, descentTimeScale: 1 },
  });
  /**
   * The rule's terminal rate at level (its fastest): her weight in water
   * (STEEL_BUOYANCY 0.2) about the contact at her bow against pressure
   * drag on her plan, ω = √(8 W′ d / (ρ Cd B L⁴)), with W′ = 0.8 × 29,520 t
   * × g, d = 100 m, B = 24 m, L = 200 m, Cd 1: 0.069 rad/s, her stern's top
   * 13.7 m/s. The 1.0 rule swings it down at over 20 m/s.
   */
  const LIMIT_MS = 15;
  let lowest = Infinity;
  let track: SimTrack;
  beforeAll(() => {
    track = simulate(ruled, bowHoles, {
      probe: (p) => {
        if (!p.bodies.some((b) => b.mode === "float"))
          lowest = Math.min(lowest, p.lowestZ);
      },
    });
  });

  it("her stern settles no faster than the water lets it", () => {
    const under = track.sankAtT as number;
    expect(sternSpeed(track, ruled, under)).toBeLessThanOrEqual(LIMIT_MS);
    // Without the rule the same hull swings down like a door.
    const old = simulate(plain, bowHoles);
    expect(sternSpeed(old, plain, old.sankAtT as number)).toBeGreaterThan(
      LIMIT_MS
    );
  });

  it("takes at least 20 s from stern-under to rest, in real time", () => {
    const under = track.sankAtT as number;
    expect(track.outcome).toBe("sank");
    expect(track.endT - under).toBeGreaterThanOrEqual(20);
    // Shown time runs at real time once she is under.
    const after = track.frames.filter((f) => f.t >= under);
    for (let i = 1; i < after.length; i += 1)
      expect(after[i].t - after[i - 1].t).toBeCloseTo(
        after[i].realT - after[i - 1].realT,
        6
      );
  });

  it("logs her stern landing when her stern reaches the floor, after her bow", () => {
    const bow = eventT(track, "bow-lands") as number;
    const stern = eventT(track, "stern-lands") as number;
    expect(stern).toBeGreaterThan(bow);
    expect(stern).toBeGreaterThan((track.sankAtT as number) + 5);
    expect(stern).toBeLessThanOrEqual(track.endT);
    // The 1.0 rule logs it as she goes under.
    const old = simulate(plain, bowHoles);
    expect(eventT(old, "stern-lands")).toBeLessThan(
      (old.sankAtT as number) + 1
    );
  });

  it("goes nowhere through the floor, with finite poses, inside endT", () => {
    expect(lowest).toBeGreaterThanOrEqual(-sea - BOW_PLOUGH_M - 0.5);
    expect(track.endT).toBeLessThanOrEqual(END_T);
    for (const f of track.frames)
      for (const b of f.bodies)
        for (const v of [b.x, b.y, b.z, b.pitch, b.roll, b.yaw])
          expect(Number.isFinite(v)).toBe(true);
    // She ends where the 1.0 rule leaves her: the same rest.
    const old = simulate(plain, bowHoles);
    const a = track.frames[track.frames.length - 1].bodies[0];
    const b = old.frames[old.frames.length - 1].bodies[0];
    expect(a.pitch).toBeCloseTo(b.pitch, 2);
    expect(a.z).toBeCloseTo(b.z, 0);
  });
});

describe("headway", () => {
  /** u₀T½/ln2 · (1 − 2^(−t/T½)): the way she carries in t real seconds. */
  const carried = (w: { startMs: number; halfLifeS: number }, t: number) =>
    ((w.startMs * w.halfLifeS) / Math.LN2) *
    (1 - Math.pow(2, -t / w.halfLifeS));

  it("headway moves her forward and decays", () => {
    // Deep sea: she never touches the floor while she has way.
    const way = { startMs: 9, halfLifeS: 120 };
    const deep = longShip();
    const still = simulate(deep, bowHoles);
    const moving = simulate({ ...deep, headway: way }, bowHoles);
    const x = (t: SimTrack, s: number) =>
      t.frames.find((f) => f.t >= s)!.bodies[0].x;
    for (const s of [60, 240, 600]) {
      const f = moving.frames.find((fr) => fr.t >= s)!;
      expect(x(moving, s) - x(still, s)).toBeCloseTo(carried(way, f.realT), 1);
    }
    // Flooding is untouched by it.
    expect(moving.events.map((e) => [e.kind, e.t])).toEqual(
      still.events.map((e) => [e.kind, e.t])
    );
  });

  it("stops for good at the first touch of the floor, through a break", () => {
    // Grounds at about 29 minutes, breaks at about 44 with way still on.
    const way = { startMs: 9, halfLifeS: 2000 };
    const ship = longShip({
      seaDepthM: SEA,
      extra: { girder: { hogMaxNm: 4e9, sagMaxNm: 4e9 } },
    });
    const still = simulate(ship, bowHoles);
    const moving = simulate({ ...ship, headway: way }, bowHoles);
    const lands = moving.events.find((e) => e.kind === "bow-lands")!;
    const broke = moving.events.find((e) => e.kind === "breakup")!;
    expect(broke.t).toBeGreaterThan(lands.t + 60);
    // The way she had until her first touch: the step that touched (it
    // starts at the event's time) still carried her.
    const k = moving.frames.findIndex((f) => f.t > lands.t);
    const at = moving.frames[k];
    const offset = at.bodies[0].x - still.frames[k].bodies[0].x;
    expect(Math.abs(offset - carried(way, at.realT))).toBeLessThan(1);
    // After it, every part keeps exactly that offset: no more way, and none
    // again after the break.
    let after = 0;
    for (let i = k; i < moving.frames.length; i += 1) {
      const m = moving.frames[i];
      const s = still.frames[i];
      expect(m.bodies.map((p) => p.part)).toEqual(s.bodies.map((p) => p.part));
      for (let j = 0; j < m.bodies.length; j += 1)
        if (Math.abs(m.bodies[j].x - s.bodies[j].x - offset) > 1e-6) after += 1;
    }
    expect(after).toBe(0);
    expect(moving.frames.length).toBe(still.frames.length);
  });

  it("the Titanic has none", () => {
    expect(titanic.headway).toBeUndefined();
  });
});
