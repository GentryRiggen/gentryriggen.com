import { hitTimeS } from "@/lib/shipwreck/playback";
import { carpathia, CARPATHIA_HIT_T } from "@/lib/shipwreck/ships/carpathia";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import {
  simulate,
  torpedoHits,
  whatIfOpenings,
  whatIfRealIds,
} from "@/lib/shipwreck/sim/run";
import {
  sampleTrack,
  sampleTrackInto,
  type SimTrack,
} from "@/lib/shipwreck/sim/track";
import { shipToThree } from "../cameraMath";
import { RUN_IN_S, trackShows, trackSideY } from "../Torpedo";
import TrackPoses from "../torpedoPose";

jest.mock("@/lib/shipwreck/sim/track", () => {
  const actual = jest.requireActual("@/lib/shipwreck/sim/track");
  return { ...actual, sampleTrackInto: jest.fn(actual.sampleTrackInto) };
});

/** The pose as the frame loop worked it out before the cache. */
function direct(track: SimTrack, at: number, x: number) {
  const pose = sampleTrack(track, at).bodies[0];
  const hit = shipToThree(pose, [x, -13.4, 9]);
  const out = shipToThree(pose, [x, -14.4, 9]);
  const dx = out[0] - hit[0];
  const dz = out[2] - hit[2];
  const len = Math.hypot(dx, dz) || 1;
  return {
    x: hit[0],
    z: hit[2],
    rotZ: Math.atan2(dx / len, dz / len) + Math.PI,
  };
}

describe("a torpedo track's pose", () => {
  const track = simulate(lusitania, whatIfOpenings(lusitania, ["br1"]));

  it("matches the per-frame sampling it replaces", () => {
    const poses = new TrackPoses();
    for (const [at, x] of [
      [0, 60],
      [3, -20],
      [9, 40],
    ]) {
      const p = poses.poseOf(track, 0, at, x);
      expect(p).toEqual(direct(track, at, x));
    }
  });

  it("is worked out once the sim has reached it, then reused", () => {
    const poses = new TrackPoses();
    const spy = jest.mocked(sampleTrackInto);
    const first = poses.poseOf(track, 0, 0, 60);
    const calls = spy.mock.calls.length;
    for (let i = 0; i < 500; i += 1)
      expect(poses.poseOf(track, 0, 0, 60)).toBe(first);
    expect(spy.mock.calls.length).toBe(calls);
    // A new hit position is worked out again; a new track resets.
    expect(poses.poseOf(track, 0, 0, 10)).not.toEqual(first);
  });

  it("while the sim is still short of the hit, it follows the track", () => {
    const poses = new TrackPoses();
    const partial = { ...track, frames: track.frames.slice(0, 1) };
    const at = track.frames[track.frames.length - 1].t + 50;
    const a = { ...poses.poseOf(partial, 0, at, 60) };
    expect(a).toEqual(direct(partial, at, 60));
  });
});

describe("each ship's torpedo tracks (Task 6)", () => {
  /** The track's way out to the firing point, on the sea (three x, z). */
  const outward = (rotZ: number) => [-Math.sin(rotZ), -Math.cos(rotZ)];

  it("runs the Carpathia's in from her port side, landing at 0, 8 and 5700 s", () => {
    const hits = torpedoHits(carpathia, whatIfRealIds(carpathia));
    expect(hits.map((h) => h.t)).toEqual([0, 8, CARPATHIA_HIT_T.third]);
    expect(hits.every((h) => h.side === "port")).toBe(true);
    const track = simulate(carpathia, carpathia.realNight);
    const poses = new TrackPoses();
    const y = trackSideY(carpathia, "port");
    // Just outside her side (half her 19.66 m beam), to port (+y).
    expect(y).toBeCloseTo(9.9, 6);
    hits.forEach((h, k) => {
      const p = poses.poseOf(track, k, h.t, h.x, y);
      const body = sampleTrack(track, h.t).bodies[0];
      const centre = shipToThree(body, [h.x, 0, 9]);
      // Port is three -z: the hit lies on that side of her, the track
      // runs out from it further to port.
      expect(p.z).toBeLessThan(centre[2] - 9);
      const [ox, oz] = outward(p.rotZ);
      expect(oz).toBeLessThan(-0.99);
      expect(Math.abs(ox)).toBeLessThan(0.1);
    });
    // Each wake shows from its own run-in: the 10:50 AM one runs in for
    // the 40 s before its own hit, not at 9:15.
    const shows = (t: number) => hits.map((h) => trackShows(h.t, t));
    expect(shows(-20)).toEqual([true, true, false]);
    expect(shows(300)).toEqual([false, false, false]);
    expect(shows(CARPATHIA_HIT_T.third - 20)).toEqual([false, false, true]);
    expect(shows(CARPATHIA_HIT_T.third + 60)).toEqual([false, false, true]);
    expect(RUN_IN_S).toBeGreaterThan(38);
    expect(RUN_IN_S).toBeLessThan(45);
  });

  it("keeps the Lusitania's on her starboard side, 13.4 m out, at 1.1's times", () => {
    expect(trackSideY(lusitania, "starboard")).toBe(-13.4);
    const hits = torpedoHits(lusitania, ["br1", "br2", "br3"]);
    expect(hits).toHaveLength(3);
    expect(hits.every((h) => h.side === "starboard")).toBe(true);
    hits.forEach((h, k) => expect(h.t).toBe(hitTimeS(k, hits.length)));
    // The default side is 1.1's, so her poses are exactly as before.
    const poses = new TrackPoses();
    const a = poses.poseOf(track1(), 0, 0, 60);
    expect(new TrackPoses().poseOf(track1(), 0, 0, 60, -13.4)).toEqual(a);
    const [, oz] = outward(a.rotZ);
    expect(oz).toBeGreaterThan(0.99);
    // Her run-in starts at the 40 s pre-roll: the wake shows from then.
    expect(trackShows(0, -40)).toBe(true);
  });
});

let lusTrack: SimTrack | null = null;
function track1(): SimTrack {
  lusTrack ??= simulate(lusitania, whatIfOpenings(lusitania, ["br1"]));
  return lusTrack;
}
