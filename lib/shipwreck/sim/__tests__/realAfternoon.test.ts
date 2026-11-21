import { lusitania } from "../../ships";
import { simulate, whatIfOpenings, whatIfSpots } from "../run";
import type { BodyPose, SimTrack } from "../track";

/**
 * RMS Lusitania's afternoon, 7 May 1915: one torpedo to starboard at
 * 2:10 PM, a second explosion seconds later, a fast list to starboard, down
 * by the head, the bow into a 93 m floor while the stern is still up, gone
 * in about 18 minutes, at rest on her starboard side. All from the physics:
 * the scripted events are only the explosion and the boats.
 */

const DEG = Math.PI / 180;
const GATE = process.env.SHIPWRECK_PERF === "1";

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

describe("the real afternoon", () => {
  let track: SimTrack;
  beforeAll(() => {
    track = simulate(lusitania, lusitania.realNight);
  });

  it("lists to starboard at once: 12° by 2:15, at most 15–30°", () => {
    const at300 = track.frames.find((f) => f.t >= 300)!;
    expect(at300.listDeg).toBeGreaterThanOrEqual(12);
    const lands = eventT(track, "bow-lands") as number;
    const before = track.frames.filter((f) => f.t < lands);
    const most = Math.max(...before.map((f) => f.listDeg));
    expect(most).toBeGreaterThanOrEqual(15);
    expect(most).toBeLessThanOrEqual(30);
    // Starboard all the way (a list to port is negative).
    for (const f of before.filter((fr) => fr.t >= 60))
      expect(f.listDeg).toBeGreaterThan(0);
  });

  it("is down by the head from two minutes on", () => {
    for (const f of track.frames.filter((fr) => fr.t >= 120))
      expect(f.trimDeg).toBeGreaterThan(0);
  });

  it("puts her bow on the floor while her stern is still in the air", () => {
    const lands = eventT(track, "bow-lands");
    const under = eventT(track, "stern-under");
    expect(lands).toBeDefined();
    expect(under).toBeDefined();
    expect(lands!).toBeLessThan(under!);
    // The first frame after the event shows the contact.
    const f = track.frames.find((fr) => fr.t > lands!)!;
    expect(f.groundedParts).toContain("whole");
    const pose = f.bodies[0];
    const stern = lusitania.stations[0];
    const sternTop = Math.max(
      ...stern.offsets.map(([z, hb]) =>
        Math.max(earthZ(pose, stern.x, hb, z), earthZ(pose, stern.x, -hb, z))
      )
    );
    expect(sternTop).toBeGreaterThan(0);
  });

  it("is gone in 15–22 minutes (really 18)", () => {
    expect(track.outcome).toBe("sank");
    expect(track.sankAtT).toBe(eventT(track, "stern-under"));
    expect(track.sankAtT).toBeGreaterThanOrEqual(900);
    expect(track.sankAtT).toBeLessThanOrEqual(1320);
  });

  it("does not break up before the bow lands", () => {
    const lands = eventT(track, "bow-lands") as number;
    const broke = eventT(track, "breakup");
    expect(broke === undefined || broke >= lands).toBe(true);
  });

  it("comes to rest on her starboard side", () => {
    const last = track.frames[track.frames.length - 1];
    expect(last.groundedParts.length).toBe(last.bodies.length);
    for (const b of last.bodies) {
      expect(b.roll / DEG).toBeGreaterThanOrEqual(45);
      expect(b.z).toBeLessThan(-lusitania.seaDepthM + 30);
    }
  });

  it("has the second explosion within 30 s of the hit", () => {
    const hit = eventT(track, "collision") as number;
    const boom = eventT(track, "explosion");
    expect(boom).toBeDefined();
    expect(boom! - hit).toBeGreaterThan(0);
    expect(boom! - hit).toBeLessThanOrEqual(30);
  });

  it("lowers her boats while she is afloat", () => {
    const boats = track.events.filter((e) => e.kind === "boat-lowered");
    expect(boats).toHaveLength(6);
    expect(eventT(track, "last-boat")).toBe(boats[5].t);
  });

  it("is deterministic", () => {
    expect(simulate(lusitania, lusitania.realNight)).toEqual(track);
  });

  it("runs within the Titanic's budget", () => {
    // The faster of two runs (see perf.test.ts): 3 s, gated with
    // SHIPWRECK_PERF=1, logged otherwise.
    const times = [0, 1].map(() => {
      const t0 = performance.now();
      simulate(lusitania, lusitania.realNight);
      return performance.now() - t0;
    });
    const ms = Math.min(...times);
    console.log(`Lusitania real afternoon simulated in ${ms.toFixed(0)} ms`);
    if (GATE) expect(ms).toBeLessThan(3000);
  });
});

describe("What if? the torpedo elsewhere, portholes open or shut", () => {
  it("offers the main spaces along her length, and the real one is hers", () => {
    const spots = whatIfSpots(lusitania);
    expect(spots).toHaveLength(12);
    for (const id of spots) {
      const c = lusitania.compartments.find((k) => k.id === id)!;
      expect(!c.span || c.span.side === "centre").toBe(true);
    }
    expect(whatIfOpenings(lusitania, ["br1"])).toEqual(lusitania.realNight);
  });

  it("the torpedo's own hole never skips a side bunker", () => {
    // At t = 0 the hole is in the side shell: where the space it lands in
    // has a starboard bunker, the hole is in the bunker, not the room.
    const comps = lusitania.compartments;
    for (const id of whatIfSpots(lusitania))
      for (const o of whatIfOpenings(lusitania, [id])) {
        if ((o.t ?? 0) > 0) continue;
        const c = comps.find((k) => k.id === o.compartmentId)!;
        const bunker = comps.find(
          (k) =>
            k.span?.side === "starboard" &&
            k.fromX < c.toX - 1e-6 &&
            k.toX > c.fromX + 1e-6
        );
        if (bunker) expect(o.compartmentId).toBe(bunker.id);
      }
    // A hit at No. 2: the hole that was the transverse bunker's is now in
    // No. 1's starboard bunker (the space forward of No. 2).
    const br2 = whatIfOpenings(lusitania, ["br2"]);
    expect(
      br2.filter((o) => (o.t ?? 0) === 0).map((o) => o.compartmentId)
    ).toEqual(["br1-stbd", "br2-stbd"]);
  });

  it("a hit at a boiler room opens its starboard bunker and the room", () => {
    for (const n of [1, 2, 3, 4]) {
      const ids = whatIfOpenings(lusitania, [`br${n}`]).map(
        (o) => o.compartmentId
      );
      expect(ids).toContain(`br${n}-stbd`);
      expect(ids).toContain(`br${n}`);
      for (const o of whatIfOpenings(lusitania, [`br${n}`])) {
        expect(o.side).toBe("starboard");
        expect(o.zHigh).toBeLessThan(lusitania.draught);
        const c = lusitania.compartments.find((k) => k.id === o.compartmentId)!;
        expect(o.x).toBeGreaterThanOrEqual(c.fromX);
        expect(o.x).toBeLessThanOrEqual(c.toX);
      }
    }
  });

  it.each(whatIfSpots(lusitania))(
    "torpedo at %s: finite, and the run ends by END_T (8:30 PM)",
    (id) => {
      const openings = whatIfOpenings(lusitania, [id]);
      expect(openings.length).toBeGreaterThan(0);
      for (const portholesOpen of [true, false]) {
        const track = simulate(lusitania, openings, { portholesOpen });
        expect(track.endT).toBeLessThanOrEqual(22800 + 1e-6);
        const bad = track.frames.find((f) =>
          f.bodies.some(
            (b) =>
              ![b.x, b.y, b.z, b.pitch, b.roll, b.yaw].every(Number.isFinite)
          )
        );
        expect(bad).toBeUndefined();
        if (track.outcome === "floated")
          expect(track.events.map((e) => e.kind)).toContain("floating-steady");
        else
          expect(track.frames[track.frames.length - 1].groundedParts).toEqual(
            track.frames[track.frames.length - 1].bodies.map((b) => b.part)
          );
      }
    },
    30000
  );

  it("with the portholes shut she never sinks faster at the real spot", () => {
    const sinkT = (portholesOpen: boolean) =>
      simulate(lusitania, lusitania.realNight, { portholesOpen }).sankAtT ??
      Infinity;
    expect(sinkT(false)).toBeGreaterThanOrEqual(sinkT(true));
  });
});
