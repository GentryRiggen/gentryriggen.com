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
import { strikePose, type StrikePose } from "./strikeMotion";

interface BobGroupProps {
  children: ReactNode;
}

const LEVEL_POSE = createShipPose();
const strike: StrikePose = { y: 0, roll: 0, pitch: 0 };

/** A mine's jolt or an island's grounding, added to the sim's pose. */
function strikePoseNow(
  trial: ReturnType<typeof useShipBuilderStore.getState>["trial"],
  reducedMotion: boolean
): StrikePose {
  strike.y = 0;
  strike.roll = 0;
  strike.pitch = 0;
  if (trial.status !== "running" && trial.status !== "result") return strike;
  const iceberg = trial.input.iceberg;
  if (!iceberg?.strike || iceberg.strike === "iceberg") return strike;
  // Reduced motion: no shaking, but she still sits up on the rocks.
  if (reducedMotion && iceberg.strike === "mine") return strike;
  return strikePose(
    iceberg.strike,
    iceberg.impactX,
    iceberg.length,
    trialPlayback.time,
    trialPlayback.sinkingAt,
    strike
  );
}

/** Seconds the sea trial's pose takes to fade in or out. */
const TRIAL_BLEND_SECONDS = 0.5;

/**
 * Floats everything inside it on the water: a gentle rise and fall plus a
 * roll about the long axis that grows as the ship gets top-heavy, and a
 * lopsided ship leans toward its heavy side. During a sea trial the sim's
 * pose (roll, pitch, sink) is added on top. Hull, parts, ghost and tap
 * targets share it, so taps still line up with what is drawn.
 */
/**
 * A setup card or aiming an iceberg still shows the ship as built, floating
 * as usual.
 */
function isBuilding(status: string): boolean {
  return status === "idle" || status === "setup" || status === "aiming";
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

  // Priority -1 runs this before the walker's eyes (WalkEyes, a child of this
  // group, whose frame callback would otherwise register first and read last
  // frame's pose). Negative priority leaves automatic rendering on.
  useFrame((state, delta) => {
    const target = group.current;
    if (!target) return;
    const { trial } = useShipBuilderStore.getState();
    const { status } = trial;
    const frozen = frozenTime() !== null;
    const step = frozen ? FROZEN_STEP : Math.min(delta, MAX_FRAME_DELTA);

    // Coming back from a ship that rolled over or sank: it pops back upright
    // like a freshly placed part instead of unrolling through the water.
    const previous = previousStatus.current;
    previousStatus.current = status;
    if (previous !== status && !isBuilding(previous) && wasHeavy.current) {
      // "Watch again" and "Try again" restart from a result.
      const isRestarting = previous === "result" && trial.status === "running";
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
    trialPlayback.blend = weight;
    const extra = strikePoseNow(trial, reducedMotion);
    target.position.y = bob.y + (extra.y - trialPlayback.sink) * weight;
    target.rotation.set(
      // The sim's roll starts at the ship's list, so it replaces the idle list.
      // The idle roll fades out too: the sim's waves already roll her, and
      // adding the idle roll on top would double the motion in a storm.
      bob.roll * (1 - weight) +
        listAngle * (1 - weight) +
        (trialPlayback.roll + extra.roll) * weight,
      0,
      bob.pitch + (trialPlayback.pitch + extra.pitch) * weight
    );

    if (popElapsed.current < POP_DURATION) {
      popElapsed.current = frozen ? POP_DURATION : popElapsed.current + step;
      target.scale.setScalar(reducedMotion ? 1 : popScale(popElapsed.current));
    } else if (target.scale.x !== 1) {
      target.scale.setScalar(1);
    }
    if (!isBuilding(status)) wasHeavy.current = isHeavyTrialPose(trialPlayback);
  }, -1);

  return <group ref={group}>{children}</group>;
}
