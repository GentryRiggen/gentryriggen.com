import {
  bowSpan,
  deepestDepth,
  sternSpan,
  wholeSpan,
  type BodySpan,
} from "./breakup";
import {
  SIM_STEP_S,
  type SimBody,
  type SimState,
  type TrialInput,
} from "./types";

/**
 * "Follow her down": after she has gone under, each body (the whole ship, or
 * both halves) falls on to the sea floor at a steady speed, turning toward
 * how it will lie there: a ship or bow digs its nose into the sand, a stern
 * lands nearly level. A body touches down when its deepest point reaches the
 * floor; it then stays on the sand while it finishes turning.
 */

/** Where the sea floor is, world units below the normal waterline. */
export const FLOOR_DEPTH = 45;
/** How fast a body falls through the water (world units per second). */
export const DESCENT_SPEED = 4;
/** It reaches that speed over this long, starting from a drift. */
const DESCENT_RAMP_S = 1;
/** Resting pitch of the whole ship or the bow half: nose dug in. */
export const REST_PITCH_BOW = -0.25;
/** Resting pitch of the stern half: nearly level. */
export const REST_PITCH_STERN = 0.1;
/** A small resting list (radians), toward the side she was already rolled. */
export const REST_ROLL = 0.08;
/**
 * Pitch and roll turn toward resting at this many "gaps" over the time left
 * before the body would reach the floor, so the turn is spread over the fall
 * and nearly done by touchdown.
 */
const REST_EASE = 3;
/** The shortest time-left the ease uses, so it finishes quickly on the sand. */
const REST_EASE_MIN_S = 0.4;
/** The trial ends this long after the last touchdown at the latest. */
export const SETTLE_S = 1.5;
/** Pitch and roll this close to resting count as settled. */
const SETTLED_ANGLE = 0.01;
/** Rounding slack for "its deepest point is on the floor". */
const ON_FLOOR_EPS = 1e-6;

/**
 * "Follow her down": continues a finished trial that sank, taking her (or
 * both halves) on to the sea floor. Any other state comes back unchanged.
 */
export function startDescent(state: SimState): SimState {
  if (state.phase !== "done" || state.outcome !== "sank") return state;
  return { ...state, phase: "descending" };
}

interface Body {
  roll: number;
  pitch: number;
  sink: number;
}

interface BodyStep<T extends Body> {
  body: T;
  touched: boolean;
  /** It touched down this step. */
  landedNow: boolean;
  settled: boolean;
}

function eased(value: number, target: number, rate: number): number {
  return value + (target - value) * Math.min(1, rate * SIM_STEP_S);
}

/** Whether the body already lies on the floor. */
function isOnFloor(body: Body, span: BodySpan): boolean {
  return (
    deepestDepth(body.sink, body.pitch, span) >= FLOOR_DEPTH - ON_FLOOR_EPS
  );
}

/**
 * One step of one body. Once it has touched the floor it follows the sand as
 * it turns, so it never sinks into it.
 */
function stepBody<T extends Body>(
  body: T,
  span: BodySpan,
  restPitch: number,
  speed: number
): BodyStep<T> {
  const isDown = isOnFloor(body, span);
  const restRoll = (Math.sign(body.roll) || 1) * REST_ROLL;
  const timeLeft = isDown
    ? 0
    : (FLOOR_DEPTH - deepestDepth(body.sink, body.pitch, span)) / DESCENT_SPEED;
  const rate = REST_EASE / Math.max(REST_EASE_MIN_S, timeLeft);
  const pitch = eased(body.pitch, restPitch, rate);
  const roll = eased(body.roll, restRoll, rate);
  const toFloor = FLOOR_DEPTH - deepestDepth(body.sink, pitch, span);
  const fall = isDown ? toFloor : Math.min(toFloor, speed * SIM_STEP_S);
  const touched = isDown || fall >= toFloor;
  const settled =
    touched &&
    Math.abs(pitch - restPitch) < SETTLED_ANGLE &&
    Math.abs(roll - restRoll) < SETTLED_ANGLE;
  return {
    body: { ...body, roll, pitch, sink: body.sink + fall },
    touched,
    landedNow: touched && !isDown,
    settled,
  };
}

/**
 * One descent step. Each body logs one `touched-bottom` the step it lands;
 * the trial is `done` once every body has landed and settled, or
 * `SETTLE_S` after the last landing.
 */
export function stepDescent(state: SimState, input?: TrialInput): SimState {
  if (state.phase !== "descending") return state;
  const time = state.time + SIM_STEP_S;
  const length = input?.iceberg?.length ?? 0;
  const startedAt =
    state.events.find((e) => e.kind === "sunk")?.at ?? state.time;
  const speed =
    DESCENT_SPEED * Math.min(1, (time - startedAt) / DESCENT_RAMP_S);
  const { halves, breakup } = state;
  let next: SimState;
  let bodies: BodyStep<Body>[];
  let names: SimBody[];
  if (halves && breakup) {
    const bow = stepBody(
      halves.bow,
      bowSpan(breakup.atX),
      REST_PITCH_BOW,
      speed
    );
    const stern = stepBody(
      halves.stern,
      sternSpan(breakup.atX, length),
      REST_PITCH_STERN,
      speed
    );
    bodies = [bow, stern];
    names = ["bow", "stern"];
    next = { ...state, time, halves: { bow: bow.body, stern: stern.body } };
  } else {
    const whole = stepBody(
      state.pose,
      wholeSpan(length),
      REST_PITCH_BOW,
      speed
    );
    bodies = [whole];
    names = ["ship"];
    next = { ...state, time, pose: whole.body };
  }

  let events = state.events;
  bodies.forEach((body, i) => {
    if (body.landedNow) {
      events = [
        ...events,
        { at: time, kind: "touched-bottom", body: names[i] },
      ];
    }
  });
  let lastTouch = time;
  for (const event of events) {
    if (event.kind === "touched-bottom") lastTouch = event.at;
  }
  const isDone =
    bodies.every((b) => b.touched) &&
    (bodies.every((b) => b.settled) || time - lastTouch >= SETTLE_S);
  return { ...next, events, phase: isDone ? "done" : "descending" };
}
