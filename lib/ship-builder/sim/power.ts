import type { CompartmentSpec, PowerState, SimEvent, SimState } from "./types";

/**
 * The ship's lights: on, then flickering once the water reaches the engine
 * room (or enough of the hull), then out for good as she goes down. The
 * flicker pattern itself is drawn by the scene; the sim only says when.
 */

/** Flooded fraction of the hull at which the lights start to flicker. */
export const FLICKER_FLOODED = 0.2;
/** Water above this (fraction of depth) counts a compartment as flooded. */
export const FLOODED_WATER = 0.5;
/**
 * The lights go out once the strain reaches this share of her strength, so
 * the dark comes a moment before she breaks.
 */
export const POWER_OUT_STRAIN = 0.85;

/** The compartment holding the middle of the hull: the "engine room". */
export function middleCompartmentOf(
  specs: readonly CompartmentSpec[],
  length: number
): number {
  const middle = length / 2;
  for (let i = 0; i < specs.length; i++) {
    if (specs[i].fromX <= middle && middle < specs[i].toX) return i;
  }
  return specs.length - 1;
}

/** Flooded volume over the hull's length, 0 to 1. */
export function floodedFractionOf(
  state: SimState,
  specs: readonly CompartmentSpec[],
  length: number
): number {
  let volume = 0;
  for (let i = 0; i < specs.length; i++) {
    volume +=
      (state.compartments[i]?.water ?? 0) * (specs[i].toX - specs[i].fromX);
  }
  return volume / length;
}

/** Whether the water has reached the point where the lights start to fail. */
export function shouldFlicker(
  state: SimState,
  specs: readonly CompartmentSpec[],
  length: number
): boolean {
  if (specs.length === 0) return false;
  const engineRoom = state.compartments[middleCompartmentOf(specs, length)];
  return (
    floodedFractionOf(state, specs, length) >= FLICKER_FLOODED ||
    (engineRoom?.water ?? 0) > FLOODED_WATER
  );
}

/**
 * Moves the lights on to `next` (never back), logging `power-flicker` and
 * `power-out` once each, flicker first even when both happen in one step.
 */
export function withPower(
  state: SimState,
  next: PowerState,
  at: number
): SimState {
  const rank: Record<PowerState, number> = { on: 0, flickering: 1, out: 2 };
  if (rank[next] <= rank[state.power]) return state;
  const events: SimEvent[] = [...state.events];
  if (state.power === "on") events.push({ at, kind: "power-flicker" });
  if (next === "out") events.push({ at, kind: "power-out" });
  return { ...state, power: next, events };
}
