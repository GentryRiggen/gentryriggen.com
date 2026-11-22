import { createFrame, sampleTrackInto } from "@/lib/shipwreck/sim/track";
import type { SimFrame, SimTrack } from "@/lib/shipwreck/sim/track";
import { shipToThreeInto, type V3 } from "./cameraMath";

/** Where a torpedo's track meets her side, and which way it runs (three.js). */
export interface TrackPose {
  x: number;
  z: number;
  /** The plane's rotation about z that lays +y along the track. */
  rotZ: number;
}

/**
 * Each hit's track pose, worked out once the sim has reached its moment (the
 * pose is fixed from then on: the track stays where she was struck), and
 * reused every frame after. Before then (the sim still running) it is
 * worked out per call into one scratch pose. No allocation per call.
 */
export default class TrackPoses {
  private track: SimTrack | null = null;
  private readonly done: (TrackPose | null)[] = [];
  private readonly xs: number[] = [];
  private readonly scratch: SimFrame = createFrame();
  private readonly live: TrackPose = { x: 0, z: 0, rotZ: 0 };
  private readonly a: V3 = [0, 0, 0];
  private readonly b: V3 = [0, 0, 0];
  private readonly pt: V3 = [0, 0, 9];

  private p1(x: number, y: number): V3 {
    this.pt[0] = x;
    this.pt[1] = y;
    return this.pt;
  }

  /** Hit `k`'s pose: struck at `at` s, at ship-frame `x`. */
  poseOf(track: SimTrack, k: number, at: number, x: number): TrackPose {
    if (track !== this.track) {
      this.track = track;
      this.done.length = 0;
    }
    const cached = this.done[k];
    if (cached && this.xs[k] === x) return cached;
    const frames = track.frames;
    const reached = frames.length > 0 && frames[frames.length - 1].t >= at;
    let out = this.live;
    if (reached) {
      out = { x: 0, z: 0, rotZ: 0 };
      this.done[k] = out;
      this.xs[k] = x;
    }
    const pose = sampleTrackInto(track, at, this.scratch).bodies[0];
    const hit = shipToThreeInto(pose, this.p1(x, -13.4), this.a);
    const away = shipToThreeInto(pose, this.p1(x, -14.4), this.b);
    const dx = away[0] - hit[0];
    const dz = away[2] - hit[2];
    const len = Math.hypot(dx, dz) || 1;
    out.x = hit[0];
    out.z = hit[2];
    out.rotZ = Math.atan2(dx / len, dz / len) + Math.PI;
    return out;
  }
}
