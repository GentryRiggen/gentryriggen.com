import type { WalkHalf, WalkState } from "../walk";

/**
 * The published copy of the walker's state, read by the scene and HUD. Like
 * `sailLive`, it lives outside the store so per-frame updates never re-render
 * the builder.
 */
type Listener = () => void;

let current: WalkState | null = null;
let half: WalkHalf | null = null;
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
  if (state === null) half = null;
  emit();
}

/** The half of a broken ship the walker rides, or null while she is whole. */
export function getWalkHalf(): WalkHalf | null {
  return half;
}

/** Records the half the walker rides (null while she is whole). */
export function publishWalkHalf(next: WalkHalf | null): void {
  half = next;
}
