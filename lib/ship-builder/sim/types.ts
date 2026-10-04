/**
 * The ship simulation: a small, deterministic, fixed-step model of how the
 * ship behaves at sea. It is pure (no React, no three.js) so it can be unit
 * tested and replayed; the 3D scene only reads the pose it produces.
 *
 * Level 1 (sea trial): the ship sails into the chosen sea state and either
 * stays steady, rolls hard and recovers, or capsizes and sinks.
 *
 * The state is shaped for what comes next, so later levels add to it rather
 * than change it:
 * - Level 2 (flooding): `compartments` fill with water, which changes trim
 *   (pitch), draft (sink) and stability over time.
 * - Level 3 (rescue): the player sends `SimAction`s (launch a lifeboat, start
 *   a pump, send a distress call) while the sim runs, and `events` records
 *   what happened for the result screen.
 */

/**
 * The sea states the scene offers (scene/seaState.ts has the same union; lib
 * can't import from components).
 */
export type SimSea = "calm" | "choppy" | "stormy";

/** Seconds per simulation step. Callers accumulate frame time and step. */
export const SIM_STEP_S = 1 / 60;

export type TrialOutcome =
  | "steady"
  | "recovered"
  | "capsized"
  /** Iceberg trial: the flooding was contained. */
  | "afloat"
  /** Iceberg trial: the water spilled on until she went under. */
  | "sank";

/** Why the trial ended the way it did, for a plain-words explanation. */
export type TrialReason =
  | "stable"
  | "top-heavy"
  | "dangerous"
  | "lopsided"
  | "rough-sea"
  /** Iceberg: the walls kept the water in the opened compartments. */
  | "held"
  /** Iceberg: water spilled over walls that were too low. */
  | "spilled"
  /** Iceberg: the hull had no bulkheads at all. */
  | "no-bulkheads"
  /** Iceberg: the gash opened too many compartments to float. */
  | "too-many-opened";

export type SimPhase = "sailing" | "capsizing" | "sinking" | "done";

/**
 * How the ship sits in the water, on top of the scene's gentle idle bob.
 * Angles are radians; `sink` is world units below the normal waterline.
 */
export interface SimPose {
  /** Positive rolls toward starboard. */
  roll: number;
  /** Positive lifts the bow. */
  pitch: number;
  sink: number;
}

/** What the sim needs to know about the ship, taken from its stats. */
export interface SimShip {
  /** Height of the centre of mass over the beam (see stats.ts). */
  stabilityRatio: number;
  /** Resting list from off-centre weight, radians; positive is starboard. */
  listAngle: number;
  /** Hull width in cells. */
  beam: number;
}

/** Level 2: one watertight section of the hull, as the sim tracks it. */
export interface Compartment {
  id: string;
  /** 0 (dry) to 1 (full to the main deck). */
  water: number;
  /** The iceberg opened it to the sea. */
  opened: boolean;
}

/**
 * One compartment's shape, from the hull's bulkheads (see
 * `compartmentSpecsOf`). x is in cells from the bow; wall heights are a
 * fraction of the hull's depth (1 reaches the main deck). The hull's own
 * bow and stern ends count as walls of height 1.
 */
export interface CompartmentSpec {
  id: string;
  fromX: number;
  toX: number;
  bowWall: number;
  sternWall: number;
}

/** An iceberg trial: the hull's compartments and where she was struck. */
export interface IcebergInput {
  compartments: CompartmentSpec[];
  /** Hull length in cells. */
  length: number;
  /** Middle of the gash, cells from the bow. */
  impactX: number;
}

/** Reserved for Level 3: things the player does while the sim runs. */
export type SimAction = never;

/** Something that happened, for the result screen and later levels. */
export interface SimEvent {
  at: number;
  kind:
    | "big-roll"
    | "recovered"
    | "capsized"
    | "sunk"
    /** Iceberg: water started coming in. */
    | "flooding"
    /** Iceberg: water spilled over a wall into the next compartment. */
    | "spilled";
}

export interface SimState {
  /** Seconds since the trial started. */
  time: number;
  phase: SimPhase;
  pose: SimPose;
  /** Roll rate in radians per second. */
  rollVelocity: number;
  compartments: Compartment[];
  events: SimEvent[];
  /** Set once the outcome is certain; the trial may still be animating. */
  outcome: TrialOutcome | null;
  reason: TrialReason | null;
}

export interface TrialInput {
  ship: SimShip;
  sea: SimSea;
  /** Present for an iceberg trial; absent for the Level 1 waves trial. */
  iceberg?: IcebergInput;
}
