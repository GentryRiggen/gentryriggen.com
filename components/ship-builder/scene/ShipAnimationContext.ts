"use client";

import { createContext, useContext } from "react";
import type { SeaState } from "./seaState";

export interface ShipAnimationValue {
  topSpeedKnots: number;
  stabilityRatio: number;
  /** When true every effect is off or static. */
  reducedMotion: boolean;
  /** How rough the water is; scales the ship's bob and roll. */
  seaState: SeaState;
}

/** Outside a provider (previews, tests) nothing moves. */
const STILL: ShipAnimationValue = {
  topSpeedKnots: 0,
  stabilityRatio: 0,
  reducedMotion: true,
  seaState: "calm",
};

export const ShipAnimationContext = createContext<ShipAnimationValue>(STILL);

export function useShipAnimation(): ShipAnimationValue {
  return useContext(ShipAnimationContext);
}
