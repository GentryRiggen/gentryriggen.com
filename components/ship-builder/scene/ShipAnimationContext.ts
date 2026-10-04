"use client";

import { createContext, useContext } from "react";

export interface ShipAnimationValue {
  topSpeedKnots: number;
  stabilityRatio: number;
  /** When true every effect is off or static. */
  reducedMotion: boolean;
}

/** Outside a provider (previews, tests) nothing moves. */
const STILL: ShipAnimationValue = {
  topSpeedKnots: 0,
  stabilityRatio: 0,
  reducedMotion: true,
};

export const ShipAnimationContext = createContext<ShipAnimationValue>(STILL);

export function useShipAnimation(): ShipAnimationValue {
  return useContext(ShipAnimationContext);
}
