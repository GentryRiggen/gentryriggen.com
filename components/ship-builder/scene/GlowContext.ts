"use client";

import { createContext, useContext } from "react";

/**
 * How strongly lit things glow right now (0 by day, 1 at night; see glowFor).
 * ShipParts provides it once so a hundred cabins share one subscription;
 * anything rendered outside it (the ghost preview) stays unlit.
 */
export const GlowContext = createContext(0);

export function useGlow(): number {
  return useContext(GlowContext);
}
