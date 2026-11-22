import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { simulate, whatIfOpenings } from "@/lib/shipwreck/sim/run";
import {
  sampleTrack,
  sampleTrackInto,
  type SimTrack,
} from "@/lib/shipwreck/sim/track";
import { shipToThree } from "../cameraMath";
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
