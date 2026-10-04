"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { MAX_FRAME_DELTA } from "./animationMath";
import { popScale, POP_DURATION } from "./pop";
import { useShipAnimation } from "./ShipAnimationContext";
import { frozenTime } from "./testClock";

interface PopTickerProps {
  /** The wrapper whose first child (the part's own group) is scaled. */
  wrapper: React.RefObject<Group | null>;
}

/**
 * Scales the part's own group about its own origin. The wrapper sits at the
 * ship origin, so scaling the wrapper itself would swing the part sideways.
 */
function PopTicker({ wrapper }: PopTickerProps) {
  const elapsed = useRef(0);

  useLayoutEffect(() => {
    wrapper.current?.children[0]?.scale.setScalar(popScale(0));
  }, [wrapper]);

  useFrame((_, delta) => {
    if (elapsed.current >= POP_DURATION) return;
    // Frozen scenes show the finished part, not a half-grown one.
    elapsed.current =
      frozenTime() === null
        ? elapsed.current + Math.min(delta, MAX_FRAME_DELTA)
        : POP_DURATION;
    wrapper.current?.children[0]?.scale.setScalar(popScale(elapsed.current));
  });

  return null;
}

interface PopInProps {
  /** True only for the one part the player just placed. */
  active: boolean;
  children: ReactNode;
}

/** Gives a newly placed part a quick springy scale-up. */
export default function PopIn({ active, children }: PopInProps) {
  const wrapper = useRef<Group>(null);
  const { reducedMotion } = useShipAnimation();

  return (
    <group ref={wrapper}>
      {children}
      {active && !reducedMotion && <PopTicker wrapper={wrapper} />}
    </group>
  );
}
