"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { createTrial, runTrial } from "@/lib/ship-builder/sim/seaTrial";
import { isTimelineTrial } from "@/lib/ship-builder/sim/trialKind";
import {
  stateAt,
  timelineEnd,
  timelineStart,
} from "@/lib/ship-builder/sim/timeline";
import type { TrialInput } from "@/lib/ship-builder/sim/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { getTrialSpeed } from "../hooks/useTrialSpeed";
import { publishLiveTrial } from "./liveTrial";
import { testTrialSeconds, testTrialSpeed } from "./testClock";
import {
  advanceTimelineClock,
  advanceTrial,
  isTimelineClockDone,
  jumpTrial,
  startTimelineClock,
  trialPlayback,
  writeInstantPlayback,
  writePlayback,
  writeTimelinePlayback,
  type TimelineClock,
  type TrialClock,
} from "./trialPlayback";
import { trialTimelineFor } from "./trialTimeline";

/**
 * The drivers write the playback clock before every other frame hook reads
 * it (the ship's pose, the funnel hide, the falling funnels), so they all see
 * the same time on the same frame. Negative, because a positive priority
 * would turn off R3F's automatic render.
 */
const RUNNER_PRIORITY = -1;

interface TrialDriverProps {
  input: TrialInput;
}

/** Plays one waves trial in real time, then records how it ended. */
function TrialDriver({ input }: TrialDriverProps) {
  const finishTrial = useShipBuilderStore((s) => s.finishTrial);
  const clock = useRef<TrialClock | null>(null);
  const finished = useRef(false);

  useEffect(() => {
    const started: TrialClock = { state: createTrial(input), leftover: 0 };
    const jumpTo = testTrialSeconds();
    if (jumpTo !== null) jumpTrial(input, started, jumpTo);
    clock.current = started;
    finished.current = false;
    writePlayback(started.state);
  }, [input]);

  useFrame((_, delta) => {
    const current = clock.current;
    if (!current || finished.current) return;
    advanceTrial(
      input,
      current,
      delta,
      testTrialSpeed() * getTrialSpeed(),
      testTrialSeconds()
    );
    writePlayback(current.state);
    if (current.state.phase !== "done") return;
    finished.current = true;
    finishTrial(current.state);
  }, RUNNER_PRIORITY);

  return null;
}

/**
 * Skips the animation (reduced motion): works the whole waves trial out at
 * once and shows the end.
 */
function InstantTrial({ input }: TrialDriverProps) {
  const finishTrial = useShipBuilderStore((s) => s.finishTrial);

  useEffect(() => {
    const result = runTrial(input);
    writeInstantPlayback(result);
    finishTrial(result);
  }, [finishTrial, input]);

  return null;
}

interface TimelineDriverProps {
  input: TrialInput;
  descending: boolean;
}

/**
 * Plays a timeline trial (the iceberg or the storm) from its precomputed
 * timeline: slow-mo at the break, and, when she sinks, on down to the sea
 * floor (`descending` is always set for these trials).
 */
function TimelineDriver({ input, descending }: TimelineDriverProps) {
  const finishTrial = useShipBuilderStore((s) => s.finishTrial);
  const clock = useRef<TimelineClock | null>(null);
  const finished = useRef(false);

  useEffect(() => {
    const timeline = trialTimelineFor(input, descending);
    const started = startTimelineClock(
      timeline,
      timelineStart(timeline),
      testTrialSeconds()
    );
    clock.current = started;
    finished.current = false;
    trialPlayback.speed = started.speed;
    writeTimelinePlayback(timeline, started.time);
    publishLiveTrial(stateAt(timeline, started.time), 0, true);
  }, [input, descending]);

  useFrame((_, delta) => {
    const current = clock.current;
    if (!current || finished.current) return;
    const testSpeed = testTrialSpeed() * getTrialSpeed();
    const { timeline } = current;
    if (!isTimelineClockDone(current)) {
      advanceTimelineClock(current, delta, testSpeed, testTrialSeconds());
      trialPlayback.speed = current.speed;
      writeTimelinePlayback(timeline, current.time);
      // The below-deck inset and story clock only need ~10 updates a second.
      publishLiveTrial(
        stateAt(timeline, current.time),
        performance.now(),
        isTimelineClockDone(current)
      );
      return;
    }
    trialPlayback.speed = 1;
    const last = timeline.states[timeline.states.length - 1];
    finished.current = true;
    finishTrial(last);
  }, RUNNER_PRIORITY);

  return null;
}

/** Reduced motion: shows the end of a timeline trial (and descent) at once. */
function InstantTimelineTrial({ input, descending }: TimelineDriverProps) {
  const finishTrial = useShipBuilderStore((s) => s.finishTrial);

  useEffect(() => {
    const timeline = trialTimelineFor(input, descending);
    const last = timeline.states[timeline.states.length - 1];
    trialPlayback.speed = 1;
    writeTimelinePlayback(timeline, timelineEnd(timeline));
    publishLiveTrial(last, 0, true);
    finishTrial(last);
  }, [finishTrial, input, descending]);

  return null;
}

/**
 * Runs the sea trial while the store says one is running. Renders nothing; the
 * ship's group and the effects read what it writes (see trialPlayback.ts).
 */
export default function SeaTrialRunner() {
  const trial = useShipBuilderStore((s) => s.trial);
  const reducedMotion = usePrefersReducedMotion();
  if (trial.status !== "running") return null;
  if (isTimelineTrial(trial.input)) {
    const Driver = reducedMotion ? InstantTimelineTrial : TimelineDriver;
    return (
      <Driver
        key={trial.runId}
        input={trial.input}
        descending={trial.descending}
      />
    );
  }
  const Runner = reducedMotion ? InstantTrial : TrialDriver;
  return <Runner key={trial.runId} input={trial.input} />;
}
