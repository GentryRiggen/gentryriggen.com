"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { SIM_STEP_S } from "@/lib/ship-builder/sim/types";
import { getWalkState, publishWalk } from "@/lib/ship-builder/state/walkLive";
import { walkInput } from "@/lib/ship-builder/state/walkInput";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import {
  stepWalker,
  walkGridOf,
  type WalkState,
} from "@/lib/ship-builder/walk";
import { MAX_FRAME_DELTA } from "./animationMath";
import { trialPlayback } from "./trialPlayback";
import { testWalkSpawn } from "./testClock";
import { isWalkOver } from "./walkOver";

/** Runs one walk: steps the walker in fixed steps and publishes it. */
function Walking() {
  const ship = useShipBuilderStore((s) => s.ship);
  const grid = useMemo(() => walkGridOf(ship), [ship]);
  const stopWalk = useShipBuilderStore((s) => s.stopWalk);
  // The store published the spawn when the walk started.
  const state = useRef<WalkState | null>(getWalkState());
  const leftover = useRef(0);

  // A test can start the walker somewhere particular.
  useEffect(() => {
    const planted = testWalkSpawn();
    const current = state.current;
    if (!planted || !current) return;
    state.current = { ...current, ...planted };
    publishWalk(state.current);
  }, []);

  useFrame((_, delta) => {
    // She has broken or gone under: the walk ends and the trial plays on to
    // its result (there is no half to ride yet, a later release).
    if (
      isWalkOver(trialPlayback) &&
      useShipBuilderStore.getState().trial.status === "running"
    ) {
      stopWalk();
      return;
    }
    const current = state.current;
    if (!current) return;
    leftover.current += Math.min(delta, MAX_FRAME_DELTA);
    let next = current;
    const hadSteps = leftover.current >= SIM_STEP_S;
    while (leftover.current >= SIM_STEP_S) {
      leftover.current -= SIM_STEP_S;
      next = stepWalker(next, walkInput, grid);
    }
    // A tap is one request, however many steps it took to be heard.
    if (hadSteps) walkInput.jump = false;
    if (next === current) return;
    state.current = next;
    publishWalk(next);
  });

  return null;
}

/**
 * Runs the walk while the store says she is walking. Renders nothing; the
 * camera and HUD read what it publishes (see walkLive.ts).
 */
export default function WalkRunner() {
  const walk = useShipBuilderStore((s) => s.walk);
  if (walk.status !== "walking") return null;
  return <Walking key={walk.runId} />;
}
