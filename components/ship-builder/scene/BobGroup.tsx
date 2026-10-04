"use client";

import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { bobPose, createShipPose } from "./bob";
import { useShipAnimation } from "./ShipAnimationContext";

interface BobGroupProps {
  children: ReactNode;
}

/**
 * Floats everything inside it on the water: a gentle rise and fall plus a
 * roll about the long axis that grows as the ship gets top-heavy. Hull, parts,
 * ghost and tap targets share it, so taps still line up with what is drawn.
 */
export default function BobGroup({ children }: BobGroupProps) {
  const group = useRef<Group>(null);
  const pose = useMemo(() => createShipPose(), []);
  const { stabilityRatio, reducedMotion, seaState } = useShipAnimation();

  useFrame((state) => {
    const target = group.current;
    if (!target) return;
    if (reducedMotion) {
      target.position.y = 0;
      target.rotation.set(0, 0, 0);
      return;
    }
    bobPose(state.clock.elapsedTime, stabilityRatio, pose, seaState);
    target.position.y = pose.y;
    target.rotation.set(pose.roll, 0, pose.pitch);
  });

  return <group ref={group}>{children}</group>;
}
