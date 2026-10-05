import { useSyncExternalStore } from "react";
import {
  clearLiveTrial,
  getLiveTrialState,
  LIVE_TRIAL_INTERVAL_MS,
  publishLiveTrial,
  subscribeLiveTrial,
} from "@/lib/ship-builder/state/liveTrialState";
import type { SimState } from "@/lib/ship-builder/sim/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";

/**
 * The trial's current sim state, published for React. The runner works at
 * 60 Hz, which would re-render the UI every frame, so it publishes at most
 * every `LIVE_TRIAL_INTERVAL_MS`: plenty for a water gauge and a clock.
 */
export {
  clearLiveTrial,
  getLiveTrialState,
  LIVE_TRIAL_INTERVAL_MS,
  publishLiveTrial,
  subscribeLiveTrial,
};

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
