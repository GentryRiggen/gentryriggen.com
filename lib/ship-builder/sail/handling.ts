import type { ShipKind } from "../model/kinds";
import type { Handling, SailShip } from "./types";

/** Cells per second for one knot. */
export const CELLS_PER_KNOT = 0.2;

/** Turning agility by kind: navy nimble, cargo ponderous. */
const AGILITY: Record<ShipKind, number> = {
  navy: 1.3,
  cruise: 0.95,
  liner: 0.85,
  cargo: 0.6,
};

const BASE_TURN_RATE = 0.5;
/** A ship this long turns at the base rate; longer is slower, shorter faster. */
const REFERENCE_LENGTH = 14;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

export function handlingFromShip(ship: SailShip): Handling {
  return {
    topSpeed: ship.topSpeedKnots * CELLS_PER_KNOT,
    accelSeconds: clamp(4 + ship.grossTonnage / 5000, 4, 22),
    maxTurnRate:
      BASE_TURN_RATE *
      AGILITY[ship.kind] *
      clamp(REFERENCE_LENGTH / ship.length, 0.4, 1.4),
    rudderRate: 1.5,
  };
}
