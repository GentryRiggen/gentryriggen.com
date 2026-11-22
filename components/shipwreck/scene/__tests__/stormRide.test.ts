import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { simulate } from "@/lib/shipwreck/sim/run";
import type { BodyPose, SimTrack } from "@/lib/shipwreck/sim/track";
import {
  RIDE_FADE_S,
  rideWeight,
  waveRide,
} from "@/lib/shipwreck/sim/waveRide";
import { bowUnderRealT, ridePose } from "../stormRide";

/**
 * Her ride on the waves on screen (`stormRide.ts`) is the sim's own
 * `waveRide` (the function her deck openings ride on), weighted by
 * `rideWeight` from her bow going under, added to the sim's still-water
 * pose: no extra heave, so the green water on screen is the sim's. The
 * plan's `stormMotion` is this (task 6 addendum). Bounds: |pitch| ≤ 6° and
 * |roll| ≤ 10° for a laker running before these seas (her own ride stays
 * near 2° and 0.6°: `waveRide.test.ts`, README "Her ride on the waves").
 */

const DEG = Math.PI / 180;

function copy(b: BodyPose): BodyPose {
  return { ...b };
}

describe("her ride on screen", () => {
  let track: SimTrack;
  beforeAll(() => {
    track = simulate(fitzgerald, fitzgerald.realNight);
  });

  it("is nothing without a storm (the liners)", () => {
    const liner = simulate(titanic, titanic.realNight, { endT: 20 });
    const body = liner.frames[10].bodies[0];
    const out = copy(body);
    const ride = new Float64Array(3);
    expect(ridePose(titanic, liner, body, 10, 10, out, ride)).toBe(0);
    expect(out).toEqual(body);
  });

  it("adds exactly waveRide × rideWeight to the sim's pose, gently", () => {
    const under = bowUnderRealT(track)!;
    expect(under).toBe(track.events.find((e) => e.kind === "bow-under")!.realT);
    const ride = new Float64Array(3);
    const want = new Float64Array(3);
    const out = copy(track.frames[0].bodies[0]);
    let pitch = 0;
    let roll = 0;
    let heave = 0;
    for (const f of track.frames) {
      if (f.bodies.length !== 1 || f.realT > under + RIDE_FADE_S) continue;
      const body = f.bodies[0];
      const k = ridePose(fitzgerald, track, body, f.realT, f.realT, out, ride);
      expect(k).toBe(rideWeight(f.realT, under));
      waveRide(
        track.storm!,
        track.stormScale!,
        body.x,
        body.y,
        fitzgerald,
        f.realT,
        want
      );
      expect(out.z - body.z).toBeCloseTo(k * want[0], 12);
      expect(out.pitch - body.pitch).toBeCloseTo(k * want[1], 12);
      expect(out.roll - body.roll).toBeCloseTo(k * want[2], 12);
      expect(out.x).toBe(body.x);
      expect(out.y).toBe(body.y);
      expect(out.yaw).toBe(body.yaw);
      heave = Math.max(heave, Math.abs(out.z - body.z));
      pitch = Math.max(pitch, Math.abs(out.pitch - body.pitch));
      roll = Math.max(roll, Math.abs(out.roll - body.roll));
    }
    expect(pitch).toBeLessThanOrEqual(6 * DEG);
    expect(roll).toBeLessThanOrEqual(10 * DEG);
    expect(heave).toBeLessThan(2);
    // She does ride: the sea is not flat under her.
    expect(pitch).toBeGreaterThan(0.5 * DEG);
  });

  it("is gone once her bow has been under RIDE_FADE_S, and for her halves", () => {
    const under = bowUnderRealT(track)!;
    const ride = new Float64Array(3);
    const late = track.frames.find(
      (f) => f.realT > under + RIDE_FADE_S && f.bodies.length === 1
    );
    if (late) {
      const out = copy(late.bodies[0]);
      expect(
        ridePose(
          fitzgerald,
          track,
          late.bodies[0],
          late.realT,
          late.realT,
          out,
          ride
        )
      ).toBe(0);
      expect(out).toEqual(late.bodies[0]);
    }
    const broken = track.frames.find((f) => f.bodies.length === 2)!;
    for (const b of broken.bodies) {
      const out = copy(b);
      expect(
        ridePose(fitzgerald, track, b, broken.realT, broken.realT, out, ride)
      ).toBe(0);
      expect(out).toEqual(b);
    }
  });
});
