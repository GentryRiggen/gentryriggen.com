"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { createTrial, runTrial } from "@/lib/ship-builder/sim/seaTrial";
import {
  stateAt,
  timelineEnd,
  timelineStart,
} from "@/lib/ship-builder/sim/timeline";
import type { TrialInput } from "@/lib/ship-builder/sim/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { MAX_FRAME_DELTA } from "./animationMath";
import { publishLiveTrial } from "./liveTrial";
import { testTrialSeconds, testTrialSpeed } from "./testClock";
import {
  advanceEffectsClock,
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
 * Real seconds a sunk iceberg trial waits before its result, while the status
 * bar offers "Follow her down".
 */
export const FOLLOW_OFFER_S = 4;

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
    advanceTrial(input, current, delta, testTrialSpeed(), testTrialSeconds());
    writePlayback(current.state);
    if (current.state.phase !== "done") return;
    finished.current = true;
    finishTrial(current.state);
  });

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

interface IcebergDriverProps {
  input: TrialInput;
  descending: boolean;
  from: "start" | "end";
}

/**
 * Plays an iceberg trial from its precomputed timeline: slow-mo at the break,
 * "Follow her down" continuing from where she sank, and a pause at the end of
 * a sinking so the status bar can offer to follow her.
 */
function IcebergDriver({ input, descending, from }: IcebergDriverProps) {
  const finishTrial = useShipBuilderStore((s) => s.finishTrial);
  const clock = useRef<TimelineClock | null>(null);
  const offeredFor = useRef(0);
  const finished = useRef(false);

  useEffect(() => {
    const timeline = trialTimelineFor(input, descending);
    const start =
      from === "end"
        ? timelineEnd(trialTimelineFor(input))
        : timelineStart(timeline);
    const started = startTimelineClock(timeline, start, testTrialSeconds());
    clock.current = started;
    offeredFor.current = 0;
    finished.current = false;
    trialPlayback.speed = started.speed;
    writeTimelinePlayback(timeline, started.time);
    publishLiveTrial(stateAt(timeline, started.time), 0, true);
  }, [input, descending, from]);

  useFrame((_, delta) => {
    const current = clock.current;
    if (!current || finished.current) return;
    const testSpeed = testTrialSpeed();
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
    const canFollow = !timeline.descended && last.outcome === "sank";
    if (canFollow && offeredFor.current < FOLLOW_OFFER_S) {
      const seconds = Math.min(delta, MAX_FRAME_DELTA) * testSpeed;
      offeredFor.current += seconds;
      // Bubbles keep rising and fading as they do once the result shows.
      advanceEffectsClock(delta, testSpeed);
      return;
    }
    finished.current = true;
    finishTrial(last);
  });

  return null;
}

/** Reduced motion: shows the end of the iceberg trial (and descent) at once. */
function InstantIcebergTrial({ input, descending }: IcebergDriverProps) {
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
  if (trial.input.iceberg) {
    const Driver = reducedMotion ? InstantIcebergTrial : IcebergDriver;
    return (
      <Driver
        key={trial.runId}
        input={trial.input}
        descending={trial.descending}
        from={trial.from}
      />
    );
  }
  const Runner = reducedMotion ? InstantTrial : TrialDriver;
  return <Runner key={trial.runId} input={trial.input} />;
}
