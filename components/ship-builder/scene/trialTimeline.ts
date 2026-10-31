import {
  type EvacuationPlan,
  planEvacuation,
} from "@/lib/ship-builder/crowd/evacuation";
import type { Ship } from "@/lib/ship-builder/model/types";
import {
  buildTimeline,
  extendWithDescent,
  stateAt,
  timelineEnd,
  type Timeline,
} from "@/lib/ship-builder/sim/timeline";
import { isTimelineTrial } from "@/lib/ship-builder/sim/trialKind";
import type { TrialInput } from "@/lib/ship-builder/sim/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { crowdPlanFor } from "./crowdView";

/**
 * A timeline trial's (iceberg or storm) precomputed timeline, kept outside
 * React like
 * `trialPlayback`: thousands of states are worked out once per trial input,
 * then the runner, "Watch again" and the scrubber all read the same one.
 */
interface CachedTimeline {
  input: TrialInput;
  base: Timeline;
  descended: Timeline | null;
  /** The ship the evacuation plans were made for. */
  evacuationShip: Ship | null;
  /** Evacuation plan per `descending`, worked out on first use. */
  evacuations: Map<boolean, EvacuationPlan | null>;
}

let cached: CachedTimeline | null = null;

function cacheFor(input: TrialInput): CachedTimeline {
  if (cached?.input !== input) {
    cached = {
      input,
      base: buildTimeline(input),
      descended: null,
      evacuationShip: null,
      evacuations: new Map(),
    };
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

/**
 * The evacuation of the timeline trial for `input` on `ship` (who takes which
 * lifeboat, when each lowers away), or null when she does not sink or it is
 * a waves trial. Worked out once beside the timeline it reads, from
 * the same crowd walk mode shows, and forgotten with it.
 */
export function trialEvacuationFor(
  input: TrialInput,
  ship: Ship,
  descending = false
): EvacuationPlan | null {
  if (!isTimelineTrial(input)) return null;
  const entry = cacheFor(input);
  if (entry.evacuationShip !== ship) {
    entry.evacuationShip = ship;
    entry.evacuations = new Map();
  }
  if (!entry.evacuations.has(descending)) {
    const timeline = trialTimelineFor(input, descending);
    const { grid, plan } = crowdPlanFor(ship);
    entry.evacuations.set(
      descending,
      planEvacuation(ship, grid, plan, {
        input,
        stateAt: (t) => stateAt(timeline, t),
        end: timelineEnd(timeline),
      })
    );
  }
  return entry.evacuations.get(descending) ?? null;
}

/**
 * The evacuation of the trial on show (running or its result), or null. For
 * scene code that reads it every frame: a cached lookup after the first.
 */
export function activeEvacuation(): EvacuationPlan | null {
  const { trial, ship } = useShipBuilderStore.getState();
  if (trial.status !== "running" && trial.status !== "result") return null;
  return trialEvacuationFor(trial.input, ship, trial.descending);
}

/** Forgets the cached timeline and its evacuation (the trial was left). */
export function clearTrialTimeline(): void {
  cached = null;
}

// Free the states the moment the player leaves the trial.
useShipBuilderStore.subscribe((state, previous) => {
  const { status } = state.trial;
  if (status === previous.trial.status) return;
  if (status === "idle" || status === "aiming") clearTrialTimeline();
});

/**
 * Where the timeline trial for `input` breaks her, cells from the bow, or
 * null if she holds together (or it is a waves trial). Known from the start
 * because the timeline is worked out ahead.
 */
export function plannedBreakX(input: TrialInput | null): number | null {
  if (!input || !isTimelineTrial(input)) return null;
  const { states } = trialTimelineFor(input);
  return states[states.length - 1]?.breakup?.atX ?? null;
}
