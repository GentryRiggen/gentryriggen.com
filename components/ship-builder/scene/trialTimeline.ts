import {
  buildTimeline,
  extendWithDescent,
  type Timeline,
} from "@/lib/ship-builder/sim/timeline";
import type { TrialInput } from "@/lib/ship-builder/sim/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";

/**
 * The iceberg trial's precomputed timeline, kept outside React like
 * `trialPlayback`: thousands of states are worked out once per trial input,
 * then the runner, "Watch again" and the scrubber all read the same one.
 */
interface CachedTimeline {
  input: TrialInput;
  base: Timeline;
  descended: Timeline | null;
}

let cached: CachedTimeline | null = null;

function cacheFor(input: TrialInput): CachedTimeline {
  if (cached?.input !== input) {
    cached = { input, base: buildTimeline(input), descended: null };
  }
  return cached;
}

/**
 * The timeline for `input` (worked out on first use, keyed by the input
 * object), with the descent to the sea floor appended when `descending`.
 */
export function trialTimelineFor(
  input: TrialInput,
  descending = false
): Timeline {
  const entry = cacheFor(input);
  if (!descending) return entry.base;
  entry.descended ??= extendWithDescent(entry.base, input);
  return entry.descended;
}

/** Forgets the cached timeline (the trial was left). */
export function clearTrialTimeline(): void {
  cached = null;
}

// Free the states the moment the player leaves the trial.
useShipBuilderStore.subscribe((state, previous) => {
  const { status } = state.trial;
  if (status === previous.trial.status) return;
  if (status === "idle" || status === "aiming") clearTrialTimeline();
});
