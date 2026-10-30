import type { FlightState } from "../sim/flight";

/** Poses are recorded this often, in sim seconds (10 a second). */
export const GHOST_INTERVAL = 0.1;
/** Longest ghost kept: a flight lasts at most MAX_FLIGHT_TIME (120 s). */
export const MAX_GHOST_SAMPLES = 1300;

/** Metres and radians are stored as whole numbers of these. */
const POSITION_UNIT = 0.1;
const ANGLE_UNIT = 0.01;
/** Numbers per sample: x, y, z, heading, pitch, bank. */
const FIELDS = 6;

/** Where the plane was, in the units the scene poses it with. */
export interface GhostPose {
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  bank: number;
}

/**
 * A saved best flight. `data` holds one sample per GHOST_INTERVAL, each six
 * whole numbers (x, y, z in decimetres; heading, pitch, bank in hundredths of
 * a radian). The first sample is absolute and every later one is the change
 * from the sample before, which keeps the numbers (and the save) small.
 * Euler angles stand in for a quaternion: the sim only ever has these three,
 * and three small integers store far smaller than four.
 */
export interface Ghost {
  /** Sim seconds from launch to the finish line. */
  time: number;
  data: number[];
}

const quantise = (pose: GhostPose): number[] => [
  Math.round(pose.x / POSITION_UNIT),
  Math.round(pose.y / POSITION_UNIT),
  Math.round(pose.z / POSITION_UNIT),
  Math.round(pose.heading / ANGLE_UNIT),
  Math.round(pose.pitch / ANGLE_UNIT),
  Math.round(pose.bank / ANGLE_UNIT),
];

export function encodeGhost(time: number, poses: readonly GhostPose[]): Ghost {
  const data: number[] = [];
  let previous: number[] = new Array<number>(FIELDS).fill(0);
  for (const pose of poses.slice(0, MAX_GHOST_SAMPLES)) {
    const current = quantise(pose);
    for (let i = 0; i < FIELDS; i += 1) data.push(current[i] - previous[i]);
    previous = current;
  }
  return { time, data };
}

const decoded = new WeakMap<Ghost, GhostPose[]>();

/** The poses a ghost was saved from (rounded to the stored precision). */
export function decodeGhost(ghost: Ghost): GhostPose[] {
  const cached = decoded.get(ghost);
  if (cached) return cached;
  const poses: GhostPose[] = [];
  const running = new Array<number>(FIELDS).fill(0);
  for (let at = 0; at + FIELDS <= ghost.data.length; at += FIELDS) {
    for (let i = 0; i < FIELDS; i += 1) running[i] += ghost.data[at + i];
    poses.push({
      x: running[0] * POSITION_UNIT,
      y: running[1] * POSITION_UNIT,
      z: running[2] * POSITION_UNIT,
      heading: running[3] * ANGLE_UNIT,
      pitch: running[4] * ANGLE_UNIT,
      bank: running[5] * ANGLE_UNIT,
    });
  }
  decoded.set(ghost, poses);
  return poses;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The ghost's pose `time` sim seconds after launch; the last pose once over. */
export function poseAt(poses: readonly GhostPose[], time: number): GhostPose {
  const last = poses.length - 1;
  const position = Math.max(0, time) / GHOST_INTERVAL;
  const index = Math.min(Math.floor(position), last);
  const from = poses[index];
  if (index >= last) return from;
  const to = poses[index + 1];
  const t = position - index;
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    z: lerp(from.z, to.z, t),
    heading: lerp(from.heading, to.heading, t),
    pitch: lerp(from.pitch, to.pitch, t),
    bank: lerp(from.bank, to.bank, t),
  };
}

/**
 * How far ahead of the ghost the player is, in seconds: positive when the
 * player reached `x` sooner. Null for a ghost with nothing to compare to.
 */
export function secondsAheadOfGhost(
  ghost: Ghost,
  x: number,
  time: number
): number | null {
  const poses = decodeGhost(ghost);
  if (poses.length < 2) return null;
  const last = poses.length - 1;
  if (x >= poses[last].x) return ghost.time - time;
  if (x <= poses[0].x) return -time;
  // The ghost's x only grows in practice; walk to the first sample past `x`.
  let i = 1;
  while (i < last && poses[i].x < x) i += 1;
  const span = poses[i].x - poses[i - 1].x;
  const share = span > 0 ? (x - poses[i - 1].x) / span : 0;
  const ghostTime = (i - 1 + share) * GHOST_INTERVAL;
  return ghostTime - time;
}

/** Whether `value` is a well-formed ghost (from a save or a hand edit). */
export function isGhost(value: unknown): value is Ghost {
  if (typeof value !== "object" || value === null) return false;
  const { time, data } = value as Partial<Ghost>;
  return (
    typeof time === "number" &&
    Number.isFinite(time) &&
    time > 0 &&
    Array.isArray(data) &&
    data.length >= FIELDS * 2 &&
    data.length <= FIELDS * MAX_GHOST_SAMPLES &&
    data.length % FIELDS === 0 &&
    data.every((n) => Number.isInteger(n) && Math.abs(n) <= 1e7)
  );
}

export interface GhostRecorder {
  /** Call after every sim step; keeps a pose each GHOST_INTERVAL. */
  record: (state: FlightState) => void;
  /** The ghost of a flight that crossed the finish line, else null. */
  finish: () => Ghost | null;
}

const poseOf = (s: FlightState): GhostPose => ({
  x: s.x,
  y: s.y,
  z: s.z,
  heading: s.heading,
  pitch: s.pitch,
  bank: s.bank,
});

/**
 * Keeps the launch pose, then one pose per interval, and stops at the step
 * that crosses the finish line (that pose closes the ghost).
 */
export function createGhostRecorder(initial: FlightState): GhostRecorder {
  const poses: GhostPose[] = [poseOf(initial)];
  let nextAt = GHOST_INTERVAL;
  let ghost: Ghost | null = null;
  let isClosed = false;
  return {
    record(state) {
      if (isClosed) return;
      if (state.finished && state.finishTime !== null) {
        isClosed = true;
        const pose = poseOf(state);
        while (poses.length <= Math.floor(state.finishTime / GHOST_INTERVAL)) {
          poses.push(pose);
        }
        poses.push(pose);
        ghost = encodeGhost(state.finishTime, poses);
        return;
      }
      while (state.time >= nextAt) {
        poses.push(poseOf(state));
        nextAt += GHOST_INTERVAL;
      }
      // A flight too long to keep is never a best, so stop collecting.
      if (poses.length >= MAX_GHOST_SAMPLES) isClosed = true;
    },
    finish: () => ghost,
  };
}
