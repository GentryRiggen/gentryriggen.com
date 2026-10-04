"use client";

import { Square, Waves } from "lucide-react";
import { useEffect, useRef } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { focusSeaTrialButton } from "./SeaTrialButton";
import { SEA_LABELS } from "./seaTrialText";
import { panelClass } from "./styles";

/** The pill that shows while a sea trial is playing, with a way to stop. */
export default function SeaTrialStatus() {
  const trial = useShipBuilderStore((s) => s.trial);
  const endTrial = useShipBuilderStore((s) => s.endTrial);
  const stopButton = useRef<HTMLButtonElement>(null);
  const isRunning = trial.status === "running";
  const runId = trial.status === "idle" ? null : trial.runId;

  // The button that started this run (Sea trial or Try again) is gone, so
  // focus would drop to the page: hand it to Stop instead.
  useEffect(() => {
    if (isRunning) stopButton.current?.focus();
  }, [isRunning, runId]);

  if (trial.status !== "running") return null;
  return (
    <div
      role="status"
      className={`absolute left-1/2 top-[11.5rem] z-20 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-full border py-1 pl-4 pr-1 text-sm font-medium shadow-lg lg:top-3 ${panelClass}`}
    >
      <Waves
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400"
      />
      <span className="whitespace-nowrap">
        Sea trial · {SEA_LABELS[trial.input.sea]}
      </span>
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
