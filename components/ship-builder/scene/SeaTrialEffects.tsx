"use client";

import { useCallback, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import ParticleField, { type ParticleWriter } from "./ParticleField";
import {
  bubbleIntensity,
  createDroplet,
  splashDroplet,
  splashRing,
  SPLASH_DROPLET_COUNT,
  SPLASH_RING_COUNT,
  TRIAL_BUBBLE_COUNT,
  TRIAL_SPLASH_CAPACITY,
  trialBubble,
  type HullBounds,
} from "./trialEffects";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { frozenTime, testTrialSeconds, testTrialSpeed } from "./testClock";
import { advanceEffectsClock, trialPlayback } from "./trialPlayback";

const BUBBLE_COLOR = "#e8f6ff";
const SPLASH_COLOR = "#ffffff";

/**
 * Bubbles, spray and a spreading ring of ripples while the ship goes over and
 * under. They live in the water, not in the ship's group, so they do not roll
 * with it. Everything reads the sim clock, so a held test pose is stable.
 */
export default function SeaTrialEffects() {
  const isActive = useShipBuilderStore((s) => s.trial.status !== "idle");
  const halfLength = useShipBuilderStore((s) => gridLength(s.ship) / 2);
  const halfBeam = useShipBuilderStore((s) => beamOf(s.ship) / 2);
  const bounds = useMemo<HullBounds>(
    () => ({ halfLength, halfBeam }),
    [halfLength, halfBeam]
  );
  const droplet = useMemo(() => createDroplet(), []);
  const reducedMotion = usePrefersReducedMotion();
  const isResult = useShipBuilderStore((s) => s.trial.status === "result");

  // The runner stops with the sim, but bubbles keep rising and fade out behind
  // the result card. A held test clock stays held, and so does a moment the
  // player scrubbed to: it stays as it was until they replay.
  useFrame((_, delta) => {
    if (!isResult || reducedMotion) return;
    if (trialPlayback.scrubbing || trialPlayback.scrubbed) return;
    if (frozenTime() !== null || testTrialSeconds() !== null) return;
    advanceEffectsClock(delta, testTrialSpeed());
  });

  const updateBubbles = useCallback(
    (writer: ParticleWriter) => {
      if (reducedMotion) return 0;
      const intensity = bubbleIntensity(trialPlayback);
      if (intensity === 0) return 0;
      for (let slot = 0; slot < TRIAL_BUBBLE_COUNT; slot++) {
        trialBubble(slot, trialPlayback.time, bounds, droplet);
        writer.set(
          slot,
          droplet.x,
          droplet.y,
          droplet.z,
          droplet.scale,
          droplet.alpha * intensity
        );
      }
      return TRIAL_BUBBLE_COUNT;
    },
    [bounds, droplet, reducedMotion]
  );

  const updateSplash = useCallback(
    (writer: ParticleWriter) => {
      const { capsizedAt, sinkingAt, time, roll } = trialPlayback;
      if (reducedMotion || capsizedAt === null) return 0;
      const side = roll < 0 ? -1 : 1;
      for (let slot = 0; slot < SPLASH_DROPLET_COUNT; slot++) {
        splashDroplet(slot, time - capsizedAt, side, bounds, droplet);
        writer.set(
          slot,
          droplet.x,
          droplet.y,
          droplet.z,
          droplet.scale,
          droplet.alpha
        );
      }
      for (let slot = 0; slot < SPLASH_RING_COUNT; slot++) {
        const seconds = sinkingAt === null ? -1 : time - sinkingAt;
        splashRing(slot, seconds, bounds, droplet);
        writer.set(
          SPLASH_DROPLET_COUNT + slot,
          droplet.x,
          droplet.y,
          droplet.z,
          droplet.scale,
          droplet.alpha
        );
      }
      return TRIAL_SPLASH_CAPACITY;
    },
    [bounds, droplet, reducedMotion]
  );

  if (!isActive) return null;
  return (
    <>
      <ParticleField
        capacity={TRIAL_BUBBLE_COUNT}
        color={BUBBLE_COLOR}
        update={updateBubbles}
      />
      <ParticleField
        capacity={TRIAL_SPLASH_CAPACITY}
        color={SPLASH_COLOR}
        update={updateSplash}
      />
    </>
  );
}
