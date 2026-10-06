/**
 * Walk mode model. Pure TypeScript: no React, no three.js.
 *
 * Frame. The walker lives in the ship's own model frame, the same axes as the
 * grid cells: `x` in cells from the bow toward the stern (0 .. length), `z` in
 * cells from the starboard edge toward port (0 .. beam, wing columns outside
 * that). To place the walker in the scene use `modelToWorld(length, beam, p)`
 * from `components/ship-builder/scene/coords.ts`, which gives
 * `worldX = length / 2 - x` and `worldZ = beam / 2 - z` (bow toward +X,
 * starboard toward +Z, inside the ship's bob group). The floor under the
 * walker is `DECK_Y + level * LEVEL_HEIGHT`.
 *
 * Heading. `yaw` is the heading in that ship-aligned world frame, the same
 * convention as the sail model: the facing direction is
 * `(cos yaw, sin yaw)` in (worldX, worldZ). Yaw 0 looks at the bow, PI / 2
 * looks to starboard, and a positive `turn` turns right (clockwise from
 * above). In model coordinates the facing direction is
 * `(-cos yaw, -sin yaw)` in (x, z).
 */

/** Walking speed in cells per second. */
export const WALK_SPEED = 1.6;
/** Turning speed at full `turn`, in radians per second. */
export const TURN_RATE = 2.2;
/** Radius of the walker's collision circle, in cells. */
export const WALKER_RADIUS = 0.25;
/** Radius of the blocking circle around a funnel, mast, crane and so on. */
export const ATTACH_BLOCK_RADIUS = 0.45;

export interface WalkState {
  /** Model x in cells (bow = 0, stern = length). */
  x: number;
  /** Model z in cells (starboard edge = 0, port edge = beam). */
  z: number;
  /** Heading in radians, see the file comment. Wrapped to [-PI, PI). */
  yaw: number;
  /**
   * The surface the walker stands on, in levels: 0 is the main deck, and a
   * block at grid level L has its roof at level L + 1.
   */
  level: number;
  /** Seconds walked. */
  time: number;
}

export interface WalkInput {
  /** -1 (back) to 1 (forward). */
  forward: number;
  /** -1 (left) to 1 (right, toward starboard at yaw 0). */
  strafe: number;
  /** -1 (turn left) to 1 (turn right). */
  turn: number;
}

/** A round obstacle (funnel, mast, crane ...) on one walking surface. */
export interface BlockerCircle {
  /** Model-frame centre, in cells. */
  x: number;
  z: number;
  /** The walking surface it stands on, in levels. */
  level: number;
  radius: number;
}

/** A way between two surfaces: stairs up one level, or back down. */
export interface StairLink {
  /** Cell columns (integer model coordinates). */
  from: { x: number; z: number; level: number };
  to: { x: number; z: number; level: number };
}

export interface WalkGrid {
  /** Hull length and beam in cells (the walkable rectangle is 0..length-1 by 0..beam-1, plus wing columns). */
  readonly length: number;
  readonly beam: number;
  /** Every blocker circle, all levels. */
  readonly blockers: readonly BlockerCircle[];
  /** Every stair link, both directions. */
  readonly stairs: readonly StairLink[];
  /** Blocker circles standing on one level. */
  blockersAt(level: number): readonly BlockerCircle[];
  /**
   * The highest surface a person can stand on in this cell column, in levels,
   * or null when no surface in it is walkable. Integer column coordinates.
   */
  floorLevel(x: number, z: number): number | null;
  /** Whether a person can stand in this column on the surface at `level`. */
  isWalkable(x: number, z: number, level: number): boolean;
  /** Not walkable at that level (solid, decor, unsupported or off the deck). */
  isBlocked(x: number, z: number, level: number): boolean;
  /**
   * The level a walker ends up on after stepping from one column into an
   * orthogonally adjacent one, or null when they cannot. Same level when the
   * neighbour is walkable at it; one level up or down across stairs.
   */
  stepLevel(
    fromX: number,
    fromZ: number,
    fromLevel: number,
    toX: number,
    toZ: number
  ): number | null;
}
