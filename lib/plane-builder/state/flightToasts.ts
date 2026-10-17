import type { FlightEvent } from "../sim/flight";

export interface FlightToast {
  id: number;
  text: string;
}

/** The pop-up words for a sim event, or null when it gets none. */
export function toastForEvent(event: FlightEvent): string | null {
  switch (event.type) {
    case "ring":
      return "Boost!";
    case "fuel":
      return "+Fuel";
    case "milestone":
      if (event.share === 0.25) return "25%!";
      if (event.share === 0.5) return "Halfway!";
      if (event.share === 0.75) return "75%!";
      return null;
    default:
      return null;
  }
}

/**
 * The newest pop-up on the flight HUD. The component times it out; the store
 * only holds it. Newest wins, and each push gets a fresh id.
 */
let current: FlightToast | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export const flightToasts = {
  get: () => current,
  push(text: string) {
    current = { id: nextId, text };
    nextId += 1;
    notify();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function clearFlightToasts() {
  current = null;
  notify();
}
