import { NEW_SMOOTH_RUN, type SmoothRun } from "../challenges/smooth";

/**
 * The published copy of the Smooth sailing run, read by the HUD (the reach
 * readout and the give-up button). Like `sailLive`, it lives outside the
 * store so per-frame updates never re-render the builder.
 */
type Listener = () => void;

let current: SmoothRun = NEW_SMOOTH_RUN;
const listeners = new Set<Listener>();

export function subscribeSmooth(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSmoothRun(): SmoothRun {
  return current;
}

/** Publishes the latest run; `NEW_SMOOTH_RUN` resets it. */
export function publishSmooth(run: SmoothRun): void {
  current = run;
  for (const listener of listeners) listener();
}
