import type { FlightEvent } from "@/lib/plane-builder/sim/flight";
import {
  flightToasts,
  toastForEvent,
} from "@/lib/plane-builder/state/flightToasts";
import { MIN_SPEED, STALL_WINDOW } from "@/lib/plane-builder/sim/constants";
import type { FlightSound } from "./planeBeds";
import { planeSynth, type PlaneCue } from "./planeSynth";

const CUE_FOR_EVENT: Partial<Record<FlightEvent["type"], PlaneCue>> = {
  coin: "coin",
  ring: "ring",
  bump: "bump",
  shield: "shield",
  crash: "crash",
  landed: "land",
  fuel: "fuel",
  milestone: "flag",
};

/** The sound for a sim event, or null when it has none ("finish" cheers on the results card). */
export function cueForEvent(event: FlightEvent): PlaneCue | null {
  return CUE_FOR_EVENT[event.type] ?? null;
}

/** Plays the cue and shows the pop-up for each sim event. */
export function playFlightEvents(events: readonly FlightEvent[]) {
  for (const event of events) {
    const cue = cueForEvent(event);
    if (cue) planeSynth.play(cue);
    const text = toastForEvent(event);
    if (text) flightToasts.push(text);
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

/** Speed (m/s) at which the wind rush is at full. */
export const WIND_FULL_SPEED = 70;
/** Seconds without progress before the stall warning begins. */
export const STALL_WARN_FROM = 1;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export interface FlightSoundInputs {
  hasThrust: boolean;
  fuel: number;
  phase: "flying" | "sliding" | "done";
  /** The player is holding boost. */
  wantsBoost: boolean;
  /** The day's twist has not switched boost off. */
  canBoost: boolean;
  /** m/s. */
  speed: number;
  /** Sim seconds since the plane last made progress (see the stall rule). */
  progressTimer: number;
}

/**
 * The held sounds of a flight: engine burn, wind from speed, the boost press
 * and how close a stall is. Only a plane in the air makes any of them.
 */
export function flightSoundFor(inputs: FlightSoundInputs): FlightSound {
  const isFlying = inputs.phase === "flying";
  const engine = engineLevel(
    inputs.hasThrust,
    inputs.fuel,
    isFlying,
    inputs.wantsBoost && inputs.canBoost
  );
  return {
    engine,
    speed: isFlying
      ? clamp01((inputs.speed - MIN_SPEED) / (WIND_FULL_SPEED - MIN_SPEED))
      : 0,
    boosting: engine === 1,
    stall: isFlying
      ? clamp01(
          (inputs.progressTimer - STALL_WARN_FROM) /
            (STALL_WINDOW - STALL_WARN_FROM)
        )
      : 0,
  };
}

/** A ghost this close (m) as it swaps places with you is worth a whoosh. */
export const GHOST_PASS_RANGE = 30;

/**
 * Whether the ghost and the player just swapped places along the course
 * (`dx` is the ghost's distance ahead, negative when it is behind) and were
 * close enough to hear it.
 */
export function didGhostPass(
  prevDx: number,
  nextDx: number,
  distance: number
): boolean {
  if (distance > GHOST_PASS_RANGE) return false;
  return (prevDx < 0 && nextDx >= 0) || (prevDx > 0 && nextDx <= 0);
}
