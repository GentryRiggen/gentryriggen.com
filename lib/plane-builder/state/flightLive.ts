import type { FlightState } from "../sim/flight";

/**
 * The running flight's state, for the HUD and the camera. FlightRunner owns
 * it; readers must not write. `notify` fires about 10 times a second.
 */
let current: FlightState | null = null;
const listeners = new Set<() => void>();

export const flightLive = {
  get: () => current,
  set(state: FlightState | null) {
    current = state;
  },
  notify() {
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
