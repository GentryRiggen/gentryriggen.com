import type { FlightEvent } from "@/lib/plane-builder/sim/flight";
import { planeSynth, type PlaneCue } from "./planeSynth";

const CUE_FOR_EVENT: Partial<Record<FlightEvent["type"], PlaneCue>> = {
  coin: "coin",
  ring: "ring",
  bump: "bump",
  shield: "shield",
  crash: "crash",
  landed: "land",
};

/** The sound for a sim event, or null when it has none ("finish" cheers on the results card). */
export function cueForEvent(event: FlightEvent): PlaneCue | null {
  return CUE_FOR_EVENT[event.type] ?? null;
}

/** Plays the cue for each sim event. */
export function playFlightEvents(events: readonly FlightEvent[]) {
  for (const event of events) {
    const cue = cueForEvent(event);
    if (cue) planeSynth.play(cue);
  }
}

/** Engine hum level, 0 to 1: boost is full, a normal burn half, no fuel silent. */
export function engineLevel(
  hasThrust: boolean,
  fuel: number,
  isFlying: boolean,
  isBoosting: boolean
): number {
  if (!hasThrust || fuel <= 0 || !isFlying) return 0;
  return isBoosting ? 1 : 0.5;
}
