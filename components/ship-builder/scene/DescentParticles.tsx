"use client";

import { useCallback, useMemo } from "react";
import { gridLength } from "@/lib/ship-builder/model/grid";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import {
  BUBBLES_PER_BODY,
  createBodyPoint,
  DESCENT_BUBBLE_CAPACITY,
  DESCENT_SILT_CAPACITY,
  descentBodies,
  descentBubble,
  landings,
  MAX_BODIES,
  siltGrain,
  SILT_PER_PUFF,
  trailFade,
  trailIntensity,
  type Landing,
} from "./descentEffects";
import ParticleField, { type ParticleWriter } from "./ParticleField";
import { createDroplet } from "./trialEffects";
import { trialPlayback } from "./trialPlayback";

const BUBBLE_COLOR = "#e8f6ff";
const SILT_COLOR = "#b9a37a";

/**
 * Bubble trails behind the wreck on her way down and a puff of silt where
 * each body lands. Positions come from the playback clock, so scrubbing moves
 * them. Under reduced motion the floor still shows but nothing drifts.
 */
export default function DescentParticles() {
  const isActive = useShipBuilderStore((s) => s.trial.status !== "idle");
  const lengthCells = useShipBuilderStore((s) => gridLength(s.ship));
  const reducedMotion = usePrefersReducedMotion();
  const scratch = useMemo(
    () => ({
      droplet: createDroplet(),
      bodies: Array.from({ length: MAX_BODIES }, createBodyPoint),
      // Scene time the descent ended (the trails then fade), or null.
      trailEndedAt: null as number | null,
      wasDescending: false,
      landed: Array.from({ length: MAX_BODIES }, (): Landing => ({
        hasLanded: false,
        at: 0,
        x: 0,
      })),
    }),
    []
  );

  const updateBubbles = useCallback(
    (writer: ParticleWriter, time: number) => {
      const { droplet, bodies } = scratch;
      // Once the descent is over the trails keep rising for a moment and
      // fade, rather than vanishing the instant the last half settles.
      let fade = 1;
      let afterwards = 0;
      if (trialPlayback.phase === "descending") {
        scratch.wasDescending = true;
        scratch.trailEndedAt = null;
      } else {
        if (!scratch.wasDescending) return 0;
        scratch.trailEndedAt ??= time;
        afterwards = time - scratch.trailEndedAt;
        fade = trailFade(afterwards);
        if (fade <= 0) {
          scratch.wasDescending = false;
          return 0;
        }
      }
      const bubbleTime = trialPlayback.time + afterwards;
      const count = descentBodies(trialPlayback, lengthCells, bodies);
      for (let b = 0; b < count; b++) {
        const intensity = trailIntensity(bodies[b]) * fade;
        for (let i = 0; i < BUBBLES_PER_BODY; i++) {
          const slot = b * BUBBLES_PER_BODY + i;
          descentBubble(slot, bubbleTime, bodies[b], droplet);
          writer.set(
            slot,
            droplet.x,
            droplet.y,
            droplet.z,
            droplet.scale,
            droplet.alpha * intensity
          );
        }
      }
      return count * BUBBLES_PER_BODY;
    },
    [lengthCells, scratch]
  );

  const updateSilt = useCallback(
    (writer: ParticleWriter) => {
      const { droplet, bodies, landed } = scratch;
      const bodyCount = descentBodies(trialPlayback, lengthCells, bodies);
      landings(trialPlayback, bodies, bodyCount, landed);
      // Each body owns its slots, so the first puff stays put when the
      // second body lands; a body still falling writes invisible grains.
      for (let p = 0; p < bodyCount; p++) {
        const landing = landed[p];
        const seconds = landing.hasLanded
          ? trialPlayback.time - landing.at
          : -1;
        for (let i = 0; i < SILT_PER_PUFF; i++) {
          siltGrain(i + p * 7, seconds, landing.x, droplet);
          writer.set(
            p * SILT_PER_PUFF + i,
            droplet.x,
            droplet.y,
            droplet.z,
            droplet.scale,
            droplet.alpha
          );
        }
      }
      return bodyCount * SILT_PER_PUFF;
    },
    [lengthCells, scratch]
  );

  if (!isActive || reducedMotion) return null;
  return (
    <>
      <ParticleField
        capacity={DESCENT_BUBBLE_CAPACITY}
        color={BUBBLE_COLOR}
        update={updateBubbles}
      />
      <ParticleField
        capacity={DESCENT_SILT_CAPACITY}
        color={SILT_COLOR}
        update={updateSilt}
      />
    </>
  );
}
