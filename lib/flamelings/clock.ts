/**
 * The game's clock. Everything reads time here, so tests (and the e2e test
 * hook) can move it. Real time keeps flowing from wherever it was set.
 */
let offsetMs = 0;

export function now(): number {
  return Date.now() + offsetMs;
}

/** Sets the clock to `ms`; it then keeps ticking in real time. */
export function setNow(ms: number): void {
  offsetMs = ms - Date.now();
}

/** Jumps the clock forward by `ms`. */
export function skip(ms: number): void {
  offsetMs += ms;
}

export function resetClock(): void {
  offsetMs = 0;
}
