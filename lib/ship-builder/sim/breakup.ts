import { FLOODED_WATER } from "./power";
import {
  SIM_STEP_S,
  type BreakMode,
  type Compartment,
  type CompartmentSpec,
  type HalfPose,
  type SimBreakup,
  type SimHalves,
  type SimPose,
} from "./types";

/**
 * Breaking in two. While she plunges bow first the hull bends: the flooded
 * bow pulls down and the dry stern hangs in the air. The strain grows with
 * how steeply she is tipped and, much faster, with how long she is, so a
 * short ship takes it and a long liner snaps. Once broken, the two halves
 * move on their own: the bow dives, the stern settles back, rears up and
 * slides under (the Titanic's last minutes). See README.md for the tuning.
 */

/** Hull length (cells) the strength is measured against: the liner's. */
export const REF_LENGTH = 60;
/**
 * The strain a hull takes before it breaks in `real` mode. With the plunge
 * reaching `PLUNGE_PITCH`, ships shorter than about 56 cells never get there.
 */
export const HULL_STRENGTH = 0.3;
/** In `always` mode any ship breaks once she is tipped this far (radians). */
export const ALWAYS_BREAK_PITCH = 0.21;
/** She breaks between these fractions of her length from the bow. */
export const BREAK_MIN_FRACTION = 0.35;
export const BREAK_MAX_FRACTION = 0.7;
/** Where a hull with no walls breaks, as a fraction of its length. */
export const NO_WALLS_BREAK_FRACTION = 0.6;

/** The bow half dives to this pitch (radians, bow down). */
export const BOW_FINAL_PITCH = -1.05;
/** How quickly the bow eases toward its final pitch (per second). */
const BOW_PITCH_EASE = 1.2;
const BOW_SINK_START = 1;
const BOW_SINK_ACCEL = 1.5;
const BOW_SINK_MAX = 4;
/**
 * The bow's deepest point waits no deeper than this for the stern, so it is
 * still above the floor when the player follows her down.
 */
export const BOW_HOLD_DEPTH = 40;

/** The stern half settles back toward level for this long after the break. */
export const STERN_SETTLE_S = 1.6;
/** Then rears up over this long... */
export const STERN_RISE_S = 1.4;
/** ...and hangs nearly upright for this long before sliding under. */
export const STERN_HANG_S = 1.2;
/**
 * The stern's upright pitch (radians). Negative because a half's pitch lifts
 * its bow end, and the stern half's bow end is the broken one: the broken end
 * goes down and the stern itself points at the sky (about 80 degrees).
 */
export const STERN_FINAL_PITCH = -1.4;
/** While settling, the broken end bobs back up to this depth. */
const STERN_FLOAT_SINK = 1;
const STERN_SETTLE_EASE = 1.5;
const STERN_POSE_EASE = 5;
const STERN_RISE_SINK_SPEED = 0.8;
const STERN_HANG_SINK_SPEED = 0.4;
const STERN_SLIDE_ACCEL = 5;
const STERN_SLIDE_MAX = 10;

/** A half counts as gone once its highest point is this far under. */
export const HALF_UNDER_DEPTH = 2;

/** Bending strain at a pitch: steeper and (much more) longer means more. */
export function strainOf(pitch: number, length: number): number {
  const scale = length / REF_LENGTH;
  return Math.abs(pitch) * scale * scale;
}

/** The strain at which she breaks; absent mode means `real`. */
export function strengthFor(
  mode: BreakMode | undefined,
  length: number
): number {
  switch (mode) {
    case "never":
      return Infinity;
    case "always":
      return strainOf(ALWAYS_BREAK_PITCH, length);
    default:
      return HULL_STRENGTH;
  }
}

/**
 * Where she breaks, cells from the bow: the stern wall of the stern-most
 * flooded compartment (where the heavy flooded part meets the dry part),
 * kept away from the very ends. A hull with no walls breaks at 0.6 of her
 * length.
 */
export function breakPositionOf(
  specs: readonly CompartmentSpec[],
  compartments: readonly Compartment[],
  length: number
): number {
  if (specs.length <= 1) return NO_WALLS_BREAK_FRACTION * length;
  let wallX = NO_WALLS_BREAK_FRACTION * length;
  for (let i = specs.length - 1; i >= 0; i--) {
    if ((compartments[i]?.water ?? 0) > FLOODED_WATER) {
      wallX = specs[i].toX;
      break;
    }
  }
  return Math.min(
    BREAK_MAX_FRACTION * length,
    Math.max(BREAK_MIN_FRACTION * length, wallX)
  );
}

/**
 * Both halves exactly where the whole ship was: each pivots at the break, so
 * the pivot's world position must not jump (see README.md, "Two bodies").
 */
export function halvesAtBreak(
  pose: SimPose,
  atX: number,
  length: number
): SimHalves {
  const px = length / 2 - atX;
  const half: HalfPose = {
    roll: pose.roll,
    pitch: pose.pitch,
    sink: pose.sink - px * Math.sin(pose.pitch),
    pivotX: atX,
    driftX: px * (Math.cos(pose.pitch) - 1),
  };
  return { bow: { ...half }, stern: { ...half } };
}

/**
 * A body's reach along its keel from its pivot, world units toward the bow
 * (negative is toward the stern).
 */
export interface BodySpan {
  from: number;
  to: number;
}

/** The whole ship pivots at her middle. */
export function wholeSpan(length: number): BodySpan {
  return { from: -length / 2, to: length / 2 };
}

export function bowSpan(atX: number): BodySpan {
  return { from: 0, to: atX };
}

export function sternSpan(atX: number, length: number): BodySpan {
  return { from: -(length - atX), to: 0 };
}

/**
 * Depth of a point `along` units toward the bow from the pivot. Positive
 * pitch lifts the bow end, so that end is shallower.
 */
function depthAt(sink: number, pitch: number, along: number): number {
  return sink - along * Math.sin(pitch);
}

/** Depth of the body's deepest point on its keel line. */
export function deepestDepth(
  sink: number,
  pitch: number,
  span: BodySpan
): number {
  return Math.max(
    depthAt(sink, pitch, span.from),
    depthAt(sink, pitch, span.to)
  );
}

/** Depth of the body's highest point on its keel line. */
export function shallowestDepth(
  sink: number,
  pitch: number,
  span: BodySpan
): number {
  return Math.min(
    depthAt(sink, pitch, span.from),
    depthAt(sink, pitch, span.to)
  );
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Moves `value` toward `target` by `rate` of the gap per second. */
function ease(value: number, target: number, rate: number): number {
  return value + (target - value) * Math.min(1, rate * SIM_STEP_S);
}

/** One step of the bow half: it dives, then waits deep for the stern. */
function stepBow(bow: HalfPose, sinceBreak: number, atX: number): HalfPose {
  // A long bow stops steepening before its tip reaches the hold depth.
  const reach = Math.min(1, Math.max(0, (BOW_HOLD_DEPTH - bow.sink) / atX));
  const pitch = Math.max(
    -Math.asin(reach),
    ease(bow.pitch, BOW_FINAL_PITCH, BOW_PITCH_EASE)
  );
  const speed = Math.min(
    BOW_SINK_MAX,
    BOW_SINK_START + BOW_SINK_ACCEL * sinceBreak
  );
  const room = BOW_HOLD_DEPTH - deepestDepth(bow.sink, pitch, bowSpan(atX));
  const sink = bow.sink + Math.max(0, Math.min(speed, room * 2)) * SIM_STEP_S;
  const roll = ease(bow.roll, 0, 1);
  return { ...bow, roll, pitch, sink };
}

/** Where the stern is in its sequence, by time since the break. */
function sternTargetPitch(sinceBreak: number): number {
  return (
    STERN_FINAL_PITCH *
    smoothstep(STERN_SETTLE_S, STERN_SETTLE_S + STERN_RISE_S, sinceBreak)
  );
}

/** One step of the stern half: settle, rear up, hang, slide under. */
function stepStern(stern: HalfPose, sinceBreak: number): HalfPose {
  const riseStart = STERN_SETTLE_S;
  const hangStart = riseStart + STERN_RISE_S;
  const slideStart = hangStart + STERN_HANG_S;
  const roll = ease(stern.roll, 0, 1);
  if (sinceBreak < riseStart) {
    return {
      ...stern,
      roll,
      pitch: ease(stern.pitch, 0, STERN_SETTLE_EASE),
      sink: ease(stern.sink, STERN_FLOAT_SINK, STERN_SETTLE_EASE),
    };
  }
  let speed = STERN_HANG_SINK_SPEED;
  if (sinceBreak < hangStart) speed = STERN_RISE_SINK_SPEED;
  else if (sinceBreak >= slideStart) {
    speed = Math.min(
      STERN_SLIDE_MAX,
      STERN_HANG_SINK_SPEED + STERN_SLIDE_ACCEL * (sinceBreak - slideStart)
    );
  }
  return {
    ...stern,
    roll,
    pitch: ease(stern.pitch, sternTargetPitch(sinceBreak), STERN_POSE_EASE),
    sink: stern.sink + speed * SIM_STEP_S,
  };
}

/** Whether the half's highest point is under the surface. */
export function isHalfUnder(half: HalfPose, span: BodySpan): boolean {
  return shallowestDepth(half.sink, half.pitch, span) >= HALF_UNDER_DEPTH;
}

/**
 * One step of a broken ship, `time` being the new sim time. Returns the new
 * halves and whether both are now under.
 */
export function stepHalves(
  halves: SimHalves,
  breakup: SimBreakup,
  length: number,
  time: number
): { halves: SimHalves; isUnder: boolean } {
  const sinceBreak = time - breakup.at;
  const next = {
    bow: stepBow(halves.bow, sinceBreak, breakup.atX),
    stern: stepStern(halves.stern, sinceBreak),
  };
  // The stern always plays its whole part, even for a short ship that broke
  // low in the water: it bobs back up, rears and only then slides under.
  const isUnder =
    sinceBreak >= STERN_SETTLE_S + STERN_RISE_S + STERN_HANG_S &&
    isHalfUnder(next.bow, bowSpan(breakup.atX)) &&
    isHalfUnder(next.stern, sternSpan(breakup.atX, length));
  return { halves: next, isUnder };
}
