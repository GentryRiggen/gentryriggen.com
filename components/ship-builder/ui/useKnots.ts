import { useSyncExternalStore } from "react";
import { CELLS_PER_KNOT } from "@/lib/ship-builder/sail/handling";
import { getSailState, subscribeSail } from "@/lib/ship-builder/state/sailLive";

/** Whole knots, so a readout re-renders only when the number changes. */
function getKnots(): number {
  const sail = getSailState();
  return sail ? Math.round(Math.abs(sail.speed) / CELLS_PER_KNOT) : 0;
}

/** The ship's speed in whole knots, live from the sail state. */
export default function useKnots(): number {
  return useSyncExternalStore(subscribeSail, getKnots, () => 0);
}
