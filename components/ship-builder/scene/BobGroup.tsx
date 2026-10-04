"use client";

import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { clamp, MAX_FRAME_DELTA } from "./animationMath";
import { bobPose, createShipPose } from "./bob";
import { popScale, POP_DURATION } from "./pop";
import { useShipAnimation } from "./ShipAnimationContext";
import { frozenTime, FROZEN_STEP, sceneTime } from "./testClock";
import { trialPlayback } from "./trialPlayback";
import { isHeavyTrialPose } from "./trialPose";

interface BobGroupProps {
  children: ReactNode;
}

const LEVEL_POSE = createShipPose();

/** Seconds the sea trial's pose takes to fade in or out. */
const TRIAL_BLEND_SECONDS = 0.5;

/**
 * Floats everything inside it on the water: a gentle rise and fall plus a
 * roll about the long axis that grows as the ship gets top-heavy, and a
 * lopsided ship leans toward its heavy side. During a sea trial the sim's
 * pose (roll, pitch, sink) is added on top. Hull, parts, ghost and tap
 * targets share it, so taps still line up with what is drawn.
 */
/** Aiming an iceberg still shows the ship as built, floating as usual. */
function isBuilding(status: string): boolean {
  return status === "idle" || status === "aiming";
}

export default function BobGroup({ children }: BobGroupProps) {
  const group = useRef<Group>(null);
  const pose = useMemo(() => createShipPose(), []);
  const { stabilityRatio, reducedMotion, seaState, listAngle } =
    useShipAnimation();
  // How much of the trial pose shows (0 to 1) and where the return pop is.
  const blend = useRef(0);
  const popElapsed = useRef(POP_DURATION);
  const previousStatus = useRef("idle");
  const wasHeavy = useRef(false);

  useFrame((state, delta) => {
    const target = group.current;
    if (!target) return;
    const status = useShipBuilderStore.getState().trial.status;
    const frozen = frozenTime() !== null;
    const step = frozen ? FROZEN_STEP : Math.min(delta, MAX_FRAME_DELTA);

    // Coming back from a ship that rolled over or sank: it pops back upright
    // like a freshly placed part instead of unrolling through the water.
    const previous = previousStatus.current;
    previousStatus.current = status;
    if (previous !== status && !isBuilding(previous) && wasHeavy.current) {
      const isRestarting = previous === "result" && status === "running";
      if (isBuilding(status) || isRestarting) {
        blend.current = isRestarting ? 1 : 0;
        popElapsed.current = 0;
      }
    }

    const goal = isBuilding(status) ? 0 : 1;
    const rate = reducedMotion ? 1 : step / TRIAL_BLEND_SECONDS;
    blend.current = clamp(
      blend.current + clamp(goal - blend.current, -rate, rate),
      0,
      1
    );

    const bob = reducedMotion
      ? LEVEL_POSE
      : bobPose(
          sceneTime(state.clock.elapsedTime),
          stabilityRatio,
          pose,
          seaState
        );
    const weight = blend.current;
    target.position.y = bob.y - trialPlayback.sink * weight;
    target.rotation.set(
      // The sim's roll starts at the ship's list, so it replaces the idle list.
      // The idle roll fades out too: the sim's waves already roll her, and
      // adding the idle roll on top would double the motion in a storm.
      bob.roll * (1 - weight) +
        listAngle * (1 - weight) +
        trialPlayback.roll * weight,
      0,
      bob.pitch + trialPlayback.pitch * weight
    );

    if (popElapsed.current < POP_DURATION) {
      popElapsed.current = frozen ? POP_DURATION : popElapsed.current + step;
      target.scale.setScalar(reducedMotion ? 1 : popScale(popElapsed.current));
    } else if (target.scale.x !== 1) {
      target.scale.setScalar(1);
    }
    if (!isBuilding(status)) wasHeavy.current = isHeavyTrialPose(trialPlayback);
  });

  return <group ref={group}>{children}</group>;
}
