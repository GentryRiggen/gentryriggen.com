"use client";

import { ArrowDownToLine, Square, Waves } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  formatStoryTime,
  storyClockSeconds,
  storyMinutesSinceImpact,
} from "@/lib/ship-builder/sim/story";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { useLiveTrialState } from "../scene/liveTrial";
import { focusSeaTrialButton } from "./SeaTrialButton";
import { FOLLOW_HER_DOWN, SEA_LABELS } from "./seaTrialText";
import SoundToggle from "./SoundToggle";
import { panelClass } from "./styles";

/**
 * The pill that shows while a sea trial is playing, with a way to stop. Once
 * an iceberg trial has sunk it also offers to follow her down to the floor.
 */
export default function SeaTrialStatus() {
  const trial = useShipBuilderStore((s) => s.trial);
  const endTrial = useShipBuilderStore((s) => s.endTrial);
  const descend = useShipBuilderStore((s) => s.descend);
  const stopButton = useRef<HTMLButtonElement>(null);
  const isRunning = trial.status === "running";
  const runId = trial.status === "running" ? trial.runId : null;
  const live = useLiveTrialState();

  // The button that started this run (Sea trial or Try again) is gone, so
  // focus would drop to the page: hand it to Stop instead.
  useEffect(() => {
    if (isRunning) stopButton.current?.focus();
  }, [isRunning, runId]);

  if (trial.status !== "running") return null;
  const isIceberg = trial.input.iceberg !== undefined;
  const canFollow =
    isIceberg &&
    !trial.descending &&
    (live?.events.some((event) => event.kind === "sunk") ?? false);
  return (
    <div
      role="status"
      className={`absolute left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-full border py-1 pl-4 pr-1 text-sm font-medium shadow-lg ${panelClass}`}
    >
      <Waves
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400"
      />
      {/* Narrow screens keep the strip slim by dropping the name. */}
      <span className="whitespace-nowrap max-sm:hidden">
        {isIceberg ? "Iceberg trial" : "Sea trial"} ·{" "}
        {SEA_LABELS[trial.input.sea]}
      </span>
      {isIceberg && (
        // Hidden from the live region: a clock ticking ten times a second
        // would flood a screen reader.
        <span
          aria-hidden="true"
          data-testid="story-clock"
          className="whitespace-nowrap tabular-nums text-slate-500 dark:text-slate-400"
        >
          ·{" "}
          {formatStoryTime(
            storyMinutesSinceImpact(
              storyClockSeconds(live?.time ?? 0, live?.events ?? [])
            )
          )}
        </span>
      )}
      {canFollow && (
        <button
          type="button"
          onClick={descend}
          className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-sky-600 px-4 text-sm font-medium text-white hover:bg-sky-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:bg-sky-500 dark:hover:bg-sky-400 dark:focus-visible:outline-sky-300"
        >
          <ArrowDownToLine aria-hidden="true" className="h-4 w-4 shrink-0" />
          {FOLLOW_HER_DOWN}
        </button>
      )}
      {isIceberg && <SoundToggle />}
      <button
        ref={stopButton}
        type="button"
        onClick={() => {
          endTrial();
          focusSeaTrialButton();
        }}
        className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-1.5 rounded-full bg-slate-100 px-4 text-sm font-medium text-slate-800 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus-visible:outline-sky-400"
      >
        <Square aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        Stop
      </button>
    </div>
  );
}
