import { stepTrial } from "@/lib/ship-builder/sim/seaTrial";
import {
  slowMoSpeed,
  stateAt,
  timelineEnd,
  timelineEvents,
  type Timeline,
} from "@/lib/ship-builder/sim/timeline";
import {
  SIM_STEP_S,
  type PowerState,
  type SimBreakup,
  type SimEvent,
  type SimHalves,
  type SimPhase,
  type SimState,
  type TrialInput,
} from "@/lib/ship-builder/sim/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
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
  /**
   * How much of the pose above shows on the ship (0 to 1), written by the
   * ship's group each frame; the walker's eyes read it to follow the deck.
   */
  blend: number;
  phase: SimPhase;
  /** Sim seconds since the trial began. */
  time: number;
  /** Sim time the ship began to go over, or null while it has not. */
  capsizedAt: number | null;
  /** Sim time the ship began to sink, or null. */
  sinkingAt: number | null;
  /** Sim time the trial finished, or null. */
  doneAt: number | null;
  /** Bending strain while plunging (see SimState.strain). */
  strain: number;
  power: PowerState;
  /** Set once she breaks; the scene then draws two halves. */
  breakup: SimBreakup | null;
  halves: SimHalves | null;
  /** The sim's event log (shared, never mutated). */
  events: readonly SimEvent[];
  /** Playback rate the runner is using (1 normal, below 1 in slow-mo). */
  speed: number;
  /** The player is dragging the scrubber: jumps, not real playback. */
  scrubbing: boolean;
  /**
   * The player has scrubbed this result, so the moment they chose stays put:
   * the effects clock stops until the trial is replayed or the result closes.
   */
  scrubbed?: boolean;
}

export const trialPlayback: TrialPlayback = createPlayback();

function createPlayback(): TrialPlayback {
  return {
    roll: 0,
    pitch: 0,
    sink: 0,
    blend: 0,
    phase: "sailing",
    time: 0,
    capsizedAt: null,
    sinkingAt: null,
    doneAt: null,
    strain: 0,
    power: "on",
    breakup: null,
    halves: null,
    events: [],
    speed: 1,
    scrubbing: false,
    scrubbed: false,
  };
}

/** Starts a fresh playback at the beginning of a trial. */
export function resetPlayback(target: TrialPlayback = trialPlayback) {
  Object.assign(target, createPlayback());
}

// Clear the last run's pose the moment a trial starts or ends, in the store
// update itself: a reset in an effect would let one frame show the previous
// run (a sunk ship on "Try again"). "Follow her down" picks up where the last
// run ended, so it keeps the pose.
useShipBuilderStore.subscribe((state, previous) => {
  const { trial } = state;
  const before = previous.trial;
  if (trial === before) return;
  const isNewRun =
    trial.status === "running" &&
    trial.from === "start" &&
    (before.status !== "running" || before.runId !== trial.runId);
  const isLeaving =
    (trial.status === "idle" || trial.status === "aiming") &&
    before.status !== "idle" &&
    before.status !== "aiming";
  if (isNewRun || isLeaving) resetPlayback();
});

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
  target.strain = state.strain;
  target.power = state.power;
  target.breakup = state.breakup;
  target.halves = state.halves;
  target.events = state.events;
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

/** When a timeline first reaches each milestone, in sim seconds. */
interface Milestones {
  /** She began to go over (capsizing or sinking), or logged `capsized`. */
  goingOver: number | null;
  capsized: number | null;
  sinking: number | null;
  done: number | null;
}

const milestonesByTimeline = new WeakMap<Timeline, Milestones>();

function milestonesOf(timeline: Timeline): Milestones {
  const known = milestonesByTimeline.get(timeline);
  if (known) return known;
  const firstWhere = (match: (state: SimState) => boolean) =>
    timeline.states.find(match)?.time ?? null;
  const milestones: Milestones = {
    goingOver: firstWhere(
      (s) => s.phase === "capsizing" || s.phase === "sinking"
    ),
    capsized:
      timelineEvents(timeline).find((e) => e.kind === "capsized")?.at ?? null,
    sinking: firstWhere((s) => s.phase === "sinking"),
    done: firstWhere((s) => s.phase === "done"),
  };
  milestonesByTimeline.set(timeline, milestones);
  return milestones;
}

/** `at` if it has already happened by `time`, else null. */
function reached(at: number | null, time: number): number | null {
  return at !== null && at <= time ? at : null;
}

/**
 * Shows the timeline's state at `simTime`. Unlike `writePlayback`, which
 * latches milestones as time moves forward, this works them out from the
 * timeline, so it is right after a jump back ("Watch again", the scrubber).
 */
export function writeTimelinePlayback(
  timeline: Timeline,
  simTime: number,
  target: TrialPlayback = trialPlayback
) {
  const state = stateAt(timeline, simTime);
  const milestones = milestonesOf(timeline);
  target.capsizedAt =
    reached(milestones.capsized, state.time) ??
    reached(milestones.goingOver, state.time);
  target.sinkingAt = reached(milestones.sinking, state.time);
  target.doneAt = reached(milestones.done, state.time);
  writePlayback(state, target);
}

/** Plays a precomputed timeline (iceberg trials), see `advanceTimelineClock`. */
export interface TimelineClock {
  timeline: Timeline;
  /** Sim seconds the playback has reached. */
  time: number;
  /** Slow-mo rate at `time` (1 normal), without any test speed-up. */
  speed: number;
}

/**
 * A clock at `from` (sim seconds), or at the test's jump time when one is set
 * and later than `from`, never past the end.
 */
export function startTimelineClock(
  timeline: Timeline,
  from: number,
  jumpTo: number | null = null
): TimelineClock {
  const time = Math.min(timelineEnd(timeline), Math.max(from, jumpTo ?? from));
  return { timeline, time, speed: slowMoSpeed(timeline, time) };
}

/**
 * Moves the playback on by `deltaSeconds` of (clamped) frame time, slowed by
 * the timeline's slow-mo and sped up by `testSpeed`. Stops at the end, and
 * never moves past `holdAt` (a test holding the trial at a moment). Mutates
 * and returns `clock`.
 */
export function advanceTimelineClock(
  clock: TimelineClock,
  deltaSeconds: number,
  testSpeed = 1,
  holdAt: number | null = null
): TimelineClock {
  const speed = slowMoSpeed(clock.timeline, clock.time);
  const step = Math.min(deltaSeconds, MAX_FRAME_DELTA) * speed * testSpeed;
  const limit = Math.min(
    timelineEnd(clock.timeline),
    holdAt === null ? Infinity : Math.max(holdAt, clock.time)
  );
  clock.time = Math.min(limit, clock.time + step);
  clock.speed = speed;
  return clock;
}

/** True once the clock has played its whole timeline. */
export function isTimelineClockDone(clock: TimelineClock): boolean {
  return clock.time >= timelineEnd(clock.timeline);
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

/**
 * Shows the end of a trial without animating it (reduced motion). A ship that
 * went over stays on the surface rolled upside down instead of sinking out of
 * sight, so the result card has a ship behind it.
 */
export function writeInstantPlayback(
  state: SimState,
  target: TrialPlayback = trialPlayback
) {
  writePlayback(state, target);
  if (state.outcome === "capsized") target.sink = 0;
}

/**
 * Keeps the effects clock (bubbles rising, then fading) running after the sim
 * is done and its runner is gone. Mutates `target.time`; the sim's own pose
 * is left alone.
 */
export function advanceEffectsClock(
  deltaSeconds: number,
  speed = 1,
  target: TrialPlayback = trialPlayback
) {
  target.time += Math.min(deltaSeconds, MAX_FRAME_DELTA) * speed;
}
