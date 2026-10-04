"use client";

import { useMemo, type ReactNode } from "react";
import { computeStats } from "@/lib/ship-builder/model/stats";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import BobGroup from "./BobGroup";
import FunnelSmoke from "./FunnelSmoke";
import {
  ShipAnimationContext,
  type ShipAnimationValue,
} from "./ShipAnimationContext";

interface ShipAnimationProps {
  children: ReactNode;
}

/**
 * Computes the ship's stats once and shares the numbers the effects need
 * (speed, stability) with everything beneath it. Everything that belongs to
 * the ship, effects included, floats together in one bobbing group.
 */
export default function ShipAnimation({ children }: ShipAnimationProps) {
  const ship = useShipBuilderStore((s) => s.ship);
  const reducedMotion = usePrefersReducedMotion();
  const stats = useMemo(() => computeStats(ship), [ship]);
  const { topSpeedKnots, stabilityRatio } = stats;
  const value = useMemo<ShipAnimationValue>(
    () => ({ topSpeedKnots, stabilityRatio, reducedMotion }),
    [topSpeedKnots, stabilityRatio, reducedMotion]
  );

  return (
    <ShipAnimationContext.Provider value={value}>
      <BobGroup>
        {children}
        <FunnelSmoke />
      </BobGroup>
    </ShipAnimationContext.Provider>
  );
}
