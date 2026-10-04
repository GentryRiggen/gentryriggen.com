"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { createTrial, runTrial } from "@/lib/ship-builder/sim/seaTrial";
import type { TrialInput } from "@/lib/ship-builder/sim/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { testTrialSeconds, testTrialSpeed } from "./testClock";
import {
  advanceTrial,
  jumpTrial,
  resetPlayback,
  writePlayback,
  type TrialClock,
} from "./trialPlayback";

interface TrialDriverProps {
  input: TrialInput;
}

/** Plays one trial in real time, then records how it ended. */
function TrialDriver({ input }: TrialDriverProps) {
  const finishTrial = useShipBuilderStore((s) => s.finishTrial);
  const clock = useRef<TrialClock | null>(null);
  const finished = useRef(false);

  useEffect(() => {
    resetPlayback();
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

/** Skips the animation: works the whole trial out at once and shows the end. */
function InstantTrial({ input }: TrialDriverProps) {
  const finishTrial = useShipBuilderStore((s) => s.finishTrial);

  useEffect(() => {
    resetPlayback();
    const result = runTrial(input);
    writePlayback(result);
    finishTrial(result);
  }, [finishTrial, input]);

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
  const Runner = reducedMotion ? InstantTrial : TrialDriver;
  return <Runner key={trial.runId} input={trial.input} />;
}
