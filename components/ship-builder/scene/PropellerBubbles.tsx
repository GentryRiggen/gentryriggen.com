"use client";

import { useCallback, useMemo, useRef } from "react";
import { getSailState } from "@/lib/ship-builder/state/sailLive";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { clamp } from "./animationMath";
import {
  BUBBLE_LIFE,
  BUBBLES_PER_PROPELLER,
  bubbleCapacity,
  bubbleState,
  createBubbleState,
} from "./bubbles";
import { collectEffectAnchors } from "./effectAnchors";
import ParticleField, { type ParticleWriter } from "./ParticleField";
import { lifePhase, slotNoise } from "./particles";
import { useShipAnimation } from "./ShipAnimationContext";
import { spinRevPerSec } from "./spin";

const BUBBLE_COLOR = "#e8f6ff";
const FADE_SECONDS = 0.5;
/** Bubbles start just behind the blades, scattered within this radius. */
const START_AFT = 0.3;
const SCATTER = 0.3;

/** Cells per second at which a sailing ship's bubbles stream at full pace. */
const FULL_PACE_SPEED = 4;

/** Bubbles streaming aft from spinning propellers, seen from below. */
export default function PropellerBubbles() {
  const isBelow = useShipBuilderStore((s) => s.camera.view === "below");
  const isSailing = useShipBuilderStore((s) => s.drive.status === "sailing");
  const ship = useShipBuilderStore((s) => s.ship);
  const { topSpeedKnots, reducedMotion } = useShipAnimation();
  const anchors = useMemo(
    () => (isBelow || isSailing ? collectEffectAnchors(ship) : null),
    [isBelow, isSailing, ship]
  );
  const positions = anchors?.propellers;
  const capacity = bubbleCapacity((positions?.length ?? 0) / 3);
  const rev = spinRevPerSec(topSpeedKnots);
  const emitting = (isBelow || isSailing) && rev > 0 && !reducedMotion;
  const intensity = useRef(0);
  const bubble = useMemo(() => createBubbleState(), []);

  const update = useCallback(
    (writer: ParticleWriter, time: number, delta: number) => {
      const step = delta / FADE_SECONDS;
      // Under way the stream follows her speed: none at rest, full at pace.
      const sail = isSailing ? getSailState() : null;
      const pace = sail
        ? clamp(Math.abs(sail.speed) / FULL_PACE_SPEED, 0, 1)
        : 1;
      const isStreaming = emitting && pace > 0.02;
      intensity.current = clamp(
        intensity.current + (isStreaming ? step : -step),
        0,
        1
      );
      if (intensity.current === 0 || !positions) return 0;

      const liveRev = rev * pace;
      let slot = 0;
      for (let p = 0; p < positions.length; p += 3) {
        for (let i = 0; i < BUBBLES_PER_PROPELLER; i++, slot++) {
          if (slot >= capacity) return slot;
          const age = lifePhase(
            time,
            BUBBLE_LIFE,
            i / BUBBLES_PER_PROPELLER + p * 0.211
          );
          bubbleState(age, liveRev, bubble);
          writer.set(
            slot,
            positions[p] - START_AFT - bubble.aft,
            positions[p + 1] + slotNoise(slot, 3) * SCATTER + bubble.rise,
            positions[p + 2] + slotNoise(slot, 4) * SCATTER,
            bubble.scale,
            bubble.alpha * intensity.current
          );
        }
      }
      return slot;
    },
    [bubble, capacity, emitting, isSailing, positions, rev]
  );

  if (capacity === 0) return null;
  return (
    <ParticleField capacity={capacity} color={BUBBLE_COLOR} update={update} />
  );
}
