import type { GridPartDef } from "@/lib/ship-builder/model/types";

/** Light pools sit this far above the surface they fall on. */
export const DECK_POOL_Y = 0.04;

/** Colours and strengths for everything that lights up at sunset and night. */
export const LIGHT_COLORS = {
  /** Unlit bulbs and lenses by day. */
  bulbOff: "#4a4d52",
  stringBulbs: ["#ff5a5a", "#ffd24a", "#5ad66f", "#4aa8ff", "#ff9f43"],
  navPort: "#ff2a2a",
  navStarboard: "#22e060",
  navMasthead: "#ffffff",
  navPortOff: "#8f3030",
  navStarboardOff: "#2f7a45",
  navMastheadOff: "#d8d8d4",
  floodLens: "#fff6d8",
  floodBeam: "#ffe9b0",
  underwater: "#35d9d2",
  underwaterOff: "#6fa9b0",
  searchBeam: "#fff1b0",
  deckLamp: "#ffd98a",
  porthole: "#ffd9a0",
  housing: "#59616a",
} as const;

export type WindowGroup = "first" | "second" | "third" | "crew" | "bridge";

export interface WindowGlow {
  /** Emissive colour of a lit window. */
  color: string;
  /** Emissive intensity of a lit window at full glow. */
  strength: number;
  /** Share of the windows that are lit, 0 to 1. */
  litFraction: number;
}

/**
 * How each kind of window lights up, so a child can tell the classes apart at
 * night: First is warm gold, all lit and brightest; Second is soft warm white,
 * most lit; Third is dimmer and yellower, about half lit; Crew is dim, cool
 * and sparse.
 */
export const WINDOW_GLOW: Record<WindowGroup, WindowGlow> = {
  first: { color: "#ffb92e", strength: 1.1, litFraction: 1 },
  second: { color: "#fff1d6", strength: 0.85, litFraction: 0.8 },
  third: { color: "#d8cc7a", strength: 0.6, litFraction: 0.45 },
  crew: { color: "#9cc2ff", strength: 0.5, litFraction: 0.25 },
  bridge: { color: "#b6f2cf", strength: 0.6, litFraction: 1 },
};

/** The window lighting a block's windows follow, or null if it has none. */
export function windowGroupOf(def: GridPartDef): WindowGroup | null {
  if (def.role === "bridge") return "bridge";
  if (def.passengers) return def.passengers.cabinClass;
  if (def.crewBerths) return "crew";
  return null;
}

/**
 * Whether window number `index` is lit, from a fixed integer hash so the
 * pattern never changes between renders. `seed` varies it from block to block.
 */
export function isWindowLit(
  index: number,
  litFraction: number,
  seed = 0
): boolean {
  if (litFraction >= 1) return true;
  if (litFraction <= 0) return false;
  let hash = Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(seed + 7, 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d);
  return ((hash ^ (hash >>> 12)) >>> 0) % 1000 < litFraction * 1000;
}
