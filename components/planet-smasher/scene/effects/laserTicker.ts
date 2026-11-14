import type { laserAim } from "./laserAim";

/** How often a held laser asks the cooldown whether it may fire. */
export const LASER_POLL_MS = 30;

/**
 * While the laser is held, keeps asking `canFire` (the cooldown check) and
 * counts a tick whenever it says yes, so a still pointer keeps firing.
 * Returns a function that stops it.
 */
export function startLaserTicker(
  aim: Pick<typeof laserAim, "held" | "ticks">,
  canFire: () => boolean,
  pollMs = LASER_POLL_MS
): () => void {
  const id = setInterval(() => {
    if (aim.held && canFire()) aim.ticks++;
  }, pollMs);
  return () => clearInterval(id);
}
