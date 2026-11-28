import type { InteriorMap } from "./types";

/**
 * Whether her rooms are open (see README.md "Closing"): not once she has
 * broken, and, where the map says so (`closeAtHeelDeg`, the Concordia's
 * 30), not while she is leaned that far either way. Closed means the deck
 * doors do not open, the entries hide and anyone inside is walked out. The
 * Titanic's rooms close only on the break.
 */
export function roomsOpen(
  interior: Pick<InteriorMap, "closeAtHeelDeg">,
  frame: { listDeg: number },
  broken: boolean
): boolean {
  if (broken) return false;
  const at = interior.closeAtHeelDeg;
  return !(at !== undefined && Math.abs(frame.listDeg) >= at);
}
