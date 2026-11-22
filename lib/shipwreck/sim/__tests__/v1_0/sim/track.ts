import type { SimEvent } from "./events";

/**
 * The output of a run: frames for the scene and the HUD, events for the
 * story. Times are seconds after the collision; `t` is the shown time (the
 * way down is sped up DESCENT_TIME_SCALE times once both parts are under),
 * `realT` the real one.
 */

export interface BodyPose {
  part: "whole" | "bow" | "stern";
  /** Earth position of the body's ship-frame origin (m; z = 0 the sea). */
  x: number;
  y: number;
  z: number;
  /** Radians: pitch + bow down, roll + list to starboard, yaw about z. */
  pitch: number;
  roll: number;
  yaw: number;
}

export interface SimFrame {
  t: number;
  realT: number;
  bodies: BodyPose[];
  /** 0..1 fill per compartment, aft to forward, as spec.compartments. */
  water: number[];
  waterAboardT: number;
  /** The whole ship's trim and list in degrees (after the break, the stern's). */
  trimDeg: number;
  listDeg: number;
  /** 0..1: the lights, flickering before they fail. */
  power: number;
}

export interface SimTrack {
  frames: SimFrame[];
  events: SimEvent[];
  outcome: "sank" | "floated";
  /** When the last of her went under (s), or null. */
  sankAtT: number | null;
  brokeAtT: number | null;
  breakX: number | null;
  endT: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-way interpolation of an angle. */
function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

function lerpPose(a: BodyPose, b: BodyPose, t: number): BodyPose {
  return {
    part: a.part,
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
    pitch: lerpAngle(a.pitch, b.pitch, t),
    roll: lerpAngle(a.roll, b.roll, t),
    yaw: lerpAngle(a.yaw, b.yaw, t),
  };
}

/** Index of the last frame with frame.t <= t (0 if before the first). */
function frameIndex(frames: readonly SimFrame[], t: number): number {
  let lo = 0;
  let hi = frames.length - 1;
  if (t <= frames[0].t) return 0;
  if (t >= frames[hi].t) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t <= t) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * The frame at time t, interpolated between its neighbours (a frame's own
 * time returns that frame; before the first or after the last, those).
 */
export function sampleTrack(track: SimTrack, t: number): SimFrame {
  const frames = track.frames;
  if (frames.length === 0)
    throw new Error("sampleTrack: the track has no frames yet");
  if (t <= frames[0].t) return frames[0];
  if (t >= frames[frames.length - 1].t) return frames[frames.length - 1];
  const i = frameIndex(frames, t);
  const a = frames[i];
  const b = frames[i + 1];
  if (t === a.t || b.t <= a.t) return a;
  const u = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
  const sameBodies =
    a.bodies.length === b.bodies.length &&
    a.bodies.every((p, k) => p.part === b.bodies[k].part);
  return {
    t,
    realT: lerp(a.realT, b.realT, u),
    bodies: sameBodies
      ? a.bodies.map((p, k) => lerpPose(p, b.bodies[k], u))
      : (u < 0.5 ? a : b).bodies,
    water: a.water.map((w, k) => lerp(w, b.water[k], u)),
    waterAboardT: lerp(a.waterAboardT, b.waterAboardT, u),
    trimDeg: lerp(a.trimDeg, b.trimDeg, u),
    listDeg: lerp(a.listDeg, b.listDeg, u),
    power: lerp(a.power, b.power, u),
  };
}

/** Events with t0 < t <= t1 (empty when t1 <= t0), in time order. */
export function eventsBetween(
  track: SimTrack,
  t0: number,
  t1: number
): SimEvent[] {
  if (!(t1 > t0)) return [];
  return track.events.filter((e) => e.t > t0 && e.t <= t1);
}
