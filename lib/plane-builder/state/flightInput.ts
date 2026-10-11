import type { StickInput } from "../sim/flight";

/** Written by keyboard/touch handlers, read by FlightRunner every step. */
export const flightInput: StickInput = { pitch: 0, bank: 0, boost: false };

export function resetFlightInput(): void {
  flightInput.pitch = 0;
  flightInput.bank = 0;
  flightInput.boost = false;
}
