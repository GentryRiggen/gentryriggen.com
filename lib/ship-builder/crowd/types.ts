/**
 * The crowd on deck. Pure TypeScript: no React, no three.js, no Math.random.
 *
 * Frame. People live in the same model frame as the walker (see
 * `walk/types.ts`): `x` in cells from the bow, `z` in cells from the
 * starboard edge, `level` the walking surface. `yaw` is the walker's heading
 * convention, so the facing direction in model coordinates is
 * `(-cos yaw, -sin yaw)`.
 */

/** The most people shown on deck at once. */
export const MAX_PEOPLE = 24;
/** Walking speed in cells per second, slower than the player. */
export const PERSON_SPEED = 0.9;
/** Shortest and longest time sat in a seat, in seconds. */
export const SIT_S: readonly [number, number] = [6, 14];
/** Shortest and longest idle pause between legs, in seconds. */
export const PAUSE_S: readonly [number, number] = [0.5, 3];
/** How many outfits the scene's palette has. 0 is the crew uniform. */
export const OUTFIT_COUNT = 6;
/** Chance the next goal is a free seat (when one is free). */
export const SEAT_CHANCE = 0.35;
/** A wander goal is at most this many steps away. */
export const WANDER_STEPS = 8;

export type PersonKind = "passenger" | "crew";

export interface Person {
  /** "p0", "p1", … */
  id: string;
  kind: PersonKind;
  /** Index into the scene's outfit palette; crew always 0. */
  outfit: number;
  /** Seed for this person's own choices. */
  seed: number;
}

/** Where a person is at an instant, in the ship's model frame. */
export interface PersonPose {
  x: number;
  z: number;
  level: number;
  /** Heading, the same convention as WalkState.yaw. */
  yaw: number;
  activity: "walk" | "idle" | "sit";
}

export interface Seat {
  partId: string;
  /** The seat cell's centre. */
  x: number;
  z: number;
  level: number;
  /** The way a sitter faces, WalkState.yaw convention. */
  yaw: number;
}

export interface CrowdPlan {
  people: readonly Person[];
  seats: readonly Seat[];
  /** Pose of person `i` at `t` seconds. Pure; extends the schedule lazily and caches it. */
  poseAt(i: number, t: number): PersonPose;
}
