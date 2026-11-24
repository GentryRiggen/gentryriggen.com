/**
 * Riding a lifeboat: which boats can still be boarded and which one a
 * walker stands beside. Pure; the boats themselves stay visual (the
 * scripted `boat-lowered` events move them in the scene's effects), and
 * the ridden one is lowered when the player got in (fun over realism).
 */

/**
 * How near any part of a boat a walker must stand to get in (m, ship
 * frame). Its davits stop the walker at the boat's ends.
 */
export const BOARD_REACH_M = 3;

/** The bit of an event the ride reads (a sim or scripted event). */
interface BoatEvent {
  t: number;
  kind: string;
  index?: number;
}

/** A boat's spot by her deck edge: ship-frame x and y (port +). */
export interface BoatSpot {
  index: number;
  x: number;
  y: number;
  /** Half the boat's length along x (0: a point). */
  halfLength?: number;
}

/** The ride the store holds: which boat, and the shown time they got in. */
export interface BoatRide {
  index: number;
  at: number;
}

/** Boats still in their davits at `t` (lowered later), soonest first. */
export function boardableBoats(
  events: readonly BoatEvent[],
  t: number
): number[] {
  return events
    .filter(
      (e) => e.kind === "boat-lowered" && e.index !== undefined && e.t > t
    )
    .sort((a, b) => a.t - b.t)
    .map((e) => e.index!);
}

/** The next boat due to leave after `t`, or null when every boat has gone. */
export function nextBoardable(
  events: readonly BoatEvent[],
  t: number
): number | null {
  let best: BoatEvent | null = null;
  for (const e of events)
    if (
      e.kind === "boat-lowered" &&
      e.index !== undefined &&
      e.t > t &&
      (!best || e.t < best.t)
    )
      best = e;
  return best ? best.index! : null;
}

/** The boat nearest a walker at ship-frame (x, y) within `maxM`, or null. */
export function nearestBoardable(
  x: number,
  y: number,
  boats: readonly BoatSpot[],
  maxM = BOARD_REACH_M
): number | null {
  let best: number | null = null;
  let bestD = maxM;
  for (const b of boats) {
    const along = Math.max(0, Math.abs(b.x - x) - (b.halfLength ?? 0));
    const d = Math.hypot(along, b.y - y);
    if (d <= bestD) {
      bestD = d;
      best = b.index;
    }
  }
  return best;
}

/** The ridden boat is lowered when they got in (in place; others unchanged). */
export function rideLowered(
  lowered: Map<number, number>,
  ride: BoatRide | null | undefined
): void {
  if (ride) lowered.set(ride.index, ride.at);
}
