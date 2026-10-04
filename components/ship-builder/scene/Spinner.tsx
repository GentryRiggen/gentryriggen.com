"use client";

import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { MAX_FRAME_DELTA, TAU } from "./animationMath";
import { useShipAnimation } from "./ShipAnimationContext";
import { spinRevPerSec } from "./spin";

interface SpinnerProps {
  /** False for ghost previews, which must stay still. */
  enabled: boolean;
  children: ReactNode;
}

/** Turns its children about local X (a propeller's shaft) at the ship's pace. */
export default function Spinner({ enabled, children }: SpinnerProps) {
  const group = useRef<Group>(null);
  const { topSpeedKnots, reducedMotion } = useShipAnimation();

  useFrame((_, delta) => {
    if (!enabled || reducedMotion || !group.current) return;
    const rate = spinRevPerSec(topSpeedKnots);
    if (rate === 0) return;
    group.current.rotation.x =
      (group.current.rotation.x +
        rate * TAU * Math.min(delta, MAX_FRAME_DELTA)) %
      TAU;
  });

  return <group ref={group}>{children}</group>;
}
