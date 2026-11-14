export const TAP_MAX_MOVE_PX = 8,
  TAP_MAX_MS = 400;

interface PointerSample {
  x: number;
  y: number;
  t: number;
}

/** A press that stayed put and ended quickly is a tap; anything else is a drag. */
export function isTap(down: PointerSample, up: PointerSample): boolean {
  const moved = Math.hypot(up.x - down.x, up.y - down.y);
  return moved <= TAP_MAX_MOVE_PX && up.t - down.t <= TAP_MAX_MS;
}
