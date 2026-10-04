"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { createTrial, runTrial } from "@/lib/ship-builder/sim/seaTrial";
import type { TrialInput } from "@/lib/ship-builder/sim/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { publishLiveTrial } from "./liveTrial";
import { testTrialSeconds, testTrialSpeed } from "./testClock";
import {
  advanceTrial,
  jumpTrial,
  writeInstantPlayback,
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
    const started: TrialClock = { state: createTrial(input), leftover: 0 };
    const jumpTo = testTrialSeconds();
    if (jumpTo !== null) jumpTrial(input, started, jumpTo);
    clock.current = started;
    finished.current = false;
    writePlayback(started.state);
    if (input.iceberg) publishLiveTrial(started.state, 0, true);
  }, [input]);

  useFrame((_, delta) => {
    const current = clock.current;
    if (!current || finished.current) return;
    advanceTrial(input, current, delta, testTrialSpeed(), testTrialSeconds());
    writePlayback(current.state);
    const isDone = current.state.phase === "done";
    // The below-deck inset and story clock only need ~10 updates a second.
    if (input.iceberg) {
      publishLiveTrial(current.state, performance.now(), isDone);
    }
    if (!isDone) return;
    finished.current = true;
    finishTrial(current.state);
  });

  return null;
}

/** Skips the animation: works the whole trial out at once and shows the end. */
function InstantTrial({ input }: TrialDriverProps) {
  const finishTrial = useShipBuilderStore((s) => s.finishTrial);

  useEffect(() => {
    const result = runTrial(input);
    writeInstantPlayback(result);
    if (input.iceberg) publishLiveTrial(result, 0, true);
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
