/**
 * The lights inside (see README.md): the ship's power (the sim's
 * `frame.power`, flickering from 10° bow down, out at the break), times
 * each room's own wiring: its lamps flicker once the water over its floor
 * passes 0.3 m and die at 0.6 m. A torch comes on by itself in a dim room.
 */

/** Water over the floor where a room's lamps start to flicker (m). */
export const ROOM_FLICKER_FROM_M = 0.3;
/** Water over the floor where they go out (m). */
export const ROOM_DARK_AT_M = 0.6;
/** The torch comes on in a room whose power is under this. */
export const TORCH_BELOW = 0.35;

/** The sim's flicker (sim/run.ts `flicker`): mostly near full, some dips. */
function dip(k: number): number {
  const h = (((k * 2654435761) >>> 0) % 1000) / 1000;
  return h < 0.3 ? 0.15 + h : 0.85 + 0.15 * h;
}

/**
 * A room's light (0..1): the ship's `power` while the water over its floor
 * is under 0.3 m, deterministic flicker dips (keyed on the time `t`, s, and
 * the depth) from 0.3 to 0.6 m, and out from 0.6 m. A dry room (no depth,
 * NaN or negative) has the ship's power.
 */
export function roomPower(power: number, depthM: number, t = 0): number {
  if (!(depthM >= ROOM_FLICKER_FROM_M)) return power;
  if (depthM >= ROOM_DARK_AT_M) return 0;
  return power * dip(Math.floor(t * 6) + Math.floor(depthM * 100) * 7919);
}

/** Whether the torch is on in a room with this power. */
export function torchOn(roomPowerValue: number): boolean {
  return roomPowerValue < TORCH_BELOW;
}
