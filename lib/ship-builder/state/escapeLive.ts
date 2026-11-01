import { useSyncExternalStore } from "react";
import type { EscapePhase } from "../walk/escape";
import { clearEscapeRequest } from "./escapeActions";

/**
 * The published copy of the player's escape (see `walk/escape.ts`): the phase,
 * the boat they could board from where they stand, and the boat that could
 * pick them up in the water. Written by the scene's escape runner, read by
 * the scene and the HUD. Like `walkLive`, it lives outside the store.
 *
 * A swimmer moves every frame, so there are two copies: `getEscape()` is
 * always the latest (for frame callbacks), while subscribers and
 * `useEscape()` hear only of a change that matters to a screen (the phase's
 * kind or boat, the cold warning, a boat to board or to climb into). The
 * hook's swimmer may lag; read `getEscape()` for live numbers.
 */
export interface EscapeSnapshot {
  phase: EscapePhase;
  boardable: { boatId: string; kind: "davit" | "raft" } | null;
  pickup: { boatId: string } | null;
}

type Listener = () => void;

const ABOARD: EscapeSnapshot = {
  phase: { kind: "aboard" },
  boardable: null,
  pickup: null,
};

let latest: EscapeSnapshot = ABOARD;
let published: EscapeSnapshot = ABOARD;
const listeners = new Set<Listener>();

function boatOf(phase: EscapePhase): string | null {
  return phase.kind === "in-boat" || phase.kind === "jumping"
    ? phase.boatId
    : null;
}

/** Whether a screen would show something different. */
function differs(a: EscapeSnapshot, b: EscapeSnapshot): boolean {
  if (a.phase.kind !== b.phase.kind) return true;
  if (a.phase.kind !== "aboard" && b.phase.kind !== "aboard") {
    if (a.phase.since !== b.phase.since) return true;
  }
  if (boatOf(a.phase) !== boatOf(b.phase)) return true;
  const warned = (s: EscapeSnapshot) =>
    s.phase.kind === "swimming" && s.phase.warned;
  if (warned(a) !== warned(b)) return true;
  if (a.boardable?.boatId !== b.boardable?.boatId) return true;
  if (a.boardable?.kind !== b.boardable?.kind) return true;
  return a.pickup?.boatId !== b.pickup?.boatId;
}

/** Subscribes to changes that matter; returns the unsubscribe function. */
export function subscribeEscape(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The latest escape, up to this frame. */
export function getEscape(): EscapeSnapshot {
  return latest;
}

/** Publishes the escape; subscribers hear only of a change that matters. */
export function publishEscape(next: EscapeSnapshot): void {
  latest = next;
  if (!differs(published, next)) return;
  published = next;
  for (const listener of listeners) listener();
}

/** Back aboard with nothing to board (a walk starts or ends). */
export function resetEscape(): void {
  // A stale tap must never carry into the next walk.
  clearEscapeRequest();
  latest = ABOARD;
  published = ABOARD;
  for (const listener of listeners) listener();
}

function getPublished(): EscapeSnapshot {
  return published;
}

/** The escape for a component; re-renders only on a change that matters. */
export function useEscape(): EscapeSnapshot {
  return useSyncExternalStore(subscribeEscape, getPublished, getPublished);
}
