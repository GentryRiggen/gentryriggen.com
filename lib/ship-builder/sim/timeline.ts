import { startDescent } from "./descent";
import { ICEBERG_IMPACT_S, ICEBERG_MAX_S } from "./flooding";
import { createTrial, stepTrial } from "./seaTrial";
import {
  SIM_STEP_S,
  type SimEvent,
  type SimState,
  type TrialInput,
} from "./types";

/**
 * A whole trial worked out ahead of time, one state per fixed sim step, so
 * playback can run at any speed (slow-mo at the break), jump back to the start
 * ("Watch again") and scrub to any moment without re-running the sim.
 *
 * Entries are one sim step apart and in time order. Look them up by time
 * (`stateAt`), not by index: a step may not move the clock by exactly
 * `SIM_STEP_S`.
 */
export interface Timeline {
  states: readonly SimState[];
  /** True once "Follow her down" has been appended (see extendWithDescent). */
  descended: boolean;
}

/** Slowest playback, at the moment she breaks. */
export const SLOW_MO_SPEED = 0.25;
/** Sim seconds before the break that playback starts slowing down. */
export const SLOW_MO_LEAD_S = 0.6;
/** Sim seconds after the break that playback stays at its slowest. */
export const SLOW_MO_HOLD_S = 0.8;
/** Sim seconds after the break by which playback is back to normal. */
export const SLOW_MO_RECOVER_S = 2;

/** Longest a trial may run before the timeline stops recording it. */
const MAX_TRIAL_S = ICEBERG_IMPACT_S + ICEBERG_MAX_S + 30;
/** Longest the descent to the floor may run. */
const MAX_DESCENT_S = 120;

/** Most steps any recording may take, in case a step stops the clock. */
const MAX_STEPS = Math.ceil((MAX_TRIAL_S + MAX_DESCENT_S) / SIM_STEP_S);

/**
 * Steps `first` until the sim is done or `maxSeconds` have passed, keeping
 * every state.
 */
function recordUntilDone(
  input: TrialInput,
  first: SimState,
  maxSeconds: number
): SimState[] {
  const states = [first];
  const until = first.time + maxSeconds;
  let state = first;
  for (
    let step = 0;
    step < MAX_STEPS && state.phase !== "done" && state.time < until;
    step += 1
  ) {
    state = stepTrial(input, state);
    states.push(state);
  }
  return states;
}

/** Runs the sim from the start to done and keeps every state. */
export function buildTimeline(input: TrialInput): Timeline {
  return {
    states: recordUntilDone(input, createTrial(input), MAX_TRIAL_S),
    descended: false,
  };
}

/**
 * "Follow her down": appends the descent to the sea floor to a timeline that
 * ended with her sinking. Any other timeline (afloat, or already descended)
 * comes back unchanged.
 */
export function extendWithDescent(
  timeline: Timeline,
  input: TrialInput
): Timeline {
  const last = timeline.states[timeline.states.length - 1];
  if (timeline.descended || last.phase !== "done" || last.outcome !== "sank") {
    return timeline;
  }
  const descent = recordUntilDone(input, startDescent(last), MAX_DESCENT_S);
  // The descent's first state is the sunk state relabelled: drop it so every
  // entry stays one step apart.
  const appended =
    descent.length > 1 ? descent.slice(1) : [stepTrial(input, descent[0])];
  return { states: [...timeline.states, ...appended], descended: true };
}

/** Sim time of the first state. */
export function timelineStart(timeline: Timeline): number {
  return timeline.states[0].time;
}

/** Sim time of the last state. */
export function timelineEnd(timeline: Timeline): number {
  return timeline.states[timeline.states.length - 1].time;
}

/** Sim seconds from the first state to the last. */
export function timelineDuration(timeline: Timeline): number {
  return timelineEnd(timeline) - timelineStart(timeline);
}

/** Half a step, so a time a hair short of a state still lands on it. */
const TIME_EPSILON = SIM_STEP_S / 2;

/**
 * The latest state at or before `simTime`, clamped to the timeline's ends.
 * A binary search: timelines hold thousands of states.
 */
export function stateAt(timeline: Timeline, simTime: number): SimState {
  const { states } = timeline;
  if (!(simTime > states[0].time)) return states[0];
  let low = 0;
  let high = states.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (states[middle].time <= simTime + TIME_EPSILON) low = middle;
    else high = middle - 1;
  }
  return states[low];
}

/** Every event the whole timeline records (the last state has them all). */
export function timelineEvents(timeline: Timeline): readonly SimEvent[] {
  return timeline.states[timeline.states.length - 1].events;
}

/** The first event of `kind`, or undefined. */
export function firstEvent(
  timeline: Timeline,
  kind: SimEvent["kind"]
): SimEvent | undefined {
  return timelineEvents(timeline).find((event) => event.kind === kind);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Playback speed at `simTime`: 1, easing down to `SLOW_MO_SPEED` over the
 * `SLOW_MO_LEAD_S` before she breaks, holding for `SLOW_MO_HOLD_S`, then
 * easing back to 1 by `SLOW_MO_RECOVER_S` after. Always 1 if she never breaks.
 */
export function slowMoSpeed(timeline: Timeline, simTime: number): number {
  const broke = firstEvent(timeline, "broke");
  if (!broke) return 1;
  const since = simTime - broke.at;
  if (since <= -SLOW_MO_LEAD_S || since >= SLOW_MO_RECOVER_S) return 1;
  if (since < 0) {
    return lerp(1, SLOW_MO_SPEED, smoothstep(-SLOW_MO_LEAD_S, 0, since));
  }
  if (since <= SLOW_MO_HOLD_S) return SLOW_MO_SPEED;
  return lerp(
    SLOW_MO_SPEED,
    1,
    smoothstep(SLOW_MO_HOLD_S, SLOW_MO_RECOVER_S, since)
  );
}
