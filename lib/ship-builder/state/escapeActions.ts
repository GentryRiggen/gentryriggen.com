/**
 * The escape's buttons: the HUD asks, and the scene's escape runner hears it
 * on its next frame (and drops it if there is nothing to board or climb into
 * by then). Mutable on purpose, like `walkInput`.
 */
export type EscapeRequest = "board" | "climb-in";

let pending: EscapeRequest | null = null;

/** Board the boat beside the walker (see `EscapeSnapshot.boardable`). */
export function requestBoard(): void {
  pending = "board";
}

/** Climb into the boat beside the swimmer (see `EscapeSnapshot.pickup`). */
export function requestClimbIn(): void {
  pending = "climb-in";
}

/** Drops any request waiting (a walk starts or ends). */
export function clearEscapeRequest(): void {
  pending = null;
}

/** The request waiting for the runner, cleared as it is read. */
export function takeEscapeRequest(): EscapeRequest | null {
  const request = pending;
  pending = null;
  return request;
}
