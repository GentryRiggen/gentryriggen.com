import type { WalkState } from "../walk";

/**
 * The published copy of the walker's state, read by the scene and HUD. Like
 * `sailLive`, it lives outside the store so per-frame updates never re-render
 * the builder.
 */
type Listener = () => void;

let current: WalkState | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Subscribes to changes; returns the unsubscribe function. */
export function subscribeWalk(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getWalkState(): WalkState | null {
  return current;
}

/** Publishes the latest state, or `null` when the walk ends. */
export function publishWalk(state: WalkState | null): void {
  current = state;
  emit();
}
