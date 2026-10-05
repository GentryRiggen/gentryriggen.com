"use client";

import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { getSailState } from "@/lib/ship-builder/state/sailLive";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { clamp, MAX_FRAME_DELTA } from "./animationMath";
import { bankAngle } from "./driveCamera";

/** How fast the lean follows the turn, per second. */
const BANK_RATE = 4;

interface SailBankProps {
  children: ReactNode;
}

/**
 * Leans the ship into her turns while she sails (visual only). It wraps the
 * ship's bobbing group rather than changing it, so the trial pose is left
 * alone, and it is always mounted so nothing remounts when a drive starts.
 */
export default function SailBank({ children }: SailBankProps) {
  const group = useRef<Group>(null);
  const reducedMotion = usePrefersReducedMotion();

  useFrame((_, delta) => {
    const target = group.current;
    if (!target) return;
    const sail = getSailState();
    const goal = sail && !reducedMotion ? bankAngle(sail) : 0;
    const rate = clamp(Math.min(delta, MAX_FRAME_DELTA) * BANK_RATE, 0, 1);
    target.rotation.x += (goal - target.rotation.x) * rate;
  });

  return <group ref={group}>{children}</group>;
}
