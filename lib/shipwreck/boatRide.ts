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
/**
 * A boat with a deck height (a recess boat) is reached only by a walker
 * whose floor is within this of it (m), so not from the decks over it.
 */
export const BOARD_DECK_TOL_M = 1;

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
  /**
   * Its deck's height (ship-frame z): only a walker on that deck reaches
   * it. Missing: any walker in reach in plan (every ship but a recess).
   */
  deckZ?: number;
}

/** The bits of a boat's recipe its spot reads. */
export interface BoatSpotSource {
  index: number;
  side: "port" | "starboard" | "centre";
  x: number;
  y: number;
  length: number;
  beam: number;
  /** Outboard y of its davits' feet (the deck edge). */
  edgeY: number;
  /** The deck it stands on (ship-frame z). */
  deckZ: number;
  /** Stowed in a recess, its deck inboard of it (the Concordia's). */
  recess?: true;
}

/**
 * Where a walker gets into a boat (the scene's `Effects.tsx`): 1 m in from
 * her deck edge by its davits, along its whole length. A boat in a recess
 * fills the deck by her edge, so its spot is its inboard side, where the
 * promenade is, and only a walker on its deck reaches it (her open decks
 * over it are near its inboard side in plan).
 */
export function boatSpot(b: BoatSpotSource): BoatSpot {
  const sign = b.side === "port" ? 1 : -1;
  if (b.recess)
    return {
      index: b.index,
      x: b.x,
      y: sign * (Math.abs(b.y) - b.beam / 2),
      halfLength: b.length / 2,
      deckZ: b.deckZ,
    };
  return {
    index: b.index,
    x: b.x,
    y: sign * Math.max(0, Math.abs(b.edgeY) - 1),
    halfLength: b.length / 2,
  };
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

/**
 * The boat nearest a walker at ship-frame (x, y) within `maxM`, or null.
 * `floorZ` is the walker's floor (ship-frame z): a spot with a `deckZ`
 * further than BOARD_DECK_TOL_M from it is out of reach.
 */
export function nearestBoardable(
  x: number,
  y: number,
  boats: readonly BoatSpot[],
  maxM = BOARD_REACH_M,
  floorZ?: number
): number | null {
  let best: number | null = null;
  let bestD = maxM;
  for (const b of boats) {
    if (
      b.deckZ !== undefined &&
      floorZ !== undefined &&
      Math.abs(floorZ - b.deckZ) > BOARD_DECK_TOL_M
    )
      continue;
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
