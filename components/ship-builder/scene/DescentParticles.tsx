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
      landed: Array.from({ length: MAX_BODIES }, (): Landing => ({
        at: 0,
        x: 0,
      })),
    }),
    []
  );

  const updateBubbles = useCallback(
    (writer: ParticleWriter) => {
      if (trialPlayback.phase !== "descending") return 0;
      const { droplet, bodies } = scratch;
      const count = descentBodies(trialPlayback, lengthCells, bodies);
      for (let b = 0; b < count; b++) {
        const intensity = trailIntensity(bodies[b]);
        for (let i = 0; i < BUBBLES_PER_BODY; i++) {
          const slot = b * BUBBLES_PER_BODY + i;
          descentBubble(slot, trialPlayback.time, bodies[b], droplet);
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
      const count = landings(trialPlayback, bodies, bodyCount, landed);
      for (let p = 0; p < count; p++) {
        const seconds = trialPlayback.time - landed[p].at;
        for (let i = 0; i < SILT_PER_PUFF; i++) {
          siltGrain(i + p * 7, seconds, landed[p].x, droplet);
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
      return count * SILT_PER_PUFF;
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
