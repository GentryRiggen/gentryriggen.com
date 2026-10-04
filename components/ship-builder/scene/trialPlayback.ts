import { stepTrial } from "@/lib/ship-builder/sim/seaTrial";
import {
  SIM_STEP_S,
  type SimPhase,
  type SimState,
  type TrialInput,
} from "@/lib/ship-builder/sim/types";
import { MAX_FRAME_DELTA } from "./animationMath";

/**
 * What the sea trial is doing right now, written by the runner once per frame
 * and read by the ship's group and the trial effects. It lives outside React
 * so a 60 Hz sim never re-renders anything. The last pose is kept after the
 * trial stops, so the result still shows the ship where it ended up.
 */
export interface TrialPlayback {
  roll: number;
  pitch: number;
  sink: number;
  phase: SimPhase;
  /** Sim seconds since the trial began. */
  time: number;
  /** Sim time the ship began to go over, or null while it has not. */
  capsizedAt: number | null;
  /** Sim time the ship began to sink, or null. */
  sinkingAt: number | null;
  /** Sim time the trial finished, or null. */
  doneAt: number | null;
}

export const trialPlayback: TrialPlayback = createPlayback();

function createPlayback(): TrialPlayback {
  return {
    roll: 0,
    pitch: 0,
    sink: 0,
    phase: "sailing",
    time: 0,
    capsizedAt: null,
    sinkingAt: null,
    doneAt: null,
  };
}

/** Starts a fresh playback at the beginning of a trial. */
export function resetPlayback(target: TrialPlayback = trialPlayback) {
  Object.assign(target, createPlayback());
}

/** Copies the sim's current pose and milestones into the playback. */
export function writePlayback(
  state: SimState,
  target: TrialPlayback = trialPlayback
) {
  target.roll = state.pose.roll;
  target.pitch = state.pose.pitch;
  target.sink = state.pose.sink;
  target.phase = state.phase;
  target.time = state.time;
  // A jump straight to the end has no frames in between, so a ship that never
  // went over must not look like one: only count real capsize phases or events.
  const isGoingOver = state.phase === "capsizing" || state.phase === "sinking";
  const capsizeEvent = state.events.find((e) => e.kind === "capsized");
  if (target.capsizedAt === null && (isGoingOver || capsizeEvent)) {
    target.capsizedAt = capsizeEvent?.at ?? state.time;
  }
  if (target.sinkingAt === null && state.phase === "sinking") {
    target.sinkingAt = state.time;
  }
  if (target.doneAt === null && state.phase === "done") {
    target.doneAt = state.time;
  }
}

/** Most sim steps one frame may run, so a slow frame cannot stall the page. */
const MAX_STEPS_PER_FRAME = 4000;

export interface TrialClock {
  state: SimState;
  /** Frame time not yet spent on a whole step. */
  leftover: number;
}

/**
 * Spends `deltaSeconds` of (clamped, speed-scaled) frame time on fixed sim
 * steps. Mutates and returns `clock`. Stops stepping once the sim is done or
 * `holdAt` seconds have been reached.
 */
export function advanceTrial(
  input: TrialInput,
  clock: TrialClock,
  deltaSeconds: number,
  speed = 1,
  holdAt: number | null = null
): TrialClock {
  clock.leftover += Math.min(deltaSeconds, MAX_FRAME_DELTA) * speed;
  let steps = 0;
  while (
    clock.leftover >= SIM_STEP_S &&
    clock.state.phase !== "done" &&
    (holdAt === null || clock.state.time < holdAt) &&
    steps < MAX_STEPS_PER_FRAME
  ) {
    clock.state = stepTrial(input, clock.state);
    clock.leftover -= SIM_STEP_S;
    steps += 1;
  }
  // Never bank more than a frame's worth when paused, done or capped.
  if (clock.leftover >= SIM_STEP_S) clock.leftover = 0;
  return clock;
}

/** Steps a fresh clock straight to `seconds` (or the end), for test jumps. */
export function jumpTrial(
  input: TrialInput,
  clock: TrialClock,
  seconds: number
): TrialClock {
  while (clock.state.phase !== "done" && clock.state.time < seconds) {
    clock.state = stepTrial(input, clock.state);
  }
  return clock;
}
