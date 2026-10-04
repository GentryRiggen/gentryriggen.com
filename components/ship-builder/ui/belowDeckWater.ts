import type { Compartment } from "@/lib/ship-builder/sim/types";

/** The water levels and opened ids `BelowDeckDiagram` draws, from a sim state. */
export function belowDeckWater(compartments: readonly Compartment[]): {
  water: Record<string, number>;
  opened: string[];
} {
  return {
    water: Object.fromEntries(compartments.map((c) => [c.id, c.water])),
    opened: compartments.filter((c) => c.opened).map((c) => c.id),
  };
}
