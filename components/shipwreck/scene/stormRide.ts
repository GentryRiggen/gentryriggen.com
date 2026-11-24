import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import type { BodyPose, SimTrack } from "@/lib/shipwreck/sim/track";
import { swellFade } from "@/lib/shipwreck/sim/wave";
import { rideWeight, waveRide } from "@/lib/shipwreck/sim/waveRide";

/**
 * Her ride on the storm's waves on screen: the sim's own `waveRide` (heave,
 * pitch and roll on the track's storm, the function her deck openings
 * ride on) added to the sim's still-water pose of her whole hull, weighted
 * by `rideWeight` from when her bow went under (the event's real time).
 * Nothing else is added, so the green water on screen is the sim's. Her
 * halves after the break do not ride (the sim's ride is for her whole
 * hull afloat). A wave ship (`spec.wave`) leaves her rogue wave out and
 * fades her swell's ride at it, by the sim's own `swellFade`. This is the
 * plan's `stormMotion` (task 6 addendum).
 */

/** Real time her bow went under (the `bow-under` event), or null. */
export function bowUnderRealT(track: Pick<SimTrack, "events">): number | null {
  const ev = track.events;
  for (let i = 0; i < ev.length; i += 1)
    if (ev[i].kind === "bow-under") return ev[i].realT;
  return null;
}

/**
 * Writes `body` plus her ride into `out` (no allocation; `ride` is a
 * 3-long scratch) and returns the ride's weight (0: `out` is `body`).
 * `realT` is the frame's real time (the fade), `seaT` the sea's time (the
 * same, but for the title's live sea).
 */
export function ridePose(
  spec: ShipSpec,
  track: Pick<SimTrack, "events" | "storm" | "stormScale">,
  body: BodyPose,
  realT: number,
  seaT: number,
  out: BodyPose,
  ride: Float64Array
): number {
  out.part = body.part;
  out.x = body.x;
  out.y = body.y;
  out.z = body.z;
  out.pitch = body.pitch;
  out.roll = body.roll;
  out.yaw = body.yaw;
  const storm = track.storm;
  if (!storm || body.part !== "whole") return 0;
  const k = rideWeight(realT, bowUnderRealT(track));
  if (k <= 0) return 0;
  // A wave ship's rogue wave is out of her ride and her swell's fades at
  // it (`swellFade`), as in the sim.
  waveRide(
    storm,
    track.stormScale ?? 1,
    body.x,
    body.y,
    spec,
    seaT,
    ride,
    swellFade(spec, storm, realT)
  );
  out.z += k * ride[0];
  out.pitch += k * ride[1];
  out.roll += k * ride[2];
  return k;
}
