import { useSyncExternalStore } from "react";
import type { SimState } from "@/lib/ship-builder/sim/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";

/**
 * The trial's current sim state, published for React. The runner works at
 * 60 Hz, which would re-render the UI every frame, so it publishes at most
 * every `LIVE_TRIAL_INTERVAL_MS`: plenty for a water gauge and a clock.
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

/** The trial's latest published sim state, or null outside a trial. */
export function useLiveTrialState(): SimState | null {
  return useSyncExternalStore(
    subscribeLiveTrial,
    getLiveTrialState,
    () => null
  );
}

// Clear the moment a run starts or the trial is left, in the store update
// itself, so a new run never flashes the previous run's water.
useShipBuilderStore.subscribe((state, previous) => {
  const { trial } = state;
  const before = previous.trial;
  if (trial === before) return;
  const isNewRun =
    trial.status === "running" &&
    (before.status !== "running" || before.runId !== trial.runId);
  const isLeaving = trial.status === "idle" || trial.status === "aiming";
  if (isNewRun || (isLeaving && before.status !== trial.status)) {
    clearLiveTrial();
  }
});
