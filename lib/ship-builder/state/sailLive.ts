import type { SailState } from "../sail/types";

/**
 * The published copy of the sailing ship's state, read by the scene and HUD.
 * Like `liveTrialState`, it lives outside the store so per-frame updates never
 * re-render the builder.
 */
type Listener = () => void;

let current: SailState | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Subscribes to changes; returns the unsubscribe function. */
export function subscribeSail(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSailState(): SailState | null {
  return current;
}

/** Publishes the latest state, or `null` when the drive ends. */
export function publishSail(state: SailState | null): void {
  current = state;
  emit();
}
