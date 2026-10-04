import type { SimShip, SimSea, SimState } from "./types";

export interface TrialSummary {
  /** Short headline, e.g. "Steady as she goes!". */
  title: string;
  /** One or two plain sentences on what happened and why. */
  message: string;
  /** What to change next time; empty when the ship did well. */
  tips: string[];
}

/**
 * PLACEHOLDER: plain-words summary of a finished trial for the result card.
 * The signature is the contract.
 */
export function explainTrial(
  state: SimState,
  ship: SimShip,
  sea: SimSea
): TrialSummary {
  void ship;
  void sea;
  return state.outcome === "capsized"
    ? {
        title: "She capsized!",
        message: "Your ship was too top-heavy for these waves.",
        tips: ["Build lower, or make the hull wider"],
      }
    : { title: "Steady as she goes!", message: "She handled it.", tips: [] };
}
