"use client";

import { useCallback, useMemo, useRef } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { clamp } from "./animationMath";
import { collectEffectAnchors } from "./effectAnchors";
import ParticleField, { type ParticleWriter } from "./ParticleField";
import { lifePhase, slotNoise } from "./particles";
import { useShipAnimation } from "./ShipAnimationContext";
import {
  createPuffState,
  puffState,
  smokeCapacity,
  SMOKE_LARGE_FACTOR,
  SMOKE_LIFE,
  SMOKE_PUFFS_LARGE,
  SMOKE_PUFFS_SMALL,
} from "./smoke";

const SMOKE_COLOR = "#cfd4da";
/** Seconds for the plume to fade away or build back up when speed changes. */
const FADE_SECONDS = 0.6;
/** Sideways wander of a puff as it rises, in world units. */
const WOBBLE = 0.25;

/** Soft grey puffs rising from every funnel while the ship is under way. */
export default function FunnelSmoke() {
  const ship = useShipBuilderStore((s) => s.ship);
  const { topSpeedKnots, reducedMotion } = useShipAnimation();
  const anchors = useMemo(() => collectEffectAnchors(ship), [ship]);
  const capacity = smokeCapacity(
    anchors.smallFunnels.length / 3,
    anchors.largeFunnels.length / 3
  );
  const intensity = useRef(0);
  const puff = useMemo(createPuffState, []);
  const emitting = topSpeedKnots > 0 && !reducedMotion;

  const update = useCallback(
    (writer: ParticleWriter, time: number, delta: number) => {
      const step = delta / FADE_SECONDS;
      intensity.current = clamp(
        intensity.current + (emitting ? step : -step),
        0,
        1
      );
      if (intensity.current === 0) return 0;

      let slot = 0;
      const emit = (positions: number[], puffs: number, factor: number) => {
        for (let f = 0; f < positions.length; f += 3) {
          for (let i = 0; i < puffs; i++, slot++) {
            if (slot >= capacity) return;
            const age = lifePhase(time, SMOKE_LIFE, i / puffs + f * 0.137);
            puffState(age, factor, puff);
            writer.set(
              slot,
              positions[f] - puff.drift + slotNoise(slot, 1) * WOBBLE * age,
              positions[f + 1] + puff.rise,
              positions[f + 2] + slotNoise(slot, 2) * WOBBLE * age,
              puff.scale,
              puff.alpha * intensity.current
            );
          }
        }
      };
      emit(anchors.smallFunnels, SMOKE_PUFFS_SMALL, 1);
      emit(anchors.largeFunnels, SMOKE_PUFFS_LARGE, SMOKE_LARGE_FACTOR);
      return slot;
    },
    [anchors, capacity, emitting, puff]
  );

  if (capacity === 0) return null;
  return (
    <ParticleField capacity={capacity} color={SMOKE_COLOR} update={update} />
  );
}
