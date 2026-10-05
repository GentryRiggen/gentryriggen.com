import type { SimState } from "../sim/types";

/**
 * The published copy of the running trial's sim state. It lives apart from
 * `liveTrial.ts` (which also watches the store) so the store itself can read
 * it without an import cycle.
 */
export const LIVE_TRIAL_INTERVAL_MS = 100;

type Listener = () => void;

let current: SimState | null = null;
let lastPublishedAt = Number.NEGATIVE_INFINITY;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Subscribes to changes; returns the unsubscribe function. */
export function subscribeLiveTrial(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLiveTrialState(): SimState | null {
  return current;
}

/**
 * Publishes `state`, skipping it when the last publish was under the interval
 * ago. `force` always publishes (the first state and the final one).
 */
export function publishLiveTrial(
  state: SimState,
  now: number = performance.now(),
  force = false
): void {
  if (!force && now - lastPublishedAt < LIVE_TRIAL_INTERVAL_MS) return;
  lastPublishedAt = now;
  current = state;
  emit();
}

/** Forgets the published state (a trial began or ended). */
export function clearLiveTrial(): void {
  lastPublishedAt = Number.NEGATIVE_INFINITY;
  if (current === null) return;
  current = null;
  emit();
}
