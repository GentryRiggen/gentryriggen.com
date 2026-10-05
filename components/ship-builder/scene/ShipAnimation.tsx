"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { analyzeShip } from "@/lib/ship-builder/model/analysis";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import useSeaState from "../hooks/useSeaState";
import BobGroup from "./BobGroup";
import BrokenShip from "./BrokenShip";
import FunnelSmoke from "./FunnelSmoke";
import PropellerBubbles from "./PropellerBubbles";
import {
  ShipAnimationContext,
  type ShipAnimationValue,
} from "./ShipAnimationContext";
import { trialPlayback } from "./trialPlayback";

interface ShipAnimationProps {
  children: ReactNode;
}

/** Where the playback has her broken, cells from the bow, or null if whole. */
function breakAtX(): number | null {
  const { halves, breakup } = trialPlayback;
  if (!halves) return null;
  return breakup?.atX ?? halves.bow.pivotX;
}

/**
 * Re-renders only when the ship breaks or comes back whole: the playback is
 * checked every frame, but state changes just on those two moments.
 */
function useBreakAtX(): number | null {
  const [atX, setAtX] = useState<number | null>(null);
  const seen = useRef<number | null>(null);
  useFrame(() => {
    const next = breakAtX();
    if (next === seen.current) return;
    seen.current = next;
    setAtX(next);
  });
  return atX;
}

/**
 * Computes the ship's stats once and shares the numbers the effects need
 * (speed, stability) with everything beneath it. Everything that belongs to
 * the ship, effects included, floats together in one bobbing group. Once she
 * breaks in two the same contents are drawn by `BrokenShip` instead; the
 * empty bobbing group stays so leaving the trial still pops her back.
 */
export default function ShipAnimation({ children }: ShipAnimationProps) {
  const ship = useShipBuilderStore((s) => s.ship);
  const reducedMotion = usePrefersReducedMotion();
  const { seaState } = useSeaState();
  const stats = useMemo(() => analyzeShip(ship).stats, [ship]);
  const { topSpeedKnots, stabilityRatio } = stats;
  const { listAngle } = stats;
  const value = useMemo<ShipAnimationValue>(
    () => ({
      topSpeedKnots,
      stabilityRatio,
      reducedMotion,
      seaState,
      listAngle,
    }),
    [topSpeedKnots, stabilityRatio, reducedMotion, seaState, listAngle]
  );

  const atX = useBreakAtX();
  const isWhole = atX === null;

  return (
    <ShipAnimationContext.Provider value={value}>
      <BobGroup>
        {isWhole && children}
        {isWhole && <FunnelSmoke />}
        {isWhole && <PropellerBubbles />}
      </BobGroup>
      {!isWhole && <BrokenShip atX={atX}>{children}</BrokenShip>}
    </ShipAnimationContext.Provider>
  );
}
