"use client";

import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { MAX_FRAME_DELTA } from "./animationMath";
import { CRANE_REST_ANGLE, SWING_RANGE, SWING_RATE } from "./cargoParts";
import { useShipAnimation } from "./ShipAnimationContext";
import { frozenTime } from "./testClock";

interface SwingerProps {
  /** False for ghost previews, which stay at the crane's rest angle. */
  enabled: boolean;
  children: ReactNode;
}

/**
 * Swings its children about local Y like the procedural cargo crane's slew
 * group: slowly back and forth around a rest angle. Still under reduced
 * motion.
 */
export default function Swinger({ enabled, children }: SwingerProps) {
  const group = useRef<Group>(null);
  const phase = useRef(0);
  const { reducedMotion } = useShipAnimation();

  useFrame((_, delta) => {
    if (!enabled || reducedMotion || !group.current) return;
    const frozen = frozenTime();
    phase.current =
      frozen !== null
        ? frozen * SWING_RATE
        : phase.current + Math.min(delta, MAX_FRAME_DELTA) * SWING_RATE;
    group.current.rotation.y =
      CRANE_REST_ANGLE + Math.sin(phase.current) * SWING_RANGE;
  });

  return (
    <group ref={group} rotation={[0, CRANE_REST_ANGLE, 0]}>
      {children}
    </group>
  );
}
