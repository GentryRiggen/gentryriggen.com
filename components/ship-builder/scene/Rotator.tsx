"use client";

import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { MAX_FRAME_DELTA, TAU } from "./animationMath";
import { useShipAnimation } from "./ShipAnimationContext";

interface RotatorProps {
  /** Radians per second about the local Y axis. */
  speed: number;
  /** False for ghost previews, which must stay still. */
  enabled: boolean;
  children: ReactNode;
}

/**
 * Turns its children about local Y at a fixed pace, regardless of the ship's
 * speed (a turret, a radar dish, a rotor). Still under reduced motion.
 */
export default function Rotator({ speed, enabled, children }: RotatorProps) {
  const group = useRef<Group>(null);
  const { reducedMotion } = useShipAnimation();

  useFrame((_, delta) => {
    if (!enabled || reducedMotion || !group.current) return;
    group.current.rotation.y =
      (group.current.rotation.y + speed * Math.min(delta, MAX_FRAME_DELTA)) %
      TAU;
  });

  return <group ref={group}>{children}</group>;
}
