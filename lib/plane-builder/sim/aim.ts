import { MAX_AIM_PITCH, MAX_AIM_YAW } from "./constants";
import type { LaunchAim, StickInput } from "./flight";

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/**
 * Maps a slingshot drag (pixels from where the pointer went down) to a launch
 * aim. Dragging down aims up, dragging left aims right, like pulling a band.
 */
export function aimFromDrag(
  dx: number,
  dy: number,
  maxDrag: number
): LaunchAim {
  if (maxDrag <= 0) return { pitch: 0, yaw: 0, power: 0 };
  return {
    power: Math.min(1, Math.hypot(dx, dy) / maxDrag) + 0,
    pitch: clamp(dy / maxDrag, 0, 1) * MAX_AIM_PITCH + 0,
    yaw: clamp(-dx / maxDrag, -1, 1) * MAX_AIM_YAW + 0,
  };
}

/** Maps a steering drag to the stick: dragging up climbs, right banks right. */
export function stickFromDrag(
  dx: number,
  dy: number,
  radius: number
): Pick<StickInput, "pitch" | "bank"> {
  if (radius <= 0) return { pitch: 0, bank: 0 };
  return {
    pitch: clamp(-dy / radius, -1, 1) + 0,
    bank: clamp(dx / radius, -1, 1) + 0,
  };
}
