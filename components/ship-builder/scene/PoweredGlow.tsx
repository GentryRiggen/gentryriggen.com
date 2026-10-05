"use client";

import { useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import {
  createGlowController,
  GlowContext,
  type GlowController,
} from "./GlowContext";
import { eventTime, powerLevel } from "./powerFlicker";
import { useShipAnimation } from "./ShipAnimationContext";
import { trialPlayback } from "./trialPlayback";

interface PoweredGlowProps {
  /** The sky's glow, driven by the Environment. */
  glow: GlowController;
  children: (powered: GlowController) => ReactNode;
}

/**
 * Hands its children a glow controller that follows the sky's glow scaled by
 * the ship's power, so lights flicker and die in a sinking ship. With power
 * on (every other trial, and while building) it is the sky's glow unchanged.
 * The Environment keeps the raw controller: only the ship's lamps use this.
 */
export default function PoweredGlow({ glow, children }: PoweredGlowProps) {
  const { reducedMotion } = useShipAnimation();
  const [powered] = useState(() => createGlowController(glow.value));

  // The Environment's negative-priority frame has already set the sky glow.
  useFrame(() => {
    const { power, time, events } = trialPlayback;
    const level = powerLevel(
      power,
      time,
      eventTime(events, "power-flicker"),
      reducedMotion,
      eventTime(events, "power-out")
    );
    powered.set(glow.value * level);
  });

  return (
    <GlowContext.Provider value={powered}>
      {children(powered)}
    </GlowContext.Provider>
  );
}
